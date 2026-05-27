import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { supabase } from "../../services/supabase";

interface Form113ViewProps {
  irn?: string | number;
  onClose?: () => void;
  variant?: "modal" | "embedded";
  className?: string;
}

// ---------- helpers (aligned with ViewForm3) ----------
const normalizeStoragePath = (p?: string) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  let s = p.replace(/^\/+/, "");
  s = s.replace(/^(?:cpps\/+)+/i, "");
  return s;
};
const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || "");
const safe = (val: any) => (val ?? "").toString();
const dateStr = (val: any) => (val ? new Date(val).toLocaleDateString() : "");

// Resolve storage path to a browser-usable URL
const resolveStorageUrl = async (rawPath?: string): Promise<string> => {
  try {
    if (!rawPath) return "";
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const path = normalizeStoragePath(rawPath);
    if (!path) return "";
    const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    const { data: signed } = await supabase.storage
      .from("cpps")
      .createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl || "";
  } catch {
    return "";
  }
};

// === Folder mappings (from EditForm11/12) ===
const INJURY_FOLDER_MAP: Record<string, string> = {
  "Interim medical report": "attachments/formattachments/IMR/",
  "Final medical report": "attachments/formattachments/FMR/",
  "Section 43 application form": "attachments/formattachments/SEC43/",
  "Supervisor statement": "attachments/formattachments/Supervisorstatement/",
  "Witness statement": "attachments/formattachments/Witnessstatement/",
  "Injured worker's statement": "attachments/formattachments/Injuredworkerstatement/",
  "Injured workers statement": "attachments/formattachments/Injuredworkerstatement/", // variant
  "Payslip at time of accident": "attachments/formattachments/Payslipattimeofaccident/",
  "Payslip at the time of accident":
    "attachments/formattachments/Payslipattimeofaccident/", // variant
  "Treatment records": "attachments/formattachments/Treatmentrecords/",
  "Police accident report": "attachments/formattachments/Policeaccidentreport/",
  "Form 18 Scan": "attachments/formattachments/Form18Scan/",
  "MedicalExpenses": "attachments/formattachments/MedicalExpenses/",
  "MiscExpenses": "attachments/formattachments/MiscExpenses/",
  "Deductions": "attachments/formattachments/Deductions/",
};
const FORM3_SCAN_FOLDER = "attachments/form3scan/";
const PASSPORT_FOLDER = "attachments/workerpassportphotos/";

// If DB gives just "file.ext", add base; if already contains "/", leave as-is.
const ensurePrefixed = (maybeFile: string | undefined, baseFolder: string) => {
  if (!maybeFile) return "";
  return maybeFile.includes("/") ? maybeFile : `${baseFolder}${maybeFile}`;
};

// Given an attachmentType + filename, produce the full storage path for INJURY set
const pathForInjuryAttachment = (attachmentType: string, filename?: string) => {
  const base = INJURY_FOLDER_MAP[attachmentType];
  if (!base) return filename || "";
  return ensurePrefixed(filename, base);
};

// map attachment display names -> keys (Form 3 / Injury set)
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
  "Injured workers statement": "IWS", // allow variant
  "Payslip at time of accident": "PTA",
  "Payslip at the time of accident": "PTA", // allow variant
  "Treatment records": "TR",
  "Police accident report": "PAR",
  "Form 18 Scan": "F18",
  "MedicalExpenses": "MEX",
  "MiscExpenses": "MISC",
  "Deductions": "DED",
};

// ---------- simple lightbox ----------
const Lightbox: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({
  src,
  alt,
  onClose,
}) => {
  if (!src) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ pointerEvents: "auto" }}
    >
      <img
        src={src}
        alt={alt || "preview"}
        className="max-h-[90vh] max-w-[95vw] rounded shadow-2xl cursor-zoom-out"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
};

