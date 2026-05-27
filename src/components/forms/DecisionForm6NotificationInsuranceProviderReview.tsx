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
      dispute_type?: string;
    }

    const DecisionForm6NotificationInsuranceProviderReview: React.FC = () => {
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
        is_processed: false,
        dispute_type: ''
      });
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [errors, setErrors] = useState({
        claim_id: '',
        action_taken: '',
        decision_reason: '',
        dispute_type: ''
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
                .from('form6notificationinsuranceproviderreview')
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

        if (formData.action_taken === 'RejectCompensationCalculation' && !formData.decision_reason) {
          newErrors.decision_reason = 'Reason is required for compensation calculation rejections';
          isValid = false;
        }

        if (formData.action_taken === 'RejectOtherReason' && !formData.decision_reason) {
          newErrors.decision_reason = 'Reason is required for other rejections';
          isValid = false;
        }

        if (formData.action_taken === 'RejectOtherReason' && !formData.dispute_type) {
          newErrors.dispute_type = 'Please select a dispute type';
          isValid = false;
        }

        setErrors(newErrors);
        return isValid;
      };

      const generateForm18PDF = async (data: ReviewData) => {
        try {
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage([600, 400]);
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

          page.drawText('Form 18 - Compensation Acceptance', {
            x: 50,
            y: 350,
            size: 24,
            font: helveticaFont,
            color: pdfDoc.createColor('#f59e0b')
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
          link.download = `form18_notification_${data.claim_id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          toast.error('Error generating Form18 notification');
        }
      };

      const generateForm7PDF = async (data: ReviewData) => {
        try {
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage([600, 400]);
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

          page.drawText('Form 7 - Compensation Rejection', {
            x: 50,
            y: 350,
            size: 24,
            font: helveticaFont,
            color: pdfDoc.createColor('#ef4444')
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

          page.drawText(`Status: Rejected`, {
            x: 50,
            y: 280,
            size: 12,
            font: helveticaFont
          });

          if (data.decision_reason) {
            page.drawText(`Reason: ${data.decision_reason}`, {
              x: 50,
              y: 260,
              size: 12,
              font: helveticaFont
            });
          }

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `form7_notification_${data.claim_id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          toast.error('Error generating Form7 notification');
        }
      };

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setIsSubmitting(true);

        try {
          // Update Form6Master status
          const { error: form6Error } = await supabase
            .from('form6master')
            .update({
              status: formData.action_taken,
              updated_at: new Date().toISOString()
            })
            .eq('claim_id', formData.claim_id);

          if (form6Error) {
            throw form6Error;
          }

          // Handle different workflow paths
          if (formData.action_taken === 'Approved') {
            // Create Form18 record
            const { error: form18Error } = await supabase
              .from('form18master')
              .insert({
                claim_id: formData.claim_id,
                status: 'Pending',
                submission_date: new Date().toISOString()
              });

            if (form18Error) {
              throw form18Error;
            }

            // Generate Form18 notification
            await generateForm18PDF(formData);
          } else if (formData.action_taken === 'RejectCompensationCalculation') {
            // Create Form7 record for compensation calculation rejection
            const { error: form7Error } = await supabase
              .from('form7master')
              .insert({
                claim_id: formData.claim_id,
                rejection_type: 'CompensationCalculation',
                rejection_reason: formData.decision_reason,
                submission_date: new Date().toISOString()
              });

            if (form7Error) {
              throw form7Error;
            }

            // Generate Form7 notification
            await generateForm7PDF(formData);
          } else if (formData.action_taken === 'RejectOtherReason') {
            // Create Form7 record for other rejection
            const { error: form7Error } = await supabase
              .from('form7master')
              .insert({
                claim_id: formData.claim_id,
                rejection_type: 'Other',
                rejection_reason: formData.decision_reason,
                dispute_type: formData.dispute_type,
                submission_date: new Date().toISOString()
              });

            if (form7Error) {
              throw form7Error;
            }

            // Create Tribunal hearing record if dispute type is selected
            if (formData.dispute_type) {
              const { error: tribunalError } = await supabase
                .from('tribunal_hearings')
                .insert({
                  claim_id: formData.claim_id,
                  dispute_type: formData.dispute_type,
                  status: 'Pending',
                  submission_date: new Date().toISOString()
                });

              if (tribunalError) {
                throw tribunalError;
              }
            }

            // Generate Form7 notification
            await generateForm7PDF(formData);
          }

          // Update review table
          const { error: updateError } = await supabase
            .from('form6notificationinsuranceproviderreview')
            .update({
              action_taken: formData.action_taken,
              decision_reason: formData.decision_reason,
              status_history: formData.status_history,
              is_processed: true
            })
            .eq('claim_id', formData.claim_id);

          if (updateError) {
            throw updateError;
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
          <h1 className="text-3xl font-bold mb-6 text-primary">Form6 Notification Insurance Provider Review</h1>

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
                    value="RejectCompensationCalculation"
                    checked={formData.action_taken === 'RejectCompensationCalculation'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Reject Compensation Calculation</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="action_taken"
                    value="RejectOtherReason"
                    checked={formData.action_taken === 'RejectOtherReason'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Reject Other Reason</span>
                </label>
              </div>
              {errors.action_taken && (
                <p className="mt-1 text-sm text-error">{errors.action_taken}</p>
              )}
            </div>

            {(formData.action_taken === 'RejectCompensationCalculation' || 
             formData.action_taken === 'RejectOtherReason') && (
              <div className="mb-4">
                <label htmlFor="decision_reason" className="block text-sm font-medium text-textSecondary">
                  {formData.action_taken === 'RejectCompensationCalculation' ? 'Rejection Reason' : 'Other Rejection Reason'}
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

            {formData.action_taken === 'RejectOtherReason' && (
              <div className="mb-4">
                <label htmlFor="dispute_type" className="block text-sm font-medium text-textSecondary">
                  Dispute Type
                </label>
                <select
                  id="dispute_type"
                  name="dispute_type"
                  value={formData.dispute_type || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">Select Dispute Type</option>
                  <option value="MedicalDispute">Medical Dispute</option>
                  <option value="EmploymentDispute">Employment Dispute</option>
                  <option value="CalculationDispute">Calculation Dispute</option>
                  <option value="Other">Other</option>
                </select>
                {errors.dispute_type && (
                  <p className="mt-1 text-sm text-error">{errors.dispute_type}</p>
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

    export default DecisionForm6NotificationInsuranceProviderReview;
