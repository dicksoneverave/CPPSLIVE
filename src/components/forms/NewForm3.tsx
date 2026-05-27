import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { recordPrescreening } from '../../utils/insertPrescreening';

/**
 * NewForm3 (IRN-first)
 * - Aligns tabs/fields with RealNewForm3 while keeping this component's lightweight styling.
 * - Uses IRN everywhere; resolves WorkerID via the `workerirn` view.
 * - Preserves the image/attachments behaviour from the original NewForm3.
 * - Adds add/remove for Dependants and Work History.
 *
 * Tabs (11):
 *  1) Worker Details
 *  2) Spouse Details
 *  3) Dependent Details (add/remove)
 *  4) Employment Details
 *  5) Work History (add/remove)
 *  6) Details of Injury
 *  7) Compensation Claimed
 *  8) Insurance Details
 *  9) Details of Applicant
 * 10) Form 3 Scan
 * 11) Supporting Documents
 */

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
type ChangeRow = { field: string; from: string; to: string };

interface NewForm3Props {
  irn: number | string;       // required
  onClose: () => void;
  workerId?: number | string; // optional (only used if already known)
}

interface DependantRow {
  id?: number;
  DependantFirstName: string;
  DependantLastName: string;
  DependantDOB?: string;
  DependantType?: string;
  DependantGender?: string;
  DependantAddress1?: string;
  DependantAddress2?: string;
  DependantCity?: string;
  DependantProvince?: string;
  DependantPOBox?: string;
  DependantEmail?: string;
  DependantMobile?: string;
  DependantLandline?: string;
  DependanceDegree?: number;
}

interface WorkHistoryRow {
  id?: number;
  OrganizationName: string;
  OrganizationAddress1?: string;
  OrganizationAddress2?: string;
  OrganizationCity?: string;
  OrganizationProvince?: string;
  OrganizationPOBox?: string;
  OrganizationLandline?: string;
  OrganizationCPPSID?: string;
  WorkerJoiningDate?: string;
  WorkerLeavingDate?: string;
}

interface Form3Data {
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

  // Spouse
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

  // Employment
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

  // Injury (Form 11 core)
  IncidentDate: string;
  IncidentLocation: string;
  IncidentProvince: string;
  IncidentRegion: string;
  IncidentDescription: string;
  NatureExtentInjury: string;
  InjuryCause: string;
  DisabilitiesDescription: string;
  IncapacityExtent: string;
  IncapacityDescription: string;
  EstimatedIncapacityDuration: string;
  HandInjury: boolean;
  InjuryMachinery: boolean;
  MachineType: string;
  MachinePartResponsible: string;
  MachinePowerSource: string;
  GradualProcessInjury: boolean;

  // Insurance
  InsuranceProviderIPACode: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;

  // Compensation claimed
  CompensationClaimDetails: string;
  AverageEarnableAmount: number;
  AllowanceReceived: string;

  // Applicant
  ApplicantFirstName: string;
  ApplicantLastName: string;
  ApplicantAddress1: string;
  ApplicantAddress2: string;
  ApplicantCity: string;
  ApplicantProvince: string;
  ApplicantPOBox: string;
  ApplicantEmail: string;
  ApplicantMobile: string;
  ApplicantLandline: string;

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
const NewForm3: React.FC<NewForm3Props> = ({ irn, workerId, onClose }) => {
  // --- ids resolved from IRN ---
  const [resolvedIRN, setResolvedIRN] = useState<number | null>(null);
  const [resolvedWorkerID, setResolvedWorkerID] = useState<number | null>(null);

  // --- UI state ---
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reference data
  const [provinces, setProvinces] = useState<{ DKey: string; DValue: string }[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);

  // Table snapshots (dependants, work history etc.)
  const [dependants, setDependants] = useState<DependantRow[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>([]);
  const [currentEmployerData, setCurrentEmployerData] = useState<any>(null);

  // Draft rows for add forms
  const [newDependant, setNewDependant] = useState<DependantRow>({
    DependantFirstName: '',
    DependantLastName: '',
    DependantDOB: '',
    DependantType: '',
    DependantGender: ''
  });
  const [newHistory, setNewHistory] = useState<WorkHistoryRow>({
    OrganizationName: '',
    WorkerJoiningDate: '',
    WorkerLeavingDate: ''
  });

  // file selection (only newly uploaded files replace existing paths)
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>({});
  const [generatedFileNames, setGeneratedFileNames] = useState<{ [key: string]: string }>({});

  // Passport preview
  const [passportUrl, setPassportUrl] = useState('');
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  // Added: previews for Form3 scan and supporting docs
  const [scanUrl, setScanUrl] = useState('');
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});

