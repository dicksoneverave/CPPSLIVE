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
const COMM_SIGN = 
	'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Comsignature.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbXNpZ25hdHVyZS5wbmciLCJpYXQiOjE3NTQxNTA4ODAsImV4cCI6MjA2OTUxMDg4MH0.R4wqJdga2M1RJZ1uxxG_0VgeFd-66fHIT9sscQGgYeE'
const COMM_STAMP =
	'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Commissionstamp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbW1pc3Npb25zdGFtcC5wbmciLCJpYXQiOjE3NTQxNTA3MDIsImV4cCI6MjA2OTUxMDcwMn0.ET2gqM5ln9zbJbb5jH1gMHFz42HazTIoQ5s-BaUlADU'
const CHIEFCOMM_SIGN =
	'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/commsign.png'
const CHIEFCOMM_STAMP =
	'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/ChiefCommissioner.png'


interface Props {
  IRN?: string;
  irn?: string;
  TBCRRID?: string; // <-- add this
  IncidentType?: 'Injury' | 'Death';
  onCloseAll?: () => void;
}


type Decision = 'Approved' | 'DecisionPending' | 'Reject' | 'KeepOnHold';

const PendingAwardedClaimsForRegistrarReview: React.FC<Props> = ({
  IRN,
  irn,
  formType = 'Injury',
  onCloseAll,
}) => {
  const { profile } = useAuth();
  const resolvedIRN = useMemo(() => (IRN ?? irn ?? '').toString(), [IRN, irn]);

  // who am I?
  const [myStaffId, setMyStaffId] = useState<number | null>(null);
  const [myName, setMyName] = useState<string>('User');

  // lock state
  const [lockAcquired, setLockAcquired] = useState(false);

  // decision ui
  const [decision, setDecision] = useState<Decision>('Approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
// under other useState calls
const [saveSuccess, setSaveSuccess] = useState(false);

  const isInjury = formType === 'Injury';

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID, OSMFirstName, OSMLastName')
        .eq('cppsid', profile.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      const sid = data?.OSMStaffID ? Number(data.OSMStaffID) : null;
      setMyStaffId(sid);
      setMyName(
        data ? `${data.OSMFirstName ?? ''} ${data.OSMLastName ?? ''}`.trim() || 'User' : 'User'
      );
    })();
  }, [profile?.id]);

  // try to lock the record when the form opens
  useEffect(() => {
    (async () => {
      if (!resolvedIRN) return;

      const { error } = await supabase
        .from('claimsawardedregistrarreview')
        .select('IRN')
        .eq('IRN', resolvedIRN)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      setLockAcquired(true);
    })();
  }, [resolvedIRN, formType, myStaffId]);

  const handleClose = () => onCloseAll?.();

// ⬇️ NEW: helpers to look up status and pick the correct assets
async function getCACRStatus(irn: string) {
  const { data, error } = await supabase
    .from('claimsawardedcommissionersreview')
    .select('CACRReviewStatus')
    .eq('IRN', irn)
    .maybeSingle();
  if (error) {
    console.error('getCACRStatus error:', error);
    return null;
  }
  return (data?.CACRReviewStatus || '').trim();
}

function pickCommissionAssets(status: string | null) {
  if (status === 'ChiefCommissionerAccepted') {
    return { signatureUrl: CHIEFCOMM_SIGN, stampUrl: CHIEFCOMM_STAMP };
  }
  if (status === 'CommissionerAccepted') {
    return { signatureUrl: COMM_SIGN, stampUrl: COMM_STAMP };
  }
  // fallback (nothing — the PDF utils will still try auto-detect if you added that logic)
  return { signatureUrl: undefined, stampUrl: undefined };
}
	
  // ---------- Document actions ----------

  const handleDownloadConsent = async () => {
    if (!resolvedIRN) return;

    if (isInjury) {
      await downloadConsentOfAwardInjury(resolvedIRN, {
        crestUrl:
          'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png',
        includeSignature: false,
      });
    } else {
      const mod = await import('../../utils/ConsentOfAward-Death');
      const fn = (mod as any).downloadConsentOfAwardDeath || (mod as any).default;
      if (!fn) {
        console.error('ConsentOfAward-Death export not found');
        return;
      }
      await fn(resolvedIRN);
    }
  };
	
