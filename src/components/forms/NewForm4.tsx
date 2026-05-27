// NewForm4.tsx — Part 1 (imports, helpers, types)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../services/supabase";
import { recordPrescreening } from '../../utils/insertPrescreening';

// ---------- helpers (same approach as NewForm12) ----------
const normalizeStoragePath = (p?: string) => {
  if (!p) return "";
  if (p.startsWith("http")) return p;
  let s = p.replace(/^\/+/, "");
  s = s.replace(/^(?:cpps\/)+/i, "");
  return s;
};
const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || "");
const s = (v: unknown) => (v ?? "") as string;
const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
const b = (v: unknown) => !!v; // checkboxes

// A tiny sanitation helper to avoid undefineds in inputs
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




// PATCH A — robust URL resolver (copied from EditForm12 logic)
const getBestStorageUrl = async (rawPath?: string): Promise<string> => {
  try {
    if (!rawPath) return "";
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const path = normalizeStoragePath(rawPath);
    if (!path) return "";

    // try a public URL first
    const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
    const publicUrl = pub?.publicUrl || "";
    if (publicUrl) {
      try {
        const head = await fetch(publicUrl, { method: "HEAD" });
        if (head.ok) return publicUrl;
      } catch { /* fall back */ }
    }

    // fall back to signed url
    const { data: signed } = await supabase.storage.from("cpps").createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl || "";
  } catch {
    return "";
  }
};