const Form113View: React.FC<Form113ViewProps> = ({
  irn,
  onClose,
  variant = "embedded",
  className,
}) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);

  // previews
  const [passportUrl, setPassportUrl] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string>("");

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) form3master
        const { data: form3Data, error: form3Error } = await supabase
          .from("form3master")
          .select("*")
          .eq("IRN", irn)
          .maybeSingle();
        if (form3Error) throw form3Error;

        // 2) 11/12 snapshot (includes ImageName/PublicUrl)
        const { data: f1112, error: f1112Err } = await supabase
          .from("form1112master")
          .select("*")
          .eq("IRN", irn)
          .maybeSingle();
        if (f1112Err) throw f1112Err;
        if (!f1112) throw new Error("Form data not found");

        // 3) worker personal
        const { data: worker, error: workerErr } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", f1112.WorkerID)
          .maybeSingle();
        if (workerErr) throw workerErr;
        if (!worker) throw new Error("Worker details not found");

        // 4) employment snapshot
        const { data: employment } = await supabase
          .from("currentemploymentdetails")
          .select("*")
          .eq("WorkerID", f1112.WorkerID)
          .maybeSingle();

        // 5) dependants
        const { data: dependantRows, error: depErr } = await supabase
          .from("dependantpersonaldetails")
          .select("*")
          .eq("WorkerID", f1112.WorkerID);
        if (depErr) throw depErr;
        setDependants(dependantRows || []);

        // 6) work history
        const { data: historyRows, error: histErr } = await supabase
          .from("workhistory")
          .select("*")
          .eq("WorkerID", f1112.WorkerID);
        if (histErr) throw histErr;
        setWorkHistory(historyRows || []);

        // 7) insurance details by IPA
        let insuranceDetails: any = null;
        if (f1112.InsuranceProviderIPACode) {
          const { data: insData } = await supabase
            .from("insurancecompanymaster")
            .select("*")
            .eq("IPACODE", f1112.InsuranceProviderIPACode)
            .maybeSingle();
          if (insData) insuranceDetails = insData;
        }

        // 8) attachments (supporting docs)
        const { data: attachments } = await supabase
          .from("formattachments")
          .select("AttachmentType, FileName")
          .eq("IRN", irn);

        const attachPaths: Record<string, string> = {};
        const previewMap: Record<string, string> = {};

        for (const r of attachments || []) {
          const type = (r as any).AttachmentType as string;
          const key = ATTACH_TYPE_TO_KEY[type];
          const file = (r as any).FileName as string;
          if (!key || !file) continue;

          // keep raw DB value for display
          attachPaths[key] = file;

          // build correct full path and resolve to preview URL
          const fullPath = pathForInjuryAttachment(type, file);
          const url = await resolveStorageUrl(fullPath);
          if (url) previewMap[key] = url;
        }

        // 9) merge
        const merged = {
          ...(f1112 || {}),
          ...(worker || {}),
          ...(employment || {}),
          ...(form3Data || {}),

          // supporting docs (raw filenames for display)
          ...attachPaths,

          insurance: insuranceDetails,
          hasWorkHistory: (historyRows || []).length > 0,
          hasDependants: (dependantRows || []).length > 0,
        };

        setFormData(merged);

        // ---- resolve previews with correct base folders ----
        // Passport photo
        const passportCandidate = ensurePrefixed(
          merged.WorkerPassportPhoto,
          PASSPORT_FOLDER
        );
        setPassportUrl(await resolveStorageUrl(passportCandidate));

        // Form 3 scan
        const rawScan = (merged.PublicUrl || merged.ImageName) as string | undefined;
        const scanCandidate = ensurePrefixed(rawScan, FORM3_SCAN_FOLDER);
        setScanUrl(await resolveStorageUrl(scanCandidate));

        // Supporting docs preview URLs
        setAttachmentPreviews((prev) => ({ ...prev, ...previewMap }));
      } catch (err: any) {
        console.error("Error fetching form data:", err);
        setError(err.message || "Failed to load form data");
      } finally {
        setLoading(false);
      }
    };

    if (irn != null) fetchFormData();
    else setLoading(false);
  }, [irn]);

  const tabs = [
    "Worker Personal Details",
    "Spouse Details",
    "Dependent Details",
    "Current Employment Details",
    "Injury & Capacity",
    "Compensation Claimed",
    "Insurance Details",
    "Details of Applicant",
    "Scanned Image",
    "Supporting Documents",
  ];

  const handleTabChange = (tabIndex: number) => setCurrentTab(tabIndex);

  // ------------ renderers (fields unchanged; passport/scan/docs modernized) ------------
  const renderWorkerDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Worker Personal Details</h3>

   {/* Passport (from storage + zoom) */}
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700">Passport Photo</label>

  {passportUrl ? (
    <img
      src={passportUrl}
      alt="Worker passport photo"
      className="mt-1 w-28 h-28 object-cover border rounded-md cursor-zoom-in"
      onClick={() => setLightboxSrc(passportUrl)}
      loading="lazy"
    />
  ) : (
    <div className="mt-1 w-28 h-28 rounded-md border grid place-content-center text-xs text-gray-500 bg-gray-50">
      No photo
    </div>
  )}
