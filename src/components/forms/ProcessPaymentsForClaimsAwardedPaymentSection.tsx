import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Printer, Trash2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  printApprovedPaymentsListNoBatch,
  printClaimsPaidBatchWithBatchNo,
} from '../../utils/ClaimsAwardedPaymentsList_jspdf';
import { generateABAFile, ABAPayerInfo, ABAPayeeRow } from '../../utils/abaGenerator';

type Row = {
  IRN: string | number;
  DisplayIRN?: string;
  SubmissionDate?: string;
  IncidentType?: 'Injury' | 'Death' | string;
  WorkerFirstName?: string;
  WorkerLastName?: string;
};

type DepositRow = {
  BADMID: number;
  IRN: string | number;
  EbankAmountPaid?: number | string | null;
  BankName?: string | null;
  BatchNo?: string | null;
  // (not used in the main list, but used when inserting to BankReconciliation)
  OWCAccountNumber?: string | null;
  PaymentDetails?: string | null;

  // NEW (Worker bank details saved in bankaccountdepositmaster)
  WorkerBankName?: string | null;
  WorkerBSBBranchNo?: string | null;
  WorkerAccountNumber?: string | null;
  Recipients?: string | null;
};

type JoinedRow = Row & {
  BADMID: number;
  EbankAmountPaid?: number;
  BankName?: string;
  PaymentDetails?: string;
  Recipients?: string;

  // NEW (for printing)
  WorkerBankName?: string;
  WorkerBSBBranchNo?: string;
  WorkerAccountNumber?: string;
};

interface Props {
  onClose?: () => void;
}

const dateOnly = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ddmmyyyy = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;

const ddmmyyDashed = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(-2)}`;

const yymmdd_hhmmss = (d = new Date()) => {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd} ${hh}${min}${ss}`;
};

