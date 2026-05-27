// src/components/forms/ViewForm4.tsx
import React, { useEffect, useMemo, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { supabase } from "../../services/supabase";

interface ViewForm4Props {
  workerIRN: number;
  onClose?: () => void;                 // optional when embedded
  variant?: "modal" | "embedded";       // default 'modal'
  className?: string;                   // wrapper class when embedded
}

// ---------- helpers ----------
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

// Resolve storage path to a browser-usable URL
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

// -------------------- attachments (Form 4: death) --------------------
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

const ATTACH_TYPE_TO_KEY: Record<string, string> = Object.fromEntries(
  ATTACH_KEYS.map((a) => [a.type, a.key])
);

// ---------- simple lightbox ----------
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
const ViewForm4: React.FC<ViewForm4Props> = ({
  workerIRN,
  onClose,
  variant = "modal",
  className,
}) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [dependantsPCS, setDependantsPCS] = useState<any[]>([]); // parent/child/sibling
  const [otherDependants, setOtherDependants] = useState<any[]>([]);
  const [nominees, setNominees] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // previews
  const [passportUrl, setPassportUrl] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (workerIRN == null || Number.isNaN(workerIRN)) throw new Error("Invalid IRN");

        // 1) workerirn (for WorkerID)
        const { data: workerIrnData, error: workerIrnError } = await supabase
          .from("workerirn")
          .select("WorkerID, FirstName, LastName, DisplayIRN")
          .eq("IRN", workerIRN)
          .single();
        if (workerIrnError) throw workerIrnError;
        if (!workerIrnData) throw new Error("Worker not found");
        const wid = workerIrnData.WorkerID;

        // 2) form4master
        const { data: form4Row } = await supabase
          .from("form4master")
          .select("*")
          .eq("IRN", workerIRN)
          .maybeSingle();

        // 3) form1112master (incident & insurance code snapshot)
        const { data: f1112Row } = await supabase
          .from("form1112master")
          .select("IncidentDate, IncidentLocation, IncidentProvince, IncidentRegion, NatureExtentInjury, InjuryCause, InsuranceProviderIPACode")
          .eq("IRN", workerIRN)
          .maybeSingle();

        // 4) worker personal
        const { data: workerData } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", wid)
          .maybeSingle();

        // 5) employment snapshot
        const { data: employmentData } = await supabase
          .from("currentemploymentdetails")
          .select("*")
          .eq("WorkerID", wid)
          .maybeSingle();

        // 6) dependants
        const { data: dependantData } = await supabase
          .from("dependantpersonaldetails")
          .select("*")
          .eq("WorkerID", wid);

        // 7) work history
        const { data: historyData } = await supabase
          .from("workhistory")
          .select("*")
          .eq("WorkerID", wid);

        // 8) attachments
        const { data: attachRows } = await supabase
          .from("formattachments")
          .select("AttachmentType, FileName")
          .eq("IRN", workerIRN);

        // 9) insurance details by IPACODE
        let insuranceDetails: any = null;
        if (f1112Row?.InsuranceProviderIPACode) {
          const { data: insData } = await supabase
            .from("insurancecompanymaster")
            .select("*")
            .eq("IPACODE", f1112Row.InsuranceProviderIPACode)
            .maybeSingle();
          if (insData) insuranceDetails = insData;
        }

        // map attachments
        const attachPaths: Record<string, string> = {};
        const previewMap: Record<string, string> = {};
        for (const r of attachRows || []) {
          const key = ATTACH_TYPE_TO_KEY[(r as any).AttachmentType];
          const path = (r as any).FileName as string;
          if (!key || !path) continue;
          attachPaths[key] = path;
          const url = await resolveStorageUrl(path);
          if (url) previewMap[key] = url; // for both images and non-images; anchor will use this
        }

        // merge display data
        const merged = {
          ...(form4Row || {}),
          IRN: workerIRN,
          WorkerID: wid,
          DisplayIRN: workerIrnData.DisplayIRN,

          // worker
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
          SpouseAddress1: workerData?.SpouseAddress1 || "",
          SpouseAddress2: workerData?.SpouseAddress2 || "",
          SpouseCity: workerData?.SpouseCity || "",
          SpouseProvince: workerData?.SpouseProvince || "",
          SpousePOBox: workerData?.SpousePOBox || "",
          SpouseEmail: workerData?.SpouseEmail || "",
          SpouseMobile: workerData?.SpouseMobile || "",
          SpouseLandline: workerData?.SpouseLandline || "",

          // employment (readonly)
          EmployerID: employmentData?.EmployerID || "",
          EmployercppsID: employmentData?.EmployerCPPSID || "",
          Occupation: employmentData?.Occupation || "",
          PlaceOfEmployment: employmentData?.PlaceOfEmployment || "",
          NatureOfEmployment: employmentData?.NatureOfEmployment || "",
          AverageWeeklyWage: employmentData?.AverageWeeklyWage || 0,
          SubContractorOrganizationName: employmentData?.SubContractorOrganizationName || "",
          SubContractorLocation: employmentData?.SubContractorLocation || "",
          SubContractorNatureOfBusiness: employmentData?.SubContractorNatureOfBusiness || "",

          // incident snapshot
          IncidentDate: f1112Row?.IncidentDate || "",
          IncidentLocation: f1112Row?.IncidentLocation || "",
          IncidentProvince: f1112Row?.IncidentProvince || "",
          IncidentRegion: f1112Row?.IncidentRegion || "",
          NatureExtentInjury: f1112Row?.NatureExtentInjury || "",
          InjuryCause: f1112Row?.InjuryCause || "",

          // insurance (readonly)
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

          // form4master (death/claim)
          AnnualEarningsAtDeath: form4Row?.AnnualEarningsAtDeath || 0,
          CompensationBenefitsPriorToDeath: safe(form4Row?.CompensationBenefitsPriorToDeath),
          CompensationBenefitDetails: safe(form4Row?.CompensationBenefitDetails),
          CompensationClaimed: safe(form4Row?.CompensationClaimed),
          MedicalExpenseDetails: safe(form4Row?.MedicalExpenseDetails),
          FuneralExpenseDetails: safe(form4Row?.FuneralExpenseDetails),
          IncidentDescription: safe(form4Row?.IncidentDescription),

          // applicant
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

          // scan name
          ImageName: safe(form4Row?.Form4ImageName || form4Row?.ImageName || ""),
          // supporting docs (paths)
          ...attachPaths,
        };

        setFormData(merged);

        // partition dependants
        const typeOf = (x: any) => String(x?.DependantType || "").toLowerCase();
        setDependantsPCS((dependantData || []).filter((d: any) =>
          ["parent", "child", "sibling"].includes(typeOf(d))
        ));
        setOtherDependants((dependantData || []).filter((d: any) => typeOf(d) === "other"));
        setNominees((dependantData || []).filter((d: any) => typeOf(d) === "nominee"));

        setWorkHistory(historyData || []);

        // resolve previews
        const pUrl = await resolveStorageUrl(merged.WorkerPassportPhoto);
        setPassportUrl(pUrl);

        const sUrl = await resolveStorageUrl(merged.ImageName);
        setScanUrl(sUrl);

        setAttachmentPreviews((prev) => ({ ...prev, ...previewMap }));
      } catch (err: any) {
        setError(err.message || "Failed to load details");
      } finally {
        setLoading(false);
      }
    })();
  }, [workerIRN]);

  // ---------- renderers ----------
  const renderWorker = () => (
    <div className="space-y-4">
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">IRN</label>
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

  const renderEmploymentInjury = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Employment & Injury</h3>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature/Extent of Injury</label>
        <textarea value={safe(formData.NatureExtentInjury)} className="input" readOnly disabled rows={2} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Cause of Injury</label>
        <textarea value={safe(formData.InjuryCause)} className="input" readOnly disabled rows={2} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description of Incident</label>
        <textarea value={safe(formData.IncidentDescription)} className="input" readOnly disabled rows={4} />
      </div>
    </div>
  );

  const renderWorkHistory = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Work History</h3>
      {workHistory.length === 0 ? (
        <div className="p-4 text-gray-500 text-sm">No work history records found.</div>
      ) : (
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

  const renderSpouse = () => (
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

  const renderDependantsTable = (rows: any[], emptyText: string) => (
    rows.length === 0 ? (
      <div className="p-4 text-gray-500 text-sm">{emptyText}</div>
    ) : (
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
          {rows.map((d, i) => (
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
    )
  );

  const renderDependantsPCS = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Dependent Details (Parent / Child / Sibling)</h3>
      {renderDependantsTable(dependantsPCS, "No dependants recorded.")}
    </div>
  );

  const renderOtherDependants = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Other Dependants</h3>
      {renderDependantsTable(otherDependants, "No other dependants recorded.")}
    </div>
  );

  const renderNominees = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Nominee Details</h3>
      {renderDependantsTable(nominees, "No nominees recorded.")}
    </div>
  );

  const renderCompensation = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Compensation Claimed</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Annual Earnings at Death</label>
          <input value={safe(formData.AnnualEarningsAtDeath)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Benefits Prior To Death</label>
          <input value={safe(formData.CompensationBenefitsPriorToDeath)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Compensation Claimed</label>
          <input value={safe(formData.CompensationClaimed)} className="input" readOnly disabled />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Benefit Details</label>
        <textarea value={safe(formData.CompensationBenefitDetails)} className="input" rows={2} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Medical Expense Details</label>
        <textarea value={safe(formData.MedicalExpenseDetails)} className="input" rows={2} readOnly disabled />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Funeral Expense Details</label>
        <textarea value={safe(formData.FuneralExpenseDetails)} className="input" rows={2} readOnly disabled />
      </div>
    </div>
  );

  const renderInsurance = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Insurance Details</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider IPA Code</label>
        <input value={safe(formData.InsuranceProviderIPACode)} className="input" readOnly disabled />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Company Name</label>
          <input value={safe(formData.InsuranceCompanyOrganizationName)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input value={safe(formData.InsuranceCompanyCity)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input value={safe(formData.InsuranceCompanyProvince)} className="input" readOnly disabled />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address 1</label>
          <input value={safe(formData.InsuranceCompanyAddress1)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address 2</label>
          <input value={safe(formData.InsuranceCompanyAddress2)} className="input" readOnly disabled />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">PO Box</label>
          <input value={safe(formData.InsuranceCompanyPOBox)} className="input" readOnly disabled />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Landline</label>
        <input value={safe(formData.InsuranceCompanyLandLine)} className="input" readOnly disabled />
      </div>
    </div>
  );

  const renderApplicant = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Details of Applicant</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

  // Bigger, zoomable Form 4 scan (image or link)
const renderForm4Scan = () => {
  const hasImage =
    (!!scanUrl && isImagePath(formData?.ImageName)) ||
    (!!scanUrl && isImagePath(scanUrl));

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-primary">Form 4 Scan</h3>
      {scanUrl ? (
        hasImage ? (
          <img
            src={scanUrl}
            className="max-h-[70vh] w-full object-contain rounded-lg border cursor-zoom-in bg-white"
            onClick={() => setLightboxSrc(scanUrl)}
            alt="Form 4 Scan"
            loading="lazy"
          />
        ) : (
          <a
            href={scanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            View / Download Scan
          </a>
        )
      ) : (
        <div className="p-3 rounded bg-gray-50 border text-sm text-gray-600">
          No scan found
        </div>
      )}
    </div>
  );
};

// Card/tile style Supporting Documents (clear header, bordered tiles)
const renderSupportingDocuments = () => (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold text-primary">Supporting Documents</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {ATTACH_KEYS.map(({ key, label }) => {
        const pathVal = safe((formData as any)[key]);        // raw stored path
        const preview = attachmentPreviews[key];             // resolved URL (signed/public)
        const showAsImage =
          (pathVal && isImagePath(pathVal)) || (preview && isImagePath(preview));

        return (
          <div
            key={key}
            className="space-y-2 rounded-lg border border-gray-200 p-3 bg-white"
          >
            <label className="block text-sm font-medium text-gray-700">
              {label}
            </label>

            {!pathVal ? (
              <div className="text-xs text-gray-500">Not attached</div>
            ) : preview ? (
              showAsImage ? (
                <img
                  src={preview}
                  alt={`${label} preview`}
                  className="h-40 w-full object-cover rounded border cursor-zoom-in"
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
            ) : (
              // path exists but we could not resolve a URL => show raw path
              <div className="text-xs text-gray-500 break-all">
                Attached (unresolved path): {pathVal}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);


  // Tabs config
  const tabs = useMemo(
    () => [
      { name: "Deceased Worker Details", render: renderWorker },
      { name: "Employment & Injury", render: renderEmploymentInjury },
      { name: "Work History", render: renderWorkHistory },
      { name: "Spouse Details", render: renderSpouse },
      { name: "Dependent Details", render: renderDependantsPCS },
      { name: "Other Dependants", render: renderOtherDependants },
      { name: "Nominee Details", render: renderNominees },
      { name: "Compensation Claimed", render: renderCompensation },
      { name: "Insurance Details", render: renderInsurance },
      { name: "Details of Applicant", render: renderApplicant },
      { name: "Form 4 Scan", render: renderForm4Scan },
      { name: "Supporting Documents", render: renderSupportingDocuments },
    ],
    [attachmentPreviews, scanUrl, passportUrl, dependantsPCS, otherDependants, nominees, workHistory, formData]
  );

  const isModal = variant !== "embedded";

  return (
    <>
      {isModal ? (
        // ---------- MODAL VARIANT ----------
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto p-6">
            {onClose && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-2 right-2 text-gray-500 hover:text-black rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X size={28} />
              </button>
            )}

            <h2 className="text-2xl font-bold mb-2">View Form 4</h2>

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
                {/* Tabs — active: primary bg, others gray */}
                <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
                  {tabs.map((t, idx) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setCurrentTab(idx + 1)}
                      className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                        currentTab === idx + 1
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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

          {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} />}
        </div>
      ) : (
        // ---------- EMBEDDED VARIANT ----------
        <div className={className ?? ""}>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Form 4 Details</h2>
              {onClose && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="text-gray-600 hover:text-black"
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-40">
                <span className="text-gray-700">Loading...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center p-6 text-red-600">
                <AlertCircle size={40} />
                <span className="mt-3">{error}</span>
              </div>
            ) : (
              <>
                <div className="flex space-x-2 overflow-x-auto pb-3 mb-4">
                  {tabs.map((t, idx) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setCurrentTab(idx + 1)}
                      className={`px-3 py-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                        currentTab === idx + 1
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                <div className="py-1">{tabs[currentTab - 1].render()}</div>
              </>
            )}
          </div>

          {/* Keep lightbox usable even when embedded */}
          {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} />}
        </div>
      )}

      {/* shared input style */}
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
    </>
  );
};

export default ViewForm4;
