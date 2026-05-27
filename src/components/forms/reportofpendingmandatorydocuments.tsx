import React, { useState, useEffect } from 'react';
    import { useAuth } from '../../context/AuthContext';
    import { useRouter } from 'next/router';
    import { supabase } from '../../services/supabase';
    import { toast } from 'react-toastify';

    interface DocumentRequirement {
      document_name: string;
      is_required: boolean;
      status: 'Pending' | 'Submitted' | 'Verified';
      remarks?: string;
    }

    interface ClaimData {
      id: string;
      irn: string;
      incident_type: string;
      submission_date: string;
      status: string;
      is_injury_case: boolean;
      is_time_barred: boolean;
    }

    const ReportOfPendingMandatoryDocuments: React.FC = () => {
      const { session, profile, loading } = useAuth();
      const router = useRouter();
      const [claimData, setClaimData] = useState<ClaimData | null>(null);
      const [isDuplicate, setIsDuplicate] = useState(false);
      const [isGenerating, setIsGenerating] = useState(false);
      const [errors, setErrors] = useState({
        irn: '',
        incident_type: ''
      });

      // Map incident type to required documents
      const getDocumentRequirements = (incidentType: string): DocumentRequirement[] => {
        const baseDocuments = [
          { document_name: 'Form 1112 - Worker Injury Report', is_required: true, status: 'Pending' },
          { document_name: 'Medical Assessment Report', is_required: true, status: 'Pending' },
          { document_name: 'Employer Statement', is_required: true, status: 'Pending' }
        ];

        if (incidentType === 'Injury') {
          return [
            ...baseDocuments,
            { document_name: 'Doctor\'s Certificate', is_required: true, status: 'Pending' },
            { document_name: 'Witness Statement', is_required: false, status: 'Pending' },
            { document_name: 'Police Report', is_required: true, status: 'Pending' }
          ];
        } else if (incidentType === 'Non-Injury') {
          return [
            ...baseDocuments,
            { document_name: 'Incident Description', is_required: true, status: 'Pending' },
            { document_name: 'Photographic Evidence', is_required: true, status: 'Pending' }
          ];
        } else {
          return baseDocuments;
        }
      };

      useEffect(() => {
        if (router.query?.irn) {
          const fetchClaimData = async () => {
            try {
              // Fetch claim data from database
              const { data, error } = await supabase
                .from('form1112master')
                .select('*')
                .eq('irn', router.query.irn)
                .single();

              if (error) {
                toast.error('Error loading claim data');
                return;
              }

              setClaimData(data);

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

          fetchClaimData();
        }
      }, [router.query]);

      const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        setClaimData(prev => {
          if (!prev) return prev;
          return { ...prev, [name]: value };
        });

        if (errors[name as keyof typeof errors]) {
          setErrors(prev => ({ ...prev, [name]: '' }));
        }
      };

      const validateForm = () => {
        const newErrors = { ...errors };
        let isValid = true;

        if (!claimData?.irn) {
          newErrors.irn = 'IRN is required';
          isValid = false;
        }

        if (!claimData?.incident_type) {
          newErrors.incident_type = 'Incident type is required';
          isValid = false;
        }

        setErrors(newErrors);
        return isValid;
      };

      const generateReport = () => {
        if (!validateForm()) return;
        if (isDuplicate) {
          toast.error('Cannot generate report for duplicate IRN');
          return;
        }

        // Create URL with encoded parameters
        const encodedIRN = encodeURIComponent(claimData!.irn);
        const encodedIncidentType = encodeURIComponent(claimData!.incident_type);
        const reportUrl = `/reports/pending-documents?irn=${encodedIRN}&incidentType=${encodedIncidentType}`;
        
        // Open in new tab
        window.open(reportUrl, '_blank');
      };

      if (loading || !claimData) {
        return (
          <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-primary">Pending Documents Report</h1>
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
          <h1 className="text-3xl font-bold mb-6 text-primary">Report of Pending Mandatory Documents</h1>
          
          {isDuplicate && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
              <p className="font-medium">⚠️ Warning: This IRN already exists in the CPOR table</p>
            </div>
          )}

          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Claim Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-textSecondary mb-2">IRN:</p>
                <p className="text-white font-medium">{claimData.irn}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Incident Type:</p>
                <p className="text-white font-medium">{claimData.incident_type}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Submission Date:</p>
                <p className="text-white font-medium">{new Date(claimData.submission_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Claim Status:</p>
                <p className="text-white font-medium">{claimData.status}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Document Requirements</h2>
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Document Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {getDocumentRequirements(claimData.incident_type).map((doc, index) => (
                  <tr key={index} className="hover:bg-gray-800 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-textSecondary">{doc.document_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {doc.status === 'Pending' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                      {doc.status === 'Submitted' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          Submitted
                        </span>
                      )}
                      {doc.status === 'Verified' && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
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
              onClick={generateReport}
              disabled={isGenerating}
              className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      );
    };

    export default ReportOfPendingMandatoryDocuments;
