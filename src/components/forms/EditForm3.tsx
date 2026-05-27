import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, AlertCircle, Upload, Save, Trash2, FileText, PlusCircle, MinusCircle } from "lucide-react";
import { supabase } from "../../services/supabase";


/**
 * EditForm3 — full edit-mode version of NewForm3 with ALL tabs.
 * - Employer & Insurance tabs are READ-ONLY (disabled fields)
 * - Other tabs are editable
 * - Mirrors preview utilities (passport, Form 3 scan, supporting docs) with click‑to‑zoom (lightbox)
 * - Persists: workerpersonaldetails, form1112master, form3master, formattachments
 * - Also supports inline edit of Dependants & Work History (basic add/edit/delete)
 */

interface EditForm3Props {
  workerIRN: number;
  onClose: () => void;
  onSaved?: (irn: number) => void;
}

// -------------------- utilities (mirrored) --------------------
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

// Attachment keys
const ATTACH_KEYS: Array<{ key: string; label: string }> = [
  { key: "IMR", label: "Interim medical report" },
  { key: "FMR", label: "Final medical report" },
  { key: "SEC43", label: "Section 43 application form" },
  { key: "SS", label: "Supervisor statement" },
  { key: "WS", label: "Witness statement" },
  { key: "IWS", label: "Injured worker's statement" },
  { key: "PTA", label: "Payslip at time of accident" },
  { key: "TR", label: "Treatment records" },
  { key: "PAR", label: "Police accident report" },
  { key: "F18", label: "Form 18 Scan" },
  { key: "MEX", label: "Medical Expenses" },
  { key: "MISC", label: "Misc Expenses" },
  { key: "DED", label: "Deductions" },
];

const ATTACH_TYPE_TO_KEY: Record<string, string> = {
  "Interim medical report": "IMR",
  "Final medical report": "FMR",
  "Section 43 application form": "SEC43",
  "Supervisor statement": "SS",
  "Witness statement": "WS",
  "Injured worker's statement": "IWS",
  "Payslip at time of accident": "PTA",
  "Treatment records": "TR",
  "Police accident report": "PAR",
  "Form 18 Scan": "F18",
  "MedicalExpenses": "MEX",
  "MiscExpenses": "MISC",
  "Deductions": "DED",
};

const KEY_TO_ATTACH_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ATTACH_TYPE_TO_KEY).map(([type, key]) => [key, type])
);

// Simple lightbox overlay for click‑to‑zoom
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

// -------------------- component --------------------
const EditForm3: React.FC<EditForm3Props> = ({ workerIRN, onClose, onSaved }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data aggregates
  const [formData, setFormData] = useState<any>({});
  const [dependants, setDependants] = useState<any[]>([]); // expects DependantID
  const [workHistory, setWorkHistory] = useState<any[]>([]); // expects WorkHistoryID
  const [provinces, setProvinces] = useState<any[]>([]);

  // Previews (passport, scan, and supporting docs)
  const [passportUrl, setPassportUrl] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});

  // One global lightbox (works for passport, scan, and attachments)
  const [lightboxSrc, setLightboxSrc] = useState<string>("");

  // Local file selections
  const [scanFile, setScanFile] = useState<File | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Tabs
  const [currentTab, setCurrentTab] = useState(1);

	// ↓ Add this near the top after other useState hooks
type ChangeRow = { field: string; from: string; to: string };

