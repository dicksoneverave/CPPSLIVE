// src/components/forms/ViewForm12.tsx
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
    const { data: signed } = await supabase
      .storage
      .from("cpps")
      .createSignedUrl(path, 60 * 60 * 24);
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
export interface ViewForm12Props {
  workerId: string;
  irn?: number | string | null; // which IRN to view (fallback to latest for worker)
  onClose: () => void;
  embedded?: boolean; // when true, render full-width without modal chrome
}

interface Form12Data {
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

			// add near other system/incident fields
ReceivedDate: string;  // <- NEW (from form1112master)
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

  DeathDate: string;
  DeathCause: string;
  DeathLocation: string;
  DeathProvince: string;
  DeathRegion: string;
  DeathRelatedToInjury: boolean;
  DeathCircumstances: string;

  InsuranceProviderIPACode: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;

  ImageName: string;
  PublicUrl: string;
  DC?: string;
  PMR?: string;
  PIR?: string;
  WS?: string;
  SEC43?: string;
  SS?: string;
  DD?: string;
  PTA?: string;
  FER?: string;
  F18?: string;
  MEX?: string;
  MISC?: string;
  DED?: string;

  DisplayIRN: string;
  TimeBarred: boolean | string;
  FirstSubmissionDate: string;
  IncidentType: string;
}

