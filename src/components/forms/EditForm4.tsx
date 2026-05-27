// src/components/forms/EditForm4.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, AlertCircle, Upload, Save, Trash2, FileText, PlusCircle, MinusCircle } from "lucide-react";
import { supabase } from "../../services/supabase";

/**
 * EditForm4 — death claim (Form 4) editor
 * - Style/UX follows EditForm3: top bar, tabs, inputs, lightbox, previews
 * - Employment & Injury: read-only EXCEPT "IncidentDescription"
 * - Insurance tab: read-only
 * - Everything else editable
 * - Utilities: passport preview, Form 4 scan, supporting documents, change summary
 */

interface EditForm4Props {
  workerIRN: number;
  onClose: () => void;
  onSaved?: (irn: number) => void;
}

// -------------------- utilities (same style as EditForm3) --------------------
const safe = (v: any) => (v ?? "").toString();
const dateISO = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || "");

const normalizeStoragePath = (p?: string) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p; // already a URL
  let s = p.replace(/^\/+/, "");
  s = s.replace(/^(?:cpps\/+)+/i, "");
  return s;
};

const resolveStorageUrl = async (rawPath?: string): Promise<string> => {
  try {
    if (!rawPath) return "";
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const path = normalizeStoragePath(rawPath);
    if (!path) return "";
    // Try public URL first
    const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    // Fallback to signed URL
    const { data: signed } = await supabase.storage.from("cpps").createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl || "";
  } catch {
    return "";
  }
};

// Upload a file to Storage and return stored path
const uploadToStorage = async (file: File, destPath: string): Promise<string> => {
  const path = normalizeStoragePath(destPath);
  const { error } = await supabase.storage.from("cpps").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
  return path; // return the storage path we wrote to
};

