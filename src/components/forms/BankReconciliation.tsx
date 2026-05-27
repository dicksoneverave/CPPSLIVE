import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Plus, X, RefreshCw, CheckSquare, Square, Filter } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  printBankReconciliationRegister,
  printOutstandingUnreconciledPayments
} from '../../utils/BankReconciliationReport_jspdf';

type OwcBankRow = {
  OBANBankName: string;
  OBANBankAccountNumber: string;
  OBANAccountBalance: number | null;
};

type ReconRow = {
  BANKRECONID: number;
  OWCBankAccountNumber: string;
  Date: string;
  Description: string;
  Debit: number | null;
  Credit: number | null;
  Balance: number | null;
  Reconciled: boolean | null; // <-- this is the correct field
};

type PaidRow = {
  IRN: string | number;
  DisplayIRN?: string | null;
  SubmissionDate?: string | null;
  IncidentType?: string | null;
  WorkerFirstName?: string | null;
  WorkerLastName?: string | null;
  EbankAmountPaid?: number | null;
  BankName?: string | null;
  OWCAccountNumber?: string | null;
  PaymentManagerReviewStatus?: string | null;
  BatchNo?: string | number | null;
  Reconciled?: boolean | null;
};

const dd = (d: Date) => String(d.getDate()).padStart(2, '0');
const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, '0');
const yyyy = (d: Date) => d.getFullYear();
const dateOnly = (d = new Date()) => `${yyyy(d)}-${mm(d)}-${dd(d)}`;

