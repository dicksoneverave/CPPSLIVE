import React, { useState, useEffect } from 'react';
    import { useAuth } from '../../context/AuthContext';
    import { useRouter } from 'next/router';
    import { supabase } from '../../services/supabase';
    import { toast } from 'react-toastify';

    interface InjuryPrescreeningData {
      id: string;
      irn: string;
      form_type: 'Form11';
      submission_date: string;
      worker_first_name: string;
      worker_last_name: string;
      is_injury_case: true;
      is_death_case: false;
    }

    interface DocumentStatus {
      name: string;
      is_required: boolean;
      status: 'Submitted' | 'Pending';
      notes?: string;
    }

    const DeputyConfirmationLetterCertificateInjury: React.FC = () => {
      const { session, profile, loading } = useAuth();
      const router = useRouter();
      const [prescreeningData, setPrescreeningData] = useState<InjuryPrescreeningData | null>(null);
      const [documents, setDocuments] = useState<DocumentStatus[]>([]);
      const [isGenerating, setIsGenerating] = useState(false);
      const [validationError, setValidationError] = useState<string | null>(null);

      // Form11-specific document requirements
      const getInjuryDocuments = (): DocumentStatus[] => {
        return [
          { name: 'Form11 - Injury Report', is_required: true, status: 'Pending' },
          { name: 'Medical Certificate', is_required: true, status: 'Pending' },
          { name: 'Employer Statement', is_required: true, status: 'Pending' },
          { name: 'Witness Statement', is_required: false, status: 'Pending' }
        ];
      };

      // Initialize component with prescreening data
      useEffect(() => {
        if (router.query?.irn) {
          const fetchInjuryData = async () => {
            try {
              // Fetch Form11-specific prescreening data
              const { data, error } = await supabase
                .from('prescreening_reviews')
                .select('*')
                .eq('irn', router.query.irn)
                .eq('form_type', 'Form11')
                .single();

              if (error) {
                toast.error('Error loading injury case data');
                return;
              }

              setPrescreeningData(data);
              
              // Initialize document statuses
              const injuryDocs = getInjuryDocuments();
              setDocuments(injuryDocs);
              
              // Store injury-specific data in session
              sessionStorage.setItem('injury_confirmation_data', JSON.stringify({
                irn: data.irn,
                formType: data.form_type,
                submissionDate: data.submission_date,
                workerName: `${data.worker_first_name} ${data.worker_last_name}`
              }));
            } catch (error) {
              toast.error('Error initializing injury confirmation letter');
            }
          };

          fetchInjuryData();
        }
      }, [router.query]);

      // Update document status
      const updateDocumentStatus = (index: number, status: 'Submitted' | 'Pending') => {
        const updated = [...documents];
        updated[index] = { ...updated[index], status };
        setDocuments(updated);
      };

      // Validate required documents
      const validateInjuryDocuments = (): boolean => {
        const required = documents.filter(doc => doc.is_required);
        const missing = required.filter(doc => doc.status === 'Pending');
        
        if (missing.length > 0) {
          setValidationError(`Please submit all required documents for ${prescreeningData?.form_type}`);
          return false;
        }
        setValidationError(null);
        return true;
      };

      // Generate confirmation letter
      const handleGenerateLetter = () => {
        if (!validateInjuryDocuments()) return;
        
        setIsGenerating(true);
        
        // Create URL with encoded parameters
        const encodedIRN = encodeURIComponent(prescreeningData!.irn);
        const letterUrl = `/reports/deputy-confirmation-injury?irn=${encodedIRN}`;
        
        // Store document statuses in session
        sessionStorage.setItem('injury_confirmation_documents', JSON.stringify(documents));
        
        // Open in new tab
        window.open(letterUrl, '_blank');
        
        // Show confirmation
        toast.success('Deputy confirmation letter is being generated');
        
        setTimeout(() => {
          setIsGenerating(false);
        }, 2000);
      };

      if (loading || !prescreeningData) {
        return (
          <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-primary">Injury Deputy Confirmation Letter</h1>
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
          <h1 className="text-3xl font-bold mb-6 text-primary">Injury Deputy Confirmation Letter</h1>
          
          {validationError && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              <p className="font-medium">{validationError}</p>
            </div>
          )}

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
                <p className="text-white font-medium">Injury (Form3/Form11)</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Document Requirements</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-3 text-textSecondary">Required Documents</h3>
                <ul className="space-y-2">
                  {documents
                    .filter(doc => doc.is_required)
                    .map((doc, index) => (
                    <li key={index} className="flex items-center justify-between">
                      <span className="text-sm text-textSecondary">{doc.name}</span>
                      <select
                        value={doc.status}
                        onChange={(e) => updateDocumentStatus(index, e.target.value as 'Submitted' | 'Pending')}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Submitted">Submitted</option>
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3 text-textSecondary">Optional Documents</h3>
                <ul className="space-y-2">
                  {documents
                    .filter(doc => !doc.is_required)
                    .map((doc, index) => (
                    <li key={index} className="flex items-center justify-between">
                      <span className="text-sm text-textSecondary">{doc.name}</span>
                      <select
                        value={doc.status}
                        onChange={(e) => updateDocumentStatus(index, e.target.value as 'Submitted' | 'Pending')}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Submitted">Submitted</option>
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleGenerateLetter}
              disabled={isGenerating}
              className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 transform hover:scale-105"
            >
              {isGenerating ? 'Generating...' : 'Generate Confirmation Letter'}
            </button>
          </div>
        </div>
      );
    };

    export default DeputyConfirmationLetterCertificateInjury;
