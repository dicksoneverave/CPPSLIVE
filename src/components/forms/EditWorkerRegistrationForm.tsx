import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import EmployerListModal from "./EmployerListModal";
import InsuranceProviderListModal from "./InsuranceProviderListModal";

interface EditWorkerRegistrationFormProps {
  onClose: () => void;
  /** REQUIRED: WorkerID to edit */
  WorkerID: string | number;
}

interface FormData {
  // Worker Personal Details
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerAliasName: string;
  WorkerDOB: string;
  WorkerGender: string;
  WorkerMarried: string; // "1"|"0"
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

  // Dependent Details
  WorkerHaveDependants: boolean;

  // Work History Toggle
  WorkerHasHistory: boolean;

  // Employment Details
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
  InsuranceProviderIPACode: string;
  InsuranceIPACode: string;

  // Insurance Details (display-only, derived from provider)
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;
}

interface EmployerData {
  EMID: string;
  CPPSID: string;
  OrganizationName: string;
  Address1: string;
  Address2: string;
  City: string;
  Province: string;
  POBox: string;
  MobilePhone: string;
  LandLine: string;
  OrganizationType: string;
  InsuranceProviderIPACode: string;
  InsuranceIPACode: string;
}

// Dependant row shape matching DB field names
interface DependantRow {
  DependantID?: number; // DB PK if present
  DependantFirstName: string;
  DependantLastName: string;
  DependantDOB: string; // YYYY-MM-DD
  DependantGender: string; // 'M' | 'F'
  DependantType: string; // Child | Sibling | Parent
  DependantAddress1: string;
  DependantAddress2: string;
  DependantCity: string;
  DependantProvince: string;
  DependantPOBox: string;
  DependantEmail: string;
  DependantMobile: string;
  DependantLandline: string;
  DependanceDegree: number | string; // keep as string in input, cast on save
  SameAsWorker?: boolean; // UI-only helper
  _id?: string; // UI key
}

// Work history row shape matching DB field names
interface WorkHistoryRow {
  WorkHistoryID?: number; // DB PK if present
  OrganizationName: string;
  OrganizationAddress1: string;
  OrganizationAddress2: string;
  OrganizationCity: string;
  OrganizationProvince: string;
  OrganizationPOBox: string;
  OrganizationLandline: string;
  OrganizationCPPSID: string;
  WorkerJoiningDate: string; // YYYY-MM-DD
  WorkerLeavingDate: string; // YYYY-MM-DD
  _id?: string; // UI key
}

type ChangeRow = { field: string; from: string | null; to: string | null; tab: number };

