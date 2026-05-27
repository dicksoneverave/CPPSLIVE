import React, { useState, useEffect } from 'react';
    import { useAuth } from '../../context/AuthContext';
    import { useRouter } from 'next/router';
    import { supabase } from '../../services/supabase';
    import { toast } from 'react-toastify';

    interface PrescreeningData {
      id: string;
      irn: string;
      form_type: string;
      submission_date: string;
      worker_first_name: string;
      worker_last_name: string;
      is_injury_case: boolean;
      is_death_case: boolean;
    }

    interface DocumentStatus {
      document_name: string;
      is_required: boolean;
      status: 'Submitted' | 'Pending';
      remarks?: string;
    }

    const DeputyConfirmationLetterCertificate: React.FC = () => {
      const { session, profile, loading } = useAuth();
      const router = useRouter();
      const [prescreeningData, setPrescreeningData] = useState<PrescreeningData | null>(null);
      const [documents, setDocuments] = useState<DocumentStatus[]>([]);
      const [isGenerating, setIsGenerating] = useState(false);
      const [errors, setErrors] = useState({
        form_type: '',
        irn: ''
      });

      // Map form type to required documents
      const getRequiredDocuments = (formType: string): DocumentStatus[] => {
        if (formType === 'Form11') {
          return [
            { document_name: 'Form11 - Injury Report', is_required: true, status: 'Pending' },
            { document_name: 'Medical Certificate', is_required: true, status: 'Pending' },
            { document_name: 'Employer Statement', is_required: true, status: 'Pending' },
            { document_name: 'Witness Statement', is_required: false, status: 'Pending' }
          ];
        } else if (formType === 'Form12') {
          return [
            { document_name: 'Form12 - Death Report', is_required: true, status: 'Pending' },
            { document_name: 'Death Certificate', is_required: true, status: 'Pending' },
            { document_name: 'Employer Statement', is_required: true, status: 'Pending' },
            { document_name: 'Medical Examiner Report', is_required: true, status: 'Pending' }
          ];
        } else {
          return [];
        }
      };

      useEffect(() => {
        if (router.query?.irn) {
          const fetchPrescreeningData = async () => {
            try {
              // Fetch prescreening review data
              const { data, error } = await supabase
                .from('prescreening_reviews')
                .select('*')
                .eq('irn', router.query.irn)
                .single();

              if (error) {
                toast.error('Error loading prescreening data');
                return;
              }

              setPrescreeningData(data);
              
              // Initialize document statuses
              const requiredDocs = getRequiredDocuments(data.form_type);
              setDocuments(requiredDocs);
              
              // Store data in session for certificate generation
              localStorage.setItem('deputy_confirmation_data', JSON.stringify({
                irn: data.irn,
                form_type: data.form_type,
                submission_date: data.submission_date,
                worker_name: `${data.worker_first_name} ${data.worker_last_name}`,
                is_injury_case: data.is_injury_case,
                is_death_case: data.is_death_case
              }));
            } catch (error) {
              toast.error('Error initializing deputy confirmation letter');
            }
          };

          fetchPrescreeningData();
        }
      }, [router.query]);

      const handleDocumentStatusChange = (index: number, status: 'Submitted' | 'Pending') => {
        const updatedDocs = [...documents];
        updatedDocs[index] = { ...updatedDocs[index], status };
        setDocuments(updatedDocs);
      };

      const validateDocuments = () => {
        const newErrors = { ...errors };
        let isValid = true;
        
        // Check if all required documents are submitted
        const requiredDocs = documents.filter(doc => doc.is_required);
        const missingDocs = requiredDocs.filter(doc => doc.status === 'Pending');
        
        if (missingDocs.length > 0) {
          newErrors.form_type = `Please submit all required documents for ${prescreeningData?.form_type}`;
          isValid = false;
        }

        setErrors(newErrors);
        return isValid;
      };

      const generateLetter = () => {
        if (!validateDocuments()) return;
        
        setIsGenerating(true);
        
        // Create URL with encoded parameters
        const encodedIRN = encodeURIComponent(prescreeningData!.irn);
        const encodedFormType = encodeURIComponent(prescreeningData!.form_type);
        const letterUrl = `/reports/deputy-confirmation?irn=${encodedIRN}&formType=${encodedFormType}`;
        
        // Open in new tab
        window.open(letterUrl, '_blank');
        
        // Store document statuses in session
        localStorage.setItem('deputy_confirmation_documents', JSON.stringify(documents));
        
        setTimeout(() => {
          setIsGenerating(false);
        }, 2000);
      };

      if (loading || !prescreeningData) {
        return (
          <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-primary">Deputy Confirmation Letter</h1>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        );
      }

      return (
        <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-primary">Deputy Confirmation Letter Certificate</h1>
          
          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Case Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-textSecondary mb-2">IRN:</p>
                <p className="text-white font-medium">{prescreeningData.irn}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Form Type:</p>
                <p className="text-white font-medium">{prescreeningData.form_type}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Submission Date:</p>
                <p className="text-white font-medium">
                  {new Date(prescreeningData.submission_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Case Type:</p>
                <p className="text-white font-medium">
                  {prescreeningData.is_injury_case ? 'Injury (Form3/Form11)' : 'Death (Form4/Form12)'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Document Status</h2>
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Document Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {documents.map((doc, index) => (
                  <tr key={index} className="hover:bg-gray-800 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-textSecondary">{doc.document_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        value={doc.status}
                        onChange={(e) => handleDocumentStatusChange(index, e.target.value as 'Submitted' | 'Pending')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Submitted">Submitted</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-textSecondary">
                      {doc.remarks || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={generateLetter}
              disabled={isGenerating}
              className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
            >
              {isGenerating ? 'Generating...' : 'Generate Confirmation Letter'}
            </button>
          </div>
        </div>
      );
    };

    export default DeputyConfirmationLetterCertificate;
