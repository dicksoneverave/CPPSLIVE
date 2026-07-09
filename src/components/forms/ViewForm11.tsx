import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';

// -----------------------------
// Utilities
// -----------------------------
const normalizeStoragePath = (p?: string) => {
  if (!p) return '';
  if (p.startsWith('http')) return p; // already a URL
  let s = p.replace(/^\/+/, ''); // trim leading slashes
  s = s.replace(/^(?:cpps\/+)+/i, ''); // remove leading cpps/
  return s;
};

// Safe render accessors
const s = (v: unknown) => (v ?? '') as string;
const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
const b = (v: unknown) => !!v;



// -----------------------------
// Types
// -----------------------------

interface ViewForm11Props {
  /**
   * IMPORTANT: keep workerId as the only identifier passed from parent.
   * The component will look up the latest Form 11 for this worker automatically.
   */
  workerId?: string | null;
  irn?: number | string | null;
  onClose?: () => void;
  /**
   * If true, renders inline with no modal backdrop and no fixed sizing,
   * so it can be embedded inside any page/route.
   */
  embedded?: boolean;
}


interface Form11Data {
  // Worker Personal Details
  WorkerID: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerDOB: string;
  WorkerGender: string;
  WorkerMarried: string;
  WorkerHanded: string;
  WorkerPlaceOfOriginVillage: string;
  WorkerPlaceOfOriginDistrict: string;
  WorkerPlaceOfOriginProvince: string;
  WorkerAddress1: string;
  WorkerAddress2: string;
  WorkerCity: string;
  WorkerProvince: string;
  WorkerPOBox: string;
  WorkerEmail: string;
  WorkerMobile: string;
  WorkerLandline: string;
  WorkerPassportPhoto?: string;

  // Employment Details
  EmploymentID: string;
  Occupation: string;
  PlaceOfEmployment: string;
  NatureOfEmployment: string;
  AverageWeeklyWage: number;
  WeeklyPaymentRate: number;
  WorkedUnderSubContractor: boolean;
  SubContractorOrganizationName: string;
  SubContractorLocation: string;
  SubContractorNatureOfBusiness: string;

  // Incident Details (Form 11 core)
	// Incident Details (Form 11 core)
ReceivedDate: string;   // <- NEW (Form Received Date)
BodyPart: string;       // <- NEW (Body part)

  IncidentDate: string;
  IncidentLocation: string;
  IncidentProvince: string;
  IncidentRegion: string;
  NatureExtentInjury: string;
  InjuryCause: string;
  HandInjury: boolean;
  InjuryMachinery: boolean;
  MachineType: string;
  MachinePartResponsible: string;
  MachinePowerSource: string;
  GradualProcessInjury: boolean;

  // Dependant Details (view-only snapshot from master tables)
  SpouseFirstName: string;
  SpouseLastName: string;
  SpouseDOB: string;
  SpousePlaceOfOriginVillage: string;
  SpousePlaceOfOriginDistrict: string;
  SpousePlaceOfOriginProvince: string;
  SpouseAddress1: string;
  SpouseAddress2: string;
  SpouseCity: string;
  SpouseProvince: string;
  SpousePOBox: string;
  SpouseEmail: string;
  SpouseMobile: string;
  SpouseLandline: string;
  WorkerHaveDependants: boolean;

  // Insurance Details
  InsuranceProviderIPACode: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;

  // Form Attachments (paths)
  ImageName: string;
  PublicUrl: string;
  IMR: string;
  FMR: string;
  SEC43: string;
  SS: string;
  WS: string;
  IWS: string;
  PTA: string;
  TR: string;
  PAR: string;
  F18?: string;
  MEX?: string;
  MISC?: string;
  DED?: string;

  // System fields
  DisplayIRN: string;
  TimeBarred: boolean;
  FirstSubmissionDate: string;
  IncidentType: string; // 'Injury' | 'Death' etc. For Form 11 keep 'Injury'
}

// A tiny sanitation helper to ensure we never set undefineds into inputs
const sanitizeForForm = <T extends Record<string, any>>(base: T, incoming: Partial<T>): Partial<T> => {
  const out: Partial<T> = {};
  const merged = { ...incoming };
  for (const k in base) {
    const baseV = (base as any)[k];
    const v = (merged as any)[k];
    if (typeof baseV === 'string') (out as any)[k] = v == null ? '' : String(v);
    else if (typeof baseV === 'number') (out as any)[k] = v == null || v === '' ? 0 : Number(v);
    else if (typeof baseV === 'boolean') (out as any)[k] = !!v;
    else (out as any)[k] = v ?? baseV ?? '';
  }
  return out;
};

