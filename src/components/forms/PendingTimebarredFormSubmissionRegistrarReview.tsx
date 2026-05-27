import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import ViewForm11 from './ViewForm11';
import ViewForm12 from './ViewForm12';

type Decision = 'Approved' | 'KeepOnHold' | 'Reject' | 'ForwardToTribunal';

interface Props {
  IRN?: string;
  irn?: string;
  IncidentType?: 'Injury' | 'Death';
  onCloseAll?: () => void;
}

const PendingTimebarredFormSubmissionRegistrarReview: React.FC<Props> = ({
  IRN,
  irn,
  IncidentType = 'Injury',
  onCloseAll,
}) => {
  const { profile } = useAuth();
  const resolvedIRN = useMemo(() => (IRN ?? irn ?? '').toString(), [IRN, irn]);

  // UI state
  const [decision, setDecision] = useState<Decision>('Approved');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [workerIdForView, setWorkerIdForView] = useState<string | null>(null);


// Show CRN (DisplayIRN) instead of raw IRN
const [displayIRN, setDisplayIRN] = useState<string>(resolvedIRN);

useEffect(() => {
  (async () => {
    if (!resolvedIRN) return;
    try {
      const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

      // fetch both DisplayIRN and WorkerID in one query
      const { data, error } = await supabase
        .from('workerirn')
        .select('DisplayIRN, WorkerID')
        .eq('IRN', irnValue)
        .maybeSingle();

      if (!error) {
        if (data?.DisplayIRN) setDisplayIRN(String(data.DisplayIRN));
        else setDisplayIRN(resolvedIRN); // fallback

        if (data?.WorkerID != null) setWorkerIdForView(String(data.WorkerID));
        else setWorkerIdForView(null);
      } else {
        setDisplayIRN(resolvedIRN);
        setWorkerIdForView(null);
      }
    } catch {
      setDisplayIRN(resolvedIRN);
      setWorkerIdForView(null);
    }
  })();
}, [resolvedIRN]);


	
  // (optional) auth awareness — not strictly required here, but useful for auditing
  useEffect(() => {
    if (!profile?.id) return;
  }, [profile?.id]);

  const dateOnly = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleSubmitClick = () => setConfirmOpen(true);

  const confirmText =
    decision === 'Approved'
      ? 'Form submission will be accepted for Form3/4 processing'
      : decision === 'Reject'
      ? 'Form submission has been rejected. It will be forwarded to the Rejected list'
      : decision === 'ForwardToTribunal'
      ? 'Form submission will be forwarded to Tribunal for hearing'
      : 'No action, Form will remain in Pending list';

  const closeWithSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => {
      setConfirmOpen(false);
      setSuccessMsg(null);
      onCloseAll?.();
    }, 1500);
  };

  const handleProceed = async () => {
    if (!resolvedIRN) return;

    // For "Keep On Hold" there is no DB action
    if (decision === 'KeepOnHold') {
      setConfirmOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      const today = dateOnly(new Date());
      const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

      // --- Common: update timebarredclaimsregistrarreview for the actionable paths ---
      if (decision === 'Approved') {
        const { error: upErr } = await supabase
          .from('timebarredclaimsregistrarreview')
          .update({
            TBCRRReviewStatus: 'Approved',
            TBCRRDecisionDate: today,
            TBCRRDecisionReason: reason?.trim() || null,
          })
          .eq('IRN', irnValue);
        if (upErr) throw upErr;

        // Inline success message
        closeWithSuccess('Successfully saved for processing');
        return;
      }

      if (decision === 'Reject') {
        const { error: upErr } = await supabase
          .from('timebarredclaimsregistrarreview')
          .update({
            // Using TBCRR* consistently (the names with TMCRR/TNCRR looked like typos)
            TBCRRReviewStatus: 'Rejected',
            TBCRRDecisionDate: today,
            TBCRRDecisionReason: reason?.trim() || null,
          })
          .eq('IRN', irnValue);
        if (upErr) throw upErr;

        closeWithSuccess('Successfully saved in the Rejected list');
        return;
      }

      if (decision === 'ForwardToTribunal') {
        // 1) Update the registrar review table
        const { error: upErr } = await supabase
          .from('timebarredclaimsregistrarreview')
          .update({
            TBCRRReviewStatus: 'ForwardToTribunal',
            TBCRRDecisionDate: today,
            TBCRRDecisionReason: reason?.trim() || null,
          })
          .eq('IRN', irnValue);
        if (upErr) throw upErr;

        // 2) Build tribunal hearing submission payload
        const hearingType =
          IncidentType === 'Injury'
            ? 'TimeBarredForm11Submission'
            : 'TimeBarredForm12Submission';

        // Fetch WorkerID from workerirn
        let workerId: number | string | null = null;
        {
          const { data, error } = await supabase
            .from('workerirn')
            .select('WorkerID')
            .eq('IRN', irnValue)
            .maybeSingle();
          if (error) {
            console.warn('workerirn lookup failed:', error);
          } else {
            workerId = (data?.WorkerID as number | string | undefined) ?? null;
          }
        }

        // Fetch organization type from currentemploymentdetails
        let orgType: string | null = null;
        if (workerId != null) {
          const { data, error } = await supabase
            .from('currentemploymentdetails')
            .select('*')
            .eq('WorkerID', workerId)
            .maybeSingle();
          if (error) {
            console.warn('currentemploymentdetails lookup failed:', error);
          } else if (data) {
            // tolerate either field name (typo vs. non-typo)
            orgType =
              (data as any).OrganizationType ??
              (data as any).OrganizationType ??
              null;
          }
        }

        // 3) Insert / upsert a tribunal hearing submission record
        // Assumed table name "tribunalhearingsubmissions" based on THS* prefix
        const { error: insErr } = await supabase
          .from('tribunalhearingschedule')
          .upsert(
            [
              {
                IRN: irnValue,
                THSHearingStatus: 'HearingPending',
                THSHearingType: hearingType,
                THSSubmissionDate: today,
                THSWorkerOrganizatiosType: orgType, // keep name as specified
              },
            ],
            { onConflict: 'IRN' }
          );
        if (insErr) throw insErr;

        closeWithSuccess('Successfully Forwarded to Tribunal');
        return;
      }
    } catch (e) {
      console.error('Timebarred flow error:', e);
      // Keep inline UX, but you can also add a red error notice if you want
      setSubmitting(false);
      return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCloseAll} />

      {/* Modal container */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Time-barred Submission — Registrar Review ({IncidentType})
              </h2>
              {resolvedIRN && (
                <span className="text-sm text-gray-600">CRN: {displayIRN}</span>

              )}
            </div>
            <button
              onClick={onCloseAll}
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
            {/* Section 1: Embedded Form */}
<section className="border rounded-lg p-4">
  <h3 className="text-lg font-semibold mb-4 text-primary">
    {IncidentType === 'Death' ? 'Form 12 — Death (View)' : 'Form 11 — Injury (View)'}
  </h3>

  {resolvedIRN ? (
    IncidentType === 'Death' ? (
      <ViewForm12 workerId={workerIdForView} irn={resolvedIRN} embedded />
    ) : workerIdForView ? (
      <ViewForm11 workerId={workerIdForView} irn={resolvedIRN} embedded />
    ) : (
      <p className="text-gray-500">Loading Form 11…</p>
    )
  ) : (
    <p className="text-gray-500">Form details cannot be loaded without a valid IRN.</p>
  )}
</section>

            {/* Section 2: Decision */}
            <section className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4 text-primary">Decision</h3>

              <div className="grid gap-4">
                <div className="flex items-center gap-6 flex-wrap">
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
                      checked={decision === 'KeepOnHold'}
                      onChange={() => setDecision('KeepOnHold')}
                    />
                    <span>Keep On Hold</span>
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
                      checked={decision === 'ForwardToTribunal'}
                      onChange={() => setDecision('ForwardToTribunal')}
                    />
                    <span>Forward To Tribunal</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Decision Reason</label>
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
                    disabled={!resolvedIRN || submitting}
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
              onClick={onCloseAll}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation popup */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Confirm</h3>
              <p className="text-gray-700 mb-4">{confirmText}</p>

              {decision !== 'KeepOnHold' ? (
                <div className={`flex justify-end gap-2 ${successMsg ? 'pointer-events-none opacity-60' : ''}`}>
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                    onClick={() => setConfirmOpen(false)}
                    disabled={submitting}
                  >
                    Back
                  </button>
                  <button
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-50"
                    onClick={handleProceed}
                    disabled={submitting}
                  >
                    {submitting ? 'Working…' : 'Proceed'}
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm"
                    onClick={() => setConfirmOpen(false)}
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Inline green success message */}
              {successMsg && (
                <div className="mt-4">
                  <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2 rounded-md">
                    {successMsg}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingTimebarredFormSubmissionRegistrarReview;
