// src/components/forms/PendingForm18WorkerResponseToNotification.tsx
import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import Form124View from './Form124View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import ViewForm6 from './ViewForm18';

interface PendingForm18WorkerResponseToNotificationProps {
  irn: string;
  incidentType: 'Injury' | 'Death';
  onClose: () => void;
  onSuccess?: () => void; // add this
}

type Decision = 'Accept' | 'Reject';

const PendingForm18WorkerResponseToNotification: React.FC<PendingForm18WorkerResponseToNotificationProps> = ({
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

  // printing (kept for the small icon button in Form 6 section)
  
  // NEW: decision UI state
  const [decision, setDecision] = useState<Decision>('Accept');
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('Successfully saved');

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

        const { data: form18Data, error: form18Error } = await supabase
          .from('form18master')
          .select('*')
          .eq('IRN', validIRN)
          .eq('IncidentType', incidentType)
          .single();

        if (form18Error) throw form18Error;

        setFormData({
          ...form1112Data,
          ...workerData,
          ...form18Data,
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

  // ===== Helpers for DB lookups/updates =====
  const nowISO = () => new Date().toISOString();

  // Per new requirement: get EmployerCPPSID from form18master using IRN
  const getEmployerCPPSIDFromF18 = async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('form18master')
      .select('EmployerCPPSID')
      .eq('IRN', validIRN)
      .maybeSingle();
    if (error) throw error;
    return data?.EmployerCPPSID ?? null;
  };

  const getOrganizationType = async (employerCPPSID: string): Promise<'State' | 'Private' | null> => {
    const { data, error } = await supabase
      .from('employermaster')
      .select('OrganizationType')
      .eq('CPPSID', employerCPPSID)
      .maybeSingle();
    if (error) throw error;
    return (data?.OrganizationType as 'State' | 'Private' | undefined) ?? null;
  };

  // ===== Confirm & Save flow =====
  const openConfirm = () => {
    if (decision === 'Accept') {
      setConfirmMsg('Claim will be forwarded to the Commissioner(s) for Review.');
    } else {
      setConfirmMsg('The claim will be set for Tribunal Hearing.');
    }
    setConfirmOpen(true);
  };

  const proceedSave = async () => {
    if (!validIRN) return;
    setSaving(true);
    setConfirmOpen(false);
    try {
      if (decision === 'Accept') {
        // Accept path
        const employerCPPSID = await getEmployerCPPSIDFromF18();
        if (!employerCPPSID) throw new Error('Employer CPPSID not found (Form 18).');

        const orgType = await getOrganizationType(employerCPPSID);
        if (!orgType) throw new Error('OrganizationType not found for employer.');

        const reviewStatus = orgType === 'State' ? 'CommissionerReviewPending' : 'ChiefCommissionerReviewPending';

const claimType =
  orgType === 'State' ? 'StateInsured'
  : orgType === 'Private' ? 'PrivateInsured'
  : orgType;

				
        // Insert into claimsawardedcommissionersreview
        const { error: cacrErr } = await supabase.from('claimsawardedcommissionersreview').insert({
          IRN: validIRN,
          ClaimType: claimType, // State or Private
          CACRReviewStatus: reviewStatus,
          CACRSubmissionDate: nowISO(),
					 IncidentType: incidentType, // ← add this line
        });
        if (cacrErr) throw cacrErr;

        // Update Form18 master
        const { error: f18UpdateErr } = await supabase
          .from('form18master')
          .update({
            F18MStatus: 'WorkerAccepted',
            F18MWorkerAcceptedDate: nowISO(),
            F18MWorkerDecisionReason: reason || null,
          })
          .eq('IRN', validIRN);
        if (f18UpdateErr) throw f18UpdateErr;

        setSuccessMsg('Claim has been forwarded to the Commissioner(s) for Review');
      } else if (decision === 'Reject') {
        // Reject path
        const employerCPPSID = await getEmployerCPPSIDFromF18();
        if (!employerCPPSID) throw new Error('Employer CPPSID not found (Form 18).');

        // Insert into form17master
        const { error: f17InsertErr } = await supabase.from('form17master').insert({
          IRN: validIRN,
          IncidentType: incidentType,
          F17MStatus: 'WorkerRejected',
          F17MWorkerRejectedDate: nowISO(),
          F17MWorkerDecisionReason: reason || null,
        });
        if (f17InsertErr) throw f17InsertErr;

        // Update form18master status
        const { error: f18RejectErr } = await supabase
          .from('form18master')
          .update({
            F18MStatus: 'WorkerRejected',
          })
          .eq('IRN', validIRN);
        if (f18RejectErr) throw f18RejectErr;

        // Create tribunal hearing schedule entry
        const orgType = await getOrganizationType(employerCPPSID);
        const { error: thsErr } = await supabase.from('tribunalhearingschedule').insert({
          IRN: validIRN,
          THSSubmissionDate: nowISO(),
          THSSetForHearing: 'No',
          THSHearingStatus: 'HearingPending',
          THSHearingType: 'F17MWorkerRejected',
          THSOrganizationType: orgType ?? null,
        });
        if (thsErr) throw thsErr;

        setSuccessMsg('Claim has been rejected and set for Tribunal Hearing');
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

  const headingSuffix = incidentType === 'Injury' ? 'Injury Notification' : 'Death Notification';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            Worker Reponse to Form18 Notification {headingSuffix}
            {formData.DisplayIRN && (
              <span className="ml-2 text-sm font-normal text-gray-600">{formData.DisplayIRN}</span>
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
              {incidentType === 'Injury' ? 'Form 113 - Injury Claim Details' : 'Form 124 - Death Claim Details'}
            </h3>
            {incidentType === 'Injury' ? (
              <Form113View irn={validIRN?.toString() || ''} onClose={onClose} />
            ) : (
              <Form124View irn={validIRN?.toString() || ''} onClose={onClose} />
            )}
          </div>

          {/* Section: Form 6 - Notice to Employer */}
          <div className="border rounded-lg p-4" id="form6-section">
            <h3 className="text-lg font-semibold text-primary mb-2">Form 6 - Notice to Employer</h3>
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

          {/* NOTE: The bottom full-width "Print Form6" button has been removed as requested */}

          {/* ============== NEW: DECISION SECTION ============== */}
          <div className="border rounded-lg p-4 mt-4">
            <h3 className="text-lg font-semibold text-primary mb-4">Decision</h3>

            <div className="flex flex-col md:flex-row md:items-center md:space-x-6 space-y-2 md:space-y-0 mb-4">
              <label className="inline-flex items-center space-x-2">
                <input
                  type="radio"
                  name="decision"
                  checked={decision === 'Accept'}
                  onChange={() => setDecision('Accept')}
                />
                <span>Accept</span>
              </label>

              <label className="inline-flex items-center space-x-2">
                <input
                  type="radio"
                  name="decision"
                  checked={decision === 'Reject'}
                  onChange={() => setDecision('Reject')}
                />
                <span>Reject</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Decision Reason</label>
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
            <h3 className="text-lg font-semibold mb-3 text-green-700">{successMsg}</h3>
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

export default PendingForm18WorkerResponseToNotification;