const toNumber = (v: any) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const BankReconciliation: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(true);

  const [owcAccounts, setOwcAccounts] = useState<OwcBankRow[]>([]);
  const [selectedOwc, setSelectedOwc] = useState<string>(''); // "Bank|Acct"
  const selectedAcct = useMemo(() => {
    if (!selectedOwc) return null;
    const [bank, acct] = selectedOwc.split('|');
    return { bank, acct };
  }, [selectedOwc]);

  const [accountBalance, setAccountBalance] = useState<number>(0);

  // filters
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date(); d.setDate(1);
    return dateOnly(d);
  });
  const [toDate, setToDate] = useState<string>(dateOnly());

  // data
  const [loading, setLoading] = useState(false);
  const [rowSaving, setRowSaving] = useState<Record<number, boolean>>({}); // per-row saving spinner/disable
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reconRows, setReconRows] = useState<ReconRow[]>([]);
  const [unreconciledPaid, setUnreconciledPaid] = useState<PaidRow[]>([]);
  const [selectedPaid, setSelectedPaid] = useState<Record<string | number, boolean>>({}); // IRN -> checked

  // quick add form
  const [txDate, setTxDate] = useState<string>(dateOnly());
  const [txType, setTxType] = useState<'Bank Charges' | 'Interest' | 'Fund Deposit' | 'Manual'>('Bank Charges');
  const [txDesc, setTxDesc] = useState<string>('');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDirection, setTxDirection] = useState<'Debit' | 'Credit'>('Debit'); // only for Manual

  // --------- effects ---------
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('owcbankaccountmaster')
        .select('OBANBankName, OBANBankAccountNumber, OBANAccountBalance')
        .order('OBANBankName', { ascending: true });
      if (error) {
        console.error(error);
        setOwcAccounts([]);
        return;
      }
      setOwcAccounts((data as OwcBankRow[]) || []);
    })();
  }, []);

  // load account balance when account changes
  useEffect(() => {
    const row = owcAccounts.find(
      r => `${r.OBANBankName}|${r.OBANBankAccountNumber}` === selectedOwc
    );
    setAccountBalance(toNumber(row?.OBANAccountBalance));
    setSelectedPaid({});
  }, [selectedOwc, owcAccounts]);

  // load transactions + unpaid/reconciled list on account or date filter change
  useEffect(() => {
    if (!selectedAcct) return;
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAcct?.acct, fromDate, toDate]);

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      // 1) recon transactions
      const { data: tx, error: txErr } = await supabase
        .from('BankReconciliation')
        .select('BANKRECONID, OWCBankAccountNumber, Date, Description, Debit, Credit, Balance, Reconciled') // explicit
        .eq('OWCBankAccountNumber', selectedAcct!.acct)
        .gte('Date', fromDate)
        .lte('Date', toDate)
        .order('Date', { ascending: true })
        .order('BANKRECONID', { ascending: true });
      if (txErr) throw txErr;
      setReconRows((tx as ReconRow[]) || []);

      // 2) unreconciled paid claims for this account
      const { data: paid, error: pErr } = await supabase
        .from('bankaccountdepositmaster')
        .select('*')
        .eq('PaymentManagerReviewStatus', 'PaymentProcessed')
        .eq('Reconciled', false)
        .eq('OWCAccountNumber', selectedAcct!.acct)
        .order('EbankIssuedDate', { ascending: true });
      if (pErr) throw pErr;
      setUnreconciledPaid((paid as any as PaidRow[]) || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load reconciliation data.');
    } finally {
      setLoading(false);
    }
  };

  // --------- helpers ---------
  const formattedAccount = selectedAcct ? `${selectedAcct.bank} — ${selectedAcct.acct}` : '-';

  const addNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  // determine debit/credit for quick types
  const classifyQuickType = (type: typeof txType): 'Debit' | 'Credit' => {
    if (type === 'Bank Charges') return 'Debit';
    if (type === 'Interest') return 'Credit';
    if (type === 'Fund Deposit') return 'Credit';
    return txDirection; // Manual
  };

  // compute next balance (based on current master balance shown)
  const computeNewBalance = (dir: 'Debit' | 'Credit', amt: number) => {
    return dir === 'Debit' ? accountBalance - amt : accountBalance + amt;
  };

  // --------- actions ---------
  const handleAddTransaction = async () => {
    if (!selectedAcct) return;
    const amt = Math.abs(toNumber(txAmount));
    if (!amt) return;

    const direction: 'Debit' | 'Credit' = classifyQuickType(txType);
    const description =
      txDesc?.trim() ||
      (txType === 'Manual' ? `Manual ${direction}` : txType);

    const newBalance = computeNewBalance(direction, amt);

    setLoading(true);
    setError(null);
    try {
      // Insert into BankReconciliation
      const insertRow = {
        OWCBankAccountNumber: selectedAcct.acct,
        Date: txDate || dateOnly(),
        Description: description,
        Debit: direction === 'Debit' ? amt : 0,
        Credit: direction === 'Credit' ? amt : 0,
        Balance: newBalance,
        Reconciled: true, // internal bank-origin entries are already reconciled
      };

      const { error: insErr } = await supabase
        .from('BankReconciliation')
        .insert([insertRow]);
      if (insErr) throw insErr;

      // Update master account balance
      const { error: upErr } = await supabase
        .from('owcbankaccountmaster')
        .update({ OBANAccountBalance: newBalance })
        .eq('OBANBankAccountNumber', selectedAcct.acct);
      if (upErr) throw upErr;

      // reflect locally
      setAccountBalance(newBalance);
      addNotice('Transaction added.');
      setTxAmount(0);
      setTxDesc('');
      void refreshAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to add transaction.');
    } finally {
      setLoading(false);
    }
  };

  const allPaidChecked = useMemo(() => {
    if (!unreconciledPaid.length) return false;
    return unreconciledPaid.every(r => selectedPaid[r.IRN]);
  }, [unreconciledPaid, selectedPaid]);

  const toggleAllPaid = () => {
    if (!unreconciledPaid.length) return;
    const next: Record<string | number, boolean> = {};
    if (!allPaidChecked) {
      for (const r of unreconciledPaid) next[r.IRN] = true;
    }
    setSelectedPaid(next);
  };

  const totalSelectedPaid = useMemo(() => {
    let n = 0, sum = 0;
    for (const r of unreconciledPaid) {
      if (selectedPaid[r.IRN]) {
        n++;
        sum += toNumber(r.EbankAmountPaid);
      }
    }
    return { n, sum };
  }, [selectedPaid, unreconciledPaid]);

 // Toggle "Reconciled" on a single BankReconciliation row (checkbox in the register)