const ProcessPaymentsForClaimsAwardedPaymentSection: React.FC<Props> = ({ onClose }) => {
  // ----- section 1: list state -----
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<JoinedRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = useMemo(
    () => rows.length > 0 && rows.every(r => checked[String(r.BADMID)]),
    [rows, checked]
  );
  const someChecked = useMemo(
    () => rows.some(r => checked[String(r.BADMID)]),
    [rows, checked]
  );

  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirst, setSearchFirst] = useState('');
  const [searchLast, setSearchLast] = useState('');

  // ----- section 2: batching state -----
  const [batchList, setBatchList] = useState<JoinedRow[]>([]);
  const totalSelectedCount = batchList.length;
  const totalSelectedValue = useMemo(
    () => batchList.reduce((s, r) => s + (Number(r.EbankAmountPaid ?? 0) || 0), 0),
    [batchList]
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBatchNo, setConfirmBatchNo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // ABA state
  const [abaPayer, setAbaPayer] = useState<ABAPayerInfo>({
    companyName: 'OFFICE OF WORKERS COMP',
    bsb: '088-943',
    accountNumber: '1000489411',
    userId: '000001',
    description: 'PAYROLL',
    debitDescription: 'SALARY',
  });
  const [abaEditing, setAbaEditing] = useState(false);

  // ----- load list -----
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) base rows from the view (approved by manager)
      let base = supabase
        .from('approved_awarded_claims_paymentsmanagerreview_view')
        .select('*');

      if (searchIRN) base = base.ilike('DisplayIRN', `%${searchIRN}%`);
      if (searchFirst) base = base.ilike('WorkerFirstName', `%${searchFirst}%`);
      if (searchLast) base = base.ilike('WorkerLastName', `%${searchLast}%`);

      const { data: approved, error: e1 } = await base;
      if (e1) throw e1;

      const approvedRows: Row[] = (approved || []) as any[];

      const irns = approvedRows.map(r => r.IRN).filter(Boolean);
      const uniqueIrns = Array.from(new Set(irns));

      // 2) enrich with deposit info (only fields needed for the grid)
      let allDeposits: DepositRow[] = [];
      if (uniqueIrns.length > 0) {
        const { data: deps, error: e2 } = await supabase
          .from('bankaccountdepositmaster')
          .select('BADMID, IRN, EbankAmountPaid, BankName, BatchNo, WorkerBankName, WorkerBSBBranchNo, WorkerAccountNumber, PaymentDetails, Recipients')
          .in('IRN', uniqueIrns)
          .eq('PaymentManagerReviewStatus', 'ApprovedManagerReview'); // match manager approval status

        if (e2) throw e2;
        allDeposits = (deps || []) as DepositRow[];
      }

      // 3) join: one row per deposit
      const joined: JoinedRow[] = [];
      allDeposits.forEach(dep => {
        const baseRow = approvedRows.find(r => String(r.IRN) === String(dep.IRN));
        if (baseRow) {
          joined.push({
            ...baseRow,
            BADMID: dep.BADMID,
            EbankAmountPaid: Number(dep.EbankAmountPaid ?? 0),
            BankName: dep.BankName ?? '',
            PaymentDetails: dep.PaymentDetails ?? '',
            Recipients: dep.Recipients ?? '',
            WorkerBankName: dep.WorkerBankName ?? '',
            WorkerBSBBranchNo: dep.WorkerBSBBranchNo ?? '',
            WorkerAccountNumber: dep.WorkerAccountNumber ?? '',
          });
        }
      });

      setRows(joined);
      // keep previous checks if still present
      setChecked(prev => {
        const next: Record<string, boolean> = {};
        joined.forEach(r => {
          const key = String(r.BADMID);
          next[key] = prev[key] ?? false;
        });
        return next;
      });
    } catch (err: any) {
      console.error('load error', err);
      setError(err.message || 'Failed to load approved claims.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadData();
  };

  const toggleAll = () => {
    if (allChecked) {
      const next: Record<string, boolean> = {};
      rows.forEach(r => (next[String(r.BADMID)] = false));
      setChecked(next);
    } else {
      const next: Record<string, boolean> = {};
      rows.forEach(r => (next[String(r.BADMID)] = true));
      setChecked(next);
    }
  };

  const toggleOne = (badmid: number, v: boolean) => {
    setChecked(prev => ({ ...prev, [String(badmid)]: v }));
  };

  const confirmList = () => {
    const selected = rows.filter(r => checked[String(r.BADMID)]);
    setBatchList(selected);
  };

  const clearBatchList = () => {
    setBatchList([]);
  };




  // --- helpers ---
  const ddmmyyyy = (d = new Date()) =>
    `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;

  // --- daily-reset generator: DDMMYYYY-001, -002, ...
  const generateNextBatchNo = async (): Promise<string> => {
    const prefix = ddmmyyyy(new Date());

    // 1) get the highest existing suffix for today (fast path)
    const { data, error } = await supabase
      .from('bankaccountdepositmaster')
      .select('BatchNo')
      .ilike('BatchNo', `${prefix}-%`)        // BatchNo is TEXT in DB
      .order('BatchNo', { ascending: false }) // safe because fixed-width suffix with zero-padding
      .limit(1);

    if (error) {
      console.error('batch lookup error', error);
      return `${prefix}-001`;
    }

    const last = data?.[0]?.BatchNo ? String(data[0].BatchNo).trim() : '';
    const m = last.match(new RegExp(`^${prefix}-(\\d+)$`));
    const lastNum = m ? parseInt(m[1], 10) : 0;

    // 2) propose next
    let nextNum = lastNum + 1;
    let candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;

    // 3) uniqueness guard (handles concurrency/races)
    // If, in the tiny window between reading and using the number, someone else used it,
    // we bump it until we find a free one (few iterations).
    for (let i = 0; i < 5; i++) {
      const { count, error: cErr } = await supabase
        .from('bankaccountdepositmaster')
        .select('BatchNo', { count: 'exact', head: true })
        .eq('BatchNo', candidate);

      if (cErr) {
        console.error('batch uniqueness check error', cErr);
        break; // fall back to current candidate
      }

      if (!count || count === 0) break;     // unique → use it
      nextNum += 1;                          // taken → try the next
      candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    }

    return candidate;
  };




  const openConfirm = async () => {
    if (batchList.length === 0) return;
    const bn = await generateNextBatchNo();
    setConfirmBatchNo(bn);
    setConfirmOpen(true);
  };

  const proceedProcess = async () => {
    if (batchList.length === 0 || !confirmBatchNo) return;
    setSaving(true);
    try {
      const irns = Array.from(new Set(batchList.map(r => r.IRN)));
      const badmids = batchList.map(r => r.BADMID);
      const today = dateOnly(new Date());
      const notes = `Payment Processed - Date: ${today} Batch No: ${confirmBatchNo}`;

      // 1) update claimsawardedpaymentsectionreview
      const { error: up1 } = await supabase
        .from('claimsawardedpaymentsectionreview')
        .update({
          CAPSRReviewStatus: 'PaymentProcessed',
          CAPSRNotes: notes,
        })
        .in('IRN', irns);
      if (up1) throw up1;

      // 2) update bankaccountdepositmaster
      const { error: up2 } = await supabase
        .from('bankaccountdepositmaster')
        .update({
          PaymentManagerReviewStatus: 'PaymentProcessed',
          BatchNo: confirmBatchNo,
        })
        .in('BADMID', badmids);
      if (up2) throw up2;

      // --- NEW: write to BankReconciliation for each processed IRN ---

      // Map BADMID -> metadata from the selected batch list
      const metaByBadmid: Record<string, { irn: string; displayIRN: string; workerName: string; paymentDetails: string }> = {};
      for (const r of batchList) {
        const key = String(r.BADMID);
        const workerName = `${r.WorkerFirstName ?? ''} ${r.WorkerLastName ?? ''}`.trim();
        metaByBadmid[key] = {
          irn: String(r.IRN),
          displayIRN: r.DisplayIRN ?? '',
          workerName,
          paymentDetails: r.PaymentDetails ?? '',
        };
      }

      // Pull details we need for reconciliation rows (include worker bank fields)
      const { data: depData, error: depErr } = await supabase
        .from('bankaccountdepositmaster')
        .select(
          'BADMID, IRN, EbankAmountPaid, OWCAccountNumber, PaymentDetails, BatchNo, WorkerBankName, WorkerBSBBranchNo, WorkerAccountNumber'
        )
        .in('BADMID', badmids);

      if (depErr) throw depErr;

      const reconRows = (depData || []).map((d: any) => {
        const badmidKey = String(d.BADMID);
        const meta = metaByBadmid[badmidKey] || { irn: '', displayIRN: '', workerName: '', paymentDetails: '' };
        const amount = Number(d.EbankAmountPaid ?? 0) || 0;

        // ✅ no labels for worker/bank/bsb/account/paymentDetails
        const descParts = [
          `IRN: ${meta.irn}`,                         // keep label
          meta.displayIRN ? `CRN: ${meta.displayIRN}` : null, // keep label
          meta.workerName || null,                  // value only
          d.WorkerBankName ? String(d.WorkerBankName) : null,
          d.WorkerBSBBranchNo ? String(d.WorkerBSBBranchNo) : null,
          d.WorkerAccountNumber ? String(d.WorkerAccountNumber) : null,
          `Date Processed: ${today}`,               // keep label
          meta.paymentDetails ? String(meta.paymentDetails) : null, // value only
          `Batch No: ${confirmBatchNo}`,            // keep label
        ].filter(Boolean);

        return {
          OWCBankAccountNumber: d.OWCAccountNumber || null,
          Date: today,
          Description: descParts.join(' | '),
          Debit: amount,
        };
      });


      if (reconRows.length) {
        const { error: brErr } = await supabase
          .from('BankReconciliation')
          .insert(reconRows);
        if (brErr) throw brErr;
      }
      // --- /NEW ---

      // done
      setConfirmOpen(false);
      setBatchList([]);
      await loadData();
    } catch (e) {
      console.error('Process failed', e);
      setError('Failed to process payments. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadABA = () => {
    if (batchList.length === 0) return;

    const dashDate = ddmmyyDashed(new Date());

    const payees: ABAPayeeRow[] = batchList.map((r) => ({
      bsb: r.WorkerBSBBranchNo ?? '',
      accountNumber: r.WorkerAccountNumber ?? '',
      accountName: (r.Recipients || `${r.WorkerFirstName ?? ''} ${r.WorkerLastName ?? ''}`).trim(),
      amount: Number(r.EbankAmountPaid ?? 0),
      reference: `CLAIMSPAY-${dashDate}`, // standard: CLAIMSPAY-DD-MM-YY
    }));

    const content = generateABAFile(payees, abaPayer);
    
    // Download logic
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = yymmdd_hhmmss(new Date());
    a.href = url;
    a.download = `FileUpload ${ts}.aba`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal container */}
      <div className="absolute inset-0 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Process Payments — Claims Awarded</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-8 overflow-y-auto">

            {/* Section 1: Approved Claims For Payments */}
            <section className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary">Approved Claims For Payments</h3>
              </div>

              {/* Search */}
              <form onSubmit={handleSearch} className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-gray-700">Display IRN</label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={searchIRN}
                      onChange={(e) => setSearchIRN(e.target.value)}
                      placeholder="e.g., IRN-123"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">First Name</label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={searchFirst}
                      onChange={(e) => setSearchFirst(e.target.value)}
                      placeholder="e.g., Maria"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Last Name</label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={searchLast}
                      onChange={(e) => setSearchLast(e.target.value)}
                      placeholder="e.g., Kila"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button type="submit" className="btn btn-primary flex items-center">
                    <Search className="h-4 w-4 mr-2" /> Search
                  </button>
                </div>
              </form>

              {error && (
                <div className="mb-3 p-3 bg-red-50 text-red-700 rounded">{error}</div>
              )}

              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-gray-600">No approved claims found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IRN</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Display IRN</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recipient (Details)</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Submission Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Incident</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount Paid</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank Account</th>
                        <th className="px-4 py-2 text-center">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = !allChecked && someChecked;
                              }}
                              onChange={toggleAll}
                            />
                            <span className="text-xs font-medium text-gray-700">Select All</span>
                          </label>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rows.map((r) => (
                        <tr key={String(r.BADMID)} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{r.IRN}</td>
                          <td className="px-4 py-2 text-sm">{r.DisplayIRN ?? ''}</td>
                          <td className="px-4 py-2 text-sm max-w-xs truncate" title={r.PaymentDetails}>{r.PaymentDetails ?? ''}</td>
                          <td className="px-4 py-2 text-sm">{r.SubmissionDate ?? ''}</td>
                          <td className="px-4 py-2 text-sm">{r.IncidentType ?? ''}</td>
                          <td className="px-4 py-2 text-sm">{r.WorkerFirstName ?? ''} {r.WorkerLastName ?? ''}</td>
                          <td className="px-4 py-2 text-sm">K{(Number(r.EbankAmountPaid ?? 0) || 0).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm">
                            <div className="text-xs font-medium">{r.BankName}</div>
                            <div className="text-xs text-textSecondary">{r.WorkerAccountNumber}</div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!checked[String(r.BADMID)]}
                              onChange={(e) => toggleOne(r.BADMID, e.target.checked)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-50"
                      onClick={confirmList}
                      disabled={!someChecked}
                    >
                      Confirm Payments List
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Section 2: Batch and Process Payments */}
            <section className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary">Batch and Process Payments</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded text-sm flex items-center gap-2"
                    onClick={() => printApprovedPaymentsListNoBatch(batchList)}
                    disabled={batchList.length === 0}
                    title="Print list (PDF)"
                  >
                    <Printer className="h-4 w-4" /> Print List (PDF)
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded text-sm flex items-center gap-2 text-red-700"
                    onClick={clearBatchList}
                    disabled={batchList.length === 0}
                    title="Clear current batch list"
                  >
                    <Trash2 className="h-4 w-4" /> Clear List
                  </button>
                </div>
              </div>

              {batchList.length === 0 ? (
                <div className="text-gray-600">No items selected. Use “Confirm Payments List” above to add items here.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IRN</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Display IRN</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Submission Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Incident</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount Paid</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank Account</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {batchList.map((r) => (
                          <tr key={`batch-${String(r.BADMID)}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm">{r.IRN}</td>
                            <td className="px-4 py-2 text-sm">{r.DisplayIRN ?? ''}</td>
                            <td className="px-4 py-2 text-sm max-w-xs truncate" title={r.PaymentDetails}>{r.PaymentDetails ?? ''}</td>
                            <td className="px-4 py-2 text-sm">{r.SubmissionDate ?? ''}</td>
                            <td className="px-4 py-2 text-sm">{r.IncidentType ?? ''}</td>
                            <td className="px-4 py-2 text-sm">{r.WorkerFirstName ?? ''} {r.WorkerLastName ?? ''}</td>
                            <td className="px-4 py-2 text-sm">K{(Number(r.EbankAmountPaid ?? 0) || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-sm">
                              <div className="text-xs font-medium">{r.BankName}</div>
                              <div className="text-xs text-textSecondary">{r.WorkerAccountNumber}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <div className="text-gray-700">
                      <span className="font-medium">Total Claims:</span> {totalSelectedCount} &nbsp; | &nbsp;
                      <span className="font-medium">Total Value:</span> K{totalSelectedValue.toLocaleString()}
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm"
                      onClick={openConfirm}
                    >
                      Process Payments
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal (custom, no browser defaults) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Confirm Batch & Process</h3>

              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Total Number of Claims for Payment:</span> {totalSelectedCount}</div>
                <div><span className="font-medium">Total Value of Claims for Payment:</span> K{totalSelectedValue.toLocaleString()}</div>
                <div><span className="font-medium">Generated Batch No:</span> {confirmBatchNo}</div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  className="px-3 py-1.5 border rounded text-sm flex items-center gap-2"
                  onClick={() =>
                    printClaimsPaidBatchWithBatchNo(batchList, confirmBatchNo)
                  }

                >
                  <Printer className="h-4 w-4" /> Print List of Claims Paid (PDF)
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-2"
                  onClick={handleDownloadABA}
                >
                  <Search className="h-4 w-4" /> Save as .ABA file
                </button>
              </div>

              {/* ABA Payer Details Editable Section */}
              <div className="mt-6 border-t pt-4">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  onClick={() => setAbaEditing(!abaEditing)}
                >
                  {abaEditing ? 'Hide' : 'Edit'} Payer Bank Details (ABA Export)
                </button>

                {abaEditing && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Company Name</label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm text-gray-700"
                        value={abaPayer.companyName}
                        onChange={(e) => setAbaPayer({ ...abaPayer, companyName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Company BSB</label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm text-gray-700"
                        value={abaPayer.bsb}
                        onChange={(e) => setAbaPayer({ ...abaPayer, bsb: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Company Account</label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm text-gray-700"
                        value={abaPayer.accountNumber}
                        onChange={(e) => setAbaPayer({ ...abaPayer, accountNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-bold mb-1">User ID</label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm text-gray-700"
                        value={abaPayer.userId}
                        onChange={(e) => setAbaPayer({ ...abaPayer, userId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Payment Type (Header)</label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm text-gray-700"
                        value={abaPayer.description}
                        onChange={(e) => setAbaPayer({ ...abaPayer, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Debit Description (SALARY)</label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm text-gray-700"
                        value={abaPayer.debitDescription}
                        onChange={(e) => setAbaPayer({ ...abaPayer, debitDescription: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                  onClick={() => setConfirmOpen(false)}
                  disabled={saving}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-50"
                  onClick={proceedProcess}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessPaymentsForClaimsAwardedPaymentSection;
