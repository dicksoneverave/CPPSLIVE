import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import DocumentStatus from './DocumentStatus';

interface Form238Props {
  irn: string;
  hearingType: string;
  onClose: () => void;
}

const Form238HearingForm11SubmissionPrivate: React.FC<Form238Props> = ({ irn, hearingType, onClose }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [validIRN, setValidIRN] = useState<number | null>(null);
  const [showDocumentStatus, setShowDocumentStatus] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [hearingDecision, setHearingDecision] = useState({
    decision: '',
    details: '',
    proposedAmount: '0',
    confirmedAmount: '0',
    actionOfficer: ''
  });

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

 // Fetch user full name from owcstaffmaster
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('owcstaffmaster')
        .select('OSMFirstName, OSMLastName')
        .eq('cppsid', profile.id)
        .maybeSingle();

      if (data) {
        const fullName = `${data.OSMFirstName} ${data.OSMLastName}`;
        setHearingDecision(prev => ({
          ...prev,
          actionOfficer: fullName
        }));
      } else {
        console.warn('No matching staff profile found. Falling back to profile.full_name');
        const fallback = profile?.full_name || '';
        setHearingDecision(prev => ({
          ...prev,
          actionOfficer: fallback
        }));
      }

      if (error) {
        console.error('Error fetching user info:', error);
      }
    };

    fetchUserDetails();
  }, [profile?.id]);

  
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
          .eq('IncidentType', 'Injury')
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

        setFormData({
          ...form1112Data,
          ...workerData
        });

        // Set action officer to current user's name
        if (profile?.full_name) {
          setHearingDecision(prev => ({
            ...prev,
            actionOfficer: profile.full_name || ''
          }));
        }
      } catch (err: any) {
        console.error('Error fetching form data:', err);
        setError(err.message || 'Failed to load form data');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [validIRN, profile?.full_name]);

  // Auto-close form after 5 seconds on successful submission
  useEffect(() => {
    if (decisionMessage?.includes('Decision submitted successfully.')) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [decisionMessage, onClose]);


  const handleSubmitDecision = async () => {
    if (!validIRN) return;

    // Validate required fields
    if (!hearingDecision.decision || !hearingDecision.details) {
      setDecisionMessage('Please fill in all required fields.');
      return;
    }

    setShowSummary(true);
  };

  const handleConfirmCommit = async () => {
    try {
      setShowSummary(false);
      setSubmittingDecision(true);
      setDecisionMessage(null);

      // Update tribunalhearingoutcome table
      const { error: updateError } = await supabase
        .from('tribunalhearingoutcome')
        .update({
          THODecision: hearingDecision.decision,
          THOReason: hearingDecision.details,
          THODOA: new Date().toISOString(),
          THOClaimant: `${formData.WorkerFirstName} ${formData.WorkerLastName}`,
          THOActionOfficer: hearingDecision.actionOfficer,
          THOProposedAmount: hearingDecision.proposedAmount,
          THOConfirmedAmount: hearingDecision.confirmedAmount,
          THOHearingStatus: 'Processed'
        })
        .eq('THOIRN', validIRN);

      if (updateError) {
        throw updateError;
      }

      // Also update the schedule table to 'Processed' to remove from active list
      const { error: scheduleError } = await supabase
        .from('tribunalhearingschedule')
        .update({ THSSetForHearing: 'Processed' })
        .eq('IRN', validIRN);

      if (scheduleError) {
        throw scheduleError;
      }

      if (hearingDecision.decision === 'Adjourned') {
        const { error: cpoError } = await supabase
          .from('approvedclaimscporeview')
          .update({
            CPORStatus: 'DocumentationPending',
            CPORSubmissionDate: new Date().toISOString(),
            LockedByCPOID: '0'
          })
          .eq('IRN', validIRN);
        
        if (cpoError) {
          console.error('Error updating CPO review:', cpoError);
        }
        setDecisionMessage('Decision submitted successfully.\nClaim will be forwarded to CPO for review/recalculation');
      } else if (hearingDecision.decision === 'Approved') {
        if (hearingType === 'Form6StateSolicitorSumbission' || hearingType === 'Form7EmployerRejectedOtherReason') {
          // Fetch EmployerCPPSID
          const { data: employmentData, error: employmentError } = await supabase
            .from('currentemploymentdetails')
            .select('EmployerCPPSID')
            .eq('WorkerID', formData.WorkerID)
            .maybeSingle();

          if (employmentError) {
            console.error('Error fetching employment details:', employmentError);
          }

          // Insert into form18master
          const { error: f18Error } = await supabase
            .from('form18master')
            .insert({
              IRN: validIRN,
              EmployerCPPSID: employmentData?.EmployerCPPSID || 'EmployerNotFound',
              IncidentType: formData.IncidentType,
              F18MStatus: 'EmployerAccepted',
              F18MEmployerAcceptedDate: new Date().toISOString(),
              F18MEmployerDecisionReason: hearingDecision.details
            });

          if (f18Error) {
            console.error('Error creating form18master record:', f18Error);
          }
        } else if (hearingType?.includes('TimeBarred')) {
          // Update timebarredclaimsregistrarreview
          const { error: tbError } = await supabase
            .from('timebarredclaimsregistrarreview')
            .update({
              TBCRRReviewStatus: 'Approved',
              TBCRRDecisionDate: new Date().toISOString(),
              TBCRRDecisionReason: hearingDecision.details
            })
            .eq('IRN', validIRN);

          if (tbError) {
            console.error('Error updating Time Barred review:', tbError);
          }
        }
        
        setDecisionMessage('Decision submitted successfully.');
      } else {
        setDecisionMessage('Decision submitted successfully.');
      }
    } catch (err: any) {
      console.error('Error submitting decision:', err);
      setDecisionMessage(`Failed to submit decision: ${err.message}`);
    } finally {
      setSubmittingDecision(false);
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
            238 - Tribunal Hearing Timebarred Form 11 Submission
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
          {/* Section 1: Form 113 - Injury Claim Details */}
          <div className="border rounded-lg p-4" id="deathclaims-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 113 - Injury Claim Details</h3>
            {validIRN ? (
              <Form113View irn={validIRN.toString()} onClose={onClose} />
            ) : (
              <p className="text-textSecondary">Injury claim details cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 2: Claim Decisions */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
            {validIRN ? (
              <ListClaimDecisions irn={validIRN} />
            ) : (
              <p className="text-textSecondary">Claim decisions cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 3: Compensation Breakup */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
            {validIRN ? (
              <CompensationBreakupDetailsView 
                IRN={validIRN.toString()} 
                DisplayIRN={formData.DisplayIRN} 
                IncidentType="Death" 
              />
            ) : (
              <p className="text-textSecondary">Compensation data cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 4: Document Status */}
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

          {/* Section 6: Hearing Decision */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Hearing Decision</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="decision" className="block text-sm font-medium text-gray-700 mb-1">
                  Decision <span className="text-red-500">*</span>
                </label>
                <select
                  id="decision"
                  value={hearingDecision.decision}
                  onChange={(e) => setHearingDecision(prev => ({ ...prev, decision: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Select Decision</option>
                  <option value="Approved">Approved</option>
                  <option value="Adjourned">Adjourned</option>
                  <option value="Dismissed">Dismissed</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="actionOfficer" className="block text-sm font-medium text-gray-700 mb-1">
                  Action Officer
                </label>
                <input
                  type="text"
                  id="actionOfficer"
                  value={hearingDecision.actionOfficer}
                  onChange={(e) => setHearingDecision(prev => ({ ...prev, actionOfficer: e.target.value }))}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="proposedAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Proposed Amount
                </label>
                <input
                  type="number"
                  id="proposedAmount"
                  min="0"
                  value={hearingDecision.proposedAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '' && parseFloat(val) < 0) return;
                    setHearingDecision(prev => ({ ...prev, proposedAmount: val }));
                  }}
                  className="input"
                  placeholder="Enter proposed amount"
                />
              </div>
              
              <div>
                <label htmlFor="confirmedAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmed Amount
                </label>
                <input
                  type="number"
                  id="confirmedAmount"
                  min="0"
                  value={hearingDecision.confirmedAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '' && parseFloat(val) < 0) return;
                    setHearingDecision(prev => ({ ...prev, confirmedAmount: val }));
                  }}
                  className="input"
                  placeholder="Enter confirmed amount"
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">
                Details <span className="text-red-500">*</span>
              </label>
              <textarea
                id="details"
                value={hearingDecision.details}
                onChange={(e) => setHearingDecision(prev => ({ ...prev, details: e.target.value }))}
                className="input"
                rows={4}
                placeholder="Enter decision details"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={decisionMessage?.includes('Decision submitted successfully.') ? onClose : handleSubmitDecision}
                disabled={submittingDecision}
                className={`btn ${decisionMessage?.includes('Decision submitted successfully.') ? 'bg-gray-600 hover:bg-gray-700' : 'bg-primary hover:bg-primary-dark'} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {submittingDecision ? 'Submitting...' : (decisionMessage?.includes('Decision submitted successfully.') ? 'Close' : 'Submit Decision')}
              </button>
            </div>

            {decisionMessage && (
              <div className={`mt-4 p-3 rounded-md text-sm whitespace-pre-line ${
                decisionMessage.includes('Failed') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {decisionMessage}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Document Status Modal */}
      {showDocumentStatus && validIRN && (
        <DocumentStatus
          irn={validIRN.toString()}
          incidentType="Injury"
          onClose={() => setShowDocumentStatus(false)}
        />
      )}

      {/* Decision Summary Popup */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="bg-primary px-6 py-4">
              <h3 className="text-xl font-bold text-white">Decision Summary</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 border-b pb-2">
                <span className="text-sm font-semibold text-gray-500 uppercase">Decision:</span>
                <span className="col-span-2 text-gray-900 font-medium">{hearingDecision.decision}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-b pb-2">
                <span className="text-sm font-semibold text-gray-500 uppercase">Action Officer:</span>
                <span className="col-span-2 text-gray-900">{hearingDecision.actionOfficer || '--'}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-b pb-2">
                <span className="text-sm font-semibold text-gray-500 uppercase">Proposed Amount:</span>
                <span className="col-span-2 text-gray-900 font-mono">K {parseFloat(hearingDecision.proposedAmount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-b pb-2">
                <span className="text-sm font-semibold text-gray-500 uppercase">Confirmed Amount:</span>
                <span className="col-span-2 text-gray-900 font-mono">K {parseFloat(hearingDecision.confirmedAmount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div className="space-y-1">
                <span className="text-sm font-semibold text-gray-500 uppercase">Details:</span>
                <div className="bg-gray-50 p-3 rounded-md border text-sm text-gray-700 max-h-32 overflow-y-auto italic">
                  {hearingDecision.details}
                </div>
              </div>
              
              {hearingDecision.decision === 'Adjourned' && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    <strong>Note:</strong> This claim will be forwarded to CPO for review/recalculation.
                  </p>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowSummary(false)}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirmCommit}
                className="px-5 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark shadow-md transition-all active:scale-95"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Form238HearingForm11SubmissionPrivate;