// Simple lightbox overlay
const Lightbox: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({ src, alt, onClose }) => (
  <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
    <img
      src={src}
      alt={alt || "preview"}
      className="max-h-[90vh] max-w-[95vw] rounded shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

// -------------------- attachments (Form 4: death) --------------------
// Keys (short) <-> display labels & DB AttachmentType mapping (from NewForm4)
const ATTACH_KEYS: Array<{ key: string; label: string; type: string }> = [
  { key: "DC",    label: "Death Certificate",            type: "Death Certificate" },
  { key: "PMR",   label: "Post Mortem report",           type: "Post Mortem report" },
  { key: "SEC43", label: "Section 43 application form",  type: "Section 43 application form" },
  { key: "SS",    label: "Supervisor statement",         type: "Supervisor statement" },
  { key: "WS",    label: "Witness statement",            type: "Witness statement" },
  { key: "DD",    label: "Dependency declaration",       type: "Dependency declaration" },
  { key: "PTA",   label: "Payslip at time of accident",  type: "Payslip at time of accident" },
  { key: "PIR",   label: "Police incident report",       type: "Police incident report" },
  { key: "FER",   label: "Funeral expenses receipts",    type: "Funeral expenses receipts" },
  { key: "MEC",   label: "Medical Expenses",             type: "MedicalExpenses" },
  { key: "MISC",  label: "Misc Expenses",                type: "MiscExpenses" },
  { key: "DED",   label: "Deductions",                   type: "Deductions" },
  { key: "F18",   label: "Form 18 Scan",                 type: "Form 18 Scan" },
];

const KEY_TO_ATTACH_TYPE: Record<string, string> = Object.fromEntries(ATTACH_KEYS.map(a => [a.key, a.type]));
const ATTACH_TYPE_TO_KEY: Record<string, string> = Object.fromEntries(ATTACH_KEYS.map(a => [a.type, a.key]));

// -------------------- component --------------------
const EditForm4: React.FC<EditForm4Props> = ({ workerIRN, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data aggregates
  const [formData, setFormData] = useState<any>({});
  const [dependants, setDependants] = useState<any[]>([]);         // Parent | Child | Sibling
  const [otherDependants, setOtherDependants] = useState<any[]>([]); // Other
  const [nominees, setNominees] = useState<any[]>([]);               // Nominee
  const [workHistory, setWorkHistory] = useState<any[]>([]);       // expects WorkHistoryID

	
// baselines for change-summary & compares
const [initialFormData, setInitialFormData] = useState<any>({});
const [initialAttachPaths, setInitialAttachPaths] = useState<Record<string, string>>({});
const [initialDeps, setInitialDeps] = useState<any[]>([]);
const [initialOtherDependants, setInitialOtherDependants] = useState<any[]>([]);
const [initialNominees, setInitialNominees] = useState<any[]>([]);
const [initialHistory, setInitialHistory] = useState<any[]>([]);

  // Previews (passport, scan, and supporting docs)
  const [passportUrl, setPassportUrl] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});

  // One global lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string>("");

  // Local file selections
  const [scanFile, setScanFile] = useState<File | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Tabs
  const [currentTab, setCurrentTab] = useState(1);

  // ---------- Change Summary ----------
// ---------- change-summary (exact same style as EditForm3) ----------
type ChangeRow = { field: string; from: string; to: string };

const [showSummary, setShowSummary] = useState(false);
const [diffs, setDiffs] = useState<ChangeRow[]>([]);
const [attachChanges, setAttachChanges] = useState<ChangeRow[]>([]);
const [collectionChanges, setCollectionChanges] = useState<ChangeRow[]>([]);

// Label map for Form 4's editable fields (match EditForm3 style)
const FIELD_LABELS_F4: Record<string, string> = {
  // Worker
  WorkerFirstName: 'Worker First Name',
  WorkerLastName: 'Worker Last Name',
  WorkerAliasName: 'Worker Alias',
  WorkerDOB: 'Worker DOB',
  WorkerGender: 'Worker Gender',
  WorkerMarried: 'Worker Marital Status',
  WorkerHanded: 'Worker Handed',
  WorkerPlaceOfOriginVillage: 'Worker Origin Village',
  WorkerPlaceOfOriginDistrict: 'Worker Origin District',
  WorkerPlaceOfOriginProvince: 'Worker Origin Province',
  WorkerAddress1: 'Worker Address 1',
  WorkerAddress2: 'Worker Address 2',
  WorkerCity: 'Worker City',
  WorkerProvince: 'Worker Province',
  WorkerPOBox: 'Worker PO Box',
  WorkerEmail: 'Worker Email',
  WorkerMobile: 'Worker Mobile',
  WorkerLandline: 'Worker Landline',

  // Spouse
  SpouseFirstName: 'Spouse First Name',
  SpouseLastName: 'Spouse Last Name',
  SpouseDOB: 'Spouse DOB',
  SpouseAddress1: 'Spouse Address 1',
  SpouseAddress2: 'Spouse Address 2',
  SpouseCity: 'Spouse City',
  SpouseProvince: 'Spouse Province',
  SpousePOBox: 'Spouse PO Box',
  SpouseEmail: 'Spouse Email',
  SpouseMobile: 'Spouse Mobile',
  SpouseLandline: 'Spouse Landline',

  // Employment & Injury (only editable here is IncidentDescription)
  IncidentDescription: 'Description of Incident',

  // Compensation (Form 4)
  AnnualEarningsAtDeath: 'Annual Earnings at Death',
  CompensationBenefitsPriorToDeath: 'Compensation Benefits Prior to Death',
  CompensationBenefitDetails: 'Compensation Benefit Details',
  CompensationClaimed: 'Compensation Claimed',
  MedicalExpenseDetails: 'Medical Expense Details',
  FuneralExpenseDetails: 'Funeral Expense Details',

  // Applicant
  ApplicantFirstName: 'Applicant First Name',
  ApplicantLastName: 'Applicant Last Name',
  ApplicantAddress1: 'Applicant Address 1',
  ApplicantAddress2: 'Applicant Address 2',
  ApplicantCity: 'Applicant City',
  ApplicantProvince: 'Applicant Province',
  ApplicantPOBox: 'Applicant PO Box',
  ApplicantEmail: 'Applicant Email',
  ApplicantMobile: 'Applicant Mobile',
  ApplicantLandline: 'Applicant Landline',
};

const asISO = (v: any) => (v ? new Date(v).toISOString().slice(0,10) : '');
const pretty = (k: string, v: any) => (/(DOB|Date)$/i.test(k) ? asISO(v) : (v ?? '').toString());


const openSummary = () => {
  // Editable keys for Form 4
  const editableKeys = Object.keys(FIELD_LABELS_F4);

  // field diffs
  const rows: ChangeRow[] = [];
  for (const k of editableKeys) {
    const before = pretty(k, initialFormData?.[k]);
    const after  = pretty(k, formData?.[k]);
    if (before !== after) {
      rows.push({ field: FIELD_LABELS_F4[k] || k, from: before || '—', to: after || '—' });
    }
  }

  // attachments
  const fileRows: ChangeRow[] = [];
  for (const { key, label } of ATTACH_KEYS) {
    const before = !!initialAttachPaths[key];
    const after  = !!formData[key];
    if (before !== after) {
      fileRows.push({ field: `Attachment • ${label}`, from: before ? 'Present' : '—', to: after ? 'Present' : '—' });
    }
  }
  if ((initialFormData?.ImageName || '') !== (formData?.ImageName || '')) {
    fileRows.push({ field: 'Form 4 Scan', from: initialFormData?.ImageName ? 'Present' : '—', to: formData?.ImageName ? 'Present' : '—' });
  }

  // collections (show same style summary rows)
  const coll: ChangeRow[] = [];
  const summarize = (name: string, before: any[], after: any[]) => {
    const b = (before || []).filter(x => x?.__status !== 'deleted').length;
    const a = (after  || []).filter(x => x?.__status !== 'deleted').length;
    if (b !== a) {
      coll.push({ field: name, from: `${b} row(s)`, to: `${a} row(s)` });
    } else if (JSON.stringify(before || []) !== JSON.stringify(after || [])) {
      coll.push({ field: name, from: 'unchanged', to: 'modified' });
    }
  };
  summarize('Dependent Children (Parent/Child/Sibling)', initialDeps, dependants);
  summarize('Other Dependants', initialOtherDependants, otherDependants);
  summarize('Nominee Details', initialNominees, nominees);
  summarize('Work History', initialHistory, workHistory);

  setDiffs(rows);
  setAttachChanges(fileRows);
  setCollectionChanges(coll);
  setShowSummary(true);
};


  // ------------ load ------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (workerIRN == null || Number.isNaN(workerIRN)) throw new Error("Invalid IRN");

        // IRN row & WorkerID
        const { data: workerIrnData, error: workerIrnError } = await supabase
          .from("workerirn")
          .select("WorkerID, FirstName, LastName, DisplayIRN")
          .eq("IRN", workerIRN)
          .single();
        if (workerIrnError) throw workerIrnError;
        if (!workerIrnData) throw new Error("Worker not found");
        const wid = workerIrnData.WorkerID;

        // Load in parallel
        const [
          { data: form4Row },   // form4master snapshot
          { data: f1112Row },   // form1112master (injury/incident & insurance)
          { data: workerData }, // workerpersonaldetails
          { data: employmentData },
          { data: provinceData },
          { data: dependantData },
          { data: historyData },
          { data: attachRows },
          { data: providers },
        ] = await Promise.all([
          supabase.from("form4master").select("*").eq("IRN", workerIRN).maybeSingle(),
          supabase
            .from("form1112master")
            .select("IncidentDate, IncidentLocation, IncidentProvince, IncidentRegion, NatureExtentInjury, InjuryCause, InsuranceProviderIPACode")
            .eq("IRN", workerIRN)
            .maybeSingle(),
          supabase.from("workerpersonaldetails").select("*").eq("WorkerID", wid).maybeSingle(),
          supabase.from("currentemploymentdetails").select("*").eq("WorkerID", wid).maybeSingle(),
          supabase.from("dictionary").select("DKey, DValue").eq("DType", "Province"),
          supabase.from("dependantpersonaldetails").select("*, DependantID").eq("WorkerID", wid),
          supabase.from("workhistory").select("*, WorkHistoryID").eq("WorkerID", wid),
          supabase.from("formattachments").select("AttachmentType, FileName").eq("IRN", workerIRN),
          supabase.from("insurancecompanymaster").select("*"),
        ]);

        // Map attachments into keys
        const attachPaths: Record<string, string> = {};
        const previewMap: Record<string, string> = {};
        for (const r of attachRows || []) {
          const key = ATTACH_TYPE_TO_KEY[(r as any).AttachmentType];
          const path = (r as any).FileName as string;
          if (!key || !path) continue;
          attachPaths[key] = path;
          const url = await resolveStorageUrl(path);
          if (url) previewMap[key] = url;
        }

        // Insurance company detail
        let insuranceDetails: any = null;
        const ipa = f1112Row?.InsuranceProviderIPACode ? String(f1112Row.InsuranceProviderIPACode).trim() : "";
        if (ipa) {
          const found = (providers || []).find(
            (p: any) => String(p.IPACODE ?? "").trim().toUpperCase() === ipa.toUpperCase()
          );
          if (found) insuranceDetails = found;
        }

        // Merge form data for editing (Form 4)
        const merged: any = {
          IRN: workerIRN,
          WorkerID: wid,
          DisplayIRN: workerIrnData.DisplayIRN,

          // worker personal (editable)
          WorkerFirstName: workerData?.WorkerFirstName || workerIrnData.FirstName,
          WorkerLastName: workerData?.WorkerLastName || workerIrnData.LastName,
          WorkerAliasName: workerData?.WorkerAliasName || "",
          WorkerDOB: workerData?.WorkerDOB || "",
          WorkerGender: workerData?.WorkerGender || "",
          WorkerMarried: workerData?.WorkerMarried || "",
          WorkerHanded: workerData?.WorkerHanded || "Right",
          WorkerAddress1: workerData?.WorkerAddress1 || "",
          WorkerAddress2: workerData?.WorkerAddress2 || "",
          WorkerCity: workerData?.WorkerCity || "",
          WorkerProvince: workerData?.WorkerProvince || "",
          WorkerPOBox: workerData?.WorkerPOBox || "",
          WorkerEmail: workerData?.WorkerEmail || "",
          WorkerMobile: workerData?.WorkerMobile || "",
          WorkerLandline: workerData?.WorkerLandline || "",
          WorkerPlaceOfOriginVillage: workerData?.WorkerPlaceOfOriginVillage || "",
          WorkerPlaceOfOriginDistrict: workerData?.WorkerPlaceOfOriginDistrict || "",
          WorkerPlaceOfOriginProvince: workerData?.WorkerPlaceOfOriginProvince || "",
          WorkerPassportPhoto: workerData?.WorkerPassportPhoto || "",

          // spouse (editable)
          SpouseFirstName: workerData?.SpouseFirstName || "",
          SpouseLastName: workerData?.SpouseLastName || "",
          SpouseDOB: workerData?.SpouseDOB || "",
          SpouseAddress1: workerData?.SpouseAddress1 || "",
          SpouseAddress2: workerData?.SpouseAddress2 || "",
          SpouseCity: workerData?.SpouseCity || "",
          SpouseProvince: workerData?.SpouseProvince || "",
          SpousePOBox: workerData?.SpousePOBox || "",
          SpouseEmail: workerData?.SpouseEmail || "",
          SpouseMobile: workerData?.SpouseMobile || "",
          SpouseLandline: workerData?.SpouseLandline || "",

          // employment snapshot (read-only in UI)
          EmployerID: employmentData?.EmployerID || "",
          EmployercppsID: employmentData?.EmployerCPPSID || "",
          Occupation: employmentData?.Occupation || "",
          PlaceOfEmployment: employmentData?.PlaceOfEmployment || "",
          NatureOfEmployment: employmentData?.NatureOfEmployment || "",
          AverageWeeklyWage: employmentData?.AverageWeeklyWage || 0,
          SubContractorOrganizationName: employmentData?.SubContractorOrganizationName || "",
          SubContractorLocation: employmentData?.SubContractorLocation || "",
          SubContractorNatureOfBusiness: employmentData?.SubContractorNatureOfBusiness || "",

          // incident (mostly read-only here from 1112)
          IncidentDate: f1112Row?.IncidentDate || "",
          IncidentLocation: f1112Row?.IncidentLocation || "",
          IncidentProvince: f1112Row?.IncidentProvince || "",
          IncidentRegion: f1112Row?.IncidentRegion || "",
          NatureExtentInjury: f1112Row?.NatureExtentInjury || "",
          InjuryCause: f1112Row?.InjuryCause || "",

          // insurance (read-only)
          InsuranceProviderIPACode: f1112Row?.InsuranceProviderIPACode || "",
          ...(insuranceDetails
            ? {
                InsuranceCompanyOrganizationName: insuranceDetails.InsuranceCompanyOrganizationName || "",
                InsuranceCompanyAddress1: insuranceDetails.InsuranceCompanyAddress1 || "",
                InsuranceCompanyAddress2: insuranceDetails.InsuranceCompanyAddress2 || "",
                InsuranceCompanyCity: insuranceDetails.InsuranceCompanyCity || "",
                InsuranceCompanyProvince: insuranceDetails.InsuranceCompanyProvince || "",
                InsuranceCompanyPOBox: insuranceDetails.InsuranceCompanyPOBox || "",
                InsuranceCompanyLandLine: insuranceDetails.InsuranceCompanyLandLine || "",
              }
            : {}),

          // form4master (editable)
          AnnualEarningsAtDeath: form4Row?.AnnualEarningsAtDeath || 0,
          CompensationBenefitsPriorToDeath: safe(form4Row?.CompensationBenefitsPriorToDeath),
          CompensationBenefitDetails: safe(form4Row?.CompensationBenefitDetails),
          CompensationClaimed: safe(form4Row?.CompensationClaimed),
          MedicalExpenseDetails: safe(form4Row?.MedicalExpenseDetails),
          FuneralExpenseDetails: safe(form4Row?.FuneralExpenseDetails),
          IncidentDescription: safe(form4Row?.IncidentDescription),

          // applicant (editable)
          ApplicantFirstName: safe(form4Row?.ApplicantFirstName),
          ApplicantLastName: safe(form4Row?.ApplicantLastName),
          ApplicantAddress1: safe(form4Row?.ApplicantAddress1),
          ApplicantAddress2: safe(form4Row?.ApplicantAddress2),
          ApplicantCity: safe(form4Row?.ApplicantCity),
          ApplicantProvince: safe(form4Row?.ApplicantProvince),
          ApplicantPOBox: safe(form4Row?.ApplicantPOBox),
          ApplicantEmail: safe(form4Row?.ApplicantEmail),
          ApplicantMobile: safe(form4Row?.ApplicantMobile),
          ApplicantLandline: safe(form4Row?.ApplicantLandline),

          // Form 4 scan
          ImageName: safe(form4Row?.Form4ImageName || form4Row?.ImageName),

          // supporting docs (paths)
          ...attachPaths,
        };

        setFormData(merged);
        setInitialFormData(merged);
        setInitialAttachPaths(attachPaths);

        // Partition dependant rows by type
        const allDeps = dependantData || [];
        const typeOf = (x: any) => String(x?.DependantType || "").toLowerCase();
        setDependants(
          allDeps.filter((d: any) => ["parent", "child", "sibling"].includes(typeOf(d))).map((d: any) => ({ ...d, __status: "existing" }))
        );
        setOtherDependants(
          allDeps.filter((d: any) => typeOf(d) === "other").map((d: any) => ({ ...d, __status: "existing" }))
        );
        setNominees(
          allDeps.filter((d: any) => typeOf(d) === "nominee").map((d: any) => ({ ...d, __status: "existing" }))
        );
        setWorkHistory((historyData || []).map((h: any) => ({ ...h, __status: "existing" })));

        setInitialDeps(allDeps.filter((d: any) => ["parent", "child", "sibling"].includes(typeOf(d))));
setInitialOtherDependants(allDeps.filter((d: any) => typeOf(d) === "other"));
        setInitialNominees(allDeps.filter((d: any) => typeOf(d) === "nominee"));
        setInitialHistory(historyData || []);

        // Previews
        const pUrl = await resolveStorageUrl(merged.WorkerPassportPhoto);
        setPassportUrl(pUrl);
        const sUrl = await resolveStorageUrl(merged.ImageName);
        setScanUrl(sUrl);

        setAttachmentPreviews((prev) => ({ ...prev, ...previewMap }));
      } catch (e: any) {
        console.error("EditForm4 load error:", e);
        setError(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [workerIRN]);

  // -------------------- handlers --------------------
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleScanPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setScanFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setScanUrl(url);
      // don't set ImageName yet; do it on save
    }
  };

  const handleAttachPick = (key: string) => async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setAttachmentPreviews((prev) => ({ ...prev, [key]: url }));
    setFormData((prev: any) => ({ ...prev, [key + "_FILE"]: f })); // keep temp file
  };

  const removeAttachment = (key: string) => {
    setAttachmentPreviews((prev) => {
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
    setFormData((prev: any) => {
      const copy = { ...prev };
      delete copy[key + "_FILE"]; // temp file
      delete copy[key]; // stored path
      return copy;
    });
  };

  // Dependants inline editing
  const addDep = (type: "Parent" | "Child" | "Sibling") => {
    setDependants((prev) => [
      ...prev,
      {
        DependantID: undefined,
        DependantFirstName: "",
        DependantLastName: "",
        DependantDOB: "",
        DependantGender: "",
        DependantType: type,
        DependantAddress1: "",
        DependantAddress2: "",
        DependantCity: "",
        DependantProvince: "",
        DependantPOBox: "",
        DependantEmail: "",
        DependantMobile: "",
        DependantLandline: "",
        DependanceDegree: 0,
        __status: "new",
      },
    ]);
  };
  const addOtherDep = () => addRowTo("other");
  const addNominee = () => addRowTo("nominee");

  const addRowTo = (bucket: "other" | "nominee") => {
    const base = {
      DependantID: undefined,
      DependantFirstName: "",
      DependantLastName: "",
      DependantDOB: "",
      DependantGender: "",
      DependantType: bucket === "other" ? "Other" : "Nominee",
      DependantAddress1: "",
      DependantAddress2: "",
      DependantCity: "",
      DependantProvince: "",
      DependantPOBox: "",
      DependantEmail: "",
      DependantMobile: "",
      DependantLandline: "",
      DependanceDegree: 0,
      __status: "new",
    };
    if (bucket === "other") setOtherDependants((p) => [...p, base]);
    else setNominees((p) => [...p, base]);
  };

  const updateDep = (idx: number, key: string, value: any) =>
    setDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  const delDep = (idx: number) =>
    setDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, __status: "deleted" } : d)));

  const updateOther = (idx: number, key: string, value: any) =>
    setOtherDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  const delOther = (idx: number) =>
    setOtherDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, __status: "deleted" } : d)));

  const updateNominee = (idx: number, key: string, value: any) =>
    setNominees((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  const delNominee = (idx: number) =>
    setNominees((prev) => prev.map((d, i) => (i === idx ? { ...d, __status: "deleted" } : d)));

  // Work history inline editing
  const addHistory = () => {
    setWorkHistory((prev) => [
      ...prev,
      {
        WorkHistoryID: undefined,
        OrganizationName: "",
        OrganizationAddress1: "",
        OrganizationCity: "",
        OrganizationProvince: "",
        OrganizationPOBox: "",
        OrganizationLandline: "",
        OrganizationCPPSID: "",
        WorkerJoiningDate: "",
        WorkerLeavingDate: "",
        __status: "new",
      },
    ]);
  };
  const updateHistory = (idx: number, key: string, value: any) =>
    setWorkHistory((prev) => prev.map((h, i) => (i === idx ? { ...h, [key]: value } : h)));
  const deleteHistory = (idx: number) =>
    setWorkHistory((prev) => prev.map((h, i) => (i === idx ? { ...h, __status: "deleted" } : h)));

  // ---------- persist ----------
  const persistAll = async () => {
const irn = Number(formData.IRN ?? workerIRN);
const wid = Number(formData.WorkerID);
if (!irn || !wid) throw new Error("Missing identifiers");

    // 0) Upload Form 4 scan if selected
    if (scanFile) {
      const ext = scanFile.name.split(".").pop() || "bin";
      const dest = `form4/${irn}/form4-scan.${ext}`;
      const path = await uploadToStorage(scanFile, dest);
      setFormData((prev: any) => ({ ...prev, ImageName: path }));
      {
  const patch = { Form4ImageName: path };
  const { data: updated, error: upErr } = await supabase
    .from("form4master")
    .update(patch)
    .eq("IRN", irn)
    .select("IRN")


  if (upErr) throw upErr;

  if (!updated || updated.length === 0) {
    const { error: insErr } = await supabase
      .from("form4master")
      .insert({ IRN: irn, ...patch });
    if (insErr) throw insErr;
  }
}

    }

    // 1) Upload supporting documents selected
    for (const { key } of ATTACH_KEYS) {
      const tempFile: File | undefined = (formData as any)[key + "_FILE"];
      if (tempFile) {
        const ext = tempFile.name.split(".").pop() || "bin";
        const dest = `form4/${irn}/attachments/${key}.${ext}`;
        const storedPath = await uploadToStorage(tempFile, dest);
        const attachType = KEY_TO_ATTACH_TYPE[key] || key;
        await supabase
          .from("formattachments")
          .upsert(
            { IRN: irn, AttachmentType: attachType, FileName: storedPath },
            { onConflict: "IRN,AttachmentType" }
          );
        const url = await resolveStorageUrl(storedPath);
        setAttachmentPreviews((prev) => ({ ...prev, [key]: url }));
        setFormData((prev: any) => ({ ...prev, [key]: storedPath }));
      }
    }

    // 2) Persist worker + spouse (workerpersonaldetails)
    const workerPayload: any = {
      WorkerFirstName: formData.WorkerFirstName ?? null,
      WorkerLastName: formData.WorkerLastName ?? null,
      WorkerAliasName: formData.WorkerAliasName ?? null,
      WorkerDOB: formData.WorkerDOB || null,
      WorkerGender: formData.WorkerGender ?? null,
      WorkerMarried: formData.WorkerMarried ?? null,
      WorkerHanded: formData.WorkerHanded ?? null,
      WorkerPlaceOfOriginVillage: formData.WorkerPlaceOfOriginVillage ?? null,
      WorkerPlaceOfOriginDistrict: formData.WorkerPlaceOfOriginDistrict ?? null,
      WorkerPlaceOfOriginProvince: formData.WorkerPlaceOfOriginProvince ?? null,
      WorkerAddress1: formData.WorkerAddress1 ?? null,
      WorkerAddress2: formData.WorkerAddress2 ?? null,
      WorkerCity: formData.WorkerCity ?? null,
      WorkerProvince: formData.WorkerProvince ?? null,
      WorkerPOBox: formData.WorkerPOBox ?? null,
      WorkerEmail: formData.WorkerEmail ?? null,
      WorkerMobile: formData.WorkerMobile ?? null,
      WorkerLandline: formData.WorkerLandline ?? null,
      // spouse (editable)
      SpouseFirstName: formData.SpouseFirstName ?? null,
      SpouseLastName: formData.SpouseLastName ?? null,
      SpouseDOB: formData.SpouseDOB || null,
      SpouseAddress1: formData.SpouseAddress1 ?? null,
      SpouseAddress2: formData.SpouseAddress2 ?? null,
      SpouseCity: formData.SpouseCity ?? null,
      SpouseProvince: formData.SpouseProvince ?? null,
      SpousePOBox: formData.SpousePOBox ?? null,
      SpouseEmail: formData.SpouseEmail ?? null,
      SpouseMobile: formData.SpouseMobile ?? null,
      SpouseLandline: formData.SpouseLandline ?? null,
    };
   await supabase.from("workerpersonaldetails").update(workerPayload).eq("WorkerID", wid);

    // 3) Upsert editable Form 4 fields (form4master)
    const f4Payload: any = {
      IRN: irn,
      WorkerID: wid,
      AnnualEarningsAtDeath: formData.AnnualEarningsAtDeath ?? null,
      CompensationBenefitsPriorToDeath: formData.CompensationBenefitsPriorToDeath ?? null,
      CompensationBenefitDetails: formData.CompensationBenefitDetails ?? null,
      CompensationClaimed: formData.CompensationClaimed ?? null,
      MedicalExpenseDetails: formData.MedicalExpenseDetails ?? null,
      FuneralExpenseDetails: formData.FuneralExpenseDetails ?? null,
      IncidentDescription: formData.IncidentDescription ?? null, // editable on Employment & Injury tab
      ApplicantFirstName: formData.ApplicantFirstName ?? null,
      ApplicantLastName: formData.ApplicantLastName ?? null,
      ApplicantAddress1: formData.ApplicantAddress1 ?? null,
      ApplicantAddress2: formData.ApplicantAddress2 ?? null,
      ApplicantCity: formData.ApplicantCity ?? null,
      ApplicantProvince: formData.ApplicantProvince ?? null,
      ApplicantPOBox: formData.ApplicantPOBox ?? null,
      ApplicantEmail: formData.ApplicantEmail ?? null,
      ApplicantMobile: formData.ApplicantMobile ?? null,
      ApplicantLandline: formData.ApplicantLandline ?? null,
      Form4ImageName: formData.ImageName || null,
    };
    {
  const { data: updated, error: upErr } = await supabase
    .from("form4master")
    .update(f4Payload)
    .eq("IRN", irn)
    .select("IRN")
    

  if (upErr) throw upErr;

  if (!updated || updated.length === 0) {
    const { error: insErr } = await supabase.from("form4master").insert(f4Payload);
    if (insErr) throw insErr;
  }
}


    // 4) Persist dependant buckets
    const persistDepRow = async (row: any) => {
      const payload: any = {
        WorkerID: wid,
        DependantFirstName: row.DependantFirstName || null,
        DependantLastName: row.DependantLastName || null,
        DependantDOB: row.DependantDOB || null,
        DependantGender: row.DependantGender || null,
        DependantType: row.DependantType || null,
        DependantAddress1: row.DependantAddress1 || null,
        DependantAddress2: row.DependantAddress2 || null,
        DependantCity: row.DependantCity || null,
        DependantProvince: row.DependantProvince || null,
        DependantPOBox: row.DependantPOBox || null,
        DependantEmail: row.DependantEmail || null,
        DependantMobile: row.DependantMobile || null,
        DependantLandline: row.DependantLandline || null,
        DependanceDegree: row.DependanceDegree ?? null,
      };
      return payload;
    };

		{/*
// 2) worker + spouse: use upsert with conflict key
await supabase.from("workerpersonaldetails").upsert(
  { WorkerID: wid, ...workerPayload },
  { onConflict: "WorkerID" }
);

// 3) upsert form4master on IRN
await supabase.from("form4master").upsert(
  f4Payload,
  { onConflict: "IRN" }
);  */}
		
    const allBuckets = [
      ...dependants.map((d) => ({ bucket: "pcs", row: d })),
      ...otherDependants.map((d) => ({ bucket: "other", row: d })),
      ...nominees.map((d) => ({ bucket: "nominee", row: d })),
    ];
    for (const { row } of allBuckets) {
      if (row.__status === "deleted" && row.DependantID) {
        await supabase.from("dependantpersonaldetails").delete().eq("DependantID", row.DependantID);
        continue;
      }
      if (row.__status === "new") {
        const payload = await persistDepRow(row);
        await supabase.from("dependantpersonaldetails").insert(payload);
        continue;
      }
      if (row.__status === "existing" && row.DependantID) {
        const payload = await persistDepRow(row);
        await supabase.from("dependantpersonaldetails").update(payload).eq("DependantID", row.DependantID);
      }
    }

    // 5) Persist Work History
    for (const h of workHistory) {
      if (h.__status === "deleted" && h.WorkHistoryID) {
        await supabase.from("workhistory").delete().eq("WorkHistoryID", h.WorkHistoryID);
        continue;
      }
      const payload: any = {
        WorkerID: wid,
        OrganizationName: h.OrganizationName || null,
        OrganizationAddress1: h.OrganizationAddress1 || null,
        OrganizationCity: h.OrganizationCity || null,
        OrganizationProvince: h.OrganizationProvince || null,
        OrganizationPOBox: h.OrganizationPOBox || null,
        OrganizationLandline: h.OrganizationLandline || null,
        OrganizationCPPSID: h.OrganizationCPPSID || null,
        WorkerJoiningDate: h.WorkerJoiningDate || null,
        WorkerLeavingDate: h.WorkerLeavingDate || null,
      };
      if (h.__status === "new") {
        await supabase.from("workhistory").insert(payload);
      } else if (h.__status === "existing" && h.WorkHistoryID) {
        await supabase.from("workhistory").update(payload).eq("WorkHistoryID", h.WorkHistoryID);
      }
    }
  };

  const save = async () => {
    try {
      setError(null);
      // Show summary first
      openSummary();
    } catch (e: any) {
      setError(e?.message || "Failed to prepare save");
    }
  };

  const confirmSave = async () => {
    try {
      setSaving(true);
      await persistAll();
      if (onSaved) onSaved(formData.IRN || workerIRN);
      onClose();
    } catch (e: any) {
      console.error("EditForm4 save error:", e);
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
      setShowSummary(false);
    }
  };

  // -------------------- renderers --------------------
  const renderWorker = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">IRN</label>
          <input className="input" value={safe(formData.DisplayIRN)} readOnly disabled />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input name="WorkerFirstName" className="input" value={safe(formData.WorkerFirstName)} onChange={handleChange} />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input name="WorkerLastName" className="input" value={safe(formData.WorkerLastName)} onChange={handleChange} />
        </div>
        <div>
          {passportUrl && (
            <img
              src={passportUrl}
              alt="Passport"
              className="rounded-lg border w-24 h-24 object-cover cursor-zoom-in"
              onClick={() => setLightboxSrc(passportUrl)}
              loading="lazy"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Alias</label>
          <input name="WorkerAliasName" className="input" value={safe(formData.WorkerAliasName)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input name="WorkerDOB" type="date" className="input" value={dateISO(formData.WorkerDOB)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <input name="WorkerGender" className="input" value={safe(formData.WorkerGender)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <input name="WorkerMarried" className="input" value={safe(formData.WorkerMarried)} onChange={handleChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Handed</label>
          <input name="WorkerHanded" className="input" value={safe(formData.WorkerHanded)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin Village</label>
          <input name="WorkerPlaceOfOriginVillage" className="input" value={safe(formData.WorkerPlaceOfOriginVillage)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin District</label>
          <input name="WorkerPlaceOfOriginDistrict" className="input" value={safe(formData.WorkerPlaceOfOriginDistrict)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin Province</label>
          <input name="WorkerPlaceOfOriginProvince" className="input" value={safe(formData.WorkerPlaceOfOriginProvince)} onChange={handleChange} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
        <input name="WorkerAddress1" className="input" value={safe(formData.WorkerAddress1)} onChange={handleChange} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
        <input name="WorkerAddress2" className="input" value={safe(formData.WorkerAddress2)} onChange={handleChange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input name="WorkerCity" className="input" value={safe(formData.WorkerCity)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input name="WorkerProvince" className="input" value={safe(formData.WorkerProvince)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input name="WorkerPOBox" className="input" value={safe(formData.WorkerPOBox)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input name="WorkerEmail" className="input" value={safe(formData.WorkerEmail)} onChange={handleChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input name="WorkerMobile" className="input" value={safe(formData.WorkerMobile)} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input name="WorkerLandline" className="input" value={safe(formData.WorkerLandline)} onChange={handleChange} />
        </div>
      </div>
    </div>
  );

  const renderEmploymentInjury = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">All fields on this tab are read-only except <b>Description of Incident</b>.</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employer ID</label>
          <input className="input" value={safe(formData.EmployerID)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Employer CPPSID</label>
          <input className="input" value={safe(formData.EmployercppsID)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation</label>
          <input className="input" value={safe(formData.Occupation)} readOnly disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Employment</label>
          <input className="input" value={safe(formData.PlaceOfEmployment)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
          <input className="input" value={safe(formData.NatureOfEmployment)} readOnly disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Date</label>
          <input className="input" value={dateISO(formData.IncidentDate)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Location</label>
          <input className="input" value={safe(formData.IncidentLocation)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input className="input" value={safe(formData.IncidentProvince)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Region</label>
          <input className="input" value={safe(formData.IncidentRegion)} readOnly disabled />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature/Extent of Injury</label>
        <textarea className="input" value={safe(formData.NatureExtentInjury)} readOnly disabled rows={2} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
        <textarea className="input" value={safe(formData.InjuryCause)} readOnly disabled rows={2} />
      </div>

      {/* Editable here */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Description of Incident</label>
        <textarea
          name="IncidentDescription"
          value={safe(formData.IncidentDescription)}
          onChange={handleChange}
          className="input"
          rows={4}
        />
      </div>
    </div>
  );

  const renderWorkHistory = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Work History</h3>
        <button
          type="button"
          onClick={addHistory}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
        >
          <PlusCircle size={16} /> Add
        </button>
      </div>
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
            <th className="px-2 py-1 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workHistory.length === 0 && (
            <tr>
              <td colSpan={10} className="p-4 text-gray-500 text-center">No records</td>
            </tr>
          )}
          {workHistory.map((h, i) => (
            <tr key={i} className={h.__status === "deleted" ? "opacity-50" : ""}>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(h.OrganizationName)}
                  onChange={(e) => updateHistory(i, "OrganizationName", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(h.OrganizationAddress1)}
                  onChange={(e) => updateHistory(i, "OrganizationAddress1", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(h.OrganizationCity)}
                  onChange={(e) => updateHistory(i, "OrganizationCity", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(h.OrganizationProvince)}
                  onChange={(e) => updateHistory(i, "OrganizationProvince", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(h.OrganizationPOBox)}
                  onChange={(e) => updateHistory(i, "OrganizationPOBox", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(h.OrganizationLandline)}
                  onChange={(e) => updateHistory(i, "OrganizationLandline", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(h.OrganizationCPPSID)}
                  onChange={(e) => updateHistory(i, "OrganizationCPPSID", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  type="date"
                  className="input"
                  value={dateISO(h.WorkerJoiningDate)}
                  onChange={(e) => updateHistory(i, "WorkerJoiningDate", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  type="date"
                  className="input"
                  value={dateISO(h.WorkerLeavingDate)}
                  onChange={(e) => updateHistory(i, "WorkerLeavingDate", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1 text-center">
                <button
                  type="button"
                  onClick={() => deleteHistory(i)}
                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                >
                  <MinusCircle size={16} /> Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSpouse = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input name="SpouseFirstName" value={safe(formData.SpouseFirstName)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input name="SpouseLastName" value={safe(formData.SpouseLastName)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input name="SpouseDOB" type="date" value={dateISO(formData.SpouseDOB)} onChange={handleChange} className="input" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
        <input name="SpouseAddress1" value={safe(formData.SpouseAddress1)} onChange={handleChange} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
        <input name="SpouseAddress2" value={safe(formData.SpouseAddress2)} onChange={handleChange} className="input" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input name="SpouseCity" value={safe(formData.SpouseCity)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input name="SpouseProvince" value={safe(formData.SpouseProvince)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input name="SpousePOBox" value={safe(formData.SpousePOBox)} onChange={handleChange} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input name="SpouseEmail" value={safe(formData.SpouseEmail)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input name="SpouseMobile" value={safe(formData.SpouseMobile)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input name="SpouseLandline" value={safe(formData.SpouseLandline)} onChange={handleChange} className="input" />
        </div>
      </div>
    </div>
  );

  const renderDependantsPCS = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Dependent Children (Parent/Child/Sibling)</h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => addDep("Parent")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200">
            <PlusCircle size={16} /> Add Parent
          </button>
          <button type="button" onClick={() => addDep("Child")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200">
            <PlusCircle size={16} /> Add Child
          </button>
          <button type="button" onClick={() => addDep("Sibling")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200">
            <PlusCircle size={16} /> Add Sibling
          </button>
        </div>
      </div>
      <table className="min-w-full text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 border">First Name</th>
            <th className="px-2 py-1 border">Last Name</th>
            <th className="px-2 py-1 border">DOB</th>
            <th className="px-2 py-1 border">Gender</th>
            <th className="px-2 py-1 border">Relation</th>
            <th className="px-2 py-1 border">Degree</th>
            <th className="px-2 py-1 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {dependants.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-gray-500 text-center">No dependants</td>
            </tr>
          )}
          {dependants.map((d, i) => (
            <tr key={i} className={d.__status === "deleted" ? "opacity-50" : ""}>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantFirstName)} onChange={(e) => updateDep(i, "DependantFirstName", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantLastName)} onChange={(e) => updateDep(i, "DependantLastName", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input type="date" className="input" value={dateISO(d.DependantDOB)} onChange={(e) => updateDep(i, "DependantDOB", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantGender)} onChange={(e) => updateDep(i, "DependantGender", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantType)} onChange={(e) => updateDep(i, "DependantType", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependanceDegree)} onChange={(e) => updateDep(i, "DependanceDegree", e.target.value)} />
              </td>
              <td className="border px-2 py-1 text-center">
                <button type="button" onClick={() => delDep(i)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
                  <MinusCircle size={16} /> Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOtherDependants = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Other Dependants</h3>
        <button
          type="button"
          onClick={addOtherDep}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
        >
          <PlusCircle size={16} /> Add
        </button>
      </div>
      <table className="min-w-full text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 border">First Name</th>
            <th className="px-2 py-1 border">Last Name</th>
            <th className="px-2 py-1 border">DOB</th>
            <th className="px-2 py-1 border">Gender</th>
            <th className="px-2 py-1 border">Relation</th>
            <th className="px-2 py-1 border">Degree</th>
            <th className="px-2 py-1 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {otherDependants.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-gray-500 text-center">No dependants</td>
            </tr>
          )}
          {otherDependants.map((d, i) => (
            <tr key={i} className={d.__status === "deleted" ? "opacity-50" : ""}>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantFirstName)} onChange={(e) => updateOther(i, "DependantFirstName", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantLastName)} onChange={(e) => updateOther(i, "DependantLastName", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input type="date" className="input" value={dateISO(d.DependantDOB)} onChange={(e) => updateOther(i, "DependantDOB", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantGender)} onChange={(e) => updateOther(i, "DependantGender", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantType)} onChange={(e) => updateOther(i, "DependantType", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependanceDegree)} onChange={(e) => updateOther(i, "DependanceDegree", e.target.value)} />
              </td>
              <td className="border px-2 py-1 text-center">
                <button type="button" onClick={() => delOther(i)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
                  <MinusCircle size={16} /> Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderNominees = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Nominee Details</h3>
        <button
          type="button"
          onClick={addNominee}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
        >
          <PlusCircle size={16} /> Add
        </button>
      </div>
      <table className="min-w-full text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 border">First Name</th>
            <th className="px-2 py-1 border">Last Name</th>
            <th className="px-2 py-1 border">DOB</th>
            <th className="px-2 py-1 border">Gender</th>
            <th className="px-2 py-1 border">Relation</th>
            <th className="px-2 py-1 border">Degree</th>
            <th className="px-2 py-1 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {nominees.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-gray-500 text-center">No nominees</td>
            </tr>
          )}
          {nominees.map((d, i) => (
            <tr key={i} className={d.__status === "deleted" ? "opacity-50" : ""}>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantFirstName)} onChange={(e) => updateNominee(i, "DependantFirstName", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantLastName)} onChange={(e) => updateNominee(i, "DependantLastName", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input type="date" className="input" value={dateISO(d.DependantDOB)} onChange={(e) => updateNominee(i, "DependantDOB", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantGender)} onChange={(e) => updateNominee(i, "DependantGender", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependantType)} onChange={(e) => updateNominee(i, "DependantType", e.target.value)} />
              </td>
              <td className="border px-2 py-1">
                <input className="input" value={safe(d.DependanceDegree)} onChange={(e) => updateNominee(i, "DependanceDegree", e.target.value)} />
              </td>
              <td className="border px-2 py-1 text-center">
                <button type="button" onClick={() => delNominee(i)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
                  <MinusCircle size={16} /> Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCompensation = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Annual Earnings at Death</label>
          <input
            name="AnnualEarningsAtDeath"
            value={safe(formData.AnnualEarningsAtDeath)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Benefits Prior To Death (Yes/No)</label>
          <input
            name="CompensationBenefitsPriorToDeath"
            value={safe(formData.CompensationBenefitsPriorToDeath)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Compensation Claimed</label>
          <input
            name="CompensationClaimed"
            value={safe(formData.CompensationClaimed)}
            onChange={handleChange}
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Benefit Details</label>
        <textarea
          name="CompensationBenefitDetails"
          value={safe(formData.CompensationBenefitDetails)}
          onChange={handleChange}
          className="input"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Medical Expense Details</label>
        <textarea
          name="MedicalExpenseDetails"
          value={safe(formData.MedicalExpenseDetails)}
          onChange={handleChange}
          className="input"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Funeral Expense Details</label>
        <textarea
          name="FuneralExpenseDetails"
          value={safe(formData.FuneralExpenseDetails)}
          onChange={handleChange}
          className="input"
          rows={2}
        />
      </div>
    </div>
  );

  const renderInsurance = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">Insurance details are read-only in Edit mode.</div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider IPA Code</label>
        <input className="input" value={safe(formData.InsuranceProviderIPACode)} readOnly disabled />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Company Name</label>
          <input className="input" value={safe(formData.InsuranceCompanyOrganizationName)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input className="input" value={safe(formData.InsuranceCompanyCity)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input className="input" value={safe(formData.InsuranceCompanyProvince)} readOnly disabled />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address 1</label>
          <input className="input" value={safe(formData.InsuranceCompanyAddress1)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address 2</label>
          <input className="input" value={safe(formData.InsuranceCompanyAddress2)} readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">PO Box</label>
          <input className="input" value={safe(formData.InsuranceCompanyPOBox)} readOnly disabled />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Landline</label>
        <input className="input" value={safe(formData.InsuranceCompanyLandLine)} readOnly disabled />
      </div>
    </div>
  );

  const renderApplicant = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input name="ApplicantFirstName" value={safe(formData.ApplicantFirstName)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input name="ApplicantLastName" value={safe(formData.ApplicantLastName)} onChange={handleChange} className="input" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
        <input name="ApplicantAddress1" value={safe(formData.ApplicantAddress1)} onChange={handleChange} className="input" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
        <input name="ApplicantAddress2" value={safe(formData.ApplicantAddress2)} onChange={handleChange} className="input" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input name="ApplicantCity" value={safe(formData.ApplicantCity)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input name="ApplicantProvince" value={safe(formData.ApplicantProvince)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input name="ApplicantPOBox" value={safe(formData.ApplicantPOBox)} onChange={handleChange} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input name="ApplicantEmail" value={safe(formData.ApplicantEmail)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input name="ApplicantMobile" value={safe(formData.ApplicantMobile)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input name="ApplicantLandline" value={safe(formData.ApplicantLandline)} onChange={handleChange} className="input" />
        </div>
      </div>
    </div>
  );

  const renderForm4Scan = () => (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">Form 4 Scan</label>
      <div className="flex items-center gap-4">
        {scanUrl ? (
          isImagePath(formData.ImageName) ? (
            <img
              src={scanUrl}
              className="w-32 h-32 rounded border object-cover cursor-zoom-in"
              onClick={() => setLightboxSrc(scanUrl)}
              alt="Form 4 Scan"
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
          <div className="w-24 h-24 grid place-content-center text-xs text-gray-500 border rounded">No scan</div>
        )}
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 cursor-pointer text-sm">
          <Upload size={16} /> Replace
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScanPick} />
        </label>
      </div>
    </div>
  );

  const renderSupportingDocs = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ATTACH_KEYS.map(({ key, label }) => {
          const preview = attachmentPreviews[key];
          const pathVal = safe((formData as any)[key]);
          const inputId = `file_${key}`;
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>
                <div className="flex items-center gap-2">
                  {pathVal && (
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => removeAttachment(key)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {preview ? (
                isImagePath(pathVal) ? (
                  <img
                    src={preview}
                    className="w-28 h-28 object-cover rounded border cursor-zoom-in"
                    onClick={() => setLightboxSrc(preview)}
                    alt={label}
                  />
                ) : (
                  <a href={preview} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                    Open current file
                  </a>
                )
              ) : pathVal ? (
                <a href={pathVal} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                  Open current file
                </a>
              ) : (
                <div className="text-xs text-gray-500">Not attached</div>
              )}

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 cursor-pointer text-sm">
                  <Upload size={16} /> Upload/Replace
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleAttachPick(key)}
                    ref={(el) => (fileInputsRef.current[key] = el)}
                  />
                </label>
                {pathVal && (
                  <a
                    href={preview || pathVal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-gray-700 hover:underline"
                  >
                    <FileText size={16} /> View
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Tabs (order matches Death / Form 4 flow)
  const tabs = useMemo(
    () => [
      { name: "Deceased Worker Details", render: renderWorker },
      { name: "Employment & Injury", render: renderEmploymentInjury },   // read-only except IncidentDescription
      { name: "Work History", render: renderWorkHistory },
      { name: "Spouse Details", render: renderSpouse },
      { name: "Dependent Details", render: renderDependantsPCS },
      { name: "Other Dependants", render: renderOtherDependants },
      { name: "Nominee Details", render: renderNominees },
      { name: "Compensation Claimed", render: renderCompensation },
      { name: "Insurance Details", render: renderInsurance },            // read-only
      { name: "Details of Applicant", render: renderApplicant },
      { name: "Form 4 Scan", render: renderForm4Scan },
      { name: "Supporting Documents", render: renderSupportingDocs },
    ],
    [attachmentPreviews, scanUrl, passportUrl, formData, dependants, otherDependants, nominees, workHistory]
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-black rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X size={28} />
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Edit Form 4</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save size={16} /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

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
                    currentTab === idx + 1 ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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

      {/* global lightbox for previews */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} />}

      {/* Change Summary Modal */}
 {/* change summary modal (same look as EditForm3) */}
{showSummary && (
  <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Review changes</h3>
        <button onClick={() => setShowSummary(false)} className="text-gray-500 hover:text-black">
          <X size={22} />
        </button>
      </div>

      {/* Fields */}
      {diffs.length > 0 && (
        <>
          <div className="text-sm font-medium mb-2">Updated fields</div>
          <div className="border rounded-lg overflow-hidden mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Field</th>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">To</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-medium">{r.field}</td>
                    <td className="px-4 py-2 text-gray-600">{r.from || '—'}</td>
                    <td className="px-4 py-2 text-green-700">{r.to || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Collections */}
      {collectionChanges.length > 0 && (
        <>
          <div className="text-sm font-medium mb-2">Lists & rows</div>
          <ul className="mb-6 space-y-1">
            {collectionChanges.map((r, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{r.field}:</span> <span className="text-gray-600">{r.from}</span> → <span className="text-green-700">{r.to}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Attachments */}
      {attachChanges.length > 0 && (
        <>
          <div className="text-sm font-medium mb-2">Files & attachments</div>
          <ul className="mb-6 space-y-1">
            {attachChanges.map((r, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{r.field}:</span> <span className="text-gray-600">{r.from}</span> → <span className="text-green-700">{r.to}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {diffs.length === 0 && attachChanges.length === 0 && collectionChanges.length === 0 && (
        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
          No changes detected.
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowSummary(false)}
          className="px-4 py-2 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
        >
          Go back to editing
        </button>
        <button
          type="button"
          onClick={confirmSave}
          className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:opacity-90"
        >
          Confirm &amp; Save
        </button>
      </div>
    </div>
  </div>
)}


      {/* style for .input */}
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

export default EditForm4;
