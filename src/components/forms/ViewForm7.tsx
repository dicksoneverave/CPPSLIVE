import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Printer, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/common/Logo';

interface ViewForm7Props {
  irn: string;
  incidentType: string;
  onClose: () => void;
}

interface Form7Data {
  id: string;
  irn: string;
  form_type: 'Form7';
  submission_date: string;
  worker_first_name: string;
  worker_last_name: string;
  worker_address: string;
  employer_name: string;
  employer_address: string;
  employer_contact: string;
  incident_date: string;
  incident_type: string;
  injury_description: string;
  compensation_amount: number;
  status: string;
}

interface EmploymentData {
  id: string;
  worker_id: string;
  employer_id: string;
  employment_start_date: string;
  employment_end_date: string;
  position: string;
  department: string;
  location: string;
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

interface WorkerData {
  WorkerID: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerAddress1: string;
  WorkerAddress2: string;
  WorkerDateOfBirth: string;
  WorkerAnnualWage: number;
}

const ViewForm7: React.FC<ViewForm7Props> = ({ irn, incidentType, onClose }) => {
  const { profile, loading: authLoading } = useAuth();
  const [form7Data, setForm7Data] = useState<Form7Data | null>(null);
  const [employertData, setEmployerData] = useState<EmployerData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workerData, setWorkerData] = useState<WorkerData | null>(null);
  const [loading, setLoading] = useState(true); // Add loading state
	const [cedData, cedError] = useState<CedData | null>(null);

  const fetchForm7Data = useCallback(async () => {
    try {
      const { data: form7, error: form7Error } = await supabase
        .from('form7master')
        .select('*')
        .eq('IRN', irn)
        .maybeSingle();

      if (form7Error) {
        console.error('Error loading Form7 data:', form7Error.message);
        setError('Form7 data could not be loaded.');
        return;
      }

      if (!form7) {
        setError('No Form7 data found for the given IRN.');
        return;
      }

      setForm7Data(form7);

      const { data: form1112Data, error: form1112Error } = await supabase
        .from('form1112master')
        .select('WorkerID')
        .eq('IRN', irn)
        .maybeSingle();

      if (form1112Error) {
        console.error('Error fetching WorkerID:', form1112Error.message);
        setError('WorkerID could not be retrieved.');
        return;
      }

      if (!form1112Data?.WorkerID) {
        setError('WorkerID is missing for this IRN.');
        return;
      }

      const { data: workerData, error: workerError } = await supabase
        .from('workerpersonaldetails')
        .select('*')
        .eq('WorkerID', form1112Data.WorkerID)
        .single();

      if (workerError) {
        throw workerError;
      }

      setWorkerData(workerData);

      const { data: employerData, error: employerError } = await supabase
        .from('employermaster')
        .select('*')
        .eq('CPPSID', form7.EmployerCPPSID)
        .maybeSingle();
console.log('employermastervCPPSID:', form7.EmployerCPPSID);
		
      if (employerError && employerError.code !== 'PGRST116') {
        throw employerError;
      }

      if (employerData) {
        setEmployerData(employerData);
      } else {
        const { data: cedData, error: cedError } = await supabase
          .from('currentemploymentdetails')
          .select('PlaceOfEmployment, EmployerCPPSID')
          .eq('WorkerID', form1112Data.WorkerID)
          .maybeSingle();
    console.log('currentemploymentdetailsCPPSID:', EmployerCPPSID);
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
            OrganizationType: '',
            id: '',
            worker_id: '',
            employer_id: '',
            employment_start_date: '',
            employment_end_date: '',
            position: '',
            department: '',
            location: ''
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching Form7 data:', err.message);
      setError(err.message || 'Failed to load Form7 data');
    } finally {
      setLoading(false);
    }
  }, [irn]);

  useEffect(() => {
    fetchForm7Data();
  }, [fetchForm7Data]);

  const generatePDF = () => {
    if (!form7Data) {
      setError('Please select a valid claim to generate Form7');
      return;
    }

    setIsGenerating(true);

    const htmlContent = `
      <html>
        <head>
          <style>
            .custom-btn {
              text-transform: none !important;
            }
            div1 {
              background-color: #fffcf6;
              padding: 20px;
              font-family: Arial, sans-serif;
            }
            #para1 {
              text-align: center;
              font-style: italic;
            }
            #para2 {
              text-align: right;
              font-style: italic;
            }
            table, th, td {
              border: 1px solid black;
              border-collapse: collapse;
              padding: 8px;
            }
          </style>
        </head>
        <body>
          <div1>
            <p id="para1">Workers' Compensation Act 1978.</p>
            <p>Form 7</p>
            <p></p>
            <p id="para2">Form7</p>
            <p>Register No. . . . 20...</p>
            <p>IN RESPECT OF</p>

            <p>${form7Data?.worker_first_name || ''} ${form7Data?.worker_last_name || ''}</p>
            <p>${form7Data?.worker_address || ''}</p>

            <p>, a worker</p>

            <p>AND</p>
            <p>${form7Data?.employer_name || ''}</p>
            <p>${form7Data?.employer_address || ''}</p>

            <p>, the employer</p>

            <p id="para1">EMPLOYERS ANSWER TO APPLICATION FOR COMPENSATION.</p>
            <p>The Registrar,</p>
            <p>Office of Workers' Compensation,</p>
            <p>Department of Labour & Industrial Relations.</p>
            <p>P O Box 5308.</p>
            <p>Boroko</p>
            <p>The employer intends to oppose the application for compensation. The following is a concise statement of the extent and grounds of his opposition -</p>

            <p>Date: ${new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}</p>
            <p>------------------------</p>
            <p>(Signature of Employer)</p>
            <p>NOTE: The answer may be signed by the employer, his lawyer or other agent.</p>
          </div1>
        </body>
      </html>
    `;

    html2pdf()
      .from(htmlContent)
      .save();

    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Form 7 - Award Certificate</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Form 7 - Award Certificate</h1>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6">
          <p className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </p>
        </div>
        <button
          onClick={onClose}
          className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark transition-all"
        >
          Back to List
        </button>
      </div>
    );
  }

