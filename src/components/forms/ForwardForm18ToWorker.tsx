import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface ForwardForm18ToWorkerProps {
  irn: string;
  incidentType: string; // 'Injury' | 'Death'
  onClose: () => void;
}

const Form18ForwardToWorker: React.FC<ForwardForm18ToWorkerProps> = ({ 
  irn, 
  incidentType, 
  onClose 
}) => {
  const [workerID, setWorkerID] = useState('');
  const [employerCPPSID, setEmployerCPPSID] = useState('');
  const [WPD, setWPD] = useState<any>(null);
  const [CED, setCED] = useState<any>(null);
  const [EM, setEM] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Validate IRN format before making API call
  const isValidIRN = (value: string) => /^\d+$/.test(value);

  useEffect(() => {
    if (!irn?.trim()) {
      setError('IRN is required');
      return;
    }
    if (!isValidIRN(irn)) {
      setError('IRN must be a valid number');
      return;
    }
    setError('');

    // Read WIRN → WPD/CED/EM (unchanged)
    supabase
      .from('workerirn')
      .select('WorkerID')
      .eq('IRN', Number(irn))
      .single()
      .then(({ data: WIRN, error }) => {
        if (error) {
          console.error('Error fetching WIRN:', error);
          setError('Failed to fetch worker information');
          return;
        }
        if (!WIRN?.WorkerID) return;

        const wid = WIRN.WorkerID;
        setWorkerID(wid);

        supabase
          .from('workerpersonaldetails')
          .select('*')
          .eq('WorkerID', wid)
          .single()
          .then(({ data, error }) => {
            if (error) console.error('Error fetching WPD:', error);
            setWPD(data);
          });

        supabase
          .from('currentemploymentdetails')
          .select('EmployerCPPSID')
          .eq('WorkerID', wid)
          .single()
          .then(({ data: ced, error }) => {
            if (error) console.error('Error fetching CED:', error);
            setCED(ced);
            const cpps = ced?.EmployerCPPSID;
            if (cpps) {
              setEmployerCPPSID(cpps);
              supabase
                .from('employermaster')
                .select('*')
                .eq('CPPSID', cpps)
                .single()
                .then(({ data, error }) => {
                  if (error) console.error('Error fetching EM:', error);
                  setEM(data);
                });
            }
          });
      });
  }, [irn]);

  const handleForward = async () => {
    if (!isValidIRN(irn)) {
      setMessage('Invalid IRN');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const irnNumber = Number(irn);
      const nowISO = new Date().toISOString();

      // Important: ensure we filter by both IRN and IncidentType (table has both)
      const { data, error } = await supabase
        .from('form18master')
        .update({
          F18MStatus: 'NotifiedToWorker',
          F18MEmployerAcceptedDate: nowISO, // optional if you want to stamp accepted/forwarded date
        })
        .eq('IRN', irnNumber)
        .eq('IncidentType', incidentType)
        .select('IRN'); // force returning rows so we can verify affected count

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage('No matching Form 18 record was found for this IRN and Incident Type.');
        return;
      }

      setMessage('Form 18 Notification sent to Worker');
    } catch (err: any) {
      console.error('Update failed:', err);
      setMessage(`Failed to update Form 18 status: ${err?.message || ''}`.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">
          Form 18 - Application for Award by Consent
          <span className="ml-2 text-sm font-normal text-gray-600">Register No. {irn || '...'}</span>
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6">
        {/* content omitted for brevity ... */}

        <div className="mt-8 flex justify-end">
          <button 
            onClick={handleForward}
            className={`bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md transition-colors ${!irn || error || saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!irn || !!error || saving}
          >
            {saving ? 'Forwarding…' : 'Forward to Worker'}
          </button>
        </div>

        {message && (
          <div className={`mt-4 p-3 ${message.startsWith('Failed') || message.startsWith('No matching') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'} rounded-md text-sm`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Form18ForwardToWorker;
