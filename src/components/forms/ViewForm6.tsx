import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Printer, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js'; // Corrected import statement
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/common/Logo';

interface ViewForm6Props {
  irn: string;
	incidentType: string;
}

interface Form6Data {
  IRN: string;
  DisplayIRN: string;
  IncidentType: string;
  F6MStatus: string;
  F6MApprovalDate: string | null;
  CPOInCharge: string;
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

const ViewForm6: React.FC<ViewForm6Props> = ({ irn }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form6Data, setForm6Data] = useState<Form6Data | null>(null);
  const [workerData, setWorkerData] = useState<WorkerData | null>(null);
  const [employerData, setEmployerData] = useState<EmployerData | null>(null);
  const [currentDate] = useState<string>(new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Form6 data
      const { data: form6Data, error: form6Error } = await supabase
        .from('form6master')
        .select('*')
        .eq('IRN', irn)
      //  .eq('IncidentType')
        .single();

      if (form6Error) {
        throw form6Error;
      }

      setForm6Data(form6Data);

      // Fetch worker data from form1112master to get WorkerID
      const { data: form1112Data, error: form1112Error } = await supabase
        .from('form1112master')
        .select('WorkerID')
        .eq('IRN', irn)
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

      setWorkerData(workerData);

      // Fetch employer details
      const { data: employerData, error: employerError } = await supabase
        .from('employermaster')
        .select('*')
        .eq('CPPSID', form6Data.EmployerCPPSID)
        .maybeSingle();

      if (employerError && employerError.code !== 'PGRST116') {
        throw employerError;
      }

      if (employerData) {
        setEmployerData(employerData);
      } else {
        // Try to get employer details from currentemploymentdetails
        const { data: cedData, error: cedError } = await supabase
          .from('currentemploymentdetails')
          .select('PlaceOfEmployment, EmployerCPPSID')
          .eq('WorkerID', form1112Data.WorkerID)
          .maybeSingle();

        if (!cedError && cedData) {
          setEmployerData({
            OrganizationName: cedData.PlaceOfEmployment,
            Address1: '',
            Address2: '',
            City: '',
            Province: '',
            POBox: '',
            Website: '',
            MobilePhone: '',
            LandLine: '',
            Fax: '',
            OrganizationType: ''
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching Form6 data:', err);
      setError(err.message || 'Failed to load Form6 data');
    } finally {
      setLoading(false);
    }
  }, [irn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const content = document.getElementById('form6-content');
    if (!content) return;

    html2pdf(content, {
      margin: 10,
      filename: 'Form6.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    });
  }; */

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-700">Loading Form 6 data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center text-red-600 mb-4">
          <AlertCircle className="h-6 w-6 mr-2" />
          <h3 className="text-lg font-semibold">Error</h3>
        </div>
        <p className="text-gray-700 mb-4">{error}</p>
      </div>
    );
  }

  return (
   <div id="form6-content" className="bg-white p-8 border border-gray-300 rounded-md shadow-sm">
      <Logo size={128} className="mx-auto my-4" />
	
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Workers' Compensation Act 1978</h3>
        <p className="text-sm italic">Reg., Sec. 8(1)(b).</p>
        <p className="text-right text-sm italic">Form 6</p>
      </div>

      <div className="mb-6">
        <p className="text-right">Register No. {form6Data?.DisplayIRN || ''}</p>
        <p className="font-medium mt-4">IN RESPECT OF</p>

        <div className="mt-2 mb-4">
          <p>{workerData?.WorkerFirstName} {workerData?.WorkerLastName}</p>
          <p>{workerData?.WorkerAddress1}</p>
          {workerData?.WorkerAddress2 && <p>{workerData.WorkerAddress2}</p>}
          <p>{workerData?.WorkerCity}, {workerData?.WorkerProvince}</p>
          {workerData?.WorkerPOBox && <p>P.O. Box {workerData.WorkerPOBox}</p>}
        </div>

        <p className="italic">a worker</p>

        <p className="font-medium mt-4">AND</p>

        <div className="mt-2 mb-4">
          <p>{employerData?.OrganizationName}</p>
          <p>{employerData?.Address1}</p>
          {employerData?.Address2 && <p>{employerData.Address2}</p>}
          <p>{employerData?.City}, {employerData?.Province}</p>
          {employerData?.POBox && <p>P.O. Box {employerData.POBox}</p>}
        </div>

        <p className="italic">the employer</p>
      </div>

      <div className="mb-6">
        <h4 className="text-center font-semibold mb-4">NOTICE TO EMPLOYER AS TO APPLICATION FOR COMPENSATION.</h4>

        <p className="mb-4">
          TAKE NOTICE that, if you intend to oppose the application, of which a copy is served with this notice,
          you must lodge with me, within one calendar month after the service, a written answer to it containing
          a concise statement of the extent and grounds of your opposition.
        </p>

        <p className="mb-6">
          AND FURTHER TAKE NOTICE that in default of your lodging with me, within the time specified, a written
          answer as required a tribunal may make such an award as it deems just and expedient.
        </p>
      </div>

      <div className="mt-8">
        <div className="flex justify-between">
          <div>
            <p>Date: {currentDate}</p>
            <p>Status: {form6Data?.F6MStatus || 'Pending'}</p>
            {form6Data?.F6MApprovalDate && (
              <p>Approval Date: {new Date(form6Data.F6MApprovalDate).toLocaleDateString()}</p>
            )}
          </div>
          <div className="text-right">
            <p className="italic">Registrar</p>
            {form6Data?.CPOInCharge && <p>Officer: {form6Data.CPOInCharge}</p>}
          </div>
        </div>
      </div>

		 {/*} <div className="mt-6 flex justify-end">
        <button
          onClick={handlePrint}
          className="text-gray-500 hover:text-gray-700 p-1 mr-4"
          title="Print"
        >
          <Printer className="h-5 w-5" />
        </button>
        <button
          onClick={handleDownload}
          className="text-gray-500 hover:text-gray-700 p-1"
          title="Download"
        >
          <Download className="h-5 w-5" />
        </button>
      </div> */}
    </div>
  );
};

export default ViewForm6;
