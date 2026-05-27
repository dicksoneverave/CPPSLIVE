import React, { useState, useEffect } from 'react';
    import { useAuth } from '../../context/AuthContext';
    import { useRouter } from 'next/router';
    import { supabase } from '../../services/supabase';
    import { toast } from 'react-toastify';

    interface Form18Data {
      id: string;
      claim_id: string;
      status: string;
      submission_date: string;
      worker_first_name: string;
      worker_last_name: string;
      employer_name: string;
      employer_address: string;
      compensation_amount: number;
      is_injury_case: boolean;
      is_processed: boolean;
    }

    const DecisionForm18WorkerReview: React.FC = () => {
      const { session, profile, loading } = useAuth();
      const router = useRouter();
      const [formData, setFormData] = useState<Form18Data | null>(null);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [errors, setErrors] = useState({
        action_taken: '',
        decision_reason: ''
      });
      const [actionTaken, setActionTaken] = useState<'Accept' | 'Reject' | ''>('');

      useEffect(() => {
        if (router.query?.claim_id) {
          const fetchFormData = async () => {
            try {
              // Fetch Form18 data
              const { data: form18Data, error: form18Error } = await supabase
                .from('form18master')
                .select('*')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (form18Error) {
                toast.error('Error loading Form18 data');
                return;
              }

              // Check if already processed
              if (form18Data.is_processed) {
                toast.error('This claim has already been processed');
                router.push('/dashboard');
                return;
              }

              // Get worker details from form1112master
              const { data: form1112Data, error: form1112Error } = await supabase
                .from('form1112master')
                .select('worker_first_name, worker_last_name')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (form1112Error) {
                toast.error('Error loading worker details');
                return;
              }

              // Get employer details from currentemploymentdetails
              const { data: employmentData, error: employmentError } = await supabase
                .from('currentemploymentdetails')
                .select('employer_name, employer_address')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (employmentError) {
                toast.error('Error loading employer details');
                return;
              }

              setFormData({
                ...form18Data,
                worker_first_name: form1112Data.worker_first_name,
                worker_last_name: form1112Data.worker_last_name,
                employer_name: employmentData.employer_name,
                employer_address: employmentData.employer_address
              });
            } catch (error) {
              toast.error('Error initializing claim review');
            }
          };

          fetchFormData();
        }
      }, [router.query, profile?.id]);

      const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        setActionTaken(value as 'Accept' | 'Reject' | '');
        setErrors(prev => ({ ...prev, [name]: '' }));
      };

      const validateForm = () => {
        const newErrors = { ...errors };
        let isValid = true;

        if (!actionTaken) {
          newErrors.action_taken = 'Please select an action';
          isValid = false;
        }

        if (actionTaken === 'Reject' && !formData?.decision_reason) {
          newErrors.decision_reason = 'Please provide a rejection reason';
          isValid = false;
        }

        setErrors(newErrors);
        return isValid;
      };

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData || !validateForm()) return;

        setIsSubmitting(true);

        try {
          if (actionTaken === 'Accept') {
            // Update Form18 status to WorkerAccepted
            const { error: updateError } = await supabase
              .from('form18master')
              .update({
                status: 'WorkerAccepted',
                is_processed: true,
                updated_at: new Date().toISOString()
              })
              .eq('claim_id', formData.claim_id);

            if (updateError) {
              throw updateError;
            }

            // Create record in ClaimsAwardedCommissionersReview
            const { error: insertError } = await supabase
              .from('claimsawardedcommissionersreview')
              .insert({
                claim_id: formData.claim_id,
                status: 'Pending',
                submission_date: new Date().toISOString()
              });

            if (insertError) {
              throw insertError;
            }

            toast.success('Claim accepted successfully. It will be reviewed by the commissioner.');
          } else if (actionTaken === 'Reject') {
            // Create Form17 record
            const { error: form17Error } = await supabase
              .from('form17master')
              .insert({
                claim_id: formData.claim_id,
                rejection_reason: formData.decision_reason,
                submission_date: new Date().toISOString()
              });

            if (form17Error) {
              throw form17Error;
            }

            // Update Form18 status to Rejected
            const { error: updateError } = await supabase
              .from('form18master')
              .update({
                status: 'Rejected',
                is_processed: true,
                updated_at: new Date().toISOString()
              })
              .eq('claim_id', formData.claim_id);

            if (updateError) {
              throw updateError;
            }

            toast.success('Claim rejected successfully. A Form17 record has been created.');
          }

          router.push('/dashboard');
        } catch (error: any) {
          toast.error('Error processing claim decision');
          console.error('Submission error:', error.message);
        } finally {
          setIsSubmitting(false);
        }
      };

      if (loading || !formData) {
        return (
          <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-primary">Form18 Worker Review</h1>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        );
      }

      // Handle different status scenarios
      if (formData.status === 'AlreadyWorkerAccepted') {
        return (
          <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-primary">Form18 Worker Review</h1>
            <div className="bg-success/10 border border-success/30 p-6 rounded-md">
              <h2 className="text-xl font-semibold mb-4 text-success">Claim Already Accepted</h2>
              <p className="text-textSecondary">
                This claim has already been accepted by the worker and is being processed by the commissioner.
              </p>
            </div>
          </div>
        );
      }

      if (formData.status === 'NotifiedToWorker') {
        return (
          <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-primary">Form18 Worker Review</h1>
            <div className="bg-surface-dark p-6 rounded-md mb-8">
              <h2 className="text-xl font-semibold mb-4 text-textSecondary">Claim Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-textSecondary mb-2">Worker Name:</p>
                  <p className="text-white font-medium">{formData.worker_first_name} {formData.worker_last_name}</p>
                </div>
                <div>
                  <p className="text-textSecondary mb-2">Employer Name:</p>
                  <p className="text-white font-medium">{formData.employer_name}</p>
                </div>
                <div>
                  <p className="text-textSecondary mb-2">Employer Address:</p>
                  <p className="text-white font-medium">{formData.employer_address}</p>
                </div>
                <div>
                  <p className="text-textSecondary mb-2">Submission Date:</p>
                  <p className="text-white font-medium">{new Date(formData.submission_date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Your Decision
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="action_taken"
                      value="Accept"
                      checked={actionTaken === 'Accept'}
                      onChange={handleInputChange}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-textSecondary">Accept</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="action_taken"
                      value="Reject"
                      checked={actionTaken === 'Reject'}
                      onChange={handleInputChange}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-textSecondary">Reject</span>
                  </label>
                </div>
                {errors.action_taken && (
                  <p className="mt-1 text-sm text-error">{errors.action_taken}</p>
                )}
              </div>

              {actionTaken === 'Reject' && (
                <div className="mb-4">
                  <label htmlFor="decision_reason" className="block text-sm font-medium text-textSecondary">
                    Rejection Reason
                  </label>
                  <textarea
                    id="decision_reason"
                    name="decision_reason"
                    value={formData.decision_reason || ''}
                    onChange={(e) => setFormData({ ...formData, decision_reason: e.target.value })}
                    required
                    rows={4}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-surface text-textSecondary"
                    placeholder="Please provide a detailed rejection reason..."
                  />
                  {errors.decision_reason && (
                    <p className="mt-1 text-sm text-error">{errors.decision_reason}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3 px-4 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
              >
                {isSubmitting ? 'Processing...' : 'Submit Decision'}
              </button>
            </form>

            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-textSecondary">Attachments</h2>
              <div className="bg-surface p-4 rounded-md">
                <p className="text-textSecondary mb-2">Current Attachments:</p>
                <ul className="list-disc list-inside text-textSecondary">
                  <li>Form 1112 - Worker Injury Report</li>
                  <li>Medical Assessment Report</li>
                  <li>Employer Statement</li>
                  <li>Compensation Calculation Details</li>
                </ul>
              </div>
            </div>
          </div>
        );
      }

      // Default case - EmployerAccepted but not yet sent to worker
      return (
        <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-primary">Form18 Worker Review</h1>
          
          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Claim Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-textSecondary mb-2">Worker Name:</p>
                <p className="text-white font-medium">{formData.worker_first_name} {formData.worker_last_name}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Employer Name:</p>
                <p className="text-white font-medium">{formData.employer_name}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Employer Address:</p>
                <p className="text-white font-medium">{formData.employer_address}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Submission Date:</p>
                <p className="text-white font-medium">{new Date(formData.submission_date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Compensation Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-textSecondary mb-2">Compensation Amount:</p>
                <p className="text-success font-bold text-2xl">₹{formData.compensation_amount.toLocaleString()}</p>
              </div>
              {formData.is_injury_case && (
                <div>
                  <p className="text-textSecondary mb-2">Injury Case:</p>
                  <p className="text-accent font-bold">Yes</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Next Steps</h2>
            <p className="text-textSecondary mb-4">
              This claim has been accepted by the employer and is now available for your review.
            </p>
            <button
              onClick={() => setActionTaken('Accept')}
              className="w-full bg-primary text-white py-3 px-4 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
            >
              Accept Claim
            </button>
            <button
              onClick={() => setActionTaken('Reject')}
              className="w-full bg-primary text-white py-3 px-4 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200 mt-4"
            >
              Reject Claim
            </button>
          </div>

          {actionTaken && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Your Decision
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="action_taken"
                      value="Accept"
                      checked={actionTaken === 'Accept'}
                      onChange={handleInputChange}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-textSecondary">Accept</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="action_taken"
                      value="Reject"
                      checked={actionTaken === 'Reject'}
                      onChange={handleInputChange}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-textSecondary">Reject</span>
                  </label>
                </div>
                {errors.action_taken && (
                  <p className="mt-1 text-sm text-error">{errors.action_taken}</p>
                )}
              </div>

              {actionTaken === 'Reject' && (
                <div className="mb-4">
                  <label htmlFor="decision_reason" className="block text-sm font-medium text-textSecondary">
                    Rejection Reason
                  </label>
                  <textarea
                    id="decision_reason"
                    name="decision_reason"
                    value={formData.decision_reason || ''}
                    onChange={(e) => setFormData({ ...formData, decision_reason: e.target.value })}
                    required
                    rows={4}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-surface text-textSecondary"
                    placeholder="Please provide a detailed rejection reason..."
                  />
                  {errors.decision_reason && (
                    <p className="mt-1 text-sm text-error">{errors.decision_reason}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3 px-4 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
              >
                {isSubmitting ? 'Processing...' : 'Submit Decision'}
              </button>
            </form>
          )}

          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Attachments</h2>
            <div className="bg-surface p-4 rounded-md">
              <p className="text-textSecondary mb-2">Current Attachments:</p>
              <ul className="list-disc list-inside text-textSecondary">
                <li>Form 1112 - Worker Injury Report</li>
                <li>Medical Assessment Report</li>
                <li>Employer Statement</li>
                <li>Compensation Calculation Details</li>
              </ul>
            </div>
          </div>
        </div>
      );
    };

    export default DecisionForm18WorkerReview;
