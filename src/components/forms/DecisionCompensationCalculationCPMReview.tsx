import React, { useState, useEffect } from 'react';
    import { useAuth } from '../../context/AuthContext';
    import { useRouter } from 'next/router';
    import { PDFDocument, StandardFonts } from 'pdf-lib';
    import { supabase } from '../../services/supabase';
    import { toast } from 'react-toastify';

    interface ReviewData {
      id: string;
      claim_id: string;
      submission_date: string;
      form_type: string;
      pr_id: string;
      worker_first_name: string;
      worker_last_name: string;
      action_taken: string;
      decision_reason?: string;
      reviewer_id: string;
      review_date: string;
      status_history: string;
      is_processed: boolean;
    }

    const DecisionCompensationCalculationCPMReview: React.FC = () => {
      const { session, profile, group, loading } = useAuth();
      const router = useRouter();
      const [formData, setFormData] = useState<ReviewData>({
        id: '',
        claim_id: '',
        submission_date: '',
        form_type: '',
        pr_id: '',
        worker_first_name: '',
        worker_last_name: '',
        action_taken: '',
        decision_reason: '',
        reviewer_id: profile?.id || '',
        review_date: new Date().toISOString(),
        status_history: JSON.stringify([{ status: 'Pending', timestamp: new Date().toISOString() }]),
        is_processed: false
      });
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [errors, setErrors] = useState({
        claim_id: '',
        action_taken: '',
        decision_reason: ''
      });

      useEffect(() => {
        if (router.query?.claim_id) {
          const fetchFormData = async () => {
            try {
              // Fetch claim data from form1112master
              const { data: form1112Data, error: form1112Error } = await supabase
                .from('form1112master')
                .select('*')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (form1112Error) {
                toast.error('Error loading form data');
                return;
              }

              // Check if already processed
              const { data: processedData, error: processedError } = await supabase
                .from('compensationcalculationcpmreview')
                .select('is_processed')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (processedError) {
                toast.error('Error checking claim status');
                return;
              }

              if (processedData?.is_processed) {
                toast.error('Claim has already been processed');
                router.push('/dashboard');
                return;
              }

              // Get current employment details
              const { data: employmentData, error: employmentError } = await supabase
                .from('currentemploymentdetails')
                .select('*')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (employmentError) {
                toast.error('Error loading employment details');
                return;
              }

              setFormData({
                ...formData,
                id: form1112Data.id,
                claim_id: form1112Data.claim_id,
                submission_date: form1112Data.submission_date,
                form_type: form1112Data.form_type,
                pr_id: form1112Data.pr_id,
                worker_first_name: form1112Data.worker_first_name,
                worker_last_name: form1112Data.worker_last_name,
                status_history: formData.status_history
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
        
        setFormData(prev => ({
          ...prev,
          [name]: value,
          status_history: JSON.stringify([
            ...JSON.parse(prev.status_history),
            { status: value, timestamp: new Date().toISOString() }
          ])
        }));

        if (errors[name as keyof typeof errors]) {
          setErrors(prev => ({ ...prev, [name]: '' }));
        }
      };

      const validateForm = () => {
        const newErrors = { ...errors };
        let isValid = true;

        if (!formData.claim_id) {
          newErrors.claim_id = 'Claim ID is required';
          isValid = false;
        }

        if (!formData.action_taken) {
          newErrors.action_taken = 'Please select an action taken';
          isValid = false;
        }

        if (formData.action_taken === 'Rejected' && !formData.decision_reason) {
          newErrors.decision_reason = 'Reason is required for rejected claims';
          isValid = false;
        }

        if (formData.action_taken === 'Recheck' && !formData.decision_reason) {
          newErrors.decision_reason = 'Reason is required for recheck requests';
          isValid = false;
        }

        setErrors(newErrors);
        return isValid;
      };

      const generateForm6PDF = async (data: ReviewData) => {
        try {
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage([600, 400]);
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

          page.drawText('Form 6 - Compensation Notification', {
            x: 50,
            y: 350,
            size: 24,
            font: helveticaFont,
            color: pdfDoc.createColor('#ba372a')
          });

          page.drawText(`Claim ID: ${data.claim_id}`, {
            x: 50,
            y: 320,
            size: 12,
            font: helveticaFont
          });

          page.drawText(`Worker: ${data.worker_first_name} ${data.worker_last_name}`, {
            x: 50,
            y: 300,
            size: 12,
            font: helveticaFont
          });

          page.drawText(`Status: Approved`, {
            x: 50,
            y: 280,
            size: 12,
            font: helveticaFont
          });

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `form6_notification_${data.claim_id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          toast.error('Error generating Form6 notification');
        }
      };

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setIsSubmitting(true);

        try {
          // Update compensation calculation review table
          const { error: updateError } = await supabase
            .from('compensationcalculationcpmreview')
            .update({
              action_taken: formData.action_taken,
              decision_reason: formData.decision_reason,
              status_history: formData.status_history,
              is_processed: true
            })
            .eq('id', formData.id);

          if (updateError) {
            throw updateError;
          }

          // Handle different workflow paths
          if (formData.action_taken === 'Approved') {
            // Generate Form6 notification
            await generateForm6PDF(formData);
            
            // Update ApprovedClaimsCPOReview status
            const { error: cpoError } = await supabase
              .from('approvedclaimscporeview')
              .update({
                status: 'Approved',
                approval_date: new Date().toISOString()
              })
              .eq('claim_id', formData.claim_id);

            if (cpoError) {
              throw cpoError;
            }
          } else if (formData.action_taken === 'Recheck') {
            // Create recheck request in ApprovedClaimsCPOReview
            const { error: recheckError } = await supabase
              .from('approvedclaimscporeview')
              .update({
                status: 'RecheckRequested',
                recheck_reason: formData.decision_reason,
                recheck_date: new Date().toISOString()
              })
              .eq('claim_id', formData.claim_id);

            if (recheckError) {
              throw recheckError;
            }
          }

          // Show success message
          toast.success(`Claim ${formData.action_taken} successfully`);
          router.push('/dashboard');
        } catch (error: any) {
          toast.error('Error processing claim decision');
          console.error('Submission error:', error.message);
        } finally {
          setIsSubmitting(false);
        }
      };

      return (
        <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-primary">Compensation Calculation CPM Review</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="mb-4">
              <label htmlFor="claim_id" className="block text-sm font-medium text-textSecondary">
                Claim ID
              </label>
              <input
                type="text"
                id="claim_id"
                name="claim_id"
                value={formData.claim_id}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              />
              {errors.claim_id && (
                <p className="mt-1 text-sm text-error">{errors.claim_id}</p>
              )}
            </div>

            <div className="mb-4">
              <label htmlFor="submission_date" className="block text-sm font-medium text-textSecondary">
                Submission Date
              </label>
              <input
                type="date"
                id="submission_date"
                name="submission_date"
                value={formData.submission_date}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="form_type" className="block text-sm font-medium text-textSecondary">
                Form Type
              </label>
              <input
                type="text"
                id="form_type"
                name="form_type"
                value={formData.form_type}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="pr_id" className="block text-sm font-medium text-textSecondary">
                PR ID
              </label>
              <input
                type="text"
                id="pr_id"
                name="pr_id"
                value={formData.pr_id}
                onChange={handleInputChange}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="mb-4">
                <label htmlFor="worker_first_name" className="block text-sm font-medium text-textSecondary">
                  Worker First Name
                </label>
                <input
                  type="text"
                  id="worker_first_name"
                  name="worker_first_name"
                  value={formData.worker_first_name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="worker_last_name" className="block text-sm font-medium text-textSecondary">
                  Worker Last Name
                </label>
                <input
                  type="text"
                  id="worker_last_name"
                  name="worker_last_name"
                  value={formData.worker_last_name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-textSecondary mb-2">
                Action Taken
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="action_taken"
                    value="Approved"
                    checked={formData.action_taken === 'Approved'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Approve</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="action_taken"
                    value="Rejected"
                    checked={formData.action_taken === 'Rejected'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Reject</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="action_taken"
                    value="Recheck"
                    checked={formData.action_taken === 'Recheck'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Request Recheck</span>
                </label>
              </div>
              {errors.action_taken && (
                <p className="mt-1 text-sm text-error">{errors.action_taken}</p>
              )}
            </div>

            {(formData.action_taken === 'Rejected' || formData.action_taken === 'Recheck') && (
              <div className="mb-4">
                <label htmlFor="decision_reason" className="block text-sm font-medium text-textSecondary">
                  {formData.action_taken === 'Rejected' ? 'Rejection Reason' : 'Recheck Request Reason'}
                </label>
                <textarea
                  id="decision_reason"
                  name="decision_reason"
                  value={formData.decision_reason || ''}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder={`Please provide a detailed ${formData.action_taken.toLowerCase()} reason...`}
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
    };

    export default DecisionCompensationCalculationCPMReview;
