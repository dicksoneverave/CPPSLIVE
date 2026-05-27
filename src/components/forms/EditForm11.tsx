import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';

// -----------------------------
// Utilities
// -----------------------------

// Known roots inside the `cpps` bucket for image scans
const KNOWN_SCAN_ROOTS = [
  'attachments/form11scan/',
  'attachments/form12scan/',
  'attachments/form3scan/',
  'attachments/form4scan/',
];

// tiny helpers
const isPdf = (p?: string) => /\.pdf$/i.test((p || '').toLowerCase());
const isPreviewableImageExt = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test((p || '').toLowerCase());


const normalizeStoragePath = (p?: string) => {
  if (!p) return '';
  // Normalize Windows-style backslashes to forward slashes first
  let s = p.replace(/\\/g, '/').replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  s = s.replace(/\\/g, '/');
  if (s.startsWith('http')) return s; // already a URL
  s = s.replace(/^\/+/, ''); // trim leading slashes
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

type ChangeRow = { field: string; from: string; to: string };
interface EditForm11Props {
  /**
   * IMPORTANT: keep workerId as the only identifier passed from parent.
   * The component will look up the latest Form 11 for this worker automatically.
   */
  workerId: string;
  irn?: number | string | null;
  onClose: () => void;
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
  ReceivedDate?: string; // read-only in Edit
  BodyPart?: string;
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
// Component
// -----------------------------
const EditForm11: React.FC<EditForm11Props> = ({ workerId, irn, onClose }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [provinces, setProvinces] = useState<{ DKey: string; DValue: string }[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [currentEmployerData, setCurrentEmployerData] = useState<any>(null);

  // file selection (only newly uploaded files replace existing paths)
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>({});
  const [generatedFileNames, setGeneratedFileNames] = useState<{ [key: string]: string }>({});

  // Passport preview
  const [passportUrl, setPassportUrl] = useState('');
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  // Added: previews for Form11 scan and supporting docs
  const [scanUrl, setScanUrl] = useState('');
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});

  // Local (pre-upload) previews
  const [scanLocalUrl, setScanLocalUrl] = useState('');
  const [attachmentLocalPreviews, setAttachmentLocalPreviews] = useState<Record<string, string>>({});
  const [openAttachmentKey, setOpenAttachmentKey] = useState<string | null>(null);
  const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test((p || '').toLowerCase());

  // Resolve a Supabase Storage path to a browser-usable URL.
// Resolve a Supabase Storage path to a browser-usable URL.
// If `rawPath` has no folder (legacy filename only), it tries each root in `attemptRoots`.
const resolveStorageUrl = async (rawPath: string, attemptRoots?: string[]): Promise<string | null> => {
  try {
    if (!rawPath) return null;

    // Already a full URL? just return it.
    if (/^https?:\/\//i.test(rawPath)) return rawPath;

    const cleaned = normalizeStoragePath(rawPath);

    // If the cleaned path already has a slash, assume it's a full bucket-relative path
    // e.g. "attachments/form11scan/20240101_....jpg"
    const candidates: string[] =
      cleaned.includes('/')
        ? [cleaned]
        : // Legacy bare filename: try caller-provided roots, then global roots
          [...(attemptRoots || []), ...KNOWN_SCAN_ROOTS].map((root) => `${root}${cleaned}`);

    for (const candidate of candidates) {
      // 1) Prefer public URL if the folder/object is public (won't throw if not)
      const { data: pub } = supabase.storage.from('cpps').getPublicUrl(candidate);
      if (pub?.publicUrl) {
        // Even if the bucket isn't public, getPublicUrl still returns a URL string.
        // We will try a signed URL too and choose it if available.
        const { data: signed } = await supabase.storage.from('cpps').createSignedUrl(candidate, 60 * 60 * 24);
        if (signed?.signedUrl) return signed.signedUrl;
        return pub.publicUrl;
      }

      // 2) Fall back to a signed URL (works for private buckets/objects)
      const { data: signed } = await supabase.storage.from('cpps').createSignedUrl(candidate, 60 * 60 * 24);
      if (signed?.signedUrl) return signed.signedUrl;
    }

    return null;
  } catch (e) {
    console.error('resolveStorageUrl failed for', rawPath, e);
    return null;
  }
};


  // Folders per attachment type
  const attachmentTypeFolder: Record<string, string> = {
    'Interim medical report': '/attachments/formattachments/IMR/',
    'Final medical report': '/attachments/formattachments/FMR/',
    'Section 43 application form': '/attachments/formattachments/SEC43/',
    'Supervisor statement': '/attachments/formattachments/Supervisorstatement/',
    'Witness statement': '/attachments/formattachments/Witnessstatement/',
    "Injured worker's statement": '/attachments/formattachments/Injuredworkerstatement/',
    'Payslip at time of accident': '/attachments/formattachments/Payslipattimeofaccident/',
    'Treatment records': '/attachments/formattachments/Treatmentrecords/',
    'Police accident report': '/attachments/formattachments/Policeaccidentreport/',
    'Form 18 Scan': '/attachments/formattachments/Form18Scan/',
    'MedicalExpenses': '/attachments/formattachments/MedicalExpenses/',
    'MiscExpenses': '/attachments/formattachments/MiscExpenses/',
    'Deductions': '/attachments/formattachments/Deductions/',
  };

  // Map types -> keys
  const attachmentTypeToKey: Record<string, string> = {
    'Interim medical report': 'IMR',
    'Final medical report': 'FMR',
    'Section 43 application form': 'SEC43',
    'Supervisor statement': 'SS',
    'Witness statement': 'WS',
    "Injured worker's statement": 'IWS',
    'Payslip at time of accident': 'PTA',
    'Treatment records': 'TR',
    'Police accident report': 'PAR',
    'Form 18 Scan': 'F18',
    'MedicalExpenses': 'MEX',
    'MiscExpenses': 'MISC',
    'Deductions': 'DED',
  };

  const buildAttachmentPath = (attachmentType: string, fileName: string) => {
    const cleanedName = normalizeStoragePath(fileName);
    const hasSlash = cleanedName.includes('/');
    if (hasSlash) return cleanedName;
    const folder = attachmentTypeFolder[attachmentType] || '/attachments/formattachments/';
    return normalizeStoragePath(`${folder}${cleanedName}`);
  };

  const fetchAndHydrateAttachments = async (irn: number) => {
    try {
      const { data: rows, error } = await supabase
        .from('formattachments')
        .select('AttachmentType, FileName')
        .eq('IRN', irn);
      if (error) throw error;

      const newPaths: Partial<Form11Data> = {};
      const previewUpdates: Record<string, string> = {};

      for (const r of rows || []) {
        const type = (r as any).AttachmentType as string;
        const key = attachmentTypeToKey[type];
        let filePath = s((r as any).FileName);
        if (!key || !filePath) continue;

        filePath = buildAttachmentPath(type, filePath);

        (newPaths as any)[key] = filePath;

        const url = await resolveStorageUrl(filePath);
        if (url) previewUpdates[key] = url;
      }

      if (Object.keys(newPaths).length) {
        setFormData((prev) => ({ ...prev, ...(newPaths as any) }));
      }
      if (Object.keys(previewUpdates).length) {
        setAttachmentPreviews((prev) => ({ ...prev, ...previewUpdates }));
      }
    } catch (e) {
      console.error('Failed to load attachments for IRN', irn, e);
    }
  };

  const [editingIRN, setEditingIRN] = useState<number | null>(null);

  const [showSummary, setShowSummary] = useState(false);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [originalData, setOriginalData] = useState<Form11Data | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const base: Form11Data = useMemo(
    () => ({
      WorkerID: workerId,
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
      ReceivedDate: '',
      BodyPart: '',
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
    }),
    [workerId]
  );

  const [formData, setFormData] = useState<Form11Data>(base);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: provinceData } = await supabase
          .from('dictionary')
          .select('DKey, DValue')
          .eq('DType', 'Province');
        if (!cancelled) setProvinces(provinceData || []);

        const { data: providers } = await supabase
          .from('insurancecompanymaster')
          .select('IPACODE, InsuranceCompanyOrganizationName');
        if (!cancelled) setInsuranceProviders(providers || []);

        const { data: workerData } = await supabase
          .from('workerpersonaldetails')
          .select('*')
          .eq('WorkerID', workerId)
          .single();

        const { data: employmentData } = await supabase
          .from('currentemploymentdetails')
          .select('*')
          .eq('WorkerID', workerId)
          .maybeSingle();

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

        const { data: depData } = await supabase
          .from('dependantpersonaldetails')
          .select('*')
          .eq('WorkerID', workerId);
        if (!cancelled) setDependants(depData || []);

        const { data: historyData } = await supabase
          .from('workhistory')
          .select('*')
          .eq('WorkerID', workerId);
        if (!cancelled) setWorkHistory(historyData || []);

        let formRow: any = null;
        if (irn) {
          const { data, error } = await supabase
            .from('form1112master')
            .select('*')
            .eq('IRN', irn)
            .maybeSingle();
          if (error) throw error;
          formRow = data;
          if (!cancelled && formRow?.IRN) setEditingIRN(formRow.IRN);
        } else {
          const { data: formRows, error } = await supabase
            .from('form1112master')
            .select('*')
            .eq('WorkerID', workerId)
            .order('IRN', { ascending: false })
            .limit(1);
          if (error) throw error;
          formRow = formRows?.[0] || null;
          if (!cancelled && formRow?.IRN) setEditingIRN(formRow.IRN);
        }

        const merged = {
          ...base,
          ...workerData,
          ...employmentData,
          ...formRow,
          WorkerHaveDependants: (depData || []).length > 0,
        } as Partial<Form11Data>;
        const sanitized = sanitizeForForm(base, merged) as Form11Data;
        if (!cancelled) { setFormData(sanitized); setOriginalData(sanitized); }
      } catch (e) {
        console.error('Initial load failed', e);
        if (!cancelled) setError('Failed to load form data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workerId]);

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
        if (error) {
          if ((error as any).code === 'PGRST116') {
            setFormData((prev) => ({ ...prev, IncidentRegion: '' }));
            return;
          }
          throw error;
        }
        setFormData((prev) => ({ ...prev, IncidentRegion: data?.DValue || '' }));
      } catch (e) {
        console.error('Region lookup failed', e);
        setFormData((prev) => ({ ...prev, IncidentRegion: '' }));
      }
    };
    fetchRegion();
  }, [formData.IncidentProvince]);

  useEffect(() => {
  if (scanLocalUrl) return; // local preview takes precedence
  (async () => {
    const raw = s((formData as any).ImageName);
    if (!raw) { setScanUrl(''); return; }

    // Try Form 11 & Form 12 folders first (the same ImageName column is used for both)
    const url = await resolveStorageUrl(raw, ['attachments/form11scan/', 'attachments/form12scans/']);
    setScanUrl(url || '');
  })();
}, [formData.ImageName, scanLocalUrl]);


  useEffect(() => {
    (async () => {
      const raw = s((formData as any).WorkerPassportPhoto);
      if (!raw) { setPassportUrl(''); return; }
      const url = await resolveStorageUrl(raw);
      setPassportUrl(url || '');
    })();
  }, [formData.WorkerPassportPhoto]);

  useEffect(() => {
    (async () => {
      const keys = ['IMR','FMR','SEC43','SS','WS','IWS','PTA','TR','PAR','F18','MEX','MISC','DED'];
      const updates: Record<string, string> = {};
      for (const key of keys) {
        if (attachmentLocalPreviews[key]) continue;
        const raw = s((formData as any)[key]);
        if (!raw) continue;
        const path = normalizeStoragePath(raw);
        if (!path) continue;
        if (attachmentPreviews[key]) continue;
        const url = await resolveStorageUrl(path);
        if (url) updates[key] = url;
      }
      if (Object.keys(updates).length) {
        setAttachmentPreviews((prev) => ({ ...prev, ...updates }));
      }
    })();
  }, [formData, attachmentPreviews, attachmentLocalPreviews]);

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

  useEffect(() => {
    if (!editingIRN) return;
    fetchAndHydrateAttachments(editingIRN);
  }, [editingIRN]);

  useEffect(() => {
    if (!formData.InsuranceProviderIPACode) return;
    loadInsuranceByIPACode(formData.InsuranceProviderIPACode);
  }, [formData.InsuranceProviderIPACode]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleInsuranceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setFormData((prev) => ({ ...prev, InsuranceProviderIPACode: code }));
    await loadInsuranceByIPACode(code);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];

    if (fieldName === 'ImageName' && scanLocalUrl) {
      try { URL.revokeObjectURL(scanLocalUrl); } catch {}
      setScanLocalUrl('');
    }
    if (attachmentLocalPreviews[fieldName]) {
      try { URL.revokeObjectURL(attachmentLocalPreviews[fieldName]); } catch {}
      setAttachmentLocalPreviews((prev) => { const x = { ...prev }; delete x[fieldName]; return x; });
    }

    if (!file) {
      setSelectedFiles((prev) => { const x = { ...prev }; delete x[fieldName]; return x; });
      setGeneratedFileNames((prev) => { const x = { ...prev }; delete x[fieldName]; return x; });
      return;
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const datePrefix = `${dd}${mm}${yyyy}`;
    const timeStamp = `${hh}${mi}${ss}`;

    const lastDot = file.name.lastIndexOf('.');
    const baseName = lastDot !== -1 ? file.name.slice(0, lastDot) : file.name;
    const ext = lastDot !== -1 ? file.name.slice(lastDot + 1).toLowerCase() : 'dat';

    const safeBase = baseName.trim().split('').map((ch) => {
      const code = ch.charCodeAt(0);
      const ok = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || ch === '.' || ch === '_' || ch === '-';
      if (ok) return ch;
      if (ch === ' ') return '_';
      return '';
    }).join('');

    const newName = `${datePrefix}_${timeStamp}_${safeBase}.${ext}`;

    const folderMapping: Record<string, string> = {
      IMR: '/attachments/formattachments/IMR/',
      FMR: '/attachments/formattachments/FMR/',
      SEC43: '/attachments/formattachments/SEC43/',
      SS: '/attachments/formattachments/Supervisorstatement/',
      WS: '/attachments/formattachments/Witnessstatement/',
      IWS: '/attachments/formattachments/Injuredworkerstatement/',
      PTA: '/attachments/formattachments/Payslipattimeofaccident/',
      TR: '/attachments/formattachments/Treatmentrecords/',
      PAR: '/attachments/formattachments/Policeaccidentreport/',
      F18: '/attachments/formattachments/Form18Scan/',
      MEX: '/attachments/formattachments/MedicalExpenses/',
      MISC: '/attachments/formattachments/MiscExpenses/',
      DED: '/attachments/formattachments/Deductions/',
      ImageName: '/attachments/form11scan/',
    };

    const folderPath = folderMapping[fieldName] || '/attachments/form11scan/';
    const filePath = `${folderPath}${newName}`;

    setSelectedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setGeneratedFileNames((prev) => ({ ...prev, [fieldName]: newName }));
    setFormData((prev) => ({ ...prev, [fieldName]: filePath } as any));

    const looksImage = file.type.startsWith('image/') || ['png','jpg','jpeg','gif','webp'].includes(ext);
    if (looksImage) {
      const blobUrl = URL.createObjectURL(file);
      if (fieldName === 'ImageName') setScanLocalUrl(blobUrl);
      else setAttachmentLocalPreviews((prev) => ({ ...prev, [fieldName]: blobUrl }));
    }
  };

  const toYesNo = (val?: any) => (!!val ? 'Yes' : 'No');
  const formatDateForInput = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d as string;
    return dt.toISOString().split('T')[0];
  };
  const displayProvider = (code?: string) => {
    const name = insuranceProviders.find((p: any) => p.IPACODE === code)?.InsuranceCompanyOrganizationName;
    return name || (code || '');
  };
  const FIELD_LABELS: Record<string, string> = {
    IncidentDate: 'Incident Date',
    IncidentLocation: 'Incident Location',
    IncidentProvince: 'Incident Province',
    IncidentRegion: 'Region',
    NatureExtentInjury: 'Nature and Extent of Injury',
    InjuryCause: 'Cause of Injury',
    HandInjury: 'Hand Injury',
    InjuryMachinery: 'Injury due to Machinery',
    MachineType: 'Machine Type',
    MachinePartResponsible: 'Machine Part Responsible',
    MachinePowerSource: 'Machine Power Source',
    GradualProcessInjury: 'Gradual Process Injury',
    InsuranceProviderIPACode: 'Insurance Provider',
    ImageName: 'Form 11 Scan',
  };
  const displayValue = (k: keyof Form11Data, v: any) => {
    switch (k) {
      case 'HandInjury':
      case 'InjuryMachinery':
      case 'GradualProcessInjury':
        return toYesNo(v);
      case 'InsuranceProviderIPACode':
        return displayProvider(v);
      case 'IncidentDate':
        return formatDateForInput(v);
      default:
        return v ?? '';
    }
  };
  const compareForDiff = (k: keyof Form11Data, a: any, b: any) => {
    if (k === 'HandInjury' || k === 'InjuryMachinery' || k === 'GradualProcessInjury') {
      return (!!a) !== (!!b);
    }
    if (k === 'IncidentDate') {
      return formatDateForInput(a) !== formatDateForInput(b);
    }
    return (a ?? '') !== (b ?? '');
  };
  const computeChanges = (before: Form11Data, after: Form11Data): ChangeRow[] => {
    const keys: (keyof Form11Data)[] = [
      'IncidentDate','IncidentLocation','IncidentProvince','IncidentRegion','NatureExtentInjury','InjuryCause','HandInjury','InjuryMachinery','MachineType','MachinePartResponsible','MachinePowerSource','GradualProcessInjury','InsuranceProviderIPACode'
    ];
    const rows: ChangeRow[] = [];
    for (const k of keys) {
      if (compareForDiff(k, (before as any)[k], (after as any)[k])) {
        rows.push({ field: FIELD_LABELS[k], from: displayValue(k, (before as any)[k]), to: displayValue(k, (after as any)[k]) });
      }
    }
    if (selectedFiles['ImageName']) {
      rows.push({ field: FIELD_LABELS.ImageName, from: s(before.ImageName), to: s(after.ImageName) });
    }
    Object.keys(selectedFiles)
      .filter(k => k !== 'ImageName')
      .forEach(k => {
        rows.push({ field: `New Attachment: ${k}`, from: '', to: s((after as any)[k]) });
      });
    return rows;
  };
  const handleOpenSummary = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!s(formData.IncidentDate)) {
      setError('Incident Date is required.');
      setCurrentTab(3);
      try {
        const el = document.querySelector('input[name="IncidentDate"]') as HTMLElement | null;
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
      return;
    }
    const base = originalData || formData;
    const rows = computeChanges(base, formData);
    if (!rows.length) {
      setError('No changes detected.');
      return;
    }
    setChanges(rows);
    setShowSummary(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!editingIRN) throw new Error('No Form 11 record found to update.');

      const uploadedPaths: Record<string, string> = {};
      for (const [fieldName, file] of Object.entries(selectedFiles)) {
        const gen = generatedFileNames[fieldName];
        if (!file || !gen) continue;
        const folderMapping: Record<string, string> = {
          IMR: '/attachments/formattachments/IMR/',
          FMR: '/attachments/formattachments/FMR/',
          SEC43: '/attachments/formattachments/SEC43/',
          SS: '/attachments/formattachments/Supervisorstatement/',
          WS: '/attachments/formattachments/Witnessstatement/',
          IWS: '/attachments/formattachments/Injuredworkerstatement/',
          PTA: '/attachments/formattachments/Payslipattimeofaccident/',
          TR: '/attachments/formattachments/Treatmentrecords/',
          PAR: '/attachments/formattachments/Policeaccidentreport/',
          F18: '/attachments/formattachments/Form18Scan/',
          MEX: '/attachments/formattachments/MedicalExpenses/',
          MISC: '/attachments/formattachments/MiscExpenses/',
          DED: '/attachments/formattachments/Deductions/',
          ImageName: '/attachments/form11scan/',
        };
        const folder = folderMapping[fieldName] || '/attachments/form11scan/';
        const fullPath = `${folder}${gen}`;
        const { error: upErr } = await supabase.storage.from('cpps').upload(fullPath, file);
        if (upErr) throw new Error(`Failed to upload ${fieldName}: ${upErr.message}`);
        uploadedPaths[fieldName] = fullPath;
      }

      const incidentDate = new Date(formData.IncidentDate);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - incidentDate.getTime()) / (1000 * 60 * 60 * 24));
      const isTimeBarred = daysDiff > 365;

      const updatePayload: any = {
        WorkerID: formData.WorkerID,
        IncidentDate: formData.IncidentDate,
        IncidentLocation: formData.IncidentLocation,
        IncidentProvince: formData.IncidentProvince,
        IncidentRegion: formData.IncidentRegion,
        NatureExtentInjury: formData.NatureExtentInjury,
        InjuryCause: formData.InjuryCause,
        InjuryMachinery: formData.InjuryMachinery ? 1 : 0,
        MachineType: formData.MachineType,
        MachinePartResponsible: formData.MachinePartResponsible,
        MachinePowerSource: formData.MachinePowerSource,
        GradualProcessInjury: formData.GradualProcessInjury ? 1 : 0,
        IncidentType: formData.IncidentType || 'Injury',
        TimeBarred: isTimeBarred ? 'Yes' : 'No',
        HandInjury: formData.HandInjury ? 1 : 0,
        InsuranceProviderIPACode: formData.InsuranceProviderIPACode,
      };

      if (uploadedPaths.ImageName) {
        updatePayload.ImageName = uploadedPaths.ImageName;
        updatePayload.PublicUrl = uploadedPaths.ImageName;
      }

      const { data: updated, error: updErr } = await supabase
        .from('form1112master')
        .update(updatePayload)
        .eq('IRN', editingIRN)
        .select()
        .single();
      if (updErr) throw updErr;

      const attachmentMap: Record<string, string> = {
        IMR: 'Interim medical report',
        FMR: 'Final medical report',
        SEC43: 'Section 43 application form',
        SS: 'Supervisor statement',
        WS: 'Witness statement',
        IWS: "Injured worker's statement",
        PTA: 'Payslip at the time of accident',
        TR: 'Treatment records',
        PAR: 'Police accident report',
        F18: 'Form 18 Scan',
        MEX: 'MedicalExpenses',
        MISC: 'MiscExpenses',
        DED: 'Deductions',
      };

      for (const k of Object.keys(attachmentMap)) {
        const path = uploadedPaths[k];
        if (!path) continue;
        const { error: aErr } = await supabase.from('formattachments').insert([
          { IRN: editingIRN, AttachmentType: attachmentMap[k], FileName: path }
        ]);
        if (aErr) throw aErr;
      }

      setSuccess('Form 11 updated successfully!');
      setShowSummary(false);
      onClose();
      return;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to update the form.');
    } finally {
      setLoading(false);
    }
  };

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
              onClick={() => setIsPhotoOpen(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-24 h-24 rounded border grid place-content-center text-xs text-gray-500">No photo</div>
          )}
          {isPhotoOpen && passportUrl && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setIsPhotoOpen(false)}>
              <img src={passportUrl} alt="Passport enlarged" className="max-h-[85vh] max-w-[90vw] rounded shadow-xl" />
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
          <label className="block text sm font-medium text-gray-700">Province</label>
          <input className="input" name="WorkerProvince" value={s(formData.WorkerProvince)} readOnly />
        </div>
        <div>
          <label className="block text sm font-medium text-gray-700">P.O. Box</label>
          <input className="input" name="WorkerPOBox" value={s(formData.WorkerPOBox)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text sm font-medium text-gray-700">Email</label>
          <input className="input" type="email" name="WorkerEmail" value={s(formData.WorkerEmail)} readOnly />
        </div>
        <div>
          <label className="block text sm font-medium text-gray-700">Mobile</label>
          <input className="input" type="tel" name="WorkerMobile" value={s(formData.WorkerMobile)} readOnly />
        </div>
        <div>
          <label className="block text sm font-medium text-gray-700">Landline</label>
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
          <input type="checkbox" className="h-4 w-4 text-primary border-gray-300 rounded" name="WorkedUnderSubContractor" checked={b(formData.WorkedUnderSubContractor)} onChange={handleInputChange} />
          <label className="ml-2 block text-sm text-gray-900">Worked Under Sub-Contractor</label>
        </div>
        {formData.WorkedUnderSubContractor && (
          <div className="space-y-4 pl-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Organization Name</label>
              <input className="input" name="SubContractorOrganizationName" value={s(formData.SubContractorOrganizationName)} onChange={handleInputChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Location</label>
              <input className="input" name="SubContractorLocation" value={s(formData.SubContractorLocation)} onChange={handleInputChange} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nature of Business</label>
              <input className="input" name="SubContractorNatureOfBusiness" value={s(formData.SubContractorNatureOfBusiness)} onChange={handleInputChange} />
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
          <input className="input" type="date" name="ReceivedDate" value={s(formData.ReceivedDate)} readOnly />
        </div>
        <div className="hidden md:block" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Date</label>
          <input className="input" type="date" name="IncidentDate" value={s(formData.IncidentDate)} onChange={handleInputChange} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Location</label>
          <input className="input" name="IncidentLocation" value={s(formData.IncidentLocation)} onChange={handleInputChange} required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <select className="input" name="IncidentProvince" value={s(formData.IncidentProvince)} onChange={handleInputChange} required>
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
        <label className="block text-sm font-medium text-gray-700">Body Part</label>
        <input className="input" name="BodyPart" value={s(formData.BodyPart)} onChange={handleInputChange} placeholder="e.g., Left wrist, lower back, etc." />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature and Extent of Injury</label>
        <textarea className="input" rows={3} name="NatureExtentInjury" value={s(formData.NatureExtentInjury)} onChange={handleInputChange} required />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
        <textarea className="input" rows={3} name="InjuryCause" value={s(formData.InjuryCause)} onChange={handleInputChange} required />
      </div>

      <div className="space-y-2">
        <div className="flex items-center">
          <input className="h-4 w-4 text-primary border-gray-300 rounded" type="checkbox" name="HandInjury" checked={b(formData.HandInjury)} onChange={handleInputChange} />
          <label className="ml-2 block text-sm text-gray-900">Hand Injury</label>
        </div>
        <div className="flex items-center">
          <input className="h-4 w-4 text-primary border-gray-300 rounded" type="checkbox" name="InjuryMachinery" checked={b(formData.InjuryMachinery)} onChange={handleInputChange} />
          <label className="ml-2 block text-sm text-gray-900">Injury due to Machinery</label>
        </div>
      </div>

      {formData.InjuryMachinery && (
        <div className="space-y-4 border-l-4 border-primary pl-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Type</label>
            <input className="input" name="MachineType" value={s(formData.MachineType)} onChange={handleInputChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Part Responsible</label>
            <input className="input" name="MachinePartResponsible" value={s(formData.MachinePartResponsible)} onChange={handleInputChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Power Source</label>
            <input className="input" name="MachinePowerSource" value={s(formData.MachinePowerSource)} onChange={handleInputChange} />
          </div>
        </div>
      )}
    </div>
  );

// 1) Dependants (read-only snapshot)
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
        <input
          className="h-4 w-4 text-primary border-gray-300 rounded"
          type="checkbox"
          name="WorkerHaveDependants"
          checked={b(formData.WorkerHaveDependants)}
          onChange={handleInputChange}
          disabled
        />
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
              {/** address block optional in your data */}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

 // 2) Work history + Gradual Process Injury toggle
const renderWorkHistory = () => (
  <div className="space-y-4">
    <div className="flex items-center mb-4">
      <input
        className="h-4 w-4 text-primary border-gray-300 rounded"
        type="checkbox"
        name="GradualProcessInjury"
        checked={b(formData.GradualProcessInjury)}
        onChange={handleInputChange}
      />
      <label className="ml-2 block text-sm text-gray-900">Gradual Process Injury</label>
    </div>

    {formData.GradualProcessInjury && workHistory.length > 0 && (
      <div className="space-y-4">
        {workHistory.map((h, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <p className="mt-1 text-sm text-gray-900">{h.OrganizationName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Period</label>
                <p className="mt-1 text-sm text-gray-900">
                  {h.WorkerJoiningDate ? new Date(h.WorkerJoiningDate).toLocaleDateString() : ''} -{' '}
                  {h.WorkerLeavingDate ? new Date(h.WorkerLeavingDate).toLocaleDateString() : 'Present'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <p className="mt-1 text-sm text-gray-900">
                {h.OrganizationAddress1}
                {h.OrganizationAddress2 && `, ${h.OrganizationAddress2}`}
                {h.OrganizationCity && `, ${h.OrganizationCity}`}
                {h.OrganizationProvince && `, ${h.OrganizationProvince}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

  // 3) Insurance details (provider dropdown + read-only company fields)
const renderInsuranceDetails = () => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700">Insurance Provider</label>
      <select
        className="input"
        name="InsuranceProviderIPACode"
        value={s(formData.InsuranceProviderIPACode)}
        onChange={handleInsuranceChange}
        required
      >
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
      <input
        className="input"
        type="number"
        name="WeeklyPaymentRate"
        value={n(formData.WeeklyPaymentRate)}
        onChange={handleInputChange}
      />
      <p className="text-xs text-gray-500 mt-1">
        This value is shown here for convenience. Saving this form does not update the employment table.
      </p>
    </div>
  </div>
);


 const renderForm11Scan = () => {
  const currentScanPath = s(formData.ImageName);
  const hasPreview = !!(scanLocalUrl || scanUrl);
  const isPdfScan = isPdf(currentScanPath);

  return (
    <div className="space-y-2">
      {currentScanPath && (
        <p className="text-xs text-gray-600">
          Current scan: <span className="font-mono break-all">{currentScanPath}</span>
        </p>
      )}

      {hasPreview && (
        <div className="mt-2">
          {isPdfScan ? (
            <a
              href={scanLocalUrl || scanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              Open current PDF
            </a>
          ) : (
            <img
              src={scanLocalUrl || scanUrl}
              alt="Form scan preview"
              className="w-40 h-40 rounded object-cover border cursor-zoom-in"
              onClick={() => setIsScanOpen(true)}
              loading="lazy"
            />
          )}
        </div>
      )}

      {isScanOpen && hasPreview && !isPdfScan && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsScanOpen(false)}
        >
          <img
            src={scanLocalUrl || scanUrl}
            alt="Form scan enlarged"
            className="max-h-[85vh] max-w-[90vw] rounded shadow-xl"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Replace Form Scan</label>
        <input
          className="input"
          type="file"
          name="ImageName"
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={(e) => handleFileChange(e, 'ImageName')}
        />
        <p className="text-xs text-gray-500">Leave empty to keep the existing scan.</p>
      </div>
    </div>
  );
};


  const renderSupportingDocuments = () => (
  <div className="space-y-4">
    <p className="text-sm text-gray-500">
      Attach new files to add them as additional attachments. Existing ones will be retained.
    </p>

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
        const pathVal   = s((formData as any)[key]);
        const preview   = attachmentLocalPreviews[key] || attachmentPreviews[key];
        const hasPreview = !!preview;

        return (
          <div key={key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>

            {hasPreview ? (
              isImagePath(pathVal) ? (
                <img
                  src={preview}
                  alt={`${label} preview`}
                  className="w-28 h-28 object-cover rounded border cursor-zoom-in"
                  onClick={() => setOpenAttachmentKey(key)}
                  loading="lazy"
                />
              ) : (
                <a
                  href={preview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  Open current file
                </a>
              )
            ) : pathVal ? (
              <p className="text-xs text-gray-500 break-all font-mono">{pathVal}</p>
            ) : null}

            <input
              className="input"
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={(e) => handleFileChange(e as any, key)}
            />

            {openAttachmentKey === key && preview && isImagePath(pathVal) && (
              <div
                className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
                onClick={() => setOpenAttachmentKey(null)}
              >
                <img
                  src={preview}
                  alt={`${label} enlarged`}
                  className="max-h-[85vh] max-w-[90vw] rounded shadow-xl"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);


const renderTabContent = () => {
  switch (currentTab) {
    case 1: return renderWorkerPersonalDetails();
    case 2: return renderEmploymentDetails();
    case 3: return renderInjuryDetails();
    case 4: return renderDependantDetails();
    case 5: return renderWorkHistory();
    case 6: return renderInsuranceDetails();
    case 7: return renderWeeklyPayment();       // ✅ weekly payment tab
    case 8: return renderForm11Scan();
    case 9: return renderSupportingDocuments(); // ✅ supporting docs tab
    default: return null;
  }
};



  const confirmSave = () => {
    setShowSummary(false);
    try {
      formRef.current?.requestSubmit();
    } catch {
      handleSubmit(new Event('submit') as unknown as React.FormEvent);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Edit Form 11</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

{/* Tabs header (scrollable) */}
<div className="flex space-x-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
  {tabs.map((tab, index) => {
    const tabNum = index + 1;
    const isActive = currentTab === tabNum;
    return (
      <button
        key={tab}
        onClick={() => setCurrentTab(tabNum)}
        className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
          isActive ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        aria-selected={isActive}
        type="button"
      >
        {tab}
      </button>
    );
  })}
</div>


          <form ref={formRef} onSubmit={handleSubmit}>
            {renderTabContent()}

            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleOpenSummary} className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showSummary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSummary(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold">Review changes</h3>
              <button type="button" className="p-2 hover:bg-gray-100 rounded no-print" onClick={() => setShowSummary(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm print-area" id="summary-content">
              <p>Review before saving…</p>
            </div>
            <div className="px-5 pb-5 pt-2 flex justify-end gap-2 no-print">
              <button type="button" className="px-3 py-1.5 rounded" onClick={() => setShowSummary(false)}>Back to edit</button>
              <button type="button" className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={confirmSave} disabled={loading}>
                {loading ? 'Saving…' : 'Apply save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditForm11;
