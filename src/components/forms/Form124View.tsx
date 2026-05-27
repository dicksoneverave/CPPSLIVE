import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../../services/supabase";

// -------------------- Props --------------------
interface Form124ViewProps {
  irn: string | number;                 // accepts string or number
  onClose?: () => void;                 // optional when embedded
  variant?: "modal" | "embedded";       // default 'embedded'
  className?: string;                   // wrapper class when embedded
}

// -------------------- helpers (match ViewForm4 style) --------------------
const safe = (v: any) => (v ?? "").toString();
const dateStr = (v: any) => (v ? new Date(v).toLocaleDateString() : "");
const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || "");

const normalizeStoragePath = (p?: string) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  let s = p.replace(/^\/+/, "");
  s = s.replace(/^(?:cpps\/+)+/i, "");
  return s;
};

// Resolve a Supabase Storage path to a browser-usable URL
const resolveStorageUrl = async (rawPath?: string): Promise<string> => {
  try {
    if (!rawPath) return "";
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const path = normalizeStoragePath(rawPath);
    if (!path) return "";
    // try public url
    const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    // fallback to signed url
    const { data: signed } = await supabase.storage
      .from("cpps")
      .createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl || "";
  } catch {
    return "";
  }
};

// === Folder mappings (Death / Form 4) ===
const deathFolderMap: Record<string, string> = {
  "Death Certificate": "attachments/formattachments/Deathcertificate/",
  "Post Mortem report": "attachments/formattachments/Postmortemreport/",
  "Police incident report": "attachments/formattachments/Policeincidentreport/",
  "Witness statement": "attachments/formattachments/Witnessstatement/",
  "Section 43 application form": "attachments/formattachments/SEC43/",
  "Supervisor statement": "attachments/formattachments/Supervisorstatement/",
  "Dependency declaration": "attachments/formattachments/Dependencedeclaration/",
  "Payslip at the time of accident": "attachments/formattachments/Payslipattimeofaccident/",
  "Funeral expenses receipts": "attachments/formattachments/Funeralexpensereceipts/",
  "Form 18 Scan": "attachments/formattachments/Form18scan/",
  "MedicalExpenses": "attachments/formattachments/MedicalExpenses/",
  "MiscExpenses": "attachments/formattachments/MiscExpenses/",
  "Deductions": "attachments/formattachments/Deductions/",
};
const FORM4_SCAN_FOLDER = "attachments/form4scan/";
const WORKER_PASSPORT_FOLDER = "attachments/workerpassportphotos/";

// If `fileOrPath` is already a full path, keep it; otherwise prefix with `folder/`
const ensureFolderPath = (folder: string, fileOrPath?: string) => {
  const f = (fileOrPath ?? "").trim();
  if (!f) return "";
  if (f.includes("/")) return normalizeStoragePath(f);
  return normalizeStoragePath(`${folder.replace(/\/?$/, "/")}${f}`);
};




// -------------------- attachment dictionary (Form 4 / Death) --------------------
const ATTACH_KEYS: Array<{ key: string; label: string; type: string }> = [
  { key: "DC",    label: "Death Certificate",            type: "Death Certificate" },
  { key: "PMR",   label: "Post Mortem report",           type: "Post Mortem report" },
  { key: "SEC43", label: "Section 43 application form",  type: "Section 43 application form" },
  { key: "SS",    label: "Supervisor statement",         type: "Supervisor statement" },
  { key: "WS",    label: "Witness statement",            type: "Witness statement" },
  { key: "DD",    label: "Dependency declaration",       type: "Dependency declaration" },
  { key: "PTA",   label: "Payslip at time of accident",  type: "Payslip at the time of accident" },
  { key: "PIR",   label: "Police incident report",       type: "Police incident report" },
  { key: "FER",   label: "Funeral expenses receipts",    type: "Funeral expenses receipts" },
  { key: "MEC",   label: "Medical Expenses",             type: "MedicalExpenses" },
  { key: "MISC",  label: "Misc Expenses",                type: "MiscExpenses" },
  { key: "DED",   label: "Deductions",                   type: "Deductions" },
  { key: "F18",   label: "Form 18 Scan",                 type: "Form 18 Scan" },
];

const ATTACH_TYPE_TO_KEY: Record<string, string> = Object.fromEntries(
  ATTACH_KEYS.map((a) => [a.type, a.key])
);

