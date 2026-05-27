import React, { useEffect, useMemo, useState } from "react";
import { X, Printer } from "lucide-react";
import { supabase } from "../../services/supabase";

interface ViewWorkerRegistrationProps {
  onClose: () => void;
  /** REQUIRED: WorkerID to view */
  WorkerID: string | number;
}

interface FormData {
  // Worker Personal Details
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerAliasName: string;
  WorkerDOB: string;
  WorkerGender: string;
  WorkerMarried: string; // "1" | "0"
  WorkerHanded: string;
  WorkerPlaceOfOriginVillage: string;
  WorkerPlaceOfOriginDistrict: string;
  WorkerPlaceOfOriginProvince: string;
  WorkerPassportPhoto: string; // stored path or file name before upload
  WorkerAddress1: string;
  WorkerAddress2: string;
  WorkerCity: string;
  WorkerProvince: string;
  WorkerPOBox: string;
  WorkerEmail: string;
  WorkerMobile: string;
  WorkerLandline: string;

  // Spouse Details
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

  // Toggles
  WorkerHaveDependants: boolean;
  WorkerHasHistory: boolean;

  // Employment
  EmployerCPPSID: string;
  EmploymentID: string;
  Occupation: string;
  PlaceOfEmployment: string;
  NatureOfEmployment: string;
  AverageWeeklyWage: number | string;
  WeeklyPaymentRate: number | string;
  WorkedUnderSubContractor: boolean;
  SubContractorOrganizationName: string;
  SubContractorLocation: string;
  SubContractorNatureOfBusiness: string;
  OrganizationType: string;

  // Insurance keys
  InsuranceProviderIPACode: string;
  InsuranceIPACode: string;

  // Insurance details (resolved)
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;
}

interface DependantRow {
  DependantID?: number;
  DependantFirstName: string;
  DependantLastName: string;
  DependantDOB: string;
  DependantGender: string;
  DependantType: string;
  DependantAddress1: string;
  DependantAddress2: string;
  DependantCity: string;
  DependantProvince: string;
  DependantPOBox: string;
  DependantEmail: string;
  DependantMobile: string;
  DependantLandline: string;
  DependanceDegree: number | string;
  _id?: string;
}

interface WorkHistoryRow {
  WorkHistoryID?: number;
  OrganizationName: string;
  OrganizationAddress1: string;
  OrganizationAddress2: string;
  OrganizationCity: string;
  OrganizationProvince: string;
  OrganizationPOBox: string;
  OrganizationLandline: string;
  OrganizationCPPSID: string;
  WorkerJoiningDate: string;
  WorkerLeavingDate: string;
  _id?: string;
}

const yesNo = (v: any) => (typeof v === "boolean" ? (v ? "Yes" : "No") : v === "1" || v === "Yes" ? "Yes" : v === "0" || v === "No" ? "No" : v ? "Yes" : "No");
const marriedSingle = (v: string) => (v === "1" ? "Married" : "Single");
const fmtDate = (s: string) => (s ? String(s) : "—");
const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));

