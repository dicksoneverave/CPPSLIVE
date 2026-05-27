// /src/components/forms/328PendingCompensationCalculationCPMReviewInjury.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';

// Props
interface Form328PendingCompensationCalculationCPMReviewInjuryProps {
  IRN?: string;            // preferred prop name
  irn?: string;            // still supported
  onCloseAll?: (refresh?: boolean) => void; // 👈 changed
}

type Decision = 'Approved' | 'ReCheck' | 'Reject';

const Form328PendingCompensationCalculationCPMReviewInjury: React.FC<Form328PendingCompensationCalculationCPMReviewInjuryProps> = ({
  IRN,
  irn,
  onCloseAll,
}) => {
  const { profile } = useAuth();
  const resolvedIRN = useMemo(() => (IRN ?? irn ?? '').toString(), [IRN, irn]);
const [displayIRN, setDisplayIRN] = useState<string>('');

  // UI state
  const [decision, setDecision] = useState<Decision>('Approved'); // default Approved
  const [reason, setReason] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

useEffect(() => {
  (async () => {
    if (!resolvedIRN) return;
    const { data, error } = await supabase
      .from('workerirn')
      .select('DisplayIRN')
      .eq('IRN', resolvedIRN)
      .maybeSingle();
    if (!error && data?.DisplayIRN) setDisplayIRN(String(data.DisplayIRN));
  })();
}, [resolvedIRN]);

	
  // Print Form 6
  const handlePrintForm6 = async () => {
    if (!resolvedIRN) return;
    try {
      const mod = await import('../../utils/form6CPO_jspdf');
      const fn = (mod as any).default ?? (mod as any).printForm6CPO ?? (mod as any).generateForm6;
      if (typeof fn === 'function') {
        await fn(resolvedIRN);
      } else {
        alert('Form 6 printer is not available.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate Form 6.');
    }
  };

  // --- Helpers for DB ops ---

  // 1) IRN -> WorkerID (from workerirn view)
  const fetchWorkerIdByIRN = async (irnStr: string): Promise<number | null> => {
    const { data, error } = await supabase
      .from('workerirn') // view
      .select('WorkerID')
      .eq('IRN', irnStr)
      .maybeSingle();
    if (error) {
      console.error('workerirn error:', error);
      return null;
    }
    return data?.WorkerID ?? null;
  };

  // 2) WorkerID -> EmployerCPPSID (from currentemploymentdetails)
  const fetchEmployerCPPSIDByWorker = async (workerId: number): Promise<string | null> => {
    const { data, error } = await supabase
      .from('currentemploymentdetails')
      .select('EmployerCPPSID')
      .eq('WorkerID', workerId)
      .order('CEDID', { ascending: false }) // if multiple rows, take latest
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('currentemploymentdetails error:', error);
      return null;
    }
    return (data?.EmployerCPPSID ?? null) as string | null;
  };

  // 3) Upsert into form6master for this IRN
  const upsertForm6Master = async (irnStr: string, employerCPPSID: string | null) => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // does a record already exist?
    const { data: existing, error: existErr } = await supabase
      .from('form6master')
      .select('F6MID')
      .eq('IRN', irnStr)
      .maybeSingle();
    if (existErr) throw existErr;

    const payload: any = {
      IRN: irnStr,
      IncidentType: 'Injury',
      F6MStatus: 'Pending',
      F6MApprovalDate: today,
      EmployerCPPSID: employerCPPSID ?? null,
      // If you want to store who triggered it:
      // CPOInCharge: profile?.id ?? null
    };

    if (existing?.F6MID) {
      const { error: updErr } = await supabase
        .from('form6master')
        .update(payload)
        .eq('F6MID', existing.F6MID);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from('form6master').insert([payload]);
      if (insErr) throw insErr;
    }
  };

  // Confirmation text per spec
  const confirmText =
    decision === 'Approved'
      ? 'Form6 notification will be sent to employer/insurance company.'
      : decision === 'ReCheck'
      ? 'The claim status will be set as Recheck. It will be forwarded to Claims Processing OFficer.'
      : 'The claim will be set as Rejected. Will remain in the Rejected basket.';

  const handleSubmitClick = () => setConfirmOpen(true);

  const handleProceed = async () => {
    if (!resolvedIRN) return;
    setSubmitting(true);
    setConfirmOpen(false);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
      // Common update for compensationcalculationcpmreview
      if (decision === 'Approved') {
        // 1) Update CPM review
        const { error: upd1 } = await supabase
          .from('compensationcalculationcpmreview')
          .update({
            CPMRStatus: 'Accepted',
            CPMRDecisionDate: today,
            CPMRDecisionReason: reason || null,
          })
          .eq('IRN', resolvedIRN);
        if (upd1) throw upd1;

        // 2) Build Form6 master row
        const workerId = await fetchWorkerIdByIRN(resolvedIRN);
        const employerCPPSID = workerId ? await fetchEmployerCPPSIDByWorker(workerId) : null;

        await upsertForm6Master(resolvedIRN, employerCPPSID);

        // Done → back to dashboard
        onCloseAll?.(true);
        return;
      }

      if (decision === 'ReCheck') {
        // 1) Update CPM review
        const { error: upd1 } = await supabase
          .from('compensationcalculationcpmreview')
          .update({
            CPMRStatus: 'Recheck',
            CPMRDecisionDate: today,
            CPMRDecisionReason: reason || null,
          })
          .eq('IRN', resolvedIRN);
        if (upd1) throw upd1;

        // 2) Update CPOR status in approvedclaimscporeview
        const { error: upd2 } = await supabase
          .from('approvedclaimscporeview')
          .update({ CPORStatus: 'CompensationReCalculate' })
          .eq('IRN', resolvedIRN);
        if (upd2) throw upd2;

        onCloseAll?.(true);
        return;
      }

      if (decision === 'Reject') {
        // Update CPM review only
        const { error: upd1 } = await supabase
          .from('compensationcalculationcpmreview')
          .update({
            CPMRStatus: 'Rejected',
            CPMRDecisionDate: today,
            CPMRDecisionReason: reason || null,
          })
          .eq('IRN', resolvedIRN);
        if (upd1) throw upd1;

        onCloseAll?.(true);
        return;
      }
    } catch (e) {
      console.error('Decision processing failed:', e);
      alert('Failed to process decision. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => setConfirmOpen(false);
  const handleClose = () => onCloseAll?.(false);


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
                Compensation Calculation — CPM Review (Injury)
              </h2>
              {resolvedIRN && (
                <span className="text-sm text-gray-600">CRN: {displayIRN}</span>
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
            {/* 113 */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Form 113 — Injury Claim Detail</h3>
              {resolvedIRN ? (
                <Form113View irn={resolvedIRN} onClose={handleClose} />
              ) : (
                <p className="text-gray-500">Injury claim details cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Decisions list */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
              {resolvedIRN ? (
                <ListClaimDecisions irn={resolvedIRN} />
              ) : (
                <p className="text-gray-500">Claim decisions cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Compensation breakup */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
              {resolvedIRN ? (
                <CompensationBreakupDetailsView IRN={resolvedIRN} IncidentType="Injury" />
              ) : (
                <p className="text-gray-500">Compensation data cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Print Form 6 */}
            <section className="border rounded-lg p-4 bg-amber-50">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  className="px-3 py-1.5 border border-primary text-primary hover:bg-primary/5 rounded-md"
                  onClick={handlePrintForm6}
                >
                  Print Form 6
                </button>
              </div>
            </section>

            {/* Decision section (NEW) */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Decision — CPM Review</h3>

              <div className="flex items-center gap-6 mb-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    value="Approved"
                    checked={decision === 'Approved'}
                    onChange={() => setDecision('Approved')}
                  />
                  <span>Approved</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    value="ReCheck"
                    checked={decision === 'ReCheck'}
                    onChange={() => setDecision('ReCheck')}
                  />
                  <span>ReCheck</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    value="Reject"
                    checked={decision === 'Reject'}
                    onChange={() => setDecision('Reject')}
                  />
                  <span>Reject</span>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Decision Reason
                </label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm"
                  rows={2}
                  placeholder="Enter reason..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-60"
                  onClick={handleSubmitClick}
                  disabled={submitting || !resolvedIRN}
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
                  onClick={handleBack}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-60"
                  onClick={handleProceed}
                  disabled={submitting}
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

export default Form328PendingCompensationCalculationCPMReviewInjury;