  // Local (pre-upload) previews
  const [scanLocalUrl, setScanLocalUrl] = useState('');
  const [attachmentLocalPreviews, setAttachmentLocalPreviews] = useState<Record<string, string>>({});
  const [openAttachmentKey, setOpenAttachmentKey] = useState<string | null>(null);
  const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || '');

  const [editingIRN, setEditingIRN] = useState<number | null>(null);
  const [originalData, setOriginalData] = useState<Form3Data | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Base defaults
  const base: Form3Data = useMemo(
    () => ({
      // Worker
      WorkerID: workerId ? String(workerId) : '',
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
      // Spouse
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
      // Employment
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
      // Injury
      IncidentDate: '',
      IncidentLocation: '',
      IncidentProvince: '',
      IncidentRegion: '',
      IncidentDescription: '',
      NatureExtentInjury: '',
      InjuryCause: '',
      DisabilitiesDescription: '',
      IncapacityExtent: '',
      IncapacityDescription: '',
      EstimatedIncapacityDuration: '',
      HandInjury: false,
      InjuryMachinery: false,
      MachineType: '',
      MachinePartResponsible: '',
      MachinePowerSource: '',
      GradualProcessInjury: false,
      // Insurance
      InsuranceProviderIPACode: '',
      InsuranceCompanyOrganizationName: '',
      InsuranceCompanyAddress1: '',
      InsuranceCompanyAddress2: '',
      InsuranceCompanyCity: '',
      InsuranceCompanyProvince: '',
      InsuranceCompanyPOBox: '',
      InsuranceCompanyLandLine: '',
      // Compensation
      CompensationClaimDetails: '',
      AverageEarnableAmount: 0,
      AllowanceReceived: '',
      // Applicant
      ApplicantFirstName: '',
      ApplicantLastName: '',
      ApplicantAddress1: '',
      ApplicantAddress2: '',
      ApplicantCity: '',
      ApplicantProvince: '',
      ApplicantPOBox: '',
      ApplicantEmail: '',
      ApplicantMobile: '',
      ApplicantLandline: '',
      // Files
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
      // System
      DisplayIRN: '',
      TimeBarred: false,
      FirstSubmissionDate: '',
      IncidentType: 'Injury',
    }),
    [workerId]
  );

  const [formData, setFormData] = useState<Form3Data>(base);

  // -----------------------------
  // Resolve IRN -> WorkerID first
  // -----------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const rawIrn = typeof irn === 'string' ? Number(irn) : irn;
        if (!rawIrn || Number.isNaN(rawIrn)) throw new Error('IRN is missing or invalid.');

        // Resolve WorkerID via workerirn (preferred)
        let effectiveWorkerID = workerId ? Number(workerId) : null;
        if (!effectiveWorkerID) {
          const { data: wv, error: wvErr } = await supabase
            .from('workerirn')
            .select('WorkerID')
            .eq('IRN', rawIrn)
            .maybeSingle();
          if (wvErr) throw wvErr;
          effectiveWorkerID = (wv?.WorkerID ?? null);

          if (!effectiveWorkerID) {
            const { data: row, error: fErr } = await supabase
              .from('form1112master')
              .select('WorkerID')
              .eq('IRN', rawIrn)
              .maybeSingle();
            if (fErr) throw fErr;
            effectiveWorkerID = row?.WorkerID ?? null;
          }
        }

        if (!effectiveWorkerID) throw new Error('Could not resolve WorkerID for the provided IRN.');

        if (!cancelled) {
          setResolvedIRN(rawIrn);
          setResolvedWorkerID(effectiveWorkerID);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || 'Failed to resolve identifiers.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [irn, workerId]);

  // -----------------------------
  // Initial load (after IDs are known)
  // -----------------------------
  useEffect(() => {
    if (!resolvedIRN || !resolvedWorkerID) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Reference data
        const [{ data: provinceData }, { data: providers }] = await Promise.all([
          supabase.from('dictionary').select('DKey, DValue').eq('DType', 'Province'),
          supabase.from('insurancecompanymaster').select('IPACODE, InsuranceCompanyOrganizationName'),
        ]);
        if (!cancelled) {
          setProvinces(provinceData || []);
          setInsuranceProviders(providers || []);
        }

        // Worker & employment
        const [{ data: workerData }, { data: employmentData }] = await Promise.all([
          supabase.from('workerpersonaldetails').select('*').eq('WorkerID', resolvedWorkerID).single(),
          supabase.from('currentemploymentdetails').select('*').eq('WorkerID', resolvedWorkerID).maybeSingle(),
        ]);

        // Employer (optional)
        if (employmentData?.EmployerCPPSID) {
          const { data: em } = await supabase
            .from('employermaster')
            .select('*')
            .eq('CPPSID', employmentData.EmployerCPPSID)
            .limit(1);
          if (!cancelled) setCurrentEmployerData(em?.[0] || null);
        }

        // Dependants & work history (by WorkerID)
        const [{ data: depData }, { data: historyData }] = await Promise.all([
          supabase.from('dependantpersonaldetails').select('*').eq('WorkerID', resolvedWorkerID),
          supabase.from('workhistory').select('*').eq('WorkerID', resolvedWorkerID),
        ]);
        if (!cancelled) {
          setDependants((depData || []) as DependantRow[]);
          setWorkHistory((historyData || []) as WorkHistoryRow[]);
        }

        // Form 11/12 master by IRN
        const { data: form11Row, error: formErr } = await supabase
          .from('form1112master')
          .select('*')
          .eq('IRN', resolvedIRN)
          .maybeSingle();
        if (formErr) throw formErr;

        if (!cancelled && form11Row?.IRN) setEditingIRN(form11Row.IRN);

        // Merge form data
        const merged = {
          ...base,
          WorkerID: String(resolvedWorkerID),
          ...workerData,
          ...employmentData,
          ...form11Row,
        } as Partial<Form3Data>;

        const sanitized = sanitizeForForm(base, merged) as Form3Data;
        if (!cancelled) {
          setFormData(sanitized);
          setOriginalData(sanitized);
        }
      } catch (e: any) {
        console.error('Initial load failed', e);
        if (!cancelled) setError(e?.message || 'Failed to load form data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedIRN, resolvedWorkerID]);

  // -----------------------------
  // Derived + Effects
  // -----------------------------
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

  // Resolve Form 3 scan preview URL whenever ImageName changes
  useEffect(() => {
    if (scanLocalUrl) return;
    (async () => {
      const path = s((formData as any).ImageName);
      if (path && isImagePath(path)) {
        const url = await resolveStorageUrl(path);
        setScanUrl(url || '');
      } else {
        setScanUrl('');
      }
    })();
  }, [formData.ImageName, scanLocalUrl]);

  // Resolve worker passport photo whenever the path changes
  useEffect(() => {
    (async () => {
      const raw = s((formData as any).WorkerPassportPhoto);
      if (!raw) { setPassportUrl(''); return; }
      const url = await resolveStorageUrl(raw);
      setPassportUrl(url || '');
    })();
  }, [formData.WorkerPassportPhoto]);

  // Resolve supporting document previews (remote) unless a local preview is present
  useEffect(() => {
    (async () => {
      const keys = ['IMR','FMR','SEC43','SS','WS','IWS','PTA','TR','PAR','F18','MEX','MISC','DED'];
      const updates: Record<string, string> = {};
      for (const key of keys) {
        if (attachmentLocalPreviews[key]) continue;
        const path = s((formData as any)[key]);
        if (!path || !isImagePath(path)) continue;
        if (attachmentPreviews[key]) continue;
        const url = await resolveStorageUrl(path);
        if (url) updates[key] = url;
      }
      if (Object.keys(updates).length) {
        setAttachmentPreviews((prev) => ({ ...prev, ...updates }));
      }
    })();
  }, [formData, attachmentPreviews, attachmentLocalPreviews]);

  // Resolve a Supabase Storage path to a browser-usable URL (helpers)
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
    "Injured worker's statement": 'IWS',
    'Payslip at the time of accident': 'PTA',
    'Treatment records': 'TR',
    'Police accident report': 'PAR',
    'Form 18 Scan': 'F18',
    'MedicalExpenses': 'MEX',
    'MiscExpenses': 'MISC',
    'Deductions': 'DED',
  };

  // After we know which IRN we're editing, load its attachments and hydrate previews
  useEffect(() => {
    if (!editingIRN) return;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from('formattachments')
          .select('AttachmentType, FileName')
          .eq('IRN', editingIRN);
        if (error) throw error;

        const newPaths: Partial<Form3Data> = {};
        const previewUpdates: Record<string, string> = {};

        for (const r of rows || []) {
          const key = attachmentTypeToKey[(r as any).AttachmentType];
          const filePath = (r as any).FileName as string;
          if (!key || !filePath) continue;
          (newPaths as any)[key] = filePath;

          if (isImagePath(filePath)) {
            const url = await resolveStorageUrl(filePath);
            if (url) previewUpdates[key] = url;
          }
        }

        if (Object.keys(newPaths).length) setFormData((prev) => ({ ...prev, ...(newPaths as any) }));
        if (Object.keys(previewUpdates).length) setAttachmentPreviews((prev) => ({ ...prev, ...previewUpdates }));
      } catch (e) {
        console.error('Failed to load attachments for IRN', editingIRN, e);
      }
    })();
  }, [editingIRN]);

  // When the InsuranceProviderIPACode is set/changed, hydrate the company details into the read-only fields.
  useEffect(() => {
    if (!formData.InsuranceProviderIPACode) return;
    loadInsuranceByIPACode(formData.InsuranceProviderIPACode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.InsuranceProviderIPACode]);

  // -----------------------------
  // Handlers
  // -----------------------------
const handleInputChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => {
  const target = e.target as HTMLInputElement;
  const { name, type, checked, value } = target;

  let next: any;
  if (type === 'checkbox') {
    next = checked;
  } else if (type === 'number') {
    // Keep numbers as numbers; allow blank to become 0 (or '' if you prefer)
    next = value === '' ? 0 : Number(value);
  } else {
    next = value;
  }

  setFormData(prev => ({ ...prev, [name]: next }));
};


  const handleInsuranceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setFormData((prev) => ({ ...prev, InsuranceProviderIPACode: code }));
    await loadInsuranceByIPACode(code);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];

    // Revoke & clear any previous local preview for this field
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

    // Generate a safe, timestamped filename
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
      ImageName: '/attachments/form3scan/',
    };

    const folderPath = folderMapping[fieldName] || '/attachments/form3scan/';
    const filePath = `${folderPath}${newName}`;

    setSelectedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setGeneratedFileNames((prev) => ({ ...prev, [fieldName]: newName }));
    setFormData((prev) => ({ ...prev, [fieldName]: filePath } as any));

    // Local preview for images
    const looksImage = file.type.startsWith('image/') || ['png','jpg','jpeg','gif','webp'].includes(ext);
    if (looksImage) {
      const blobUrl = URL.createObjectURL(file);
      if (fieldName === 'ImageName') setScanLocalUrl(blobUrl);
      else setAttachmentLocalPreviews((prev) => ({ ...prev, [fieldName]: blobUrl }));
    }
  };

  // Helper: load insurance details into the form by IPA code
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

  // -----------------------------
  // Dependant add/remove
  // -----------------------------
  const addDependant = async () => {
    if (!resolvedWorkerID) return;
    if (!newDependant.DependantFirstName || !newDependant.DependantLastName) return;
    const payload: any = { WorkerID: resolvedWorkerID, ...newDependant };
    const { data, error } = await supabase.from('dependantpersonaldetails').insert([payload]).select().single();
    if (!error && data) {
      setDependants((prev) => [...prev, data as DependantRow]);
      setNewDependant({ DependantFirstName: '', DependantLastName: '', DependantDOB: '', DependantType: '', DependantGender: '' });
    } else if (error) {
      setError(error.message);
    }
  };

  const removeDependant = async (row: DependantRow) => {
    if (!resolvedWorkerID) return;
    try {
      // Try by primary key if present, else fallback to a match
      if (row.id) {
        await supabase.from('dependantpersonaldetails').delete().eq('id', row.id);
      } else {
        await supabase.from('dependantpersonaldetails').delete().match({
          WorkerID: resolvedWorkerID,
          DependantFirstName: row.DependantFirstName,
          DependantLastName: row.DependantLastName,
          DependantDOB: row.DependantDOB ?? null
        });
      }
      setDependants((prev) => prev.filter((d) => d !== row));
    } catch (e: any) {
      setError(e.message || 'Failed to remove dependant');
    }
  };

  // -----------------------------
  // Work history add/remove
  // -----------------------------
  const addHistory = async () => {
    if (!resolvedWorkerID) return;
    if (!newHistory.OrganizationName) return;
    const payload: any = { WorkerID: resolvedWorkerID, ...newHistory };
    const { data, error } = await supabase.from('workhistory').insert([payload]).select().single();
    if (!error && data) {
      setWorkHistory((prev) => [...prev, data as WorkHistoryRow]);
      setNewHistory({ OrganizationName: '', WorkerJoiningDate: '', WorkerLeavingDate: '' });
    } else if (error) {
      setError(error.message);
    }
  };

  const removeHistory = async (row: WorkHistoryRow) => {
    if (!resolvedWorkerID) return;
    try {
      if (row.id) {
        await supabase.from('workhistory').delete().eq('id', row.id);
      } else {
        await supabase.from('workhistory').delete().match({
          WorkerID: resolvedWorkerID,
          OrganizationName: row.OrganizationName,
          WorkerJoiningDate: row.WorkerJoiningDate ?? null
        });
      }
      setWorkHistory((prev) => prev.filter((d) => d !== row));
    } catch (e: any) {
      setError(e.message || 'Failed to remove employment row');
    }
  };

  // -----------------------------
  // Submit (UPDATE form1112 + UPSERT form3master + upload files + insert attachments)
  // -----------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!resolvedIRN || !resolvedWorkerID) throw new Error('Identifiers are not ready.');

      // 1) Upload any newly selected files
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
          ImageName: '/attachments/form3scan/',
        };
        const folder = folderMapping[fieldName] || '/attachments/form3scan/';
        const fullPath = `${folder}${gen}`;
        const { error: upErr } = await supabase.storage.from('cpps').upload(fullPath, file);
        if (upErr) throw new Error(`Failed to upload ${fieldName}: ${upErr.message}`);
        uploadedPaths[fieldName] = fullPath;
      }

      // 2) Update form1112master with any changed injury/insurance bits (kept from original)
      const update11: any = {
        WorkerID: String(resolvedWorkerID),
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
        HandInjury: formData.HandInjury ? 1 : 0,
        InsuranceProviderIPACode: formData.InsuranceProviderIPACode,
      };
      if (uploadedPaths.ImageName) {
        update11.ImageName = uploadedPaths.ImageName;
        update11.PublicUrl = uploadedPaths.ImageName;
      }

      await supabase.from('form1112master').update(update11).eq('IRN', resolvedIRN);

      // 3) Upsert to form3master
      const form3Payload: any = {
        IRN: resolvedIRN,
        WorkerID: resolvedWorkerID,
        IncidentDescription: formData.IncidentDescription || formData.NatureExtentInjury || '',
        DisabilitiesDescription: formData.DisabilitiesDescription || '',
        IncapacityExtent: formData.IncapacityExtent || '',
        IncapacityDescription: formData.IncapacityDescription || '',
        EstimatedIncapacityDuration: formData.EstimatedIncapacityDuration || '',
        CompensationClaimDetails: formData.CompensationClaimDetails || '',
        AverageEarnableAmount: formData.AverageEarnableAmount || 0,
        AllowanceReceived: formData.AllowanceReceived || '',
        ApplicantFirstName: formData.ApplicantFirstName || '',
        ApplicantLastName: formData.ApplicantLastName || '',
        ApplicantAddress1: formData.ApplicantAddress1 || '',
        ApplicantAddress2: formData.ApplicantAddress2 || '',
        ApplicantCity: formData.ApplicantCity || '',
        ApplicantProvince: formData.ApplicantProvince || '',
        ApplicantPOBox: formData.ApplicantPOBox || '',
        ApplicantEmail: formData.ApplicantEmail || '',
        ApplicantMobile: formData.ApplicantMobile || '',
        ApplicantLandline: formData.ApplicantLandline || '',
        Form3SubmissionDate: new Date().toISOString(),
      };

      // Does a form3master row already exist?
      const { data: existingF3, error: f3CheckErr } = await supabase
        .from('form3master')
        .select('IRN')
        .eq('IRN', resolvedIRN)
        .maybeSingle();
      if (f3CheckErr) throw f3CheckErr;

      if (existingF3) {
        const { error: f3UpdErr } = await supabase
          .from('form3master')
          .update(form3Payload)
          .eq('IRN', resolvedIRN);
        if (f3UpdErr) throw f3UpdErr;
      } else {
        const { error: f3InsErr } = await supabase
          .from('form3master')
          .insert([form3Payload]);
        if (f3InsErr) throw f3InsErr;
      }

			//insest to prescreeningreview table
			await recordPrescreening(Number(resolvedIRN), "Form3", "Pending");

			
      // 4) Insert new supporting attachments (for newly uploaded files only)
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
        await supabase.from('formattachments').insert([{
          IRN: resolvedIRN,
          AttachmentType: attachmentMap[k],
          FileName: path,
        }]);
      }

      setSuccess('Form 3 saved successfully!');
      onClose();
      return;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save Form 3.');
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Render helpers
  // -----------------------------
  const tabs = [
    'Worker Details',
    'Spouse Details',
    'Dependent Details',
    'Employment Details',
    'Work History',
    'Details of Injury',
    'Compensation Claimed',
    'Insurance Details',
    'Details of Applicant',
    'Form 3 Scan',
    'Supporting Documents',
  ];

  const renderWorkerDetails = () => (
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

  const renderSpouseDetails = () => (
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
          <label className="block text sm font-medium text-gray-700">Province</label>
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
    </div>
  );

  const renderDependants = () => (
    <div className="space-y-6">
      <div className="text-sm text-gray-600">Add or remove dependants linked to this worker. These update the <code>dependantpersonaldetails</code> table.</div>

      {/* Add form */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <input className="input" value={newDependant.DependantFirstName} onChange={(e)=>setNewDependant({...newDependant, DependantFirstName:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <input className="input" value={newDependant.DependantLastName} onChange={(e)=>setNewDependant({...newDependant, DependantLastName:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">DOB</label>
            <input type="date" className="input" value={newDependant.DependantDOB||''} onChange={(e)=>setNewDependant({...newDependant, DependantDOB:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Relationship</label>
            <input className="input" value={newDependant.DependantType||''} onChange={(e)=>setNewDependant({...newDependant, DependantType:e.target.value})}/>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select className="input" value={newDependant.DependantGender||''} onChange={(e)=>setNewDependant({...newDependant, DependantGender:e.target.value})}>
              <option value="">Select</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input className="input" value={newDependant.DependantEmail||''} onChange={(e)=>setNewDependant({...newDependant, DependantEmail:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mobile</label>
            <input className="input" value={newDependant.DependantMobile||''} onChange={(e)=>setNewDependant({...newDependant, DependantMobile:e.target.value})}/>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={addDependant} className="btn btn-primary flex items-center gap-2"><Plus className="h-4 w-4"/> Add</button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Relationship</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">DOB</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dependants.map((d, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-sm">{d.DependantFirstName} {d.DependantLastName}</td>
                  <td className="px-4 py-2 text-sm">{d.DependantType||''}</td>
                  <td className="px-4 py-2 text-sm">{d.DependantDOB ? new Date(d.DependantDOB).toLocaleDateString() : ''}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={()=>removeDependant(d)} className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"><Trash2 className="h-4 w-4"/> Remove</button>
                  </td>
                </tr>
              ))}
              {dependants.length === 0 && (
                <tr><td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>No dependants recorded.</td></tr>
              )}
            </tbody>
          </table>
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
          <input className="input" type="number" name="WeeklyPaymentRate" value={n(formData.WeeklyPaymentRate)} onChange={handleInputChange} />
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

  const renderWorkHistory = () => (
    <div className="space-y-6">
      <div className="text-sm text-gray-600">Add or remove work history linked to this worker. These update the <code>workhistory</code> table.</div>

      {/* Add form */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Organization Name</label>
            <input className="input" value={newHistory.OrganizationName} onChange={(e)=>setNewHistory({...newHistory, OrganizationName:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Joining Date</label>
            <input type="date" className="input" value={newHistory.WorkerJoiningDate||''} onChange={(e)=>setNewHistory({...newHistory, WorkerJoiningDate:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Leaving Date</label>
            <input type="date" className="input" value={newHistory.WorkerLeavingDate||''} onChange={(e)=>setNewHistory({...newHistory, WorkerLeavingDate:e.target.value})}/>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={addHistory} className="btn btn-primary flex items-center gap-2"><Plus className="h-4 w-4"/> Add</button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Organization</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Period</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workHistory.map((h, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-sm">{h.OrganizationName}</td>
                  <td className="px-4 py-2 text-sm">
                    {(h.WorkerJoiningDate ? new Date(h.WorkerJoiningDate).toLocaleDateString() : '')}
                    {' - '}
                    {(h.WorkerLeavingDate ? new Date(h.WorkerLeavingDate).toLocaleDateString() : 'Present')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={()=>removeHistory(h)} className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"><Trash2 className="h-4 w-4"/> Remove</button>
                  </td>
                </tr>
              ))}
              {workHistory.length === 0 && (
                <tr><td className="px-4 py-3 text-sm text-gray-500" colSpan={3}>No work history recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInjuryDetails = () => (
    <div className="space-y-4">
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
          <label className="block text sm font-medium text-gray-700">Region</label>
          <input className="input" name="IncidentRegion" value={s(formData.IncidentRegion)} readOnly />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Incident Description</label>
        <textarea className="input" rows={3} name="IncidentDescription" value={s(formData.IncidentDescription)} onChange={handleInputChange} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature and Extent of Injury</label>
        <textarea className="input" rows={3} name="NatureExtentInjury" value={s(formData.NatureExtentInjury)} onChange={handleInputChange} required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
          <textarea className="input" rows={3} name="InjuryCause" value={s(formData.InjuryCause)} onChange={handleInputChange} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Disabilities (if any)</label>
          <textarea className="input" rows={3} name="DisabilitiesDescription" value={s(formData.DisabilitiesDescription)} onChange={handleInputChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incapacity Extent</label>
          <input className="input" name="IncapacityExtent" value={s(formData.IncapacityExtent)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incapacity Description</label>
          <input className="input" name="IncapacityDescription" value={s(formData.IncapacityDescription)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Estimated Duration</label>
          <input className="input" name="EstimatedIncapacityDuration" value={s(formData.EstimatedIncapacityDuration)} onChange={handleInputChange} />
        </div>
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

  const renderCompensation = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Compensation Claimed</label>
        <textarea className="input" rows={3} name="CompensationClaimDetails" value={s(formData.CompensationClaimDetails)} onChange={handleInputChange} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Earnable Amount</label>
          <input className="input" type="number" name="AverageEarnableAmount" value={n(formData.AverageEarnableAmount)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Allowance Received</label>
          <input className="input" name="AllowanceReceived" value={s(formData.AllowanceReceived)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weekly Payment Rate (read-only above)</label>
          <input className="input" type="number" value={n(formData.WeeklyPaymentRate)} readOnly />
        </div>
      </div>
    </div>
  );

  const renderInsuranceDetails = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider</label>
        <select className="input" name="InsuranceProviderIPACode" value={s(formData.InsuranceProviderIPACode)} onChange={handleInsuranceChange}>
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

  const renderApplicantDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input className="input" name="ApplicantFirstName" value={s(formData.ApplicantFirstName)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input className="input" name="ApplicantLastName" value={s(formData.ApplicantLastName)} onChange={handleInputChange} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <textarea className="input" name="ApplicantAddress1" rows={3} value={s(formData.ApplicantAddress1)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea className="input" name="ApplicantAddress2" rows={3} value={s(formData.ApplicantAddress2)} onChange={handleInputChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input className="input" name="ApplicantCity" value={s(formData.ApplicantCity)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input className="input" name="ApplicantProvince" value={s(formData.ApplicantProvince)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input className="input" name="ApplicantPOBox" value={s(formData.ApplicantPOBox)} onChange={handleInputChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input className="input" type="email" name="ApplicantEmail" value={s(formData.ApplicantEmail)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input className="input" type="tel" name="ApplicantMobile" value={s(formData.ApplicantMobile)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input className="input" type="tel" name="ApplicantLandline" value={s(formData.ApplicantLandline)} onChange={handleInputChange} />
        </div>
      </div>
    </div>
  );

  const renderForm3Scan = () => (
    <div className="space-y-2">
      {s(formData.ImageName) && (
        <p className="text-xs text-gray-600">
          Current scan: <span className="font-mono">{s(formData.ImageName)}</span>
        </p>
      )}
      {(scanLocalUrl || scanUrl) && (
        <div className="mt-2">
          <img
            src={scanLocalUrl || scanUrl}
            alt="Form 3 scan preview"
            className="w-40 h-40 rounded object-cover border cursor-zoom-in"
            onClick={() => setIsScanOpen(true)}
            loading="lazy"
          />
        </div>
      )}
      {isScanOpen && (scanLocalUrl || scanUrl) && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setIsScanOpen(false)}>
          <img src={scanUrl} alt="Form 3 scan enlarged" className="max-h-[85vh] max-w-[90vw] rounded shadow-xl" />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Replace Form 3 Scan</label>
        <input className="input" type="file" name="ImageName" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => handleFileChange(e, 'ImageName')} />
        <p className="text-xs text-gray-500">Leave empty to keep the existing scan.</p>
      </div>
    </div>
  );

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

              <input className="input" type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => handleFileChange(e as any, key)} />

              {openAttachmentKey === key && preview && isImagePath(pathVal) && (
                <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpenAttachmentKey(null)}>
                  <img src={preview} alt={`${label} enlarged`} className="max-h-[85vh] max-w-[90vw] rounded shadow-xl" />
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
      case 1:  return renderWorkerDetails();
      case 2:  return renderSpouseDetails();
      case 3:  return renderDependants();
      case 4:  return renderEmploymentDetails();
      case 5:  return renderWorkHistory();
      case 6:  return renderInjuryDetails();
      case 7:  return renderCompensation();
      case 8:  return renderInsuranceDetails();
      case 9:  return renderApplicantDetails();
      case 10: return renderForm3Scan();
      case 11: return renderSupportingDocuments();
      default: return null;
    }
  };

  // -----------------------------
  // JSX
  // -----------------------------
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">New Form 3</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

          <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setCurrentTab(index + 1)}
                className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                  currentTab === index + 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <form ref={formRef} onSubmit={handleSubmit}>
            {renderTabContent()}

            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewForm3;