// -------------------- simple lightbox --------------------
const Lightbox: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <img
        src={src}
        alt={alt || "preview"}
        className="max-h-[90vh] max-w-[95vw] rounded shadow-2xl cursor-zoom-out"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// -------------------- component --------------------
const Form124View: React.FC<Form124ViewProps> = ({
  irn,
  onClose,
  variant = "embedded",
  className,
}) => {
  const [currentTab, setCurrentTab] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<any>({});
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);

  // previews
  const [passportUrl, setPassportUrl] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string>("");

  const irnNum = useMemo(() => {
    const n = typeof irn === "string" ? Number(irn) : irn;
    return Number.isFinite(n as number) ? (n as number) : null;
  }, [irn]);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (irnNum == null) throw new Error("Invalid IRN");

        // 1) form1112master (ensure Death)
        const { data: f1112, error: f1112Err } = await supabase
          .from("form1112master")
          .select("*")
          .eq("IRN", irnNum)
          .eq("IncidentType", "Death")
          .maybeSingle();
        if (f1112Err) throw f1112Err;
        if (!f1112) throw new Error("Form 12 (death) not found for this IRN.");

        // 2) worker + employment snapshot
        const { data: worker, error: workerErr } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", f1112.WorkerID)
          .maybeSingle();
        if (workerErr) throw workerErr;

        const { data: emp } = await supabase
          .from("currentemploymentdetails")
          .select("*")
          .eq("WorkerID", f1112.WorkerID)
          .maybeSingle();

        // 3) form4master (for scan + claim fields)
        const { data: f4 } = await supabase
          .from("form4master")
          .select("*")
          .eq("IRN", irnNum)
          .maybeSingle();

        // 4) dependants + work history
        const { data: deps } = await supabase
          .from("dependantpersonaldetails")
          .select("*")
          .eq("WorkerID", f1112.WorkerID);

        const { data: history } = await supabase
          .from("workhistory")
          .select("*")
          .eq("WorkerID", f1112.WorkerID);

        setDependants(deps || []);
        setWorkHistory(history || []);

        // 5) attachments
// 5) attachments (map into death folders)
const { data: attachRows } = await supabase
  .from("formattachments")
  .select("AttachmentType, FileName")
  .eq("IRN", irnNum);

const attachPaths: Record<string, string> = {};
const previewMap: Record<string, string> = {};

