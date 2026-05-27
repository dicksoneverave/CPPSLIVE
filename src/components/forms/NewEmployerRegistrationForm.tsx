// src/components/forms/NewEmployerRegistrationForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../services/supabase";
import bcrypt from "bcryptjs";

interface NewEmployerRegistrationFormProps {
  onClose: () => void;
}

interface ProvinceOption {
  DKey: string;
  DValue: string;
}

interface InsuranceCompany {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1?: string;
  InsuranceCompanyAddress2?: string;
  InsuranceCompanyCity?: string;
  InsuranceCompanyProvince?: string;
  InsuranceCompanyPOBox?: string;
  InsuranceCompanyLandLine?: string;
}

type OrgType = "State" | "Private" | "";

interface FormData {
  // Tab 1: Account Credentials
  Email: string;
  Password: string;
  VerifyPassword: string;

  // Tab 2: Employer Details
  OrganizationName: string;
  IncorporationDate: string; // YYYY-MM-DD
  Address1: string;
  Address2: string;
  City: string;
  Province: string;

  // Tab 3: Other Details
  POBox: string;
  Website: string;
  MobilePhone: string;
  LandLine: string;
  OrganizationType: OrgType;
  ValidationCode: string;           // IPA Code / Dept Code
  InsuranceProviderIPACode: string; // selected IPACODE
  IsLevyPaid: boolean;
  LevyReferenceNumber: string;
  IsAgent: boolean;
  IsLawyer: boolean;
  IsInsuranceCompany: boolean;
}