const EditWorkerRegistrationForm: React.FC<EditWorkerRegistrationFormProps> = ({ onClose, WorkerID }) => {
  const { profile, group } = useAuth();

  const [currentTab, setCurrentTab] = useState(1);
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
    InsuranceCompanyOrganizationName: "",
    InsuranceCompanyAddress1: "",
    InsuranceCompanyAddress2: "",
    InsuranceCompanyCity: "",
    InsuranceCompanyProvince: "",
    InsuranceCompanyPOBox: "",
    InsuranceCompanyLandLine: "",
    InsuranceIPACode: "",
  });

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<{ DKey: string; DValue: string }[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [showEmployerList, setShowEmployerList] = useState(false);
  const [showInsuranceList, setShowInsuranceList] = useState(false);
  const [isEmployer, setIsEmployer] = useState(false);
  const [isDataEntry, setIsDataEntry] = useState(false);
  const [employerData, setEmployerData] = useState<EmployerData | null>(null);
  const [insuranceOverridden, setInsuranceOverridden] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState<string>("");
  const [success, setSuccess] = useState<string | null>(null);
  const [dependants, setDependants] = useState<DependantRow[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>([]);
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string>("");
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>("");

  // ------- NEW: change summary state -------
  const [originalData, setOriginalData] = useState<{
    form: FormData | null;
    dependants: DependantRow[];
    workHistory: WorkHistoryRow[];
  }>({ form: null, dependants: [], workHistory: [] });

  const [showSummary, setShowSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [tabChangeCounts, setTabChangeCounts] = useState<number[]>([0, 0, 0, 0, 0, 0]); // one per tab

  const workerIdMemo = useMemo(() => String(WorkerID), [WorkerID]);

  // ---- helpers for change summary ----
  const yesNo = (b: any) => (b ? "Yes" : "No");
  const isEmpty = (v: any) => v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
  const normDate = (s: string) => (isEmpty(s) ? "" : String(s)); // keep as YYYY-MM-DD from inputs
  const normBool = (v: any) => (typeof v === "boolean" ? v : v === "1" || v === "Yes" || v === 1);
  const display = (key: string, v: any) => {
    if (["WorkerHaveDependants", "WorkerHasHistory", "WorkedUnderSubContractor"].includes(key)) {
      return yesNo(normBool(v));
    }
    if (key.endsWith("DOB") || key.includes("Date")) {
      return normDate(v);
    }
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return yesNo(v);
    return (v ?? "") as string;
  };

  // Map field -> tab index (1-based)
  const fieldTab: Record<string, number> = {
    // 1 Worker Personal Details
    WorkerFirstName: 1, WorkerLastName: 1, WorkerAliasName: 1, WorkerDOB: 1, WorkerGender: 1, WorkerMarried: 1,
    WorkerHanded: 1, WorkerPlaceOfOriginVillage: 1, WorkerPlaceOfOriginDistrict: 1, WorkerPlaceOfOriginProvince: 1,
    WorkerPassportPhoto: 1, WorkerAddress1: 1, WorkerAddress2: 1, WorkerCity: 1, WorkerProvince: 1, WorkerPOBox: 1,
    WorkerEmail: 1, WorkerMobile: 1, WorkerLandline: 1,

    // 2 Spouse
    SpouseFirstName: 2, SpouseLastName: 2, SpouseDOB: 2, SpousePlaceOfOriginVillage: 2, SpousePlaceOfOriginDistrict: 2,
    SpousePlaceOfOriginProvince: 2, SpouseAddress1: 2, SpouseAddress2: 2, SpouseCity: 2, SpouseProvince: 2,
    SpousePOBox: 2, SpouseEmail: 2, SpouseMobile: 2, SpouseLandline: 2,

    // 3 Dependants
    WorkerHaveDependants: 3,

    // 4 Employment
    EmployerCPPSID: 4, EmploymentID: 4, Occupation: 4, PlaceOfEmployment: 4, NatureOfEmployment: 4,
    AverageWeeklyWage: 4, WeeklyPaymentRate: 4, WorkedUnderSubContractor: 4,
    SubContractorOrganizationName: 4, SubContractorLocation: 4, SubContractorNatureOfBusiness: 4,
    OrganizationType: 4, InsuranceIPACode: 6, InsuranceProviderIPACode: 6, // Provider & code show under Insurance tab

    // 5 Work History (rows handled separately)

    // 6 Insurance (display-only fields too)
    InsuranceCompanyOrganizationName: 6, InsuranceCompanyAddress1: 6, InsuranceCompanyAddress2: 6,
    InsuranceCompanyCity: 6, InsuranceCompanyProvince: 6, InsuranceCompanyPOBox: 6, InsuranceCompanyLandLine: 6,
  };

  const fieldLabels: Record<string, string> = {
    WorkerFirstName: "First Name",
    WorkerLastName: "Last Name",
    WorkerAliasName: "Alias Name",
    WorkerDOB: "Date of Birth",
    WorkerGender: "Gender",
    WorkerMarried: "Marital Status",
    WorkerHanded: "Dominant Hand",
    WorkerPlaceOfOriginVillage: "Place of Origin Village",
    WorkerPlaceOfOriginDistrict: "Place of Origin District",
    WorkerPlaceOfOriginProvince: "Place of Origin Province",
    WorkerPassportPhoto: "Passport Photo",
    WorkerAddress1: "Address Line 1",
    WorkerAddress2: "Address Line 2",
    WorkerCity: "City",
    WorkerProvince: "Province",
    WorkerPOBox: "P.O. Box",
    WorkerEmail: "Email",
    WorkerMobile: "Mobile",
    WorkerLandline: "Landline",

    SpouseFirstName: "Spouse First Name",
    SpouseLastName: "Spouse Last Name",
    SpouseDOB: "Spouse Date of Birth",
    SpousePlaceOfOriginVillage: "Spouse Place of Origin Village",
    SpousePlaceOfOriginDistrict: "Spouse Place of Origin District",
    SpousePlaceOfOriginProvince: "Spouse Place of Origin Province",
    SpouseAddress1: "Spouse Address Line 1",
    SpouseAddress2: "Spouse Address Line 2",
    SpouseCity: "Spouse City",
    SpouseProvince: "Spouse Province",
    SpousePOBox: "Spouse P.O. Box",
    SpouseEmail: "Spouse Email",
    SpouseMobile: "Spouse Mobile",
    SpouseLandline: "Spouse Landline",

    WorkerHaveDependants: "Worker has dependants",
    WorkerHasHistory: "Worker has work history",
    EmployerCPPSID: "Employer CPPSID",
    EmploymentID: "Employment ID",
    Occupation: "Occupation",
    PlaceOfEmployment: "Place of Employment",
    NatureOfEmployment: "Nature of Employment",
    AverageWeeklyWage: "Average Weekly Wage",
    WeeklyPaymentRate: "Weekly Payment Rate",
    WorkedUnderSubContractor: "Worked Under Sub-Contractor",
    SubContractorOrganizationName: "Sub-Contractor Organization Name",
    SubContractorLocation: "Sub-Contractor Location",
    SubContractorNatureOfBusiness: "Sub-Contractor Nature of Business",
    OrganizationType: "Organization Type",

    InsuranceProviderIPACode: "Insurance Provider (IPACode)",
    InsuranceIPACode: "Insurance IPACode",
    InsuranceCompanyOrganizationName: "Insurance Company Name",
    InsuranceCompanyAddress1: "Insurance Address 1",
    InsuranceCompanyAddress2: "Insurance Address 2",
    InsuranceCompanyCity: "Insurance City",
    InsuranceCompanyProvince: "Insurance Province",
    InsuranceCompanyPOBox: "Insurance P.O. Box",
    InsuranceCompanyLandLine: "Insurance Landline",
  };

  // Compute change rows (scalar form fields + 3 checkboxes + array summaries)
  const computeChanges = (): ChangeRow[] => {
    const rows: ChangeRow[] = [];
    if (!originalData.form) return rows;

    const keys = Object.keys(formData) as (keyof FormData)[];
    for (const k of keys) {
      const oldRaw = (originalData.form as any)[k];
      const newRaw = (formData as any)[k];

      // normalize for compare
      let oldNorm = oldRaw;
      let newNorm = newRaw;

      if (k === "WorkerMarried") {
        // "1"/"0" but we display Married/Single
        oldNorm = oldRaw;
        newNorm = newRaw;
      } else if (["WorkerHaveDependants", "WorkerHasHistory", "WorkedUnderSubContractor"].includes(k as string)) {
        oldNorm = normBool(oldRaw);
        newNorm = normBool(newRaw);
      } else if ((k as string).endsWith("DOB") || (k as string).includes("Date")) {
        oldNorm = normDate(oldRaw);
        newNorm = normDate(newRaw);
      }

      const oldDisp =
        k === "WorkerMarried"
          ? (oldNorm === "1" ? "Married" : "Single")
          : display(k as string, oldNorm);
      const newDisp =
        k === "WorkerMarried"
          ? (newNorm === "1" ? "Married" : "Single")
          : display(k as string, newNorm);

      const same = (oldDisp ?? "") === (newDisp ?? "");
      if (!same) {
        rows.push({
          field: fieldLabels[k as string] || (k as string),
          from: isEmpty(oldDisp) ? null : String(oldDisp),
          to: isEmpty(newDisp) ? null : String(newDisp),
          tab: fieldTab[k as string] ?? 1,
        });
      }
    }

    // Dependants: show count difference (field-level diffs per row can be heavy; summarize)
    const oldDepCount = originalData.dependants.length;
    const newDepCount = dependants.length;
    if (oldDepCount !== newDepCount) {
      rows.push({
        field: "Dependants (rows)",
        from: String(oldDepCount),
        to: String(newDepCount),
        tab: 3,
      });
    } else {
      // If count same, detect any row-level field differences (shallow compare)
      const changed =
        JSON.stringify(originalData.dependants.map(slimDep)) !==
        JSON.stringify(dependants.map(slimDep));
      if (changed) {
        rows.push({
          field: "Dependants (details)",
          from: `rows: ${oldDepCount}`,
          to: `rows: ${newDepCount}`,
          tab: 3,
        });
      }
    }

    // Work history: similar summary
    const oldWhCount = originalData.workHistory.length;
    const newWhCount = workHistory.length;
    if (oldWhCount !== newWhCount) {
      rows.push({
        field: "Work History (rows)",
        from: String(oldWhCount),
        to: String(newWhCount),
        tab: 5,
      });
    } else {
      const changed =
        JSON.stringify(originalData.workHistory.map(slimWh)) !==
        JSON.stringify(workHistory.map(slimWh));
      if (changed) {
        rows.push({
          field: "Work History (details)",
          from: `rows: ${oldWhCount}`,
          to: `rows: ${newWhCount}`,
          tab: 5,
        });
      }
    }

    return rows;
  };

  const slimDep = (d: DependantRow) => ({
    DependantFirstName: d.DependantFirstName,
    DependantLastName: d.DependantLastName,
    DependantDOB: normDate(d.DependantDOB),
    DependantGender: d.DependantGender,
    DependantType: d.DependantType,
    DependantAddress1: d.DependantAddress1,
    DependantAddress2: d.DependantAddress2,
    DependantCity: d.DependantCity,
    DependantProvince: d.DependantProvince,
    DependantPOBox: d.DependantPOBox,
    DependantEmail: d.DependantEmail,
    DependantMobile: d.DependantMobile,
    DependantLandline: d.DependantLandline,
    DependanceDegree: d.DependanceDegree === "" ? "" : Number(d.DependanceDegree),
  });

  const slimWh = (w: WorkHistoryRow) => ({
    OrganizationName: w.OrganizationName,
    OrganizationAddress1: w.OrganizationAddress1,
    OrganizationAddress2: w.OrganizationAddress2,
    OrganizationCity: w.OrganizationCity,
    OrganizationProvince: w.OrganizationProvince,
    OrganizationPOBox: w.OrganizationPOBox,
    OrganizationLandline: w.OrganizationLandline,
    OrganizationCPPSID: w.OrganizationCPPSID,
    WorkerJoiningDate: normDate(w.WorkerJoiningDate),
    WorkerLeavingDate: normDate(w.WorkerLeavingDate),
  });

  // Recompute tab badges whenever editing changes
  useEffect(() => {
    if (!originalData.form) return;
    const rows = computeChanges();
    const counts = [1,2,3,4,5,6].map(tabNo => rows.filter(r => r.tab === tabNo).length);
    setTabChangeCounts(counts);
    setChanges(rows); // keep in sync so the modal will show up-to-date entries
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, dependants, workHistory, originalData]);

  useEffect(() => {
    const initializeForm = async () => {
      try {
        setInitialLoading(true);
        setError(null);

        // Group checks
        if (group) {
          const groupId = group.id;
          setIsEmployer(groupId === 15);
          setIsDataEntry(groupId === 18);
        }

        // Fetch provinces
        const { data: provinceData, error: provinceError } = await supabase
          .from("dictionary")
          .select("DKey, DValue")
          .eq("DType", "Province");
        if (provinceError) throw provinceError;
        setProvinces(provinceData || []);

        // Fetch insurance providers
        const { data: insuranceData, error: insuranceError } = await supabase
          .from("insurancecompanymaster")
          .select("*");
        if (insuranceError) throw insuranceError;
        setInsuranceProviders(insuranceData || []);

        // Load existing worker details
        await loadExistingWorker(workerIdMemo);
      } catch (err: any) {
        console.error("Error initializing edit form:", err);
        setError(err.message || "Failed to initialize edit form");
      } finally {
        setInitialLoading(false);
      }
    };

    initializeForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, profile, workerIdMemo]);

  const fetchEmployerDetails = async (organizationId: string) => {
    try {
      if (!organizationId || organizationId.trim() === "") {
        console.log('Skipping employer fetch - CPPSID is empty');
        return;
      }
      const { data, error } = await supabase
        .from("employermaster")           // or whatever table holds the employer/org record by CPPSID
        .select("*")
        .eq("CPPSID", organizationId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching employer details:", error);
        throw error;
      }


			 if (data) await populateEmployerData(data as EmployerData);
    } catch (err) {
      console.error("Error fetching employer details:", err);
      throw err;
    }
  };

  const populateEmployerData = async (employer: EmployerData) => {
    try {
      setEmployerData(employer);
      setFormData((prev) => ({
        ...prev,
        InsuranceProviderIPACode: employer.InsuranceIPACode || "",
      }));
      console.log('Employer InsuranceProviderIPACode:', employer.InsuranceIPACode);
      if (employer.InsuranceIPACode) {
        const { data: insuranceData, error: insuranceError } = await supabase
          .from("insurancecompanymaster")
          .select("*")
          .eq("IPACODE", employer.InsuranceIPACode)
          .limit(1)
          .single();
        if (!insuranceError && insuranceData) {
          setFormData((prev) => ({
            ...prev,
            InsuranceCompanyOrganizationName:
              insuranceData.InsuranceCompanyOrganizationName || "",
            InsuranceCompanyAddress1: insuranceData.InsuranceCompanyAddress1 || "",
            InsuranceCompanyAddress2: insuranceData.InsuranceCompanyAddress2 || "",
            InsuranceCompanyCity: insuranceData.InsuranceCompanyCity || "",
            InsuranceCompanyProvince: insuranceData.InsuranceCompanyProvince || "",
            InsuranceCompanyPOBox: insuranceData.InsuranceCompanyPOBox || "",
            InsuranceCompanyLandLine: insuranceData.InsuranceCompanyLandLine || "",
          }));
        }
      }
    } catch (err) {
      console.error("Error populating employer data:", err);
    }
  };

  const handleEmployerSelect = (employer: EmployerData) => {
    populateEmployerData(employer);
    setShowEmployerList(false);
  };

  const handleInsuranceProviderSelect = async (provider: any) => {
    try {
      setFormData((prev) => ({
        ...prev,
        InsuranceIPACode: provider.IPACODE || "",
        InsuranceCompanyOrganizationName: provider.InsuranceCompanyOrganizationName || "",
        InsuranceCompanyAddress1: provider.InsuranceCompanyAddress1 || "",
        InsuranceCompanyAddress2: provider.InsuranceCompanyAddress2 || "",
        InsuranceCompanyCity: provider.InsuranceCompanyCity || "",
        InsuranceCompanyProvince: provider.InsuranceCompanyProvince || "",
        InsuranceCompanyPOBox: provider.InsuranceCompanyPOBox || "",
        InsuranceCompanyLandLine: provider.InsuranceCompanyLandLine || "",
        InsuranceProviderIPACode: provider.IPACODE || "",
      }));

      setInsuranceOverridden(true);
      setShowInsuranceList(false);
    } catch (err: any) {
      console.error('Error in handleInsuranceProviderSelect:', err);
      setError(err.message || 'Failed to update insurance provider');
    }
  };

  const loadExistingWorker = async (workerId: string | number) => {
    try {
      setError(null);

      // 1) Personal details
      const { data: wp, error: wpErr } = await supabase
        .from("workerpersonaldetails")
        .select("*")
        .eq("WorkerID", workerId)
        .single();
      if (wpErr) throw wpErr;

      // Set initial personal + spouse
      const nextForm: FormData = {
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
      let employerCppsId = "";
      const { data: ce, error: ceErr } = await supabase
        .from("currentemploymentdetails")
        .select("*")
        .eq("WorkerID", workerId)
        .maybeSingle();
      if (!ceErr && ce) {
        employerCppsId = ce.EmployerCPPSID || "";
        nextForm.EmployerCPPSID = ce.EmployerCPPSID || "";
        nextForm.EmploymentID = ce.EmploymentID || "";
        nextForm.Occupation = ce.Occupation || "";
        nextForm.PlaceOfEmployment = ce.PlaceOfEmployment || "";
        nextForm.NatureOfEmployment = ce.NatureOfEmployment || "";
        nextForm.AverageWeeklyWage = ce.AverageWeeklyWage ?? 0;
        nextForm.WeeklyPaymentRate = ce.WeeklyPaymentRate ?? 0;
        nextForm.WorkedUnderSubContractor = (ce.WorkedUnderSubContractor || "No") === "Yes";
        nextForm.SubContractorOrganizationName = ce.SubContractorOrganizationName || "";
        nextForm.SubContractorLocation = ce.SubContractorLocation || "";
        nextForm.SubContractorNatureOfBusiness = ce.SubContractorNatureOfBusiness || "";
        nextForm.OrganizationType = ce.OrganizationType || "";
        nextForm.InsuranceIPACode = ce.InsuranceIPACode || "";

        if (ce.InsuranceIPACode) {
          const { data: insurance, error: insuranceError } = await supabase
            .from('insurancecompanymaster')
            .select('*')
            .eq('IPACODE', ce.InsuranceIPACode)
            .maybeSingle();

          if (!insuranceError && insurance) {
            nextForm.InsuranceProviderIPACode = insurance.IPACODE || "";
            nextForm.InsuranceIPACode = insurance.IPACODE || "";
            nextForm.InsuranceCompanyOrganizationName = insurance.InsuranceCompanyOrganizationName || "";
            nextForm.InsuranceCompanyAddress1 = insurance.InsuranceCompanyAddress1 || "";
            nextForm.InsuranceCompanyAddress2 = insurance.InsuranceCompanyAddress2 || "";
            nextForm.InsuranceCompanyCity = insurance.InsuranceCompanyCity || "";
            nextForm.InsuranceCompanyProvince = insurance.InsuranceCompanyProvince || "";
            nextForm.InsuranceCompanyPOBox = insurance.InsuranceCompanyPOBox || "";
            nextForm.InsuranceCompanyLandLine = insurance.InsuranceCompanyLandLine || "";
          }
        }
      }

   

      // 3) Dependants
      const { data: deps, error: depErr } = await supabase
        .from("dependantpersonaldetails")
        .select("*")
        .eq("WorkerID", workerId);
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
        SameAsWorker: false,
      }));
      setDependants(depRows);
      nextForm.WorkerHaveDependants = depRows.length > 0;

      // 4) Work history
      const { data: wh, error: whErr } = await supabase
        .from("workhistory")
        .select("*")
        .eq("WorkerID", workerId);
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
      nextForm.WorkerHasHistory = whRows.length > 0;

      setFormData(nextForm);

      // 5) If employer present, populate insurance from employer (unless later overridden)
      if (employerCppsId) {
        await fetchEmployerDetails(employerCppsId);
      }

      // Save original snapshot for diff
      setOriginalData({
        form: JSON.parse(JSON.stringify(nextForm)),
        dependants: JSON.parse(JSON.stringify(depRows)),
        workHistory: JSON.parse(JSON.stringify(whRows)),
      });
    } catch (err: any) {
      console.error("Failed to load worker for edit:", err);
      setError(err.message || "Failed to load worker data");
    }
  };

  // --- ORIGINAL handleSubmit now intercepts to show summary ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate required fields first (same as before)
    const requiredFields = [
      "WorkerFirstName",
      "WorkerLastName",
      "WorkerDOB",
      "WorkerGender",
      "EmployerCPPSID",
      "Occupation",
    ] as (keyof FormData)[];
    const missingFields = requiredFields.filter((field) => !(formData as any)[field]);
    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(", ")}`);
      return;
    }

    const rows = computeChanges();
    setChanges(rows);
    setShowSummary(true);
  };

  // --- NEW: confirm path performs the actual Supabase writes (moved from old handleSubmit) ---
  const handleConfirmUpdate = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const workerId = WorkerID;
      let finalFormData = { ...formData };

      // Upload file first if one is selected
      if (selectedFile && generatedFileName) {
        const filePath = `attachments/workerpassportphotos/${generatedFileName}`;
        const { error: uploadError } = await supabase.storage.from("cpps").upload(filePath, selectedFile);
        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }
        finalFormData.WorkerPassportPhoto = `cpps/${filePath}`;
      }

      // Helper to null empty date strings
      const formatDateForDB = (d: string) => (d && d.trim() !== "" ? d : null);

      // 1) Update worker personal details
      const { error: updWpErr } = await supabase
        .from("workerpersonaldetails")
        .update({
          WorkerFirstName: finalFormData.WorkerFirstName,
          WorkerLastName: finalFormData.WorkerLastName,
          WorkerAliasName: finalFormData.WorkerAliasName,
          WorkerDOB: formatDateForDB(finalFormData.WorkerDOB),
          WorkerGender: finalFormData.WorkerGender,
          WorkerMarried: finalFormData.WorkerMarried,
          WorkerHanded: finalFormData.WorkerHanded,
          WorkerPlaceOfOriginVillage: finalFormData.WorkerPlaceOfOriginVillage,
          WorkerPlaceOfOriginDistrict: finalFormData.WorkerPlaceOfOriginDistrict,
          WorkerPlaceOfOriginProvince: finalFormData.WorkerPlaceOfOriginProvince,
          WorkerPassportPhoto: finalFormData.WorkerPassportPhoto,
          WorkerAddress1: finalFormData.WorkerAddress1,
          WorkerAddress2: finalFormData.WorkerAddress2,
          WorkerCity: finalFormData.WorkerCity,
          WorkerProvince: finalFormData.WorkerProvince,
          WorkerPOBox: finalFormData.WorkerPOBox,
          WorkerEmail: finalFormData.WorkerEmail,
          WorkerMobile: finalFormData.WorkerMobile,
          WorkerLandline: finalFormData.WorkerLandline,
          SpouseFirstName: finalFormData.SpouseFirstName,
          SpouseLastName: finalFormData.SpouseLastName,
          SpouseDOB: formatDateForDB(finalFormData.SpouseDOB),
          SpousePlaceOfOriginVillage: finalFormData.SpousePlaceOfOriginVillage,
          SpousePlaceOfOriginDistrict: finalFormData.SpousePlaceOfOriginDistrict,
          SpousePlaceOfOriginProvince: finalFormData.SpousePlaceOfOriginProvince,
          SpouseAddress1: finalFormData.SpouseAddress1,
          SpouseAddress2: finalFormData.SpouseAddress2,
          SpouseCity: finalFormData.SpouseCity,
          SpouseProvince: finalFormData.SpouseProvince,
          SpousePOBox: finalFormData.SpousePOBox,
          SpouseEmail: finalFormData.SpouseEmail,
          SpouseMobile: finalFormData.SpouseMobile,
          SpouseLandline: finalFormData.SpouseLandline,
        })
        .eq("WorkerID", workerId);
      if (updWpErr) throw updWpErr;

      // 2) Upsert current employment details
      const { data: existingEmp, error: findEmpErr } = await supabase
        .from("currentemploymentdetails")
        .select("CEDID")
        .eq("WorkerID", workerId)
        .maybeSingle();
      if (findEmpErr) throw findEmpErr;

      if (existingEmp) {
        const { error: updEmpErr } = await supabase
          .from("currentemploymentdetails")
          .update({
            EmploymentID: finalFormData.EmploymentID,
            Occupation: finalFormData.Occupation,
            PlaceOfEmployment: finalFormData.PlaceOfEmployment,
            NatureOfEmployment: finalFormData.NatureOfEmployment,
            AverageWeeklyWage: Number(finalFormData.AverageWeeklyWage) || 0,
            WeeklyPaymentRate: Number(finalFormData.WeeklyPaymentRate) || 0,
            WorkedUnderSubContractor: finalFormData.WorkedUnderSubContractor ? "Yes" : "No",
            SubContractorOrganizationName: finalFormData.SubContractorOrganizationName,
            SubContractorLocation: finalFormData.SubContractorLocation,
            SubContractorNatureOfBusiness: finalFormData.SubContractorNatureOfBusiness,
            EmployerCPPSID: finalFormData.EmployerCPPSID,
            OrganizationType: finalFormData.OrganizationType,
            InsuranceIPACode: finalFormData.InsuranceIPACode,
          })
          .eq("WorkerID", workerId);
        if (updEmpErr) throw updEmpErr;
      } else {
        const { error: insEmpErr } = await supabase.from("currentemploymentdetails").insert([
          {
            WorkerID: workerId,
            EmploymentID: finalFormData.EmploymentID,
            Occupation: finalFormData.Occupation,
            PlaceOfEmployment: finalFormData.PlaceOfEmployment,
            NatureOfEmployment: finalFormData.NatureOfEmployment,
            AverageWeeklyWage: Number(finalFormData.AverageWeeklyWage) || 0,
            WeeklyPaymentRate: Number(finalFormData.WeeklyPaymentRate) || 0,
            WorkedUnderSubContractor: finalFormData.WorkedUnderSubContractor ? "Yes" : "No",
            SubContractorOrganizationName: finalFormData.SubContractorOrganizationName,
            SubContractorLocation: finalFormData.SubContractorLocation,
            SubContractorNatureOfBusiness: finalFormData.SubContractorNatureOfBusiness,
            EmployerCPPSID: finalFormData.EmployerCPPSID,
            OrganizationType: finalFormData.OrganizationType,
            InsuranceIPACode: finalFormData.InsuranceIPACode,
          },
        ]);
        if (insEmpErr) throw insEmpErr;
      }

      // 3) Replace dependants set
      const { error: delDepErr } = await supabase
        .from("dependantpersonaldetails")
        .delete()
        .eq("WorkerID", workerId);
      if (delDepErr) throw delDepErr;

      if (finalFormData.WorkerHaveDependants && dependants.length > 0) {
        const depInserts = dependants.map((d) => ({
          WorkerID: workerId,
          DependantFirstName: d.DependantFirstName,
          DependantLastName: d.DependantLastName,
          DependantDOB: d.DependantDOB && d.DependantDOB.trim() !== "" ? d.DependantDOB : null,
          DependantGender: d.DependantGender,
          DependantType: d.DependantType,
          DependantAddress1: d.DependantAddress1,
          DependantAddress2: d.DependantAddress2,
          DependantCity: d.DependantCity,
          DependantProvince: d.DependantProvince,
          DependantPOBox: d.DependantPOBox,
          DependantEmail: d.DependantEmail,
          DependantMobile: d.DependantMobile,
          DependantLandline: d.DependantLandline,
          DependanceDegree: d.DependanceDegree === "" ? null : Number(d.DependanceDegree),
        }));
        const { error: insDepErr } = await supabase.from("dependantpersonaldetails").insert(depInserts);
        if (insDepErr) throw insDepErr;
      }

      // 4) Replace work history set
      const { error: delWhErr } = await supabase.from("workhistory").delete().eq("WorkerID", workerId);
      if (delWhErr) throw delWhErr;

      if (finalFormData.WorkerHasHistory && workHistory.length > 0) {
        const whInserts = workHistory.map((w) => ({
          WorkerID: workerId,
          OrganizationName: w.OrganizationName,
          OrganizationAddress1: w.OrganizationAddress1,
          OrganizationAddress2: w.OrganizationAddress2,
          OrganizationCity: w.OrganizationCity,
          OrganizationProvince: w.OrganizationProvince,
          OrganizationPOBox: w.OrganizationPOBox,
          OrganizationLandline: w.OrganizationLandline,
          OrganizationCPPSID: w.OrganizationCPPSID,
          WorkerJoiningDate: w.WorkerJoiningDate && w.WorkerJoiningDate.trim() !== "" ? w.WorkerJoiningDate : null,
          WorkerLeavingDate: w.WorkerLeavingDate && w.WorkerLeavingDate.trim() !== "" ? w.WorkerLeavingDate : null,
        }));
        const { error: insWhErr } = await supabase.from("workhistory").insert(whInserts);
        if (insWhErr) throw insWhErr;
      }

      setSuccess(`Worker ${finalFormData.WorkerFirstName} ${finalFormData.WorkerLastName} has been updated successfully!`);
      setShowSummary(false);

      // refresh original snapshot after save
      setOriginalData({
        form: JSON.parse(JSON.stringify(finalFormData)),
        dependants: JSON.parse(JSON.stringify(dependants)),
        workHistory: JSON.parse(JSON.stringify(workHistory)),
      });

      setTimeout(() => onClose(), 1600);
    } catch (err: any) {
      console.error("Error updating worker:", err);
      setError(err.message || "Failed to update worker. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // ------- Dependants helpers -------
  const addDependant = () => {
    const newDependant: DependantRow = {
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      DependantFirstName: "",
      DependantLastName: "",
      DependantDOB: "",
      DependantGender: "M",
      DependantType: "Child",
      DependantAddress1: "",
      DependantAddress2: "",
      DependantCity: "",
      DependantProvince: provinces[0]?.DValue || "",
      DependantPOBox: "",
      DependantEmail: "",
      DependantMobile: "",
      DependantLandline: "",
      DependanceDegree: "",
      SameAsWorker: false,
    };
    setDependants((prev) => [...prev, newDependant]);
  };

  const removeDependant = (idx: number) => {
    setDependants((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDependantField = (idx: number, field: keyof DependantRow, value: any) => {
    setDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };

  const toggleSameAsWorker = (idx: number, checked: boolean) => {
    setDependants((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        if (checked) {
          return {
            ...d,
            SameAsWorker: true,
            DependantAddress1: formData.WorkerAddress1,
            DependantAddress2: formData.WorkerAddress2,
            DependantCity: formData.WorkerCity,
            DependantProvince: formData.WorkerProvince,
            DependantPOBox: formData.WorkerPOBox,
          };
        }
        return {
          ...d,
          SameAsWorker: false,
          DependantAddress1: "",
          DependantAddress2: "",
          DependantCity: "",
          DependantProvince: provinces[0]?.DValue || "",
          DependantPOBox: "",
        };
      })
    );
  };

  const degreeError = (val: string | number) => {
    const str = String(val ?? "").trim();
    if (str === "") return undefined;
    const n = Number(str);
    if (Number.isNaN(n)) return "Enter a valid number";
    if (n < 0 || n > 100) return "Value must be between 0 and 100";
    return undefined;
  };

  // ------- Work History helpers -------
  const addWorkHistory = () => {
    const row: WorkHistoryRow = {
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      OrganizationName: "",
      OrganizationAddress1: "",
      OrganizationAddress2: "",
      OrganizationCity: "",
      OrganizationProvince: provinces[0]?.DValue || "",
      OrganizationPOBox: "",
      OrganizationLandline: "",
      OrganizationCPPSID: "",
      WorkerJoiningDate: "",
      WorkerLeavingDate: "",
    };
    setWorkHistory((prev) => [...prev, row]);
  };

  const removeWorkHistory = (idx: number) => {
    setWorkHistory((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateWorkHistoryField = (idx: number, field: keyof WorkHistoryRow, value: any) => {
    setWorkHistory((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  // ------- File change handler -------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setGeneratedFileName("");
      return;
    }

    try {
      const currentDate = new Date();
      const day = String(currentDate.getDate()).padStart(2, "0");
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const year = currentDate.getFullYear();
      const datePrefix = `${day}${month}${year}`;
      const hh = String(currentDate.getHours()).padStart(2, "0");
      const min = String(currentDate.getMinutes()).padStart(2, "0");
      const ss = String(currentDate.getSeconds()).padStart(2, "0");
      const timestamp = `${hh}${min}${ss}`;
      const fileExt = file.name.split(".").pop();
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      const newFileName = `${datePrefix}_${timestamp}_${originalName}.${fileExt}`;
      setSelectedFile(file);
      setGeneratedFileName(newFileName);
      setFormData((prev) => ({ ...prev, [fieldName]: newFileName }));
    } catch (err) {
      console.error("Error processing file:", err);
      setError("Failed to process file. Please try again.");
    }
  };

  // ------- Passport photo URL resolver -------
  const parseStoragePath = (stored: string) => {
    if (!stored) return { bucket: "", path: "" };
    const firstSlash = stored.indexOf("/");
    if (firstSlash === -1) return { bucket: "cpps", path: stored }; // default bucket fallback
    const bucket = stored.slice(0, firstSlash);
    const path = stored.slice(firstSlash + 1);
    return { bucket, path };
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
      const { data: signed, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);
      if (!error && signed?.signedUrl) {
        setPassportPhotoUrl(signed.signedUrl);
      } else {
        setPassportPhotoUrl("");
      }
    } catch (e) {
      console.error("resolvePublicUrl error", e);
      setPassportPhotoUrl("");
    }
  };

  useEffect(() => {
    if (selectedFile) return;
    if (formData.WorkerPassportPhoto) {
      resolvePublicUrl(formData.WorkerPassportPhoto);
    } else {
      setPassportPhotoUrl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.WorkerPassportPhoto, selectedFile]);

  useEffect(() => {
    if (!selectedFile) {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl("");
      }
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(url);

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // ------- Render Sections (unchanged) -------
    const renderWorkerPersonalDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name *</label>
          <input
            type="text"
            name="WorkerFirstName"
            value={formData.WorkerFirstName}
            onChange={handleInputChange}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name *</label>
          <input
            type="text"
            name="WorkerLastName"
            value={formData.WorkerLastName}
            onChange={handleInputChange}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Alias Name</label>
          <input
            type="text"
            name="WorkerAliasName"
            value={formData.WorkerAliasName}
            onChange={handleInputChange}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth *</label>
          <input
            type="date"
            name="WorkerDOB"
            value={formData.WorkerDOB}
            onChange={handleInputChange}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender *</label>
          <select
            name="WorkerGender"
            value={formData.WorkerGender}
            onChange={handleInputChange}
            className="input"
            required
          >
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marital Status</label>
          <select
            name="WorkerMarried"
            value={formData.WorkerMarried}
            onChange={handleInputChange}
            className="input"
          >
            <option value="1">Married</option>
            <option value="0">Single</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Dominant Hand</label>
          <select
            name="WorkerHanded"
            value={formData.WorkerHanded}
            onChange={handleInputChange}
            className="input"
          >
            <option value="Right">Right</option>
            <option value="Left">Left</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Village</label>
          <input
            type="text"
            name="WorkerPlaceOfOriginVillage"
            value={formData.WorkerPlaceOfOriginVillage}
            onChange={handleInputChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin District</label>
          <input
            type="text"
            name="WorkerPlaceOfOriginDistrict"
            value={formData.WorkerPlaceOfOriginDistrict}
            onChange={handleInputChange}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Province</label>
          <select
            name="WorkerPlaceOfOriginProvince"
            value={formData.WorkerPlaceOfOriginProvince}
            onChange={handleInputChange}
            className="input"
          >
            <option value="">Select Province</option>
            {provinces.map((p) => (
              <option key={p.DValue} value={p.DValue}>
                {p.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Passport Photo</label>
          <input
            type="file"
            name="WorkerPassportPhoto"
            onChange={(e) => handleFileChange(e as any, "WorkerPassportPhoto")}
            className="input"
            accept=".png,.jpg,.jpeg"
          />

          {(selectedFile || passportPhotoUrl) ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={selectedFile ? localPreviewUrl : passportPhotoUrl}
                alt="Worker passport large"
                className="h-42 w-84 object-cover rounded-lg border cursor-pointer"
                onClick={() => setPhotoModalOpen(true)}
              />
              <div className="text-xs text-gray-600">
                Click the image to enlarge.
                {/*formData.WorkerPassportPhoto && (
                  <div className="mt-1 break-all">Stored path: {formData.WorkerPassportPhoto}</div>
                )*/}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500">No passport photo on file.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <textarea
            name="WorkerAddress1"
            value={formData.WorkerAddress1}
            onChange={handleInputChange}
            className="input"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea
            name="WorkerAddress2"
            value={formData.WorkerAddress2}
            onChange={handleInputChange}
            className="input"
            rows={3}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" name="WorkerCity" value={formData.WorkerCity} onChange={handleInputChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <select name="WorkerProvince" value={formData.WorkerProvince} onChange={handleInputChange} className="input">
            <option value="">Select Province</option>
            {provinces.map((p) => (
              <option key={p.DValue} value={p.DValue}>
                {p.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input type="text" name="WorkerPOBox" value={formData.WorkerPOBox} onChange={handleInputChange} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" name="WorkerEmail" value={formData.WorkerEmail} onChange={handleInputChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input type="tel" name="WorkerMobile" value={formData.WorkerMobile} onChange={handleInputChange} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input type="tel" name="WorkerLandline" value={formData.WorkerLandline} onChange={handleInputChange} className="input" />
        </div>
      </div>
    </div>
  );

  const renderSpouseDetails = () => (
    <div className="space-y-4">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {formData.WorkerMarried === "1"
            ? "Please update spouse details below:"
            : "Spouse details are disabled because worker is not married."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input type="text" name="SpouseFirstName" value={formData.SpouseFirstName} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input type="text" name="SpouseLastName" value={formData.SpouseLastName} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input type="date" name="SpouseDOB" value={formData.SpouseDOB} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Village</label>
          <input type="text" name="SpousePlaceOfOriginVillage" value={formData.SpousePlaceOfOriginVillage} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin District</label>
          <input type="text" name="SpousePlaceOfOriginDistrict" value={formData.SpousePlaceOfOriginDistrict} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Province</label>
          <select name="SpousePlaceOfOriginProvince" value={formData.SpousePlaceOfOriginProvince} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"}>
            <option value="">Select Province</option>
            {provinces.map((province) => (
              <option key={province.DValue} value={province.DValue}>
                {province.DValue}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <textarea name="SpouseAddress1" value={formData.SpouseAddress1} onChange={handleInputChange} className="input" rows={3} disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea name="SpouseAddress2" value={formData.SpouseAddress2} onChange={handleInputChange} className="input" rows={3} disabled={formData.WorkerMarried !== "1"} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" name="SpouseCity" value={formData.SpouseCity} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <select name="SpouseProvince" value={formData.SpouseProvince} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"}>
            <option value="">Select Province</option>
            {provinces.map((province) => (
              <option key={province.DValue} value={province.DValue}>
                {province.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input type="text" name="SpousePOBox" value={formData.SpousePOBox} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" name="SpouseEmail" value={formData.SpouseEmail} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input type="tel" name="SpouseMobile" value={formData.SpouseMobile} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input type="tel" name="SpouseLandline" value={formData.SpouseLandline} onChange={handleInputChange} className="input" disabled={formData.WorkerMarried !== "1"} />
        </div>
      </div>
    </div>
  );

  const renderDependentDetails = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <input type="checkbox" name="WorkerHaveDependants" checked={formData.WorkerHaveDependants} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300" />
        <label className="text-sm text-gray-900">Worker has dependants</label>
      </div>

      {formData.WorkerHaveDependants && (
        <>
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Dependants</h4>
            <button type="button" className="btn btn-primary" onClick={addDependant}>
              + Add Dependant
            </button>
          </div>

          {dependants.length === 0 ? (
            <p className="text-sm text-gray-600">No dependants added yet.</p>
          ) : (
            <div className="space-y-6">
              {dependants.map((d, idx) => {
                const err = degreeError(d.DependanceDegree);
                return (
                  <div key={d._id || idx} className="rounded-xl border p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-700">Row {idx + 1}</div>
                      <button type="button" className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600" onClick={() => removeDependant(idx)}>
                        Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">First Name</label>
                        <input className="input" value={d.DependantFirstName} onChange={(e) => updateDependantField(idx, "DependantFirstName", e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Last Name</label>
                        <input className="input" value={d.DependantLastName} onChange={(e) => updateDependantField(idx, "DependantLastName", e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Date of Birth</label>
                        <input type="date" className="input" value={d.DependantDOB} onChange={(e) => updateDependantField(idx, "DependantDOB", e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Dependant Type</label>
                        <select className="input" value={d.DependantType} onChange={(e) => updateDependantField(idx, "DependantType", e.target.value)}>
                          <option value="Child">Child</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Parent">Parent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Dependant Gender</label>
                        <select className="input" value={d.DependantGender} onChange={(e) => updateDependantField(idx, "DependantGender", e.target.value)}>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" className="h-4 w-4" checked={!!d.SameAsWorker} onChange={(e) => toggleSameAsWorker(idx, e.target.checked)} />
                          Same as Worker Address
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Address 1</label>
                        <input className="input" value={d.DependantAddress1} onChange={(e) => updateDependantField(idx, "DependantAddress1", e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Address 2</label>
                        <input className="input" value={d.DependantAddress2} onChange={(e) => updateDependantField(idx, "DependantAddress2", e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">City</label>
                        <input className="input" value={d.DependantCity} onChange={(e) => updateDependantField(idx, "DependantCity", e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Province</label>
                        <select className="input" value={d.DependantProvince} onChange={(e) => updateDependantField(idx, "DependantProvince", e.target.value)} disabled={!!d.SameAsWorker}>
                          {provinces.map((p) => (
                            <option key={p.DValue} value={p.DValue}>
                              {p.DValue}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">P.O. Box</label>
                        <input className="input" value={d.DependantPOBox} onChange={(e) => updateDependantField(idx, "DependantPOBox", e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Email</label>
                        <input type="email" className="input" value={d.DependantEmail} onChange={(e) => updateDependantField(idx, "DependantEmail", e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Mobile</label>
                        <input className="input" value={d.DependantMobile} onChange={(e) => updateDependantField(idx, "DependantMobile", e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Landline</label>
                        <input className="input" value={d.DependantLandline} onChange={(e) => updateDependantField(idx, "DependantLandline", e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Degree of Dependance (0–100)</label>
                        <input className={`input ${degreeError(d.DependanceDegree) ? "border-red-500" : ""}`} value={String(d.DependanceDegree ?? "")} onChange={(e) => updateDependantField(idx, "DependanceDegree", e.target.value)} />
                        {degreeError(d.DependanceDegree) && (
                          <p className="mt-1 text-xs text-red-600">{degreeError(d.DependanceDegree)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="space-y-4">
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Employer Information</h4>
        {isEmployer && <p className="text-sm text-green-600 mb-2">✓ Employer details may be auto-filled based on your organization</p>}
        {isDataEntry && (
          <div className="flex items-center space-x-2">
            <button type="button" onClick={() => setShowEmployerList(true)} className="btn btn-primary text-sm">
              Select Employer
            </button>
            {formData.EmployerCPPSID && (
              <span className="text-sm text-green-600">✓ Employer selected: {formData.PlaceOfEmployment}</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employer CPPSID *</label>
          <input type="text" name="EmployerCPPSID" value={formData.EmployerCPPSID} onChange={handleInputChange} className="input" required readOnly={isEmployer} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Employment ID</label>
          <input type="text" name="EmploymentID" value={formData.EmploymentID} onChange={handleInputChange} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation *</label>
          <input type="text" name="Occupation" value={formData.Occupation} onChange={handleInputChange} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Employment *</label>
          <input type="text" name="PlaceOfEmployment" value={formData.PlaceOfEmployment} onChange={handleInputChange} className="input" required readOnly={isEmployer || (isDataEntry && formData.EmployerCPPSID)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
        <input type="text" name="NatureOfEmployment" value={formData.NatureOfEmployment} onChange={handleInputChange} className="input" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
          <input type="number" name="AverageWeeklyWage" value={formData.AverageWeeklyWage} onChange={handleInputChange} className="input" min="0" step="0.01" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weekly Payment Rate</label>
          <input type="number" name="WeeklyPaymentRate" value={formData.WeeklyPaymentRate} onChange={handleInputChange} className="input" min="0" step="0.01" />
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

  const renderWorkHistory = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <input type="checkbox" name="WorkerHasHistory" checked={formData.WorkerHasHistory} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300" />
        <label className="text-sm text-gray-900">Worker has work history</label>
      </div>

      {formData.WorkerHasHistory && (
        <>
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Work History - Organization Details</h4>
            <button type="button" className="btn btn-primary" onClick={addWorkHistory}>
              + Add Worker History
            </button>
          </div>

          {workHistory.length === 0 ? (
            <p className="text-sm text-gray-600">No work history rows yet.</p>
          ) : (
            <div className="space-y-6">
              {workHistory.map((w, idx) => (
                <div key={w._id || idx} className="rounded-xl border p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-700">Row {idx + 1}</div>
                    <button type="button" className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600" onClick={() => removeWorkHistory(idx)}>
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">Organization Name</label>
                      <input className="input" value={w.OrganizationName} onChange={(e) => updateWorkHistoryField(idx, "OrganizationName", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Landline</label>
                      <input className="input" value={w.OrganizationLandline} onChange={(e) => updateWorkHistoryField(idx, "OrganizationLandline", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Address 1</label>
                      <input className="input" value={w.OrganizationAddress1} onChange={(e) => updateWorkHistoryField(idx, "OrganizationAddress1", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Address 2</label>
                      <input className="input" value={w.OrganizationAddress2} onChange={(e) => updateWorkHistoryField(idx, "OrganizationAddress2", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">City</label>
                      <input className="input" value={w.OrganizationCity} onChange={(e) => updateWorkHistoryField(idx, "OrganizationCity", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Province</label>
                      <select className="input" value={w.OrganizationProvince} onChange={(e) => updateWorkHistoryField(idx, "OrganizationProvince", e.target.value)}>
                        {provinces.map((p) => (
                          <option key={p.DValue} value={p.DValue}>
                            {p.DValue}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">P.O. Box</label>
                      <input className="input" value={w.OrganizationPOBox} onChange={(e) => updateWorkHistoryField(idx, "OrganizationPOBox", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">CPPSID</label>
                      <input className="input" value={w.OrganizationCPPSID} onChange={(e) => updateWorkHistoryField(idx, "OrganizationCPPSID", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Joining Date</label>
                      <input type="date" className="input" value={w.WorkerJoiningDate} onChange={(e) => updateWorkHistoryField(idx, "WorkerJoiningDate", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Leaving Date</label>
                      <input type="date" className="input" value={w.WorkerLeavingDate} onChange={(e) => updateWorkHistoryField(idx, "WorkerLeavingDate", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderInsuranceDetails = () => (
    <div className="space-y-4">
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Insurance Information</h4>
        {(isEmployer || (isDataEntry && formData.EmployerCPPSID)) && !insuranceOverridden && (
          <p className="text-sm text-green-600">✓ Insurance details auto-filled based on employer's insurance provider</p>
        )}
        {insuranceOverridden && <p className="text-sm text-blue-600">✓ Insurance provider manually selected and overridden</p>}
        <div className="flex items-center space-x-2 mt-2">
          <button type="button" onClick={() => setShowInsuranceList(true)} className="btn btn-secondary text-sm">
            Change Insurance Provider
          </button>
          {formData.InsuranceProviderIPACode && (
            <span className="text-sm text-green-600">✓ Selected: {formData.InsuranceCompanyOrganizationName}</span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider</label>
        <select name="InsuranceProviderIPACode" value={formData.InsuranceProviderIPACode} onChange={handleInputChange} className="input" disabled>
          <option value="">Select Insurance Provider</option>
          {insuranceProviders.map((provider) => (
            <option key={provider.IPACODE} value={provider.IPACODE}>
              {provider.InsuranceCompanyOrganizationName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Company Name</label>
        <input type="text" name="InsuranceCompanyOrganizationName" value={formData.InsuranceCompanyOrganizationName} onChange={handleInputChange} className="input" readOnly />
      </div>

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
    </div>
  );

  const renderTabContent = () => {
    switch (currentTab) {
      case 1:
        return renderWorkerPersonalDetails();
      case 2:
        return renderSpouseDetails();
      case 3:
        return renderDependentDetails();
      case 4:
        return renderEmploymentDetails();
      case 5:
        return renderWorkHistory();
      case 6:
        return renderInsuranceDetails();
      default:
        return null;
    }
  };

  const tabs = [
    "Worker Personal Details",
    "Spouse Details",
    "Dependent Details",
    "Other Employment Details",
    "Work History",
    "Insurance Details",
  ];

  // Badge component
  const Badge: React.FC<{ count: number }> = ({ count }) =>
    count > 0 ? (
      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs px-2 py-0.5">
        {count}
      </span>
    ) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Edit Worker</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {initialLoading && (
            <div className="mb-4 p-3 bg-gray-50 text-gray-700 rounded-md">Loading worker data…</div>
          )}

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}

          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

          {(isEmployer || isDataEntry) && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md">
              <p className="text-sm">
                {isEmployer && "You are logged in as an Employer. Employer and insurance details may be auto-filled."}
                {isDataEntry && "You are logged in as Data Entry. You can change employer to auto-fill details."}
              </p>
            </div>
          )}

          <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setCurrentTab(index + 1)}
                className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                  currentTab === index + 1 ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab}
                <Badge count={tabChangeCounts[index]} />
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {renderTabContent()}
            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading || saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading || saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Photo lightbox (unchanged) */}
      {photoModalOpen && (selectedFile || passportPhotoUrl) && (
        <div
          className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPhotoModalOpen(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow"
              onClick={() => setPhotoModalOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={selectedFile ? localPreviewUrl : passportPhotoUrl}
              alt="Worker passport large"
              className="max-h-[85vh] w-auto object-contain rounded-md shadow-lg"
            />
          </div>
        </div>
      )}

      {/* Employer List Modal for Data Entry users */}
      {showEmployerList && isDataEntry && (
        <EmployerListModal onClose={() => setShowEmployerList(false)} onSelectEmployer={handleEmployerSelect} />
      )}

      {/* Insurance Provider List Modal */}
      {showInsuranceList && (
        <InsuranceProviderListModal onClose={() => setShowInsuranceList(false)} onSelectProvider={handleInsuranceProviderSelect} />
      )}

      {/* CHANGES SUMMARY MODAL - Styled exactly as requested */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Review Changes</h3>
              <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-3">Please review the fields that will be updated:</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 w-1/3">Field</th>
                      <th className="text-left px-3 py-2">From</th>
                      <th className="text-left px-3 py-2">To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                          No changes detected.
                        </td>
                      </tr>
                    ) : (
                      changes.map((c, idx) => (
                        <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium text-gray-900">{c.field}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {c.from ?? <span className="italic text-gray-400">empty</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {c.to ?? <span className="italic text-gray-400">empty</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowSummary(false)} className="btn btn-secondary" disabled={saving}>
                Go Back & Edit
              </button>
              <button onClick={handleConfirmUpdate} className="btn btn-primary" disabled={saving}>
                {saving ? 'Updating...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditWorkerRegistrationForm;