for (const r of attachRows || []) {
  const type = (r as any).AttachmentType as string;
  const key = ATTACH_TYPE_TO_KEY[type];
  const raw = (r as any).FileName as string;
  if (!key || !raw) continue;

  // place file into correct folder based on type
  const folder = deathFolderMap[type] || "";
  const fullPath = folder ? ensureFolderPath(folder, raw) : normalizeStoragePath(raw);

  attachPaths[key] = fullPath;
  const url = await resolveStorageUrl(fullPath);
  if (url) previewMap[key] = url;
}


        // 6) insurance details (by IPA code)
        let insuranceDetails: any = null;
        if (f1112?.InsuranceProviderIPACode) {
          const { data: insData } = await supabase
            .from("insurancecompanymaster")
            .select("*")
            .eq("IPACODE", f1112.InsuranceProviderIPACode)
            .maybeSingle();
          if (insData) insuranceDetails = insData;
        }

        // 7) workerirn display IRN
        const { data: wirn } = await supabase
          .from("workerirn")
          .select("DisplayIRN, FirstName, LastName")
          .eq("IRN", irnNum)
          .maybeSingle();

        // 8) merge display model
        const merged = {
          ...(f4 || {}),
          IRN: irnNum,
          WorkerID: f1112.WorkerID,
          DisplayIRN: wirn?.DisplayIRN || "",

          // worker primary
          WorkerFirstName: worker?.WorkerFirstName || wirn?.FirstName || "",
          WorkerLastName: worker?.WorkerLastName || wirn?.LastName || "",
          WorkerAliasName: worker?.WorkerAliasName || "",
          WorkerDOB: worker?.WorkerDOB || "",
          WorkerGender: worker?.WorkerGender || "",
          WorkerMarried: worker?.WorkerMarried || "",
          WorkerHanded: worker?.WorkerHanded || "Right",
          WorkerPlaceOfOriginVillage: worker?.WorkerPlaceOfOriginVillage || "",
          WorkerPlaceOfOriginDistrict: worker?.WorkerPlaceOfOriginDistrict || "",
          WorkerPlaceOfOriginProvince: worker?.WorkerPlaceOfOriginProvince || "",
          WorkerPassportPhoto: worker?.WorkerPassportPhoto || "",
          WorkerAddress1: worker?.WorkerAddress1 || "",
          WorkerAddress2: worker?.WorkerAddress2 || "",
          WorkerCity: worker?.WorkerCity || "",
          WorkerProvince: worker?.WorkerProvince || "",
          WorkerPOBox: worker?.WorkerPOBox || "",
          WorkerEmail: worker?.WorkerEmail || "",
          WorkerMobile: worker?.WorkerMobile || "",
          WorkerLandline: worker?.WorkerLandline || "",

          // spouse (unchanged fields)
          SpouseFirstName: worker?.SpouseFirstName || "",
          SpouseLastName: worker?.SpouseLastName || "",
          SpouseDOB: worker?.SpouseDOB || "",
          SpouseAddress1: worker?.SpouseAddress1 || "",
          SpouseAddress2: worker?.SpouseAddress2 || "",
          SpouseCity: worker?.SpouseCity || "",
          SpouseProvince: worker?.SpouseProvince || "",
          SpousePOBox: worker?.SpousePOBox || "",
          SpouseEmail: worker?.SpouseEmail || "",
          SpouseMobile: worker?.SpouseMobile || "",
          SpouseLandline: worker?.SpouseLandline || "",

          // employment snapshot
          EmployerID: emp?.EmployerID || "",
          EmployerCPPSID: emp?.EmployerCPPSID || emp?.EmployercppsID || "",
          Occupation: emp?.Occupation || "",
          PlaceOfEmployment: emp?.PlaceOfEmployment || "",
          NatureOfEmployment: emp?.NatureOfEmployment || "",
          AverageWeeklyWage: emp?.AverageWeeklyWage || 0,
          SubContractorOrganizationName: emp?.SubContractorOrganizationName || "",
          SubContractorLocation: emp?.SubContractorLocation || "",
          SubContractorNatureOfBusiness: emp?.SubContractorNatureOfBusiness || "",

          // incident snapshot
					 ReceivedDate: f1112?.ReceivedDate || "",
          IncidentDate: f1112?.IncidentDate || "",
          IncidentLocation: f1112?.IncidentLocation || "",
          IncidentProvince: f1112?.IncidentProvince || "",
          IncidentRegion: f1112?.IncidentRegion || "",
          NatureExtentInjury: f1112?.NatureExtentInjury || "",
          InjuryCause: f1112?.InjuryCause || "",

          // insurance (readonly)
          InsuranceProviderIPACode: f1112?.InsuranceProviderIPACode || "",
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

          // form4master core (claim fields)
          AnnualEarningsAtDeath: f4?.AnnualEarningsAtDeath || 0,
          CompensationBenefitsPriorToDeath: safe(f4?.CompensationBenefitsPriorToDeath),
          CompensationBenefitDetails: safe(f4?.CompensationBenefitDetails),
          CompensationClaimed: safe(f4?.CompensationClaimed),
          MedicalExpenseDetails: safe(f4?.MedicalExpenseDetails),
          FuneralExpenseDetails: safe(f4?.FuneralExpenseDetails),
          IncidentDescription: safe(f4?.IncidentDescription),

          // scan file name (could be Form4ImageName or ImageName)
          ImageName: safe(f4?.Form4ImageName || f4?.ImageName || ""),

          // supporting docs (by key)
          ...attachPaths,
        };

        setFormData(merged);

        // resolve previews
// Worker passport: if it's just a filename, put it under attachments/workerpassportphotos
const passportRaw = merged.WorkerPassportPhoto;
const passportPath = ensureFolderPath(WORKER_PASSPORT_FOLDER, passportRaw);
setPassportUrl(await resolveStorageUrl(passportPath));

// Form 4 scan: always under attachments/form4scan (unless already full path)
const scanRaw = merged.ImageName;
const scanPath = ensureFolderPath(FORM4_SCAN_FOLDER, scanRaw);
setScanUrl(await resolveStorageUrl(scanPath));

