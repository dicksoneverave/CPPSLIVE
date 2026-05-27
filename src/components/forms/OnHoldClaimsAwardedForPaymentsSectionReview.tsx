import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import Form124View from './Form124View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import { downloadConsentOfAwardInjury } from '../../utils/ConsentOfAward-Injury';

const CREST =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';
const REG_SIGN =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/registrarsign.png';
const REG_STAMP =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/Registrar.png';

interface Props {
  IRN?: string;
  irn?: string;
  TBCRRID?: string;
  formType?: 'Injury' | 'Death';
  onCloseAll?: () => void;
  onClose?: () => void;
}

type EmployerRow = {
  OrganizationName: string;
  InsuranceProviderIPACode: string | null;
};

type InsuranceRow = {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
};

type OwcBankRow = {
  OBANBankName: string;
  OBANBankAccountNumber: string;
};

const BANK_OPTIONS = [
  'BSP',
  'Kina',
  'Westpac',
  'Credit Bank',
  'NBC',
  'TISA',
  'Womens Microbank',
  'NDB',
] as const;

const OnHoldClaimsAwardedForPaymentsSectionReview: React.FC<Props> = ({
  IRN,
  irn,
  formType = 'Injury',
  onCloseAll,
  onClose,
}) => {
  const { profile } = useAuth();
  const resolvedIRN = useMemo(() => (IRN ?? irn ?? '').toString(), [IRN, irn]);
  const [open, setOpen] = useState(true);

  // who am I?
  const [myStaffId, setMyStaffId] = useState<number | null>(null);
  const isInjury = formType === 'Injury';

  // ---------- Payment Received section state ----------
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);

  const [insuranceList, setInsuranceList] = useState<InsuranceRow[]>([]);
  const [insuranceProviderName, setInsuranceProviderName] = useState(''); // Drawer/Insurance
  const [insuranceOverrideOpen, setInsuranceOverrideOpen] = useState(false);
  const [insuranceManuallyOverridden, setInsuranceManuallyOverridden] = useState(false);

  const [bankName, setBankName] = useState<string>('');
  const [drawerAccountNo, setDrawerAccountNo] = useState('');
  const [paymentTypeMethod, setPaymentTypeMethod] = useState('');
  const [reference, setReference] = useState('');

  const [owcAccounts, setOwcAccounts] = useState<OwcBankRow[]>([]);
  const [selectedOwcAccount, setSelectedOwcAccount] = useState<string>(''); // "Bank|Account"
  const [owcAccountFromRecord, setOwcAccountFromRecord] = useState<string>(''); // preserves saved acct if not in dropdown

  const [awardedAmount, setAwardedAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [finalPaymentAmount, setFinalPaymentAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paidDate, setPaidDate] = useState<string>('');
  const [paymentDetails, setPaymentDetails] = useState('');

  // NEW — Worker bank details
  const [workerBankName, setWorkerBankName] = useState<string>('');
  const [workerBSBBranchNo, setWorkerBSBBranchNo] = useState<string>(''); // <- exact field name per your note
  const [workerAccountNumber, setWorkerAccountNumber] = useState<string>('');

  // From record (display-only)
  const [paymentManagerReviewStatus, setPaymentManagerReviewStatus] = useState<string>('');
  const [batchNo, setBatchNo] = useState<string | number>('');

  // Confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data tracking
  const [loadedFromDeposit, setLoadedFromDeposit] = useState(false);

  // ---------- Effects ----------
  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID')
        .eq('cppsid', profile.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      const sid = data?.OSMStaffID ? Number(data.OSMStaffID) : null;
      setMyStaffId(sid);
    })();
  }, [profile?.id]);

  // Load insurance companies (for override picker)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('insurancecompanymaster')
        .select('*')
        .order('InsuranceCompanyOrganizationName', { ascending: true });
      if (error) {
        console.error('insurancecompanymaster load error:', error);
        setInsuranceList([]);
        return;
      }
      setInsuranceList(Array.isArray(data) ? (data as InsuranceRow[]) : []);
    })();
  }, []);

  // Load OWC accounts
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('owcbankaccountmaster')
        .select('OBANBankName, OBANBankAccountNumber')
        .order('OBANBankName', { ascending: true });
      if (error) {
        console.error('owcbankaccountmaster load error:', error);
        setOwcAccounts([]);
        return;
      }
      setOwcAccounts((data as OwcBankRow[]) || []);
    })();
  }, []);

  // Auto-calc Awarded Amount by IRN (only if not loaded from deposit)
  useEffect(() => {
    (async () => {
      if (loadedFromDeposit) return;
      if (!resolvedIRN) {
        setAwardedAmount(0);
        return;
      }
      const { data, error } = await supabase
        .from('claimcompensationworkerdetails')
        .select('CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions')
        .eq('IRN', /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN);
      if (error) {
        console.error('award amount load error:', error);
        setAwardedAmount(0);
        return;
      }
      const total = (data || []).reduce((sum, row: any) => {
        const comp = Number(row.CCWDCompensationAmount || 0);
        const med = Number(row.CCWDMedicalExpenses || 0);
        const misc = Number(row.CCWDMiscExpenses || 0);
        const ded = Number(row.CCWDDeductions || 0);
        return sum + (comp + med + misc - ded);
      }, 0);
      setAwardedAmount(Number.isFinite(total) ? total : 0);
    })();
  }, [resolvedIRN, loadedFromDeposit]);

  // When IRN changes → reset manual override
  useEffect(() => {
    setInsuranceManuallyOverridden(false);
    setInsuranceOverrideOpen(false);
  }, [resolvedIRN]);

  // Resolve Employer automatically & (optionally) auto-fill insurance provider
  useEffect(() => {
    (async () => {
      try {
        if (!resolvedIRN) {
          setSelectedEmployer(null);
          if (!insuranceManuallyOverridden) setInsuranceProviderName('');
          return;
        }

        const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

        // 1) workerirn: get WorkerID by IRN
        const { data: workerRow, error: wErr } = await supabase
          .from('workerirn')
          .select('WorkerID')
          .eq('IRN', irnValue)
          .maybeSingle();
        if (wErr) throw wErr;
        const workerId = workerRow?.WorkerID;
        if (!workerId) {
          setSelectedEmployer(null);
          if (!insuranceManuallyOverridden) setInsuranceProviderName('');
          return;
        }

        // 2) currentemploymentdetails: EmployerCPPSID by WorkerID
        const { data: empDet, error: cedErr } = await supabase
          .from('currentemploymentdetails')
          .select('EmployerCPPSID')
          .eq('WorkerID', workerId)
          .maybeSingle();
        if (cedErr) throw cedErr;
        const employerCppsid = empDet?.EmployerCPPSID;
        if (!employerCppsid) {
          setSelectedEmployer(null);
          if (!insuranceManuallyOverridden) setInsuranceProviderName('');
          return;
        }

        // 3) employermaster
        const { data: emp, error: emErr } = await supabase
          .from('employermaster')
          .select('OrganizationName, InsuranceProviderIPACode')
          .eq('CPPSID', employerCppsid)
          .maybeSingle();
        if (emErr) throw emErr;

        const employer: EmployerRow | null = emp
          ? {
              OrganizationName: emp.OrganizationName,
              InsuranceProviderIPACode: emp.InsuranceProviderIPACode ?? null,
            }
          : null;

        setSelectedEmployer(employer ?? null);

        // 4) If we have IPACODE, auto lookup insurance name (only if NOT manually overridden)
        if (employer?.InsuranceProviderIPACode && !insuranceManuallyOverridden) {
          const { data: ins, error: insErr } = await supabase
            .from('insurancecompanymaster')
            .select('InsuranceCompanyOrganizationName')
            .eq('IPACODE', employer.InsuranceProviderIPACode)
            .maybeSingle();
          if (insErr) throw insErr;
          setInsuranceProviderName(ins?.InsuranceCompanyOrganizationName ?? '');
        } else if (!insuranceManuallyOverridden) {
          setInsuranceProviderName('');
        }
      } catch (e) {
        console.error('Auto employer resolve failed:', e);
        setSelectedEmployer(null);
        if (!insuranceManuallyOverridden) setInsuranceProviderName('');
      }
    })();
  }, [resolvedIRN, insuranceManuallyOverridden]);

  // Keep Final Payment Amount = Awarded + Interest (unless deposit provided value)
  useEffect(() => {
    if (loadedFromDeposit) return;
    const total = Number(awardedAmount || 0) + Number(interestAmount || 0);
    setFinalPaymentAmount(Number.isFinite(total) ? Number(total.toFixed(2)) : 0);
  }, [awardedAmount, interestAmount, loadedFromDeposit]);

  // ---------- Load deposit row to prefill (INCLUDES Worker Bank Details) ----------
  useEffect(() => {
    (async () => {
      setLoadedFromDeposit(false);
      setOwcAccountFromRecord('');
      setPaymentManagerReviewStatus('');
      setBatchNo('');
      if (!resolvedIRN) return;

      const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

      const { data, error } = await supabase
        .from('bankaccountdepositmaster')
        .select(
          [
            'Employer',
            'Drawer',
            'BankName',
            'DrawerAccountNumber',
            'PaymentTypeMethod',
            'EbankReferenceNo',
            'OWCAccountNumber',
            'AwardedAmount',
            'InterestAmount',
            'FinalPaymentAmount',
            'EbankAmountPaid',
            'EbankIssuedDate',
            'PaymentDetails',
            'PaymentManagerReviewStatus',
            'BatchNo',
            // NEW worker bank fields:
            'WorkerBankName',
            'WorkerAccountNumber',
            'WorkerBSBBranchNo',
          ].join(', ')
        )
        .eq('IRN', irnValue)
        .maybeSingle();

      if (error) {
        console.error('bankaccountdepositmaster load error:', error);
        return;
      }
      if (!data) return;

      // Prefill editable fields
      setInsuranceManuallyOverridden(true);
      setInsuranceProviderName(data.Drawer ?? '');
      setBankName(data.BankName ?? '');
      setDrawerAccountNo(data.DrawerAccountNumber ?? '');
      setPaymentTypeMethod(data.PaymentTypeMethod ?? '');
      setReference(data.EbankReferenceNo ?? '');

      const savedAcct = data.OWCAccountNumber ?? '';
      setOwcAccountFromRecord(savedAcct);

      setAwardedAmount(Number(data.AwardedAmount ?? 0));
      setInterestAmount(Number((data as any).IntrestAmount ?? data.InterestAmount ?? 0));
      setFinalPaymentAmount(Number(data.FinalPaymentAmount ?? 0));
      setAmountPaid(Number(data.EbankAmountPaid ?? 0));
      const issued = data.EbankIssuedDate ? String(data.EbankIssuedDate) : '';
      setPaidDate(issued ? issued.slice(0, 10) : '');
      setPaymentDetails(data.PaymentDetails ?? '');

      // Read-only display fields from record
      setPaymentManagerReviewStatus(data.PaymentManagerReviewStatus ?? '');
      setBatchNo(data.BatchNo ?? '');

      // employer display (read-only)
      setSelectedEmployer(
        data.Employer
          ? { OrganizationName: data.Employer, InsuranceProviderIPACode: null }
          : selectedEmployer
      );

      // NEW prefill worker bank details
      setWorkerBankName(data.WorkerBankName ?? '');
      setWorkerAccountNumber(String(data.WorkerAccountNumber ?? ''));
      setWorkerBSBBranchNo(String(data.WorkerBSBBranchNo ?? ''));

      setLoadedFromDeposit(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedIRN]);

  // Try to preselect OWC dropdown once we have both: bank list and the saved account number
  useEffect(() => {
    if (!owcAccountFromRecord || selectedOwcAccount) return;
    const match = owcAccounts.find(a => a.OBANBankAccountNumber === owcAccountFromRecord);
    if (match) {
      setSelectedOwcAccount(`${match.OBANBankName}|${match.OBANBankAccountNumber}`);
    }
  }, [owcAccounts, owcAccountFromRecord, selectedOwcAccount]);

  // ---------- Close handlers ----------
  const handleClose = () => {
    if (onCloseAll) return onCloseAll();
    if (onClose) return onClose();
    setOpen(false);
  };

  // ---------- Document actions (preview-only) ----------
  const handleDownloadConsent = async () => {
    if (!resolvedIRN) return;
    if (isInjury) {
      await downloadConsentOfAwardInjury(resolvedIRN, {
        crestUrl: CREST,
        includeSignature: false,
      });
    } else {
      const mod = await import('../../utils/ConsentOfAward-Death');
      const fn = (mod as any).downloadConsentOfAwardDeath || (mod as any).default;
      if (!fn) return;
      await fn(resolvedIRN, { crestUrl: CREST, includeSignature: false });
    }
  };

  const handlePrintCertificateOfAward = async () => {
    if (!resolvedIRN) return;
    try {
      const mod = await import('../../utils/CertificateOfAward_jspdf');
      const fn =
        (mod as any).generateCertificateOfAward ||
        (mod as any).generateCertificateOfAwardPDF ||
        (mod as any).default;
      if (fn) await fn(resolvedIRN);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintCertificateOfClaimAward = async () => {
    if (!resolvedIRN) return;
    try {
      let staffId = myStaffId;
      if (staffId == null && profile?.id) {
        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('OSMStaffID')
          .eq('cppsid', profile.id)
          .maybeSingle();
        if (error) throw error;
        staffId = data?.OSMStaffID ? Number(data.OSMStaffID) : null;
        setMyStaffId(staffId ?? null);
      }
      if (staffId == null) return;
      const mod = await import('../../utils/CertificateOfClaimAward_jspdf');
      const fn =
        (mod as any).generateCertificateOfClaimAward ||
        (mod as any).generateCertificateOfClaimAwardPDF ||
        (mod as any).default;
      if (fn) await fn(resolvedIRN, staffId, { showStamps: false });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintPaymentChecklist = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/ChecklistForPayment_jspdf');
    const fn =
      (mod as any).printChecklistForPayment ||
      (mod as any).generateChecklistForPayment ||
      (mod as any).default;
    if (fn) await fn(resolvedIRN);
  };

  const handlePrintBankConfirmation = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/BankConfirmationLetter_jspdf');
    const fn =
      (mod as any).printBankConfirmationLetter ||
      (mod as any).generateBankConfirmationLetter ||
      (mod as any).default;
    if (fn) await fn(resolvedIRN);
  };

  // ---------- Helpers ----------
  const dateOnly = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const selectedOwcObj = useMemo(() => {
    if (!selectedOwcAccount) return null;
    const [bank, acct] = selectedOwcAccount.split('|');
    return { bank, acct };
  }, [selectedOwcAccount]);

  // ---------- Submit (confirm) ----------
  const openConfirm = () => {
    if (!resolvedIRN) return;
    setConfirmOpen(true);
  };

  // Save using upsert (updates same record if exists; creates if missing)
  const handleProceedSave = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    if (!resolvedIRN) return;

    setSaving(true);
    try {
      const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

      const payload: any = {
        IRN: irnValue,
        Employer: selectedEmployer?.OrganizationName ?? null,
        Drawer: insuranceProviderName || null,
        BankName: bankName || null,
        DrawerAccountNumber: drawerAccountNo || null,
        PaymentTypeMethod: paymentTypeMethod || null,
        EbankReferenceNo: reference || null,
        OWCAccountNumber: selectedOwcObj?.acct || owcAccountFromRecord || null,
        AwardedAmount: awardedAmount ?? 0,
        InterestAmount: interestAmount ?? 0,
        FinalPaymentAmount: finalPaymentAmount ?? 0,
        EbankAmountPaid: amountPaid ?? 0,
        EbankIssuedDate: paidDate || null,
        PaymentDetails: paymentDetails || null,
        // NEW — persist worker bank fields
        WorkerBankName: workerBankName || null,
        WorkerAccountNumber: workerAccountNumber || null,
        WorkerBSBBranchNo: workerBSBBranchNo || null,
      };

      // 1) Does a record already exist for this IRN?
      const { data: existing, error: existErr } = await supabase
        .from('bankaccountdepositmaster')
        .select('IRN')
        .eq('IRN', irnValue)
        .maybeSingle();
      if (existErr) throw existErr;

      // 2) Update if exists, else insert
      if (existing) {
        const { error: updErr } = await supabase
          .from('bankaccountdepositmaster')
          .update(payload)
          .eq('IRN', irnValue);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('bankaccountdepositmaster')
          .insert([payload]);
        if (insErr) throw insErr;
      }

      setConfirmOpen(false);
      handleClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return !open ? null : (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Payments Officer Review (OnHold) — {formType}
              </h2>
              {resolvedIRN && <span className="text-sm text-gray-600">IRN: {resolvedIRN}</span>}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-8 overflow-y-auto">
            {/* Section 1: Embedded Form (inline) */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                {formType === 'Death'
                  ? 'Form 124 — Death Claim Detail'
                  : 'Form 113 — Injury Claim Detail'}
              </h3>

              {resolvedIRN ? (
                formType === 'Death' ? (
                  <Form124View irn={resolvedIRN} variant="embedded" className="w-full" />
                ) : (
                  <Form113View irn={resolvedIRN} variant="embedded" className="w-full" />
                )
              ) : (
                <p className="text-gray-500">Claim details cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Section 2: Claim Decisions (read-only list stays) */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
              {resolvedIRN ? (
                <ListClaimDecisions irn={resolvedIRN} />
              ) : (
                <p className="text-gray-500">Claim decisions cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Section 3: Compensation Breakup */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
              {resolvedIRN ? (
                <CompensationBreakupDetailsView IRN={resolvedIRN} IncidentType={formType} />
              ) : (
                <p className="text-gray-500">Compensation data cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* ---------------- Details of Payment Received ---------------- */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Details of Payment Received</h3>

              {/* Employer (auto-selected, read-only) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50"
                  value={selectedEmployer?.OrganizationName || ''}
                  placeholder="Employer will be auto-resolved from IRN"
                  disabled
                />
                {!selectedEmployer && (
                  <p className="text-xs text-red-600 mt-1">
                    Employer could not be resolved from the selected IRN.
                  </p>
                )}
              </div>

              {/* Insurance Provider (auto from employer, with sticky override) */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Provider
                  </label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      const next = !insuranceOverrideOpen;
                      setInsuranceOverrideOpen(next);
                    }}
                  >
                    {insuranceOverrideOpen ? 'Cancel Override' : 'Select Insurance Provider'}
                  </button>
                </div>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={insuranceProviderName ?? ''}
                  onChange={(e) => {
                    setInsuranceProviderName(e.target.value);
                    if (insuranceOverrideOpen) setInsuranceManuallyOverridden(true);
                  }}
                  disabled={!insuranceOverrideOpen}
                  placeholder="Insurance provider will appear here"
                />
                {insuranceOverrideOpen && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                    {insuranceList.length > 0 ? (
                      insuranceList.slice(0, 100).map((i: any) => (
                        <button
                          key={String(i.IPACODE ?? i.ipacode ?? i.id ?? Math.random())}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            const name =
                              i.InsuranceCompanyOrganizationName ??
                              i.insurancecompanyorganizationName ??
                              '';
                            setInsuranceProviderName(name);
                            setInsuranceManuallyOverridden(true);
                            setInsuranceOverrideOpen(false);
                          }}
                        >
                          {i.InsuranceCompanyOrganizationName ??
                            i.insurancecompanyorganizationName ??
                            '(no name)'}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No insurance providers found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bank + Drawer account */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Bank Name</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drawer Account No</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={drawerAccountNo}
                    onChange={(e) => setDrawerAccountNo(e.target.value)}
                    placeholder="e.g., 1234567890"
                  />
                </div>
              </div>

              {/* Payment method, reference */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type/Method</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paymentTypeMethod}
                    onChange={(e) => setPaymentTypeMethod(e.target.value)}
                    placeholder="e.g., EFT, Cheque, Cash"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g., Ebank Ref No"
                  />
                </div>
              </div>

              {/* OWC Account */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">OWC Account No</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={selectedOwcAccount}
                  onChange={(e) => setSelectedOwcAccount(e.target.value)}
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
                {!selectedOwcAccount && owcAccountFromRecord && (
                  <p className="text-xs text-gray-500 mt-1">
                    Saved account: {owcAccountFromRecord} (not in list)
                  </p>
                )}
              </div>

              {/* Amounts */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Awarded Amount</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={awardedAmount}
                    onChange={(e) => setAwardedAmount(Number(e.target.value || 0))}
                  />
                  {!loadedFromDeposit && (
                    <p className="text-xs text-gray-500 mt-1">
                      Auto-summed from claimcompensationworkerdetails for this IRN; you can adjust if needed.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Amount</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(Number(e.target.value || 0))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Final Payment Amount (Interest)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={finalPaymentAmount}
                    onChange={(e) => setFinalPaymentAmount(Number(e.target.value || 0))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value || 0))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paid Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Details</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    placeholder="Additional info"
                  />
                </div>
              </div>

              {/* Divider */}
              <hr className="my-6" />

              {/* NEW: Worker Bank Details */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Worker Bank Details</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Worker Bank Name</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={workerBankName}
                      onChange={(e) => setWorkerBankName(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {BANK_OPTIONS.map((b) => (
                        <option key={`worker-${b}`} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Worker BSB / Branch</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={workerBSBBranchNo}
                      onChange={(e) => setWorkerBSBBranchNo(e.target.value)}
                      placeholder="e.g., 088-123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Worker Account Number</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={workerAccountNumber}
                      onChange={(e) => setWorkerAccountNumber(e.target.value)}
                      placeholder="e.g., 1234567890"
                    />
                  </div>
                </div>
              </div>

              {/* Read-only from record + Submit */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Payment Manager Review Status:</span>{' '}
                    {paymentManagerReviewStatus || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Batch No:</span>{' '}
                    {String(batchNo ?? '') || '-'}
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm"
                  onClick={openConfirm}
                >
                  Submit
                </button>
              </div>
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

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Confirm Payment Details</h3>

              <div className="space-y-2 text-sm">
                <div><span className="font-medium">IRN:</span> {resolvedIRN}</div>
                <div><span className="font-medium">Employer:</span> {selectedEmployer?.OrganizationName || '-'}</div>
                <div><span className="font-medium">Insurance Provider:</span> {insuranceProviderName || '-'}</div>
                <div><span className="font-medium">Bank:</span> {bankName || '-'}</div>
                <div><span className="font-medium">Drawer Account No:</span> {drawerAccountNo || '-'}</div>
                <div><span className="font-medium">Payment Type/Method:</span> {paymentTypeMethod || '-'}</div>
                <div><span className="font-medium">Reference:</span> {reference || '-'}</div>
                <div>
                  <span className="font-medium">OWC Account:</span>{' '}
                  {selectedOwcObj ? `${selectedOwcObj.bank} — ${selectedOwcObj.acct}` : (owcAccountFromRecord || '-')}
                </div>
                <div><span className="font-medium">Awarded Amount:</span> {awardedAmount.toLocaleString()}</div>
                <div><span className="font-medium">Interest Amount:</span> {Number(interestAmount || 0).toLocaleString()}</div>
                <div><span className="font-medium">Final Payment Amount:</span> {Number(finalPaymentAmount || 0).toLocaleString()}</div>
                <div><span className="font-medium">Amount Paid:</span> {Number(amountPaid || 0).toLocaleString()}</div>
                <div><span className="font-medium">Paid Date:</span> {paidDate || '-'}</div>
                <div><span className="font-medium">Payment Details:</span> {paymentDetails || '-'}</div>

                {/* Show Worker Bank Details in the confirmation summary */}
                <div><span className="font-medium">Worker Bank Name:</span> {workerBankName || '-'}</div>
                <div><span className="font-medium">Worker BSB/Branch:</span> {workerBSBBranchNo || '-'}</div>
                <div><span className="font-medium">Worker Account No:</span> {workerAccountNumber || '-'}</div>

                <div><span className="font-medium">Payment Manager Review Status:</span> {paymentManagerReviewStatus || '-'}</div>
                <div><span className="font-medium">Batch No:</span> {String(batchNo ?? '') || '-'}</div>
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
                  onClick={handleProceedSave}
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

export default OnHoldClaimsAwardedForPaymentsSectionReview;