// ==============================
// Component
// ==============================
const ViewForm12: React.FC<ViewForm12Props> = ({ workerId, irn, onClose, embedded = false }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [provinces, setProvinces] = useState<any[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);

  // Passport
  const [passportUrl, setPassportUrl] = useState("");
  // Main scan
  const [scanUrl, setScanUrl] = useState("");
// Unified preview (image/PDF)
const isPreviewable = (u?: string) => /\.(png|jpe?g|gif|webp|pdf)$/i.test(u || "");
const isImageUrl    = (u?: string) => /\.(png|jpe?g|gif|webp)$/i.test(u || "");
const isPdfUrl      = (u?: string) => /\.pdf$/i.test(u || "");

const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const openPreview  = (url?: string | null) => url ? setPreviewUrl(url) : null;
const closePreview = () => setPreviewUrl(null);


  // Supporting docs previews
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});

  // Viewing IRN
  const [viewIRN, setViewIRN] = useState<number | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

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
          .from("dictionary")
          .select("DKey, DValue")
          .eq("DType", "Province");
        if (!cancelled) setProvinces(provinceData || []);

        const { data: providers } = await supabase
          .from("insurancecompanymaster")
          .select("*");
        if (!cancelled) setInsuranceProviders(providers || []);

        // Worker snapshot
        const { data: worker } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", workerId)
          .single();

        // Employment snapshot
        const { data: employment } = await supabase
          .from("currentemploymentdetails")
          .select("*")
          .eq("WorkerID", workerId)
          .maybeSingle();

        // Dependants & history
        const { data: depData } = await supabase
          .from("dependantpersonaldetails")
          .select("*")
          .eq("WorkerID", workerId);
        if (!cancelled) setDependants(depData || []);

        const { data: hist } = await supabase
          .from("workhistory")
          .select("*")
          .eq("WorkerID", workerId);
        if (!cancelled) setWorkHistory(hist || []);

        // Load existing Form12 row
        let formRow: any = null;
        if (irn) {
          const { data } = await supabase
            .from("form1112master")
            .select("*")
            .eq("IRN", irn)
            .maybeSingle();
          formRow = data;
        } else {
          const { data: rows } = await supabase
            .from("form1112master")
            .select("*")
            .eq("WorkerID", workerId)
            .order("IRN", { ascending: false })
            .limit(1);
          formRow = rows?.[0] || null;
        }
        if (!cancelled && formRow?.IRN) setViewIRN(formRow.IRN);

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

					ReceivedDate: "",

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

        const merged = {
          ...baseDefaults,
          ...(worker || {}),
          ...(employment || {}),
          ...(formRow || {}),
          WorkerHaveDependants: (depData || []).length > 0,
        };
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

        // Normalize some other date-y fields
        sanitized.WorkerDOB = toDateInput(sanitized.WorkerDOB);
        sanitized.SpouseDOB = toDateInput(sanitized.SpouseDOB);

        // Auto-fill insurance details (display only)
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

        // Attachments: fetch rows and map to fields
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
            "Payslip at the time of accident": "PTA",
            "Funeral expenses receipts": "FER",
            "Form 18 Scan": "F18",
            "MedicalExpenses": "MEX",
            "MiscExpenses": "MISC",
            "Deductions": "DED",
          };
          if (atts && atts.length) {
            for (const a of atts) {
              const key = typeToKey[a.AttachmentType];
              if (key) (sanitized as any)[key] = a.FileName;
            }
          }
        }

        if (!cancelled) setFormData(sanitized as Form12Data);

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
                  const { data: signed } = await supabase
                    .storage
                    .from("cpps")
                    .createSignedUrl(path, 60 * 60 * 24);
                  if (signed?.signedUrl) setPassportUrl(signed.signedUrl);
                }
              } catch {
                const { data: signed } = await supabase
                  .storage
                  .from("cpps")
                  .createSignedUrl(path, 60 * 60 * 24);
                if (signed?.signedUrl) setPassportUrl(signed.signedUrl);
              }
            }
          } catch (e) {
            console.error("Passport URL resolution failed:", e);
          }
        }
      } catch (e) {
        console.error("Initial load failed", e);
        if (!cancelled) setError("Failed to load form data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
          .from("dictionary")
          .select("DValue")
          .eq("DType", "ProvinceRegion")
          .eq("DKey", key)
          .single();
        if (error) {
          setFormData((p) => ({ ...p, IncidentRegion: "", DeathRegion: "" }));
          return;
        }
        setFormData((p) => ({
          ...p,
          IncidentRegion: data?.DValue || "",
          DeathRegion: data?.DValue || "",
        }));
      } catch {
        setFormData((p) => ({ ...p, IncidentRegion: "", DeathRegion: "" }));
      }
    })();
  }, [formData.DeathProvince, formData.IncidentProvince]);

  // Resolve remote preview for main scan
  useEffect(() => {
    (async () => {
      const path = s(formData.ImageName);
      if (path) setScanUrl((await resolveStorageUrl(path)) || "");
      else setScanUrl("");
    })();
  }, [formData.ImageName]);

  // Resolve remote previews for supporting docs
  useEffect(() => {
    (async () => {
      const keys = ["DC","PMR","PIR","WS","SEC43","SS","DD","PTA","FER","F18","MEX","MISC","DED"];
      const updates: Record<string, string> = {};
      for (const key of keys) {
        const path = s((formData as any)[key]);
        if (!path || attachmentPreviews[key]) continue;
        const url = await resolveStorageUrl(path);
        if (url) updates[key] = url;
      }
      if (Object.keys(updates).length) setAttachmentPreviews((prev) => ({ ...prev, ...updates }));
    })();
  }, [formData, attachmentPreviews]);

  // ---------------- Non-edit handlers (no-ops just to satisfy controlled inputs) ----------------
  const noopChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> = () => {};

  // ---------------- Tabs ----------------
  const tabs = [
    "Worker Personal Details",
    "Employment Details",
    "Death Details",
    "Details of Dependants",
    "Other Employment Details",
    "Insurance Details",
    "Form12 Scan",
    "Supporting Documents",
  ];

  const renderWorkerPersonalDetails = () => (
    <div className="space-y-4">
      {/* Worker ID + Passport photo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker ID</label>
          <input type="text" name="WorkerID" value={formData.WorkerID} onChange={noopChange} className="input" readOnly />
        </div>
        <div className="md:col-span-2">
<label className="block text-sm font-medium text-gray-700">Passport Photo</label>
{passportUrl ? (
  <img
    src={passportUrl}
    alt="Worker passport photo"
    className="w-84 h-42 rounded object-cover border cursor-zoom-in"
    onClick={() => openPreview(passportUrl)}
    loading="lazy"
  />
) : (
  <div className="w-84 h-42 rounded border grid place-content-center text-xs text-gray-500">
    No photo
  </div>
)}


        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input type="text" name="WorkerFirstName" value={formData.WorkerFirstName} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input type="text" name="WorkerLastName" value={formData.WorkerLastName} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input type="date" name="WorkerDOB" value={formData.WorkerDOB} onChange={noopChange} className="input" disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <select name="WorkerGender" value={formData.WorkerGender} onChange={noopChange} className="input" disabled>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <select name="WorkerMarried" value={formData.WorkerMarried} onChange={noopChange} className="input" disabled>
            <option value="1">Married</option>
            <option value="0">Single</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Dominant Hand</label>
          <select name="WorkerHanded" value={formData.WorkerHanded} onChange={noopChange} className="input" disabled>
            <option value="Right">Right</option>
            <option value="Left">Left</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <textarea name="WorkerAddress1" value={formData.WorkerAddress1} onChange={noopChange} className="input" rows={3} disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea name="WorkerAddress2" value={formData.WorkerAddress2} onChange={noopChange} className="input" rows={3} disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" name="WorkerCity" value={formData.WorkerCity} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input type="text" name="WorkerProvince" value={formData.WorkerProvince} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input type="text" name="WorkerPOBox" value={formData.WorkerPOBox} onChange={noopChange} className="input" disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" name="WorkerEmail" value={formData.WorkerEmail} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input type="tel" name="WorkerMobile" value={formData.WorkerMobile} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input type="tel" name="WorkerLandline" value={formData.WorkerLandline} onChange={noopChange} className="input" disabled />
        </div>
      </div>
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employment ID</label>
          <input type="text" name="EmploymentID" value={formData.EmploymentID} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation</label>
          <input type="text" name="Occupation" value={formData.Occupation} onChange={noopChange} className="input" disabled />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Place of Employment</label>
        <input type="text" name="PlaceOfEmployment" value={formData.PlaceOfEmployment} onChange={noopChange} className="input" disabled />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
        <input type="text" name="NatureOfEmployment" value={formData.NatureOfEmployment} onChange={noopChange} className="input" disabled />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
          <input type="number" name="AverageWeeklyWage" value={formData.AverageWeeklyWage} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weekly Payment Rate</label>
          <input type="number" name="WeeklyPaymentRate" value={formData.WeeklyPaymentRate} onChange={noopChange} className="input" disabled />
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center">
          <input type="checkbox" name="WorkedUnderSubContractor" checked={formData.WorkedUnderSubContractor} onChange={noopChange} className="h-4 w-4 text-primary border-gray-300 rounded" disabled />
          <label className="ml-2 block text-sm text-gray-900">Worked Under Sub-Contractor</label>
        </div>

        {formData.WorkedUnderSubContractor && (
          <div className="space-y-4 pl-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Organization Name</label>
              <input type="text" name="SubContractorOrganizationName" value={formData.SubContractorOrganizationName} onChange={noopChange} className="input" disabled />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Location</label>
              <input type="text" name="SubContractorLocation" value={formData.SubContractorLocation} onChange={noopChange} className="input" disabled />
            </div>

            <div>
              <label className="block text sm font-medium text-gray-700">Nature of Business</label>
              <input type="text" name="SubContractorNatureOfBusiness" value={formData.SubContractorNatureOfBusiness} onChange={noopChange} className="input" disabled />
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
    <label className="block text-sm font-medium text-gray-700">Form Received Date</label>
    <input
      type="date"
      name="ReceivedDate"
      value={toDateInput(formData.ReceivedDate)}
      onChange={noopChange}
      className="input"
      readOnly
    />
  </div>
</div>

			
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Death</label>
          <input type="date" name="DeathDate" value={formData.DeathDate} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Cause of Death</label>
          <input type="text" name="DeathCause" value={formData.DeathCause} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Related to Machinery?</label>
          <select name="InjuryMachinery" value={String(!!formData.InjuryMachinery)} onChange={noopChange} className="input" disabled>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Death Location</label>
          <input type="text" name="DeathLocation" value={formData.DeathLocation} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Death Province</label>
          <select name="DeathProvince" value={formData.DeathProvince} onChange={noopChange} className="input" disabled>
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
          <input type="text" name="DeathRegion" value={formData.DeathRegion} onChange={noopChange} className="input" readOnly />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Circumstances</label>
        <textarea name="DeathCircumstances" value={formData.DeathCircumstances} onChange={noopChange} className="input" rows={4} disabled />
      </div>

      {formData.InjuryMachinery && (
        <div className="space-y-4 border-l-4 border-primary pl-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Type</label>
            <input type="text" name="MachineType" value={formData.MachineType} onChange={noopChange} className="input" disabled />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Part Responsible</label>
            <input type="text" name="MachinePartResponsible" value={formData.MachinePartResponsible} onChange={noopChange} className="input" disabled />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Power Source</label>
            <input type="text" name="MachinePowerSource" value={formData.MachinePowerSource} onChange={noopChange} className="input" disabled />
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
          <input type="text" name="SpouseFirstName" value={s(formData.SpouseFirstName)} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Last Name</label>
          <input type="text" name="SpouseLastName" value={s(formData.SpouseLastName)} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Date of Birth</label>
          <input type="date" name="SpouseDOB" value={toDateInput(s(formData.SpouseDOB))} onChange={noopChange} className="input" disabled />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address Line 1</label>
          <textarea name="SpouseAddress1" value={s(formData.SpouseAddress1)} onChange={noopChange} className="input" rows={3} disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address Line 2</label>
          <textarea name="SpouseAddress2" value={s(formData.SpouseAddress2)} onChange={noopChange} className="input" rows={3} disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" name="SpouseCity" value={s(formData.SpouseCity)} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input type="text" name="SpouseProvince" value={s(formData.SpouseProvince)} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input type="text" name="SpousePOBox" value={s(formData.SpousePOBox)} onChange={noopChange} className="input" disabled />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" name="SpouseEmail" value={s(formData.SpouseEmail)} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input type="tel" name="SpouseMobile" value={s(formData.SpouseMobile)} onChange={noopChange} className="input" disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input type="tel" name="SpouseLandline" value={s(formData.SpouseLandline)} onChange={noopChange} className="input" disabled />
        </div>
      </div>

      <div className="flex items-center">
        <input type="checkbox" name="WorkerHaveDependants" checked={b(formData.WorkerHaveDependants)} onChange={noopChange} className="h-4 w-4 text-primary border-gray-300 rounded" disabled />
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
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(dependant.DependantDOB).toLocaleDateString()}
                  </p>
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
        <input type="checkbox" name="GradualProcessInjury" checked={b(formData.GradualProcessInjury)} onChange={noopChange} className="h-4 w-4 text-primary border-gray-300 rounded" disabled />
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
                    {new Date(history.WorkerJoiningDate).toLocaleDateString()}{" "}
                    -{" "}
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
        <select name="InsuranceProviderIPACode" value={formData.InsuranceProviderIPACode} onChange={noopChange} className="input" disabled>
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
              <textarea name="InsuranceCompanyAddress1" value={formData.InsuranceCompanyAddress1} onChange={noopChange} className="input" rows={3} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
              <textarea name="InsuranceCompanyAddress2" value={formData.InsuranceCompanyAddress2} onChange={noopChange} className="input" rows={3} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <input type="text" name="InsuranceCompanyCity" value={formData.InsuranceCompanyCity} onChange={noopChange} className="input" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <input type="text" name="InsuranceCompanyProvince" value={formData.InsuranceCompanyProvince} onChange={noopChange} className="input" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
              <input type="text" name="InsuranceCompanyPOBox" value={formData.InsuranceCompanyPOBox} onChange={noopChange} className="input" readOnly />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Landline</label>
            <input type="text" name="InsuranceCompanyLandLine" value={formData.InsuranceCompanyLandLine} onChange={noopChange} className="input" readOnly />
          </div>
        </>
      )}
    </div>
  );

  const renderForm12Scan = () => {
    const path = formData.ImageName;
    const hasImagePreview = isImagePath(path) && scanUrl;

    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Form 12 Scanned File</label>
          {path && (
            <p className="text-xs text-gray-600 mt-1">
              Storage path: <span className="font-mono break-all">{path}</span>
            </p>
          )}
        </div>

        {/* Preview area */}
{/* Preview area */}
{scanUrl && (
  <div className="mt-2">
    {isPreviewable(scanUrl) ? (
      isImageUrl(scanUrl) ? (
        <img
          src={scanUrl}
          alt="Form 12 scan preview"
          className="w-40 h-40 rounded object-cover border cursor-zoom-in"
          onClick={() => openPreview(scanUrl)}
          loading="lazy"
        />
      ) : (
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
        Open current scan
      </a>
    )}
  </div>
)}

      </div>
    );
  };

  const renderAttachments = () => (
    <div className="space-y-4">
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
          const previewUrl = (attachmentPreviews as any)[key];
          const hasPreview = !!previewUrl;

          return (
            <div key={key} className="space-y-2">
              {/* Label first */}
              <label className="block text-sm font-medium text-gray-700">{label}</label>

              {/* Preview second */}
{hasPreview ? (
  isPreviewable(previewUrl) ? (
    isImageUrl(previewUrl) ? (
      <img
        src={previewUrl}
        alt={`${label} preview`}
        className="w-28 h-28 object-cover rounded border cursor-zoom-in"
        onClick={() => openPreview(previewUrl)}
        loading="lazy"
      />
    ) : (
      <button
        type="button"
        className="text-primary hover:underline text-sm"
        onClick={() => openPreview(previewUrl)}
      >
        Preview PDF
      </button>
    )
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
  const outerWrap = embedded
    ? "w-full"
    : "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50";

  const cardWrap = embedded
    ? "bg-white rounded-lg w-full max-w-none overflow-visible flex flex-col"
    : "bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col";

  return (
    <div className={outerWrap}>
      <div className={cardWrap}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">View Form 12 — Death</h2>
            <div className="mt-1 text-xs text-gray-500">
              IRN: <span className="font-mono">{viewIRN ?? "—"}</span>
              {"  |  "}
              CRN: <span className="font-mono">{formData.DisplayIRN || "—"}</span>
              {"  |  "}
              Worker: <span className="font-mono">{formData.WorkerID || "—"}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={formRef} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-6">
            {loading && <div className="p-3 bg-gray-50 text-gray-700 rounded">Loading…</div>}
            {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}

            {/* tabs */}
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

						{/* Unified image/PDF preview modal */}
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

            {/* Actions 
            <div className="pt-4 flex items-center gap-2">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Close
              </button>
            </div>*/}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewForm12;