setAttachmentPreviews((prev) => ({ ...prev, ...previewMap }));
      } catch (e: any) {
        setError(e?.message || "Failed to load details");
      } finally {
        setLoading(false);
      }
    })();
  }, [irnNum]);

  // -------------------- UI bits --------------------
  const tabs = useMemo(
    () => [
      "Deceased Worker Details",
      "Employment and Injury Details",
      "Worker History",
      "Spouse Details",
      "Dependant Details",
      "Other Dependants",
      "Nominee Details",
      "Compensation Claimed",
      "Insurance Details",
      "Applicant Details",
      "Scanned Image",
      "Supporting Documents",
    ],
    []
  );

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    variant === "embedded" ? (
      <div className={className}>{children}</div>
    ) : (
      <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl shadow-xl">
          {children}
        </div>
      </div>
    );

  // -------------------- Renderers (only style changes; fields unchanged) --------------------
  const renderWorkerDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Deceased Worker Details</h3>

      <div className="flex items-start gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerFirstName)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerLastName)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Alias Name</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerAliasName) || "N/A"}</p>
          </div>
        </div>

  {/* Passport with label + placeholder */}
  <div className="shrink-0">
    <label className="block text-sm font-medium text-gray-700 mb-1">Passport Photo</label>
    {passportUrl ? (
      <img
        src={passportUrl}
        alt="Worker Passport"
        className="w-24 h-24 md:w-28 md:h-28 rounded-lg border object-cover cursor-zoom-in"
        onClick={() => setLightboxSrc(passportUrl)}
        loading="lazy"
      />
    ) : (
      <div className="w-24 h-24 md:w-28 md:h-28 rounded-lg border grid place-content-center text-xs text-gray-500 bg-gray-50">
        No photo
      </div>
    )}
  </div>
			</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{dateStr(formData.WorkerDOB) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerGender) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.WorkerMarried === "1" ? "Married" : formData.WorkerMarried === "0" ? "Single" : safe(formData.WorkerMarried) || "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerAddress1) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerAddress2) || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerCity) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerProvince) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerPOBox) || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerEmail) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerMobile) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerLandline) || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Village</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerPlaceOfOriginVillage) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin District</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerPlaceOfOriginDistrict) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Province</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.WorkerPlaceOfOriginProvince) || "N/A"}</p>
        </div>
      </div>
    </div>
  );

  // Keep existing content for other tabs; we only change visuals for Scan & Supporting Docs
  const renderScannedImage = () => (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-primary">Scanned Image</h3>
      {scanUrl ? (
        isImagePath(scanUrl) ? (
          <img
            src={scanUrl}
            alt="Form 4 Scan"
            className="max-h-[70vh] w-full object-contain rounded-lg border cursor-zoom-in bg-white"
            onClick={() => setLightboxSrc(scanUrl)}
            loading="lazy"
          />
        ) : (
          <a
            className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            href={scanUrl}
            target="_blank"
            rel="noreferrer"
          >
            View / Download Scan
          </a>
        )
      ) : (
        <div className="p-3 rounded bg-gray-50 border text-sm text-gray-600">No scan uploaded.</div>
      )}
    </div>
  );

  // UPDATED: Supporting Documents — style-only (bordered tiles)
