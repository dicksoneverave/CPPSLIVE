// src/components/forms/ViewForm3.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabase';

interface ViewForm3Props {
  workerIRN: number;
  onClose?: () => void;      // optional when embedded
  embedded?: boolean;        // NEW: render inline without modal chrome
}

// ---------- helpers (mirrored from NewForm3) ----------
const normalizeStoragePath = (p?: string) => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  let s = p.replace(/^\/+/, '');
  s = s.replace(/^(?:cpps\/+)+/i, '');
  return s;
};
const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || '');
const safe = (val: any) => (val ?? '').toString();
const dateStr = (val: any) => (val ? new Date(val).toLocaleDateString() : '');

// Resolve storage path to a browser-usable URL
const resolveStorageUrl = async (rawPath?: string): Promise<string> => {
  try {
    if (!rawPath) return '';
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const path = normalizeStoragePath(rawPath);
    if (!path) return '';
    // public url first
    const { data: pub } = supabase.storage.from('cpps').getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    // fallback to signed url
    const { data: signed } = await supabase.storage
      .from('cpps')
      .createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl || '';
  } catch {
    return '';
  }
};

// map attachment display names -> keys we’ll keep on formData
const ATTACH_KEYS: Array<{ key: string; label: string }> = [
  { key: 'IMR',  label: 'Interim medical report' },
  { key: 'FMR',  label: 'Final medical report' },
  { key: 'SEC43',label: 'Section 43 application form' },
  { key: 'SS',   label: 'Supervisor statement' },
  { key: 'WS',   label: 'Witness statement' },
  { key: 'IWS',  label: "Injured workers statement" },
  { key: 'PTA',  label: 'Payslip at time of accident' },
  { key: 'TR',   label: 'Treatment records' },
  { key: 'PAR',  label: 'Police accident report' },
  { key: 'F18',  label: 'Form 18 Scan' },
  { key: 'MEX',  label: 'Medical Expenses' },
  { key: 'MISC', label: 'Misc Expenses' },
  { key: 'DED',  label: 'Deductions' },
];

// reverse lookup used when hydrating from formattachments
const ATTACH_TYPE_TO_KEY: Record<string, string> = {
  'Interim medical report': 'IMR',
  'Final medical report': 'FMR',
  'Section 43 application form': 'SEC43',
  'Supervisor statement': 'SS',
  'Witness statement': 'WS',
  "Injured workers statement": 'IWS',
  'Payslip at time of accident': 'PTA',
  'Treatment records': 'TR',
  'Police accident report': 'PAR',
  'Form 18 Scan': 'F18',
  'MedicalExpenses': 'MEX',
  'MiscExpenses': 'MISC',
  'Deductions': 'DED',
};

