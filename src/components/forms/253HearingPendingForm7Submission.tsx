import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import ViewForm7 from './ViewForm7';
import DocumentStatus from './DocumentStatus';

interface Form253Props {
  irn: string;
  onClose: () => void;
}

const Form253HearingPendingForm7Submission: React.FC<Form253Props> = ({ irn, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [validIRN, setValidIRN] = useState<number | null>(null);
  const [showDocumentStatus, setShowDocumentStatus] = useState(false);
  const [settingHearing, setSettingHearing] = useState(false);
  const [hearingMessage, setHearingMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const validateIRN = () => {
      const irnNumber = parseInt(irn, 10);
      if (isNaN(irnNumber)) {
        setError('Invalid IRN: must be a number');
        setLoading(false);
        return;
      }
      setValidIRN(irnNumber);
    };

    validateIRN();
  }, [irn]);

  useEffect(() => {
    if (validIRN === null) return;

    const fetchFormData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch form1112master data to get worker details
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('*')
          .eq('IRN', validIRN)
          .single();

        if (form1112Error) {
          throw form1112Error;
        }

        // Fetch worker personal details
        const { data: workerData, error: workerError } = await supabase
          .from('workerpersonaldetails')
          .select('*')
          .eq('WorkerID', form1112Data.WorkerID)
          .single();

        if (workerError) {
          throw workerError;
        }

console.log('WorkerID:',form1112Data.WorkerID);
        console.log('Injury Extent:',form1112Data.NatureExtentInjury);
        console.log('Region:',form1112Data.IncidentRegion);

        // Fetch worker currentemployment details
        const { data: currentEmploymentData, error: currentEmploymentError } = await supabase
          .from('currentemploymentdetails')
          .select('*')
          .eq('WorkerID', form1112Data.WorkerID)
          .single();

        if (currentEmploymentError) {
          throw currentEmploymentError;
        }


 // Fetch worker employer details
        const { data: workerEmployerData, error: workerEmployerError } = await supabase
          .from('employermaster')
          .select('*')
          .eq('CPPSID', currentEmploymentData.EmployerCPPSID)
          .single();

        if (workerEmployerError) {
          throw workerEmployerError;
        }
        console.log('CPPSID:',currentEmploymentData.EmployerCPPSID);
        console.log('Employer:',workerEmployerData.OrganizationName);
        
        // Fetch form7master data
        const { data: form7Data, error: form7Error } = await supabase
          .from('form7master')
          .select('*')
          .eq('IRN', validIRN)
          .single();

        if (form7Error) {
          throw form7Error;
        }

        setFormData({
          ...form1112Data,
          ...workerData,
          ...currentEmploymentData,
          ...workerEmployerData,
          ...form7Data
        });
      } catch (err: any) {
        console.error('Error fetching form data:', err);
        setError(err.message || 'Failed to load form data');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [validIRN]);

  const handleSetHearing = () => {
    if (!validIRN) return;
    setShowConfirmModal(true);
  };

  const confirmSetHearing = async () => {
    if (!validIRN) return;

    try {
      setSettingHearing(true);
      setHearingMessage(null);
      setShowConfirmModal(false);

      // 1. Update tribunalhearingschedule table
      const { error: updateError } = await supabase
        .from('tribunalhearingschedule')
        .update({
          THSSetForHearing: 'Scheduled',
          THSHearingStatus: 'HearingSet'
        })
        .eq('IRN', validIRN);

      if (updateError) {
        throw updateError;
      }

      // 2. Insert into tribunalhearingoutcome table
      const { error: insertError } = await supabase
        .from('tribunalhearingoutcome')
        .insert({
          THOIRN: validIRN,
          THORegion: formData.IncidentRegion,
          THONatureOfAccident: formData.NatureExtentInjury,
          THOEmployer: formData.OrganizationName
        });

      if (insertError) {
        throw insertError;
      }

      setHearingMessage('Hearing has been successfully set for this claim. This form will close in 5 seconds.');
      setIsSuccess(true);
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        onClose();
      }, 5000);
    } catch (err: any) {
      console.error('Error setting hearing:', err);
      setHearingMessage(`Failed to set hearing: ${err.message}`);
    } finally {
      setSettingHearing(false);
    }
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
            <p className="text-gray-700">Loading hearing details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            253 - Tribunal Hearing Pending Employer Rejected Form 7 Submission
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
          {/* Section 1: Form 7 - Notice to Registrar */}
          <div className="border rounded-lg p-4" id="form7-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 7 - Notice to Registrar</h3>
            <ViewForm7 irn={validIRN?.toString() || ''} incidentType={formData.IncidentType} onClose={onClose} />
          </div>

          {/* Section 2: Form 113 - Injury Claim Details */}
          <div className="border rounded-lg p-4" id="injuryclaims-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 113 - Injury Claim Details</h3>
            {validIRN ? (
              <Form113View irn={validIRN.toString()} onClose={onClose} />
            ) : (
              <p className="text-textSecondary">Injury claim details cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 3: Claim Decisions */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
            {validIRN ? (
              <ListClaimDecisions irn={validIRN} />
            ) : (
              <p className="text-textSecondary">Claim decisions cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 4: Compensation Breakup */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
            {validIRN ? (
              <CompensationBreakupDetailsView 
                IRN={validIRN.toString()} 
                DisplayIRN={formData.DisplayIRN} 
                IncidentType={formData.IncidentType || 'Injury'} 
              />
            ) : (
              <p className="text-textSecondary">Compensation data cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 5: Document Status */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Document Status</h3>
              <button
                onClick={() => setShowDocumentStatus(true)}
                className="btn bg-primary text-white hover:bg-primary-dark text-sm"
              >
                View Document Status
              </button>
            </div>
            <p className="text-textSecondary">Click the button above to view required and submitted documents for this claim.</p>
          </div>
        </div>
          {/* Section 6: Set Hearing */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Set Hearing</h3>
              <button
                onClick={handleSetHearing}
                disabled={settingHearing || isSuccess}
                className="btn bg-primary text-white hover:bg-primary-dark text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingHearing ? 'Setting...' : isSuccess ? 'Scheduled' : 'Set for Hearing'}
              </button>
            </div>
            <p className="text-textSecondary">Click the button above to schedule this claim for tribunal hearing.</p>
            {hearingMessage && (
              <div className={`mt-4 p-3 rounded-md text-sm ${
                hearingMessage.includes('Failed') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {hearingMessage}
              </div>
            )}
          </div>
      </div>

      {/* Document Status Modal */}
      {showDocumentStatus && validIRN && (
        <DocumentStatus
          irn={validIRN.toString()}
          incidentType={formData.IncidentType || 'Injury'}
          onClose={() => setShowDocumentStatus(false)}
        />
      )}
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full mb-4">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Confirm Scheduling
              </h3>
              <p className="text-sm text-gray-600 mb-8">
                This claim will be set for Hearing.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={confirmSetHearing}
                  className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary-dark transition-colors"
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

export default Form253HearingPendingForm7Submission;
