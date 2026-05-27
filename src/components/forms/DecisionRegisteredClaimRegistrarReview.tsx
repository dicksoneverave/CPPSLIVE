import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { useRouter } from 'next/router';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { supabase } from '../../services/supabase';

interface ReviewData {
  id: string;
  irn: string;
  submission_date: string;
  form_type: string;
  pr_id: string;
  worker_first_name: string;
  worker_last_name: string;
  status: string;
  reviewer_id: string;
  review_date: string;
  status_history: string;
  decision_reason?: string;
}

const DecisionRegisteredClaimRegistrarReview: React.FC = () => {
  const { session, profile, group, loading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<ReviewData>({
    id: '',
    irn: '',
    submission_date: '',
    form_type: '',
    pr_id: '',
    worker_first_name: '',
    worker_last_name: '',
    status: '',
    reviewer_id: profile?.id || '',
    review_date: new Date().toISOString(),
    status_history: JSON.stringify([{ status: 'Pending', timestamp: new Date().toISOString() }]),
    decision_reason: ''
  });
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    irn: '',
    status: '',
    decision_reason: ''
  });

  useEffect(() => {
    if (router.query?.irn) {
      const fetchFormData = async () => {
        try {
          // Fetch claim data from database
          const { data, error } = await supabase
            .from('registrar_reviews')
            .select('*')
            .eq('irn', router.query.irn)
            .single();

          if (error) {
            toast.error('Error loading claim data');
            return;
          }

          setFormData({
            ...formData,
            id: data.id,
            irn: data.irn,
            submission_date: data.submission_date,
            form_type: data.form_type,
            pr_id: data.pr_id,
            worker_first_name: data.worker_first_name,
            worker_last_name: data.worker_last_name,
            status: data.status,
            status_history: data.status_history
          });

          // Check for duplicate IRN in CPOR table
          const { count, error: countError } = await supabase
            .from('cpor_records')
            .select('id', { count: 'exact', head: true })
            .eq('irn', router.query.irn);

          if (countError) {
            toast.error('Error checking IRN status');
            return;
          }

          if (count > 0) {
            setIsDuplicate(true);
            toast.error('IRN already exists in CPOR table');
          }
        } catch (error) {
          toast.error('Error loading claim data');
        }
      };

      fetchFormData();
    }
  }, [router.query]);

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

    if (!formData.irn) {
      newErrors.irn = 'IRN is required';
      isValid = false;
    }

    if (!formData.status) {
      newErrors.status = 'Please select a decision status';
      isValid = false;
    }

    if (formData.status === 'Rejected' && !formData.decision_reason) {
      newErrors.decision_reason = 'Reason is required for rejected claims';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const generatePDF = async (data: ReviewData) => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 400]);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      page.drawText(`Claim Decision Confirmation`, {
        x: 50,
        y: 350,
        size: 24,
        font: helveticaFont,
        color: pdfDoc.createColor('#ba372a')
      });

      page.drawText(`IRN: ${data.irn}`, {
        x: 50,
        y: 320,
        size: 12,
        font: helveticaFont
      });

      page.drawText(`Decision: ${data.status}`, {
        x: 50,
        y: 300,
        size: 12,
        font: helveticaFont
      });

      if (data.status === 'Rejected') {
        page.drawText(`Reason: ${data.decision_reason}`, {
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
      link.download = `claim_decision_${data.irn}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error generating PDF confirmation');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (isDuplicate) {
      toast.error('Cannot process duplicate IRN');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update registrar review table
      const { error: updateError } = await supabase
        .from('registrar_reviews')
        .update({
          status: formData.status,
          decision_reason: formData.decision_reason,
          status_history: formData.status_history
        })
        .eq('id', formData.id);

      if (updateError) {
        throw updateError;
      }

      // Insert into CPO Review table if Approved
      if (formData.status === 'Approved') {
        const { error: insertError } = await supabase
          .from('cpo_reviews')
          .insert({
            irn: formData.irn,
            pr_id: formData.pr_id,
            status: 'Pending',
            assigned_to: null,
            review_date: new Date().toISOString()
          });

        if (insertError) {
          throw insertError;
        }
      }

      // Generate confirmation PDF
      await generatePDF(formData);
      
      // Show success message
      toast.success(`Claim ${formData.status} successfully`);
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
      <h1 className="text-3xl font-bold mb-6 text-primary">Claim Decision Review</h1>
      
      {isDuplicate && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
          <p className="font-medium">⚠️ Warning: This IRN already exists in the CPOR table</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="mb-4">
          <label htmlFor="irn" className="block text-sm font-medium text-textSecondary">
            IRN
          </label>
          <input
            type="text"
            id="irn"
            name="irn"
            value={formData.irn}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
          {errors.irn && (
            <p className="mt-1 text-sm text-error">{errors.irn}</p>
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
            Decision Status
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="status"
                value="Approved"
                checked={formData.status === 'Approved'}
                onChange={handleInputChange}
                className="text-primary focus:ring-primary"
              />
              <span className="ml-2 text-textSecondary">Approve</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="status"
                value="Pending"
                checked={formData.status === 'Pending'}
                onChange={handleInputChange}
                className="text-primary focus:ring-primary"
              />
              <span className="ml-2 text-textSecondary">Pending</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="status"
                value="Rejected"
                checked={formData.status === 'Rejected'}
                onChange={handleInputChange}
                className="text-primary focus:ring-primary"
              />
              <span className="ml-2 text-textSecondary">Reject</span>
            </label>
          </div>
          {errors.status && (
            <p className="mt-1 text-sm text-error">{errors.status}</p>
          )}
        </div>

        {formData.status === 'Rejected' && (
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
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DecisionRegisteredClaimRegistrarReview;