</div>

      {/* Existing fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerFirstName}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerLastName}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.WorkerDOB ? new Date(formData.WorkerDOB).toLocaleDateString() : "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.WorkerGender === "M"
              ? "Male"
              : formData.WorkerGender === "F"
              ? "Female"
              : "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.WorkerMarried === "1" ? "Married" : "Single"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Dominant Hand</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerHanded || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Village</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerPlaceOfOriginVillage || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin District</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerPlaceOfOriginDistrict || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Province</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerPlaceOfOriginProvince || "N/A"}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerAddress1 || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerAddress2 || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerCity || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerProvince || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerPOBox || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerEmail || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerMobile || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.WorkerLandline || "N/A"}</p>
        </div>
      </div>
    </div>
  );

  const renderSpouseDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Spouse Details</h3>
      {formData.WorkerMarried !== "1" ? (
        <div className="p-4 bg-gray-100 rounded-md">
          <p className="text-gray-700">Worker is not married. No spouse details available.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpouseFirstName || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.SpouseLastName || "N/A"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpouseAddress1 || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text sm font-medium text-gray-700">Address Line 2</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpouseAddress2 || "N/A"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.SpouseCity || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpouseProvince || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.SpousePOBox || "N/A"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.SpouseEmail || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mobile</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.SpouseMobile || "N/A"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Landline</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpouseLandline || "N/A"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Place of Origin Village
              </label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpousePlaceOfOriginVillage || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Place of Origin District
              </label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpousePlaceOfOriginDistrict || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Place of Origin Province
              </label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SpousePlaceOfOriginProvince || "N/A"}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderDependantDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Dependant Details</h3>
      {dependants.length === 0 ? (
        <div className="p-4 bg-gray-100 rounded-md">
          <p className="text-gray-700">No dependants found for this worker.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dependants.map((dependant, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-primary mb-3">Dependant #{index + 1}</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantFirstName || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantLastName || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantDOB
                      ? new Date(dependant.DependantDOB).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantType || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantGender === "M"
                      ? "Male"
                      : dependant.DependantGender === "F"
                      ? "Female"
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Degree of Dependance
                  </label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependanceDegree || "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantAddress1 || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantAddress2 || "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantCity || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Province</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantProvince || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {dependant.DependantPOBox || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Current Employment Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employment ID</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.EmploymentID || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.Occupation || "N/A"}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Place of Employment</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.PlaceOfEmployment || "N/A"}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.NatureOfEmployment || "N/A"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.AverageWeeklyWage || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Earnable Amount</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.AverageEarnableAmount || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Allowance Received</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.AllowanceReceived || "N/A"}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-medium text-primary mb-3">Subcontractor Information</h4>

        {formData.WorkedUnderSubContractor ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <p className="mt-1 p-2 border rounded-md bg-gray-50">
                  {formData.SubContractorOrganizationName || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <p className="mt-1 p-2 border rounded-md bg-gray-50">
                  {formData.SubContractorLocation || "N/A"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">Nature of Business</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.SubContractorNatureOfBusiness || "N/A"}
              </p>
            </div>
          </>
        ) : (
          <div className="p-4 bg-gray-100 rounded-md">
            <p className="text-gray-700">Worker did not work under a subcontractor.</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h4 className="font-medium text-primary mb-3">Work History</h4>

        {workHistory.length === 0 ? (
          <div className="p-4 bg-gray-100 rounded-md">
            <p className="text-gray-700">No work history records found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workHistory.map((history, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <h5 className="font-medium mb-2">Organization #{index + 1}</h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Organization Name
                    </label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">CPPSID</label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationCPPSID || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Address Line 1
                    </label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationAddress1 || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Address Line 2
                    </label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationAddress2 || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City</label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationCity || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Province</label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationProvince || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationPOBox || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Joining Date</label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.WorkerJoiningDate
                        ? new Date(history.WorkerJoiningDate).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Leaving Date</label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.WorkerLeavingDate
                        ? new Date(history.WorkerLeavingDate).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Landline</label>
                    <p className="mt-1 p-2 border rounded-md bg-white">
                      {history.OrganizationLandline || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderInjuryDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Injury & Capacity</h3>

   {/* NEW: ReceivedDate + BodyPart (from form1112master) */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Form Received Date</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">
          {formData.ReceivedDate ? new Date(formData.ReceivedDate).toLocaleDateString() : "N/A"}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Body Part</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">
          {formData.BodyPart || "N/A"}
        </p>
      </div>
    </div>
			
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Date</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.IncidentDate ? new Date(formData.IncidentDate).toLocaleDateString() : "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Province</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.IncidentProvince || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Region</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.IncidentRegion || "N/A"}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description of Incident</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">
          {formData.IncidentDescription || "N/A"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nature & Extent of Injury</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.NatureExtentInjury || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Injury Cause</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.InjuryCause || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Hand Injury</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.HandInjury ? "Yes" : "No"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Injury due to Machinery</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.InjuryMachinery ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {formData.InjuryMachinery && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Type</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.MachineType || "N/A"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Part Responsible</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">
              {formData.MachinePartResponsible || "N/A"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Machine Power Source</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">
              {formData.MachinePowerSource || "N/A"}
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Description of Disabilities</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">
          {formData.DisabilitiesDescription || "N/A"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Extent of Incapacity</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">{formData.IncapacityExtent || "N/A"}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Estimated Duration of Incapacity
          </label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.EstimatedIncapacityDuration || "N/A"}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description of Incapacity</label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">
          {formData.IncapacityDescription || "N/A"}
        </p>
      </div>
    </div>
  );

  const renderCompensationDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Compensation Claimed</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Details of Compensation Claimed
        </label>
        <p className="mt-1 p-2 border rounded-md bg-gray-50">
          {formData.CompensationClaimDetails || "N/A"}
        </p>
      </div>
    </div>
  );

  const renderInsuranceDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Insurance Details</h3>
      {!formData.insurance ? (
        <div className="p-4 bg-gray-100 rounded-md">
          <p className="text-gray-700">No insurance details available.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Company Name</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">
              {formData.insurance.InsuranceCompanyOrganizationName || "N/A"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.insurance.InsuranceCompanyAddress1 || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.insurance.InsuranceCompanyAddress2 || "N/A"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.insurance.InsuranceCompanyCity || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.insurance.InsuranceCompanyProvince || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
              <p className="mt-1 p-2 border rounded-md bg-gray-50">
                {formData.insurance.InsuranceCompanyPOBox || "N/A"}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Landline</label>
            <p className="mt-1 p-2 border rounded-md bg-gray-50">
              {formData.insurance.InsuranceCompanyLandLine || "N/A"}
            </p>
          </div>
        </>
      )}
    </div>
  );

  // UPDATED: Form 3 Scan (image preview or external link)
  const renderScannedImage = () => {
    const label = "Form 3 Scan";
    const hasImage = !!scanUrl && isImagePath(scanUrl);

    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-primary">Scanned Image</h3>
        <label className="block text-sm font-medium text-gray-700">{label}</label>

        {scanUrl ? (
          hasImage ? (
            <img
              src={scanUrl}
              className="w-32 h-32 rounded border object-cover cursor-zoom-in"
              onClick={() => setLightboxSrc(scanUrl)}
              alt={label}
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

  // UPDATED: Supporting Documents (injury set)
  const renderSupportingDocuments = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary">Supporting Documents</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ATTACH_KEYS.map(({ key, label }) => {
          const pathVal = safe((formData as any)[key]);
          const preview = attachmentPreviews[key];
          const hasPreview = !!preview;

          return (
            <div
              key={key}
              className="space-y-2 rounded-lg border border-gray-200 p-3 bg-white"
            >
              <label className="block text-sm font-medium text-gray-700">{label}</label>

              {hasPreview ? (
                isImagePath(preview) ? (
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
                <div className="text-xs text-gray-500 break-all">
                  Attached (unresolved path): {pathVal}
                </div>
              ) : (
                <div className="text-xs text-gray-500">Not attached</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderApplicantDetails = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-primary">Details of Applicant</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantFirstName || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantLastName || "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantAddress1 || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantAddress2 || "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantCity || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantProvince || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text sm font-medium text-gray-700">P.O. Box</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantPOBox || "N/A"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text sm font-medium text-gray-700">Email</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantEmail || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text sm font-medium text-gray-700">Mobile</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantMobile || "N/A"}
          </p>
        </div>
        <div>
          <label className="block text sm font-medium text-gray-700">Landline</label>
          <p className="mt-1 p-2 border rounded-md bg-gray-50">
            {formData.ApplicantLandline || "N/A"}
          </p>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (currentTab) {
      case 1:
        return renderWorkerDetails();
      case 2:
        return renderSpouseDetails();
      case 3:
        return renderDependantDetails();
      case 4:
        return renderEmploymentDetails();
      case 5:
        return renderInjuryDetails();
      case 6:
        return renderCompensationDetails();
      case 7:
        return renderInsuranceDetails();
      case 8:
        return renderApplicantDetails();
      case 9:
        return renderScannedImage();
      case 10:
        return renderSupportingDocuments();
      default:
        return <div>Invalid tab</div>;
    }
  };

  // ------------ UI ------------
  if (variant === "modal") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-gray-900">View Form 3 (Read-only)</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto max-h-[calc(92vh-56px)]">
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 p-4 text-red-700 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-wrap gap-2">
                    {tabs.map((t, idx) => (
                      <button
                        key={t}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${
                          currentTab === idx + 1
                            ? "bg-primary text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        onClick={() => handleTabChange(idx + 1)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded border hover:bg-gray-50"
                      onClick={() => handleTabChange(Math.max(1, currentTab - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 rounded border hover:bg-gray-50"
                      onClick={() => handleTabChange(Math.min(tabs.length, currentTab + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2">{renderTabContent()}</div>
              </>
            )}
          </div>
        </div>

        {/* Lightbox (portal) */}
        {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} />}
      </div>
    );
  }

  // Embedded (inline) shell
  return (
    <div className={className ?? ""}>
      <div className="bg-white rounded-2xl shadow-sm border">
        {/* Header (no close button for inline) */}
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <h2 className="text-xl font-semibold text-gray-900">View Form 3 (Read-only)</h2>
        </div>

        {/* Body (no viewport-constrained heights) */}
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 text-red-700 bg-red-50 border border-red-200 rounded">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((t, idx) => (
                    <button
                      key={t}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        currentTab === idx + 1 ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => handleTabChange(idx + 1)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded border hover:bg-gray-50"
                    onClick={() => handleTabChange(Math.max(1, currentTab - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 rounded border hover:bg-gray-50"
                    onClick={() => handleTabChange(Math.min(tabs.length, currentTab + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2">{renderTabContent()}</div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox (portal) */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} />}
    </div>
  );
};

export default Form113View;
