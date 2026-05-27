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
  InsuranceCompanyOrganizationName?: string;
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

const OnHoldClaimsAwardedForPaymentsManagerReview: React.FC<Props> = ({
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

  // ---------- Payment section state (prefilled from bankaccountdepositmaster) ----------
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);

  const [insuranceList, setInsuranceList] = useState<InsuranceRow[]>([]);
  const [insuranceProviderName, setInsuranceProviderName] = useState(''); // Drawer
  const [insuranceOverrideOpen, setInsuranceOverrideOpen] = useState(false);
  const [insuranceManuallyOverridden, setInsuranceManuallyOverridden] = useState(false);

  const [bankName, setBankName] = useState<string>('');
  const [drawerAccountNo, setDrawerAccountNo] = useState('');
  const [paymentTypeMethod, setPaymentTypeMethod] = useState('');
  const [reference, setReference] = useState('');

  // OWC Account is now a text field, not a select
  const [owcAccountNumber, setOwcAccountNumber] = useState<string>('');

  const [awardedAmount, setAwardedAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [finalPaymentAmount, setFinalPaymentAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paidDate, setPaidDate] = useState<string>('');
  const [paymentDetails, setPaymentDetails] = useState('');

  // NEW — Worker bank details (fetched + shown)
  const [workerBankName, setWorkerBankName] = useState<string>('');
  const [workerBSBBranchNo, setWorkerBSBBranchNo] = useState<string>(''); // NOTE: BSB (not BSP)
  const [workerAccountNumber, setWorkerAccountNumber] = useState<string>('');

  // display-only from saved record
  const [paymentManagerReviewStatus, setPaymentManagerReviewStatus] = useState<string>('');
  const [batchNo, setBatchNo] = useState<string | number>('');
  const [splitRecords, setSplitRecords] = useState<any[]>([]);

  const [loadedFromDeposit, setLoadedFromDeposit] = useState(false);

  // ---------- Decision Section state ----------
  type Decision = 'Approved' | 'OnHold' | 'Rejected';
  const [decision, setDecision] = useState<Decision>('Approved');
  const [decisionReason, setDecisionReason] = useState('');
  const [confirmDecisionOpen, setConfirmDecisionOpen] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // who am I
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

  // Insurance company list (for optional override)
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
      setInsuranceList(Array.isArray(data) ? data : []);
    })();
  }, []);

  // Try to load the saved deposit row for this IRN and prefill the form
  useEffect(() => {
    (async () => {
      setLoadedFromDeposit(false);
      setPaymentManagerReviewStatus('');
      setBatchNo('');
      if (!resolvedIRN) return;

      const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

      const { data, error } = await supabase
        .from('bankaccountdepositmaster')
        .select('*')
        .eq('IRN', irnValue);

      if (error) {
        console.error('bankaccountdepositmaster load error:', error);
        return;
      }
      if (!data || data.length === 0) {
        // no saved row; we'll still compute AwardedAmount below
        return;
      }

      setSplitRecords(data);
      const main = data[0];

      setSelectedEmployer(
        main.Employer
          ? { OrganizationName: main.Employer, InsuranceProviderIPACode: null }
          : null
      );

      setInsuranceProviderName(main.Drawer ?? '');
      setInsuranceManuallyOverridden(true);

      setBankName(main.BankName ?? '');
      setDrawerAccountNo(main.DrawerAccountNumber ?? '');
      setPaymentTypeMethod(main.PaymentTypeMethod ?? '');
      setReference(main.EbankReferenceNo ?? '');

      setOWCAccountNumberSafe(main.OWCAccountNumber);

      setAwardedAmount(Number(main.AwardedAmount ?? 0));
      setInterestAmount(Number(main.IntrestAmount ?? main.InterestAmount ?? 0));
      setFinalPaymentAmount(Number(main.FinalPaymentAmount ?? 0));

      const totalAmountPaid = data.reduce((sum, r) => sum + Number(r.EbankAmountPaid ?? 0), 0);
      setAmountPaid(totalAmountPaid);

      const issued = main.EbankIssuedDate ? String(main.EbankIssuedDate) : '';
      setPaidDate(issued ? issued.slice(0, 10) : '');

      setPaymentDetails(main.PaymentDetails ?? '');

      setPaymentManagerReviewStatus(main.PaymentManagerReviewStatus ?? '');
      setBatchNo(main.BatchNo ?? '');

      // Legacy fallback for some views
      setWorkerBankName(main.WorkerBankName ?? '');
      setWorkerAccountNumber(String(main.WorkerAccountNumber ?? ''));
      setWorkerBSBBranchNo(String(main.WorkerBSBBranchNo ?? ''));

      setLoadedFromDeposit(true);
    })();
  }, [resolvedIRN]);

  // Helper to keep OWC account number a safe string
  const setOWCAccountNumberSafe = (val: any) => {
    setOwcAccountNumber(val === null || val === undefined ? '' : String(val));
  };

  // If nothing loaded from deposit, compute AwardedAmount from claimcompensationworkerdetails
  useEffect(() => {
    (async () => {
      if (loadedFromDeposit) return; // prefer saved row
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

  // Keep Final Payment Amount = Awarded + Interest unless record already set it
  useEffect(() => {
    if (loadedFromDeposit) return; // respect saved value
    const total = Number(awardedAmount || 0) + Number(interestAmount || 0);
    setFinalPaymentAmount(Number.isFinite(total) ? Number(total.toFixed(2)) : 0);
  }, [awardedAmount, interestAmount, loadedFromDeposit]);

  // Close handler
  const handleClose = () => {
    if (onCloseAll) return onCloseAll();
    if (onClose) return onClose();
    setOpen(false);
  };

  // Document actions (preview-only)
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
      if (!fn) return;
      await fn(resolvedIRN);
    } catch (e) {
      console.error(e);
      // keep quiet (no browser popups)
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
      if (staffId == null) {
        // keep quiet
        return;
      }
      const mod = await import('../../utils/CertificateOfClaimAward_jspdf');
      const fn =
        (mod as any).generateCertificateOfClaimAward ||
        (mod as any).generateCertificateOfClaimAwardPDF ||
        (mod as any).default;
      if (!fn) return;
      await fn(resolvedIRN, staffId, { showStamps: false });
    } catch (e) {
      console.error(e);
      // keep quiet
    }
  };

  const handlePrintPaymentChecklist = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/ChecklistForPayment_jspdf');
    const fn =
      (mod as any).printChecklistForPayment ||
      (mod as any).generateChecklistForPayment ||
      (mod as any).default;
    if (!fn) return;
    await fn(resolvedIRN);
  };

  const handlePrintBankConfirmation = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/BankConfirmationLetter_jspdf');
    const fn =
      (mod as any).printBankConfirmationLetter ||
      (mod as any).generateBankConfirmationLetter ||
      (mod as any).default;
    if (!fn) return;
    await fn(resolvedIRN);
  };

  // ---------- Decision Submit ----------
  const dateOnly = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  const statusMap: Record<Decision, string> = {
    Approved: 'ApprovedManagerReview',
    OnHold: 'OnHoldManagerReview',
    Rejected: 'RejectedManagerReview',
  };

  const openDecisionConfirm = () => {
    if (!resolvedIRN) return;
    setConfirmDecisionOpen(true);
  };

  const handleProceedDecision = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    if (!resolvedIRN) return;
    setSubmittingDecision(true);
    try {
      const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;
      const today = dateOnly(new Date());
      const reviewStatus = statusMap[decision];

      const { error: up1 } = await supabase
        .from('claimsawardedpaymentsectionreview')
        .update({
          CAPSRReviewStatus: reviewStatus,
          CAPSRReviewDate: today,
          CAPSRNotes: decisionReason || null,
        })
        .eq('IRN', irnValue);
      if (up1) throw up1;

      const { error: up2 } = await supabase
        .from('bankaccountdepositmaster')
        .update({
          PaymentManagerReviewStatus: reviewStatus,
        })
        .eq('IRN', irnValue);
      if (up2) throw up2;

      setConfirmDecisionOpen(false);
      handleClose();
    } catch (e) {
      console.error('Decision update failed:', e);
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4" onClick={handleClose}>
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Payments Manager Review (OnHold) — {formType}
              </h2>
              {resolvedIRN && <span className="text-sm text-gray-600">IRN: {resolvedIRN}</span>}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-8 overflow-y-auto">
            {/* Section 1: Embedded Form (inline) */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                {formType === 'Death' ? 'Form 124 — Death Claim Detail' : 'Form 113 — Injury Claim Detail'}
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

            {/* Section 2: Claim Decisions (read-only history) */}
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

            {/* Section 4: Actions (preview only) */}
            <section className="border rounded-lg p-4 bg-amber-50">
              {isInjury && (
                <p className="text-sm text-amber-800 mb-3">
                  <strong>Note:</strong> You can generate a preview of the Consent Of Award and Certificate Of Award
                  without the Commissioner&apos;s Signature. The final version will be generated only after approval.
                </p>
              )}

              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span>Actions:</span>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handleDownloadConsent}
                  disabled={!resolvedIRN}
                >
                  Print Consent of Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintCertificateOfAward}
                  disabled={!resolvedIRN}
                >
                  Print Certificate of Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={async () => {
                    const mod = await import('../../utils/form6CPO_jspdf');
                    const fn = (mod as any).printForm6 || (mod as any).generateForm6Pdf || (mod as any).default || (mod as any).print;
                    if (fn) await fn(resolvedIRN);
                  }}
                  disabled={!resolvedIRN}
                >
                  Print Form 6
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={async () => {
                    const mod = await import('../../utils/form18CPO_jspdf');
                    const fn = (mod as any).printForm18 || (mod as any).generateForm18Pdf || (mod as any).default || (mod as any).print;
                    if (fn) await fn(resolvedIRN);
                  }}
                  disabled={!resolvedIRN}
                >
                  Print Form 18
                </button>
              </div>
            </section>

            {/* Section 5: Details of Payment Received (prefilled) */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Details of Payment Received</h3>

              {/* Employer (read-only) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50"
                  value={selectedEmployer?.OrganizationName || ''}
                  disabled
                />
              </div>

              {/* Insurance Provider (Drawer) with optional override */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => setInsuranceOverrideOpen((v) => !v)}
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
                />
                {insuranceOverrideOpen && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                    {insuranceList.length > 0 ? (
                      insuranceList.slice(0, 100).map((i: any) => {
                        const name =
                          i.InsuranceCompanyOrganizationName ??
                          i.insurancecompanyorganizationName ??
                          '';
                        return (
                          <button
                            key={String(i.IPACODE ?? i.ipacode ?? i.id ?? Math.random())}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => {
                              setInsuranceProviderName(name);
                              setInsuranceManuallyOverridden(true);
                              setInsuranceOverrideOpen(false);
                            }}
                          >
                            {name || '(no name)'}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">No insurance providers found.</div>
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
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drawer Account No</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={drawerAccountNo}
                    onChange={(e) => setDrawerAccountNo(e.target.value)}
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
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>

              {/* OWC Account Number (TEXT FIELD) */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">OWC Account No</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={owcAccountNumber}
                  onChange={(e) => setOWCAccountNumberSafe(e.target.value)}
                  placeholder="e.g., 123456789"
                />
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
                      Auto-summed from claimcompensationworkerdetails for this IRN.
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Final Payment Amount (Interest)</label>
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
                  />
                </div>
              </div>

              {/* NEW: Recipient Payment Breakdown Table */}
              <section className="mt-8 border-t pt-6 bg-white">
                <h4 className="text-lg font-semibold text-primary mb-4">Recipient Payment Breakdown</h4>
                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">Recipient</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">Bank</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">BSB/Branch</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 uppercase tracking-wider">Account No</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 uppercase tracking-wider text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {splitRecords.length > 0 ? (
                        splitRecords.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">
                              {r.Recipients || r.PaymentDetails?.split(' | ')[0] || '-'}
                            </td>
                            <td className="px-4 py-2">{r.WorkerBankName || '-'}</td>
                            <td className="px-4 py-2">{r.WorkerBSBBranchNo || '-'}</td>
                            <td className="px-4 py-2">{r.WorkerAccountNumber || '-'}</td>
                            <td className="px-4 py-2 text-right font-semibold">K{(Number(r.EbankAmountPaid ?? 0)).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 text-center text-gray-500 italic">No payment breakdown available.</td>
                        </tr>
                      )}
                    </tbody>
                    {splitRecords.length > 0 && (
                      <tfoot className="bg-gray-50 font-bold">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-right">Total Allocated:</td>
                          <td className="px-4 py-2 text-right text-primary">
                            K{splitRecords.reduce((sum: number, r: any) => sum + (Number(r.EbankAmountPaid ?? 0)), 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>

              {/* Display saved status fields */}
              <div className="mt-6 grid md:grid-cols-2 gap-4 text-xs text-gray-600">
                <div>
                  <span className="font-medium">Payment Manager Review Status:</span>{' '}
                  {paymentManagerReviewStatus || '-'}
                </div>
                <div>
                  <span className="font-medium">Batch No:</span>{' '}
                  {String(batchNo ?? '') || '-'}
                </div>
              </div>
            </section>

            {/* ---------------- Decision Section ---------------- */}
            <section className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4 text-primary">Decision</h3>

              <div className="flex items-center gap-6 flex-wrap mb-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === 'Approved'}
                    onChange={() => setDecision('Approved')}
                  />
                  <span>Approved</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === 'OnHold'}
                    onChange={() => setDecision('OnHold')}
                  />
                  <span>On Hold</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="decision"
                    checked={decision === 'Rejected'}
                    onChange={() => setDecision('Rejected')}
                  />
                  <span>Rejected</span>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Decision Reason</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  rows={3}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Enter reason for your decision"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm"
                  onClick={openDecisionConfirm}
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

      {/* Decision Confirmation Modal */}
      {confirmDecisionOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Confirm</h3>
              <p className="text-gray-700 mb-6">
                {decision === 'OnHold'
                  ? 'Confirm to put OnHold? The payment will be put on hold for further reviewing.'
                  : decision === 'Rejected'
                  ? 'Confirm to Reject? The payment will not be processed.'
                  : 'Confirm to proceed for payment? Payment Officer will process payment for this awarded claim.'}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                  onClick={() => setConfirmDecisionOpen(false)}
                  disabled={submittingDecision}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-50"
                  onClick={handleProceedDecision}
                  disabled={submittingDecision}
                >
                  {submittingDecision ? 'Saving…' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OnHoldClaimsAwardedForPaymentsManagerReview;