const [showSummary, setShowSummary] = useState(false);
const [changes, setChanges] = useState<ChangeRow[]>([]);
const [originalData, setOriginalData] = useState<any | null>(null);
const [origDependants, setOrigDependants] = useState<any[]>([]);
const [origWorkHistory, setOrigWorkHistory] = useState<any[]>([]);


  // ------------ load ------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (workerIRN == null || Number.isNaN(workerIRN)) throw new Error("Invalid IRN");

        // Get IRN row & WorkerID
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
          { data: form3Data },
          { data: form1112Data, error: form1112Error },
          { data: workerData },
          { data: employmentData },
          { data: provinceData },
          { data: dependantData },
          { data: historyData },
          { data: attachRows },
        ] = await Promise.all([
          supabase.from("form3master").select("*").eq("IRN", workerIRN).maybeSingle(),
          supabase
            .from("form1112master")
            .select(
              "TimeBarred, IncidentDate, IncidentLocation, IncidentProvince, IncidentRegion, NatureExtentInjury, InjuryCause, InsuranceProviderIPACode, ImageName, PublicUrl"
            )
            .eq("IRN", workerIRN)
            .maybeSingle(),
          supabase.from("workerpersonaldetails").select("*").eq("WorkerID", wid).maybeSingle(),
          supabase.from("currentemploymentdetails").select("*").eq("WorkerID", wid).maybeSingle(),
          supabase.from("dictionary").select("DKey, DValue").eq("DType", "Province"),
          supabase.from("dependantpersonaldetails").select("*, DependantID").eq("WorkerID", wid),
          supabase.from("workhistory").select("*, WorkHistoryID").eq("WorkerID", wid),
          supabase.from("formattachments").select("AttachmentType, FileName").eq("IRN", workerIRN),
        ]);
        if (form1112Error) throw form1112Error;

        // Pull insurance company details by IPACODE (for Insurance tab)
        let insuranceDetails: any = null;
        if (form1112Data?.InsuranceProviderIPACode) {
          const { data: insData } = await supabase
            .from("insurancecompanymaster")
            .select("*")
            .eq("IPACODE", form1112Data.InsuranceProviderIPACode)
            .maybeSingle();
          if (insData) insuranceDetails = insData;
        }

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

        // Merge form data for editing — Form3 fields take priority
        const merged = {
          ...(form3Data || {}),
          IRN: workerIRN,
          WorkerID: wid,
          DisplayIRN: workerIrnData.DisplayIRN,
          // worker person summary (editable here)
          WorkerFirstName: workerData?.WorkerFirstName || workerIrnData.FirstName,
          WorkerLastName: workerData?.WorkerLastName || workerIrnData.LastName,
          WorkerAliasName: workerData?.WorkerAliasName || "",
          WorkerDOB: workerData?.WorkerDOB || "",
          WorkerGender: workerData?.WorkerGender || "",
          WorkerMarried: workerData?.WorkerMarried || "",
          WorkerHanded: workerData?.WorkerHanded || "Right",
          WorkerPlaceOfOriginVillage: workerData?.WorkerPlaceOfOriginVillage || "",
          WorkerPlaceOfOriginDistrict: workerData?.WorkerPlaceOfOriginDistrict || "",
          WorkerPlaceOfOriginProvince: workerData?.WorkerPlaceOfOriginProvince || "",
          WorkerPassportPhoto: workerData?.WorkerPassportPhoto || "",
          WorkerAddress1: workerData?.WorkerAddress1 || "",
          WorkerAddress2: workerData?.WorkerAddress2 || "",
          WorkerCity: workerData?.WorkerCity || "",
          WorkerProvince: workerData?.WorkerProvince || "",
          WorkerPOBox: workerData?.WorkerPOBox || "",
          WorkerEmail: workerData?.WorkerEmail || "",
          WorkerMobile: workerData?.WorkerMobile || "",
          WorkerLandline: workerData?.WorkerLandline || "",
          // spouse
          SpouseFirstName: workerData?.SpouseFirstName || "",
          SpouseLastName: workerData?.SpouseLastName || "",
          SpouseDOB: workerData?.SpouseDOB || "",
          SpousePlaceOfOriginVillage: workerData?.SpousePlaceOfOriginVillage || "",
          SpousePlaceOfOriginDistrict: workerData?.SpousePlaceOfOriginDistrict || "",
          SpousePlaceOfOriginProvince: workerData?.SpousePlaceOfOriginProvince || "",
          SpouseAddress1: workerData?.SpouseAddress1 || "",
          SpouseAddress2: workerData?.SpouseAddress2 || "",
          SpouseCity: workerData?.SpouseCity || "",
          SpouseProvince: workerData?.SpouseProvince || "",
          SpousePOBox: workerData?.SpousePOBox || "",
          SpouseEmail: workerData?.SpouseEmail || "",
          SpouseMobile: workerData?.SpouseMobile || "",
          SpouseLandline: workerData?.SpouseLandline || "",
          // employment (read only)
          EmployerID: employmentData?.EmployerID || "",
          EmployercppsID: employmentData?.EmployerCPPSID || "",
          Occupation: employmentData?.Occupation || "",
          PlaceOfEmployment: employmentData?.PlaceOfEmployment || "",
          NatureOfEmployment: employmentData?.NatureOfEmployment || "",
          AverageWeeklyWage: employmentData?.AverageWeeklyWage || 0,
          SubContractorOrganizationName: employmentData?.SubContractorOrganizationName || "",
          SubContractorLocation: employmentData?.SubContractorLocation || "",
          SubContractorNatureOfBusiness: employmentData?.SubContractorNatureOfBusiness || "",
          // incident (1112)
          IncidentDate: form1112Data?.IncidentDate || "",
          IncidentLocation: form1112Data?.IncidentLocation || "",
          IncidentProvince: form1112Data?.IncidentProvince || "",
          IncidentRegion: form1112Data?.IncidentRegion || "",
          NatureExtentInjury: form1112Data?.NatureExtentInjury || "",
          InjuryCause: form1112Data?.InjuryCause || "",
          InsuranceProviderIPACode: form1112Data?.InsuranceProviderIPACode || "",
          // applicant defaults (editable)
          ApplicantFirstName:
            form3Data?.ApplicantFirstName ?? workerData?.WorkerFirstName ?? workerIrnData.FirstName ?? "",
          ApplicantLastName:
            form3Data?.ApplicantLastName ?? workerData?.WorkerLastName ?? workerIrnData.LastName ?? "",
          ApplicantAddress1: form3Data?.ApplicantAddress1 ?? workerData?.WorkerAddress1 ?? "",
          ApplicantAddress2: form3Data?.ApplicantAddress2 ?? workerData?.WorkerAddress2 ?? "",
          ApplicantCity: form3Data?.ApplicantCity ?? workerData?.WorkerCity ?? "",
          ApplicantProvince: form3Data?.ApplicantProvince ?? workerData?.WorkerProvince ?? "",
          ApplicantPOBox: form3Data?.ApplicantPOBox ?? workerData?.WorkerPOBox ?? "",
          ApplicantEmail: form3Data?.ApplicantEmail ?? workerData?.WorkerEmail ?? "",
          ApplicantMobile: form3Data?.ApplicantMobile ?? workerData?.WorkerMobile ?? "",
          ApplicantLandline: form3Data?.ApplicantLandline ?? workerData?.WorkerLandline ?? "",
          // form3 scan
          ImageName: form1112Data?.ImageName || "",
          PublicUrl: form1112Data?.PublicUrl || "",
          // supporting docs (paths)
          ...attachPaths,
          // insurance company detail merge
          ...(insuranceDetails
            ? {
                InsuranceCompanyOrganizationName:
                  insuranceDetails.InsuranceCompanyOrganizationName || "",
                InsuranceCompanyAddress1: insuranceDetails.InsuranceCompanyAddress1 || "",
                InsuranceCompanyAddress2: insuranceDetails.InsuranceCompanyAddress2 || "",
                InsuranceCompanyCity: insuranceDetails.InsuranceCompanyCity || "",
                InsuranceCompanyProvince: insuranceDetails.InsuranceCompanyProvince || "",
                InsuranceCompanyPOBox: insuranceDetails.InsuranceCompanyPOBox || "",
                InsuranceCompanyLandLine: insuranceDetails.InsuranceCompanyLandLine || "",
              }
            : {}),
        } as any;

        setFormData(merged);
        setDependants((dependantData || []).map((d: any) => ({ ...d, __status: "existing" })));
        setWorkHistory((historyData || []).map((h: any) => ({ ...h, __status: "existing" })));
        setProvinces(provinceData || []);


