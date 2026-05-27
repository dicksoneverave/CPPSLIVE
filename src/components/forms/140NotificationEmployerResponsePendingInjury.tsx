// src/components/forms/140NotificationEmployerResponsePendingInjury.tsx
import React, { useState, useEffect } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import generatePDF from '../../utils/pdfGenerator';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import ViewForm6 from './ViewForm6';
import generateForm6CPO_jsPDF_byIRN from '../../utils/form6CPO_jspdf';

interface Form140Props {
  irn: string;
  incidentType: string;
  onClose: () => void;
}

const Form140NotificationEmployerResponsePendingInjury: React.FC<Form140Props> = ({ irn, incidentType, onClose }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [validIRN, setValidIRN] = useState<number | null>(null);

  // NEW: printing state for option 2
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const irnNumber = parseInt(irn, 10);
    if (isNaN(irnNumber)) {
      setError('Invalid IRN: must be a number');
      setLoading(false);
      return;
    }
    setValidIRN(irnNumber);
  }, [irn]);

  useEffect(() => {
    if (validIRN === null) return;

    const fetchFormData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('*')
          .eq('IRN', validIRN)
          .eq('IncidentType', 'Injury')
          .single(); // keep as-is; change to maybeSingle if you suspect 0/duplicates

        if (form1112Error) throw form1112Error;

        const { data: workerData, error: workerError } = await supabase
          .from('workerpersonaldetails')
          .select('*')
          .eq('WorkerID', form1112Data.WorkerID)
          .single();

        if (workerError) throw workerError;

        const { data: form6Data, error: form6Error } = await supabase
          .from('form6master')
          .select('*')
          .eq('IRN', validIRN)
          .eq('IncidentType', 'Injury')
          .single();

        if (form6Error) throw form6Error;

        setFormData({
          ...form1112Data,
          ...workerData,
          ...form6Data,
        });
      } catch (err: any) {
        console.error('Error fetching injury notification data:', err);
        setError(err.message || 'Failed to load injury notification data');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [validIRN]);

  // OPTION 2: single handler with loading/disabled state
  const handlePrintForm6 = async () => {
    if (!validIRN || printing) return;
    setPrinting(true);
    try {
      await generateForm6CPO_jsPDF_byIRN(validIRN, formData.DisplayIRN);
    } catch (e) {
      console.error(e);
      alert('Failed to generate Form 6.');
    } finally {
      setPrinting(false);
    }
  };

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
            <p className="text-gray-700">Loading injury notification details...</p>
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
            140 - Employer Response Pending Injury Notification
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
          {/* Section 1: Form 6 - Notice to Employer */}
          <div className="border rounded-lg p-4" id="form6-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 6 - Notice to Employer</h3>
            <ViewForm6 irn={validIRN?.toString() || ''} />
          </div>

          {/* Top-right icon button (uses same handler) */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handlePrintForm6}
              className="text-gray-500 hover:text-gray-700 p-1 mr-4 disabled:opacity-60"
              title={printing ? 'Generating…' : 'Download to PDF'}
              disabled={!validIRN || printing}
            >
              <Download className="h-5 w-5" />
            </button>
          </div>

          {/* Section 2: Form 113 - Injury Claim Details */}
          <div className="border rounded-lg p-4" id="injuryclaims-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 113 - Injury Claim Details</h3>
            <Form113View irn={validIRN?.toString() || ''} onClose={onClose} />
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
              <CompensationBreakupDetailsView
                IRN={validIRN.toString()}
                DisplayIRN={formData.DisplayIRN}
                IncidentType="Injury"
              />
            ) : (
              <p className="text-textSecondary">Compensation data cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Bottom full-width download button (same handler & state) */}
          <button
            onClick={handlePrintForm6}
            className="btn bg-primary text-white hover:bg-primary-dark mt-4 disabled:opacity-60"
            disabled={!validIRN || printing}
          >
            {printing ? 'Generating…' : 'Print Form6'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Form140NotificationEmployerResponsePendingInjury;
