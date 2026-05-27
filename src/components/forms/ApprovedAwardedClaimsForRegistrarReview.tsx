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
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Comsignature.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbXNpZ25hdHVyZS5wbmciLCJpYXQiOjE3NTQxNTA4ODAsImV4cCI6MjA2OTUxMDg4MH0.R4wqJdga2M1RJZ1uxxG_0VgeFd-66fHIT9sscQGgYeE';
const COMM_STAMP =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Commissionstamp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbW1pc3Npb25zdGFtcC5wbmciLCJpYXQiOjE3NTQxNTA3MDIsImV4cCI6MjA2OTUxMDcwMn0.ET2gqM5ln9zbJbb5jH1gMHFz42HazTIoQ5s-BaUlADU';
const CHIEFCOMM_SIGN =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/commsign.png';
const CHIEFCOMM_STAMP =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/ChiefCommissioner.png';

interface Props {
  IRN?: string;
  irn?: string;
  formType?: 'Injury' | 'Death';
  onCloseAll?: () => void;
}

const ApprovedAwardedClaimsForRegistrarReview: React.FC<Props> = ({
  IRN,
  irn,
  formType = 'Injury',
  onCloseAll,
}) => {
  const { profile } = useAuth();
  const resolvedIRN = useMemo(() => (IRN ?? irn ?? '').toString(), [IRN, irn]);

  // who am I?
  const [myStaffId, setMyStaffId] = useState<number | null>(null);

  // lock state (kept as-is)
  const [lockAcquired, setLockAcquired] = useState(false);

  const isInjury = formType === 'Injury';

  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID')
        .eq('cppsid', profile.id)
        .maybeSingle();
      if (!error) setMyStaffId(data?.OSMStaffID ? Number(data.OSMStaffID) : null);
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
      if (!error) setLockAcquired(true);
    })();
  }, [resolvedIRN]);

  const handleClose = () => onCloseAll?.();

  // ---- commissioner assets by status ----
  async function getCACRStatus(irnVal: string) {
    const { data, error } = await supabase
      .from('claimsawardedcommissionersreview')
      .select('CACRReviewStatus')
      .eq('IRN', irnVal)
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
    return { signatureUrl: undefined, stampUrl: undefined };
  }

  // ---------- Buttons (all with stamps where applicable) ----------

  // Consent of Award (with commissioner/CC stamps)
  const handlePrintConsentOfAward = async () => {
    if (!resolvedIRN) return;
    try {
      const status = await getCACRStatus(resolvedIRN);
      const { signatureUrl, stampUrl } = pickCommissionAssets(status);

      if (isInjury) {
        await downloadConsentOfAwardInjury(resolvedIRN, {
          crestUrl: CREST,
          includeSignature: true,
          signatureUrl,
          stampUrl,
        });
      } else {
        const mod = await import('../../utils/ConsentOfAward-Death');
        const fn = (mod as any).downloadConsentOfAwardDeath || (mod as any).default;
        if (!fn) throw new Error('ConsentOfAward-Death export not found');
        await fn(resolvedIRN, {
          crestUrl: CREST,
          includeSignature: true,
          signatureUrl,
          stampUrl,
        });
      }
    } catch (e) {
      console.error(e);
      alert('Could not generate the Consent Of Award.');
    }
  };

  // Certificate of Award (with Registrar stamps)
  const handlePrintCertificateOfAward = async () => {
    if (!resolvedIRN) return;
    try {
      const mod = await import('../../utils/CertificateOfAward_jspdf');
      const fn =
        (mod as any).generateCertificateOfAward ||
        (mod as any).generateCertificateOfAwardPDF ||
        (mod as any).default;
      if (!fn) throw new Error('CertificateOfAward_jspdf: export not found');

      await fn(resolvedIRN, {
        includeSignature: true,
        signatureUrl: REG_SIGN,
        stampUrl: REG_STAMP,
        crestUrl: CREST,
      });
    } catch (e) {
      console.error(e);
      alert('Could not generate Certificate Of Award.');
    }
  };

  // Certificate of Claim Award (with stamps; needs staff id)
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
        if (!error) staffId = data?.OSMStaffID ? Number(data.OSMStaffID) : null;
        setMyStaffId(staffId ?? null);
      }
      if (staffId == null) {
        alert('Your staff id could not be determined.');
        return;
      }

      const mod = await import('../../utils/CertificateOfClaimAward_jspdf');
      const fn =
        (mod as any).generateCertificateOfClaimAward ||
        (mod as any).generateCertificateOfClaimAwardPDF ||
        (mod as any).default;
      if (!fn) throw new Error('CertificateOfClaimAward_jspdf: export not found');

      await fn(resolvedIRN, staffId, { showStamps: true });
    } catch (e) {
      console.error(e);
      alert('Could not generate Certificate Of Claim Award.');
    }
  };

  const handlePrintPaymentChecklist = async () => {
    if (!resolvedIRN) return;
    try {
      const mod = await import('../../utils/ChecklistForPayment_jspdf');
      const fn =
        (mod as any).printChecklistForPayment ||
        (mod as any).generateChecklistForPayment ||
        (mod as any).default;
      if (!fn) throw new Error('ChecklistForPayment_jspdf: export not found');
      await fn(resolvedIRN);
    } catch (e) {
      console.error(e);
      alert('Could not generate Payment Checklist.');
    }
  };

  const handlePrintBankConfirmation = async () => {
    if (!resolvedIRN) return;
    try {
      const mod = await import('../../utils/BankConfirmationLetter_jspdf');
      const fn =
        (mod as any).printBankConfirmationLetter ||
        (mod as any).generateBankConfirmationLetter ||
        (mod as any).default;
      if (!fn) throw new Error('BankConfirmationLetter_jspdf: export not found');
      await fn(resolvedIRN);
    } catch (e) {
      console.error(e);
      alert('Could not generate Bank Confirmation Letter.');
    }
  };

  const handlePrintForm6 = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/form6CPO_jspdf');
    const fn =
      (mod as any).printForm6 ||
      (mod as any).generateForm6Pdf ||
      (mod as any).default ||
      (mod as any).print;
    if (fn) await fn(resolvedIRN);
  };

  const handlePrintForm18 = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/form18CPO_jspdf');
    const fn =
      (mod as any).printForm18 ||
      (mod as any).generateForm18Pdf ||
      (mod as any).default ||
      (mod as any).print;
    if (fn) await fn(resolvedIRN);
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

            {/* Single Actions section (all buttons together, with stamps/signatures) */}
            <section className="border rounded-lg p-4 bg-amber-50">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="font-medium">Actions:</span>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintConsentOfAward}
                  disabled={!resolvedIRN}
                >
                  Print Consent Of Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintCertificateOfAward}
                  disabled={!resolvedIRN}
                >
                  Print Certificate Of Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintCertificateOfClaimAward}
                  disabled={!resolvedIRN || myStaffId == null}
                  title={myStaffId == null ? 'Your staff id is required' : ''}
                >
                  Print Certificate Of Claim Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintPaymentChecklist}
                  disabled={!resolvedIRN}
                >
                  Print Payment Checklist
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintBankConfirmation}
                  disabled={!resolvedIRN}
                >
                  Print Bank Confirmation Letter
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintForm6}
                  disabled={!resolvedIRN}
                >
                  Print Form 6
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintForm18}
                  disabled={!resolvedIRN}
                >
                  Print Form 18
                </button>
              </div>

              {lockAcquired && (
                <p className="text-xs text-amber-800 mt-3">
                  You can re-print this certificates if required.
                </p>
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

export default ApprovedAwardedClaimsForRegistrarReview;
