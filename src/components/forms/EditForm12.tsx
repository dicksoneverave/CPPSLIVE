import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../services/supabase";

// ==============================
// Helpers (match NewForm12 behavior)
// ==============================
const normalizeStoragePath = (p?: string) => {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  let s = p.replace(/^\/*/, "");
  s = s.replace(/^(?:cpps\/+)+/i, "");
  return s;
};
const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || "");
const s = (v: unknown) => (v ?? "") as string;
const b = (v: unknown) => !!v;

const resolveStorageUrl = async (rawPath: string): Promise<string | null> => {
  try {
    if (!rawPath) return null;
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const path = normalizeStoragePath(rawPath);
    if (!path) return null;
    const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    const { data: signed } = await supabase.storage.from("cpps").createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl ?? null;
  } catch (e) {
    console.error("resolveStorageUrl failed:", e);
    return null;
  }
};

const toDateInput = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toISOString().split("T")[0];
};

// ==============================
// Types
// ==============================
export interface EditForm12Props {
  workerId: string;
  irn?: number | string | null; // which IRN to edit (fallback to latest for worker)
  onClose: () => void;
}

interface Form12Data {
  // Worker Personal Details (pre-filled)
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
  WorkerPassportPhoto?: string; // ADDED

  // Dependant Details (to mimic Form 11)
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

  // Incident Details
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

  // Form12 Specific Fields
  DeathDate: string;
  DeathCause: string;
  DeathLocation: string;
  DeathProvince: string;
  DeathRegion: string;
  DeathRelatedToInjury: boolean;
  DeathCircumstances: string;

  // Insurance Details
  InsuranceProviderIPACode: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;

  // Form Attachments (KEEP death-specific list)
  ImageName: string;
  PublicUrl: string;
  DC?: string; // Death Certificate (storage path)
  PMR?: string; // Post Mortem Report
  PIR?: string; // Police incident report
  WS?: string; // Witness statement
  SEC43?: string;
  SS?: string;
  DD?: string; // Dependency declaration
  PTA?: string; // Payslip at time of accident
  FER?: string; // Funeral expense receipts
  F18?: string;
  MEX?: string;
  MISC?: string;
  DED?: string;

  // System fields
  DisplayIRN: string; // database column name stays the same
  TimeBarred: boolean | string; // we store Yes/No string to DB, but track boolean
  FirstSubmissionDate: string;
  IncidentType: string;
}

// Summary row
type ChangeRow = { field: string; from: string; to: string };

// ==============================
// Component
// ==============================
const EditForm12: React.FC<EditForm12Props> = ({ workerId, irn, onClose }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reference data
  const [provinces, setProvinces] = useState<any[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);

  // Passport
  const [passportUrl, setPassportUrl] = useState("");
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);

  // Main scan
  const [scanUrl, setScanUrl] = useState("");
  const [scanLocalUrl, setScanLocalUrl] = useState("");
  const [isScanOpen, setIsScanOpen] = useState(false);

  // Supporting docs previews (local+remote)
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [attachmentLocalPreviews, setAttachmentLocalPreviews] = useState<Record<string, string>>({});

  // File staging
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [generatedFileNames, setGeneratedFileNames] = useState<Record<string, string>>({});

  // Editing IRN
  const [editingIRN, setEditingIRN] = useState<number | null>(null);

  // Summary (EditForm11 style)
  const [showSummary, setShowSummary] = useState(false);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [originalData, setOriginalData] = useState<Form12Data | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Form state (init from NewForm12 defaults; will be overwritten by loaded data)
  const [formData, setFormData] = useState<Form12Data>({
    WorkerID: workerId,
    WorkerFirstName: "",
    WorkerLastName: "",
    WorkerDOB: "",
    WorkerGender: "",
    WorkerMarried: "",
    WorkerHanded: "Right",
    WorkerPlaceOfOriginVillage: "",
    WorkerPlaceOfOriginDistrict: "",
    WorkerPlaceOfOriginProvince: "",
    WorkerAddress1: "",
    WorkerAddress2: "",
    WorkerCity: "",
    WorkerProvince: "",
    WorkerPOBox: "",
    WorkerEmail: "",
    WorkerMobile: "",
    WorkerLandline: "",
    WorkerPassportPhoto: "",

    // Dependant Details (defaults)
    SpouseFirstName: "",
    SpouseLastName: "",
    SpouseDOB: "",
    SpousePlaceOfOriginVillage: "",
    SpousePlaceOfOriginDistrict: "",
    SpousePlaceOfOriginProvince: "",
    SpouseAddress1: "",
    SpouseAddress2: "",
    SpouseCity: "",
    SpouseProvince: "",
    SpousePOBox: "",
    SpouseEmail: "",
    SpouseMobile: "",
    SpouseLandline: "",
    WorkerHaveDependants: false,

    EmploymentID: "",
    Occupation: "",
    PlaceOfEmployment: "",
    NatureOfEmployment: "",
    AverageWeeklyWage: 0,
    WeeklyPaymentRate: 0,
    WorkedUnderSubContractor: false,
    SubContractorOrganizationName: "",
    SubContractorLocation: "",
    SubContractorNatureOfBusiness: "",

    IncidentDate: "",
    IncidentLocation: "",
    IncidentProvince: "",
    IncidentRegion: "",
    NatureExtentInjury: "",
    InjuryCause: "",
    HandInjury: false,
    InjuryMachinery: false,
    MachineType: "",
    MachinePartResponsible: "",
    MachinePowerSource: "",
    GradualProcessInjury: false,

    DeathDate: "",
    DeathCause: "",
    DeathLocation: "",
    DeathProvince: "",
    DeathRegion: "",
    DeathRelatedToInjury: false,
    DeathCircumstances: "",

    InsuranceProviderIPACode: "",
    InsuranceCompanyOrganizationName: "",
    InsuranceCompanyAddress1: "",
    InsuranceCompanyAddress2: "",
    InsuranceCompanyCity: "",
    InsuranceCompanyProvince: "",
    InsuranceCompanyPOBox: "",
    InsuranceCompanyLandLine: "",

    ImageName: "",
    PublicUrl: "",
    DC: "",
    PMR: "",
    PIR: "",
    WS: "",
    SEC43: "",
    SS: "",
    DD: "",
    PTA: "",
    FER: "",
    F18: "",
    MEX: "",
    MISC: "",
    DED: "",

    DisplayIRN: "",
    TimeBarred: false,
    FirstSubmissionDate: new Date().toISOString(),
    IncidentType: "Death",
  });

  // ---------------- Load data ----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Reference data
        const { data: provinceData } = await supabase
          .from("dictionary").select("DKey, DValue").eq("DType", "Province");
        if (!cancelled) setProvinces(provinceData || []);

        const { data: providers } = await supabase.from("insurancecompanymaster").select("*");
        if (!cancelled) setInsuranceProviders(providers || []);

        // Worker snapshot
        const { data: worker } = await supabase
          .from("workerpersonaldetails").select("*")
          .eq("WorkerID", workerId).single();

        // Employment snapshot
        const { data: employment } = await supabase
          .from("currentemploymentdetails").select("*")
          .eq("WorkerID", workerId).maybeSingle();

        // Dependants & history
        const { data: depData } = await supabase
          .from("dependantpersonaldetails").select("*")
          .eq("WorkerID", workerId);
        if (!cancelled) setDependants(depData || []);

        const { data: hist } = await supabase
          .from("workhistory").select("*")
          .eq("WorkerID", workerId);
        if (!cancelled) setWorkHistory(hist || []);

        // Load existing Form12 row
        let formRow: any = null;
        if (irn) {
          const { data } = await supabase.from("form1112master").select("*").eq("IRN", irn).maybeSingle();
          formRow = data;
        } else {
          const { data: rows } = await supabase
            .from("form1112master").select("*")
            .eq("WorkerID", workerId)
            .order("IRN", { ascending: false })
            .limit(1);
          formRow = rows?.[0] || null;
        }
        if (!cancelled && formRow?.IRN) setEditingIRN(formRow.IRN);

        // Merge into Form12Data shape
        const baseDefaults: any = {
          WorkerID: workerId,
          WorkerFirstName: "",
          WorkerLastName: "",
          WorkerDOB: "",
          WorkerGender: "",
          WorkerMarried: "",
          WorkerHanded: "Right",
          WorkerPlaceOfOriginVillage: "",
          WorkerPlaceOfOriginDistrict: "",
          WorkerPlaceOfOriginProvince: "",
          WorkerAddress1: "",
          WorkerAddress2: "",
          WorkerCity: "",
          WorkerProvince: "",
          WorkerPOBox: "",
          WorkerEmail: "",
          WorkerMobile: "",
          WorkerLandline: "",
          WorkerPassportPhoto: "",

          SpouseFirstName: "",
          SpouseLastName: "",
          SpouseDOB: "",
          SpousePlaceOfOriginVillage: "",
          SpousePlaceOfOriginDistrict: "",
          SpousePlaceOfOriginProvince: "",
          SpouseAddress1: "",
          SpouseAddress2: "",
          SpouseCity: "",
          SpouseProvince: "",
          SpousePOBox: "",
          SpouseEmail: "",
          SpouseMobile: "",
          SpouseLandline: "",
          WorkerHaveDependants: false,

          EmploymentID: "",
          Occupation: "",
          PlaceOfEmployment: "",
          NatureOfEmployment: "",
          AverageWeeklyWage: 0,
          WeeklyPaymentRate: 0,
          WorkedUnderSubContractor: false,
          SubContractorOrganizationName: "",
          SubContractorLocation: "",
          SubContractorNatureOfBusiness: "",

          IncidentDate: "",
          IncidentLocation: "",
          IncidentProvince: "",
          IncidentRegion: "",
          NatureExtentInjury: "",
          InjuryCause: "",
          HandInjury: false,
          InjuryMachinery: false,
          MachineType: "",
          MachinePartResponsible: "",
          MachinePowerSource: "",
          GradualProcessInjury: false,

          DeathDate: "",
          DeathCause: "",
          DeathLocation: "",
          DeathProvince: "",
          DeathRegion: "",
          DeathRelatedToInjury: false,
          DeathCircumstances: "",

          InsuranceProviderIPACode: "",
          InsuranceCompanyOrganizationName: "",
          InsuranceCompanyAddress1: "",
          InsuranceCompanyAddress2: "",
          InsuranceCompanyCity: "",
          InsuranceCompanyProvince: "",
          InsuranceCompanyPOBox: "",
          InsuranceCompanyLandLine: "",

          ImageName: "",
          PublicUrl: "",
          DC: "",
          PMR: "",
          PIR: "",
          WS: "",
          SEC43: "",
          SS: "",
          DD: "",
          PTA: "",
          FER: "",
          F18: "",
          MEX: "",
          MISC: "",
          DED: "",

          DisplayIRN: "",
          TimeBarred: false,
          FirstSubmissionDate: new Date().toISOString(),
          IncidentType: "Death",
        };

        const merged = { ...baseDefaults, ...(worker || {}), ...(employment || {}), ...(formRow || {}), WorkerHaveDependants: (depData || []).length > 0 };
        const sanitized: any = {};
        for (const k in baseDefaults) sanitized[k] = merged[k] ?? baseDefaults[k];

        // Map Incident* -> Death* for display if Death* are empty
        if (!sanitized.DeathDate) sanitized.DeathDate = toDateInput(merged.IncidentDate);
        else sanitized.DeathDate = toDateInput(sanitized.DeathDate);
        if (!sanitized.DeathLocation) sanitized.DeathLocation = s(merged.IncidentLocation);
        if (!sanitized.DeathProvince) sanitized.DeathProvince = s(merged.IncidentProvince);
        if (!sanitized.DeathRegion) sanitized.DeathRegion = s(merged.IncidentRegion);
        if (!sanitized.DeathCause) sanitized.DeathCause = s(merged.InjuryCause);
        if (!sanitized.DeathCircumstances) sanitized.DeathCircumstances = s(merged.NatureExtentInjury);

        // Normalize some other date-y fields for disabled inputs
        sanitized.WorkerDOB = toDateInput(sanitized.WorkerDOB);
        sanitized.SpouseDOB = toDateInput(sanitized.SpouseDOB);

        // Auto-fill insurance address/phone for selected provider
        const provider = (providers || []).find((p: any) => p.IPACODE === sanitized.InsuranceProviderIPACode);
        if (provider) {
          sanitized.InsuranceCompanyOrganizationName = provider.InsuranceCompanyOrganizationName ?? "";
          sanitized.InsuranceCompanyAddress1 = provider.InsuranceCompanyAddress1 ?? "";
          sanitized.InsuranceCompanyAddress2 = provider.InsuranceCompanyAddress2 ?? "";
          sanitized.InsuranceCompanyCity = provider.InsuranceCompanyCity ?? "";
          sanitized.InsuranceCompanyProvince = provider.InsuranceCompanyProvince ?? "";
          sanitized.InsuranceCompanyPOBox = provider.InsuranceCompanyPOBox ?? "";
          sanitized.InsuranceCompanyLandLine = provider.InsuranceCompanyLandLine ?? "";
        }

        // Attachments: fetch rows and map to fields (e.g., DC, PMR, ...)
        if (formRow?.IRN) {
          const { data: atts } = await supabase
            .from("formattachments")
            .select("AttachmentType, FileName")
            .eq("IRN", formRow.IRN);

          const typeToKey: Record<string, string> = {
            "Death Certificate": "DC",
            "Post Mortem report": "PMR",
            "Police incident report": "PIR",
            "Witness statement": "WS",
            "Section 43 application form": "SEC43",
            "Supervisor statement": "SS",
            "Dependency declaration": "DD",
            "Payslip at time of accident": "PTA",
            "Funeral expenses receipts": "FER",
            "Form 18 Scan": "F18",
            "MedicalExpenses": "MEX",
            "MiscExpenses": "MISC",
            "Deductions": "DED",
          };
          if (atts && atts.length) {
            for (const a of atts) {
              const key = typeToKey[a.AttachmentType];
              if (key) {
                sanitized[key] = a.FileName;
              }
            }
          }
        }

        if (!cancelled) { setFormData(sanitized as Form12Data); setOriginalData(sanitized as Form12Data); }

        // Passport URL resolve
        const rawPath = (worker as any)?.WorkerPassportPhoto || "";
        const path = normalizeStoragePath(rawPath);
        if (path) {
          try {
            const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
            const publicUrl = pub?.publicUrl;
            if (publicUrl) {
              try {
                const head = await fetch(publicUrl, { method: "HEAD" });
                if (head.ok) setPassportUrl(publicUrl);
                else {
                  const { data: signed } = await supabase.storage.from("cpps").createSignedUrl(path, 60 * 60 * 24);
                  if (signed?.signedUrl) setPassportUrl(signed.signedUrl);
                }
              } catch {
                const { data: signed } = await supabase.storage.from("cpps").createSignedUrl(path, 60 * 60 * 24);
                if (signed?.signedUrl) setPassportUrl(signed.signedUrl);
              }
            }
          } catch (e) { console.error("Passport URL resolution failed:", e); }
        }
      } catch (e) {
        console.error("Initial load failed", e);
        if (!cancelled) setError("Failed to load form data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workerId, irn]);

  // Auto Region from Province (Incident/Death)
  useEffect(() => {
    (async () => {
      const key = formData.DeathProvince || formData.IncidentProvince;
      if (!key) {
        setFormData((p) => ({ ...p, IncidentRegion: "", DeathRegion: "" }));
        return;
      }
      try {
        const { data, error } = await supabase
          .from("dictionary").select("DValue")
          .eq("DType", "ProvinceRegion").eq("DKey", key).single();
        if (error) {
          setFormData((p) => ({ ...p, IncidentRegion: "", DeathRegion: "" }));
          return;
        }
        setFormData((p) => ({ ...p, IncidentRegion: data?.DValue || "", DeathRegion: data?.DValue || "" }));
      } catch {
        setFormData((p) => ({ ...p, IncidentRegion: "", DeathRegion: "" }));
      }
    })();
  }, [formData.DeathProvince, formData.IncidentProvince]);

  // Resolve remote preview for main scan (prefer local)
  useEffect(() => {
    if (scanLocalUrl) return;
    (async () => {
      const path = s(formData.ImageName);
      if (path) setScanUrl((await resolveStorageUrl(path)) || "");
      else setScanUrl("");
    })();
  }, [formData.ImageName, scanLocalUrl]);

  // Resolve remote previews for supporting docs (skip those with local preview)
  useEffect(() => {
    (async () => {
      const keys = ["DC","PMR","PIR","WS","SEC43","SS","DD","PTA","FER","F18","MEX","MISC","DED"];
      const updates: Record<string, string> = {};
      for (const key of keys) {
        if (attachmentLocalPreviews[key]) continue;
        const path = s((formData as any)[key]);
        if (!path) continue;
        if (attachmentPreviews[key]) continue;
        const url = await resolveStorageUrl(path);
        if (url) updates[key] = url;
      }
      if (Object.keys(updates).length) setAttachmentPreviews((prev) => ({ ...prev, ...updates }));
    })();
  }, [formData, attachmentLocalPreviews, attachmentPreviews]);

  // Auto-fill insurance address details when provider changes
  useEffect(() => {
    const code = formData.InsuranceProviderIPACode;
    if (!code || !insuranceProviders.length) return;
    const provider = insuranceProviders.find((p: any) => p.IPACODE === code);
    if (!provider) return;
    setFormData((prev) => {
      const next = {
        ...prev,
        InsuranceCompanyOrganizationName: provider.InsuranceCompanyOrganizationName ?? "",
        InsuranceCompanyAddress1: provider.InsuranceCompanyAddress1 ?? "",
        InsuranceCompanyAddress2: provider.InsuranceCompanyAddress2 ?? "",
        InsuranceCompanyCity: provider.InsuranceCompanyCity ?? "",
        InsuranceCompanyProvince: provider.InsuranceCompanyProvince ?? "",
        InsuranceCompanyPOBox: provider.InsuranceCompanyPOBox ?? "",
        InsuranceCompanyLandLine: provider.InsuranceCompanyLandLine ?? "",
      };
      const changed =
        JSON.stringify([
          prev.InsuranceCompanyOrganizationName, prev.InsuranceCompanyAddress1, prev.InsuranceCompanyAddress2,
          prev.InsuranceCompanyCity, prev.InsuranceCompanyProvince, prev.InsuranceCompanyPOBox, prev.InsuranceCompanyLandLine,
        ]) !== JSON.stringify([
          next.InsuranceCompanyOrganizationName, next.InsuranceCompanyAddress1, next.InsuranceCompanyAddress2,
          next.InsuranceCompanyCity, next.InsuranceCompanyProvince, next.InsuranceCompanyPOBox, next.InsuranceCompanyLandLine,
        ]);
      return changed ? next : prev;
    });
  }, [formData.InsuranceProviderIPACode, insuranceProviders]);

  // ---------------- Handlers ----------------
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    if (["InjuryMachinery","HandInjury","GradualProcessInjury","DeathRelatedToInjury","WorkedUnderSubContractor"].includes(name)) {
      setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value === "true" } as any));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];

    // Clear previous local preview for this field
    if (fieldName === "ImageName" && scanLocalUrl) {
      try { URL.revokeObjectURL(scanLocalUrl); } catch {}
      setScanLocalUrl("");
    }
    if (attachmentLocalPreviews[fieldName]) {
      try { URL.revokeObjectURL(attachmentLocalPreviews[fieldName]); } catch {}
      setAttachmentLocalPreviews((prev) => { const x = { ...prev }; delete x[fieldName]; return x; });
    }

    if (!file) {
      setSelectedFiles((prev) => { const x = { ...prev }; delete x[fieldName]; return x; });
      setGeneratedFileNames((prev) => { const x = { ...prev }; delete x[fieldName]; return x; });
      setFormData((prev) => ({ ...prev, [fieldName]: "" } as any));
      return;
    }

    // Generate timestamped filename (same as NewForm12)
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const datePrefix = `${dd}${mm}${yyyy}`;
    const timeStamp = `${hh}${mi}${ss}`;

    const lastDot = file.name.lastIndexOf(".");
    const baseName = lastDot !== -1 ? file.name.slice(0, lastDot) : file.name;
    const ext = (lastDot !== -1 ? file.name.slice(lastDot + 1) : "dat").toLowerCase();
    const safeBase = baseName.replace(/[^\w.-]+/g, "_");
    const newName = `${datePrefix}_${timeStamp}_${safeBase}.${ext}`;

    const folderMapping: Record<string, string> = {
      DC: "attachments/formattachments/Deathcertificate/",
      PMR: "attachments/formattachments/Postmortemreport/",
      PIR: "attachments/formattachments/Policeincidentreport/",
      WS: "attachments/formattachments/Witnessstatement/",
      SEC43: "attachments/formattachments/SEC43/",
      SS: "attachments/formattachments/Supervisorstatement/",
      DD: "attachments/formattachments/Dependencedeclaration/",
      PTA: "attachments/formattachments/Payslipattimeofaccident/",
      FER: "attachments/formattachments/Funeralexpensereceipts/",
      F18: "attachments/formattachments/Form18scan/",
      MEX: "attachments/formattachments/MedicalExpenses/",
      MISC: "attachments/formattachments/MiscExpenses/",
      DED: "attachments/formattachments/Deductions/",
      ImageName: "attachments/form12scan/",
    };
    const folderPath = folderMapping[fieldName] || "attachments/form12scan/";
    const filePath = `${folderPath}${newName}`;

    setSelectedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setGeneratedFileNames((prev) => ({ ...prev, [fieldName]: newName }));
    setFormData((prev) => ({ ...prev, [fieldName]: filePath } as any));

    // Local preview behavior (exact approach: local preferred)
    const looksImage = file.type.startsWith("image/") || isImagePath(file.name);
    if (looksImage) {
      const blobUrl = URL.createObjectURL(file);
      if (fieldName === "ImageName") setScanLocalUrl(blobUrl);
      else setAttachmentLocalPreviews((prev) => ({ ...prev, [fieldName]: blobUrl }));
    }
  };

  // ---------------- Summary (EditForm11 style) ----------------
  const FIELD_LABELS: Record<string, string> = {
    DeathDate: "Date of Death",
    DeathCause: "Cause of Death",
    DeathLocation: "Death Location",
    DeathProvince: "Death Province",
    DeathRegion: "Region",
    DeathRelatedToInjury: "Death related to Injury",
    DeathCircumstances: "Death Circumstances",
    InsuranceProviderIPACode: "Insurance Provider",
    ImageName: "Form 12 Scan",
  };

  const toYesNo = (v?: any) => (!!v ? "Yes" : "No");
  const displayProvider = (code?: string) => {
    const name = insuranceProviders.find((p: any) => p.IPACODE === code)?.InsuranceCompanyOrganizationName;
    return name || (code || "");
  };
  const displayValue = (k: keyof Form12Data, v: any) => {
    switch (k) {
      case "DeathRelatedToInjury": return toYesNo(v);
      case "InsuranceProviderIPACode": return displayProvider(v);
      case "DeathDate": return toDateInput(v);
      default: return v ?? "";
    }
  };
  const compareForDiff = (k: keyof Form12Data, a: any, b: any) => {
    if (k === "DeathRelatedToInjury") return (!!a) !== (!!b);
    if (k === "DeathDate") return toDateInput(a) !== toDateInput(b);
    return (a ?? "") !== (b ?? "");
  };
  const computeChanges = (before: Form12Data, after: Form12Data): ChangeRow[] => {
    const keys: (keyof Form12Data)[] = [
      "DeathDate","DeathCause","DeathLocation","DeathProvince","DeathRegion","DeathRelatedToInjury","DeathCircumstances","InsuranceProviderIPACode"
    ];
    const rows: ChangeRow[] = [];
    for (const k of keys) {
      if (compareForDiff(k, (before as any)[k], (after as any)[k])) {
        rows.push({ field: FIELD_LABELS[k] || (k as string), from: displayValue(k, (before as any)[k]), to: displayValue(k, (after as any)[k]) });
      }
    }
    if (selectedFiles["ImageName"]) rows.push({ field: FIELD_LABELS.ImageName, from: s(before.ImageName), to: s(after.ImageName) });
    Object.keys(selectedFiles).filter((k) => k !== "ImageName").forEach((k) => rows.push({ field: `New Attachment: ${k}`, from: "", to: s((after as any)[k]) }));
    return rows;
  };

  const handleOpenSummary = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const required: (keyof Form12Data)[] = ["DeathDate","DeathCause","DeathLocation","DeathProvince","InsuranceProviderIPACode"];
    const labels: Record<string, string> = {
      DeathDate: "Date of Death",
      DeathCause: "Cause of Death",
      DeathLocation: "Death Location",
      DeathProvince: "Death Province",
      InsuranceProviderIPACode: "Insurance Provider",
    };
    const missing = required.filter((k) => !s((formData as any)[k]));
    if (missing.length) {
      setError(`Please fill in all required fields: ${missing.map((m) => labels[m] || m).join(", ")}`);
      return;
    }
    const base = originalData || formData;
    const rows = computeChanges(base, formData);
    if (!rows.length) {
      setError("No changes detected.");
      return;
    }
    setChanges(rows);
    setShowSummary(true);
  };

  // ---------------- Submit (UPDATE existing IRN) ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!editingIRN) throw new Error("No Form 12 record found to update.");

      // 1) Upload newly selected files
      const uploadedPaths: Record<string, string> = {};
      for (const [fieldName, file] of Object.entries(selectedFiles)) {
        const gen = generatedFileNames[fieldName];
        if (!file || !gen) continue;
        const folderMapping: Record<string, string> = {
          DC: "attachments/formattachments/Deathcertificate/",
          PMR: "attachments/formattachments/Postmortemreport/",
          PIR: "attachments/formattachments/Policeincidentreport/",
          WS: "attachments/formattachments/Witnessstatement/",
          SEC43: "attachments/formattachments/SEC43/",
          SS: "attachments/formattachments/Supervisorstatement/",
          DD: "attachments/formattachments/Dependencedeclaration/",
          PTA: "attachments/formattachments/Payslipattimeofaccident/",
          FER: "attachments/formattachments/Funeralexpensereceipts/",
          F18: "attachments/formattachments/Form18scan/",
          MEX: "attachments/formattachments/MedicalExpenses/",
          MISC: "attachments/formattachments/MiscExpenses/",
          DED: "attachments/formattachments/Deductions/",
          ImageName: "attachments/form12scan/",
        };
        const folder = folderMapping[fieldName] || "attachments/form12scan/";
        const fullPath = `${folder}${gen}`;
        const { error: upErr } = await supabase.storage.from("cpps").upload(fullPath, file as any);
        if (upErr) throw new Error(`Failed to upload ${fieldName}: ${upErr.message}`);
        uploadedPaths[fieldName] = fullPath;
      }

      // 2) recompute time bar (based on DeathDate)
      const deathDate = new Date(formData.DeathDate);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - (deathDate as any).getTime()) / (1000 * 60 * 60 * 24));
      const isTimeBarred = daysDiff > 365;

      // 3) Build update payload mapping Death* => Incident*
      const updatePayload: any = {
        WorkerID: formData.WorkerID,
        IncidentDate: formData.DeathDate || formData.IncidentDate,
        IncidentLocation: formData.DeathLocation || formData.IncidentLocation,
        IncidentProvince: formData.DeathProvince || formData.IncidentProvince,
        IncidentRegion: formData.DeathRegion || formData.IncidentRegion,
        NatureExtentInjury: formData.DeathCircumstances || formData.NatureExtentInjury,
        InjuryCause: formData.DeathCause || formData.InjuryCause,
        InjuryMachinery: formData.InjuryMachinery ? 1 : 0,
        MachineType: formData.MachineType,
        MachinePartResponsible: formData.MachinePartResponsible,
        MachinePowerSource: formData.MachinePowerSource,
        GradualProcessInjury: formData.GradualProcessInjury ? 1 : 0,
        IncidentType: "Death",
        TimeBarred: isTimeBarred ? "Yes" : "No",
        HandInjury: formData.HandInjury ? 1 : 0,
        InsuranceProviderIPACode: formData.InsuranceProviderIPACode,
      };

      if (uploadedPaths.ImageName) {
        updatePayload.ImageName = uploadedPaths.ImageName;
        updatePayload.PublicUrl = uploadedPaths.ImageName;
      }

      // 4) UPDATE master
      const { error: updErr } = await supabase
        .from("form1112master")
        .update(updatePayload)
        .eq("IRN", editingIRN);
      if (updErr) throw updErr;

      // 5) Insert new attachment rows for supporting docs newly uploaded
      const attachmentMap: Record<string, string> = {
        DC: "Death Certificate",
        PMR: "Post Mortem report",
        PIR: "Police incident report",
        WS: "Witness statement",
        SEC43: "Section 43 application form",
        SS: "Supervisor statement",
        DD: "Dependency declaration",
        PTA: "Payslip at time of accident",
        FER: "Funeral expenses receipts",
        F18: "Form 18 Scan",
        MEX: "MedicalExpenses",
        MISC: "MiscExpenses",
        DED: "Deductions",
      };
      for (const k of Object.keys(attachmentMap)) {
        const path = uploadedPaths[k];
        if (!path) continue;
        const { error: aErr } = await supabase.from("formattachments").insert([
          { IRN: editingIRN, AttachmentType: attachmentMap[k], FileName: path },
        ]);
        if (aErr) throw aErr;
      }

      setSuccess("Form 12 updated successfully.");
      setShowSummary(false);
      onClose();
    } catch (e: any) {
      console.error("Update failed", e);
      setError(e?.message || "Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  const confirmSave = () => {
    setShowSummary(false);
    try {
      formRef.current?.requestSubmit();
    } catch {
      handleSubmit(new Event("submit") as unknown as React.FormEvent);
    }
  };

  // ---------------- Tabs ----------------
  const tabs = ["Worker Personal Details",
                "Employment Details",
                "Death Details",
                "Details of Dependants",
                "Other Employment Details",
                "Insurance Details",
                "Form12 Scan",
                "Supporting Documents",];

  const renderWorkerPersonalDetails = () => (
    <div className="space-y-4">
      {/* Worker ID + Passport photo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker ID</label>
          <input type="text" name="WorkerID" value={formData.WorkerID} onChange={handleInputChange} className="input" readOnly />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Passport Photo</label>
          {passportUrl ? (
            <img
              src={passportUrl}
              alt="Worker passport photo"
              className="w-84 h-42 rounded object-cover border cursor-zoom-in"
              onClick={() => setIsPhotoOpen(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-84 h-42 rounded border grid place-content-center text-xs text-gray-500">No photo</div>
          )}
          {isPhotoOpen && passportUrl && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setIsPhotoOpen(false)}>
              <img src={passportUrl} alt="Worker passport photo enlarged" className="max-h-[85vh] max-w-[90vw] rounded shadow-xl" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input type="text" name="WorkerFirstName" value={formData.WorkerFirstName} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input type="text" name="WorkerLastName" value={formData.WorkerLastName} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input type="date" name="WorkerDOB" value={formData.WorkerDOB} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <select name="WorkerGender" value={formData.WorkerGender} onChange={handleInputChange} className="input" disabled>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <select name="WorkerMarried" value={formData.WorkerMarried} onChange={handleInputChange} className="input" disabled>
            <option value="1">Married</option>
            <option value="0">Single</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Dominant Hand</label>
          <select name="WorkerHanded" value={formData.WorkerHanded} onChange={handleInputChange} className="input" disabled>
            <option value="Right">Right</option>
            <option value="Left">Left</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <textarea name="WorkerAddress1" value={formData.WorkerAddress1} onChange={handleInputChange} className="input" rows={3} disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea name="WorkerAddress2" value={formData.WorkerAddress2} onChange={handleInputChange} className="input" rows={3} disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" name="WorkerCity" value={formData.WorkerCity} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input type="text" name="WorkerProvince" value={formData.WorkerProvince} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input type="text" name="WorkerPOBox" value={formData.WorkerPOBox} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" name="WorkerEmail" value={formData.WorkerEmail} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input type="tel" name="WorkerMobile" value={formData.WorkerMobile} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input type="tel" name="WorkerLandline" value={formData.WorkerLandline} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employment ID</label>
          <input type="text" name="EmploymentID" value={formData.EmploymentID} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation</label>
          <input type="text" name="Occupation" value={formData.Occupation} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Place of Employment</label>
        <input type="text" name="PlaceOfEmployment" value={formData.PlaceOfEmployment} onChange={handleInputChange} className="input" disabled />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
        <input type="text" name="NatureOfEmployment" value={formData.NatureOfEmployment} onChange={handleInputChange} className="input" disabled />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
          <input type="number" name="AverageWeeklyWage" value={formData.AverageWeeklyWage} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weekly Payment Rate</label>
          <input type="number" name="WeeklyPaymentRate" value={formData.WeeklyPaymentRate} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center">
          <input type="checkbox" name="WorkedUnderSubContractor" checked={formData.WorkedUnderSubContractor} onChange={handleInputChange} className="h-4 w-4 text-primary border-gray-300 rounded" />
          <label className="ml-2 block text-sm text-gray-900">Worked Under Sub-Contractor</label>
        </div>

        {formData.WorkedUnderSubContractor && (
          <div className="space-y-4 pl-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Organization Name</label>
              <input type="text" name="SubContractorOrganizationName" value={formData.SubContractorOrganizationName} onChange={handleInputChange} className="input" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Location</label>
              <input type="text" name="SubContractorLocation" value={formData.SubContractorLocation} onChange={handleInputChange} className="input" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nature of Business</label>
              <input type="text" name="SubContractorNatureOfBusiness" value={formData.SubContractorNatureOfBusiness} onChange={handleInputChange} className="input" />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDeathDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Death</label>
          <input type="date" name="DeathDate" value={formData.DeathDate} onChange={handleInputChange} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Cause of Death</label>
          <input type="text" name="DeathCause" value={formData.DeathCause} onChange={handleInputChange} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Related to Machinery?</label>
          <select
            name="InjuryMachinery"
            value={String(!!formData.InjuryMachinery)}
            onChange={(e) => setFormData((p) => ({ ...p, InjuryMachinery: e.target.value === "true" }))}
            className="input"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Death Location</label>
          <input type="text" name="DeathLocation" value={formData.DeathLocation} onChange={handleInputChange} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Death Province</label>
          <select
            name="DeathProvince"
            value={formData.DeathProvince}
            onChange={(e) => {
              const v = e.target.value;
              setFormData((p) => ({ ...p, DeathProvince: v, IncidentProvince: v }));
            }}
            className="input"
            required
          >
            <option value="">Select Province</option>
            {provinces.map((province) => (
              <option key={province.DValue} value={province.DValue}>
                {province.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Death Region</label>
          <input
            type="text"
            name="DeathRegion"
            value={formData.DeathRegion}
            onChange={(e) => {
              const v = e.target.value;
              setFormData((p) => ({ ...p, DeathRegion: v, IncidentRegion: v }));
            }}
            className="input"
            readOnly
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Circumstances</label>
        <textarea
          name="DeathCircumstances"
          value={formData.DeathCircumstances}
          onChange={(e) => {
            const v = e.target.value;
            setFormData((p) => ({ ...p, DeathCircumstances: v, NatureExtentInjury: v }));
          }}
          className="input"
          rows={4}
          required
        />
      </div>

      {formData.InjuryMachinery && (
        <div className="space-y-4 border-l-4 border-primary pl-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Type</label>
            <input type="text" name="MachineType" value={formData.MachineType} onChange={handleInputChange} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Part Responsible</label>
            <input type="text" name="MachinePartResponsible" value={formData.MachinePartResponsible} onChange={handleInputChange} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Power Source</label>
            <input type="text" name="MachinePowerSource" value={formData.MachinePowerSource} onChange={handleInputChange} className="input" />
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
          <input type="text" name="SpouseFirstName" value={s(formData.SpouseFirstName)} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Last Name</label>
          <input type="text" name="SpouseLastName" value={s(formData.SpouseLastName)} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Date of Birth</label>
          <input type="date" name="SpouseDOB" value={toDateInput(s(formData.SpouseDOB))} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address Line 1</label>
          <textarea name="SpouseAddress1" value={s(formData.SpouseAddress1)} onChange={handleInputChange} className="input" rows={3} disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address Line 2</label>
          <textarea name="SpouseAddress2" value={s(formData.SpouseAddress2)} onChange={handleInputChange} className="input" rows={3} disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" name="SpouseCity" value={s(formData.SpouseCity)} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input type="text" name="SpouseProvince" value={s(formData.SpouseProvince)} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input type="text" name="SpousePOBox" value={s(formData.SpousePOBox)} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" name="SpouseEmail" value={s(formData.SpouseEmail)} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input type="tel" name="SpouseMobile" value={s(formData.SpouseMobile)} onChange={handleInputChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input type="tel" name="SpouseLandline" value={s(formData.SpouseLandline)} onChange={handleInputChange} className="input" disabled />
        </div>
      </div>

      <div className="flex items-center">
        <input type="checkbox" name="WorkerHaveDependants" checked={b(formData.WorkerHaveDependants)} onChange={handleInputChange} className="h-4 w-4 text-primary border-gray-300 rounded" disabled />
        <label className="ml-2 block text-sm text-gray-900">Worker has other dependants</label>
      </div>

      {formData.WorkerHaveDependants && dependants.length > 0 && (
        <div className="space-y-4">
          {dependants.map((dependant, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {dependant.DependantFirstName} {dependant.DependantLastName}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Relationship</label>
                  <p className="mt-1 text-sm text-gray-900">{dependant.DependantType}</p>
                </div>
                <div>
                  <label className="block text sm font-medium text-gray-700">Date of Birth</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(dependant.DependantDOB).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWorkHistory = () => (
    <div className="space-y-4">
      <div className="flex items-center mb-4">
        <input type="checkbox" name="GradualProcessInjury" checked={b(formData.GradualProcessInjury)} onChange={handleInputChange} className="h-4 w-4 text-primary border-gray-300 rounded" />
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
                    {new Date(history.WorkerJoiningDate).toLocaleDateString()} -{" "}
                    {history.WorkerLeavingDate ? new Date(history.WorkerLeavingDate).toLocaleDateString() : "Present"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <p className="mt-1 text-sm text-gray-900">
                  {history.OrganizationAddress1}
                  {history.OrganizationAddress2 ? `, ${history.OrganizationAddress2}` : ""}
                  {history.OrganizationCity ? `, ${history.OrganizationCity}` : ""}
                  {history.OrganizationProvince ? `, ${history.OrganizationProvince}` : ""}
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
        <select name="InsuranceProviderIPACode" value={formData.InsuranceProviderIPACode} onChange={handleInputChange} className="input" required>
          <option value="">Select Insurance Provider</option>
          {insuranceProviders.map((provider) => (
            <option key={provider.IPACODE} value={provider.IPACODE}>
              {provider.InsuranceCompanyOrganizationName}
            </option>
          ))}
        </select>
      </div>

      {formData.InsuranceProviderIPACode && (
        <>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
              <textarea name="InsuranceCompanyAddress1" value={formData.InsuranceCompanyAddress1} onChange={handleInputChange} className="input" rows={3} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
              <textarea name="InsuranceCompanyAddress2" value={formData.InsuranceCompanyAddress2} onChange={handleInputChange} className="input" rows={3} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input type="text" name="InsuranceCompanyCity" value={formData.InsuranceCompanyCity} onChange={handleInputChange} className="input" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <input type="text" name="InsuranceCompanyProvince" value={formData.InsuranceCompanyProvince} onChange={handleInputChange} className="input" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
              <input type="text" name="InsuranceCompanyPOBox" value={formData.InsuranceCompanyPOBox} onChange={handleInputChange} className="input" readOnly />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Landline</label>
            <input type="text" name="InsuranceCompanyLandLine" value={formData.InsuranceCompanyLandLine} onChange={handleInputChange} className="input" readOnly />
          </div>
        </>
      )}
    </div>
  );

  const renderForm12Scan = () => {
    const path = formData.ImageName;
    const hasImagePreview = isImagePath(path) && (scanLocalUrl || scanUrl);

    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Form 12 Scanned File</label>
          <input
            type="file"
            name="ImageName"
            onChange={(e) => handleFileChange(e, "ImageName")}
            className="input"
            accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
          />
          {path && (
            <p className="text-xs text-gray-600 mt-1">
              Storage path: <span className="font-mono break-all">{path}</span>
            </p>
          )}
        </div>

        {/* Preview area */}
        {hasImagePreview ? (
          <>
            <div className="mt-2">
              <img
                src={scanLocalUrl || scanUrl}
                alt="Form 12 scan preview"
                className="w-40 h-40 rounded object-cover border cursor-zoom-in"
                onClick={() => setIsScanOpen(true)}
                loading="lazy"
              />
            </div>

            {isScanOpen && (
              <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setIsScanOpen(false)}>
                <img src={scanLocalUrl || scanUrl} alt="Form 12 scan enlarged" className="max-h-[85vh] max-w-[90vw] rounded shadow-xl" />
              </div>
            )}
          </>
        ) : (
          // Non-image (e.g., PDF): show open link when we resolved a URL
          scanUrl && (
            <a href={scanUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
              Open current scan
            </a>
          )
        )}
      </div>
    );
  }

    const renderAttachments = () => (
    <div className="space-y-4">
      {/* Keep Form12 (Death) specific list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "DC", label: "Death Certificate" },
          { key: "PMR", label: "Post Mortem Report" },
          { key: "PIR", label: "Police Incident Report" },
          { key: "WS", label: "Witness Statement" },
          { key: "SEC43", label: "Section 43" },
          { key: "SS", label: "Supervisor Statement" },
          { key: "DD", label: "Dependency Declaration" },
          { key: "PTA", label: "Payslip at time of accident" },
          { key: "FER", label: "Funeral Expense Receipts" },
          { key: "F18", label: "Form 18 Scan" },
          { key: "MEX", label: "Medical Expenses" },
          { key: "MISC", label: "Misc Expenses" },
          { key: "DED", label: "Deductions" },
        ].map(({ key, label }) => {
          const pathVal = String((formData as any)[key] || "");
          const previewUrl = (attachmentLocalPreviews as any)[key] || (attachmentPreviews as any)[key];
          const hasPreview = !!previewUrl;

          return (
            <div key={key} className="space-y-2">
              {/* Label first */}
              <label className="block text-sm font-medium text-gray-700">{label}</label>

              {/* Preview second */}
              {hasPreview ? (
                isImagePath(pathVal) ? (
                  <img
                    src={previewUrl}
                    alt={`${label} preview`}
                    className="w-28 h-28 object-cover rounded border"
                    loading="lazy"
                  />
                ) : (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    Open current file
                  </a>
                )
              ) : pathVal ? (
                <p className="text-xs text-gray-500 break-all font-mono">
                  {pathVal}
                </p>
              ) : null}

              {/* File input third */}
              <input
                type="file"
                onChange={(e) => handleFileChange(e as any, key)}
                className="input"
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
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
      case 3: return renderDeathDetails();
      case 4: return renderDependantDetails();
      case 5: return renderWorkHistory();
      case 6: return renderInsuranceDetails();
      case 7: return renderForm12Scan();
      case 8: return renderAttachments();
      default: return null;
    }
  };

  // ---------------- JSX ----------------
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Edit Form 12 — Death</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-6">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-700 rounded">{success}</div>}

            {/* tabs (inline like NewForm12) */}
            <div className="flex gap-2 text-sm overflow-x-auto">
              {tabs.map((label, idx) => (
                <button
                  type="button"
                  key={label}
                  className={`px-3 py-1.5 rounded border ${currentTab === idx + 1 ? "bg-gray-900 text-white" : "bg-white"}`}
                  onClick={() => setCurrentTab(idx + 1)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>{renderTabContent()}</div>

            {/* Actions */}
            <div className="pt-4 flex items-center gap-2">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleOpenSummary} className="btn btn-primary" disabled={loading}>
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Summary modal (exact style copied from EditForm11) */}
      {showSummary && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSummary(false)}></div>

          {/* Card */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold">Review changes</h3>
              <button type="button" className="p-2 hover:bg-gray-100 rounded" onClick={() => setShowSummary(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              {changes.length === 0 ? (
                <p className="text-gray-500">No changes detected.</p>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 font-medium text-gray-700">Field</th>
                        <th className="px-3 py-2 font-medium text-gray-700">From</th>
                        <th className="px-3 py-2 font-medium text-gray-700">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((r, idx) => (
                        <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-3 py-2 whitespace-nowrap">{r.field}</td>
                          <td className="px-3 py-2 break-all font-mono text-gray-700">{r.from || '—'}</td>
                          <td className="px-3 py-2 break-all font-mono text-gray-900">{r.to || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-2 flex justify-end gap-2">
              <button type="button" className="px-3 py-1.5 rounded border" onClick={() => setShowSummary(false)}>Back to edit</button>
              <button type="button" className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={confirmSave} disabled={loading}>
                {loading ? "Saving…" : "Apply save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditForm12;