const ViewWorkerRegistration: React.FC<ViewWorkerRegistrationProps> = ({ onClose, WorkerID }) => {
  const workerIdMemo = useMemo(() => String(WorkerID), [WorkerID]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    WorkerFirstName: "",
    WorkerLastName: "",
    WorkerAliasName: "",
    WorkerDOB: "",
    WorkerGender: "M",
    WorkerMarried: "0",
    WorkerHanded: "Right",
    WorkerPlaceOfOriginVillage: "",
    WorkerPlaceOfOriginDistrict: "",
    WorkerPlaceOfOriginProvince: "",
    WorkerPassportPhoto: "",
    WorkerAddress1: "",
    WorkerAddress2: "",
    WorkerCity: "",
    WorkerProvince: "",
    WorkerPOBox: "",
    WorkerEmail: "",
    WorkerMobile: "",
    WorkerLandline: "",
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
    WorkerHasHistory: false,
    EmployerCPPSID: "",
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
    OrganizationType: "",
    InsuranceProviderIPACode: "",
    InsuranceIPACode: "",
    InsuranceCompanyOrganizationName: "",
    InsuranceCompanyAddress1: "",
    InsuranceCompanyAddress2: "",
    InsuranceCompanyCity: "",
    InsuranceCompanyProvince: "",
    InsuranceCompanyPOBox: "",
    InsuranceCompanyLandLine: "",
  });

  const [dependants, setDependants] = useState<DependantRow[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>([]);
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string>("");

  // Storage helpers (same logic as edit form)
  const parseStoragePath = (stored: string) => {
    if (!stored) return { bucket: "", path: "" };
    const firstSlash = stored.indexOf("/");
    if (firstSlash === -1) return { bucket: "cpps", path: stored };
    return { bucket: stored.slice(0, firstSlash), path: stored.slice(firstSlash + 1) };
  };
  const resolvePublicUrl = async (storedPath: string) => {
    const { bucket, path } = parseStoragePath(storedPath);
    if (!bucket || !path) {
      setPassportPhotoUrl("");
      return;
    }
    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) {
        setPassportPhotoUrl(data.publicUrl);
        return;
      }
      const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (!error && signed?.signedUrl) setPassportPhotoUrl(signed.signedUrl);
      else setPassportPhotoUrl("");
    } catch {
      setPassportPhotoUrl("");
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        setInitialLoading(true);

        // 1) Personal details
        const { data: wp, error: wpErr } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", workerIdMemo)
          .single();
        if (wpErr) throw wpErr;

        const next: FormData = {
          ...formData,
          WorkerFirstName: wp.WorkerFirstName || "",
          WorkerLastName: wp.WorkerLastName || "",
          WorkerAliasName: wp.WorkerAliasName || "",
          WorkerDOB: wp.WorkerDOB || "",
          WorkerGender: wp.WorkerGender || "M",
          WorkerMarried: wp.WorkerMarried ?? "0",
          WorkerHanded: wp.WorkerHanded || "Right",
          WorkerPlaceOfOriginVillage: wp.WorkerPlaceOfOriginVillage || "",
          WorkerPlaceOfOriginDistrict: wp.WorkerPlaceOfOriginDistrict || "",
          WorkerPlaceOfOriginProvince: wp.WorkerPlaceOfOriginProvince || "",
          WorkerPassportPhoto: wp.WorkerPassportPhoto || "",
          WorkerAddress1: wp.WorkerAddress1 || "",
          WorkerAddress2: wp.WorkerAddress2 || "",
          WorkerCity: wp.WorkerCity || "",
          WorkerProvince: wp.WorkerProvince || "",
          WorkerPOBox: wp.WorkerPOBox || "",
          WorkerEmail: wp.WorkerEmail || "",
          WorkerMobile: wp.WorkerMobile || "",
          WorkerLandline: wp.WorkerLandline || "",
          SpouseFirstName: wp.SpouseFirstName || "",
          SpouseLastName: wp.SpouseLastName || "",
          SpouseDOB: wp.SpouseDOB || "",
          SpousePlaceOfOriginVillage: wp.SpousePlaceOfOriginVillage || "",
          SpousePlaceOfOriginDistrict: wp.SpousePlaceOfOriginDistrict || "",
          SpousePlaceOfOriginProvince: wp.SpousePlaceOfOriginProvince || "",
          SpouseAddress1: wp.SpouseAddress1 || "",
          SpouseAddress2: wp.SpouseAddress2 || "",
          SpouseCity: wp.SpouseCity || "",
          SpouseProvince: wp.SpouseProvince || "",
          SpousePOBox: wp.SpousePOBox || "",
          SpouseEmail: wp.SpouseEmail || "",
          SpouseMobile: wp.SpouseMobile || "",
          SpouseLandline: wp.SpouseLandline || "",
        };

        // 2) Employment details
        const { data: ce, error: ceErr } = await supabase
          .from("currentemploymentdetails")
          .select("*")
          .eq("WorkerID", workerIdMemo)
          .maybeSingle();
        if (ceErr && ceErr.code !== "PGRST116") throw ceErr;

        if (ce) {
          next.EmployerCPPSID = ce.EmployerCPPSID || "";
          next.EmploymentID = ce.EmploymentID || "";
          next.Occupation = ce.Occupation || "";
          next.PlaceOfEmployment = ce.PlaceOfEmployment || "";
          next.NatureOfEmployment = ce.NatureOfEmployment || "";
          next.AverageWeeklyWage = ce.AverageWeeklyWage ?? 0;
          next.WeeklyPaymentRate = ce.WeeklyPaymentRate ?? 0;
          next.WorkedUnderSubContractor = (ce.WorkedUnderSubContractor || "No") === "Yes";
          next.SubContractorOrganizationName = ce.SubContractorOrganizationName || "";
          next.SubContractorLocation = ce.SubContractorLocation || "";
          next.SubContractorNatureOfBusiness = ce.SubContractorNatureOfBusiness || "";
          next.OrganizationType = ce.OrganizationType || "";
          next.InsuranceIPACode = ce.InsuranceIPACode || "";
          next.InsuranceProviderIPACode = ce.InsuranceIPACode || ""; // mirror for display
        }

        // 3) Dependants
        const { data: deps, error: depErr } = await supabase
          .from("dependantpersonaldetails")
          .select("*")
          .eq("WorkerID", workerIdMemo);
        if (depErr) throw depErr;
        const depRows: DependantRow[] = (deps || []).map((d: any) => ({
          _id: `${d.DependantID ?? d.id ?? Math.random()}`,
          DependantID: d.DependantID ?? d.id,
          DependantFirstName: d.DependantFirstName || "",
          DependantLastName: d.DependantLastName || "",
          DependantDOB: d.DependantDOB || "",
          DependantGender: d.DependantGender || "M",
          DependantType: d.DependantType || "Child",
          DependantAddress1: d.DependantAddress1 || "",
          DependantAddress2: d.DependantAddress2 || "",
          DependantCity: d.DependantCity || "",
          DependantProvince: d.DependantProvince || "",
          DependantPOBox: d.DependantPOBox || "",
          DependantEmail: d.DependantEmail || "",
          DependantMobile: d.DependantMobile || "",
          DependantLandline: d.DependantLandline || "",
          DependanceDegree: d.DependanceDegree ?? "",
        }));
        setDependants(depRows);
        next.WorkerHaveDependants = depRows.length > 0;

        // 4) Work history
        const { data: wh, error: whErr } = await supabase
          .from("workhistory")
          .select("*")
          .eq("WorkerID", workerIdMemo);
        if (whErr) throw whErr;
        const whRows: WorkHistoryRow[] = (wh || []).map((r: any) => ({
          _id: `${r.WorkHistoryID ?? r.id ?? Math.random()}`,
          WorkHistoryID: r.WorkHistoryID ?? r.id,
          OrganizationName: r.OrganizationName || "",
          OrganizationAddress1: r.OrganizationAddress1 || "",
          OrganizationAddress2: r.OrganizationAddress2 || "",
          OrganizationCity: r.OrganizationCity || "",
          OrganizationProvince: r.OrganizationProvince || "",
          OrganizationPOBox: r.OrganizationPOBox || "",
          OrganizationLandline: r.OrganizationLandline || "",
          OrganizationCPPSID: r.OrganizationCPPSID || "",
          WorkerJoiningDate: r.WorkerJoiningDate || "",
          WorkerLeavingDate: r.WorkerLeavingDate || "",
        }));
        setWorkHistory(whRows);
        next.WorkerHasHistory = whRows.length > 0;

        // 5) Resolve Insurance company by code (if present)
        if (next.InsuranceIPACode) {
          const { data: insurance, error: insuranceError } = await supabase
            .from("insurancecompanymaster")
            .select("*")
            .eq("IPACODE", next.InsuranceIPACode)
            .maybeSingle();
          if (!insuranceError && insurance) {
            next.InsuranceProviderIPACode = insurance.IPACODE || next.InsuranceIPACode;
            next.InsuranceCompanyOrganizationName = insurance.InsuranceCompanyOrganizationName || "";
            next.InsuranceCompanyAddress1 = insurance.InsuranceCompanyAddress1 || "";
            next.InsuranceCompanyAddress2 = insurance.InsuranceCompanyAddress2 || "";
            next.InsuranceCompanyCity = insurance.InsuranceCompanyCity || "";
            next.InsuranceCompanyProvince = insurance.InsuranceCompanyProvince || "";
            next.InsuranceCompanyPOBox = insurance.InsuranceCompanyPOBox || "";
            next.InsuranceCompanyLandLine = insurance.InsuranceCompanyLandLine || "";
          }
        }

        setFormData(next);
        if (next.WorkerPassportPhoto) resolvePublicUrl(next.WorkerPassportPhoto);
      } catch (err: any) {
        console.error("Failed to load worker view:", err);
        setError(err.message || "Failed to load worker data");
      } finally {
        setInitialLoading(false);
      }
    };

    load();
  }, [workerIdMemo]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b print:border-none">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Worker Summary View</h2>
            <p className="text-xs text-gray-500 print:hidden">Read-only snapshot for review / printing</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-2 rounded-md border">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div className="p-6 pt-4">
          {initialLoading && (
            <div className="mb-4 p-3 bg-gray-50 text-gray-700 rounded-md print:hidden">
              Loading worker data…
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md print:hidden">
              {error}
            </div>
          )}

          {/* Summary sections */}
          <div className="space-y-8">
            {/* Identity */}
            <section>
              <h3 className="text-base font-semibold mb-3">Worker Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">First Name</dt>
                    <dd className="col-span-2 font-medium">{fmt(formData.WorkerFirstName)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Last Name</dt>
                    <dd className="col-span-2 font-medium">{fmt(formData.WorkerLastName)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Alias</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerAliasName)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Date of Birth</dt>
                    <dd className="col-span-2">{fmtDate(formData.WorkerDOB)}</dd>
                  </div>
                </dl>

                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Gender</dt>
                    <dd className="col-span-2">{formData.WorkerGender === "M" ? "Male" : "Female"}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Marital Status</dt>
                    <dd className="col-span-2">{marriedSingle(formData.WorkerMarried)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Dominant Hand</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerHanded)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Email</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerEmail)}</dd>
                  </div>
                </dl>

                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Mobile</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerMobile)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Landline</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerLandline)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Passport Photo</dt>
                    <dd className="col-span-2">
                      {passportPhotoUrl ? (
                        <img src={passportPhotoUrl} alt="Passport" className="h-20 w-20 object-cover rounded border" />
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Origin Village</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerPlaceOfOriginVillage)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Origin District</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerPlaceOfOriginDistrict)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Origin Province</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerPlaceOfOriginProvince)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">P.O. Box</dt>
                    <dd className="col-span-2">{fmt(formData.WorkerPOBox)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Address</dt>
                    <dd className="col-span-2">
                      {fmt(formData.WorkerAddress1)}
                      {formData.WorkerAddress2 ? `, ${formData.WorkerAddress2}` : ""}
                    </dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">City / Province</dt>
                    <dd className="col-span-2">
                      {fmt(formData.WorkerCity)}
                      {formData.WorkerCity && formData.WorkerProvince ? ", " : ""}
                      {fmt(formData.WorkerProvince)}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* Spouse */}
            <section>
              <h3 className="text-base font-semibold mb-3">Spouse Details</h3>
              {formData.WorkerMarried !== "1" ? (
                <p className="text-gray-600 text-sm">N/A (Worker is not married)</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <dl className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">First Name</dt>
                      <dd className="col-span-2">{fmt(formData.SpouseFirstName)}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Last Name</dt>
                      <dd className="col-span-2">{fmt(formData.SpouseLastName)}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Date of Birth</dt>
                      <dd className="col-span-2">{fmtDate(formData.SpouseDOB)}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Origin Village</dt>
                      <dd className="col-span-2">{fmt(formData.SpousePlaceOfOriginVillage)}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Origin District</dt>
                      <dd className="col-span-2">{fmt(formData.SpousePlaceOfOriginDistrict)}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Origin Province</dt>
                      <dd className="col-span-2">{fmt(formData.SpousePlaceOfOriginProvince)}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Contact</dt>
                      <dd className="col-span-2">
                        {fmt(formData.SpouseEmail)}
                        {formData.SpouseEmail && (formData.SpouseMobile || formData.SpouseLandline) ? " • " : ""}
                        {fmt(formData.SpouseMobile)}
                        {formData.SpouseMobile && formData.SpouseLandline ? " / " : ""}
                        {fmt(formData.SpouseLandline)}
                      </dd>
                    </div>
                  </dl>
                  <dl className="md:col-span-3 space-y-2">
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      <dt className="text-gray-500 col-span-1 md:col-span-1">Address</dt>
                      <dd className="col-span-2 md:col-span-5">
                        {fmt(formData.SpouseAddress1)}
                        {formData.SpouseAddress2 ? `, ${formData.SpouseAddress2}` : ""}
                        {formData.SpouseCity ? `, ${formData.SpouseCity}` : ""}
                        {formData.SpouseProvince ? `, ${formData.SpouseProvince}` : ""}
                        {formData.SpousePOBox ? ` (PO Box ${formData.SpousePOBox})` : ""}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </section>

            {/* Dependants */}
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold mb-3">Dependants</h3>
                <span className="text-sm text-gray-600">Has dependants: {yesNo(formData.WorkerHaveDependants)}</span>
              </div>
              {formData.WorkerHaveDependants && dependants.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border rounded-md overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2">DOB</th>
                        <th className="text-left px-3 py-2">Gender</th>
                        <th className="text-left px-3 py-2">Type</th>
                        <th className="text-left px-3 py-2">Contact</th>
                        <th className="text-left px-3 py-2">Address</th>
                        <th className="text-left px-3 py-2">Dependance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependants.map((d, i) => (
                        <tr key={d._id || i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 font-medium">
                            {fmt(d.DependantFirstName)} {fmt(d.DependantLastName)}
                          </td>
                          <td className="px-3 py-2">{fmtDate(d.DependantDOB)}</td>
                          <td className="px-3 py-2">{d.DependantGender === "M" ? "Male" : "Female"}</td>
                          <td className="px-3 py-2">{fmt(d.DependantType)}</td>
                          <td className="px-3 py-2">
                            {fmt(d.DependantEmail)}
                            {d.DependantEmail && (d.DependantMobile || d.DependantLandline) ? " • " : ""}
                            {fmt(d.DependantMobile)}
                            {d.DependantMobile && d.DependantLandline ? " / " : ""}
                            {fmt(d.DependantLandline)}
                          </td>
                          <td className="px-3 py-2">
                            {fmt(d.DependantAddress1)}
                            {d.DependantAddress2 ? `, ${d.DependantAddress2}` : ""}
                            {d.DependantCity ? `, ${d.DependantCity}` : ""}
                            {d.DependantProvince ? `, ${d.DependantProvince}` : ""}
                            {d.DependantPOBox ? ` (PO Box ${d.DependantPOBox})` : ""}
                          </td>
                          <td className="px-3 py-2">{fmt(d.DependanceDegree)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 text-sm">No dependant records.</p>
              )}
            </section>

            {/* Employment */}
            <section>
              <h3 className="text-base font-semibold mb-3">Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Employer CPPSID</dt>
                    <dd className="col-span-2">{fmt(formData.EmployerCPPSID)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Employment ID</dt>
                    <dd className="col-span-2">{fmt(formData.EmploymentID)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Occupation</dt>
                    <dd className="col-span-2">{fmt(formData.Occupation)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Place of Employment</dt>
                    <dd className="col-span-2">{fmt(formData.PlaceOfEmployment)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Nature of Employment</dt>
                    <dd className="col-span-2">{fmt(formData.NatureOfEmployment)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Organization Type</dt>
                    <dd className="col-span-2">{fmt(formData.OrganizationType)}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Avg Weekly Wage</dt>
                    <dd className="col-span-2">{fmt(formData.AverageWeeklyWage)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Weekly Payment Rate</dt>
                    <dd className="col-span-2">{fmt(formData.WeeklyPaymentRate)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Worked Under Sub-Contractor</dt>
                    <dd className="col-span-2">{yesNo(formData.WorkedUnderSubContractor)}</dd>
                  </div>
                </dl>
              </div>

              {formData.WorkedUnderSubContractor && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <dl className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Sub-Contractor</dt>
                      <dd className="col-span-2">{fmt(formData.SubContractorOrganizationName)}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Location</dt>
                      <dd className="col-span-2">{fmt(formData.SubContractorLocation)}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-gray-500 col-span-1">Nature of Business</dt>
                      <dd className="col-span-2">{fmt(formData.SubContractorNatureOfBusiness)}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </section>

            {/* Work History */}
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold mb-3">Work History</h3>
                <span className="text-sm text-gray-600">Has history: {yesNo(formData.WorkerHasHistory)}</span>
              </div>
              {formData.WorkerHasHistory && workHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border rounded-md overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Organization</th>
                        <th className="text-left px-3 py-2">CPPSID</th>
                        <th className="text-left px-3 py-2">Contact</th>
                        <th className="text-left px-3 py-2">Address</th>
                        <th className="text-left px-3 py-2">Joined</th>
                        <th className="text-left px-3 py-2">Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workHistory.map((w, i) => (
                        <tr key={w._id || i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 font-medium">{fmt(w.OrganizationName)}</td>
                          <td className="px-3 py-2">{fmt(w.OrganizationCPPSID)}</td>
                          <td className="px-3 py-2">{fmt(w.OrganizationLandline)}</td>
                          <td className="px-3 py-2">
                            {fmt(w.OrganizationAddress1)}
                            {w.OrganizationAddress2 ? `, ${w.OrganizationAddress2}` : ""}
                            {w.OrganizationCity ? `, ${w.OrganizationCity}` : ""}
                            {w.OrganizationProvince ? `, ${w.OrganizationProvince}` : ""}
                            {w.OrganizationPOBox ? ` (PO Box ${w.OrganizationPOBox})` : ""}
                          </td>
                          <td className="px-3 py-2">{fmtDate(w.WorkerJoiningDate)}</td>
                          <td className="px-3 py-2">{fmtDate(w.WorkerLeavingDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 text-sm">No work history records.</p>
              )}
            </section>

            {/* Insurance */}
            <section>
              <h3 className="text-base font-semibold mb-3">Insurance Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Provider IPACode</dt>
                    <dd className="col-span-2">{fmt(formData.InsuranceProviderIPACode || formData.InsuranceIPACode)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Provider Name</dt>
                    <dd className="col-span-2 font-medium">{fmt(formData.InsuranceCompanyOrganizationName)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">City</dt>
                    <dd className="col-span-2">{fmt(formData.InsuranceCompanyCity)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Province</dt>
                    <dd className="col-span-2">{fmt(formData.InsuranceCompanyProvince)}</dd>
                  </div>
                </dl>
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">P.O. Box</dt>
                    <dd className="col-span-2">{fmt(formData.InsuranceCompanyPOBox)}</dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500 col-span-1">Landline</dt>
                    <dd className="col-span-2">{fmt(formData.InsuranceCompanyLandLine)}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-2">
                <dl className="space-y-2">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <dt className="text-gray-500 col-span-1 md:col-span-1">Address</dt>
                    <dd className="col-span-2 md:col-span-5">
                      {fmt(formData.InsuranceCompanyAddress1)}
                      {formData.InsuranceCompanyAddress2 ? `, ${formData.InsuranceCompanyAddress2}` : ""}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>

          {/* Footer (print shows nothing) */}
          <div className="mt-8 flex items-center justify-end gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Print CSS: strip shadows/borders for clean PDF */}
      <style>{`
        @media print {
          html, body { background: #fff; }
          .shadow, .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl { box-shadow: none !important; }
          .border, .border-b, .border-t, .border-l, .border-r { border: none !important; }
          .bg-white { background: #fff !important; }
          .print\\:hidden { display: none !important; }
          .print\\:max-h-none { max-height: none !important; }
          .print\\:overflow-visible { overflow: visible !important; }
          /* Fit to page width */
          .max-w-5xl { max-width: none !important; width: 100% !important; }
          .fixed.inset-0 { position: static !important; inset: auto !important; }
        }
      `}</style>
    </div>
  );
};

export default ViewWorkerRegistration;