  return (
   <div id="form6-content" className="bg-white p-8 border border-gray-300 rounded-md shadow-sm">
      <Logo size={128} className="mx-auto my-4" />

      <div className="text-center italic mb-6">
        <p>Workers' Compensation Act 1978.</p>
        <p>Form 7</p>
        <p id="para2" className="text-right italic">Form7</p>
        <p>Register No. . . . 20...</p>
        <p>IN RESPECT OF</p>
      </div>

      <div className="mb-6">
        <p>{workerData?.WorkerFirstName} {workerData?.WorkerLastName}</p>
        <p>{workerData?.WorkerAddress1}</p>
				{/*<p>{workerData?.WorkerAddress2}</p>*/}
				<p>, a worker</p>
      </div>

      <div className="mb-6">
        <p>AND</p>
        <p>{employertData?.OrganizationName}</p>
        <p>{employertData?.Address1}</p>
				{/*<p>{employertData?.Address2}</p>*/}
				<p>, the employer</p>
      </div>
	  
      <div className="mb-6">
        <p className="text-center italic">EMPLOYERS ANSWER TO APPLICATION FOR COMPENSATION.</p>
        <p>The Registrar,</p>
        <p>Office of Workers' Compensation,</p>
        <p>Department of Labour & Industrial Relations.</p>
        <p>P O Box 5308.</p>
        <p>Boroko</p>
        <p>The employer intends to oppose the application for compensation. The following is a concise statement of the extent and grounds of his opposition -</p>
      </div>

      <div className="mb-6">
        <p>Date: {new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })}</p>
        <p>------------------------</p>
        <p>(Signature of Employer)</p>
        <p>NOTE: The answer may be signed by the employer, his lawyer or other agent.</p>
      </div>

		 {/*  <div className="flex justify-end mt-8">
        <button
          onClick={generatePDF}
          disabled={isGenerating}
          className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 transform hover:scale-105"
        >
          {isGenerating ? 'Generating...' : 'Generate PDF'}
        </button>
      </div> */}
    </div>
  );
};

export default ViewForm7;
