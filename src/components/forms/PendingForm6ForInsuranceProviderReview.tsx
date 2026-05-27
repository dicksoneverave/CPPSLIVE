// src/components/forms/PendingForm6ForInsuranceProviderReview.tsx
import React, { useState, useEffect } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import Form124View from './Form124View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import ViewForm6 from './ViewForm6';

interface PendingForm6ForInsuranceProviderReviewProps {
  irn: string;
  incidentType: 'Injury' | 'Death';
  onClose: () => void;
	  onSuccess?: () => void; // add this
}

type Decision = 'Approved' | 'RejectCalc' | 'RejectOther';

const PendingForm6ForInsuranceProviderReview: React.FC<PendingForm6ForInsuranceProviderReviewProps> = ({
  irn,
  incidentType,
  onClose,
	 onSuccess,
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [validIRN, setValidIRN] = useState<number | null>(null);

  const handleSuccessOk = () => {
    onSuccess?.();   // ← notifies the list
    onClose();       // ← closes the detail modal
  };
	
  // printing
  const [printing, setPrinting] = useState(false);

  // NEW: decision UI state
  const [decision, setDecision] = useState<Decision>('Approved');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    const irnNumber = parseInt(irn, 10);
    if (isNaN(irnNumber)) {
      setError('Invalid IRN: must be a number');
      setLoading(false);
      return;
    }
    setValidIRN(irnNumber);
  }, [irn]);

  useEffect(() => {
    if (validIRN === null) return;

    const fetchFormData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Form 11/12 master (covers Injury/Death; filtered by incidentType)
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('*')
          .eq('IRN', validIRN)
          .eq('IncidentType', incidentType)
          .single();

        if (form1112Error) throw form1112Error;

        const { data: workerData, error: workerError } = await supabase
          .from('workerpersonaldetails')
          .select('*')
          .eq('WorkerID', form1112Data.WorkerID)
          .single();

        if (workerError) throw workerError;

        const { data: form6Data, error: form6Error } = await supabase
          .from('form6master')
          .select('*')
          .eq('IRN', validIRN)
          .eq('IncidentType', incidentType)
          .single();

        if (form6Error) throw form6Error;

        setFormData({
          ...form1112Data,
          ...workerData,
          ...form6Data,
        });
      } catch (err: any) {
        console.error('Error fetching notification data:', err);
        setError(err.message || 'Failed to load notification data');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [validIRN, incidentType]);

  const handlePrintForm6 = async () => {
    if (!validIRN) return;
    setPrinting(true);
    try {
      const mod = await import('../../utils/form6CPO_jspdf');
      const fn =
        (mod as any).printForm6 ||
        (mod as any).generateForm6Pdf ||
        (mod as any).default ||
        (mod as any).print;
      if (fn) await fn(validIRN);
    } finally {
      setPrinting(false);
    }
  };

  // ===== Helpers for DB lookups/updates =====
  const nowISO = () => new Date().toISOString();

  const getEmployerCPPSID = async (): Promise<string | null> => {
    // a) IRN -> WorkerID (workerirn view)
    const { data: wirn, error: wirnErr } = await supabase
      .from('workerirn')
      .select('WorkerID')
      .eq('IRN', validIRN)
      .maybeSingle();
    if (wirnErr) throw wirnErr;
    const workerId = wirn?.WorkerID;
    if (!workerId) return null;

    // b) WorkerID -> EmployerCPPSID (currentemploymentdetails)
    const { data: ced, error: cedErr } = await supabase
      .from('currentemploymentdetails')
      .select('EmployerCPPSID')
      .eq('WorkerID', workerId)
      .maybeSingle();
    if (cedErr) throw cedErr;
    return ced?.EmployerCPPSID ?? null;
  };

  const getOrganizationType = async (employerCPPSID: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('employermaster')
      .select('OrganizationType')
      .eq('CPPSID', employerCPPSID)
      .maybeSingle();
    if (error) throw error;
    return data?.OrganizationType ?? null;
  };

  // ===== Confirm & Save flow =====
  const openConfirm = () => {
    if (decision === 'Approved') {
      setConfirmMsg('Form18 notification will be sent to CPO.');
    } else if (decision === 'RejectCalc') {
      setConfirmMsg('The claim will be sent to CPO to recalculate.');
    } else {
      setConfirmMsg('The claim will be sent to Tribunal for Hearing.');
    }
    setConfirmOpen(true);
  };

  const proceedSave = async () => {
    if (!validIRN) return;
    setSaving(true);
    setConfirmOpen(false);
    try {
      if (decision === 'Approved') {
        const employerCPPSID = await getEmployerCPPSID();
        if (!employerCPPSID) throw new Error('Employer CPPSID not found for worker.');

        // Insert Form18 master
        const { error: f18Err } = await supabase.from('form18master').insert({
          EmployerCPPSID: employerCPPSID,
          IRN: validIRN,
          IncidentType: incidentType,
          F18MStatus: 'EmployerAccepted',
          F18MEmployerAcceptedDate: nowISO(),
          F18MEmployerDecisionReason: reason || null,
        });
        if (f18Err) throw f18Err;

        // Update Form6 master
        const { error: f6Err } = await supabase
          .from('form6master')
          .update({
            F6MStatus: 'CompensationAccepted',
            F6MApprovalDate: nowISO(),
          })
          .eq('IRN', validIRN);
        if (f6Err) throw f6Err;
      } else if (decision === 'RejectCalc') {
        // Update approvedclaimscporeview
        const { error: cporErr } = await supabase
          .from('approvedclaimscporeview')
          .update({
            CPORStatus: 'CompensationReCalculate',
            CPORSubmissionDate: nowISO(),
          })
          .eq('IRN', validIRN);
        if (cporErr) throw cporErr;
      } else if (decision === 'RejectOther') {
        const employerCPPSID = await getEmployerCPPSID();
        if (!employerCPPSID) throw new Error('Employer CPPSID not found for worker.');

        // Insert Form7 master
        const { error: f7Err } = await supabase.from('form7master').insert({
          EmployerCPPSID: employerCPPSID,
          IRN: validIRN,
          IncidentType: incidentType,
          F7MStatus: 'EmployerRejectedOtherReason',
          F7MEmployerRejectedDate: nowISO(),
          F7MEmployerDecisionReason: reason || null,
        });
        if (f7Err) throw f7Err;

        // Update Form6 master to reject-other
        const { error: f6Err } = await supabase
          .from('form6master')
          .update({
            F6MStatus: 'RejectOtherReason',
            F6MApprovalDate: nowISO(),
          })
          .eq('IRN', validIRN);
        if (f6Err) throw f6Err;

        // Insert tribunal hearing schedule
        const orgType = await getOrganizationType(employerCPPSID);
        const { error: thsErr } = await supabase.from('tribunalhearingschedule').insert({
          IRN: validIRN,
          THSSubmissionDate: nowISO(),
          THSSetForHearing: 'No',
          THSHearingStatus: 'HearingPending',
          THSHearingType: 'F7MEmployerRejectedOtherReason',
          THSOrganizationType: orgType || null,
        });
        if (thsErr) throw thsErr;
      }

      // Success popup
      setSuccessOpen(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to save decision');
    } finally {
      setSaving(false);
    }
  };

  const closeAllAfterSuccess = () => {
    setSuccessOpen(false);
    onClose(); // close this modal; parent can refresh/close list
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
          <div className="flex items-center text-red-600 mb-4">
            <AlertCircle className="h-6 w-6 mr-2" />
            <h3 className="text-lg font-semibold">Error</h3>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn bg-primary text-white hover:bg-primary-dark">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-700">Loading {incidentType.toLowerCase()} notification details...</p>
          </div>
        </div>
      </div>
    );
  }

  const headingSuffix =
    incidentType === 'Injury' ? 'Injury Notification' : 'Death Notification';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            Insurance Provider Response Pending {headingSuffix}
            {formData.DisplayIRN && (
              <span className="ml-2 text-sm font-normal text-gray-600">
                {formData.DisplayIRN}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* TOP SECTION: Embed Form 113 (Injury) or Form 124 (Death) */}
          <div className="border rounded-lg p-4" id="claim-details-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">
              {incidentType === 'Injury'
                ? 'Form 113 - Injury Claim Details'
                : 'Form 124 - Death Claim Details'}
            </h3>
            {incidentType === 'Injury' ? (
              <Form113View irn={validIRN?.toString() || ''} onClose={onClose} variant="embedded" />
            ) : (
              <Form124View irn={validIRN?.toString() || ''} onClose={onClose} variant="embedded" />
            )}
          </div>

          {/* Section: Form 6 - Notice to Employer */}
          <div className="border rounded-lg p-4" id="form6-section">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-primary">Form 6 - Notice to Employer</h3>
              <button
                onClick={handlePrintForm6}
                className="text-gray-500 hover:text-gray-700 p-1 mr-1 disabled:opacity-60"
                title={printing ? 'Generating…' : 'Download to PDF'}
                disabled={!validIRN || printing}
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
            <ViewForm6 irn={validIRN?.toString() || ''} />
          </div>

          {/* Section: Claim Decisions */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
            {validIRN ? (
              <ListClaimDecisions irn={validIRN.toString()} />
            ) : (
              <p className="text-textSecondary">Claim decisions cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section: Compensation Breakup */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
            {validIRN ? (
              <CompensationBreakupDetailsView
                IRN={validIRN.toString()}
                DisplayIRN={formData.DisplayIRN}
                IncidentType={incidentType}
              />
            ) : (
              <p className="text-textSecondary">Compensation data cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Bottom full-width download button */}
          <button
            onClick={handlePrintForm6}
            className="btn bg-primary text-white hover:bg-primary-dark mt-4 disabled:opacity-60"
            disabled={!validIRN || printing}
          >
            {printing ? 'Generating…' : 'Print Form6'}
          </button>

          {/* ============== NEW: DECISION SECTION ============== */}
          <div className="border rounded-lg p-4 mt-4">
            <h3 className="text-lg font-semibold text-primary mb-4">Action Taken</h3>

            <div className="flex flex-col md:flex-row md:items-center md:space-x-6 space-y-2 md:space-y-0 mb-4">
              <label className="inline-flex items-center space-x-2">
                <input
                  type="radio"
                  name="decision"
                  checked={decision === 'Approved'}
                  onChange={() => setDecision('Approved')}
                />
                <span>Approved</span>
              </label>

              <label className="inline-flex items-center space-x-2">
                <input
                  type="radio"
                  name="decision"
                  checked={decision === 'RejectCalc'}
                  onChange={() => setDecision('RejectCalc')}
                />
                <span>Reject - Disagree with Compensation Calculation</span>
              </label>

              <label className="inline-flex items-center space-x-2">
                <input
                  type="radio"
                  name="decision"
                  checked={decision === 'RejectOther'}
                  onChange={() => setDecision('RejectOther')}
                />
                <span>Reject - Disagree for Other Reasons</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                className="w-full border rounded p-2"
                rows={2}
                placeholder="Enter decision reason..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <button
              className="btn bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
              onClick={openConfirm}
              disabled={!validIRN || saving}
            >
              {saving ? 'Submitting…' : 'Submit'}
            </button>
          </div>
          {/* ============ END DECISION SECTION ============ */}
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Confirm</h3>
            <p className="text-gray-700 mb-6">{confirmMsg}</p>
            <div className="flex justify-end space-x-2">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
              >
                Back
              </button>
              <button
                className="btn bg-primary text-white hover:bg-primary-dark disabled:opacity-60"
                onClick={proceedSave}
                disabled={saving}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS POPUP (OK closes everything) */}
      {successOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-semibold mb-3 text-green-700">Successfully saved</h3>
            <button
              className="btn bg-primary text-white hover:bg-primary-dark mt-2"
              onClick={handleSuccessOk}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingForm6ForInsuranceProviderReview;