const handleDownloadConsentApproved = async () => {
  if (!resolvedIRN) return;

  try {
    // look up which Commissioner's assets to use
    const status = await getCACRStatus(resolvedIRN);
    const { signatureUrl, stampUrl } = pickCommissionAssets(status);

    if (isInjury) {
      const { downloadConsentOfAwardInjury } = await import('../../utils/ConsentOfAward-Injury');
      await downloadConsentOfAwardInjury(resolvedIRN, {
        crestUrl: CREST,
        includeSignature: true,
        signatureUrl, // Commissioner/Chief Commissioner signature
        stampUrl,     // Commissioner/Chief Commissioner stamp
      });
    } else {
      const mod = await import('../../utils/ConsentOfAward-Death');
      const fn = (mod as any).downloadConsentOfAwardDeath || (mod as any).default;
      if (!fn) {
        console.error('ConsentOfAward-Death export not found');
        return;
      }
      await fn(resolvedIRN, {
        crestUrl: CREST,
        includeSignature: true,
        signatureUrl, // Commissioner/Chief Commissioner signature
        stampUrl,     // Commissioner/Chief Commissioner stamp
      });
    }
  } catch (e) {
    console.error('Consent print (Approved) failed:', e);
    alert('Could not generate the Consent Of Award. Please try again.');
  }
};


// Certificate of Award (Registrar stamp/sign when Approved)
const handlePrintCertificateOfAward = async () => {
  if (!resolvedIRN) return;
  try {
    const mod = await import('../../utils/CertificateOfAward_jspdf');
    const fn =
      (mod as any).generateCertificateOfAward ||
      (mod as any).generateCertificateOfAwardPDF ||
      (mod as any).default;

    if (!fn) {
      console.error('CertificateOfAward_jspdf: export not found');
      return;
    }

    if (decision === 'Approved') {
      // Force-show Registrar stamp/sign for the popup print
      await fn(resolvedIRN, {
        includeSignature: true,
        signatureUrl: REG_SIGN,
        stampUrl: REG_STAMP,
        crestUrl: CREST,
      });
    } else {
      // Preview (no forced stamps)
      await fn(resolvedIRN);
    }
  } catch (e) {
    console.error(e);
    alert('Could not generate Certificate Of Award. Please try again.');
  }
};


// Certificate of Claim Award (needs staffId for the footer name)
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
      alert('Your staff id could not be determined. Please reopen this page or contact an admin.');
      return;
    }

    const mod = await import('../../utils/CertificateOfClaimAward_jspdf');
    const fn =
      (mod as any).generateCertificateOfClaimAward ||
      (mod as any).generateCertificateOfClaimAwardPDF ||
      (mod as any).default;

    if (!fn) {
      console.error('CertificateOfClaimAward_jspdf: export not found');
      return;
    }

    await fn(resolvedIRN, staffId, { showStamps: decision === 'Approved' }); // 👈 pass intent
  } catch (e) {
    console.error(e);
    alert('Could not generate Certificate Of Claim Award. Please try again.');
  }
};


  const handlePrintPaymentChecklist = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/ChecklistForPayment_jspdf');
    const fn =
      (mod as any).printChecklistForPayment ||
      (mod as any).generateChecklistForPayment ||
      (mod as any).default;
    if (!fn) {
      console.error('ChecklistForPayment_jspdf: export not found');
      return;
    }
    await fn(resolvedIRN);
  };

  const handlePrintBankConfirmation = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/BankConfirmationLetter_jspdf');
    const fn =
      (mod as any).printBankConfirmationLetter ||
      (mod as any).generateBankConfirmationLetter ||
      (mod as any).default;
    if (!fn) {
      console.error('BankConfirmationLetter_jspdf: export not found');
      return;
    }
    await fn(resolvedIRN);
  };

  // ---------- Decision modal ----------
  const dateOnly = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const confirmText =
    decision === 'Approved'
      ? 'Awarded claim will be fowarded to Payment Section.'
      : decision === 'DecisionPending'
      ? 'The Claim will remain Pending, no action will take place'
      : 'This action and flow have not been defined yet, no action will take place';

  const handleSubmitClick = () => setConfirmOpen(true);