const ViewForm3: React.FC<ViewForm3Props> = ({ workerIRN, onClose, embedded = false }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // previews
  const [passportUrl, setPassportUrl] = useState('');
  const [scanUrl, setScanUrl] = useState('');
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string>('');

  const Lightbox: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({ src, alt, onClose }) => {
    if (!src) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        style={{ pointerEvents: 'auto' }}
      >
        <img
          src={src}
          alt={alt || 'preview'}
          className="max-h-[90vh] max-w-[95vw] rounded shadow-2xl cursor-zoom-out"
          onClick={(e) => e.stopPropagation()}
        />
      </div>,
      document.body
    );
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (workerIRN == null || Number.isNaN(workerIRN)) {
          throw new Error('Invalid IRN');
        }

        // 1) workerirn (we need WorkerID for related tables)
        const { data: workerIrnData, error: workerIrnError } = await supabase
          .from('workerirn')
          .select('WorkerID, FirstName, LastName, DisplayIRN')
          .eq('IRN', workerIRN)
          .single();
        if (workerIrnError) throw workerIrnError;
        if (!workerIrnData) throw new Error('Worker not found');

        // 2) form3master (may or may not exist)
        const { data: form3Data } = await supabase
          .from('form3master')
          .select('*')
          .eq('IRN', workerIRN)
          .maybeSingle();

        // 3) form1112master (include scan fields)
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('TimeBarred, IncidentDate, IncidentLocation, IncidentProvince, IncidentRegion, NatureExtentInjury, InjuryCause, InsuranceProviderIPACode, ImageName, PublicUrl')
          .eq('IRN', workerIRN)
          .maybeSingle();
        if (form1112Error) throw form1112Error;

        // 4) worker personal
        const { data: workerData } = await supabase
          .from('workerpersonaldetails')
          .select('*')
          .eq('WorkerID', workerIrnData.WorkerID)
          .maybeSingle();

        // 5) employment
        const { data: employmentData } = await supabase
          .from('currentemploymentdetails')
          .select('*')
          .eq('WorkerID', workerIrnData.WorkerID)
          .maybeSingle();

        // 6) provinces
        const { data: provinceData } = await supabase
          .from('dictionary')
          .select('DKey, DValue')
          .eq('DType', 'Province');

        // 7) dependants
        const { data: dependantData } = await supabase
          .from('dependantpersonaldetails')
          .select('*')
          .eq('WorkerID', workerIrnData.WorkerID);

        // 8) work history
        const { data: historyData } = await supabase
          .from('workhistory')
          .select('*')
          .eq('WorkerID', workerIrnData.WorkerID);

        // 9) insurance providers
        const { data: insuranceData } = await supabase
          .from('insurancecompanymaster')
          .select('*');

        // 10) insurance company details by IPA if present
        let insuranceDetails: any = null;
        if (form1112Data?.InsuranceProviderIPACode) {
          const { data: insData } = await supabase
            .from('insurancecompanymaster')
            .select('*')
            .eq('IPACODE', form1112Data.InsuranceProviderIPACode)
            .maybeSingle();
          if (insData) insuranceDetails = insData;
        }

        // 11) hydrate attachments (supporting docs)
        const { data: attachRows } = await supabase
          .from('formattachments')
          .select('AttachmentType, FileName')
          .eq('IRN', workerIRN);

        const attachPaths: Record<string, string> = {};
        const previewMap: Record<string, string> = {};
        for (const r of attachRows || []) {
          const key = ATTACH_TYPE_TO_KEY[(r as any).AttachmentType];
          const path = (r as any).FileName as string;
          if (!key || !path) continue;
          attachPaths[key] = path;
          // resolve preview (image and non-image)
          const url = await resolveStorageUrl(path);
          if (url) previewMap[key] = url;
        }

        // 12) merge display data
        const merged = {
          ...(form3Data || {}),
          WorkerID: workerIrnData.WorkerID,
          DisplayIRN: workerIrnData.DisplayIRN,
          WorkerFirstName: workerData?.WorkerFirstName || workerIrnData.FirstName,
          WorkerLastName: workerData?.WorkerLastName || workerIrnData.LastName,
          WorkerAliasName: workerData?.WorkerAliasName || '',
          WorkerDOB: workerData?.WorkerDOB || '',
          WorkerGender: workerData?.WorkerGender || '',
          WorkerMarried: workerData?.WorkerMarried || '',
          WorkerHanded: workerData?.WorkerHanded || 'Right',
          WorkerPlaceOfOriginVillage: workerData?.WorkerPlaceOfOriginVillage || '',
          WorkerPlaceOfOriginDistrict: workerData?.WorkerPlaceOfOriginDistrict || '',
          WorkerPlaceOfOriginProvince: workerData?.WorkerPlaceOfOriginProvince || '',
          WorkerPassportPhoto: workerData?.WorkerPassportPhoto || '',
          WorkerAddress1: workerData?.WorkerAddress1 || '',
          WorkerAddress2: workerData?.WorkerAddress2 || '',
          WorkerCity: workerData?.WorkerCity || '',
          WorkerProvince: workerData?.WorkerProvince || '',
          WorkerPOBox: workerData?.WorkerPOBox || '',
          WorkerEmail: workerData?.WorkerEmail || '',
          WorkerMobile: workerData?.WorkerMobile || '',
          WorkerLandline: workerData?.WorkerLandline || '',
          SpouseFirstName: workerData?.SpouseFirstName || '',
          SpouseLastName: workerData?.SpouseLastName || '',
          SpouseDOB: workerData?.SpouseDOB || '',
          SpousePlaceOfOriginVillage: workerData?.SpousePlaceOfOriginVillage || '',
          SpousePlaceOfOriginDistrict: workerData?.SpousePlaceOfOriginDistrict || '',
          SpousePlaceOfOriginProvince: workerData?.SpousePlaceOfOriginProvince || '',
          SpouseAddress1: workerData?.SpouseAddress1 || '',
          SpouseAddress2: workerData?.SpouseAddress2 || '',
          SpouseCity: workerData?.SpouseCity || '',
          SpouseProvince: workerData?.SpouseProvince || '',
          SpousePOBox: workerData?.SpousePOBox || '',
          SpouseEmail: workerData?.SpouseEmail || '',
          SpouseMobile: workerData?.SpouseMobile || '',
          SpouseLandline: workerData?.SpouseLandline || '',
          EmployerID: employmentData?.EmployerID || '',
          EmployercppsID: employmentData?.EmployerCPPSID || '',
          Occupation: employmentData?.Occupation || '',
          PlaceOfEmployment: employmentData?.PlaceOfEmployment || '',
          NatureOfEmployment: employmentData?.NatureOfEmployment || '',
          AverageWeeklyWage: employmentData?.AverageWeeklyWage || 0,
          SubContractorOrganizationName: employmentData?.SubContractorOrganizationName || '',
          SubContractorLocation: employmentData?.SubContractorLocation || '',
          SubContractorNatureOfBusiness: employmentData?.SubContractorNatureOfBusiness || '',
          GradualProcessInjury: (historyData || []).length > 0,
          IncidentDate: form1112Data?.IncidentDate || '',
          IncidentLocation: form1112Data?.IncidentLocation || '',
          IncidentProvince: form1112Data?.IncidentProvince || '',
          IncidentRegion: form1112Data?.IncidentRegion || '',
          NatureExtentInjury: form1112Data?.NatureExtentInjury || '',
          InjuryCause: form1112Data?.InjuryCause || '',
          InsuranceProviderIPACode: form1112Data?.InsuranceProviderIPACode || '',
          // applicant defaults (read-only view)
          ApplicantFirstName: workerData?.WorkerFirstName || workerIrnData.FirstName,
          ApplicantLastName: workerData?.WorkerLastName || workerIrnData.LastName,
          ApplicantAddress1: workerData?.WorkerAddress1 || '',
          ApplicantAddress2: workerData?.WorkerAddress2 || '',
          ApplicantCity: workerData?.WorkerCity || '',
          ApplicantProvince: workerData?.WorkerProvince || '',
          ApplicantPOBox: workerData?.WorkerPOBox || '',
          ApplicantEmail: workerData?.WorkerEmail || '',
          ApplicantMobile: workerData?.WorkerMobile || '',
          ApplicantLandline: workerData?.WorkerLandline || '',
          // scan fields from 11/12
          ImageName: form1112Data?.ImageName || '',
          PublicUrl: form1112Data?.PublicUrl || '',
          // supporting docs (paths)
          ...attachPaths,
          // insurance display
          ...(insuranceDetails
            ? {
                InsuranceCompanyOrganizationName: insuranceDetails.InsuranceCompanyOrganizationName || '',
                InsuranceCompanyAddress1: insuranceDetails.InsuranceCompanyAddress1 || '',
                InsuranceCompanyAddress2: insuranceDetails.InsuranceCompanyAddress2 || '',
                InsuranceCompanyCity: insuranceDetails.InsuranceCompanyCity || '',
                InsuranceCompanyProvince: insuranceDetails.InsuranceCompanyProvince || '',
                InsuranceCompanyPOBox: insuranceDetails.InsuranceCompanyPOBox || '',
                InsuranceCompanyLandLine: insuranceDetails.InsuranceCompanyLandLine || '',
              }
            : {}),
        };

        setFormData(merged);
        setDependants(dependantData || []);
        setWorkHistory(historyData || []);
        setProvinces(provinceData || []);
        setInsuranceProviders(insuranceData || []);

        // resolve previews
        const pUrl = await resolveStorageUrl(merged.WorkerPassportPhoto);
        setPassportUrl(pUrl);

        const scanCandidate = merged.PublicUrl || merged.ImageName;
        const sUrl = await resolveStorageUrl(scanCandidate);
        setScanUrl(sUrl);

        setAttachmentPreviews((prev) => ({ ...prev, ...previewMap }));
      } catch (err: any) {
        setError(err.message || 'Failed to load worker details');
      } finally {
        setLoading(false);
      }
    })();
  }, [workerIRN]);

	  // ---------- renderers ----------
  const renderWorkerDetails = () => (
    <div className="space-y-4">
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Worker IRN</label>
          <input value={safe(formData.DisplayIRN)} className="input" readOnly disabled />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input value={safe(formData.WorkerFirstName)} className="input" readOnly disabled />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input value={safe(formData.WorkerLastName)} className="input" readOnly disabled />
        </div>
        <div>
          {passportUrl ? (
            <img
              src={passportUrl}
              alt="Passport"
              className="rounded-lg border w-24 h-24 object-cover cursor-zoom-in"
              onClick={() => setLightboxSrc(passportUrl)}
              loading="lazy"
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Alias</label>
          <input value={safe(formData.WorkerAliasName)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input value={dateStr(formData.WorkerDOB)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <input value={safe(formData.WorkerGender)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <input value={safe(formData.WorkerMarried)} className="input" readOnly disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Handed</label>
          <input value={safe(formData.WorkerHanded)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin Village</label>
          <input value={safe(formData.WorkerPlaceOfOriginVillage)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin District</label>
          <input value={safe(formData.WorkerPlaceOfOriginDistrict)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin Province</label>
          <input value={safe(formData.WorkerPlaceOfOriginProvince)} className="input" readOnly disabled />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
        <textarea value={safe(formData.WorkerAddress1)} className="input" readOnly disabled rows={2} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
        <textarea value={safe(formData.WorkerAddress2)} className="input" readOnly disabled rows={2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input value={safe(formData.WorkerCity)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input value={safe(formData.WorkerProvince)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input value={safe(formData.WorkerPOBox)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input value={safe(formData.WorkerEmail)} className="input" readOnly disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input value={safe(formData.WorkerMobile)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input value={safe(formData.WorkerLandline)} className="input" readOnly disabled />
        </div>
      </div>
    </div>
  );

  const renderSpouseDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Spouse Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input value={safe(formData.SpouseFirstName)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input value={safe(formData.SpouseLastName)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input value={dateStr(formData.SpouseDOB)} className="input" readOnly disabled />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
        <textarea value={safe(formData.SpouseAddress1)} className="input" rows={2} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
        <textarea value={safe(formData.SpouseAddress2)} className="input" rows={2} readOnly disabled />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input value={safe(formData.SpouseCity)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input value={safe(formData.SpouseProvince)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input value={safe(formData.SpousePOBox)} className="input" readOnly disabled />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input value={safe(formData.SpouseEmail)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input value={safe(formData.SpouseMobile)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input value={safe(formData.SpouseLandline)} className="input" readOnly disabled />
        </div>
      </div>
    </div>
  );

  const renderDependantDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Dependent Children</h3>
      {dependants.length === 0 && (
        <div className="p-4 text-gray-500 text-sm">No dependants recorded.</div>
      )}
      {dependants.length > 0 && (
        <table className="min-w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 border">First Name</th>
              <th className="px-2 py-1 border">Last Name</th>
              <th className="px-2 py-1 border">DOB</th>
              <th className="px-2 py-1 border">Gender</th>
              <th className="px-2 py-1 border">Relation</th>
              <th className="px-2 py-1 border">Degree</th>
            </tr>
          </thead>
          <tbody>
            {dependants.map((d, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{safe(d.DependantFirstName)}</td>
                <td className="border px-2 py-1">{safe(d.DependantLastName)}</td>
                <td className="border px-2 py-1">{dateStr(d.DependantDOB)}</td>
                <td className="border px-2 py-1">{safe(d.DependantGender)}</td>
                <td className="border px-2 py-1">{safe(d.DependantType)}</td>
                <td className="border px-2 py-1">{safe(d.DependanceDegree)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Employment Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employer ID</label>
          <input value={safe(formData.EmployerID)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Employer CPPSID</label>
          <input value={safe(formData.EmployercppsID)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation</label>
          <input value={safe(formData.Occupation)} className="input" readOnly disabled />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Employment</label>
          <input value={safe(formData.PlaceOfEmployment)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
          <input value={safe(formData.NatureOfEmployment)} className="input" readOnly disabled />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
        <input value={safe(formData.AverageWeeklyWage)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subcontractor Organization Name</label>
        <input value={safe(formData.SubContractorOrganizationName)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subcontractor Location</label>
        <input value={safe(formData.SubContractorLocation)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subcontractor Nature of Business</label>
        <input value={safe(formData.SubContractorNatureOfBusiness)} className="input" readOnly disabled />
      </div>
    </div>
  );

  const renderWorkHistory = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Work History</h3>
      {workHistory.length === 0 && (
        <div className="p-4 text-gray-500 text-sm">No work history records found.</div>
      )}
      {workHistory.length > 0 && (
        <table className="min-w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1 border">Organization</th>
              <th className="px-2 py-1 border">Address</th>
              <th className="px-2 py-1 border">City</th>
              <th className="px-2 py-1 border">Province</th>
              <th className="px-2 py-1 border">P.O. Box</th>
              <th className="px-2 py-1 border">Landline</th>
              <th className="px-2 py-1 border">CPPSID</th>
              <th className="px-2 py-1 border">Joined</th>
              <th className="px-2 py-1 border">Left</th>
            </tr>
          </thead>
          <tbody>
            {workHistory.map((h, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{safe(h.OrganizationName)}</td>
                <td className="border px-2 py-1">{safe(h.OrganizationAddress1)}</td>
                <td className="border px-2 py-1">{safe(h.OrganizationCity)}</td>
                <td className="border px-2 py-1">{safe(h.OrganizationProvince)}</td>
                <td className="border px-2 py-1">{safe(h.OrganizationPOBox)}</td>
                <td className="border px-2 py-1">{safe(h.OrganizationLandline)}</td>
                <td className="border px-2 py-1">{safe(h.OrganizationCPPSID)}</td>
                <td className="border px-2 py-1">{dateStr(h.WorkerJoiningDate)}</td>
                <td className="border px-2 py-1">{dateStr(h.WorkerLeavingDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderInjuryDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Injury & Capacity Details</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700">Incident Date</label>
        <input value={dateStr(formData.IncidentDate)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Incident Location</label>
        <input value={safe(formData.IncidentLocation)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Province</label>
        <input value={safe(formData.IncidentProvince)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Region</label>
        <input value={safe(formData.IncidentRegion)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nature/Extent of Injury</label>
        <textarea value={safe(formData.NatureExtentInjury)} className="input" rows={3} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
        <textarea value={safe(formData.InjuryCause)} className="input" rows={3} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Disabilities Description</label>
        <textarea value={safe(formData.DisabilitiesDescription)} className="input" rows={2} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Incapacity Extent</label>
        <input value={safe(formData.IncapacityExtent)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Incapacity Description</label>
        <textarea value={safe(formData.IncapacityDescription)} className="input" rows={2} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Estimated Incapacity Duration</label>
        <input value={safe(formData.EstimatedIncapacityDuration)} className="input" readOnly disabled />
      </div>
    </div>
  );

  const renderCompensationClaimed = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Compensation Claimed</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700">Compensation Claim Details</label>
        <textarea value={safe(formData.CompensationClaimDetails)} className="input" rows={3} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Average Earnable Amount</label>
        <input value={safe(formData.AverageEarnableAmount)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Allowance Received</label>
        <input value={safe(formData.AllowanceReceived)} className="input" readOnly disabled />
      </div>
    </div>
  );

  const renderInsuranceDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Insurance Details</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider IPA Code</label>
        <input value={safe(formData.InsuranceProviderIPACode)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Company Name</label>
        <input value={safe(formData.InsuranceCompanyOrganizationName)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Address 1</label>
        <input value={safe(formData.InsuranceCompanyAddress1)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Address 2</label>
        <input value={safe(formData.InsuranceCompanyAddress2)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Company City</label>
        <input value={safe(formData.InsuranceCompanyCity)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Province</label>
        <input value={safe(formData.InsuranceCompanyProvince)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Company PO Box</label>
        <input value={safe(formData.InsuranceCompanyPOBox)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Landline</label>
        <input value={safe(formData.InsuranceCompanyLandLine)} className="input" readOnly disabled />
      </div>
    </div>
  );

  const renderApplicantDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Applicant Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input value={safe(formData.ApplicantFirstName)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input value={safe(formData.ApplicantLastName)} className="input" readOnly disabled />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
        <input value={safe(formData.ApplicantAddress1)} className="input" readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
        <input value={safe(formData.ApplicantAddress2)} className="input" readOnly disabled />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input value={safe(formData.ApplicantCity)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input value={safe(formData.ApplicantProvince)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input value={safe(formData.ApplicantPOBox)} className="input" readOnly disabled />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input value={safe(formData.ApplicantEmail)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input value={safe(formData.ApplicantMobile)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input value={safe(formData.ApplicantLandline)} className="input" readOnly disabled />
        </div>
      </div>
    </div>
  );

  // Form 3 Scan
  const renderForm3Scan = () => {
    const hasImage = !!scanUrl && isImagePath(formData?.ImageName || formData?.PublicUrl);
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Form 3 Scan</label>
        {scanUrl ? (
          hasImage ? (
            <img
              src={scanUrl}
              className="w-32 h-32 rounded border object-cover cursor-zoom-in"
              onClick={() => setLightboxSrc(scanUrl)}
              alt="Form 3 Scan"
              loading="lazy"
            />
          ) : (
            <a
              href={scanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              Open current file
            </a>
          )
        ) : (
          <div className="w-24 h-24 rounded border grid place-content-center text-xs text-gray-500">
            No scan found
          </div>
        )}
      </div>
    );
  };

  // Supporting Documents (thumbnails for images, links for others)
 // Supporting Documents (thumbnails for images, links for others)
const renderSupportingDocuments = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ATTACH_KEYS.map(({ key, label }) => {
        const pathVal = safe((formData as any)[key]); // raw storage path or url
        const preview = attachmentPreviews[key];      // resolved url
        const hasPreview = !!preview;

        return (
          <div
            key={key}
            className="space-y-2 rounded-lg border border-gray-200 p-3 bg-white"
          >
            <label className="block text-sm font-medium text-gray-700">
              {label}
            </label>

            {hasPreview ? (
              isImagePath(pathVal) ? (
                <img
                  src={preview}
                  alt={`${label} preview`}
                  className="w-28 h-28 object-cover rounded border cursor-zoom-in"
                  onClick={() => setLightboxSrc(preview)}
                  loading="lazy"
                />
              ) : (
                <a
                  href={preview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm break-all"
                >
                  Open current file
                </a>
              )
            ) : pathVal ? (
              // keep existing functionality (resolve on click)
              <button
                type="button"
                className="text-primary hover:underline text-sm break-all"
                onClick={async () => {
                  const url = await resolveStorageUrl(pathVal);
                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                Open current file
              </button>
            ) : (
              <div className="text-xs text-gray-500">Not attached</div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);


  // Tabs
  const tabs = useMemo(
    () => [
      { name: 'Worker Details', render: renderWorkerDetails },
      { name: 'Spouse Details', render: renderSpouseDetails },
      { name: 'Dependent Children', render: renderDependantDetails },
      { name: 'Employment', render: renderEmploymentDetails },
      { name: 'Work History', render: renderWorkHistory },
      { name: 'Injury & Capacity', render: renderInjuryDetails },
      { name: 'Compensation', render: renderCompensationClaimed },
      { name: 'Insurance', render: renderInsuranceDetails },
      { name: 'Applicant', render: renderApplicantDetails },
      { name: 'Form 3 Scan', render: renderForm3Scan },
      { name: 'Supporting Documents', render: renderSupportingDocuments },
    ],
    [attachmentPreviews, scanUrl, passportUrl, dependants, workHistory, formData]
  );

	  // ---------- embedded-aware wrapper ----------
  return (
    <div className={embedded ? '' : 'fixed inset-0 flex items-center justify-center bg-black/40 z-50'}>
      <div className={embedded ? '' : 'relative bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[95vh] overflow-y-auto p-6'}>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-500 hover:text-black rounded-full focus:outline-none focus:ring-2 focus:ring-primary p-2"
          >
            <X size={24} />
          </button>
        )}

        <h2 className="text-2xl font-bold mb-2">View Form 3</h2>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <span className="text-gray-700">Loading...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center p-6 text-red-600">
            <AlertCircle size={48} />
            <span className="mt-4">{error}</span>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
              {tabs.map((t, idx) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setCurrentTab(idx + 1)}
                  className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                    currentTab === idx + 1
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            <div className="py-2">{tabs[currentTab - 1].render()}</div>
          </>
        )}
      </div>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc('')} />}

      {/* local style for .input */}
      <style>{`
        .input {
          background: #f8fafc;
          border: 1px solid #d1d5db;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          font-size: 1rem;
          width: 100%;
          color: #374151;
        }
        .input:disabled, .input[readonly] {
          color: #6b7280;
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
};

export default ViewForm3;
