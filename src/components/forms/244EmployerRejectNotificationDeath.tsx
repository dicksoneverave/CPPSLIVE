import React, { useState, useEffect } from 'react';
import { X, Download, Printer, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form124View from './Form124View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import ViewForm7 from './ViewForm7';

interface Form244Props {
  irn: string;
  incidentType: string;
  onClose: () => void;
}

const Form244EmployerRejectNotificationDeath: React.FC<Form244Props> = ({ irn, incidentType, onClose }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [validIRN, setValidIRN] = useState<number | null>(null);

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
          .eq('IncidentType', 'Death')
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

        // Fetch form7master data for injury notification
        const { data: form7Data, error: form7Error } = await supabase
          .from('form7master')
          .select('*')
          .eq('IRN', validIRN)
          .eq('IncidentType', 'Death')
          .single();

        if (form7Error) {
          throw form7Error;
        }

        setFormData({
          ...form1112Data,
          ...workerData,
          ...form7Data,
        });
      } catch (err: any) {
        console.error('Error fetching death notification data:', err);
        setError(err.message || 'Failed to load death notification data');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [validIRN]);

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
            <p className="text-gray-700">Loading death notification details...</p>
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
            244 - Employer Response Rejection Death Notification
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
          {/* Section 1: Form 7 - Notice to Registrar */}
          <div className="border rounded-lg p-4" id="form6-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 7 - Notice to Registrar</h3>
            <ViewForm7 irn={validIRN?.toString() || ''} />
          </div>

          {/* Section 2: Form 124 - Death Claim Detail */}
          <div className="border rounded-lg p-4" id="deathclaims-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 124 - Death Claim Detail</h3>
            {validIRN ? (
              <Form124View irn={validIRN.toString()} onClose={onClose} />
            ) : (
              <p className="text-textSecondary">Death claim details cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 3: Claim Decisions */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
            {validIRN ? (
              <ListClaimDecisions irn={validIRN.toString()} />
            ) : (
              <p className="text-textSecondary">Claim decisions cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 4: Compensation Breakup */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
            {validIRN ? (
              <CompensationBreakupDetailsView IRN={validIRN.toString()} DisplayIRN={formData.DisplayIRN} IncidentType="Death" />
            ) : (
              <p className="text-textSecondary">Compensation data cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Download Button */}
<button
  onClick={() =>
    downloadForm7CPO(irn, {
      logoPath: 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png',
      fileName: `Form7_${formData.DisplayIRN}.pdf`,
    })
  }
  className="btn btn-primary mt-4"
>
  Download PDF
</button>
        </div>
      </div>
    </div>
  );
};

export default Form244EmployerRejectNotificationDeath;

