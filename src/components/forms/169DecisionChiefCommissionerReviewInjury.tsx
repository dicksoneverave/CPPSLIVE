import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import { downloadConsentOfAwardInjury } from '../../utils/ConsentOfAward-Injury';

interface Props {
  IRN?: string;            // preferred prop name from caller
  irn?: string;            // supported for flexibility
  onCloseAll?: () => void; // close this overlay AND the parent list to return to dashboard
}

type Decision = 'Approved' | 'DecisionPending' | 'Reject' | 'KeepOnHold';

const Decision169ChiefCommissionerReviewInjury: React.FC<Props> = ({
  IRN,
  irn,
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
  const [decision, setDecision] = useState<Decision>('Approved'); // default Approved
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // fetch my staff id + name
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
      if (!resolvedIRN || !myStaffId) return;

      // read existing lock
      const { data: row, error } = await supabase
        .from('claimsawardedcommissionersreview')
        .select('LockedByID')
        .eq('IRN', resolvedIRN)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }

      const lockedById: number | null = row?.LockedByID ?? null;

      if (lockedById && lockedById !== myStaffId) {
        // locked by someone else → show their name and close
        const { data: who } = await supabase
          .from('owcstaffmaster')
          .select('OSMFirstName, OSMLastName')
          .eq('OSMStaffID', lockedById)
          .maybeSingle();

        const whoName = who
          ? `${who.OSMFirstName ?? ''} ${who.OSMLastName ?? ''}`.trim() || `User ${lockedById}`
          : `User ${lockedById}`;

        alert(`The record is locked by ${whoName}.`);
        onCloseAll?.();
        return;
      }

      // acquire (or refresh) lock for me
      const { error: upErr } = await supabase
        .from('claimsawardedcommissionersreview') // <-- locking here (table has LockedByID)
        .update({ LockedByID: myStaffId })
        .eq('IRN', resolvedIRN);
      if (upErr) {
        console.error(upErr);
        return;
      }
      setLockAcquired(true);

      // If you later add LockedByID to registrar, you can mirror the lock there too.
      // await supabase.from('claimsawardedregistrarreview').update({ LockedByID: myStaffId }).eq('IRN', resolvedIRN);
    })();
  }, [resolvedIRN, myStaffId, onCloseAll]);

  const handleClose = () => onCloseAll?.();

  const handlePreviewPdf = async () => {
    if (!resolvedIRN) return;
    await downloadConsentOfAwardInjury(resolvedIRN, {
      crestUrl:
        'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png',
      includeSignature: false, // preview only
    });
  };

  const isChief = myStaffId === 2811;
  const isCommissioner = myStaffId === 2812;
  const statusPrefix = isChief ? 'ChiefCommissioner' : isCommissioner ? 'Commissioner' : 'Commissioner';

  const confirmText =
    decision === 'Approved'
      ? 'The claim will be forwarded to the Registrar'
      : decision === 'DecisionPending'
      ? 'The claim will be set as ChiefCommissionerReviewPending. Will remain in the Pending basket.'
      : decision === 'Reject'
      ? 'The claim will be set as ChiefCommissionerRejected. Will remain in the Rejected basket.'
      : 'The claim will remain in the Pending basket. No processing will be made.';

  const handleSubmitClick = () => setConfirmOpen(true);

  const handleProceed = async () => {
    if (!resolvedIRN) return;
    setSubmitting(true);
    setConfirmOpen(false);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      if (decision === 'KeepOnHold') {
        handleClose();
        return;
      }

      // Build CACR status by role + action
      const CACRReviewStatus =
        decision === 'Approved'
          ? `${statusPrefix}Accepted`
          : decision === 'Reject'
          ? `${statusPrefix}Rejected`
          : `${statusPrefix}ReviewPending`;

      // Update Commissioners Review (status, date, reason)
      const { error: upErr } = await supabase
        .from('claimsawardedcommissionersreview')
        .update({
          CACRReviewStatus,
          CACRDecisionDate: today,
          CACRDecisionReason: reason || null,
        })
        .eq('IRN', resolvedIRN);
      if (upErr) throw upErr;

      if (decision === 'Approved') {
        // Need ClaimType & IncidentType for Registrar row
const { data: cacr, error: selErr } = await supabase
  .from('claimsawardedcommissionersreview')
  .select('ClaimType, IncidentType')
  .eq('IRN', resolvedIRN)
  .maybeSingle();
if (selErr) throw selErr;

// Does a registrar row exist already?
const { data: existingCarr, error: existErr } = await supabase
  .from('claimsawardedregistrarreview')
  .select('IRN')
  .eq('IRN', resolvedIRN)
  .maybeSingle();
if (existErr) throw existErr;

if (existingCarr) {
  // update
  const { error: carrUpdErr } = await supabase
    .from('claimsawardedregistrarreview')
    .update({
      CARRReviewStatus: 'RegistrarReviewPending',
      CARRSubmissionDate: today,
      ClaimType: cacr?.ClaimType ?? null,
      IncidentType: cacr?.IncidentType ?? null,
    })
    .eq('IRN', resolvedIRN);
  if (carrUpdErr) throw carrUpdErr;
} else {
  // insert
  const { error: carrInsErr } = await supabase
    .from('claimsawardedregistrarreview')
    .insert([
      {
        IRN: resolvedIRN,
        CARRReviewStatus: 'RegistrarReviewPending',
        CARRSubmissionDate: today,
        ClaimType: cacr?.ClaimType ?? null,
        IncidentType: cacr?.IncidentType ?? null,
      },
    ]);
  if (carrInsErr) throw carrInsErr; }

        // Download final PDF with the correct stamp & signature for the acting user
        const crestUrl =
          'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';

        const stampUrl = isChief
          ? 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Commissionstamp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbW1pc3Npb25zdGFtcC5wbmciLCJpYXQiOjE3NTQxNTA3MDIsImV4cCI6MjA2OTUxMDcwMn0.ET2gqM5ln9zbJbb5jH1gMHFz42HazTIoQ5s-BaUlADU'
          : 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Commissionstamp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbW1pc3Npb25zdGFtcC5wbmciLCJpYXQiOjE3NTQxNTA3MDIsImV4cCI6MjA2OTUxMDcwMn0.ET2gqM5ln9zbJbb5jH1gMHFz42HazTIoQ5s-BaUlADU';

        const signatureUrl = isChief
          ? 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Comsignature.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbXNpZ25hdHVyZS5wbmciLCJpYXQiOjE3NTQxNTA4ODAsImV4cCI6MjA2OTUxMDg4MH0.R4wqJdga2M1RJZ1uxxG_0VgeFd-66fHIT9sscQGgYeE'
          : 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Comsignature.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbXNpZ25hdHVyZS5wbmciLCJpYXQiOjE3NTQxNTA4ODAsImV4cCI6MjA2OTUxMDg4MH0.R4wqJdga2M1RJZ1uxxG_0VgeFd-66fHIT9sscQGgYeE';

        await downloadConsentOfAwardInjury(resolvedIRN, {
          crestUrl,
          includeSignature: true,
          signatureUrl,
          stampUrl,
        });

        handleClose();
        return;
      }

      // DecisionPending or Reject → close after update
      handleClose();
    } catch (e) {
      console.error('Decision processing failed:', e);
      alert('Failed to process decision. Please try again.');
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
                Chief Commissioner Review — Injury
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
            {/* Section 1 */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Form 113 — Injury Claim Detail</h3>
              {resolvedIRN ? (
                <Form113View irn={resolvedIRN} onClose={handleClose} />
              ) : (
                <p className="text-gray-500">Injury claim details cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Section 2 */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
              {resolvedIRN ? (
                <ListClaimDecisions irn={resolvedIRN} />
              ) : (
                <p className="text-gray-500">Claim decisions cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Section 3 */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
              {resolvedIRN ? (
                <CompensationBreakupDetailsView IRN={resolvedIRN} IncidentType="Injury" />
              ) : (
                <p className="text-gray-500">Compensation data cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Notice / Download preview */}
            <section className="border rounded-lg p-4 bg-amber-50">
              <p className="text-sm text-amber-800 mb-3">
                <strong>Note:</strong> You can generate a preview of the consent of award certificate
                without the Commissioner's Signature. The final version will be generated only after
                the approval of the Commissioner or Chief Commissioner.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span>Generate Consent Of Award Certificate for Injury Case :</span>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md"
                  onClick={handlePreviewPdf}
                >
                  Download To PDF
                </button>
              </div>
            </section>

            {/* Decision section (AFTER the notice, BEFORE footer) */}
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-2">Confirm</h3>
              <p className="text-gray-700 mb-6">{confirmText}</p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                  onClick={() => setConfirmOpen(false)}
                >
                  Back
                </button>
                <button
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm"
                  onClick={handleProceed}
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Decision169ChiefCommissionerReviewInjury;