const handleProceed = async () => {
  if (!resolvedIRN) return;

  if (decision !== 'Approved') {
    setConfirmOpen(false);
    return;
  }

  try {
    setSubmitting(true);
    const today = dateOnly(new Date());

    // Use numeric IRN if the column is BIGINT
    const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

    // Fetch ClaimType from commissioners review
    let claimType: string | null = null;
    {
      const { data, error } = await supabase
        .from('claimsawardedcommissionersreview')
        .select('ClaimType')
        .eq('IRN', irnValue)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch ClaimType; inserting null.', error);
      } else {
        claimType = (data?.ClaimType ?? null) as string | null;
      }
    }

    // Derive IncidentType from the current modal context
    const incidentType = formType; // 'Injury' | 'Death'

    // (a) UPDATE claimsawardedregistrarreview
    const { error: upErr } = await supabase
      .from('claimsawardedregistrarreview')
      .update({
        CARRReviewStatus: 'RegistrarAccepted',
        CARRDecisionDate: today,
        CARRDecisionReason: reason ?? null,
      })
      .eq('IRN', irnValue);
    if (upErr) throw upErr;

    // (b) INSERT into claimsawardedpaymentsectionreview
    const { error: insErr } = await supabase
      .from('claimsawardedpaymentsectionreview')
      .insert([
        {
          IRN: irnValue,
          CAPSRReviewStatus: 'ReviewPending',
          CAPSRSubmissionDate: today,
          ClaimType: claimType,
          IncidentType: incidentType,
        },
      ]);
    if (insErr) throw insErr;

    // ✅ Inline success notice in the confirmation modal, then close
    setSaveSuccess(true);
    setTimeout(() => {
      setConfirmOpen(false); // close confirmation popup
      onCloseAll?.();        // close the whole form
      setSaveSuccess(false); // reset
    }, 1500);
  } catch (e) {
    console.error('Approval flow error:', e);
    alert('Could not complete the approval. Please try again.');
  } finally {
    setSubmitting(false);
  }
};


  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Registrar Review — {formType}
              </h2>
              {resolvedIRN && (
                <span className="text-sm text-gray-600">IRN: {resolvedIRN}</span>
              )}
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

            {/* Section 2: Claim Decisions */}
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

            {/* Actions */}
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

            {/* Decision section */}
            <section className="border rounded-lg p-4 bg-gray-50">
              {lockAcquired && (
                <p className="text-sm text-gray-700 mb-3">
                  A lock has been obtained for this claim on your behalf. You may now proceed with review for this claim.
                </p>
              )}

              <div className="grid gap-3">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="font-medium">Action Taken</div>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="decision"
                      checked={decision === 'DecisionPending'}
                      onChange={() => setDecision('DecisionPending')}
                    />
                    <span>Decision Pending</span>
                  </label>

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
                      checked={decision === 'Reject'}
                      onChange={() => setDecision('Reject')}
                    />
                    <span>Reject</span>
                  </label>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="decision"
                      checked={decision === 'KeepOnHold'}
                      onChange={() => setDecision('KeepOnHold')}
                    />
                    <span>Keep On Hold</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason (optional)"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm font-medium disabled:opacity-50"
                    onClick={handleSubmitClick}
                    disabled={submitting || !resolvedIRN}
                  >
                    {submitting ? 'Submitting…' : 'SUBMIT'}
                  </button>
                </div>
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

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Confirm</h3>

              <p className="text-gray-700 mb-4">{confirmText}</p>

              {decision === 'Approved' && (
                <>
                  <div className="flex flex-wrap gap-2 mb-6">

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handleDownloadConsentApproved}
                  disabled={!resolvedIRN}
                >
                  Print Consent of Award
                </button>									
                    <button
                      className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                      onClick={handlePrintCertificateOfClaimAward}
                      disabled={!resolvedIRN}
                    >
                      Print Certificate Of Claim Award
                    </button>
                    <button
                      className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                      onClick={handlePrintCertificateOfAward}
                      disabled={!resolvedIRN}
                    >
                      Print Certificate Of Award
                    </button>										
                    <button
                      className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                      onClick={handlePrintPaymentChecklist}
                      disabled={!resolvedIRN}
                    >
                      Print Payment Checklist
                    </button>
                    <button
                      className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                      onClick={handlePrintBankConfirmation}
                      disabled={!resolvedIRN}
                    >
                      Print Bank Confirmation Letter
                    </button>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                      onClick={() => setConfirmOpen(false)}
                    >
                      Back
                    </button>
                    <button
                      className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-50"
                      onClick={handleProceed}
                      disabled={submitting}
                    >
                      Proceed
                    </button>

                  </div>
                </>
              )}

										{saveSuccess && (
  <div className="mt-4">
    <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2 rounded-md">
      Claim saved successfully to payments
    </div>
  </div>
)}

              {decision !== 'Approved' && (
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm"
                    onClick={() => setConfirmOpen(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingAwardedClaimsForRegistrarReview;
