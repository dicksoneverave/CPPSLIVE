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
      locked_by?: string;
      locked_at?: string;
    }

    const DecisionCommissionerReview: React.FC = () => {
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
      });
      const [isLocked, setIsLocked] = useState(false);
      const [lockError, setLockError] = useState('');
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [errors, setErrors] = useState({
        claim_id: '',
        action_taken: '',
        decision_reason: ''
      });

      // Acquire claim lock when component mounts
      useEffect(() => {
        if (router.query?.claim_id) {
          const acquireLock = async () => {
            try {
              // Check if claim is already locked
              const { data: claimData, error: claimError } = await supabase
                .from('claimsawardedcommissionersreview')
                .select('locked_by, locked_at')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (claimError) {
                toast.error('Error checking claim lock status');
                return;
              }

              if (claimData.locked_by && claimData.locked_by !== profile?.id) {
                setIsLocked(true);
                setLockError(`Claim is currently being reviewed by ${claimData.locked_by}`);
                return;
              }

              // Acquire lock
              const { error: lockError } = await supabase
                .from('claimsawardedcommissionersreview')
                .update({ locked_by: profile?.id, locked_at: new Date().toISOString() })
                .eq('claim_id', router.query.claim_id);

              if (lockError) {
                toast.error('Error acquiring claim lock');
                return;
              }

              // Fetch claim data
              const { data, error } = await supabase
                .from('claimsawardedcommissionersreview')
                .select('*')
                .eq('claim_id', router.query.claim_id)
                .single();

              if (error) {
                toast.error('Error loading claim data');
                return;
              }

              setFormData({
                ...formData,
                id: data.id,
                claim_id: data.claim_id,
                submission_date: data.submission_date,
                form_type: data.form_type,
                pr_id: data.pr_id,
                worker_first_name: data.worker_first_name,
                worker_last_name: data.worker_last_name,
                action_taken: data.action_taken,
                decision_reason: data.decision_reason,
                status_history: data.status_history
              });
            } catch (error) {
              toast.error('Error initializing claim review');
            }
          };

          if (profile?.id) {
            acquireLock();
          }
        }
      }, [router.query, profile?.id]);

      // Release lock on component unmount
      useEffect(() => {
        return () => {
          if (router.query?.claim_id && profile?.id) {
            const releaseLock = async () => {
              const { error } = await supabase
                .from('claimsawardedcommissionersreview')
                .update({ locked_by: null, locked_at: null })
                .eq('claim_id', router.query.claim_id);
            };
            releaseLock();
          }
        };
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

        setErrors(newErrors);
        return isValid;
      };

      const generatePDF = async (data: ReviewData, type: string) => {
        try {
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage([600, 400]);
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

          page.drawText(`Claim ${type} Confirmation`, {
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

          page.drawText(`Action Taken: ${data.action_taken}`, {
            x: 50,
            y: 300,
            size: 12,
            font: helveticaFont
          });

          if (type === 'Certificate of Claim Award') {
            page.drawText(`Decision Reason: ${data.decision_reason}`, {
              x: 50,
              y: 280,
              size: 12,
              font: helveticaFont
            });
          }

          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `${type.toLowerCase()}_${data.claim_id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          toast.error(`Error generating ${type} confirmation`);
        }
      };

      const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        if (isLocked) {
          toast.error('Cannot process locked claim');
          return;
        }

        setIsSubmitting(true);

        try {
          // Determine user role for status differentiation
          const isChief = group?.id === 24;
          
          // Update ClaimsAwardedCommissionersReview table
          const { error: updateError } = await supabase
            .from('claimsawardedcommissionersreview')
            .update({
              action_taken: formData.action_taken,
              decision_reason: formData.decision_reason,
              status_history: formData.status_history,
              locked_by: null,
              locked_at: null
            })
            .eq('id', formData.id);

          if (updateError) {
            throw updateError;
          }

          // Create record in ClaimsAwardedRegistrarReview for approved claims
          if (formData.action_taken === 'Accepted') {
            const { error: insertError } = await supabase
              .from('claimsawardedregistrarreview')
              .insert({
                claim_id: formData.claim_id,
                pr_id: formData.pr_id,
                status: 'Pending',
                assigned_to: null,
                review_date: new Date().toISOString(),
                status_type: isChief ? 'ChiefCommissionerAccepted' : 'CommissionerAccepted'
              });

            if (insertError) {
              throw insertError;
            }
          }

          // Generate confirmation PDFs
          await generatePDF(formData, 'Bank Confirmation');
          await generatePDF(formData, 'Certificate of Claim Award');
          await generatePDF(formData, 'Checklist for Payment');
          
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
          <h1 className="text-3xl font-bold mb-6 text-primary">Commissioner Claim Decision Review</h1>
          
          {isLocked && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              <p className="font-medium">🔒 Claim is currently locked by another commissioner</p>
            </div>
          )}

          {lockError && (
            <div className="mb-6 p-4 bg-yellow-100 text-yellow-700 rounded-md">
              <p className="font-medium">{lockError}</p>
            </div>
          )}

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
                    value="Accepted"
                    checked={formData.action_taken === 'Accepted'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Accept</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="action_taken"
                    value="Pending"
                    checked={formData.action_taken === 'Pending'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Pending</span>
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
                    value="Hold"
                    checked={formData.action_taken === 'Hold'}
                    onChange={handleInputChange}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-textSecondary">Hold</span>
                </label>
              </div>
              {errors.action_taken && (
                <p className="mt-1 text-sm text-error">{errors.action_taken}</p>
              )}
            </div>

            {formData.action_taken === 'Rejected' && (
              <div className="mb-4">
                <label htmlFor="decision_reason" className="block text-sm font-medium text-textSecondary">
                  Rejection Reason
                </label>
                <textarea
                  id="decision_reason"
                  name="decision_reason"
                  value={formData.decision_reason || ''}
                  onChange={handleInputChange}
                  required
                  rows={4}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Please provide a detailed reason for rejection..."
                />
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
              </ul>
            </div>
          </div>
        </div>
      );
    };

    export default DecisionCommissionerReview;