// -----------------------------
// Component (READ-ONLY VIEW)
// -----------------------------
const ViewForm11: React.FC<ViewForm11Props> = ({ workerId, irn, onClose, embedded = false }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provinces, setProvinces] = useState<{ DKey: string; DValue: string }[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [currentEmployerData, setCurrentEmployerData] = useState<any>(null);

  // Passport + scan + attachment previews
  const [passportUrl, setPassportUrl] = useState('');
  const [scanUrl, setScanUrl] = useState('');
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});

// Unified preview helpers (aligns with SearchAttachments’ approach)
const isPreviewable = (u?: string) => /\.(png|jpe?g|gif|webp|pdf)$/i.test(u || '');
const isImageUrl    = (u?: string) => /\.(png|jpe?g|gif|webp)$/i.test(u || '');
const isPdfUrl      = (u?: string) => /\.pdf$/i.test(u || '');

const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const openPreview  = (url?: string | null) => url ? setPreviewUrl(url) : null;
const closePreview = () => setPreviewUrl(null);
	

  // Resolve a Supabase Storage path to a browser-usable URL.
  const resolveStorageUrl = async (rawPath: string): Promise<string | null> => {
    try {
      if (!rawPath) return null;
      if (/^https?:\/\//i.test(rawPath)) return rawPath;
      const path = normalizeStoragePath(rawPath);
      if (!path) return null;
      const { data: pub } = supabase.storage.from('cpps').getPublicUrl(path);
      if (pub?.publicUrl) return pub.publicUrl;
      const { data: signed } = await supabase.storage.from('cpps').createSignedUrl(path, 60 * 60 * 24);
      return signed?.signedUrl ?? null;
    } catch (e) {
      console.error('resolveStorageUrl failed for', rawPath, e);
      return null;
    }
  };

  // Map attachment display types in DB -> our form keys
  const attachmentTypeToKey: Record<string, string> = {
    'Interim medical report': 'IMR',
    'Final medical report': 'FMR',
    'Section 43 application form': 'SEC43',
    'Supervisor statement': 'SS',
    'Witness statement': 'WS',
    "Injured workers statement": 'IWS',
    'Payslip at the time of accident': 'PTA',
    'Treatment records': 'TR',
    'Police accident report': 'PAR',
    'Form 18 Scan': 'F18',
    'MedicalExpenses': 'MEX',
    'MiscExpenses': 'MISC',
    'Deductions': 'DED',
  };

  // Load attachment rows for an IRN and hydrate image/link previews
  const fetchAndHydrateAttachments = async (irnNum: number) => {
    try {
      const { data: rows, error } = await supabase
        .from('formattachments')
        .select('AttachmentType, FileName')
        .eq('IRN', irnNum);
      if (error) throw error;

      const newPaths: Partial<Form11Data> = {};
      const previewUpdates: Record<string, string> = {};

      for (const r of rows || []) {
        const key = attachmentTypeToKey[(r as any).AttachmentType];
        const filePath = (r as any).FileName as string;
        if (!key || !filePath) continue;
        (newPaths as any)[key] = filePath; // keep the last seen (treat as latest)

        if (isImagePath(filePath)) {
          const url = await resolveStorageUrl(filePath);
          if (url) previewUpdates[key] = url;
        } else {
          const url = await resolveStorageUrl(filePath);
          if (url) previewUpdates[key] = url;
        }
      }

      if (Object.keys(newPaths).length) {
        setFormData((prev) => ({ ...prev, ...(newPaths as any) }));
      }
      if (Object.keys(previewUpdates).length) {
        setAttachmentPreviews((prev) => ({ ...prev, ...previewUpdates }));
      }
    } catch (e) {
      console.error('Failed to load attachments for IRN', irnNum, e);
    }
  };

  // The IRN being viewed (looked up from form1112master)
  const [viewIRN, setViewIRN] = useState<number | null>(null);

  // Base defaults
  const base: Form11Data = useMemo(
    () => ({
      WorkerID: workerId || '',
      WorkerFirstName: '',
      WorkerLastName: '',
      WorkerDOB: '',
      WorkerGender: '',
      WorkerMarried: '',
      WorkerHanded: 'Right',
      WorkerPlaceOfOriginVillage: '',
      WorkerPlaceOfOriginDistrict: '',
      WorkerPlaceOfOriginProvince: '',
      WorkerAddress1: '',
      WorkerAddress2: '',
      WorkerCity: '',
      WorkerProvince: '',
      WorkerPOBox: '',
      WorkerEmail: '',
      WorkerMobile: '',
      WorkerLandline: '',
      WorkerPassportPhoto: '',
      EmploymentID: '',
      Occupation: '',
      PlaceOfEmployment: '',
      NatureOfEmployment: '',
      AverageWeeklyWage: 0,
      WeeklyPaymentRate: 0,
      WorkedUnderSubContractor: false,
      SubContractorOrganizationName: '',
      SubContractorLocation: '',
      SubContractorNatureOfBusiness: '',
      IncidentDate: '',
      IncidentLocation: '',
      IncidentProvince: '',
      IncidentRegion: '',
      NatureExtentInjury: '',
      InjuryCause: '',
      HandInjury: false,
      InjuryMachinery: false,
      MachineType: '',
      MachinePartResponsible: '',
      MachinePowerSource: '',
      GradualProcessInjury: false,
      SpouseFirstName: '',
      SpouseLastName: '',
      SpouseDOB: '',
      SpousePlaceOfOriginVillage: '',
      SpousePlaceOfOriginDistrict: '',
      SpousePlaceOfOriginProvince: '',
      SpouseAddress1: '',
      SpouseAddress2: '',
      SpouseCity: '',
      SpouseProvince: '',
      SpousePOBox: '',
      SpouseEmail: '',
      SpouseMobile: '',
      SpouseLandline: '',
      WorkerHaveDependants: false,
      InsuranceProviderIPACode: '',
      InsuranceCompanyOrganizationName: '',
      InsuranceCompanyAddress1: '',
      InsuranceCompanyAddress2: '',
      InsuranceCompanyCity: '',
      InsuranceCompanyProvince: '',
      InsuranceCompanyPOBox: '',
      InsuranceCompanyLandLine: '',
      ImageName: '',
      PublicUrl: '',
      IMR: '',
      FMR: '',
      SEC43: '',
      SS: '',
      WS: '',
      IWS: '',
      PTA: '',
      TR: '',
      PAR: '',
      F18: '',
      MEX: '',
      MISC: '',
      DED: '',
      DisplayIRN: '',
      TimeBarred: false,
      FirstSubmissionDate: '',
      IncidentType: 'Injury',
			ReceivedDate: '',
      BodyPart: '',

    }),
    [workerId]
  );

  const [formData, setFormData] = useState<Form11Data>(base);

  // -----------------------------
  // Data loading
  // -----------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Reference data
        const { data: provinceData } = await supabase
          .from('dictionary')
          .select('DKey, DValue')
          .eq('DType', 'Province');
        if (!cancelled) setProvinces(provinceData || []);

        const { data: providers } = await supabase
          .from('insurancecompanymaster')
          .select('IPACODE, InsuranceCompanyOrganizationName');
        if (!cancelled) setInsuranceProviders(providers || []);

        // Load existing Form 11 row first (to get WorkerID if prop was not provided)
        let formRow: any = null;
        if (irn) {
          const { data, error } = await supabase
            .from('form1112master')
            .select('*')
            .eq('IRN', irn)
            .maybeSingle();
          if (error) throw error;
          formRow = data;
        } else if (workerId) {
          const { data: formRows, error } = await supabase
            .from('form1112master')
            .select('*')
            .eq('WorkerID', workerId)
            .order('IRN', { ascending: false })
            .limit(1);
          if (error) throw error;
          formRow = formRows?.[0] || null;
        }
        if (!cancelled && formRow?.IRN) setViewIRN(formRow.IRN);

        const resolvedWorkerId = workerId || formRow?.WorkerID || '';

        let workerData: any = null;
        let employmentData: any = null;
        let depData: any[] = [];
        let historyData: any[] = [];

        if (resolvedWorkerId) {
          // 2) Worker & employment
          const { data: wData } = await supabase
            .from('workerpersonaldetails')
            .select('*')
            .eq('WorkerID', resolvedWorkerId)
            .single();
          workerData = wData;

          const { data: empData } = await supabase
            .from('currentemploymentdetails')
            .select('*')
            .eq('WorkerID', resolvedWorkerId)
            .maybeSingle();
          employmentData = empData;

          let employerData: any = null;
          if (employmentData?.EmployerCPPSID) {
            const { data: em } = await supabase
              .from('employermaster')
              .select('*')
              .eq('CPPSID', employmentData.EmployerCPPSID)
              .limit(1);
            employerData = em?.[0] || null;
            if (!cancelled && employerData) setCurrentEmployerData(employerData);
          }

          // 3) Dependants & work history
          const { data: dData } = await supabase
            .from('dependantpersonaldetails')
            .select('*')
            .eq('WorkerID', resolvedWorkerId);
          depData = dData || [];
          if (!cancelled) setDependants(depData);

          const { data: hData } = await supabase
            .from('workhistory')
            .select('*')
            .eq('WorkerID', resolvedWorkerId);
          historyData = hData || [];
          if (!cancelled) setWorkHistory(historyData);
        }

        // 5) Merge into formData
        const merged = {
          ...base,
          WorkerID: resolvedWorkerId,
          ...workerData,
          ...employmentData,
          ...formRow,
          WorkerHaveDependants: depData.length > 0,
        } as Partial<Form11Data>;
        const sanitized = sanitizeForForm(base, merged) as Form11Data;
        if (!cancelled) setFormData(sanitized);
      } catch (e) {
        console.error('Initial load failed', e);
        if (!cancelled) setError('Failed to load form data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerId, irn]);

  // Auto-fill region from province
  useEffect(() => {
    const fetchRegion = async () => {
      if (!formData.IncidentProvince) {
        setFormData((prev) => ({ ...prev, IncidentRegion: '' }));
        return;
      }
      try {
        const { data, error } = await supabase
          .from('dictionary')
          .select('DValue')
          .eq('DType', 'ProvinceRegion')
          .eq('DKey', formData.IncidentProvince)
          .single();
        if ((error as any)?.code === 'PGRST116') {
          setFormData((prev) => ({ ...prev, IncidentRegion: '' }));
          return;
        }
        if (error) throw error;
        setFormData((prev) => ({ ...prev, IncidentRegion: data?.DValue || '' }));
      } catch (e) {
        console.error('Region lookup failed', e);
        setFormData((prev) => ({ ...prev, IncidentRegion: '' }));
      }
    };
    fetchRegion();
  }, [formData.IncidentProvince]);

  // Resolve worker passport photo whenever the path changes
  useEffect(() => {
    (async () => {
      const raw = s((formData as any).WorkerPassportPhoto);
      if (!raw) {
        setPassportUrl('');
        return;
      }
      const url = await resolveStorageUrl(raw);
      setPassportUrl(url || '');
    })();
  }, [formData.WorkerPassportPhoto]);

  // Resolve Form 11 scan preview URL whenever ImageName changes
  useEffect(() => {
    (async () => {
      const path = s((formData as any).ImageName);
      if (path) {
        const url = await resolveStorageUrl(path);
        setScanUrl(url || '');
      } else {
        setScanUrl('');
      }
    })();
  }, [formData.ImageName]);

  // After we know which IRN we're viewing, load its attachments and hydrate previews
  useEffect(() => {
    if (!viewIRN) return;
    fetchAndHydrateAttachments(viewIRN);
  }, [viewIRN]);

  // When the InsuranceProviderIPACode is set/changed (including after initial load),
  // fetch and hydrate the company details into the read-only fields.
  useEffect(() => {
    const loadInsuranceByIPACode = async (ipaCode?: string | null) => {
      try {
        if (!ipaCode) {
          setFormData((prev) => ({
            ...prev,
            InsuranceProviderIPACode: '',
            InsuranceCompanyOrganizationName: '',
            InsuranceCompanyAddress1: '',
            InsuranceCompanyAddress2: '',
            InsuranceCompanyCity: '',
            InsuranceCompanyProvince: '',
            InsuranceCompanyPOBox: '',
            InsuranceCompanyLandLine: '',
          }));
          return;
        }
        const { data: provider, error } = await supabase
          .from('insurancecompanymaster')
          .select('IPACODE, InsuranceCompanyOrganizationName, InsuranceCompanyAddress1, InsuranceCompanyAddress2, InsuranceCompanyCity, InsuranceCompanyProvince, InsuranceCompanyPOBox, InsuranceCompanyLandLine')
          .eq('IPACODE', ipaCode)
          .single();
        if (error) throw error;
        setFormData((prev) => ({
          ...prev,
          InsuranceProviderIPACode: provider?.IPACODE || '',
          InsuranceCompanyOrganizationName: provider?.InsuranceCompanyOrganizationName || '',
          InsuranceCompanyAddress1: provider?.InsuranceCompanyAddress1 || '',
          InsuranceCompanyAddress2: provider?.InsuranceCompanyAddress2 || '',
          InsuranceCompanyCity: provider?.InsuranceCompanyCity || '',
          InsuranceCompanyProvince: provider?.InsuranceCompanyProvince || '',
          InsuranceCompanyPOBox: provider?.InsuranceCompanyPOBox || '',
          InsuranceCompanyLandLine: provider?.InsuranceCompanyLandLine || '',
        }));
      } catch (e) {
        console.error('Insurance lookup failed', e);
      }
    };

    if (formData.InsuranceProviderIPACode) {
      loadInsuranceByIPACode(formData.InsuranceProviderIPACode);
    }
  }, [formData.InsuranceProviderIPACode]);

  // -----------------------------
  // Render helpers (READ-ONLY)
  // -----------------------------
  const tabs = [
    'Worker Personal Details',
    'Details of Employment',
    'Details of Injury',
    'Details of Dependants',
    'Other Employment Details',
    'Insurance Details',
    'Weekly Payment',
    'Form11 Scan',
    'Supporting Documents',
  ];


  const renderWorkerPersonalDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker ID</label>
          <input className="input" name="WorkerID" value={s(formData.WorkerID)} readOnly />
        </div>
        <div className="md:col-span-2">
<label className="block text-sm font-medium text-gray-700">Passport Photo</label>
{passportUrl ? (
  <img
    src={passportUrl}
    alt="Worker passport"
    className="w-32 h-32 rounded object-cover border cursor-zoom-in"
    onClick={() => openPreview(passportUrl)}
    loading="lazy"
  />
) : (
  <div className="w-24 h-24 rounded border grid place-content-center text-xs text-gray-500">
    No photo
  </div>
)}


        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input className="input" name="WorkerFirstName" value={s(formData.WorkerFirstName)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input className="input" name="WorkerLastName" value={s(formData.WorkerLastName)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input type="date" className="input" name="WorkerDOB" value={s(formData.WorkerDOB)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <select className="input" name="WorkerGender" value={s(formData.WorkerGender)} disabled>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <select className="input" name="WorkerMarried" value={s(formData.WorkerMarried)} disabled>
            <option value="1">Married</option>
            <option value="0">Single</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Dominant Hand</label>
          <select className="input" name="WorkerHanded" value={s(formData.WorkerHanded)} disabled>
            <option value="Right">Right</option>
            <option value="Left">Left</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <textarea className="input" name="WorkerAddress1" rows={3} value={s(formData.WorkerAddress1)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea className="input" name="WorkerAddress2" rows={3} value={s(formData.WorkerAddress2)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input className="input" name="WorkerCity" value={s(formData.WorkerCity)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input className="input" name="WorkerProvince" value={s(formData.WorkerProvince)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input className="input" name="WorkerPOBox" value={s(formData.WorkerPOBox)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input className="input" type="email" name="WorkerEmail" value={s(formData.WorkerEmail)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input className="input" type="tel" name="WorkerMobile" value={s(formData.WorkerMobile)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input className="input" type="tel" name="WorkerLandline" value={s(formData.WorkerLandline)} readOnly />
        </div>
      </div>
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employment ID</label>
          <input className="input" name="EmploymentID" value={s(formData.EmploymentID)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation</label>
          <input className="input" name="Occupation" value={s(formData.Occupation)} readOnly />
        </div>
      </div>
      <div>
        <label className="block text sm font-medium text-gray-700">Place of Employment</label>
        <input className="input" name="PlaceOfEmployment" value={s(formData.PlaceOfEmployment)} readOnly />
      </div>
      <div>
        <label className="block text sm font-medium text-gray-700">Nature of Employment</label>
        <input className="input" name="NatureOfEmployment" value={s(formData.NatureOfEmployment)} readOnly />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
          <input className="input" type="number" name="AverageWeeklyWage" value={n(formData.AverageWeeklyWage)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weekly Payment Rate</label>
          <input className="input" type="number" name="WeeklyPaymentRate" value={n(formData.WeeklyPaymentRate)} readOnly />
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center">
          <input type="checkbox" className="h-4 w-4 text-primary border-gray-300 rounded" name="WorkedUnderSubContractor" checked={b(formData.WorkedUnderSubContractor)} readOnly disabled />
          <label className="ml-2 block text-sm text-gray-900">Worked Under Sub-Contractor</label>
        </div>
        {formData.WorkedUnderSubContractor && (
          <div className="space-y-4 pl-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Organization Name</label>
              <input className="input" name="SubContractorOrganizationName" value={s(formData.SubContractorOrganizationName)} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Location</label>
              <input className="input" name="SubContractorLocation" value={s(formData.SubContractorLocation)} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nature of Business</label>
              <input className="input" name="SubContractorNatureOfBusiness" value={s(formData.SubContractorNatureOfBusiness)} readOnly />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderInjuryDetails = () => (
    <div className="space-y-4">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700">Form Received Date</label>
    <input
      className="input"
      type="date"
      name="ReceivedDate"
      value={s(formData.ReceivedDate)}
      readOnly
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-gray-700">Body Part</label>
    <input
      className="input"
      name="BodyPart"
      value={s(formData.BodyPart)}
      readOnly
    />
  </div>
</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Date</label>
          <input className="input" type="date" name="IncidentDate" value={s(formData.IncidentDate)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Location</label>
          <input className="input" name="IncidentLocation" value={s(formData.IncidentLocation)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <select className="input" name="IncidentProvince" value={s(formData.IncidentProvince)} disabled>
            <option value="">Select Province</option>
            {provinces.map((p) => (
              <option key={p.DValue} value={p.DValue}>
                {p.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Region</label>
          <input className="input" name="IncidentRegion" value={s(formData.IncidentRegion)} readOnly />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature and Extent of Injury</label>
        <textarea className="input" rows={3} name="NatureExtentInjury" value={s(formData.NatureExtentInjury)} readOnly />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
        <textarea className="input" rows={3} name="InjuryCause" value={s(formData.InjuryCause)} readOnly />
      </div>

      <div className="space-y-2">
        <div className="flex items-center">
          <input className="h-4 w-4 text-primary border-gray-300 rounded" type="checkbox" name="HandInjury" checked={b(formData.HandInjury)} readOnly disabled />
          <label className="ml-2 block text-sm text-gray-900">Hand Injury</label>
        </div>
        <div className="flex items-center">
          <input className="h-4 w-4 text-primary border-gray-300 rounded" type="checkbox" name="InjuryMachinery" checked={b(formData.InjuryMachinery)} readOnly disabled />
          <label className="ml-2 block text-sm text-gray-900">Injury due to Machinery</label>
        </div>
      </div>

      {formData.InjuryMachinery && (
        <div className="space-y-4 border-l-4 border-primary pl-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Type</label>
            <input className="input" name="MachineType" value={s(formData.MachineType)} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Part Responsible</label>
            <input className="input" name="MachinePartResponsible" value={s(formData.MachinePartResponsible)} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Power Source</label>
            <input className="input" name="MachinePowerSource" value={s(formData.MachinePowerSource)} readOnly />
          </div>
        </div>
      )}
    </div>
  );

  const renderDependantDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse First Name</label>
          <input className="input" name="SpouseFirstName" value={s(formData.SpouseFirstName)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Last Name</label>
          <input className="input" name="SpouseLastName" value={s(formData.SpouseLastName)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Date of Birth</label>
          <input className="input" type="date" name="SpouseDOB" value={s(formData.SpouseDOB)} readOnly />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address Line 1</label>
          <textarea className="input" name="SpouseAddress1" rows={3} value={s(formData.SpouseAddress1)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address Line 2</label>
          <textarea className="input" name="SpouseAddress2" rows={3} value={s(formData.SpouseAddress2)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input className="input" name="SpouseCity" value={s(formData.SpouseCity)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input className="input" name="SpouseProvince" value={s(formData.SpouseProvince)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input className="input" name="SpousePOBox" value={s(formData.SpousePOBox)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input className="input" type="email" name="SpouseEmail" value={s(formData.SpouseEmail)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input className="input" type="tel" name="SpouseMobile" value={s(formData.SpouseMobile)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input className="input" type="tel" name="SpouseLandline" value={s(formData.SpouseLandline)} readOnly />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Other Dependants</h3>
        <div className="flex items-center mb-4">
          <input className="h-4 w-4 text-primary border-gray-300 rounded" type="checkbox" name="WorkerHaveDependants" checked={b(formData.WorkerHaveDependants)} readOnly disabled />
          <label className="ml-2 block text-sm text-gray-900">Worker has other dependants</label>
        </div>
        {formData.WorkerHaveDependants && dependants.length > 0 && (
          <div className="space-y-4">
            {dependants.map((d, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <p className="mt-1 text-sm text-gray-900">{d.DependantFirstName} {d.DependantLastName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Relationship</label>
                    <p className="mt-1 text-sm text-gray-900">{d.DependantType}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                    <p className="mt-1 text-sm text-gray-900">{d.DependantDOB ? new Date(d.DependantDOB).toLocaleDateString() : ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderWorkHistory = () => (
    <div className="space-y-4">
      <div className="flex items-center mb-4">
        <input className="h-4 w-4 text-primary border-gray-300 rounded" type="checkbox" name="GradualProcessInjury" checked={b(formData.GradualProcessInjury)} readOnly disabled />
        <label className="ml-2 block text-sm text-gray-900">Gradual Process Injury</label>
      </div>
      {formData.GradualProcessInjury && workHistory.length > 0 && (
        <div className="space-y-4">
          {workHistory.map((history, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                  <p className="mt-1 text-sm text-gray-900">{history.OrganizationName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Period</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {history.WorkerJoiningDate ? new Date(history.WorkerJoiningDate).toLocaleDateString() : ''} - {history.WorkerLeavingDate ? new Date(history.WorkerLeavingDate).toLocaleDateString() : 'Present'}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <p className="mt-1 text-sm text-gray-900">
                  {history.OrganizationAddress1}
                  {history.OrganizationAddress2 && `, ${history.OrganizationAddress2}`}
                  {history.OrganizationCity && `, ${history.OrganizationCity}`}
                  {history.OrganizationProvince && `, ${history.OrganizationProvince}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderInsuranceDetails = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider</label>
        <select className="input" name="InsuranceProviderIPACode" value={s(formData.InsuranceProviderIPACode)} disabled>
          <option value="">Select Insurance Provider</option>
          {insuranceProviders.map((p) => (
            <option key={p.IPACODE} value={p.IPACODE}>
              {p.InsuranceCompanyOrganizationName}
            </option>
          ))}
        </select>
      </div>

      {formData.InsuranceProviderIPACode && (
        <>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
              <textarea className="input" name="InsuranceCompanyAddress1" rows={3} value={s(formData.InsuranceCompanyAddress1)} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
              <textarea className="input" name="InsuranceCompanyAddress2" rows={3} value={s(formData.InsuranceCompanyAddress2)} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input className="input" name="InsuranceCompanyCity" value={s(formData.InsuranceCompanyCity)} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <input className="input" name="InsuranceCompanyProvince" value={s(formData.InsuranceCompanyProvince)} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
              <input className="input" name="InsuranceCompanyPOBox" value={s(formData.InsuranceCompanyPOBox)} readOnly />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Landline</label>
            <input className="input" name="InsuranceCompanyLandLine" value={s(formData.InsuranceCompanyLandLine)} readOnly />
          </div>
        </>
      )}
    </div>
  );

  const renderWeeklyPayment = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Weekly Payment Rate</label>
        <input className="input" type="number" name="WeeklyPaymentRate" value={n(formData.WeeklyPaymentRate)} readOnly />
      </div>
    </div>
  );

  const renderForm11Scan = () => (
    <div className="space-y-2">
      {s(formData.ImageName) && (
        <p className="text-xs text-gray-600">
          Current scan: <span className="font-mono">{s(formData.ImageName)}</span>
        </p>
      )}

{scanUrl && (
  <div className="mt-2">
    {isPreviewable(scanUrl) ? (
      isImageUrl(scanUrl) ? (
        <img
          src={scanUrl}
          alt="Form 11 scan preview"
          className="w-40 h-40 rounded object-cover border cursor-zoom-in"
          onClick={() => openPreview(scanUrl)}
          loading="lazy"
        />
      ) : (
        // pdf → click to open inline previewer
        <button
          type="button"
          className="text-primary hover:underline text-sm"
          onClick={() => openPreview(scanUrl)}
        >
          Preview PDF
        </button>
      )
    ) : (
      <a
        href={scanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline text-sm"
      >
        Open file
      </a>
    )}
  </div>
)}



    </div>
  );

  const renderSupportingDocuments = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Existing attachments linked to this claim.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: 'IMR',  label: 'Interim medical report' },
          { key: 'FMR',  label: 'Final medical report' },
          { key: 'SEC43',label: 'Section 43 application form' },
          { key: 'SS',   label: 'Supervisor statement' },
          { key: 'WS',   label: 'Witness statement' },
          { key: 'IWS',  label: "Injured worker's statement" },
          { key: 'PTA',  label: 'Payslip at time of accident' },
          { key: 'TR',   label: 'Treatment records' },
          { key: 'PAR',  label: 'Police accident report' },
          { key: 'F18',  label: 'Form 18 Scan' },
          { key: 'MEX',  label: 'Medical Expenses' },
          { key: 'MISC', label: 'Misc Expenses' },
          { key: 'DED',  label: 'Deductions' },
        ].map(({ key, label }) => {
          const pathVal = s((formData as any)[key]);
          const preview = attachmentPreviews[key];
          const hasPreview = !!preview;

          return (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">{label}</label>

{hasPreview ? (
  isPreviewable(preview) ? (
    isImageUrl(preview) ? (
      <img
        src={preview}
        alt={`${label} preview`}
        className="w-28 h-28 object-cover rounded border cursor-zoom-in"
        onClick={() => openPreview(preview)}
        loading="lazy"
      />
    ) : (
      <button
        type="button"
        className="text-primary hover:underline text-sm"
        onClick={() => openPreview(preview)}
      >
        Preview PDF
      </button>
    )
  ) : (
    <a
      href={preview}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline text-sm"
    >
      Open file
    </a>
  )
) : pathVal ? (
  <p className="text-xs text-gray-500 break-all font-mono">{pathVal}</p>
) : (
  <p className="text-xs text-gray-400">No file</p>
)}


   
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (currentTab) {
      case 1:
        return renderWorkerPersonalDetails();
      case 2:
        return renderEmploymentDetails();
      case 3:
        return renderInjuryDetails();
      case 4:
        return renderDependantDetails();
      case 5:
        return renderWorkHistory();
      case 6:
        return renderInsuranceDetails();
      case 7:
        return renderWeeklyPayment();
      case 8:
        return renderForm11Scan();
      case 9:
        return renderSupportingDocuments();
      default:
        return null;
    }
  };

  // -----------------------------
  // JSX (Modal or Embedded)
  // -----------------------------
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (embedded) {
      return (
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl">
          {children}
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {children}
        </div>
      </div>
    );
  };

  return (
    <Container>
      <div className={`flex items-center justify-between p-4 border-b ${embedded ? '' : 'sticky top-0 bg-white'}`}>
        <h2 className="text-xl font-semibold text-gray-900">View Form 11</h2>
        {!!onClose && !embedded && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="p-6">
        {loading && <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md">Loading…</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}

        <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
          {tabs.map((tab, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentTab(index + 1)}
              className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                currentTab === index + 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {renderTabContent()}

        {/* No action buttons in VIEW MODE */}
      </div>

			{previewUrl && (
  <div
    className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
    onClick={closePreview}
  >
    {isPdfUrl(previewUrl) ? (
      <iframe
        src={previewUrl}
        className="w-[90vw] h-[85vh] bg-white rounded shadow-xl"
        title="Preview"
      />
    ) : (
      <img
        src={previewUrl}
        alt="Preview"
        className="max-h-[85vh] max-w-[90vw] rounded shadow-xl"
      />
    )}
  </div>
)}

    </Container>
  );
};

export default ViewForm11;