setOriginalData(merged);               // snapshot for field diffs
setOrigDependants((dependantData || []).map((d: any) => ({ ...d })));
setOrigWorkHistory((historyData || []).map((h: any) => ({ ...h })));



				
        // Previews
        const pUrl = await resolveStorageUrl(merged.WorkerPassportPhoto);
        setPassportUrl(pUrl);
        const scanCandidate = merged.PublicUrl || merged.ImageName;
        const sUrl = await resolveStorageUrl(scanCandidate);
        setScanUrl(sUrl);
        setAttachmentPreviews((prev) => ({ ...prev, ...previewMap }));
      } catch (e: any) {
        console.error("EditForm3 load error:", e);
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
  const addDependant = () => {
    setDependants((prev) => [
      ...prev,
      {
        DependantID: undefined,
        DependantFirstName: "",
        DependantLastName: "",
        DependantDOB: "",
        DependantGender: "",
        DependantType: "",
        DependanceDegree: "",
        __status: "new",
      },
    ]);
  };
  const updateDependant = (idx: number, key: string, value: any) => {
    setDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  };
  const deleteDependant = (idx: number) => {
    setDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, __status: "deleted" } : d)));
  };

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
  const updateHistory = (idx: number, key: string, value: any) => {
    setWorkHistory((prev) => prev.map((h, i) => (i === idx ? { ...h, [key]: value } : h)));
  };
  const deleteHistory = (idx: number) => {
    setWorkHistory((prev) => prev.map((h, i) => (i === idx ? { ...h, __status: "deleted" } : h)));
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);

