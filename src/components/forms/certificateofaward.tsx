import React, { useState, useEffect } from 'react';
    import { useAuth } from '../../context/AuthContext';
    import { useRouter } from 'next/router';
    import { supabase } from '../../services/supabase';
    import { toast } from 'react-toastify';

    interface AwardClaimData {
      id: string;
      irn: string;
      form_type: 'Form18';
      submission_date: string;
      worker_first_name: string;
      worker_last_name: string;
      is_injury_case: boolean;
      is_death_case: boolean;
      compensation_amount: number;
      status: string;
    }

    const CertificateOfAward: React.FC = () => {
      const { session, profile, loading } = useAuth();
      const router = useRouter();
      const [claimData, setClaimData] = useState<AwardClaimData | null>(null);
      const [isGenerating, setIsGenerating] = useState(false);
      const [errors, setErrors] = useState({
        irn: ''
      });

      // Fetch claim data from database
      useEffect(() => {
        if (router.query?.irn) {
          const fetchAwardData = async () => {
            try {
              // Fetch Form18 award data
              const { data, error } = await supabase
                .from('form18master')
                .select('*')
                .eq('irn', router.query.irn)
                .single();

              if (error) {
                toast.error('Error loading award data');
                return;
              }

              setClaimData(data);
              
              // Store award data in session for certificate generation
              sessionStorage.setItem('award_certificate_data', JSON.stringify({
                irn: data.irn,
                formType: data.form_type,
                submissionDate: data.submission_date,
                workerName: `${data.worker_first_name} ${data.worker_last_name}`,
                compensationAmount: data.compensation_amount,
                status: data.status
              }));
            } catch (error) {
              toast.error('Error initializing award certificate');
            }
          };

          fetchAwardData();
        } else {
          setErrors(prev => ({ ...prev, irn: 'IRN is required to generate certificate' }));
        }
      }, [router.query]);

      const generatePreview = () => {
        if (!claimData) {
          toast.error('Please select a valid claim to generate certificate');
          return;
        }

        setIsGenerating(true);
        
        // Create URL with encoded parameters
        const encodedIRN = encodeURIComponent(claimData.irn);
        const previewUrl = `/reports/certificate-of-award?irn=${encodedIRN}`;
        
        // Open in new tab
        window.open(previewUrl, '_blank');
        
        // Show confirmation
        toast.success('Award certificate preview is being generated');
        
        setTimeout(() => {
          setIsGenerating(false);
        }, 2000);
      };

      if (loading || !claimData) {
        return (
          <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-primary">Award Certificate Preview</h1>
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
          <h1 className="text-3xl font-bold mb-6 text-primary">Award Certificate Preview</h1>
          
          {/* Informational note about preview vs final version */}
          <div className="mb-8 p-4 bg-yellow-100 text-yellow-800 rounded-md border-l-4 border-yellow-600">
            <p className="font-medium">
              📄 This is a <span className="font-bold">preview</span> of the award certificate. 
              The final version requires <span className="font-bold">registrar approval</span> before it can be issued.
            </p>
          </div>

          <div className="bg-surface-dark p-6 rounded-md mb-8">
            <h2 className="text-xl font-semibold mb-4 text-textSecondary">Claim Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-textSecondary mb-2">IRN:</p>
                <p className="text-white font-medium">{claimData.irn}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Form Type:</p>
                <p className="text-white font-medium">{claimData.form_type}</p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Submission Date:</p>
                <p className="text-white font-medium">
                  {new Date(claimData.submission_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Case Type:</p>
                <p className="text-white font-medium">
                  {claimData.is_injury_case ? 'Injury (Form3/Form11)' : 'Death (Form4/Form12)'}
                </p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Compensation Amount:</p>
                <p className="text-white font-medium">
                  ₹{claimData.compensation_amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-textSecondary mb-2">Current Status:</p>
                <p className="text-white font-medium">{claimData.status}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={generatePreview}
              disabled={isGenerating}
              className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 transform hover:scale-105"
            >
              {isGenerating ? 'Generating...' : 'Generate Preview'}
            </button>
          </div>
        </div>
      );
    };

    export default CertificateOfAward;