// Resolve a Supabase Storage path to a browser-usable URL (public or signed)
const resolveStorageUrl = async (rawPath: string): Promise<string | null> => {
  try {
    if (!rawPath) return null;
    if (/^https?:\/\//i.test(rawPath)) return rawPath;
    const path = normalizeStoragePath(rawPath);
    if (!path) return null;
    const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    const { data: signed } = await supabase.storage
      .from("cpps")
      .createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl ?? null;
  } catch (e) {
    console.error("resolveStorageUrl failed for", rawPath, e);
    return null;
  }
};






// ---------- types ----------
type ChangeRow = { field: string; from: string; to: string };

interface NewForm4Props {
  irn: number | string;
  onClose: () => void;
  workerId?: number | string;
}

interface DependantRow {
  id?: number;
  DependantFirstName: string;
  DependantLastName: string;
  DependantDOB?: string;
  DependantType?: string; // Parent | Child | Sibling | Other | Nominee
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

interface Form4Data {
  WorkerID: string;
  DisplayIRN: string;

  // Worker Personal Details (mirror of workerpersonaldetails)
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerAliasName?: string;
  WorkerDOB?: string;
  WorkerGender?: string;
  WorkerMarried?: string;      // "1"/"0" or "Yes"/"No" depending on your view
  WorkerHanded?: string;       // "Right" | "Left"
  WorkerAddress1?: string;
  WorkerAddress2?: string;
  WorkerCity?: string;
  WorkerProvince?: string;
  WorkerPOBox?: string;
  WorkerEmail?: string;
  WorkerMobile?: string;
  WorkerLandline?: string;
  WorkerPlaceOfOriginVillage?: string;
  WorkerPlaceOfOriginDistrict?: string;
  WorkerPlaceOfOriginProvince?: string;
  WorkerPassportPhoto?: string;  // storage path

  Nationality?: string; // you used this too

  // Employment & Injury snapshot
  PlaceOfEmployment?: string;
  NatureOfEmployment?: string;
  SubContractorOrganizationName?: string;
  SubContractorLocation?: string;
  SubContractorNatureOfBusiness?: string;

  IncidentDate?: string;     // from form1112master
  IncidentProvince?: string; // from form1112master
  IncidentRegion?: string;   // from form1112master
  InjuryCause?: string;      // from form1112master
  NatureExtentInjury?: string; // from form1112master
  GradualProcessInjury?: boolean;

  // Spouse Details (read-only snapshot from workerpersonaldetails)
  SpouseFirstName?: string;
  SpouseLastName?: string;
  SpouseDOB?: string;
  SpouseAddress1?: string;
  SpouseAddress2?: string;
  SpouseCity?: string;
  SpouseProvince?: string;
  SpousePOBox?: string;
  SpouseEmail?: string;
  SpouseMobile?: string;
  SpouseLandline?: string;

  // Compensation (form4master)
  AnnualEarningsAtDeath: number;
  CompensationBenefitsPriorToDeath: string; // UI: Yes/No; saved as 1/0
  CompensationBenefitDetails: string;
  CompensationClaimed: string;
  MedicalExpenseDetails: string;
  FuneralExpenseDetails: string;
  IncidentDescription: string;

  // Applicant (form4master)
  ApplicantFirstName?: string;
  ApplicantLastName?: string;
  ApplicantAddress1?: string;
  ApplicantAddress2?: string;
  ApplicantCity?: string;
  ApplicantProvince?: string;
  ApplicantPOBox?: string;
  ApplicantEmail?: string;
  ApplicantMobile?: string;
  ApplicantLandline?: string;

  // Insurance Details (read-only from insurancecompanymaster)
  InsuranceProviderIPACode: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;

  // Form 4 scan + supporting docs
  ImageName: string; // path
  PublicUrl: string; // optional mirror
  DC?: string; PMR?: string; SEC43?: string; SS?: string; WS?: string; DD?: string;
  PTA?: string; PIR?: string; FER?: string; MEC?: string; MISC?: string; DED?: string; F18?: string;

  // system
  TimeBarred: boolean | string;
  Form4SubmissionDate?: string;
}

// NewForm4.tsx — Part 2 (component state + initial load)
const NewForm4: React.FC<NewForm4Props> = ({ irn, workerId, onClose }) => {
  // ids resolved from IRN
  const [resolvedIRN, setResolvedIRN] = useState<number | null>(null);
  const [resolvedWorkerID, setResolvedWorkerID] = useState<number | null>(null);

  // Worker Personal Details
  const [workerDetails, setWorkerDetails] = useState<any>({});

  const [originalData, setOriginalData] = useState<Form4Data | null>(null);

  // ui
  const [currentTab, setCurrentTab] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // reference
  const [provinces, setProvinces] = useState<{ DKey: string; DValue: string }[]>(
    []
  );
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);



  // Spouse Details state (full row mirror of spousepersonaldetails)
  const [spouseDetails, setSpouseDetails] = useState<any>({
    SpouseFirstName: "",
    SpouseLastName: "",
    SpouseDOB: "",
    SpouseAddress1: "",
    SpouseAddress2: "",
    SpouseCity: "",
    SpouseProvince: "",
    SpousePOBox: "",
    SpouseEmail: "",
    SpouseMobile: "",
    SpouseLandline: "",
  });


  // Employment & Injury
  const [employmentDetails, setEmploymentDetails] = useState<any>({
    EmployerName: "",
    Occupation: "",
    EmployerAddress1: "",
    EmployerAddress2: "",
    EmployerCity: "",
    EmployerProvince: "",
    EmployerPOBox: "",
    EmployerEmail: "",
    EmployerMobile: "",
    EmployerLandline: "",

    AccidentDate: "",
    AccidentPlace: "",
    NatureOfInjury: "",
    CauseOfInjury: "",
  });

  // Passport photo (preview + lightbox) ----
  const [passportUrl, setPassportUrl] = useState<string>("");
  const [isPhotoOpen, setIsPhotoOpen] = useState<boolean>(false);

  // table snapshots
  const [dependants, setDependants] = useState<DependantRow[]>([]);
  const [otherDependants, setOtherDependants] = useState<DependantRow[]>([]);
  const [nominees, setNominees] = useState<DependantRow[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>([]);

  // draft rows for add forms (same fields across all three dependant tabs)
  const makeEmptyDependant = (type: string): DependantRow => ({
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
  });

  const [newDep, setNewDep] = useState<DependantRow>(makeEmptyDependant("Child"));
  const [newOther, setNewOther] = useState<DependantRow>(
    makeEmptyDependant("Other")
  );
  const [newNominee, setNewNominee] = useState<DependantRow>(
    makeEmptyDependant("Nominee")
  );

  // Applicant — convenience to copy worker address
  const [applicantSameAsWorker, setApplicantSameAsWorker] = useState(false);
  const copyWorkerAddressToApplicant = (checked: boolean) => {
    setApplicantSameAsWorker(checked);
    if (!checked) return;
    setFormData((p) => ({
      ...p,
      ApplicantAddress1: s(p.WorkerAddress1),
      ApplicantAddress2: s(p.WorkerAddress2),
      ApplicantCity: s(p.WorkerCity),
      ApplicantProvince: s(p.WorkerProvince),
      ApplicantPOBox: s(p.WorkerPOBox),
      ApplicantEmail: s(p.WorkerEmail),
      ApplicantMobile: s(p.WorkerMobile),
      ApplicantLandline: s(p.WorkerLandline),
    }));
  };


  const [newHistory, setNewHistory] = useState<WorkHistoryRow>({
    OrganizationName: "",
    OrganizationAddress1: "",
    OrganizationAddress2: "",
    OrganizationCity: "",
    OrganizationProvince: "",
    OrganizationPOBox: "",
    OrganizationLandline: "",
    OrganizationCPPSID: "",
    WorkerJoiningDate: "",
    WorkerLeavingDate: "",
  });

  // attachments state
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>(
    {}
  );
  const [generatedFileNames, setGeneratedFileNames] = useState<{
    [key: string]: string;
  }>({});
  const [attachmentPreviews, setAttachmentPreviews] = useState<
    Record<string, string>
  >({});
  const [attachmentLocalPreviews, setAttachmentLocalPreviews] = useState<
    Record<string, string>
  >({});
  const [scanLocalUrl, setScanLocalUrl] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [openAttachmentKey, setOpenAttachmentKey] = useState<string | null>(null);

  const base: Form4Data = useMemo(
    () => ({
      WorkerID: "",
      DisplayIRN: "",

      // Worker Personal Details
      WorkerFirstName: "",
      WorkerLastName: "",
      WorkerDOB: "",
      WorkerGender: "",
      Nationality: "",
      WorkerEmail: "",
      WorkerMobile: "",
      WorkerLandline: "",
      WorkerPOBox: "",
      WorkerAddress1: "",
      WorkerAddress2: "",
      WorkerCity: "",
      WorkerProvince: "",
      WorkerPlaceOfOriginVillage: "",
      WorkerPlaceOfOriginDistrict: "",
      WorkerPlaceOfOriginProvince: "",

      IncidentProvince: "",
      IncidentRegion: "",

      AnnualEarningsAtDeath: 0,
      CompensationBenefitsPriorToDeath: "",
      CompensationBenefitDetails: "",
      CompensationClaimed: "",
      MedicalExpenseDetails: "",
      FuneralExpenseDetails: "",
      IncidentDescription: "",

      ApplicantFirstName: "",
      ApplicantLastName: "",
      ApplicantAddress1: "",
      ApplicantAddress2: "",
      ApplicantCity: "",
      ApplicantProvince: "",
      ApplicantPOBox: "",
      ApplicantEmail: "",
      ApplicantMobile: "",
      ApplicantLandline: "",


      // Employment & Injury
      PlaceOfEmployment: "",
      Occupation: "",
      NatureOfEmployment: "",
      WorkedUnderSubContractor: "",
      SubContractorOrganizationName: "",
      SubContractorLocation: "",
      SubContractorNatureOfBusiness: "",
      InjuryCause: "",
      NatureExtentInjury: "",

      AccidentDate: "",
      AccidentPlace: "",
      NatureOfInjury: "",
      CauseOfInjury: "",

      // Spouse Details
      SpouseFirstName: "",
      SpouseLastName: "",
      SpouseDOB: "",
      SpouseGender: "",
      SpouseMobile: "",
      SpouseAddress1: "",
      SpouseAddress2: "",
      SpouseCity: "",
      SpouseProvince: "",
      SpousePOBox: "",
      SpouseEmail: "",
      SpouseLandline: "",




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
      SEC43: "",
      SS: "",
      WS: "",
      DD: "",
      PTA: "",
      PIR: "",
      FER: "",
      MEC: "",
      MISC: "",
      DED: "",
      F18: "",

      TimeBarred: false,
      IncidentDate: "",
      Form4SubmissionDate: "",
    }),
    []
  );






  const [formData, setFormData] = useState<Form4Data>(base);

  // IRN → WorkerID
  useEffect(() => {
    (async () => {
      try {
        const irnNum = Number(irn);
        if (!isFinite(irnNum)) throw new Error("Invalid IRN");
        setResolvedIRN(irnNum);

        if (workerId) {
          const wid = Number(workerId);
          if (isFinite(wid)) setResolvedWorkerID(wid);
        } else {
          const { data: wr, error: werr } = await supabase
            .from("workerirn")
            .select("WorkerID, DisplayIRN")
            .eq("IRN", irnNum)
            .maybeSingle();
          if (werr) throw werr;
          if (wr?.WorkerID) setResolvedWorkerID(Number(wr.WorkerID));
          setFormData((prev) => ({ ...prev, DisplayIRN: s(wr?.DisplayIRN) }));
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Failed to resolve IRN → WorkerID");
      }
    })();
  }, [irn, workerId]);

  // PATCH D — resolve scan URL for any extension (image or pdf/doc)
  useEffect(() => {
    if (scanLocalUrl) return; // prefer local preview if present
    (async () => {
      const path = s(formData.ImageName);
      if (!path) { setScanUrl(''); return; }
      const url = await getBestStorageUrl(path);
      setScanUrl(url || '');
    })();
  }, [formData.ImageName, scanLocalUrl]);


  //-----------------------------
  // Initial load bundles -Use Effects
  //----------------------------------


  useEffect(() => {
    if (!resolvedWorkerID) return;
    let cancelled = false;

    (async () => {
      // Employment
      const { data: empData } = await supabase
        .from("currentemploymentdetails")
        .select("*")
        .eq("WorkerID", resolvedWorkerID)
        .maybeSingle();

      // Injury / death details
      const { data: injuryData } = await supabase
        .from("form4master")
        .select("*")
        .eq("IRN", irn)
        .maybeSingle();

      if (!cancelled) {
        setEmploymentDetails((prev: any) => ({
          ...prev,
          EmployerName: empData?.EmployerName ?? "",
          WorkerOccupation: empData?.WorkerOccupation ?? "",
          HireDate: empData?.HireDate ?? "",
          TerminationDate: empData?.TerminationDate ?? "",
          EmployerAddress1: empData?.EmployerAddress1 ?? "",
          EmployerAddress2: empData?.EmployerAddress2 ?? "",
          EmployerCity: empData?.EmployerCity ?? "",
          EmployerProvince: empData?.EmployerProvince ?? "",
          EmployerPOBox: empData?.EmployerPOBox ?? "",
          EmployerEmail: empData?.EmployerEmail ?? "",
          EmployerMobile: empData?.EmployerMobile ?? "",
          EmployerLandline: empData?.EmployerLandline ?? "",

          AccidentDate: injuryData?.AccidentDate ?? "",
          AccidentPlace: injuryData?.AccidentPlace ?? "",
          NatureOfInjury: injuryData?.NatureOfInjury ?? "",
          CauseOfInjury: injuryData?.CauseOfInjury ?? "",
        }));
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedWorkerID]);



  // Fetch spousepersonaldetails for this worker
  useEffect(() => {
    if (!resolvedWorkerID) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("workerpersonaldetails")
        .select("*")
        .eq("WorkerID", resolvedWorkerID)
        .maybeSingle();

      if (!cancelled && !error && data) {
        setSpouseDetails({
          SpouseFirstName: data.SpouseFirstName ?? "",
          SpouseLastName: data.SpouseLastName ?? "",
          SpouseDOB: data.SpouseDOB ?? "",
          SpouseAddress1: data.SpouseAddress1 ?? "",
          SpouseAddress2: data.SpouseAddress2 ?? "",
          SpouseCity: data.SpouseCity ?? "",
          SpouseProvince: data.SpouseProvince ?? "",
          SpousePOBox: data.SpousePOBox ?? "",
          SpouseEmail: data.SpouseEmail ?? "",
          SpouseMobile: data.SpouseMobile ?? "",
          SpouseLandline: data.SpouseLandline ?? "",
        });
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedWorkerID]);





  useEffect(() => {
    let cancelled = false;
    const fetchWorker = async () => {
      const { data, error } = await supabase
        .from("workerpersonaldetails")
        .select("*")
        .eq("WorkerID", resolvedWorkerID)
        .single();

      if (!error && data && !cancelled) {
        setWorkerDetails(data);
      }
    };
    fetchWorker();
    return () => { cancelled = true };
  }, [resolvedWorkerID]);




  useEffect(() => {
    if (!resolvedIRN || !resolvedWorkerID) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);




        // reference data
        const [{ data: provinceData }, { data: providers }] = await Promise.all([
          supabase
            .from("dictionary")
            .select("DKey, DValue")
            .eq("DType", "Province"),
          supabase
            .from("insurancecompanymaster")
            .select("*"),
        ]);
        if (!cancelled) {
          setProvinces(provinceData || []);
          setInsuranceProviders(providers || []);
        }


        // worker personal details
        const { data: workerData } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", resolvedWorkerID)
          .maybeSingle();

        // spouse details
        const { data: spouseData } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", resolvedWorkerID)
          .maybeSingle();

        // employment details
        const { data: empData } = await supabase
          .from("currentemploymentdetails")
          .select("*")
          .eq("WorkerID", resolvedWorkerID)
          .maybeSingle();
        {/*
if (!cancelled) {
  if (workerData) {
    setFormData((prev) => ({
      ...prev,
      WorkerFirstName: s(workerData.WorkerFirstName),
      WorkerLastName: s(workerData.WorkerLastName),
      WorkerDOB: workerData.WorkerDOB,
      WorkerGender: s(workerData.WorkerGender),
      Nationality: s(workerData.Nationality),
      WorkerEmail: s(workerData.WorkerEmail),
      WorkerMobile: s(workerData.WorkerMobile),
      WorkerLandline: s(workerData.WorkerLandline),
      WorkerPOBox: s(workerData.WorkerPOBox),
      WorkerAddress1: s(workerData.WorkerAddress1),
      WorkerAddress2: s(workerData.WorkerAddress2),
	  WorkerPlaceOfOriginVillage: s(workerData.WorkerPlaceOfOriginVillage),
      WorkerPlaceOfOriginProvince: s(workerData.WorkerPlaceOfOriginProvince),
      WorkerPlaceOfOriginDistrict: s(workerData.WorkerPlaceOfOriginDistrict),
	  WorkerCity: s(workerData.WorkerCity),
      WorkerProvince: s(workerData.WorkerProvince),
    }));
  }

  if (spouseData) {
    setFormData((prev) => ({
      ...prev,
      SpouseFirstName: s(spouseData.SpouseFirstName),
      SpouseLastName: s(spouseData.SpouseLastName),
      SpouseDOB: spouseData.SpouseDOB,
      SpouseCity: s(spouseData.SpouseCity),
	  SpouseProvince: s(spouseData.SpouseProvince),
	  SpousePOBox: s(spouseData.SpousePOBox),
	  SpouseEmail: s(spouseData.SpouseEmail),
      SpouseMobile: s(spouseData.SpouseMobile),
      SpouseAddress1: s(spouseData.SpouseAddress1),
      SpouseAddress2: s(spouseData.SpouseAddress2),
	  SpouseLandline: s(spouseData.SpouseLandline),
    }));
  }

  if (empData) {
    setFormData((prev) => ({
      ...prev,
      PlaceOfEmployment: s(empData.PlaceOfEmployment),
      NatureOfEmployment: s(empData.NatureOfEmployment),
      SubContractorOrganizationName: empData.SubContractorOrganizationName,
      SubContractorLocation: empData.SubContractorLocation,
      SubContractorNatureOfBusiness: empData.SubContractorNatureOfBusiness,
      NatureOfInjury: s(empData.NatureOfInjury),
      CauseOfInjury: s(empData.CauseOfInjury),
    }));
  }
} */}

        // PATCH C — inside the initial load effect, after you fetch worker & employment
        // 1) also fetch form1112master (for Injury/Incident fields) + form4master (for scan+form fields)
        const [{ data: f1112 }, { data: f4row }] = await Promise.all([
          supabase
            .from("form1112master")
            .select("IncidentDate, IncidentProvince, IncidentRegion, InjuryCause, NatureExtentInjury, InsuranceProviderIPACode")
            .eq("IRN", resolvedIRN)
            .maybeSingle(),
          supabase
            .from("form4master")
            .select(`
      Form4ImageName,
      CompensationBenefitsPriorToDeath,
      AnnualEarningsAtDeath,
      CompensationBenefitDetails,
      MedicalExpenseDetails,
      FuneralExpenseDetails,
      IncidentDescription,
      ApplicantFirstName, ApplicantLastName,
      ApplicantAddress1, ApplicantAddress2,
      ApplicantCity, ApplicantProvince, ApplicantPOBox,
      ApplicantEmail, ApplicantMobile, ApplicantLandline,
      Form4SubmissionDate
    `)
            .eq("IRN", resolvedIRN)
            .maybeSingle(),
        ]);
        console.log("[NewForm4] f1112 snapshot", {
          IRN: resolvedIRN,
          InsuranceProviderIPACode: f1112?.InsuranceProviderIPACode,
        });

        // 2) build spouse snapshot explicitly from workerpersonaldetails (ensures values display)
        // Build spouse snapshot from workerpersonaldetails
        const spouseSnapshot = {
          SpouseFirstName: s((spouseData as any)?.SpouseFirstName),
          SpouseLastName: s((spouseData as any)?.SpouseLastName),
          SpouseDOB: s((spouseData as any)?.SpouseDOB),
          SpouseAddress1: s((spouseData as any)?.SpouseAddress1),
          SpouseAddress2: s((spouseData as any)?.SpouseAddress2),
          SpouseCity: s((spouseData as any)?.SpouseCity),
          SpouseProvince: s((spouseData as any)?.SpouseProvince),
          SpousePOBox: s((spouseData as any)?.SpousePOBox),
          SpouseEmail: s((spouseData as any)?.SpouseEmail),
          SpouseMobile: s((spouseData as any)?.SpouseMobile),
          SpouseLandline: s((spouseData as any)?.SpouseLandline),
        };


        const merged: Partial<Form4Data> = {
          ...base,
          WorkerID: String(resolvedWorkerID),
          // worker person
          WorkerFirstName: s((workerData as any)?.WorkerFirstName),
          WorkerLastName: s((workerData as any)?.WorkerLastName),
          WorkerAliasName: s((workerData as any)?.WorkerAliasName),
          WorkerDOB: s((workerData as any)?.WorkerDOB),
          WorkerGender: s((workerData as any)?.WorkerGender),
          WorkerMarried: s((workerData as any)?.WorkerMarried),
          WorkerHanded: s((workerData as any)?.WorkerHanded),
          WorkerAddress1: s((workerData as any)?.WorkerAddress1),
          WorkerAddress2: s((workerData as any)?.WorkerAddress2),
          WorkerCity: s((workerData as any)?.WorkerCity),
          WorkerProvince: s((workerData as any)?.WorkerProvince),
          WorkerPOBox: s((workerData as any)?.WorkerPOBox),
          WorkerEmail: s((workerData as any)?.WorkerEmail),
          WorkerMobile: s((workerData as any)?.WorkerMobile),
          WorkerLandline: s((workerData as any)?.WorkerLandline),
          WorkerPlaceOfOriginVillage: s((workerData as any)?.WorkerPlaceOfOriginVillage),
          WorkerPlaceOfOriginDistrict: s((workerData as any)?.WorkerPlaceOfOriginDistrict),
          WorkerPlaceOfOriginProvince: s((workerData as any)?.WorkerPlaceOfOriginProvince),
          WorkerPassportPhoto: s((workerData as any)?.WorkerPassportPhoto),

          // spouse
          ...spouseSnapshot,

          // employment snapshot
          PlaceOfEmployment: s((empData as any)?.PlaceOfEmployment),
          NatureOfEmployment: s((empData as any)?.NatureOfEmployment),
          SubContractorOrganizationName: s((empData as any)?.SubContractorOrganizationName),
          SubContractorLocation: s((empData as any)?.SubContractorLocation),
          SubContractorNatureOfBusiness: s((empData as any)?.SubContractorNatureOfBusiness),

          // form1112master → injury/incident
          IncidentDate: s((f1112 as any)?.IncidentDate),
          IncidentProvince: s((f1112 as any)?.IncidentProvince),
          IncidentRegion: s((f1112 as any)?.IncidentRegion),
          InjuryCause: s((f1112 as any)?.InjuryCause),
          NatureExtentInjury: s((f1112 as any)?.NatureExtentInjury),
          InsuranceProviderIPACode: s((f1112 as any)?.InsuranceProviderIPACode),

          // form4master snapshot
          AnnualEarningsAtDeath: Number((f4row as any)?.AnnualEarningsAtDeath || 0),
          CompensationBenefitsPriorToDeath: s((f4row as any)?.CompensationBenefitsPriorToDeath),
          CompensationBenefitDetails: s((f4row as any)?.CompensationBenefitDetails),
          MedicalExpenseDetails: s((f4row as any)?.MedicalExpenseDetails),
          FuneralExpenseDetails: s((f4row as any)?.FuneralExpenseDetails),
          IncidentDescription: s((f4row as any)?.IncidentDescription),
          ApplicantFirstName: s((f4row as any)?.ApplicantFirstName),
          ApplicantLastName: s((f4row as any)?.ApplicantLastName),
          ApplicantAddress1: s((f4row as any)?.ApplicantAddress1),
          ApplicantAddress2: s((f4row as any)?.ApplicantAddress2),
          ApplicantCity: s((f4row as any)?.ApplicantCity),
          ApplicantProvince: s((f4row as any)?.ApplicantProvince),
          ApplicantPOBox: s((f4row as any)?.ApplicantPOBox),
          ApplicantEmail: s((f4row as any)?.ApplicantEmail),
          ApplicantMobile: s((f4row as any)?.ApplicantMobile),
          ApplicantLandline: s((f4row as any)?.ApplicantLandline),

          ImageName: s((f4row as any)?.Form4ImageName || (f4row as any)?.ImageName || ''),
          Form4SubmissionDate: s((f4row as any)?.Form4SubmissionDate),
        };

        // ✅ right after you build `const merged: Partial<Form4Data> = { ... }`
        const ipa = String(f1112?.InsuranceProviderIPACode ?? "").trim();
        merged.InsuranceProviderIPACode = ipa;

        if (ipa && Array.isArray(providers) && providers.length) {
          const found = providers.find(
            (p: any) => String(p.IPACODE ?? "").trim().toUpperCase() === ipa.toUpperCase()
          );
          if (found) {
            merged.InsuranceProviderIPACode = String(found.IPACODE ?? "").trim();
            merged.InsuranceCompanyOrganizationName = found.InsuranceCompanyOrganizationName ?? "";
            merged.InsuranceCompanyAddress1 = found.InsuranceCompanyAddress1 ?? "";
            merged.InsuranceCompanyAddress2 = found.InsuranceCompanyAddress2 ?? "";
            merged.InsuranceCompanyCity = found.InsuranceCompanyCity ?? "";
            merged.InsuranceCompanyProvince = found.InsuranceCompanyProvince ?? "";
            merged.InsuranceCompanyPOBox = found.InsuranceCompanyPOBox ?? "";
            merged.InsuranceCompanyLandLine = found.InsuranceCompanyLandLine ?? "";
          }
        }



        const sanitized = sanitizeForForm(base, merged) as Form4Data;
        if (!cancelled) {
          setFormData(sanitized);
          setOriginalData(sanitized);


        }


        if (!cancelled) {
          setFormData(sanitized);
          setOriginalData(sanitized);
          console.log("[NewForm4] formData (post-sanitize)", {
            InsuranceProviderIPACode: sanitized.InsuranceProviderIPACode,

          });
        }

        console.log('IPACODE:', f1112.InsuranceProviderIPACode);

        // Passport preview
        const rawPassport = s((workerData as any)?.WorkerPassportPhoto);
        if (rawPassport) {
          const url = await getBestStorageUrl(rawPassport);
          if (!cancelled) setPassportUrl(url);
        }

        // Form 4 scan preview
        const scanPath = s((f4row as any)?.Form4ImageName || (f4row as any)?.ImageName || '');
        if (scanPath) {
          const url = await getBestStorageUrl(scanPath);
          if (!cancelled) setScanUrl(url);
        }


        // fetch existing dependants & work history by WorkerID
        const [{ data: depData }, { data: historyData }] = await Promise.all([
          supabase
            .from("dependantpersonaldetails")
            .select("*")
            .eq("WorkerID", resolvedWorkerID),
          supabase.from("workhistory").select("*").eq("WorkerID", resolvedWorkerID),
        ]);

        if (!cancelled) {
          const allDeps = depData || [];
          const typeOf = (x: any) => String(x?.DependantType || "").toLowerCase();

          // Dependent Details tab (Parent/Child/Sibling)
          const pcs = allDeps.filter((d: any) =>
            ["parent", "child", "sibling"].includes(typeOf(d))
          );

          // Other Dependants tab: 'Other'
          const others = allDeps.filter((d: any) => typeOf(d) === "other");

          // Nominees tab: 'Nominee'
          const noms = allDeps.filter((d: any) => typeOf(d) === "nominee");

          setDependants(pcs as any);
          setOtherDependants(others as any);
          setNominees(noms as any);
          setWorkHistory((historyData || []) as any);
          //setFormData((prev) => ({ ...prev, WorkerID: String(resolvedWorkerID) }));
        }

        // hydrate Form 4 attachments for this IRN
        await fetchAndHydrateAttachments(resolvedIRN!);
      } catch (e) {
        console.error("Initial load failed", e);
        if (!cancelled) setError("Failed to load form data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedIRN, resolvedWorkerID]);

  // map DB AttachmentType -> our keys (aligned with NewForm12)
  const attachmentTypeToKey: Record<string, string> = {
    "Death Certificate": "DC",
    "Post Mortem report": "PMR",
    "Section 43 application form": "SEC43",
    "Supervisor statement": "SS",
    "Witness statement": "WS",
    "Dependency declaration": "DD",
    "Payslip at time of accident": "PTA",
    "Police incident report": "PIR",
    "Funeral expenses receipts": "FER",
    "MedicalExpenses": "MEC",
    "MiscExpenses": "MISC",
    "Deductions": "DED",
    "Form 18 Scan": "F18",
  };

  const fetchAndHydrateAttachments = async (irn: number) => {
    try {
      const { data: rows, error } = await supabase
        .from("formattachments")
        .select("AttachmentType, FileName")
        .eq("IRN", irn);
      if (error) throw error;

      const newPaths: Partial<Form4Data> = {};
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

      if (Object.keys(newPaths).length) {
        setFormData((prev) => ({ ...prev, ...(newPaths as any) }));
      }
      if (Object.keys(previewUpdates).length) {
        setAttachmentPreviews((prev) => ({ ...prev, ...previewUpdates }));
      }
    } catch (e) {
      console.error("Failed to load attachments", e);
    }
  };

  // Auto-fill insurance address details when provider changes
  useEffect(() => {
    const code = String(formData.InsuranceProviderIPACode ?? "").trim().toUpperCase();
    if (!code || !insuranceProviders.length) return;

    const provider = insuranceProviders.find(
      (p: any) => String(p.IPACODE ?? "").trim().toUpperCase() === code
    );
    if (!provider) return;

    setFormData((prev) => ({
      ...prev,
      // normalize the code we store too
      InsuranceProviderIPACode: String(provider.IPACODE ?? "").trim(),
      InsuranceCompanyOrganizationName: provider.InsuranceCompanyOrganizationName ?? "",
      InsuranceCompanyAddress1: provider.InsuranceCompanyAddress1 ?? "",
      InsuranceCompanyAddress2: provider.InsuranceCompanyAddress2 ?? "",
      InsuranceCompanyCity: provider.InsuranceCompanyCity ?? "",
      InsuranceCompanyProvince: provider.InsuranceCompanyProvince ?? "",
      InsuranceCompanyPOBox: provider.InsuranceCompanyPOBox ?? "",
      InsuranceCompanyLandLine: provider.InsuranceCompanyLandLine ?? "",
    }));
  }, [formData.InsuranceProviderIPACode, insuranceProviders]);




  // NewForm4.tsx — Part 3 (handlers)
  //---------------------------------------------

  const handleEmploymentChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEmploymentDetails((prev: any) => ({ ...prev, [name]: value }));
  };

  const saveEmploymentDetails = async () => {
    if (!resolvedWorkerID) return;

    // Payloads
    const empPayload = {
      WorkerID: resolvedWorkerID,
      EmployerName: employmentDetails.EmployerName,
      WorkerOccupation: employmentDetails.WorkerOccupation,
      HireDate: employmentDetails.HireDate || null,
      TerminationDate: employmentDetails.TerminationDate || null,
      EmployerAddress1: employmentDetails.EmployerAddress1,
      EmployerAddress2: employmentDetails.EmployerAddress2,
      EmployerCity: employmentDetails.EmployerCity,
      EmployerProvince: employmentDetails.EmployerProvince,
      EmployerPOBox: employmentDetails.EmployerPOBox,
      EmployerEmail: employmentDetails.EmployerEmail,
      EmployerMobile: employmentDetails.EmployerMobile,
      EmployerLandline: employmentDetails.EmployerLandline,
    };

    const injuryPayload = {
      WorkerID: resolvedWorkerID,
      AccidentDate: employmentDetails.AccidentDate || null,
      AccidentPlace: employmentDetails.AccidentPlace,
      NatureOfInjury: employmentDetails.NatureOfInjury,
      CauseOfInjury: employmentDetails.CauseOfInjury,
    };

    // Save currentemploymentdetails
    const { data: existingEmp } = await supabase
      .from("currentemploymentdetails")
      .select("WorkerID")
      .eq("WorkerID", resolvedWorkerID)
      .maybeSingle();

    if (existingEmp) {
      await supabase.from("currentemploymentdetails").update(empPayload).eq("WorkerID", resolvedWorkerID);
    } else {
      await supabase.from("currentemploymentdetails").insert([empPayload]);
    }

    // Save accident/injury details in form4master
    await supabase.from("form4master")
      .update(injuryPayload)
      .eq("WorkerID", resolvedWorkerID);

    alert("Employment & Injury details saved!");
  };



  const copyWorkerAddressToSpouse = () => {
    setFormData((p) => ({
      ...p,
      SpouseAddress1: s(p.WorkerAddress1),
      SpouseAddress2: s(p.WorkerAddress2),
      SpouseCity: s(p.WorkerCity),
      SpouseProvince: s(p.WorkerProvince),
      SpousePOBox: s(p.WorkerPOBox),
      SpouseEmail: s(p.WorkerEmail),
      SpouseMobile: s(p.WorkerMobile),
      SpouseLandline: s(p.WorkerLandline),
    }));
  };


  const handleSpouseChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setSpouseDetails((prev: any) => ({ ...prev, [name]: value }));
  };

  // Optional helper if you want a single save button per-tab.
  // If you save everything in the big "Save Changes", call this from handleSubmit instead.
  const saveSpouseDetails = async () => {
    if (!resolvedWorkerID) return;
    const payload = {
      WorkerID: resolvedWorkerID,
      ...spouseDetails,
      SpouseDOB: spouseDetails.SpouseDOB || null,
    };

    // upsert by WorkerID
    const { data: existing } = await supabase
      .from("workerpersonaldetails")
      .select("WorkerID")
      .eq("WorkerID", resolvedWorkerID)
      .maybeSingle();

    const res = existing
      ? await supabase.from("workerpersonaldetails").update(payload).eq("WorkerID", resolvedWorkerID)
      : await supabase.from("workerpersonaldetails").insert([payload]);

    if ((res as any).error) {
      alert("Error saving spouse details: " + (res as any).error.message);
    } else {
      alert("Spouse details saved!");
    }
  };


  const handleNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof Form4Data
  ) => {
    const v = e.target.value;
    const num = v === "" ? 0 : Number(v);
    setFormData((prev) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
  };


  const handleWorkerChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setWorkerDetails((prev: any) => ({ ...prev, [name]: value }));
  };

  const saveWorkerDetails = async () => {
    const { error } = await supabase
      .from("workerpersonaldetails")
      .upsert([{ ...workerDetails, WorkerID: resolvedWorkerID }]);

    if (error) {
      alert("Error saving worker details: " + error.message);
    } else {
      alert("Worker personal details saved!");
    }
  };




  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Insurance lookups
  const loadInsuranceByIPACode = async (ipaCode?: string | null) => {
    try {
      console.log("[NewForm4] loadInsuranceByIPACode called", { ipaCode });
      if (!ipaCode) {
        setFormData((prev) => ({
          ...prev,
          InsuranceProviderIPACode: "",
          InsuranceCompanyOrganizationName: "",
          InsuranceCompanyAddress1: "",
          InsuranceCompanyAddress2: "",
          InsuranceCompanyCity: "",
          InsuranceCompanyProvince: "",
          InsuranceCompanyPOBox: "",
          InsuranceCompanyLandLine: "",
        }));
        console.log("[NewForm4] no ipaCode → cleared provider fields");
        return;
      }
      const { data: provider, error } = await supabase
        .from("insurancecompanymaster")
        .select(
          "IPACODE, InsuranceCompanyOrganizationName, InsuranceCompanyAddress1, InsuranceCompanyAddress2, InsuranceCompanyCity, InsuranceCompanyProvince, InsuranceCompanyPOBox, InsuranceCompanyLandLine"
        )
        .eq("IPACODE", ipaCode)
        .single();
      if (error) throw error;

      console.log("[NewForm4] provider lookup success", {
        IPACODE: provider?.IPACODE,
        InsuranceCompanyOrganizationName: provider?.InsuranceCompanyOrganizationName,
      });

      setFormData((prev) => ({
        ...prev,
        InsuranceProviderIPACode: provider?.IPACODE || "",
        InsuranceCompanyOrganizationName:
          provider?.InsuranceCompanyOrganizationName || "",
        InsuranceCompanyAddress1: provider?.InsuranceCompanyAddress1 || "",
        InsuranceCompanyAddress2: provider?.InsuranceCompanyAddress2 || "",
        InsuranceCompanyCity: provider?.InsuranceCompanyCity || "",
        InsuranceCompanyProvince: provider?.InsuranceCompanyProvince || "",
        InsuranceCompanyPOBox: provider?.InsuranceCompanyPOBox || "",
        InsuranceCompanyLandLine: provider?.InsuranceCompanyLandLine || "",
      }));
    } catch (e) {
      console.error("Insurance lookup failed", e);
    }
  };

  const handleInsuranceChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const code = e.target.value;
    await loadInsuranceByIPACode(code);
  };



  // storage folder mapping (mirrors NewForm12)
  const folderMapping: Record<string, string> = {
    ImageName: "attachments/form4scan/",
    DC: "attachments/formattachments/Deathcertificate/",
    PMR: "attachments/formattachments/Postmortemreport/",
    SEC43: "attachments/formattachments/SEC43/",
    SS: "attachments/formattachments/Supervisorstatement/",
    WS: "attachments/formattachments/Witnessstatement/",
    DD: "attachments/formattachments/Dependencedeclaration/",
    PTA: "attachments/formattachments/Payslipattimeofaccident/",
    PIR: "attachments/formattachments/Policeincidentreport/",
    FER: "attachments/formattachments/Funeralexpensereceipts/",
    MEC: "attachments/formattachments/MedicalExpenses/",
    MISC: "attachments/formattachments/MiscExpenses/",
    DED: "attachments/formattachments/Deductions/",
    F18: "attachments/formattachments/Form18scan/",
  };

  const genDatedName = (orig: string) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const datePrefix = `${dd}${mm}${yyyy}_${hh}${mi}${ss}`;
    const dot = orig.lastIndexOf(".");
    const base = (dot !== -1 ? orig.slice(0, dot) : orig).replace(/[^\w.-]+/g, "_");
    const ext = dot !== -1 ? orig.slice(dot + 1).toLowerCase() : "dat";
    return `${datePrefix}_${base}.${ext}`;
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: string
  ) => {
    const file = e.target.files?.[0];

    // clear old local preview
    if (fieldName === "ImageName" && scanLocalUrl) {
      try {
        URL.revokeObjectURL(scanLocalUrl);
      } catch { }
      setScanLocalUrl("");
    }
    if (attachmentLocalPreviews[fieldName]) {
      try {
        URL.revokeObjectURL(attachmentLocalPreviews[fieldName]);
      } catch { }
      setAttachmentLocalPreviews((prev) => {
        const x = { ...prev };
        delete x[fieldName];
        return x;
      });
    }

    if (!file) {
      setSelectedFiles((prev) => {
        const x = { ...prev };
        delete x[fieldName];
        return x;
      });
      setGeneratedFileNames((prev) => {
        const x = { ...prev };
        delete x[fieldName];
        return x;
      });
      setFormData((prev) => ({ ...prev, [fieldName]: "" } as any));
      return;
    }

    const newName = genDatedName(file.name);
    const folder = folderMapping[fieldName] || "attachments/form4scan/";
    const filePath = `${folder}${newName}`;

    setSelectedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setGeneratedFileNames((prev) => ({ ...prev, [fieldName]: newName }));
    setFormData((prev) => ({ ...prev, [fieldName]: filePath } as any));

    // local preview
    const looksImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp)$/i.test(file.name || "");
    if (looksImage) {
      const blobUrl = URL.createObjectURL(file);
      if (fieldName === "ImageName") setScanLocalUrl(blobUrl);
      else
        setAttachmentLocalPreviews((prev) => ({ ...prev, [fieldName]: blobUrl }));
    }
  };

  // ------- DB add/remove (all 3 tabs write to dependantpersonaldetails) -------
  const insertDependant = async (row: DependantRow) => {
    if (!resolvedWorkerID) return null;
    const payload = { WorkerID: resolvedWorkerID, ...row };
    const { data, error } = await supabase
      .from("dependantpersonaldetails")
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data as DependantRow;
  };

  const deleteDependant = async (row: DependantRow) => {
    if (row.id) {
      await supabase.from("dependantpersonaldetails").delete().eq("id", row.id);
    } else if (resolvedWorkerID) {
      await supabase
        .from("dependantpersonaldetails")
        .delete()
        .match({
          WorkerID: resolvedWorkerID,
          DependantFirstName: row.DependantFirstName,
          DependantLastName: row.DependantLastName,
          DependantDOB: row.DependantDOB ?? null,
          DependantType: row.DependantType ?? null,
        });
    }
  };

  // Dependent Details tab: type must be Parent/Child/Sibling ONLY (selector in UI)
  const addDep_PCS = async () => {
    if (!newDep.DependantFirstName || !newDep.DependantLastName) return;
    if (!["Parent", "Child", "Sibling"].includes(newDep.DependantType || "")) {
      setError("Dependant Type must be Parent/Child/Sibling.");
      return;
    }
    try {
      const data = await insertDependant(newDep);
      if (data) {
        setDependants((prev) => [...prev, data]);
        setNewDep(makeEmptyDependant("Child"));
      }
    } catch (e: any) {
      setError(e.message || "Failed to add dependant");
    }
  };

  // Other Dependants tab: force 'Other'
  const addDep_Other = async () => {
    if (!newOther.DependantFirstName || !newOther.DependantLastName) return;
    const payload = { ...newOther, DependantType: "Other" };
    try {
      const data = await insertDependant(payload);
      if (data) {
        setOtherDependants((prev) => [...prev, data]);
        setNewOther(makeEmptyDependant("Other"));
      }
    } catch (e: any) {
      setError(e.message || "Failed to add other dependant");
    }
  };

  // Nominees tab: force 'Nominee'
  const addDep_Nominee = async () => {
    if (!newNominee.DependantFirstName || !newNominee.DependantLastName) return;
    const payload = { ...newNominee, DependantType: "Nominee" };
    try {
      const data = await insertDependant(payload);
      if (data) {
        setNominees((prev) => [...prev, data]);
        setNewNominee(makeEmptyDependant("Nominee"));
      }
    } catch (e: any) {
      setError(e.message || "Failed to add nominee");
    }
  };

  const removeDep = async (row: DependantRow, which: "pcs" | "other" | "nom") => {
    try {
      await deleteDependant(row);
      if (which === "pcs")
        setDependants((prev) => prev.filter((d) => d !== row));
      else if (which === "other")
        setOtherDependants((prev) => prev.filter((d) => d !== row));
      else setNominees((prev) => prev.filter((d) => d !== row));
    } catch (e: any) {
      setError(e.message || "Failed to remove dependant");
    }
  };

  // ------- Work History (full table fields) -------
  const insertWorkHistory = async (row: WorkHistoryRow) => {
    if (!resolvedWorkerID) return null;
    const payload = { WorkerID: resolvedWorkerID, ...row };
    const { data, error } = await supabase
      .from("workhistory")
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data as WorkHistoryRow;
  };
  const addHistory = async () => {
    if (!newHistory.OrganizationName) return;
    try {
      const data = await insertWorkHistory(newHistory);
      if (data) {
        setWorkHistory((prev) => [...prev, data]);
        setNewHistory({
          OrganizationName: "",
          OrganizationAddress1: "",
          OrganizationAddress2: "",
          OrganizationCity: "",
          OrganizationProvince: "",
          OrganizationPOBox: "",
          OrganizationLandline: "",
          OrganizationCPPSID: "",
          WorkerJoiningDate: "",
          WorkerLeavingDate: "",
        });
      }
    } catch (e: any) {
      setError(e.message || "Failed to add work history");
    }
  };
  const removeHistory = async (row: WorkHistoryRow) => {
    try {
      if (row.id) {
        await supabase.from("workhistory").delete().eq("id", row.id);
      } else if (resolvedWorkerID) {
        await supabase
          .from("workhistory")
          .delete()
          .match({
            WorkerID: resolvedWorkerID,
            OrganizationName: row.OrganizationName,
            WorkerJoiningDate: row.WorkerJoiningDate ?? null,
          });
      }
      setWorkHistory((prev) => prev.filter((d) => d !== row));
    } catch (e: any) {
      setError(e.message || "Failed to remove work history row");
    }
  };


  console.log("Providers loaded:", insuranceProviders.length);
  console.log("Form IPA:", JSON.stringify(formData.InsuranceProviderIPACode));
  console.log(
    "Has match:",
    !!insuranceProviders.find(p =>
      String(p.IPACODE ?? "").trim().toUpperCase() ===
      String(formData.InsuranceProviderIPACode ?? "").trim().toUpperCase()
    )
  );




  // NewForm4.tsx — Part 4 (renderers)
  //-----------------------------------


  // shared dependant edit block (all fields from dependantpersonaldetails)
  const DependantEditor: React.FC<{
    row: DependantRow;
    setRow: (r: DependantRow) => void;
    typeContext: "pcs" | "other" | "nom";
  }> = ({ row, setRow, typeContext }) => {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {/* Type control: PCS shows selector Parent/Child/Sibling; Others/Nominees fixed */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            {typeContext === "pcs" ? (
              <select
                className="input"
                value={row.DependantType || "Child"}
                onChange={(e) => setRow({ ...row, DependantType: e.target.value })}
              >
                <option value="Parent">Parent</option>
                <option value="Child">Child</option>
                <option value="Sibling">Sibling</option>
              </select>
            ) : (
              <input
                className="input"
                value={typeContext === "other" ? "Other" : "Nominee"}
                readOnly
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <input
              className="input"
              value={row.DependantFirstName}
              onChange={(e) =>
                setRow({ ...row, DependantFirstName: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <input
              className="input"
              value={row.DependantLastName}
              onChange={(e) =>
                setRow({ ...row, DependantLastName: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">DOB</label>
            <input
              type="date"
              className="input"
              value={row.DependantDOB || ""}
              onChange={(e) => setRow({ ...row, DependantDOB: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select
              className="input"
              value={row.DependantGender || ""}
              onChange={(e) =>
                setRow({ ...row, DependantGender: e.target.value })
              }
            >
              <option value="">-</option>
              <option>M</option>
              <option>F</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Address 1"
            value={row.DependantAddress1 || ""}
            onChange={(e) =>
              setRow({ ...row, DependantAddress1: e.target.value })
            }
          />
          <input
            className="input"
            placeholder="Address 2"
            value={row.DependantAddress2 || ""}
            onChange={(e) =>
              setRow({ ...row, DependantAddress2: e.target.value })
            }
          />
          <input
            className="input"
            placeholder="City"
            value={row.DependantCity || ""}
            onChange={(e) => setRow({ ...row, DependantCity: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="input"
            placeholder="Province"
            value={row.DependantProvince || ""}
            onChange={(e) =>
              setRow({ ...row, DependantProvince: e.target.value })
            }
          />
          <input
            className="input"
            placeholder="P.O. Box"
            value={row.DependantPOBox || ""}
            onChange={(e) =>
              setRow({ ...row, DependantPOBox: e.target.value })
            }
          />
          <input
            className="input"
            placeholder="Email"
            value={row.DependantEmail || ""}
            onChange={(e) => setRow({ ...row, DependantEmail: e.target.value })}
          />
          <input
            className="input"
            placeholder="Mobile"
            value={row.DependantMobile || ""}
            onChange={(e) =>
              setRow({ ...row, DependantMobile: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Landline"
            value={row.DependantLandline || ""}
            onChange={(e) =>
              setRow({ ...row, DependantLandline: e.target.value })
            }
          />
          <input
            className="input"
            type="number"
            placeholder="Dependance Degree"
            value={row.DependanceDegree || 0}
            onChange={(e) =>
              setRow({
                ...row,
                DependanceDegree: Number(e.target.value || 0),
              })
            }
          />
        </div>
      </div>
    );
  };

  const DependantList: React.FC<{
    rows: DependantRow[];
    which: "pcs" | "other" | "nom";
  }> = ({ rows, which }) => (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div
          key={`${which}-${row.id ?? idx}-${row.DependantFirstName}-${row.DependantLastName}`}
          className="border rounded-lg p-3 flex items-center justify-between"
        >
          <div>
            <div className="font-medium">
              {row.DependantFirstName} {row.DependantLastName}
            </div>
            <div className="text-xs text-gray-600">
              {row.DependantType || ""} • {row.DependantDOB || ""}
            </div>
          </div>
          <button
            type="button"
            className="text-red-600 hover:opacity-80"
            onClick={() => removeDep(row, which)}
          >
            <Trash2 className="inline h-4 w-4 mr-1" />
            Remove
          </button>
        </div>
      ))}
    </div>
  );


  // --- Worker Personal Details ---
  // ── Worker Personal Details (read-only snapshot, NewForm12 style) ─────────────
  const renderWorkerPersonalDetails = () => (
    <div className="space-y-4">
      {/* Worker ID + Passport photo (thumbnail + lightbox) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker ID</label>
          <input type="text" className="input" value={String(resolvedWorkerID ?? "")} readOnly />
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

      {/* Name / DOB */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker First Name</label>
          <input className="input" value={s(formData.WorkerFirstName)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Last Name</label>
          <input className="input" value={s(formData.WorkerLastName)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date Of Birth</label>
          <input type="date" className="input" value={s(formData.WorkerDOB)} readOnly />
        </div>
      </div>

      {/* Gender / Married / Hand */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Gender</label>
          <select name="WorkerGender" value={formData.WorkerGender} onChange={handleInputChange} className="input" disabled>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Married</label>
          <select name="WorkerMarried" value={formData.WorkerMarried} onChange={handleInputChange} className="input" disabled>
            <option value="1">Married</option>
            <option value="0">Single</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Hand</label>
          <select name="WorkerHanded" value={formData.WorkerHanded} onChange={handleInputChange} className="input" disabled>
            <option value="Right">Right</option>
            <option value="Left">Left</option>
          </select>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Address1</label>
          <input className="input" value={s(formData.WorkerAddress1)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Address2</label>
          <input className="input" value={s(formData.WorkerAddress2)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker City</label>
          <input className="input" value={s(formData.WorkerCity)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Province</label>
          <input className="input" value={s(formData.WorkerProvince)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker POBox</label>
          <input className="input" value={s(formData.WorkerPOBox)} readOnly />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Email</label>
          <input type="email" className="input" value={s(formData.WorkerEmail)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Mobile</label>
          <input className="input" value={s(formData.WorkerMobile)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Landline</label>
          <input className="input" value={s(formData.WorkerLandline)} readOnly />
        </div>
      </div>

      {/* Place of origin */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Place Of Origin Village</label>
          <input className="input" value={s(formData.WorkerPlaceOfOriginVillage)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Place Of Origin District</label>
          <input className="input" value={s(formData.WorkerPlaceOfOriginDistrict)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Worker Place Of Origin Province</label>
          <input className="input" value={s(formData.WorkerPlaceOfOriginProvince)} readOnly />
        </div>
      </div>
    </div>
  );

  // --- Employment & Injury ---
  // ── Employment & Injury (NewForm12 look) ──────────────────────────────────────
  const renderEmploymentInjury = () => (
    <div className="space-y-4">
      {/* Read-only employment snapshot */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Place Of Employment</label>
        <input className="input" name="PlaceOfEmployment" value={s(formData.PlaceOfEmployment)} readOnly />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature Of Employment</label>
        <input className="input" name="NatureOfEmployment" value={s(formData.NatureOfEmployment)} readOnly />
      </div>

      {/* Sub-contractor (editable; saved via handleSubmit into form4master subset) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">SubContractor Organization Name</label>
          <input className="input" name="SubContractorOrganizationName" value={s(formData.SubContractorOrganizationName)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">SubContractor Location</label>
          <input className="input" name="SubContractorLocation" value={s(formData.SubContractorLocation)} onChange={handleInputChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">SubContractor Nature Of Business</label>
          <input className="input" name="SubContractorNatureOfBusiness" value={s(formData.SubContractorNatureOfBusiness)} onChange={handleInputChange} />
        </div>
      </div>

      {/* Province/Region & Incident Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Province</label>
          <select className="input" name="IncidentProvince" value={s(formData.IncidentProvince)} onChange={handleInputChange}>
            <option value="">Select Province</option>
            {provinces.map((p) => (
              <option key={p.DValue} value={p.DValue}>{p.DValue}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Region</label>
          <input className="input" name="IncidentRegion" value={s(formData.IncidentRegion)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Incident Date</label>
          <input type="date" className="input" name="IncidentDate" value={s(formData.IncidentDate)} onChange={handleInputChange} />
        </div>
      </div>

      {/* Injury cause / extent / description (editable) */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Cause Of The Injury</label>
        <input className="input" name="InjuryCause" value={s((formData as any).InjuryCause)} onChange={handleInputChange} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature And Extent Of Injury</label>
        <input className="input" name="NatureExtentInjury" value={s((formData as any).NatureExtentInjury)} onChange={handleInputChange} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description Of Incident</label>
        <textarea className="input" rows={3} name="IncidentDescription" value={s(formData.IncidentDescription)} onChange={handleInputChange} />
      </div>

      <div className="flex items-center">
        <input
          id="GradualProcessInjury"
          name="GradualProcessInjury"
          type="checkbox"
          className="h-4 w-4 text-primary border-gray-300 rounded"
          checked={b((formData as any).GradualProcessInjury)}
          onChange={(e) =>
            setFormData((p) => ({ ...p, GradualProcessInjury: (e.target as HTMLInputElement).checked } as any))
          }
        />
        <label htmlFor="GradualProcessInjury" className="ml-2 block text-sm text-gray-900">
          Gradual Process Injury
        </label>
      </div>
    </div>
  );



  // --- Spouse Details ---
  const renderSpouseDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse First Name</label>
          <input className="input" value={s(formData.SpouseFirstName)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Last Name</label>
          <input className="input" value={s(formData.SpouseLastName)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse DOB</label>
          <input type="date" className="input" value={s(formData.SpouseDOB)} readOnly />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Same As Worker Address</label>
          <div>
            <button type="button" onClick={copyWorkerAddressToSpouse} className="px-3 py-1.5 rounded bg-gray-900 text-white">
              Copy Worker Address
            </button>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address1</label>
          <input className="input" value={s(formData.SpouseAddress1)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Address2</label>
          <input className="input" value={s(formData.SpouseAddress2)} readOnly />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse City</label>
          <input className="input" value={s(formData.SpouseCity)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Province</label>
          <input className="input" value={s(formData.SpouseProvince)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse POBox</label>
          <input className="input" value={s(formData.SpousePOBox)} readOnly />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Email</label>
          <input type="email" className="input" value={s(formData.SpouseEmail)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Mobile</label>
          <input className="input" value={s(formData.SpouseMobile)} readOnly />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Spouse Landline</label>
          <input className="input" value={s(formData.SpouseLandline)} readOnly />
        </div>
      </div>
    </div>
  );

  const renderDependantsTab = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Add Parent / Child / Sibling. Saves to <code>dependantpersonaldetails</code>.
      </p>
      <DependantEditor
        row={newDep}
        setRow={(r) => setNewDep(r)}
        typeContext="pcs"
      />
      <div className="flex justify-end">
        <button
          type="button"
          className="px-3 py-2 bg-gray-900 text-white rounded"
          onClick={addDep_PCS}
        >
          <Plus className="inline h-4 w-4 mr-1" />
          Add
        </button>
      </div>
      <DependantList rows={dependants} which="pcs" />
    </div>
  );

  const renderOtherDependantsTab = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Add other dependants (type is fixed to <b>Other</b>). Saves to{" "}
        <code>dependantpersonaldetails</code>.
      </p>
      <DependantEditor
        row={{ ...newOther, DependantType: "Other" }}
        setRow={(r) => setNewOther({ ...r, DependantType: "Other" })}
        typeContext="other"
      />
      <div className="flex justify-end">
        <button
          type="button"
          className="px-3 py-2 bg-gray-900 text-white rounded"
          onClick={addDep_Other}
        >
          <Plus className="inline h-4 w-4 mr-1" />
          Add
        </button>
      </div>
      <DependantList rows={otherDependants} which="other" />
    </div>
  );

  const renderNomineesTab = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Add nominees (type is fixed to <b>Nominee</b>). Saves to{" "}
        <code>dependantpersonaldetails</code>.
      </p>
      <DependantEditor
        row={{ ...newNominee, DependantType: "Nominee" }}
        setRow={(r) => setNewNominee({ ...r, DependantType: "Nominee" })}
        typeContext="nom"
      />
      <div className="flex justify-end">
        <button
          type="button"
          className="px-3 py-2 bg-gray-900 text-white rounded"
          onClick={addDep_Nominee}
        >
          <Plus className="inline h-4 w-4 mr-1" />
          Add
        </button>
      </div>
      <DependantList rows={nominees} which="nom" />
    </div>
  );

  const renderWorkHistory = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Full set of fields per <code>workhistory</code> table.
      </p>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Organization Name"
            value={newHistory.OrganizationName}
            onChange={(e) =>
              setNewHistory({ ...newHistory, OrganizationName: e.target.value })
            }
          />
          <input
            type="date"
            className="input"
            value={newHistory.WorkerJoiningDate || ""}
            onChange={(e) =>
              setNewHistory({ ...newHistory, WorkerJoiningDate: e.target.value })
            }
          />
          <input
            type="date"
            className="input"
            value={newHistory.WorkerLeavingDate || ""}
            onChange={(e) =>
              setNewHistory({ ...newHistory, WorkerLeavingDate: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Address 1"
            value={newHistory.OrganizationAddress1 || ""}
            onChange={(e) =>
              setNewHistory({
                ...newHistory,
                OrganizationAddress1: e.target.value,
              })
            }
          />
          <input
            className="input"
            placeholder="Address 2"
            value={newHistory.OrganizationAddress2 || ""}
            onChange={(e) =>
              setNewHistory({
                ...newHistory,
                OrganizationAddress2: e.target.value,
              })
            }
          />
          <input
            className="input"
            placeholder="City"
            value={newHistory.OrganizationCity || ""}
            onChange={(e) =>
              setNewHistory({ ...newHistory, OrganizationCity: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="input"
            placeholder="Province"
            value={newHistory.OrganizationProvince || ""}
            onChange={(e) =>
              setNewHistory({
                ...newHistory,
                OrganizationProvince: e.target.value,
              })
            }
          />
          <input
            className="input"
            placeholder="P.O. Box"
            value={newHistory.OrganizationPOBox || ""}
            onChange={(e) =>
              setNewHistory({ ...newHistory, OrganizationPOBox: e.target.value })
            }
          />
          <input
            className="input"
            placeholder="Landline"
            value={newHistory.OrganizationLandline || ""}
            onChange={(e) =>
              setNewHistory({
                ...newHistory,
                OrganizationLandline: e.target.value,
              })
            }
          />
          <input
            className="input"
            placeholder="Organization CPPSID"
            value={newHistory.OrganizationCPPSID || ""}
            onChange={(e) =>
              setNewHistory({
                ...newHistory,
                OrganizationCPPSID: e.target.value,
              })
            }
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="px-3 py-2 bg-gray-900 text-white rounded"
            onClick={addHistory}
          >
            <Plus className="inline h-4 w-4 mr-1" /> Add
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {workHistory.map((row, idx) => (
          <div
            key={row.id ?? `${row.OrganizationName}-${idx}`}
            className="border rounded-lg p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{row.OrganizationName}</div>
                <div className="text-xs text-gray-600">
                  {row.WorkerJoiningDate || "—"} → {row.WorkerLeavingDate || "Present"}
                </div>
              </div>
              <button
                type="button"
                className="text-red-600 hover:opacity-80"
                onClick={() => removeHistory(row)}
              >
                <Trash2 className="inline h-4 w-4 mr-1" />
                Remove
              </button>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {row.OrganizationAddress1 || ""}
              {row.OrganizationAddress2 ? `, ${row.OrganizationAddress2}` : ""}
              {row.OrganizationCity ? `, ${row.OrganizationCity}` : ""}
              {row.OrganizationProvince ? `, ${row.OrganizationProvince}` : ""}
              {row.OrganizationPOBox ? ` · PO Box: ${row.OrganizationPOBox}` : ""}
              {row.OrganizationLandline ? ` · Landline: ${row.OrganizationLandline}` : ""}
              {row.OrganizationCPPSID ? ` · CPPSID: ${row.OrganizationCPPSID}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCompensation = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Annual Earnings at Death
          </label>
          <input
            className="input"
            type="number"
            step="any"
            name="AnnualEarningsAtDeath"
            value={n(formData.AnnualEarningsAtDeath)}
            onChange={(e) => handleNumberChange(e, "AnnualEarningsAtDeath")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Compensation Benefits Prior to Death
          </label>
          <select
            className="input"
            name="CompensationBenefitsPriorToDeath"
            value={s(formData.CompensationBenefitsPriorToDeath)}
            onChange={handleInputChange}
          >
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Compensation Benefit Details
        </label>
        <textarea
          className="input"
          rows={3}
          name="CompensationBenefitDetails"
          value={s(formData.CompensationBenefitDetails)}
          onChange={handleInputChange}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Compensation Claimed
          </label>
          <textarea
            className="input"
            rows={3}
            name="CompensationClaimed"
            value={s(formData.CompensationClaimed)}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Incident/Death Description
          </label>
          <textarea
            className="input"
            rows={3}
            name="IncidentDescription"
            value={s(formData.IncidentDescription)}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Medical Expense Details
          </label>
          <textarea
            className="input"
            rows={3}
            name="MedicalExpenseDetails"
            value={s(formData.MedicalExpenseDetails)}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Funeral Expense Details
          </label>
          <textarea
            className="input"
            rows={3}
            name="FuneralExpenseDetails"
            value={s(formData.FuneralExpenseDetails)}
            onChange={handleInputChange}
          />
        </div>
      </div>
    </div>
  );

  const renderInsuranceDetails = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Insurance Provider
        </label>
        <select
          className="input"
          name="InsuranceProviderIPACode"
          value={String(formData.InsuranceProviderIPACode ?? "").trim()}
          onChange={handleInsuranceChange}
        >
          <option value="">Select Insurance Provider</option>
          {insuranceProviders.map((p) => (
            <option
              key={String(p.IPACODE)}
              value={String(p.IPACODE ?? "").trim()}
            >
              {p.InsuranceCompanyOrganizationName}
            </option>
          ))}
        </select>

      </div>

      {formData.InsuranceProviderIPACode && (
        <>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address Line 1
              </label>
              <textarea
                className="input"
                rows={3}
                name="InsuranceCompanyAddress1"
                value={s(formData.InsuranceCompanyAddress1)}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address Line 2
              </label>
              <textarea
                className="input"
                rows={3}
                name="InsuranceCompanyAddress2"
                value={s(formData.InsuranceCompanyAddress2)}
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                className="input"
                name="InsuranceCompanyCity"
                value={s(formData.InsuranceCompanyCity)}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Province
              </label>
              <input
                className="input"
                name="InsuranceCompanyProvince"
                value={s(formData.InsuranceCompanyProvince)}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                P.O. Box
              </label>
              <input
                className="input"
                name="InsuranceCompanyPOBox"
                value={s(formData.InsuranceCompanyPOBox)}
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Landline
            </label>
            <input
              className="input"
              name="InsuranceCompanyLandLine"
              value={s(formData.InsuranceCompanyLandLine)}
              readOnly
            />
          </div>
        </>
      )}
    </div>
  );

  // ── Details of Applicant (NewForm12 look) ─────────────────────────────────────
  const renderApplicantDetails = () => (
    <div className="space-y-4">
      {/* Names */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input
            className="input"
            name="ApplicantFirstName"
            value={s(formData.ApplicantFirstName)}
            onChange={handleInputChange}
            placeholder="Applicant first name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input
            className="input"
            name="ApplicantLastName"
            value={s(formData.ApplicantLastName)}
            onChange={handleInputChange}
            placeholder="Applicant last name"
          />
        </div>
      </div>

      {/* Same-as checkbox */}
      <div className="flex items-center gap-2">
        <input
          id="ApplicantSameAsWorker"
          type="checkbox"
          className="h-4 w-4 text-primary border-gray-300 rounded"
          checked={applicantSameAsWorker}
          onChange={(e) => copyWorkerAddressToApplicant(e.target.checked)}
        />
        <label htmlFor="ApplicantSameAsWorker" className="text-sm text-gray-900">
          Same As WorkerAddress
        </label>
      </div>

      {/* Address lines */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address1</label>
          <input
            className="input"
            name="ApplicantAddress1"
            value={s(formData.ApplicantAddress1)}
            onChange={handleInputChange}
            placeholder="Address line 1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address2</label>
          <input
            className="input"
            name="ApplicantAddress2"
            value={s(formData.ApplicantAddress2)}
            onChange={handleInputChange}
            placeholder="Address line 2"
          />
        </div>
      </div>

      {/* City / Province / PO Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input
            className="input"
            name="ApplicantCity"
            value={s(formData.ApplicantCity)}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <select
            className="input"
            name="ApplicantProvince"
            value={s(formData.ApplicantProvince)}
            onChange={handleInputChange}
          >
            <option value="">--Select Province--</option>
            {provinces.map((p) => (
              <option key={p.DValue} value={p.DValue}>
                {p.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">PO Box</label>
          <input
            className="input"
            name="ApplicantPOBox"
            value={s(formData.ApplicantPOBox)}
            onChange={handleInputChange}
          />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            className="input"
            type="email"
            name="ApplicantEmail"
            value={s(formData.ApplicantEmail)}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input
            className="input"
            type="tel"
            name="ApplicantMobile"
            value={s(formData.ApplicantMobile)}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input
            className="input"
            type="tel"
            name="ApplicantLandline"
            value={s(formData.ApplicantLandline)}
            onChange={handleInputChange}
          />
        </div>
      </div>
    </div>
  );




  const renderFormScan = () => (
    <div className="space-y-2">
      {s(formData.ImageName) && (
        <p className="text-xs text-gray-600">
          Current scan: <span className="font-mono">{s(formData.ImageName)}</span>
        </p>
      )}

      {(scanLocalUrl || scanUrl) && (
        isImagePath(s(formData.ImageName)) ? (
          <div className="mt-2">
            <img
              src={scanLocalUrl || scanUrl}
              alt="Form 4 scan preview"
              className="w-40 h-40 rounded object-cover border"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="mt-2">
            <a href={scanUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
              Open current scan
            </a>
          </div>
        )
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Replace Form 4 Scan</label>
        <input
          className="input"
          type="file"
          name="ImageName"
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={(e) => handleFileChange(e, "ImageName")}
        />
        <p className="text-xs text-gray-500">Leave empty to keep the existing scan.</p>
      </div>
    </div>
  );


  const renderSupportingDocuments = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Attach new files to add them as additional attachments. Existing ones will be
        retained.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "DC", label: "Death Certificate" },
          { key: "PMR", label: "Post Mortem Report" },
          { key: "SEC43", label: "Section 43 application form" },
          { key: "SS", label: "Supervisor Statement" },
          { key: "WS", label: "Witness Statement" },
          { key: "DD", label: "Dependency Declaration" },
          { key: "PTA", label: "Payslip at time of accident" },
          { key: "PIR", label: "Police Incident Report" },
          { key: "FER", label: "Funeral Expense Receipts" },
          { key: "MEC", label: "Medical Expenses" },
          { key: "MISC", label: "Misc Expenses" },
          { key: "DED", label: "Deductions" },
          { key: "F18", label: "Form 18 Scan" },
        ].map(({ key, label }) => {
          const pathVal = s((formData as any)[key]);
          const preview = attachmentLocalPreviews[key] || attachmentPreviews[key];
          const hasPreview = !!preview;
          return (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {label}
              </label>

              {hasPreview ? (
                isImagePath(pathVal) ? (
                  <img
                    src={preview}
                    alt={`${label} preview`}
                    className="w-28 h-28 object-cover rounded border"
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

              <input
                className="input"
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(e) => handleFileChange(e as any, key)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  // Tabs
  const tabs = [
    'Deceased Worker Details',       // -> renderWorkerPersonalDetails()
    'Employment & Injury',           // -> renderEmploymentInjury()
    'Work History',
    'Spouse Details',                // -> renderSpouseDetails()
    'Dependent Details',
    'Other Dependants',
    'Nominee Details',
    'Compensation Claimed',
    'Insurance Details',
    'Details of Applicant',
    'Form 4 Scan',
    'Supporting Documents',
  ];

  const renderTabContent = () => {
    switch (currentTab) {
      case 1: return renderWorkerPersonalDetails();
      case 2: return renderEmploymentInjury();
      case 3: return renderWorkHistory();
      case 4: return renderSpouseDetails();
      case 5: return renderDependantsTab();
      case 6: return renderOtherDependantsTab();
      case 7: return renderNomineesTab();
      case 8: return renderCompensation();
      case 9: return renderInsuranceDetails();
      case 10: return renderApplicantDetails();   // ✅ was Insurance before
      case 11: return renderFormScan();           // ✅ was Applicant before
      case 12: return renderSupportingDocuments();
      default: return null;
    }
  };


  // NewForm4.tsx — Part 5 (submit, shell, export)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!resolvedIRN || !resolvedWorkerID) throw new Error("IDs not ready.");

      // 1) Upload any newly selected files
      const uploadedPaths: Record<string, string> = {};
      for (const [fieldName, file] of Object.entries(selectedFiles)) {
        const gen = generatedFileNames[fieldName];
        if (!file || !gen) continue;
        const folder = folderMapping[fieldName] || "attachments/form4scan/";
        const fullPath = `${folder}${gen}`;
        const { error: upErr } = await supabase.storage.from("cpps").upload(fullPath, file);
        if (upErr) throw new Error(`Failed to upload ${fieldName}: ${upErr.message}`);
        uploadedPaths[fieldName] = fullPath;
      }

      // 2) Compute TimeBarred (1yr from IncidentDate)
      let isTimeBarred = false;
      if (formData.IncidentDate) {
        const incidentDate = new Date(formData.IncidentDate);
        const today = new Date();
        const daysDiff = Math.floor((today.getTime() - incidentDate.getTime()) / (1000 * 60 * 60 * 24));
        isTimeBarred = daysDiff > 365;
      }

      // 3) Build form4master upsert payload
      const cbRaw = String(formData.CompensationBenefitsPriorToDeath ?? "").trim().toLowerCase();
      const cb10 = cbRaw === "yes" || cbRaw === "1" || cbRaw === "true" ? 1 : 0;

      const upsertPayload: any = {
        WorkerID: resolvedWorkerID,
        IRN: resolvedIRN,

        CompensationBenefitsPriorToDeath: cb10,
        AnnualEarningsAtDeath: Number(formData.AnnualEarningsAtDeath || 0),
        CompensationBenefitDetails: s(formData.CompensationBenefitDetails),
        MedicalExpenseDetails: s(formData.MedicalExpenseDetails),
        FuneralExpenseDetails: s(formData.FuneralExpenseDetails),
        IncidentDescription: s(formData.IncidentDescription),
        CompensationClaimed: s(formData.CompensationClaimed),

        ApplicantFirstName: s(formData.ApplicantFirstName),
        ApplicantLastName: s(formData.ApplicantLastName),
        ApplicantAddress1: s(formData.ApplicantAddress1),
        ApplicantAddress2: s(formData.ApplicantAddress2),
        ApplicantCity: s(formData.ApplicantCity),
        ApplicantProvince: s(formData.ApplicantProvince),
        ApplicantPOBox: s(formData.ApplicantPOBox),
        ApplicantEmail: s(formData.ApplicantEmail),
        ApplicantMobile: s(formData.ApplicantMobile),
        ApplicantLandline: s(formData.ApplicantLandline),

        Form4SubmissionDate: formData.Form4SubmissionDate || new Date().toISOString(),

      };

      // include new Form 4 scan if uploaded this run
      if (uploadedPaths.ImageName) upsertPayload.Form4ImageName = uploadedPaths.ImageName;

      // 4) Upsert form4master
      const { data: f4existing } = await supabase
        .from("form4master").select("F4MRecordID").eq("IRN", resolvedIRN).maybeSingle();

      let f4res;
      if (f4existing?.F4MRecordID) {
        f4res = await supabase.from("form4master").update(upsertPayload).eq("IRN", resolvedIRN).select().single();
      } else {
        f4res = await supabase.from("form4master").insert([upsertPayload]).select().single();
      }
      if (f4res.error) throw f4res.error;

      // 4.5) Record in prescreeningreview
      await recordPrescreening(Number(resolvedIRN), "Form4", "Pending");

      // 5) Insert new supporting docs rows for newly uploaded fields
      const attachmentMap: Record<string, string> = {
        DC: "Death Certificate",
        PMR: "Post Mortem report",
        SEC43: "Section 43 application form",
        SS: "Supervisor statement",
        WS: "Witness statement",
        DD: "Dependency declaration",
        PTA: "Payslip at time of accident",
        PIR: "Police incident report",
        FER: "Funeral expenses receipts",
        MEC: "MedicalExpenses",
        MISC: "MiscExpenses",
        DED: "Deductions",
        F18: "Form 18 Scan",
      };
      for (const k of Object.keys(attachmentMap)) {
        const path = uploadedPaths[k];
        if (!path) continue;
        const { error: aErr } = await supabase.from("formattachments").insert([
          { IRN: resolvedIRN, AttachmentType: attachmentMap[k], FileName: path },
        ]);
        if (aErr) throw aErr;
      }

      // 6) Persist any Worker/Spouse edits back to workerpersonaldetails (spouse lives here)
      const workerPayload = {
        WorkerID: resolvedWorkerID,
        WorkerFirstName: s(formData.WorkerFirstName),
        WorkerLastName: s(formData.WorkerLastName),
        WorkerDOB: formData.WorkerDOB || null,
        WorkerGender: s(formData.WorkerGender),
        WorkerMarried: s(formData.WorkerMarried),
        WorkerHanded: s(formData.WorkerHanded),
        WorkerAddress1: s(formData.WorkerAddress1),
        WorkerAddress2: s(formData.WorkerAddress2),
        WorkerCity: s(formData.WorkerCity),
        WorkerProvince: s(formData.WorkerProvince),
        WorkerPOBox: s(formData.WorkerPOBox),
        WorkerEmail: s(formData.WorkerEmail),
        WorkerMobile: s(formData.WorkerMobile),
        WorkerLandline: s(formData.WorkerLandline),

        // spouse cols on the same table
        SpouseFirstName: s(formData.SpouseFirstName),
        SpouseLastName: s(formData.SpouseLastName),
        SpouseDOB: formData.SpouseDOB || null,
        SpouseAddress1: s(formData.SpouseAddress1),
        SpouseAddress2: s(formData.SpouseAddress2),
        SpouseCity: s(formData.SpouseCity),
        SpouseProvince: s(formData.SpouseProvince),
        SpousePOBox: s(formData.SpousePOBox),
        SpouseEmail: s(formData.SpouseEmail),
        SpouseMobile: s(formData.SpouseMobile),
        SpouseLandline: s(formData.SpouseLandline),
      };

      const { data: existingWorker } = await supabase
        .from("workerpersonaldetails")
        .select("WorkerID")
        .eq("WorkerID", resolvedWorkerID)
        .maybeSingle();

      if (existingWorker) {
        await supabase.from("workerpersonaldetails").update(workerPayload).eq("WorkerID", resolvedWorkerID);
      } else {
        await supabase.from("workerpersonaldetails").insert([workerPayload]);
      }

      setSuccess("Form 4 saved successfully!");
      onClose();

    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save the form.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">New Form 4</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
                {success}
              </div>
            )}

            <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCurrentTab(index + 1)}
                  className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${currentTab === index + 1
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {renderTabContent()}

            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewForm4;