const irn = Number(formData.IRN || workerIRN);
const wid = Number(formData.WorkerID);

      if (!irn || !wid) throw new Error("Missing identifiers");

      // 0) Upload Form 3 scan if selected
      if (scanFile) {
        const ext = scanFile.name.split(".").pop() || "bin";
        const dest = `form3/${irn}/form3-scan.${ext}`;
        const path = await uploadToStorage(scanFile, dest);
        setFormData((prev: any) => ({ ...prev, ImageName: path, PublicUrl: "" }));
        await supabase
          .from("form1112master")
          .update({ ImageName: path, PublicUrl: null })
          .eq("IRN", irn);
      }

      // 1) Upload supporting documents selected
      for (const { key } of ATTACH_KEYS) {
        const tempFile: File | undefined = (formData as any)[key + "_FILE"];
        if (tempFile) {
          const ext = tempFile.name.split(".").pop() || "bin";
          const dest = `form3/${irn}/attachments/${key}.${ext}`;
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

      // 2) Persist worker personal + spouse (workerpersonaldetails)
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
        SpouseFirstName: formData.SpouseFirstName ?? null,
        SpouseLastName: formData.SpouseLastName ?? null,
        SpouseDOB: formData.SpouseDOB || null,
        SpousePlaceOfOriginVillage: formData.SpousePlaceOfOriginVillage ?? null,
        SpousePlaceOfOriginDistrict: formData.SpousePlaceOfOriginDistrict ?? null,
        SpousePlaceOfOriginProvince: formData.SpousePlaceOfOriginProvince ?? null,
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

      // 3) Persist incident fields (form1112master)
      const f1112Payload: any = {
        IncidentDate: formData.IncidentDate || null,
        IncidentLocation: formData.IncidentLocation ?? null,
        IncidentProvince: formData.IncidentProvince ?? null,
        IncidentRegion: formData.IncidentRegion ?? null,
        NatureExtentInjury: formData.NatureExtentInjury ?? null,
        InjuryCause: formData.InjuryCause ?? null,
      };
      await supabase.from("form1112master").update(f1112Payload).eq("IRN", irn);

      // 4) Upsert editable Form 3 fields (form3master)
      const form3Payload: any = {
        IRN: irn,
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
        DisabilitiesDescription: formData.DisabilitiesDescription ?? null,
        IncapacityExtent: formData.IncapacityExtent ?? null,
        IncapacityDescription: formData.IncapacityDescription ?? null,
        EstimatedIncapacityDuration: formData.EstimatedIncapacityDuration ?? null,
        CompensationClaimDetails: formData.CompensationClaimDetails ?? null,
        AverageEarnableAmount: formData.AverageEarnableAmount ?? null,
        AllowanceReceived: formData.AllowanceReceived ?? null,
      };
      await supabase.from("form3master").upsert(form3Payload, { onConflict: "IRN" });

      // 5) Persist Dependants
      for (const d of dependants) {
        if (d.__status === "deleted" && d.DependantID) {
          await supabase.from("dependantpersonaldetails").delete().eq("DependantID", d.DependantID);
          continue;
        }
        if (d.__status === "new") {
          const payload: any = {
            WorkerID: wid,
            DependantFirstName: d.DependantFirstName || null,
            DependantLastName: d.DependantLastName || null,
            DependantDOB: d.DependantDOB || null,
            DependantGender: d.DependantGender || null,
            DependantType: d.DependantType || null,
            DependanceDegree: d.DependanceDegree || null,
          };
          await supabase.from("dependantpersonaldetails").insert(payload);
          continue;
        }
        if (d.__status === "existing" && d.DependantID) {
          const payload: any = {
            DependantFirstName: d.DependantFirstName || null,
            DependantLastName: d.DependantLastName || null,
            DependantDOB: d.DependantDOB || null,
            DependantGender: d.DependantGender || null,
            DependantType: d.DependantType || null,
            DependanceDegree: d.DependanceDegree || null,
          };
          await supabase.from("dependantpersonaldetails").update(payload).eq("DependantID", d.DependantID);
        }
      }

      // 6) Persist Work History
      for (const h of workHistory) {
        if (h.__status === "deleted" && h.WorkHistoryID) {
          await supabase.from("workhistory").delete().eq("WorkHistoryID", h.WorkHistoryID);
          continue;
        }
        if (h.__status === "new") {
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
          await supabase.from("workhistory").insert(payload);
          continue;
        }
        if (h.__status === "existing" && h.WorkHistoryID) {
          const payload: any = {
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
          await supabase.from("workhistory").update(payload).eq("WorkHistoryID", h.WorkHistoryID);
        }
      }

// workerpersonaldetails: upsert so the row exists
			{/* await supabase.from("workerpersonaldetails").upsert(
  { WorkerID: wid, ...workerPayload },
  { onConflict: "WorkerID" }
); */}

// form1112master: still update by IRN (row always exists for the case), but keep numeric IRN
await supabase.from("form1112master").update(f1112Payload).eq("IRN", irn);

// form3master: upsert on IRN so it’s created if missing
// 4) Save Form 3 (update first; if nothing updated, insert)
// 4) Save Form 3 (update first; if nothing updated, insert)
const { data: f3Updated, error: f3UpErr } = await supabase
  .from("form3master")
  .update(form3Payload)
  .eq("IRN", irn)
  .select("IRN"); // ← no .limit(1)

if (f3UpErr) throw f3UpErr;

if (!f3Updated || f3Updated.length === 0) {
  const { error: f3InsErr } = await supabase.from("form3master").insert(form3Payload);
  if (f3InsErr) throw f3InsErr;
}



			
      if (onSaved) onSaved(irn);
      onClose();
    } catch (e: any) {
      console.error("EditForm3 save error:", e);
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };


// ---------- change-summary helpers ----------
const toStr = (v: any) => (v ?? '').toString();
const asDateISO = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '');

// labels for *editable* Form 3 fields
const FIELD_LABELS: Record<string, string> = {
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
  SpousePlaceOfOriginVillage: 'Spouse Origin Village',
  SpousePlaceOfOriginDistrict: 'Spouse Origin District',
  SpousePlaceOfOriginProvince: 'Spouse Origin Province',
  SpouseAddress1: 'Spouse Address 1',
  SpouseAddress2: 'Spouse Address 2',
  SpouseCity: 'Spouse City',
  SpouseProvince: 'Spouse Province',
  SpousePOBox: 'Spouse PO Box',
  SpouseEmail: 'Spouse Email',
  SpouseMobile: 'Spouse Mobile',
  SpouseLandline: 'Spouse Landline',

  // Incident (1112)
  IncidentDate: 'Incident Date',
  IncidentLocation: 'Incident Location',
  IncidentProvince: 'Incident Province',
  IncidentRegion: 'Incident Region',
  NatureExtentInjury: 'Nature/Extent of Injury',
  InjuryCause: 'Cause of Injury',

  // Injury & Capacity (form3master)
  DisabilitiesDescription: 'Disabilities Description',
  IncapacityExtent: 'Incapacity Extent',
  IncapacityDescription: 'Incapacity Description',
  EstimatedIncapacityDuration: 'Estimated Incapacity Duration',

  // Compensation (form3master)
  CompensationClaimDetails: 'Compensation Claim Details',
  AverageEarnableAmount: 'Average Earnable Amount',
  AllowanceReceived: 'Allowance Received',

  // Applicant (form3master)
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

const DATE_KEYS = new Set([
  'WorkerDOB', 'SpouseDOB', 'IncidentDate',
  'WorkerJoiningDate', 'WorkerLeavingDate' // used only in history diffs
]);

const displayValue = (k: string, v: any) =>
  DATE_KEYS.has(k) ? asDateISO(v) : toStr(v);

// compare primitive-ish (string/date/number) fields
const changed = (k: string, a: any, b: any) =>
  displayValue(k, a) !== displayValue(k, b);

// summarize dependant/work history list changes
const summarizeDependantsChange = (): ChangeRow | null => {
  // added/removed
  const added = dependants.filter(d => d.__status === 'new').length;
  const removed = dependants.filter(d => d.__status === 'deleted').length;

  // edited: compare by DependantID against original snapshot
  let edited = 0;
  for (const d of dependants) {
    if (d.__status !== 'existing' || !d.DependantID) continue;
    const orig = origDependants.find(od => od.DependantID === d.DependantID);
    if (!orig) continue;
    const keys = ['DependantFirstName','DependantLastName','DependantDOB','DependantGender','DependantType','DependanceDegree'];
    if (keys.some(k => changed(k, orig[k], d[k]))) edited++;
  }

  if (!added && !removed && !edited) return null;
  return {
    field: 'Dependent Children',
    from: `existing: ${origDependants.length}`,
    to: `added: ${added}, edited: ${edited}, removed: ${removed}`,
  };
};

const summarizeWorkHistoryChange = (): ChangeRow | null => {
  const added = workHistory.filter(h => h.__status === 'new').length;
  const removed = workHistory.filter(h => h.__status === 'deleted').length;

  let edited = 0;
  for (const h of workHistory) {
    if (h.__status !== 'existing' || !h.WorkHistoryID) continue;
    const orig = origWorkHistory.find(oh => oh.WorkHistoryID === h.WorkHistoryID);
    if (!orig) continue;
    const keys = [
      'OrganizationName','OrganizationAddress1','OrganizationCity','OrganizationProvince',
      'OrganizationPOBox','OrganizationLandline','OrganizationCPPSID','WorkerJoiningDate','WorkerLeavingDate'
    ];
    if (keys.some(k => changed(k, orig[k], h[k]))) edited++;
  }

  if (!added && !removed && !edited) return null;
  return {
    field: 'Work History',
    from: `existing: ${origWorkHistory.length}`,
    to: `added: ${added}, edited: ${edited}, removed: ${removed}`,
  };
};

// build the change rows
const computeChanges = (): ChangeRow[] => {
  const rows: ChangeRow[] = [];
  const before = originalData || {};
  const after  = formData || {};

  // compare only the editable keys from FIELD_LABELS
  for (const k of Object.keys(FIELD_LABELS)) {
    if (changed(k, before[k], after[k])) {
      rows.push({
        field: FIELD_LABELS[k],
        from: displayValue(k, before[k]),
        to: displayValue(k, after[k]),
      });
    }
  }

  // Form 3 scan replacement?
  if (scanFile) {
    rows.push({ field: 'Form 3 Scan', from: toStr(before.ImageName || before.PublicUrl), to: '(new file selected)' });
  }

  // New/changed supporting attachments (we track *_FILE in formData)
  ATTACH_KEYS.forEach(({ key }) => {
    if ((formData as any)[`${key}_FILE`]) {
      rows.push({ field: `New Attachment: ${key}`, from: '', to: '(new file selected)' });
    }
  });

  // Aggregate sub-tables
  const depSummary = summarizeDependantsChange();
  if (depSummary) rows.push(depSummary);

  const histSummary = summarizeWorkHistoryChange();
  if (histSummary) rows.push(histSummary);

  return rows;
};

// open summary (validate a couple of critical fields like Form 11)
const handleOpenSummary = () => {
  setError(null);

  // Minimal requireds: these mirror your persistence split
  const requiredKeys = [
    'IncidentDate','IncidentLocation','IncidentProvince','NatureExtentInjury','InjuryCause',
    'ApplicantFirstName','ApplicantLastName'
  ];
  const missing = requiredKeys.filter(k => !toStr(formData[k]));
  if (missing.length) {
    setError(`Please fill in required fields: ${missing.map(k => FIELD_LABELS[k] || k).join(', ')}`);
    return;
  }

  const rows = computeChanges();
  if (!rows.length) {
    setError('No changes detected.');
    return;
  }
  setChanges(rows);
  setShowSummary(true);
};

const confirmSave = async () => {
  setShowSummary(false);
  await save();
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
          <label className="block text sm font-medium text-gray-700">Province</label>
          <input name="SpouseProvince" value={safe(formData.SpouseProvince)} onChange={handleChange} className="input" />
        </div>
        <div>
          <label className="block text sm font-medium text-gray-700">P.O. Box</label>
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

  const renderDependants = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Dependent Children</h3>
        <button
          type="button"
          onClick={addDependant}
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
          {dependants.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-gray-500 text-center">No dependants</td>
            </tr>
          )}
          {dependants.map((d, i) => (
            <tr key={i} className={d.__status === "deleted" ? "opacity-50" : ""}>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(d.DependantFirstName)}
                  onChange={(e) => updateDependant(i, "DependantFirstName", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(d.DependantLastName)}
                  onChange={(e) => updateDependant(i, "DependantLastName", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  type="date"
                  className="input"
                  value={dateISO(d.DependantDOB)}
                  onChange={(e) => updateDependant(i, "DependantDOB", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(d.DependantGender)}
                  onChange={(e) => updateDependant(i, "DependantGender", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(d.DependantType)}
                  onChange={(e) => updateDependant(i, "DependantType", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  className="input"
                  value={safe(d.DependanceDegree)}
                  onChange={(e) => updateDependant(i, "DependanceDegree", e.target.value)}
                />
              </td>
              <td className="border px-2 py-1 text-center">
                <button
                  type="button"
                  onClick={() => deleteDependant(i)}
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

  const renderEmployment = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">Employer details are read-only in Edit mode.</div>
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
      <div>
        <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
        <input className="input" value={safe(formData.AverageWeeklyWage)} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subcontractor Organization Name</label>
        <input className="input" value={safe(formData.SubContractorOrganizationName)} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subcontractor Location</label>
        <input className="input" value={safe(formData.SubContractorLocation)} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Subcontractor Nature of Business</label>
        <input className="input" value={safe(formData.SubContractorNatureOfBusiness)} readOnly disabled />
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

  const renderInjuryCapacity = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Date</label>
          <input
            name="IncidentDate"
            type="date"
            value={dateISO(formData.IncidentDate)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Location</label>
          <input
            name="IncidentLocation"
            value={safe(formData.IncidentLocation)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input
            name="IncidentProvince"
            value={safe(formData.IncidentProvince)}
            onChange={handleChange}
            className="input"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Region</label>
          <input
            name="IncidentRegion"
            value={safe(formData.IncidentRegion)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nature/Extent of Injury</label>
          <textarea
            name="NatureExtentInjury"
            value={safe(formData.NatureExtentInjury)}
            onChange={handleChange}
            className="input"
            rows={3}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
        <textarea
          name="InjuryCause"
          value={safe(formData.InjuryCause)}
          onChange={handleChange}
          className="input"
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Disabilities Description</label>
        <textarea
          name="DisabilitiesDescription"
          value={safe(formData.DisabilitiesDescription)}
          onChange={handleChange}
          className="input"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incapacity Extent</label>
          <input
            name="IncapacityExtent"
            value={safe(formData.IncapacityExtent)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incapacity Description</label>
          <input
            name="IncapacityDescription"
            value={safe(formData.IncapacityDescription)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Estimated Duration</label>
          <input
            name="EstimatedIncapacityDuration"
            value={safe(formData.EstimatedIncapacityDuration)}
            onChange={handleChange}
            className="input"
          />
        </div>
      </div>
    </div>
  );

  const renderCompensation = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Compensation Claim Details</label>
        <textarea
          name="CompensationClaimDetails"
          value={safe(formData.CompensationClaimDetails)}
          onChange={handleChange}
          className="input"
          rows={3}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Earnable Amount</label>
          <input
            name="AverageEarnableAmount"
            value={safe(formData.AverageEarnableAmount)}
            onChange={handleChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Allowance Received</label>
          <input
            name="AllowanceReceived"
            value={safe(formData.AllowanceReceived)}
            onChange={handleChange}
            className="input"
          />
        </div>
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

  const renderForm3Scan = () => (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">Form 3 Scan</label>
      <div className="flex items-center gap-4">
        {scanUrl ? (
          isImagePath(formData.ImageName || formData.PublicUrl) ? (
            <img
              src={scanUrl}
              className="w-32 h-32 rounded border object-cover cursor-zoom-in"
              onClick={() => setLightboxSrc(scanUrl)}
              alt="Form 3 Scan"
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

  // Tabs (same styling as NewForm3 — active: bg-primary text-white; otherwise gray)
  const tabs = useMemo(
    () => [
      { name: "Worker", render: renderWorker },
      { name: "Spouse", render: renderSpouse },
      { name: "Dependent Children", render: renderDependants },
      { name: "Employment", render: renderEmployment }, // read-only
      { name: "Work History", render: renderWorkHistory },
      { name: "Injury & Capacity", render: renderInjuryCapacity },
      { name: "Compensation", render: renderCompensation },
      { name: "Insurance", render: renderInsurance }, // read-only
      { name: "Applicant", render: renderApplicant },
      { name: "Form 3 Scan", render: renderForm3Scan },
      { name: "Supporting Documents", render: renderSupportingDocs },
    ],
    [attachmentPreviews, scanUrl, passportUrl, formData, dependants, workHistory]
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
          <h2 className="text-2xl font-bold">Edit Form 3</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenSummary}
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

{showSummary && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    {/* Backdrop */}
    <div className="absolute inset-0 bg-black/50" onClick={() => setShowSummary(false)} />

    {/* print-only styles for a clean printout */}
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        .print-area, .print-area * { visibility: visible !important; }
        .print-area {
          position: static !important;
          inset: auto !important;
          box-shadow: none !important;
          background: white !important;
        }
        .no-print { display: none !important; }
      }
    `}</style>

    {/* Card */}
    <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="font-semibold">Review changes</h3>
        <button type="button" className="p-2 hover:bg-gray-100 rounded no-print" onClick={() => setShowSummary(false)}>
          <X size={18} />
        </button>
      </div>

      {/* Printable area */}
      <div className="p-5 space-y-4 text-sm print-area" id="summary-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex justify-between">
            <span className="text-gray-600">IRN</span>
            <span className="font-medium">{formData.IRN || workerIRN}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">CRN</span>
            <span className="font-medium">{toStr(formData.DisplayIRN) || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Worker</span>
            <span className="font-medium">
              {`${toStr(formData.WorkerFirstName)} ${toStr(formData.WorkerLastName)}`.trim()} ({toStr(formData.WorkerID) || '-'})
            </span>
          </div>
        </div>

        {/* Changes table */}
        <div className="mt-2">
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
                      <td className="px-3 py-2 break-all">{r.from || <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 break-all">{r.to || <span className="text-gray-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-end gap-2 no-print">
          <button
            type="button"
            onClick={() => setShowSummary(false)}
            className="inline-flex items-center px-4 py-2 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
          >
            Go back to edit
          </button>
          <button
            type="button"
            onClick={confirmSave}
            className="inline-flex items-center px-4 py-2 rounded-md text-sm bg-primary text-white hover:opacity-90"
          >
            Confirm &amp; Save
          </button>
        </div>
      </div>
    </div>
  </div>
)}


			
      {/* global lightbox for previews */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} />}

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

export default EditForm3;