const renderSupportingDocuments = () => (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold text-primary">Supporting Documents</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ATTACH_KEYS.map(({ key, label }) => {
        const url = attachmentPreviews[key];
        const storedPath = safe((formData as any)[key]);

        return (
          <div
            key={key}
            className="space-y-2 rounded-lg border border-gray-200 p-3 bg-white"
          >
            <label className="block text-sm font-medium text-gray-700">
              {label}
            </label>

            {!storedPath ? (
              <div className="text-xs text-gray-500">Not provided.</div>
            ) : url ? (
              isImagePath(url) ? (
                <img
                  src={url}
                  alt={label}
                  className="w-28 h-28 object-cover rounded border cursor-zoom-in"
                  onClick={() => setLightboxSrc(url)}
                  loading="lazy"
                />
              ) : (
                <a
                  className="text-primary hover:underline text-sm break-all"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open current file
                </a>
              )
            ) : (
              <div className="text-xs text-gray-500">Uploaded (preview unavailable).</div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);


  // --- Stub renderers for the other tabs (unchanged fields / simple read-only) ---
  const renderEmploymentInjuryDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Employment and Injury Details</h3>
{/* NEW: ReceivedDate (from form1112master) */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700">Form Received Date</label>
    <p className="mt-1 p-2 border rounded-md bg-gray-50">
      {formData.ReceivedDate ? new Date(formData.ReceivedDate).toLocaleDateString() : "N/A"}
    </p>
  </div>
</div>
			
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Employment</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.PlaceOfEmployment) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.NatureOfEmployment) || "N/A"}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Death</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{dateStr(formData.IncidentDate) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Death</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.IncidentLocation) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Annual Earnings at Death</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.AnnualEarningsAtDeath) || "N/A"}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Province</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.IncidentProvince) || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Region</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.IncidentRegion) || "N/A"}</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nature and Extent of Injury</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.NatureExtentInjury) || "N/A"}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.InjuryCause) || "N/A"}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description of Incident</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.IncidentDescription) || "N/A"}</p>
      </div>
    </div>
  );

  // You can keep your existing detailed renderers for these; unchanged fields.
  const renderWorkerHistory = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">Worker History</h3>
      {workHistory.length === 0 ? (
        <div className="p-4 bg-gray-100 rounded-md text-gray-700">No work history records found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
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
        </div>
      )}
    </div>
  );

  const renderSpouseDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Spouse Details</h3>
      {formData.WorkerMarried !== "1" ? (
        <div className="p-4 bg-gray-100 rounded-md text-gray-700">Worker was not married. No spouse details available.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.SpouseFirstName) || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.SpouseLastName) || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{dateStr(formData.SpouseDOB) || "N/A"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Spouse Address Line 1</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.SpouseAddress1) || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Spouse Address Line 2</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.SpouseAddress2) || "N/A"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.SpouseCity) || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.SpouseProvince) || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(formData.SpousePOBox) || "N/A"}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderDependantDetails = () => {
    const childDeps = dependants.filter((d) => String(d.DependantType).toLowerCase() === "child");
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">Dependant Details</h3>
        {childDeps.length === 0 ? (
          <div className="p-4 bg-gray-100 rounded-md text-gray-700">No child dependants found for this worker.</div>
        ) : (
          <div className="space-y-4">
            {childDeps.map((d, i) => (
              <div key={i} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <Field label="First Name" value={d.DependantFirstName} />
                  <Field label="Last Name" value={d.DependantLastName} />
                  <Field label="Date of Birth" value={dateStr(d.DependantDOB)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Type" value={d.DependantType} />
                  <Field label="Gender" value={d.DependantGender} />
                  <Field label="Degree of Dependance" value={d.DependanceDegree} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderOtherDependants = () => {
    const others = dependants.filter((d) => ["sibling", "parent"].includes(String(d.DependantType).toLowerCase()));
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">Other Dependants</h3>
        {others.length === 0 ? (
          <div className="p-4 bg-gray-100 rounded-md text-gray-700">No other dependants (siblings or parents) found.</div>
        ) : (
          <div className="space-y-4">
            {others.map((d, i) => (
              <div key={i} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <Field label="First Name" value={d.DependantFirstName} />
                  <Field label="Last Name" value={d.DependantLastName} />
                  <Field label="Date of Birth" value={dateStr(d.DependantDOB)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Type" value={d.DependantType} />
                  <Field label="Gender" value={d.DependantGender} />
                  <Field label="Degree of Dependance" value={d.DependanceDegree} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderNomineeDetails = () => {
    const nominees = dependants.filter((d) => String(d.DependantType).toLowerCase() === "nominee");
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-primary">Nominee Details</h3>
        {nominees.length === 0 ? (
          <div className="p-4 bg-gray-100 rounded-md text-gray-700">No nominees found for this worker.</div>
        ) : (
          <div className="space-y-4">
            {nominees.map((d, i) => (
              <div key={i} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <Field label="First Name" value={d.DependantFirstName} />
                  <Field label="Last Name" value={d.DependantLastName} />
                  <Field label="Date of Birth" value={dateStr(d.DependantDOB)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Type" value={d.DependantType} />
                  <Field label="Gender" value={d.DependantGender} />
                  <Field label="Degree of Dependance" value={d.DependanceDegree} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCompensationClaimed = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">Compensation Claimed</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Annual Earnings at Death" value={formData.AnnualEarningsAtDeath} />
        <Field label="Benefits Prior To Death" value={formData.CompensationBenefitsPriorToDeath} />
        <Field label="Compensation Claimed" value={formData.CompensationClaimed} />
      </div>
      <FieldArea label="Benefit Details" value={formData.CompensationBenefitDetails} />
      <FieldArea label="Medical Expense Details" value={formData.MedicalExpenseDetails} />
      <FieldArea label="Funeral Expense Details" value={formData.FuneralExpenseDetails} />
    </div>
  );

  const renderInsuranceDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">Insurance Details</h3>
      <Field label="Insurance Provider IPA Code" value={formData.InsuranceProviderIPACode} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Company Name" value={formData.InsuranceCompanyOrganizationName} />
        <Field label="City" value={formData.InsuranceCompanyCity} />
        <Field label="Province" value={formData.InsuranceCompanyProvince} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Address 1" value={formData.InsuranceCompanyAddress1} />
        <Field label="Address 2" value={formData.InsuranceCompanyAddress2} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="P.O. Box" value={formData.InsuranceCompanyPOBox} />
        <Field label="Landline" value={formData.InsuranceCompanyLandLine} />
        <Field label="Display IRN" value={formData.DisplayIRN} />
      </div>
    </div>
  );

  const renderApplicantDetails = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">Applicant Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="First Name" value={formData.ApplicantFirstName} />
        <Field label="Last Name" value={formData.ApplicantLastName} />
        <Field label="Email" value={formData.ApplicantEmail} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Address 1" value={formData.ApplicantAddress1} />
        <Field label="Address 2" value={formData.ApplicantAddress2} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="City" value={formData.ApplicantCity} />
        <Field label="Province" value={formData.ApplicantProvince} />
        <Field label="P.O. Box" value={formData.ApplicantPOBox} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Mobile" value={formData.ApplicantMobile} />
        <Field label="Landline" value={formData.ApplicantLandline} />
        <Field label="IRN" value={formData.DisplayIRN} />
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (currentTab) {
      case 1:  return renderWorkerDetails();
      case 2:  return renderEmploymentInjuryDetails();
      case 3:  return renderWorkerHistory();
      case 4:  return renderSpouseDetails();
      case 5:  return renderDependantDetails();
      case 6:  return renderOtherDependants();
      case 7:  return renderNomineeDetails();
      case 8:  return renderCompensationClaimed();
      case 9:  return renderInsuranceDetails();
      case 10: return renderApplicantDetails();
      case 11: return renderScannedImage();           // UPDATED style/preview
      case 12: return renderSupportingDocuments();    // UPDATED style/preview
      default: return null;
    }
  };

  // -------------------- render --------------------
  if (loading) {
    return (
      <Wrapper>
        <div className="p-6">
          <div className="animate-pulse text-sm text-gray-600">Loading…</div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* header */}
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h2 className="text-xl font-semibold text-gray-900">
          View Form 4 (Read-only)
        </h2>
        {variant === "modal" && (
          <button className="p-2 rounded hover:bg-gray-100 transition" onClick={handleClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* error */}
      {error && (
        <div className="px-5 py-3 border-b bg-red-50 text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* tabs */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
        <div className="flex overflow-x-auto gap-1">
          {tabs.map((t, i) => {
            const idx = i + 1;
            const active = currentTab === idx;
            return (
              <button
                key={t}
                onClick={() => setCurrentTab(idx)}
                className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap border ${
                  active ? "bg-white border-gray-300 shadow-sm font-medium" : "bg-gray-100 hover:bg-gray-200 border-transparent"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded border hover:bg-gray-50"
            onClick={() => setCurrentTab(Math.max(1, currentTab - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded border hover:bg-gray-50"
            onClick={() => setCurrentTab(Math.min(tabs.length, currentTab + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* body */}
      <div
        className={`${
          variant === "modal" ? "overflow-y-auto max-h-[calc(95vh-56px-48px)]" : ""
        } p-5`}
      >
        {renderTabContent()}
      </div>

      {/* lightbox */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} /> }
    </Wrapper>
  );
};

// Small read-only field helpers to keep markup tidy
const Field: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <p className="mt-1 p-2 border rounded-md bg-gray-50">{safe(value) || "N/A"}</p>
  </div>
);

const FieldArea: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <p className="mt-1 p-2 border rounded-md bg-gray-50 whitespace-pre-line">{safe(value) || "N/A"}</p>
  </div>
);

export default Form124View;
