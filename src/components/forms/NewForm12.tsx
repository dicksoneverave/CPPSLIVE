import React, { useEffect, useState} from "react";
import { X, Printer } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useCallback } from "react";

// ---- helpers (ported from NewForm11) ----
const normalizeStoragePath = (p?: string) => {
  if (!p) return "";
  if (p.startsWith("http")) return p; // already a URL
  let s = p.replace(/^\/+/, ""); // remove leading slash(es)
  s = s.replace(/^(?:cpps\/)+/i, ""); // remove leading "cpps/" (even repeated)
  return s; // return bucket-relative path only
};

// put under normalizeStoragePath
const isImagePath = (p?: string) => /\.(png|jpe?g|gif|webp)$/i.test(p || "");

// Safe accessors (ported from NewForm11)
const s = (v: unknown) => (v ?? "") as string; // strings/dates/selects/textarea
const b = (v: unknown) => !!v; // checkboxes

const resolveStorageUrl = async (rawPath: string): Promise<string | null> => {
  try {
    if (!rawPath) return null;
    if (/^https?:\/\//i.test(rawPath)) return rawPath; // already a URL
    const path = normalizeStoragePath(rawPath);
    if (!path) return null;
    const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
    const { data: signed } = await supabase.storage.from("cpps").createSignedUrl(path, 60 * 60 * 24);
    return signed?.signedUrl ?? null;
  } catch (e) {
    console.error("resolveStorageUrl failed for", rawPath, e);
    return null;
  }
};

// Mirror of NewForm11: load insurance company details by IPA code
const loadInsuranceByIPACode = async (ipaCode?: string | null) => {
  try {
    if (!ipaCode) {
      setFormData(prev => ({
        ...prev,
        InsuranceProviderIPACode: '',
        InsuranceCompanyOrganizationName: '',
        InsuranceCompanyAddress1: '',
        InsuranceCompanyAddress2: '',
        InsuranceCompanyCity: '',
        InsuranceCompanyProvince: '',
        InsuranceCompanyPOBox: '',
        InsuranceCompanyLandLine: '',
      }));
      return;
    }

    const { data: provider, error: providerErr } = await supabase
      .from('insurancecompanymaster')
      .select(
        'IPACODE, InsuranceCompanyOrganizationName, InsuranceCompanyAddress1, InsuranceCompanyAddress2, InsuranceCompanyCity, InsuranceCompanyProvince, InsuranceCompanyPOBox, InsuranceCompanyLandLine'
      )
      .eq('IPACODE', ipaCode)
      .single();

    if (providerErr) throw providerErr;

    setFormData(prev => ({
      ...prev,
      InsuranceProviderIPACode: provider.IPACODE,
      InsuranceCompanyOrganizationName: provider.InsuranceCompanyOrganizationName || '',
      InsuranceCompanyAddress1: provider.InsuranceCompanyAddress1 || '',
      InsuranceCompanyAddress2: provider.InsuranceCompanyAddress2 || '',
      InsuranceCompanyCity: provider.InsuranceCompanyCity || '',
      InsuranceCompanyProvince: provider.InsuranceCompanyProvince || '',
      InsuranceCompanyPOBox: provider.InsuranceCompanyPOBox || '',
      InsuranceCompanyLandLine: provider.InsuranceCompanyLandLine || '',
    }));
  } catch (e) {
    console.error('Failed to load insurance by IPACode (Form12):', e);
  }
};



interface NewForm12Props {
  workerId: string;
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

// Save-summary modal (ported + typed)
interface SaveSummary {
  irn: number | string;
  crn: string;
  incidentType: string;
  submitDate: string; // ISO or formatted
  workerId: string;
  workerName: string;
}

const NewForm12: React.FC<NewForm12Props> = ({ workerId, onClose }) => {
  const [currentTab, setCurrentTab] = useState(1);
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<{ DKey?: string; DValue: string }[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [dependants, setDependants] = useState<any[]>([]);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [currentemployerData, setCurrentemployerData] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>({});
  const [generatedFileNames, setGeneratedFileNames] = useState<{ [key: string]: string }>({});

  // offline previews for Supporting Documents (object URLs per field)
  const [localPreviews, setLocalPreviews] =
    useState<Record<string, { url: string; isImage: boolean }>>({});

  // add with other useState hooks
  const [scanUrl, setScanUrl] = useState<string>(""); // remote (public/signed) preview URL
  const [scanLocalUrl, setScanLocalUrl] = useState<string>(""); // instant local preview for new file
  const [isScanOpen, setIsScanOpen] = useState<boolean>(false);

  // Passport photo (preview + lightbox) ----
  const [passportUrl, setPassportUrl] = useState<string>("");
  const [isPhotoOpen, setIsPhotoOpen] = useState<boolean>(false);

  // Save summary modal ----
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<SaveSummary | null>(null);


	// after: const [formData, setFormData] = useState<Form12Data>({...});


const loadInsuranceByIPACode = useCallback(async (ipaCode?: string | null) => {
  try {
    if (!ipaCode) {
      setFormData(prev => ({
        ...prev,
        InsuranceProviderIPACode: '',
        InsuranceCompanyOrganizationName: '',
        InsuranceCompanyAddress1: '',
        InsuranceCompanyAddress2: '',
        InsuranceCompanyCity: '',
        InsuranceCompanyProvince: '',
        InsuranceCompanyPOBox: '',
        InsuranceCompanyLandLine: '',
      }));
      return;
    }

    const { data: provider, error: providerErr } = await supabase
      .from('insurancecompanymaster')
      .select(
        'IPACODE, InsuranceCompanyOrganizationName, InsuranceCompanyAddress1, InsuranceCompanyAddress2, InsuranceCompanyCity, InsuranceCompanyProvince, InsuranceCompanyPOBox, InsuranceCompanyLandLine'
      )
      .eq('IPACODE', ipaCode)
      .single();

    if (providerErr) throw providerErr;

    setFormData(prev => ({
      ...prev,
      InsuranceProviderIPACode: provider.IPACODE,
      InsuranceCompanyOrganizationName: provider.InsuranceCompanyOrganizationName || '',
      InsuranceCompanyAddress1: provider.InsuranceCompanyAddress1 || '',
      InsuranceCompanyAddress2: provider.InsuranceCompanyAddress2 || '',
      InsuranceCompanyCity: provider.InsuranceCompanyCity || '',
      InsuranceCompanyProvince: provider.InsuranceCompanyProvince || '',
      InsuranceCompanyPOBox: provider.InsuranceCompanyPOBox || '',
      InsuranceCompanyLandLine: provider.InsuranceCompanyLandLine || '',
    }));
  } catch (e) {
    console.error('Failed to load insurance by IPACode (Form12):', e);
  }
}, [setFormData]);


  // cleanup object URLs on unmount for local previews
  useEffect(() => {
    return () => {
      Object.values(localPreviews).forEach((p) => {
        try {
          URL.revokeObjectURL(p.url);
        } catch {}
      });
    };
  }, [localPreviews]);

  // handle file choose for supporting documents with offline preview
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = e.target.files?.[0];

    // cleanup old preview for this field
    const old = localPreviews[fieldKey];
    if (old?.url) {
      try {
        URL.revokeObjectURL(old.url);
      } catch {}
    }

    if (!file) {
      setLocalPreviews((p) => {
        const n = { ...p };
        delete n[fieldKey];
        return n;
      });
      // also clear staged upload info
      setSelectedFiles((prev) => {
        const n = { ...prev };
        delete n[fieldKey];
        return n;
      });
      setGeneratedFileNames((prev) => {
        const n = { ...prev };
        delete n[fieldKey];
        return n;
      });
      setFormData((prev) => ({ ...prev, [fieldKey]: "" } as any));
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    const isImage = file.type?.startsWith("image/") || isImagePath(file.name);
    setLocalPreviews((p) => ({ ...p, [fieldKey]: { url: blobUrl, isImage: !!isImage } }));

    // Prepare upload path and stage file (mirror handleFileChange logic)
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const datePrefix = `${dd}${mm}${yyyy}`;
    const timestamp = `${hh}${mins}${ss}`;

    const ext = file.name.split(".").pop() || "dat";
    const baseRaw = file.name.replace(/\.[^/.]+$/, "");
   const safeBase = baseRaw.replace(/[^\w.-]+/g, "_");
const newFileName = `${datePrefix}_${timestamp}_${safeBase}.${ext.toLowerCase()}`;


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
const folderPath = folderMapping[fieldKey] || "attachments/form12scan/";
const filePath = `${folderPath}${newFileName}`;

    setSelectedFiles((prev) => ({ ...prev, [fieldKey]: file }));
    setGeneratedFileNames((prev) => ({ ...prev, [fieldKey]: newFileName }));
    setFormData((prev) => ({ ...prev, [fieldKey]: filePath } as any));
  };

  // Auto-populate region when province changes (keep Incident* and Death* in sync)
  useEffect(() => {
    const fetchRegion = async () => {
      if (!formData.IncidentProvince) {
        setFormData((prev) => ({ ...prev, IncidentRegion: "", DeathRegion: "" }));
        return;
      }
      try {
        const { data: regionData, error: regionError } = await supabase
          .from("dictionary")
          .select("DValue")
          .eq("DType", "ProvinceRegion")
          .eq("DKey", formData.IncidentProvince)
          .single();
        if (regionError) {
          if ((regionError as any).code === "PGRST116") {
            setFormData((prev) => ({ ...prev, IncidentRegion: "", DeathRegion: "" }));
            return;
          }
          throw regionError;
        }
        setFormData((prev) => ({
          ...prev,
          IncidentRegion: regionData?.DValue || "",
          DeathRegion: regionData?.DValue || "",
        }));
      } catch (err) {
        console.error("Error fetching region:", err);
        setFormData((prev) => ({ ...prev, IncidentRegion: "", DeathRegion: "" }));
      }
    };
    fetchRegion();
  }, [formData.IncidentProvince]);

  useEffect(() => {
    if (scanLocalUrl) return; // prefer local preview if a new file was selected

    (async () => {
      const raw = formData.ImageName;
      const path = normalizeStoragePath(raw);
      if (!path) {
        setScanUrl("");
        return;
      }
      const u = await resolveStorageUrl(path);
      setScanUrl(u || "");
    })();
  }, [formData.ImageName, scanLocalUrl]);

  useEffect(() => {
    return () => {
      if (scanLocalUrl) {
        try {
          URL.revokeObjectURL(scanLocalUrl);
        } catch {}
      }
    };
  }, [scanLocalUrl]);

  // Initial load (worker + employment + insurance + lists) + resolve passport URL
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Worker details
        const { data: workerData, error: workerError } = await supabase
          .from("workerpersonaldetails")
          .select("*")
          .eq("WorkerID", workerId)
          .single();
        if (workerError) throw workerError;

        // Employment details
        const { data: employmentData, error: employmentError } = await supabase
          .from("currentemploymentdetails")
          .select("*")
          .eq("WorkerID", workerId)
          .single();
        if (employmentError) throw employmentError;

        // Provinces
        const { data: provinceData, error: provinceError } = await supabase
          .from("dictionary")
          .select("DKey, DValue")
          .eq("DType", "Province");
        if (provinceError) throw provinceError;
        setProvinces(provinceData || []);

        // Employer -> Insurance provider chain
        const { data: curEmpRow, error: curEmpErr } = await supabase
          .from("currentemploymentdetails")
          .select("EmployerCPPSID")
          .eq("WorkerID", workerId)
          .single();
        if (curEmpErr) throw curEmpErr;

        const { data: employerMaster, error: employerMasterErr } = await supabase
          .from("employermaster")
          .select("InsuranceProviderIPACode, OrganizationType")
          .eq("CPPSID", curEmpRow?.EmployerCPPSID)
          .single();
        if (employerMasterErr) throw employerMasterErr;

				{/*}  const { data: insuranceCompany, error: insuranceCompanyErr } = await supabase
          .from("insurancecompanymaster")
          .select("*")
          .eq("IPACODE", employerMaster?.InsuranceProviderIPACode)
          .single();
        if (insuranceCompanyErr) throw insuranceCompanyErr;
        setInsuranceProviders(insuranceCompany ? [insuranceCompany] : []);*/}

const providerCode = String(employerMaster?.InsuranceProviderIPACode || "");

// Make sure the selected value reflects employer’s default:
if (providerCode) {
  setFormData(prev => ({ ...prev, InsuranceProviderIPACode: providerCode }));
  await loadInsuranceByIPACode(providerCode);
} else {
  // Clear insurance details if employer has none
  await loadInsuranceByIPACode(null);
}
				

const { data: insuranceCompany, error: insuranceCompanyErr } = await supabase
  .from("insurancecompanymaster")
  .select("*")
  .eq("IPACODE", providerCode)
  .maybeSingle();

if (insuranceCompanyErr && (insuranceCompanyErr as any).code !== "PGRST116") {
  throw insuranceCompanyErr; // real error; PGRST116 = 0 rows, safe to ignore here
}

if (insuranceCompany) setInsuranceProviders([insuranceCompany]);


        // All providers
        const { data: insuranceAll } = await supabase.from("insurancecompanymaster").select("*");
        if (insuranceAll) setInsuranceProviders(insuranceAll);

        // Dependants
        const { data: dependantData, error: dependantError } = await supabase
          .from("dependantpersonaldetails")
          .select("*")
          .eq("WorkerID", workerId);
        if (dependantError) throw dependantError;
        setDependants(dependantData || []);

        // Work history
        const { data: historyData, error: historyError } = await supabase
          .from("workhistory")
          .select("*")
          .eq("WorkerID", workerId);
        if (historyError) throw historyError;
        setWorkHistory(historyData || []);

        // Merge into form state
        setFormData((prev) => ({
          ...prev,
          ...(workerData as any),
          ...(employmentData as any),
          ...(insuranceCompany as any),
          ...(employerMaster as any),
          ...(curEmpRow as any),
          WorkerHaveDependants: (dependantData || []).length > 0 as any,
        } as any));

        // Resolve passport image URL
        const rawPath = (workerData as any)?.WorkerPassportPhoto || "";
        const path = normalizeStoragePath(rawPath);
        if (path) {
          try {
            const { data: pub } = supabase.storage.from("cpps").getPublicUrl(path);
            const publicUrl = pub?.publicUrl;
            if (publicUrl) {
              fetch(publicUrl, { method: "HEAD" })
                .then((res) => {
                  if (res.ok) {
                    setPassportUrl(publicUrl);
                  } else {
                    supabase.storage
                      .from("cpps")
                      .createSignedUrl(path, 60 * 60 * 24)
                      .then(({ data: signed }) => signed?.signedUrl && setPassportUrl(signed.signedUrl));
                  }
                })
                .catch(() => {
                  supabase.storage
                    .from("cpps")
                    .createSignedUrl(path, 60 * 60 * 24)
                    .then(({ data: signed }) => signed?.signedUrl && setPassportUrl(signed.signedUrl));
                });
            }
          } catch (e) {
            console.error("Passport URL resolution failed:", e);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load worker details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workerId]);

useEffect(() => {
  const syncFromEmployer = async () => {
    const cpps = (formData as any).EmployerCPPSID;
    if (!cpps) {
      await loadInsuranceByIPACode(null);
      return;
    }
    const { data: emp, error } = await supabase
      .from('employermaster')
      .select('InsuranceProviderIPACode')
      .eq('CPPSID', cpps)
      .single();
    if (!error) {
      const code = emp?.InsuranceProviderIPACode || '';
      setFormData(prev => ({ ...prev, InsuranceProviderIPACode: code }));
      await loadInsuranceByIPACode(code || null);
    }
  };
  // only run when CPPS changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  if ((formData as any).EmployerCPPSID !== undefined) syncFromEmployer();
}, [(formData as any).EmployerCPPSID]);

	
  // ---- handlers 

const handleInsuranceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
  const code = e.target.value;
  setFormData(prev => ({ ...prev, InsuranceProviderIPACode: code }));
  await loadInsuranceByIPACode(code);
};

	
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    if (["InjuryMachinery", "HandInjury", "GradualProcessInjury", "DeathRelatedToInjury"].includes(name)) {
      setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value === "true" } as any));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // IMPROVED file-name generation & deferred upload (for Form12 Scan)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];

    // Clean up old local URL(s)
    if (fieldName === "ImageName" && scanLocalUrl) {
      try {
        URL.revokeObjectURL(scanLocalUrl);
      } catch {}
      setScanLocalUrl("");
    }

    if (!file) {
      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      setGeneratedFileNames((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      setFormData((prev) => ({ ...prev, [fieldName]: "" } as any));
      return;
    }

    // timestamped name logic …
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    const datePrefix = `${day}${month}${year}`;
    const timestamp = `${hh}${mm}${ss}`;

    const ext = file.name.split(".").pop() || "dat";
    const baseRaw = file.name.replace(/\.[^/.]+$/, "");
    const newFileName = `${datePrefix}_${timestamp}_${baseRaw}.${ext}`;

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

    const filePath = `${folderPath}${newFileName}`;

    setSelectedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setGeneratedFileNames((prev) => ({ ...prev, [fieldName]: newFileName }));
    setFormData((prev) => ({ ...prev, [fieldName]: filePath } as any));

    // Instant local preview for images
    if (fieldName === "ImageName") {
      const looksImage = file.type.startsWith("image/") || isImagePath(file.name);
      if (looksImage) {
        const blobUrl = URL.createObjectURL(file);
        setScanLocalUrl(blobUrl);
      } else {
        setScanLocalUrl(""); // PDFs won't render as <img>
      }
    }
  };

  // ---- submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const required = ["DeathDate", "DeathCause", "DeathLocation", "DeathProvince", "InsuranceProviderIPACode"];
    const missing = required.filter((k) => !(formData as any)[k]);
    if (missing.length) {
      setLoading(false);
      setError(`Please fill in all required fields: ${missing.join(", ")}`);
      return;
    }

    try {
      // 1) Upload the chosen files
      const uploadedFilePaths: Record<string, string> = {};
      for (const [fieldName, file] of Object.entries(selectedFiles)) {
        if (file && generatedFileNames[fieldName]) {
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
};
const folderPath = folderMapping[fieldName] || "attachments/form12scan/";
const fileName = generatedFileNames[fieldName];
const filePath = `${folderPath}${fileName}`;
const { error: uploadError } = await supabase.storage.from("cpps").upload(filePath, file as File);
          if (uploadError) throw new Error(`Failed to upload ${fieldName}: ${uploadError.message}`);

          uploadedFilePaths[fieldName] = filePath;
        }
      }

      // 2) Merge uploads into data
      const finalFormData: Form12Data = { ...(formData as any), ...(uploadedFilePaths as any) };

      // 3) Time-bar logic (use Date of Death)
      const deathDate = new Date(finalFormData.DeathDate || finalFormData.IncidentDate);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - deathDate.getTime()) / (1000 * 60 * 60 * 24));
      const isTimeBarred = daysDiff > 365;

      // 4) Map Death* -> Incident* for DB schema
      const incidentDateStr1 = finalFormData.DeathDate || finalFormData.IncidentDate || "";
      const incidentLocation = finalFormData.DeathLocation || finalFormData.IncidentLocation || "";
      const incidentProvince = finalFormData.DeathProvince || finalFormData.IncidentProvince || "";
      const incidentRegion = finalFormData.DeathRegion || finalFormData.IncidentRegion || "";
      const natureExtent = finalFormData.DeathCircumstances || finalFormData.NatureExtentInjury || "";
      const injuryCause = finalFormData.DeathCause || finalFormData.InjuryCause || "";

      // 4) Save to master table
      const { data: masterRow, error: masterErr } = await supabase
        .from("form1112master")
        .insert([
          {
            DisplayIRN: finalFormData.DisplayIRN,
            WorkerID: finalFormData.WorkerID,

            // Use mapped Incident fields from Death*
            IncidentDate: incidentDateStr1,
            IncidentLocation: incidentLocation,
            IncidentProvince: incidentProvince,
            IncidentRegion: incidentRegion,
            NatureExtentInjury: natureExtent,
            InjuryCause: injuryCause,

            InjuryMachinery: finalFormData.InjuryMachinery ? 1 : 0,
            MachineType: finalFormData.MachineType,
            MachinePartResponsible: finalFormData.MachinePartResponsible,
            MachinePowerSource: finalFormData.MachinePowerSource,
            GradualProcessInjury: finalFormData.GradualProcessInjury ? 1 : 0,
            IncidentType: finalFormData.IncidentType, // 'Death'
            ImageName: finalFormData.ImageName,
            PublicUrl: finalFormData.PublicUrl,
            TimeBarred: isTimeBarred ? "Yes" : "No",
            HandInjury: finalFormData.HandInjury ? 1 : 0,
            FirstSubmissionDate: new Date().toISOString().split("T")[0],
            InsuranceProviderIPACode: finalFormData.InsuranceProviderIPACode,
          },
        ])
        .select()
        .single();

      if (masterErr) throw masterErr;

      const newIRN = (masterRow as any).IRN;
      const firstSubmissionDate = (masterRow as any).FirstSubmissionDate as string; // YYYY-MM-DD

      // 5) Build DisplayCRN (corrected for Form12 -> F12)
      const { data: employerData, error: employerError } = await supabase
        .from("employermaster")
        .select("OrganizationType")
        .eq("CPPSID", (formData as any).EmployerCPPSID)
        .single();
      if (employerError) throw employerError;

      // min IRN of the month to compute counter
      const startOfMonth = new Date(firstSubmissionDate);
      startOfMonth.setDate(1);
      const endOfMonth = new Date(firstSubmissionDate);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const { data: minIrnRow, error: minIrnErr } = await supabase
        .from("form1112master")
        .select("IRN")
        .gte("FirstSubmissionDate", startOfMonth.toISOString())
        .lte("FirstSubmissionDate", endOfMonth.toISOString())
        .order("IRN", { ascending: true })
        .limit(1)
        .single();
      if (minIrnErr) throw minIrnErr;

      const minIRN = minIrnRow ? (minIrnRow as any).IRN : newIRN;
      const currentIRN = newIRN - minIRN + 1;
      const digitCounter = String(currentIRN).padStart(3, "0");

      const dateObj = new Date(firstSubmissionDate);
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const yy = String(dateObj.getFullYear()).slice(-2);
      const firstSubDateStr = `${mm}${yy}`;

      const otype = employerData?.OrganizationType?.toLowerCase() === "private" ? "PRIVATE" : "STATE";
      const ot = otype.substring(0, 2); // PR or ST

      const incidentProv = (formData.IncidentProvince || "").substring(0, 3).toUpperCase();

      const id = incidentDateStr1 ? new Date(incidentDateStr1) : new Date(); // DeathDate first, fallback to today
      const iday = String(id.getDate()).padStart(2, "0");
      const imonth = String(id.getMonth() + 1).padStart(2, "0");
      const iyear = String(id.getFullYear()).slice(-2);
      const incidentDateStr = `${iday}${imonth}${iyear}`;

      const DisplayCRN = `${ot}-CRN-${digitCounter}${firstSubDateStr}-F12${incidentProv}${incidentDateStr}`;

      const { error: updateErr } = await supabase.from("form1112master").update({ DisplayIRN: DisplayCRN }).eq("IRN", newIRN);
      if (updateErr) throw updateErr;

      // 6) Time-bar side tables
      if (isTimeBarred) {
        const { error: tberr } = await supabase
          .from("timebarredclaimsregistrarreview")
          .insert([
            {
              IRN: newIRN,
              TBCRRSubmissionDate: new Date().toISOString(),
              TBCRRFormType: "Form12",
              TBCRRReviewStatus: "Pending",
            },
          ]);
        if (tberr) throw tberr;
      } else {
        const { error: preErr } = await supabase
          .from("prescreeningreview")
          .insert([
            {
              PRStatus: "Approved",
							PRDecisionDate: new Date().toISOString(),
							IRN: newIRN,
              PRSubmissionDate: new Date().toISOString(),
              PRFormType: "Form12",
              PRDecisionReason: "Automatically Approved",
            },
          ]);
        if (preErr) throw preErr;
      }

      // 7) Persist attachments mapping (KEEP death-specific types)
      const attachments: { type: string; file?: string }[] = [
        { type: "Death Certificate", file: finalFormData.DC },
        { type: "Post Mortem report", file: finalFormData.PMR },
        { type: "Section 43 application form", file: finalFormData.SEC43 },
        { type: "Supervisor statement", file: finalFormData.SS },
        { type: "Witness statement", file: finalFormData.WS },
        { type: "Dependency declaration", file: finalFormData.DD },
        { type: "Payslip at the time of accident", file: finalFormData.PTA },
        { type: "Funeral expenses receipts", file: finalFormData.FER },
        { type: "Police incident report", file: finalFormData.PIR },
        { type: "Form 18 Scan", file: finalFormData.F18 },
        { type: "MedicalExpenses", file: finalFormData.MEX },
        { type: "MiscExpenses", file: finalFormData.MISC },
        { type: "Deductions", file: finalFormData.DED },
      ];

      for (const a of attachments) {
        if (a.file) {
          const { error: attErr } = await supabase.from("formattachments").insert([{ IRN: newIRN, AttachmentType: a.type, FileName: a.file }]);
          if (attErr) throw attErr;
        }
      }

      // 8) Success + show summary modal
      setSummary({
        irn: newIRN,
        crn: DisplayCRN,
        incidentType: formData.IncidentType,
        submitDate: firstSubmissionDate,
        workerId: formData.WorkerID,
        workerName: `${formData.WorkerFirstName || ""} ${formData.WorkerLastName || ""}`.trim(),
      });
      setShowSummary(true);
      setSuccess("Form 12 submitted successfully!");
    } catch (err) {
      console.error("Error saving form:", err);
      setError("Failed to save form. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---- renderers ----
  const renderWorkerPersonalDetails = () => (
    <div className="space-y-4">
      {/* Worker ID + Passport photo (thumbnail + lightbox) */}
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
            <div className="w-84 h-42rounded border grid place-content-center text-xs text-gray-500">No photo</div>
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
          <label className="block text	sm font-medium text-gray-700">City</label>
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

  // === Details of Dependants ===
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
          <input type="date" name="SpouseDOB" value={s(formData.SpouseDOB)} onChange={handleInputChange} className="input" disabled />
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
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(dependant.DependantDOB).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // === Other Employment Details (Work History) ===
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
                  {history.OrganizationAddress2 && <>, {history.OrganizationAddress2}</>}
                  {history.OrganizationCity && <>, {history.OrganizationCity}</>}
                  {history.OrganizationProvince && <>, {history.OrganizationProvince}</>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ---- Employment ----
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

  // ---- Death Details ----
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
          <label className="block text sm font-medium text-gray-700">Death Province</label>
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

  // ---- Insurance ----
  const renderInsuranceDetails = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider</label>
 <select
  name="InsuranceProviderIPACode"
  value={formData.InsuranceProviderIPACode}
  onChange={handleInsuranceChange}
  className="input"
  required
>
  <option value="">Select Insurance Provider</option>
  {insuranceProviders.map((p) => (
    <option key={p.IPACODE} value={p.IPACODE}>
      {p.InsuranceCompanyOrganizationName}
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

  // ---- Form12 Scan ----
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
            required
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
  };

  // ---- Supporting Documents ----
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
        ].map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
              type="file"
              onChange={(e) => handleAttachmentChange(e, key)}
              className="input"
              accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />

            {/* offline preview (local, before upload) */}
            {localPreviews[key] && (
              localPreviews[key].isImage ? (
                <img src={localPreviews[key].url} alt={`${label} preview`} className="w-28 h-28 object-cover rounded border" />
              ) : (
                <a href={localPreviews[key].url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                  Open local preview
                </a>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );

// ---- PRINT: Form 12 Summary (standalone CSS, no Tailwind) ----
const printSummary = () => {
  if (!summary) {
    alert("Nothing to print yet.");
    return;
  }

  // Safe escape for user/content values
  const esc = (v: any) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "<")
      .replace(/>/g, ">");

  // Prepare optional death details
  const deathRows = formData.IncidentType === "Death"
    ? [
        ["Date of Death", formData.DeathDate || "-"],
        ["Cause of Death", formData.DeathCause || "-"],
        ["Death Location", formData.DeathLocation || "-"],
        ["Death Province", formData.DeathProvince || "-"],
        ["Death Region", formData.DeathRegion || "-"],
      ]
    : [];

  // Optional insurance label (nice to show on the receipt)
  const insuranceName = formData.InsuranceCompanyOrganizationName || "";
  const insuranceCode = formData.InsuranceProviderIPACode || "";
  const insuranceDisplay =
    insuranceName || insuranceCode
      ? `${insuranceName ? insuranceName : ""}${insuranceName && insuranceCode ? " — " : ""}${insuranceCode ? insuranceCode : ""}`
      : "-";

  // Build a small, self-styled one-page document
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Form 12 – Submission Summary</title>
  <style>
    @page { size: A4; margin: 12mm; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      font-size: 12px;
      color: #111827; /* gray-900 */
    }
    .sheet { padding: 4mm 2mm; }

    /* Header */
    .hdr {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 10mm;
      border-bottom: 1px solid #e5e7eb; /* gray-200 */
      padding-bottom: 4mm;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    .sub {
      font-size: 11px;
      color: #6b7280; /* gray-600 */
    }

    /* Definition grid: Label | Value */
    .def {
      display: grid;
      grid-template-columns: 180px 1fr;
      column-gap: 12px;
      row-gap: 8px;
      margin-bottom: 10mm;
    }
    .def dt {
      margin: 0;
      color: #4b5563; /* gray-700 */
    }
    .def dd {
      margin: 0;
      font-weight: 600;
      color: #111827; /* gray-900 */
      word-break: break-word;
    }

    /* Section heading */
    .sec {
      font-weight: 700;
      margin: 0 0 6px 0;
      color: #111827;
    }

    /* One-page control */
    .sheet, .sheet * {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      <div class="title">Form 12 – Submission Summary</div>
      <div class="sub">${esc(new Date().toLocaleString())}</div>
    </div>

    <dl class="def">
      <dt>IRN</dt><dd>${esc(summary.irn)}</dd>
      <dt>CRN</dt><dd>${esc(summary.crn)}</dd>
      <dt>Incident Type</dt><dd>${esc(summary.incidentType)}</dd>
      <dt>First Submission Date</dt><dd>${esc(summary.submitDate)}</dd>
      <dt>Worker</dt><dd>${esc(summary.workerName)} (${esc(summary.workerId)})</dd>
      <dt>Insurance Provider</dt><dd>${esc(insuranceDisplay)}</dd>
    </dl>

    ${deathRows.length ? `<div>
      <div class="sec">Death Details</div>
      <dl class="def">
        ${deathRows
          .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
          .join("")}
      </dl>
    </div>` : ""}
  </div>
</body>
</html>`;

  // Hidden iframe print (works with popup blockers)
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    alert("Could not create print frame.");
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const doPrint = () => {
    setTimeout(() => {
      try { (iframe.contentWindow || (iframe as any).window).focus(); } catch {}
      try { (iframe.contentWindow || (iframe as any).window).print(); } finally {
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 500);
      }
    }, 50);
  };

  if (iframe.contentWindow?.document?.readyState === "complete") {
    doPrint();
  } else {
    iframe.addEventListener("load", doPrint, { once: true });
  }
};

	
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">New Form 12 — Death</h2>
          <button className="p-2 hover:bg-gray-100 rounded" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-6">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-700 rounded">{success}</div>}

            {/* tabs (simple) */}
            <div className="flex gap-2 text-sm">
              {[
                "Worker Personal Details",
                "Employment Details",
                "Death Details",
                "Details of Dependants",
                "Other Employment Details",
                "Insurance Details",
                "Form12 Scan",
                "Supporting Documents",
              ].map((label, idx) => (
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

            {/* panes */}
            {currentTab === 1 && renderWorkerPersonalDetails()}
            {currentTab === 2 && renderEmploymentDetails()}
            {currentTab === 3 && renderDeathDetails()}
            {currentTab === 4 && renderDependantDetails()}
            {currentTab === 5 && renderWorkHistory()}
            {currentTab === 6 && renderInsuranceDetails()}
            {currentTab === 7 && renderForm12Scan()}
            {currentTab === 8 && renderAttachments()}

            <div className="pt-2">
              <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* After-save summary modal */}
      {showSummary && summary && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          {/* print-only styles */}
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

          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold">Submission Summary</h3>
              <button className="p-2 hover:bg-gray-100 rounded no-print" onClick={() => setShowSummary(false)}>
                <X size={18} />
              </button>
            </div>

            {/* mark this block as the printable area */}
            <div className="p-5 space-y-2 text-sm print-area" id="summary-content">
              <div className="flex justify-between">
                <span className="text-gray-600">IRN</span>
                <span className="font-medium">{summary.irn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">CRN</span>
                <span className="font-medium">{summary.crn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Incident Type</span>
                <span className="font-medium">{summary.incidentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">First Submission Date</span>
                <span className="font-medium">{summary.submitDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Worker</span>
                <span className="font-medium">
                  {summary.workerName} ({summary.workerId})
                </span>
              </div>

              {/* Death quick-facts (safe if blank) */}
              {formData.IncidentType === "Death" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date of Death</span>
                    <span className="font-medium">{formData.DeathDate || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cause of Death</span>
                    <span className="font-medium">{formData.DeathCause || "-"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 pb-5 pt-2 flex justify-end gap-2 no-print">
             <button
  type="button"
  className="px-3 py-1.5 rounded border"
  onClick={printSummary}
>
  Print
</button>


              <button
                className="px-3 py-1.5 rounded bg-blue-600 text-white"
                onClick={() => {
                  setShowSummary(false);
                  onClose();
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewForm12;