// Also adjust the master Bank Balance (owcbankaccountmaster) accordingly.
const toggleReconReconciled = async (row: ReconRow, nextVal: boolean) => {
  if (!selectedAcct) return;

  const prevVal = !!row.Reconciled;
  if (prevVal === nextVal) return; // nothing to do

  // Effect on balance: Credit adds to balance, Debit subtracts from balance.
  const debit = toNumber(row.Debit);
  const credit = toNumber(row.Credit);
  const effect = credit - debit; // positive => increase balance, negative => decrease balance

  // If checking => apply effect; if unchecking => reverse effect
  const delta = nextVal ? effect : -effect;
  const newMasterBal = accountBalance + delta;

  // UI: mark row as saving + optimistic reconciled + optimistic master balance
  setRowSaving(s => ({ ...s, [row.BANKRECONID]: true }));
  setReconRows(prev =>
    prev.map(r => (r.BANKRECONID === row.BANKRECONID ? { ...r, Reconciled: nextVal, Balance: (r.Balance ?? accountBalance) + delta } : r))
  );
  const prevMasterBal = accountBalance;
  setAccountBalance(newMasterBal);

  try {
    // 1) Update row reconciled flag
    const { error: upRowErr } = await supabase
      .from('BankReconciliation')
      .update({ Reconciled: nextVal })
      .eq('BANKRECONID', row.BANKRECONID);
    if (upRowErr) throw upRowErr;

    // 2) Update master bank balance
    const { error: upBalErr } = await supabase
      .from('owcbankaccountmaster')
      .update({ OBANAccountBalance: newMasterBal })
      .eq('OBANBankAccountNumber', selectedAcct.acct);
    if (upBalErr) throw upBalErr;

    // (optional) You can refreshAll() if you want fully authoritative numbers:
    // await refreshAll();
  } catch (e) {
    console.error(e);
    setError('Failed to update reconciled status or bank balance.');

    // Roll back UI
    setReconRows(prev =>
      prev.map(r =>
        r.BANKRECONID === row.BANKRECONID
          ? { ...r, Reconciled: prevVal, Balance: (r.Balance ?? prevMasterBal) - delta }
          : r
      )
    );
    setAccountBalance(prevMasterBal);
  } finally {
    setRowSaving(s => ({ ...s, [row.BANKRECONID]: false }));
  }
};


  // Reconcile selected "PaymentProcessed" withdrawals (creates entries + marks bankaccountdepositmaster.Reconciled)
  const handleReconcileSelected = async () => {
    if (!selectedAcct) return;
    const chosen = unreconciledPaid.filter(r => selectedPaid[r.IRN]);
    if (!chosen.length) return;

    setLoading(true);
    setError(null);
    try {
      let runningBalance = accountBalance;

      // 1) build inserts & apply sequentially (to keep running balance correct)
      for (const r of chosen) {
        const amt = Math.abs(toNumber(r.EbankAmountPaid));
        const newBal = runningBalance - amt;

        const desc = `Withdrawal for IRN ${r.IRN} (${r.DisplayIRN ?? ''}) — Batch ${r.BatchNo ?? ''}`.trim();

        const { error: insErr } = await supabase
          .from('BankReconciliation')
          .insert([{
            OWCBankAccountNumber: selectedAcct.acct,
            Date: dateOnly(), // withdrawal date (today) — adjust if you track actual bank date
            Description: desc,
            Debit: amt,
            Credit: 0,
            Balance: newBal,
            Reconciled: true, // confirmed withdrawal
          }]);
        if (insErr) throw insErr;

        // update running balance in master
        const { error: upErr } = await supabase
          .from('owcbankaccountmaster')
          .update({ OBANAccountBalance: newBal })
          .eq('OBANBankAccountNumber', selectedAcct.acct);
        if (upErr) throw upErr;

        runningBalance = newBal;

        // 2) mark bankaccountdepositmaster reconciled
        const { error: upPaid } = await supabase
          .from('bankaccountdepositmaster')
          .update({ Reconciled: true })
          .eq('IRN', r.IRN);
        if (upPaid) throw upPaid;
      }

      // reflect locally
      setAccountBalance(runningBalance);
      addNotice('Selected payments reconciled.');
      setSelectedPaid({});
      void refreshAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to reconcile selected payments.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintRegister = () => {
    printBankReconciliationRegister({
      account: formattedAccount,
      fromDate,
      toDate,
      openingBalance: accountBalance,
      rows: reconRows,
    });
  };

  const handlePrintOutstanding = () => {
    printOutstandingUnreconciledPayments({
      account: formattedAccount,
      rows: unreconciledPaid,
    });
  };

  const handleClose = () => {
    if (onClose) onClose();
    else setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4" onClick={handleClose}>
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Bank Reconciliation</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
              title="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Notices */}
          {notice && (
            <div className="mx-6 mt-4 p-2 rounded bg-green-50 text-green-700 text-sm">
              {notice}
            </div>
          )}
          {error && (
            <div className="mx-6 mt-4 p-2 rounded bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Body */}
          <div className="p-6 space-y-8 overflow-y-auto">
            {/* Account & Filters */}
            <section className="border rounded-lg p-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OWC Account</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={selectedOwc}
                    onChange={(e) => setSelectedOwc(e.target.value)}
                  >
                    <option value="">-- Select OWC Account --</option>
                    {owcAccounts.map((o, idx) => (
                      <option
                        key={`${o.OBANBankName}-${o.OBANBankAccountNumber}-${idx}`}
                        value={`${o.OBANBankName}|${o.OBANBankAccountNumber}`}
                      >
                        {o.OBANBankName} — {o.OBANBankAccountNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      disabled={!selectedAcct}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    disabled={!selectedAcct}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-medium">Bank Balance:</span>{' '}
                  {selectedAcct ? `K ${accountBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 border rounded text-sm inline-flex items-center gap-2"
                  onClick={refreshAll}
                  disabled={!selectedAcct || loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded text-sm inline-flex items-center gap-2"
                    onClick={handlePrintRegister}
                    disabled={!selectedAcct || loading}
                  >
                    <Printer className="h-4 w-4" /> Print Register (PDF)
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded text-sm inline-flex items-center gap-2"
                    onClick={handlePrintOutstanding}
                    disabled={!selectedAcct || loading}
                  >
                    <Printer className="h-4 w-4" /> Print Outstanding (PDF)
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Add Transaction */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 text-primary">Add Transaction</h3>
              <div className="grid md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    disabled={!selectedAcct}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as any)}
                    disabled={!selectedAcct}
                  >
                    <option>Bank Charges</option>
                    <option>Interest</option>
                    <option>Fund Deposit</option>
                    <option>Manual</option>
                  </select>
                </div>

                {txType === 'Manual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={txDirection}
                      onChange={(e) => setTxDirection(e.target.value as any)}
                      disabled={!selectedAcct}
                    >
                      <option>Debit</option>
                      <option>Credit</option>
                    </select>
                  </div>
                )}

                <div className={`${txType === 'Manual' ? '' : 'md:col-span-2'}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder={txType === 'Manual' ? 'Enter description' : `${txType}`}
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                    disabled={!selectedAcct}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={txAmount}
                    onChange={(e) => setTxAmount(toNumber(e.target.value))}
                    disabled={!selectedAcct}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm inline-flex items-center gap-2"
                  onClick={handleAddTransaction}
                  disabled={!selectedAcct || loading || !txAmount}
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            </section>

            {/* Recon Register */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 text-primary">Bank Reconciliation Register</h3>

              {!selectedAcct ? (
                <div className="text-sm text-gray-500">Select an OWC account to view transactions.</div>
              ) : loading ? (
                <div className="flex items-center justify-center h-24">
                  <div className="animate-spin h-8 w-8 rounded-full border-t-2 border-b-2 border-primary" />
                </div>
              ) : reconRows.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reconciled</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {reconRows.map(r => (
                        <tr key={r.BANKRECONID}>
                          <td className="px-3 py-2">{r.Date?.slice(0,10)}</td>
                          <td className="px-3 py-2">{r.Description}</td>
                          <td className="px-3 py-2 text-right">{toNumber(r.Debit).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right">{toNumber(r.Credit).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-medium">{toNumber(r.Balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!r.Reconciled}
                              disabled={!!rowSaving[r.BANKRECONID]}
                              onChange={(e) => toggleReconReconciled(r, e.target.checked)}
                              aria-label="Toggle reconciled"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No transactions within the selected date range.</div>
              )}
            </section>

            {/* Outstanding paid (unreconciled) */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 text-primary">Outstanding Paid Claims (Unreconciled)</h3>

              {!selectedAcct ? (
                <div className="text-sm text-gray-500">Select an OWC account to view outstanding items.</div>
              ) : unreconciledPaid.length ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm">
                      <span className="font-medium">Selected:</span> {totalSelectedPaid.n} &nbsp;|&nbsp;
                      <span className="font-medium">Total:</span> K {totalSelectedPaid.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 border rounded text-sm inline-flex items-center gap-2"
                        onClick={toggleAllPaid}
                      >
                        {allPaidChecked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        {allPaidChecked ? 'Unselect All' : 'Select All'}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded text-sm"
                        onClick={handleReconcileSelected}
                        disabled={!totalSelectedPaid.n || loading}
                      >
                        Reconcile Selected
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2"></th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">IRN</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Display IRN</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Incident</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 text-sm">
                        {unreconciledPaid.map(r => (
                          <tr key={String(r.IRN)}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!!selectedPaid[r.IRN]}
                                onChange={(e) =>
                                  setSelectedPaid(sp => ({ ...sp, [r.IRN]: e.target.checked }))
                                }
                              />
                            </td>
                            <td className="px-3 py-2">{String(r.IRN)}</td>
                            <td className="px-3 py-2">{r.DisplayIRN ?? '-'}</td>
                            <td className="px-3 py-2">
                              {(r.WorkerFirstName ?? '').trim()} {(r.WorkerLastName ?? '').trim()}
                            </td>
                            <td className="px-3 py-2">{r.IncidentType ?? '-'}</td>
                            <td className="px-3 py-2">{r.BankName ?? '-'}</td>
                            <td className="px-3 py-2 text-right">
                              {toNumber(r.EbankAmountPaid).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">No outstanding unreconciled paid claims for this account.</div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankReconciliation;