const NewEmployerRegistrationForm: React.FC<NewEmployerRegistrationFormProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(true); // local visibility guard
  const [currentTab, setCurrentTab] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    // Credentials
    Email: "",
    Password: "",
    VerifyPassword: "",

    // Employer details
    OrganizationName: "",
    IncorporationDate: "",
    Address1: "",
    Address2: "",
    City: "",
    Province: "",

    // Other
    POBox: "",
    Website: "",
    MobilePhone: "",
    LandLine: "",
    OrganizationType: "",
    ValidationCode: "",
    InsuranceProviderIPACode: "",
    IsLevyPaid: false,
    LevyReferenceNumber: "",
    IsAgent: false,
    IsLawyer: false,
    IsInsuranceCompany: false,
  });

  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceCompany[]>([]);
  const [ipamasterCount, setIpamasterCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Summary modal state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    EMID: string;
    OrganizationName: string;
    CPPSID: string;
    OrganizationType: string;
    InsuranceProviderName: string;
    IPACode: string;
    CreatedAt?: string;
  } | null>(null);

  // Close handler: hide locally, close summary, then notify parent
  const handleClose = () => {
    setShowSummary(false);
    setIsOpen(false);
    try {
      onClose?.();
    } catch {
      /* no-op */
    }
  };

  // Guarded arrays
  const providers: InsuranceCompany[] = Array.isArray(insuranceProviders) ? insuranceProviders : [];
  const provs: ProvinceOption[] = Array.isArray(provinces) ? provinces : [];

  // Load initial data (provinces, insurance providers, ipamaster count)
  useEffect(() => {
    const load = async () => {
      try {
        setInitialLoading(true);
        setError(null);

        // Provinces
        const { data: provinceData, error: provinceError } = await supabase
          .from("dictionary")
          .select("DKey, DValue")
          .eq("DType", "Province");
        if (provinceError) throw provinceError;
        setProvinces(provinceData || []);

        // Insurance companies
        const { data: insData, error: insErr } = await supabase
          .from("insurancecompanymaster")
          .select("*")
          .order("InsuranceCompanyOrganizationName", { ascending: true });
        if (insErr) throw insErr;
        setInsuranceProviders((insData || []) as InsuranceCompany[]);

        // ipamaster count (informational)
        const { count, error: ipaErr } = await supabase
          .from("ipamaster")
          .select("*", { count: "exact", head: true });
        if (!ipaErr) setIpamasterCount(count ?? null);
      } catch (e: any) {
        console.error("Initialization error:", e);
        setError(e.message || "Failed to initialize");
      } finally {
        setInitialLoading(false);
      }
    };

    load();
  }, []);

  // Input handler
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // ---------- TAB 3 LOGIC ----------
  const validationCodeLabel = useMemo(() => {
    return formData.OrganizationType === "State"
      ? "Department Code"
      : formData.OrganizationType === "Private"
      ? "IPA Code"
      : "Validation Code";
  }, [formData.OrganizationType]);

  const insuranceDisabled = useMemo(
    () => formData.OrganizationType !== "Private",
    [formData.OrganizationType]
  );

  const selectedProvider = useMemo(
    () => providers.find((i) => i.IPACODE === formData.InsuranceProviderIPACode),
    [providers, formData.InsuranceProviderIPACode]
  );

  // Levy ref is disabled until checkbox checked
  const levyRefDisabled = useMemo(() => !formData.IsLevyPaid, [formData.IsLevyPaid]);

  // OrganizationType-driven resets & IPA auto-fill attempt
  useEffect(() => {
    if (formData.OrganizationType === "State") {
      setFormData((prev) => ({
        ...prev,
        ValidationCode: "",
        InsuranceProviderIPACode: "State", // <-- set to 'State' for State orgs
        IsLevyPaid: false,
        LevyReferenceNumber: "",
      }));
    } else if (formData.OrganizationType === "Private") {
      if (!formData.ValidationCode.trim() && formData.OrganizationName.trim()) {
        (async () => {
          try {
            const { data, error: ipaErr } = await supabase
              .from("ipamaster")
              .select("*")
              .ilike("OrganizationName", formData.OrganizationName.trim());
            if (!ipaErr && data && data.length > 0) {
              const row: any = data[0];
              const candidate = row.IPACODE || row.IpaCode || row.IPA_CODE || row.ipa_code || "";
              if (candidate) {
                setFormData((prev) => ({ ...prev, ValidationCode: String(candidate) }));
              }
            }
          } catch {
            /* ignore */
          }
        })();
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        InsuranceProviderIPACode: "",
        IsLevyPaid: false,
        LevyReferenceNumber: "",
        ValidationCode: "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.OrganizationType]);

  // Clear levy ref if checkbox is turned off
  useEffect(() => {
    if (!formData.IsLevyPaid && formData.LevyReferenceNumber) {
      setFormData((prev) => ({ ...prev, LevyReferenceNumber: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.IsLevyPaid]);

  // ---------- HELPERS: users + profiles + EMPID ----------
  const checkEmailExists = async (email: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  };

  // Extract the largest numeric portion from EMPID (handles values like "EMP-1007")
  const extractNum = (val: any): number => {
    const s = String(val ?? "");
    const matches = s.match(/\d+/g);
    if (!matches || matches.length === 0) return Number(s) || 0;
    return Math.max(...matches.map((m) => Number(m) || 0));
  };

  // Get next EMID (last + 1). Tries DESC LIMIT 1 first; if not numeric, scans up to 5000 rows to find max.
  const getNextEMID = async (): Promise<string> => {
    // Primary attempt: DESC LIMIT 1 on EMID
    const top = await supabase
      .from("employermaster")
      .select("EMID")
      .order("EMID", { ascending: false })
      .limit(1);

    let last = 0;
    if (!top.error && top.data && top.data.length > 0) {
      last = extractNum(top.data[0].EMID);
    }

    // Fallback: scan a chunk to compute max numerically if needed
    if (last === 0) {
      const all = await supabase
        .from("employermaster")
        .select("EMID")
        .limit(5000);
      if (!all.error && all.data) {
        last = all.data.reduce((mx, r) => {
          const n = extractNum(r.EMID);
          return n > mx ? n : mx;
        }, 0);
      }
    }

    const next = last > 0 ? last + 1 : 1000; // default start 1000 if table empty
    return String(next);
  };

  // CPPSID uses EMPID: 2 letters (Province) + 2 letters (Org) + YY + EMPID
  const buildCPPSIDWithEMID = (province: string, orgName: string, empid: string): string => {
    const two = (s: string) => (s || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2).padEnd(2, "X");
    const yy = new Date().getFullYear().toString().slice(-2);
    return `${two(province)}${two(orgName)}${yy}${empid}`;
  };

  // Validation
  const validate = (): string | null => {
    // Tab 1
    if (!formData.Email.trim()) return "Email is required.";
    if (!/^\S+@\S+\.\S+$/.test(formData.Email.trim())) return "Please enter a valid email address.";
    if (!formData.Password) return "Password is required.";
    if (formData.Password !== formData.VerifyPassword) return "Passwords do not match.";

    // Tab 2
    if (!formData.OrganizationName.trim()) return "Organization Name is required.";
    if (!formData.Address1.trim()) return "Address1 is required.";
    if (!formData.City.trim()) return "City is required.";
    if (!formData.Province.trim()) return "Province is required.";

    // Tab 3
    if (!formData.POBox.trim()) return "P.O. Box is required.";
    if (!formData.MobilePhone.trim()) return "Mobile No is required.";
    if (!formData.OrganizationType) return "Organization Type is required.";
    if (!formData.ValidationCode.trim()) return `${validationCodeLabel} is required.`;
    if (formData.IsLevyPaid && !formData.LevyReferenceNumber.trim()) {
      return "Please specify levy reference number if levy is being paid";
    }

    return null;
  };

  // ---------- SUBMIT ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Keep provider fields only for Private
    const normalized: FormData = { ...formData };
    if (normalized.OrganizationType !== "Private") {
      normalized.InsuranceProviderIPACode =
        normalized.OrganizationType === "State" ? "State" : ""; // <-- keep 'State' for State orgs
      normalized.IsLevyPaid = false;
      normalized.LevyReferenceNumber = "";
    }

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      // 1) Check existing email in public.users
      const exists = await checkEmailExists(normalized.Email.trim());
      if (exists) {
        setError("Email already exists. Please use a different email address.");
        setLoading(false);
        return;
      }

      // 2) Hash password & create user with default group_id 15
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(normalized.Password, salt);

      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .insert({
          email: normalized.Email.trim(),
          password: hashedPassword,
          name: normalized.OrganizationName.trim(),
          group_id: 15, // default employer group
        })
        .select("id")
        .single();

      if (userErr) throw new Error(`Error creating user: ${userErr.message}`);
      if (!userRow?.id) throw new Error("User ID not returned after creation");

      // 3) Create profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({
          id: userRow.id,
          email: normalized.Email.trim(),
          full_name: normalized.OrganizationName.trim(),
          phone_number: normalized.MobilePhone.trim(),
        });

      if (profileErr) {
        // rollback user if profile fails
        await supabase.from("users").delete().eq("id", userRow.id);
        throw new Error(`Error creating profile: ${profileErr.message}`);
      }

      // 4) Compute EMPID & CPPSID (uses EMPID)
      const newEMID = await getNextEMID();
      const newCPPSID = buildCPPSIDWithEMID(normalized.Province, normalized.OrganizationName, newEMID);

      // 5) Insert employer row (EMPID included; EmployerID removed)
// 5) Insert employer row (EMPID included; EmployerID removed)
const payload: any = {
  EMID: newEMID,
  CPPSID: newCPPSID,
  OrganizationName: normalized.OrganizationName,
  Address1: normalized.Address1,
  Address2: normalized.Address2 || null,
  City: normalized.City,
  Province: normalized.Province,
  POBox: normalized.POBox,
  Website: normalized.Website || null,
  MobilePhone: normalized.MobilePhone,
  LandLine: normalized.LandLine || null,
  OrganizationType: normalized.OrganizationType,
  ValidationCode: normalized.ValidationCode,
  InsuranceProviderIPACode: normalized.InsuranceProviderIPACode || null,
  IsLevyPaid: normalized.IsLevyPaid ? 1 : 0,
  LevyReferenceNumber: normalized.IsLevyPaid ? normalized.LevyReferenceNumber || null : null,
  IncorporationDate: normalized.IncorporationDate || null,
  IsAgent: normalized.IsAgent ? 1 : 0,
  IsLawyer: normalized.IsLawyer ? 1 : 0,
  IsInsuranceCompany: normalized.IsInsuranceCompany ? 1 : 0,
  Email: normalized.Email.trim(),
        // Optionally link to user:
        // UserID: userRow.id,
      };


// 🔒 Enforce 'State' for State orgs at write-time
if (normalized.OrganizationType === "State") {
  payload.InsuranceProviderIPACode = "State";
}


      const { data: employerRow, error: empErr } = await supabase
        .from("employermaster")
        .insert([payload])
        .select()
        .single();

      if (empErr) {
        // rollback profile + user if employer insert fails
        await supabase.from("profiles").delete().eq("id", userRow.id);
        await supabase.from("users").delete().eq("id", userRow.id);
        throw new Error(`Error creating employer record: ${empErr.message}`);
      }

      // 6) Success + Summary modal
      setSuccess(`Employer ${employerRow?.OrganizationName ?? normalized.OrganizationName} registered successfully!`);

      const createdAtRaw =
        employerRow?.created_at ??
        employerRow?.CreatedAt ??
        employerRow?.inserted_at ??
        employerRow?.CreatedOn ??
        null;

      const providerName =
        providers.find((p) => p.IPACODE === (employerRow?.InsuranceProviderIPACode ?? normalized.InsuranceProviderIPACode))
          ?.InsuranceCompanyOrganizationName ?? "—";

      setSummaryData({
        EMID: employerRow?.EMID ?? "—",
        OrganizationName: employerRow?.OrganizationName ?? normalized.OrganizationName,
        CPPSID: employerRow?.CPPSID ?? newCPPSID,
        OrganizationType: employerRow?.OrganizationType ?? normalized.OrganizationType ?? "—",
        InsuranceProviderName: providerName,
        IPACode: employerRow?.ValidationCode ?? normalized.ValidationCode ?? "—",
        CreatedAt: createdAtRaw ? new Date(createdAtRaw).toLocaleString() : undefined,
				Email: normalized.Email.trim(),
      });
      setShowSummary(true);
    } catch (e: any) {
      setError(e.message || "Failed to register employer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const tabs = useMemo(
    () => ["Account Credentials", "Employer Details", "Other Details"],
    []
  );

  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (currentTab) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email *</label>
              <input
                type="email"
                name="Email"
                value={formData.Email}
                onChange={handleInputChange}
                className="input w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Enter Password *</label>
                <input
                  type="password"
                  name="Password"
                  value={formData.Password}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Re-type Password *</label>
                <input
                  type="password"
                  name="VerifyPassword"
                  value={formData.VerifyPassword}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization Name *</label>
              <input
                type="text"
                name="OrganizationName"
                value={formData.OrganizationName}
                onChange={handleInputChange}
                className="input w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Incorporation Date</label>
                <input
                  type="date"
                  name="IncorporationDate"
                  value={formData.IncorporationDate}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Address1 *</label>
                <textarea
                  name="Address1"
                  rows={4}
                  value={formData.Address1}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address2</label>
                <textarea
                  name="Address2"
                  rows={4}
                  value={formData.Address2}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">City *</label>
                <input
                  type="text"
                  name="City"
                  value={formData.City}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Province *</label>
                <select
                  name="Province"
                  value={formData.Province}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                >
                  <option value="">Select Province</option>
                  {provs.map((p) => (
                    <option key={p.DValue} value={p.DValue}>
                      {p.DValue}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">P.O.Box *</label>
                <input
                  type="text"
                  name="POBox"
                  value={formData.POBox}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Website</label>
                <input
                  type="text"
                  name="Website"
                  value={formData.Website}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text sm font-medium text-gray-700">Mobile No *</label>
                <input
                  type="text"
                  name="MobilePhone"
                  value={formData.MobilePhone}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Landline No</label>
                <input
                  type="text"
                  name="LandLine"
                  value={formData.LandLine}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Type *</label>
                <select
                  name="OrganizationType"
                  value={formData.OrganizationType}
                  onChange={handleInputChange}
                  className="input w-full border rounded px-3 py-2"
                  required
                >
                  <option value="">=Select Type</option>
                  <option value="State">State</option>
                  <option value="Private">Private</option>
                </select>
              </div>
            </div>

            {/* Insurance Provider FIRST */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Insurance Provider</label>
              <select
                name="InsuranceProviderIPACode"
                value={formData.InsuranceProviderIPACode}
                onChange={handleInputChange}
                className="input w-full border rounded px-3 py-2 disabled:bg-gray-100"
                disabled={insuranceDisabled}
              >
                <option value="">=Select Provider (Searchable)</option>
                {providers.map((p) => (
                  <option key={p.IPACODE} value={p.IPACODE}>
                    {p.InsuranceCompanyOrganizationName}
                  </option>
                ))}
              </select>
              {formData.InsuranceProviderIPACode && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {selectedProvider?.InsuranceCompanyOrganizationName ?? ""}
                </p>
              )}
              {insuranceDisabled && (
                <p className="text-xs text-gray-500 mt-1">
                  Insurance Provider is only applicable for Private organizations.
                </p>
              )}
            </div>

            {/* Validation Code BELOW Insurance Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700">{validationCodeLabel} *</label>
              <input
                type="text"
                name="ValidationCode"
                value={formData.ValidationCode}
                onChange={handleInputChange}
                className="input w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="IsLevyPaid"
                  checked={formData.IsLevyPaid}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Is Levy Paid
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Levy Reference Number {formData.IsLevyPaid ? "*" : ""}
                </label>
                <input
                  type="text"
                  name="LevyReferenceNumber"
                  value={formData.LevyReferenceNumber}
                  onChange={handleInputChange}
                  disabled={levyRefDisabled}
                  className="input w-full border rounded px-3 py-2 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Flags */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="IsAgent"
                  checked={formData.IsAgent}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Are you an Agency?
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="IsLawyer"
                  checked={formData.IsLawyer}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Are you a law firm?
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="IsInsuranceCompany"
                  checked={formData.IsInsuranceCompany}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Are you an Insurance Company?
              </label>
            </div>

            {ipamasterCount !== null && (
              <p className="text-xs text-gray-500">(Info) IPA Master records: {ipamasterCount}</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Main modal */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
            <h2 className="text-xl font-semibold text-gray-900">Register Employer</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
              aria-label="Close"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {initialLoading && (
              <div className="mb-4 p-3 bg-gray-50 text-gray-700 rounded-md">Loading…</div>
            )}
            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
            {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

            <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
              {["Account Credentials", "Employer Details", "Other Details"].map((tab, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTab(index + 1)}
                  className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${
                    currentTab === index + 1
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {renderTabContent()}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-secondary border px-4 py-2 rounded"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary bg-primary text-white px-4 py-2 rounded"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Summary modal */}
      {showSummary && summaryData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-lg font-semibold">Employer Registered</h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
                aria-label="Close summary"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">EMID</span>
                <span className="font-medium">{summaryData.EMID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Employer Name</span>
                <span className="font-medium">{summaryData.OrganizationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">CPPS ID</span>
                <span className="font-medium">{summaryData.CPPSID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Organization Type</span>
                <span className="font-medium">{summaryData.OrganizationType || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Insurance Provider</span>
                <span className="font-medium">{summaryData.InsuranceProviderName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">IPA Code</span>
                <span className="font-medium">{summaryData.IPACode || "—"}</span>
              </div>
							  <div className="flex justify-between">
                <span className="text-gray-600">Email</span>
                <span className="font-medium">{summaryData.Email || "—"}</span>
              </div>
              {summaryData.CreatedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Created At</span>
                  <span className="font-medium">{summaryData.CreatedAt}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewEmployerRegistrationForm;
