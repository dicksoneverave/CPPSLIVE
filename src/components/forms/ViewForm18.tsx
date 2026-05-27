import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
// ✅ named import
import { downloadForm18CPO } from '../../utils/form18CPO_jspdf';

interface ViewForm18Props {
  irn: string;
  onClose?: () => void;
}

interface Form18Data {
  IRN: string;
  DisplayIRN: string;
  IncidentType: string;
  F18MStatus: string;
  F18MEmployerAcceptedDate: string;
  F18MEmployerDecisionReason: string;
  F18MWorkerNotifiedDate: string;
  F18MWorkerAcceptedDate: string;
  F18MWorkerDecisionReason: string;
  EmployerCPPSID: string;
}

interface WorkerData {
  WorkerID: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerAddress1: string;
  WorkerAddress2: string;
  WorkerCity: string;
  WorkerProvince: string;
  WorkerPOBox: string;
  WorkerEmail: string;
  WorkerMobile: string;
}

interface EmployerData {
  OrganizationName: string;
  Address1: string;
  Address2: string;
  City: string;
  Province: string;
  POBox: string;
  Website: string;
  MobilePhone: string;
  LandLine: string;
  Fax: string;
  OrganizationType: string;
}

const ViewForm18: React.FC<ViewForm18Props> = ({ irn, onClose }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form18Data, setForm18Data] = useState<Form18Data | null>(null);
  const [workerData, setWorkerData] = useState<WorkerData | null>(null);
  const [employerData, setEmployerData] = useState<EmployerData | null>(null);
  const [message, setMessage] = useState('');
  const [currentDate] = useState<string>(
    new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Form18
      const { data: f18, error: f18Err } = await supabase
        .from('form18master')
        .select('*')
        .eq('IRN', irn)
        .maybeSingle();
      if (f18Err) throw f18Err;
      if (!f18) throw new Error('Form 18 data not found');
      setForm18Data(f18);

      // WorkerID
      const { data: f112, error: f112Err } = await supabase
        .from('form1112master')
        .select('WorkerID')
        .eq('IRN', irn)
        .single();
      if (f112Err) throw f112Err;

      // Worker details
      const { data: worker, error: workerErr } = await supabase
        .from('workerpersonaldetails')
        .select('*')
        .eq('WorkerID', f112.WorkerID)
        .single();
      if (workerErr) throw workerErr;
      setWorkerData(worker);

      // Employer details
      const { data: employer, error: employerErr } = await supabase
        .from('employermaster')
        .select('*')
        .eq('CPPSID', f18.EmployerCPPSID)
        .maybeSingle();

      if (employerErr && employerErr.code !== 'PGRST116') throw employerErr;

      if (employer) {
        setEmployerData(employer);
      } else {
        const { data: ced, error: cedErr } = await supabase
          .from('currentemploymentdetails')
          .select('PlaceOfEmployment, EmployerCPPSID')
          .eq('WorkerID', f112.WorkerID)
          .maybeSingle();
        if (!cedErr && ced) {
          setEmployerData({
            OrganizationName: ced.PlaceOfEmployment,
            Address1: '',
            Address2: '',
            City: '',
            Province: '',
            POBox: '',
            Website: '',
            MobilePhone: '',
            LandLine: '',
            Fax: '',
            OrganizationType: '',
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching Form18 data:', err);
      setError(err.message || 'Failed to load Form18 data');
    } finally {
      setLoading(false);
    }
  }, [irn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadPdf = async () => {
    try {
      if (!irn) return;
      await downloadForm18CPO(irn, {
        logoPath:
          'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png',
      });
      setMessage('PDF generated successfully.');
    } catch (e: any) {
      console.error(e);
      setMessage(`Failed to generate PDF: ${e?.message || e}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--primary)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg">
        <div className="flex items-center text-red-600 mb-4">
          <AlertCircle className="h-6 w-6 mr-2" />
          <h3 className="text-lg font-semibold">Error</h3>
        </div>
        <p className="text-gray-700 mb-4">{error}</p>
        {onClose && (
          <div className="flex justify-end">
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg">
      {/* Header: removed small download icon so the form has only the bottom Download button */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h2 className="text-xl font-semibold text-gray-900">
          Form 18 - Application for Award by Consent
          {form18Data && (
            <span className="ml-2 text-sm font-normal text-gray-600">
              {form18Data.DisplayIRN}
            </span>
          )}
        </h2>
        <div className="flex space-x-2">
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500" title="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div id="form18-content" className="bg-[#fffcf6] p-8 border border-gray-300 rounded-md">
          {/* Form Header */}
          <div className="text-center mb-6">
            <p className="italic">Workers' Compensation Act 1978.</p>
            <p className="text-sm">Act, Sec. 74.</p>
            <p className="text-sm">Reg., Sec.25.</p>
            <p className="text-right italic">Form 18</p>
            <p className="text-right">Register No. {form18Data?.DisplayIRN || ''}</p>
          </div>

          {/* Party Information */}
          <div className="mb-6">
            <p className="font-medium mt-4">IN RESPECT OF</p>

            <div className="mt-2 mb-4">
              <p className="font-bold">
                {workerData?.WorkerFirstName} {workerData?.WorkerLastName}
              </p>
              <p>{workerData?.WorkerAddress1}</p>
              {workerData?.WorkerAddress2 && <p>{workerData.WorkerAddress2}</p>}
              <p>
                {workerData?.WorkerCity}, {workerData?.WorkerProvince}
              </p>
              {workerData?.WorkerPOBox && <p>P.O. Box {workerData.WorkerPOBox}</p>}
            </div>

            <p className="italic">, a worker</p>

            <p className="font-medium mt-4">AND</p>

            <div className="mt-2 mb-4">
              <p className="font-bold">{employerData?.OrganizationName}</p>
              <p>{employerData?.Address1}</p>
              {employerData?.Address2 && <p>{employerData.Address2}</p>}
              <p>
                {employerData?.City}, {employerData?.Province}
              </p>
              {employerData?.POBox && <p>P.O. Box {employerData.POBox}</p>}
            </div>

            <p className="italic">, the employer</p>
          </div>

          {/* Application Content */}
          <div className="mb-6">
            <h4 className="text-center font-semibold mb-4">
              APPLICATION FOR AN AWARD BY CONSENT.
            </h4>

            <p className="mb-2">The Chief Commissioner,</p>
            <p className="mb-2">Office of Workers' Compensation,</p>

            <p className="mb-4">
              Application is made for a consent award by a tribunal in respect of an
              agreement reached between the abovenamed worker and employer, particulars
              of the agreement are as follows:—
            </p>

            <div className="border p-4 rounded-md bg-white mb-4 min-h-[100px]">
              {form18Data?.F18MEmployerDecisionReason && (
                <div className="mb-4">
                  <p className="font-medium">Employer's Decision Reason:</p>
                  <p>{form18Data.F18MEmployerDecisionReason}</p>
                </div>
              )}

              {form18Data?.F18MWorkerDecisionReason && (
                <div>
                  <p className="font-medium">Worker's Decision Reason:</p>
                  <p>{form18Data.F18MWorkerDecisionReason}</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <p className="font-medium">Date: {currentDate}</p>

              {form18Data?.F18MEmployerAcceptedDate && (
                <p>
                  Employer Accepted Date:{' '}
                  {new Date(form18Data.F18MEmployerAcceptedDate).toLocaleDateString()}
                </p>
              )}

              {form18Data?.F18MWorkerAcceptedDate && (
                <p>
                  Worker Accepted Date:{' '}
                  {new Date(form18Data.F18MWorkerAcceptedDate).toLocaleDateString()}
                </p>
              )}

              <p>Status: {form18Data?.F18MStatus || 'Pending'}</p>
            </div>
          </div>

          {/* Signature Section */}
          <div className="mt-8">
            <table className="w-full border-collapse border border-gray-400">
              <tbody>
                <tr>
                  <td className="border border-gray-400 p-4 w-1/2">
                    <p className="font-medium mb-2">Signed by or on behalf of the worker</p>
                    <div className="h-20"></div>
                  </td>
                  <td className="border border-gray-400 p-4 w-1/2">
                    <p className="font-medium mb-2">Signed by or on behalf of the employer</p>
                    <div className="h-20"></div>
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-400 p-4">
                    <p className="font-medium mb-2">In the presence of</p>
                    <div className="h-10"></div>
                  </td>
                  <td className="border border-gray-400 p-4">
                    <p className="font-medium mb-2">In the presence of</p>
                    <div className="h-10"></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Only action: Download to PDF */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleDownloadPdf}
            className="btn btn-primary flex items-center gap-2"
            disabled={!irn}
            title="Print Form18"
          >
            <Download className="h-4 w-4" />
            Print Form18
          </button>
        </div>

        {/* PDF generation feedback */}
        {message && (
          <div
            className={`mt-4 p-3 ${
              message.includes('Failed')
                ? 'bg-red-50 text-red-700'
                : 'bg-green-50 text-green-700'
            } rounded-md text-sm`}
          >
            {message}
          </div>
        )}

        {onClose && (
          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewForm18;

