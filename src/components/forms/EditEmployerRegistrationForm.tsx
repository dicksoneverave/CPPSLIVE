import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface EditEmployerRegistrationFormProps {
  employerId: string;
  onClose: () => void;
}

interface EmployerData {
  EMID: string;
  CPPSID: string;
  OrganizationName: string;
  IncorporationDate: string;
  Address1: string;
  Address2: string;
  City: string;
  Province: string;
  POBox: string;
  Website: string;
  MobilePhone: string;
  LandLine: string;
  Email: string; // replaced Fax with Email
  OrganizationType: string;
  ValidationCode: string;
  InsuranceProviderIPACode: string;
  IsLevyPaid: string;
  LevyReferenceNumber: string;
  IsAgent: string;
  IsLawyer: string;
  IsInsuranceCompany: string;
}

interface ProvinceOption {
  DKey: string;
  DValue: string;
}

interface InsuranceProvider {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
}

type ChangeRow = { field: string; from: string; to: string };

const FIELD_LABELS: Record<keyof EmployerData, string> = {
  EMID: 'EMID',
  CPPSID: 'CPPS ID',
  OrganizationName: 'Organization Name',
  IncorporationDate: 'Incorporation Date',
  Address1: 'Address Line 1',
  Address2: 'Address Line 2',
  City: 'City',
  Province: 'Province',
  POBox: 'P.O. Box',
  Website: 'Website',
  MobilePhone: 'Mobile Phone',
  LandLine: 'Landline',
  Email: 'Email',
  OrganizationType: 'Organization Type',
  ValidationCode: 'Validation Code',
  InsuranceProviderIPACode: 'Insurance Provider',
  IsLevyPaid: 'Is Levy Paid',
  LevyReferenceNumber: 'Levy Reference Number',
  IsAgent: 'Is Agent',
  IsLawyer: 'Is Lawyer',
  IsInsuranceCompany: 'Is Insurance Company',
};

// Fields per tab (for badge counts)
const TAB_FIELDS = {
  1: [
    'OrganizationName',
    'IncorporationDate',
    'Address1',
    'Address2',
    'City',
    'Province',
    'POBox',
    'OrganizationType',
    'ValidationCode',
    'Website',
  ] as (keyof EmployerData)[],
  2: [
    'MobilePhone',
    'LandLine',
    'Email',
    'IsLevyPaid',
    'LevyReferenceNumber',
    'IsAgent',
    'IsLawyer',
    'IsInsuranceCompany',
  ] as (keyof EmployerData)[],
  3: ['InsuranceProviderIPACode'] as (keyof EmployerData)[],
};

const EditEmployerRegistrationForm: React.FC<EditEmployerRegistrationFormProps> = ({ employerId, onClose }) => {
  const [currentTab, setCurrentTab] = useState(1);
  const [formData, setFormData] = useState<EmployerData | null>(null);
  const [originalData, setOriginalData] = useState<EmployerData | null>(null);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // summary modal state
  const [showSummary, setShowSummary] = useState(false);
  const [changes, setChanges] = useState<ChangeRow[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: employer, error: employerError } = await supabase
        .from('employermaster')
        .select('*')
        .eq('EMID', employerId)
        .single();

      if (employerError) throw employerError;
      if (!employer) throw new Error('Employer not found');

      setFormData(employer);
      setOriginalData(employer);

      const { data: provinceData, error: provinceError } = await supabase
        .from('dictionary')
        .select('DKey, DValue')
        .eq('DType', 'Province')
        .order('DValue');

      if (provinceError) throw provinceError;
      setProvinces(provinceData || []);

      const { data: insuranceData, error: insuranceError } = await supabase
        .from('insurancecompanymaster')
        .select('IPACODE, InsuranceCompanyOrganizationName')
        .order('InsuranceCompanyOrganizationName');

      if (insuranceError) throw insuranceError;
      setInsuranceProviders(insuranceData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load employer data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // already yyyy-mm-dd
    return date.toISOString().split('T')[0];
  };

  const normalizeYN = (val?: string) => (val === '1' || val === 'Yes' ? '1' : '0');
  const toYesNo = (val?: string) => (val === '1' || val === 'Yes' ? 'Yes' : 'No');
  const isChecked = (val?: string) => val === '1' || val === 'Yes';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!formData) return;
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev!,
      [name]: type === 'checkbox' ? ((e.target as HTMLInputElement).checked ? '1' : '0') : value
    }));
  };

  // Diff helpers
  const compareForDiff = (key: keyof EmployerData, a?: string, b?: string) => {
    if (['IsLevyPaid', 'IsAgent', 'IsLawyer', 'IsInsuranceCompany'].includes(key)) {
      return normalizeYN(a) !== normalizeYN(b);
    }
    if (key === 'IncorporationDate') {
      const da = a ? formatDateForInput(a) : '';
      const db = b ? formatDateForInput(b) : '';
      return da !== db;
    }
    return (a ?? '') !== (b ?? '');
  };

  const displayValue = (k: keyof EmployerData, v: string) => {
    if (['IsLevyPaid', 'IsAgent', 'IsLawyer', 'IsInsuranceCompany'].includes(k)) return toYesNo(v);
    if (k === 'InsuranceProviderIPACode') {
      const n = insuranceProviders.find(p => p.IPACODE === v)?.InsuranceCompanyOrganizationName;
      return n || (v ?? '');
    }
    if (k === 'IncorporationDate') return v ? formatDateForInput(v) : '';
    return v ?? '';
  };

  const computeChanges = (before: EmployerData, after: EmployerData): ChangeRow[] => {
    const keys = Object.keys(FIELD_LABELS) as (keyof EmployerData)[];
    const rows: ChangeRow[] = [];
    for (const key of keys) {
      if (compareForDiff(key, before[key], after[key])) {
        rows.push({
          field: FIELD_LABELS[key],
          from: displayValue(key, before[key] ?? ''),
          to: displayValue(key, after[key] ?? ''),
        });
      }
    }
    return rows;
  };

  // Live change counts per tab (badges)
  const tabChangeCounts = useMemo(() => {
    if (!originalData || !formData) return { 1: 0, 2: 0, 3: 0 };
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    (Object.keys(TAB_FIELDS) as unknown as (keyof typeof TAB_FIELDS)[]).forEach(tabId => {
      const keys = TAB_FIELDS[tabId as unknown as 1 | 2 | 3];
      counts[tabId as unknown as number] = keys.reduce(
        (acc, k) => acc + (compareForDiff(k, originalData[k], formData[k]) ? 1 : 0),
        0
      );
    });
    return counts;
  }, [originalData, formData]);

  // Submit: open summary
  const handleOpenSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !originalData) return;

    const requiredFields: (keyof EmployerData)[] = [
      'OrganizationName', 'Address1', 'City', 'Province',
      'POBox', 'MobilePhone', 'OrganizationType', 'ValidationCode'
    ];
    const missing = requiredFields.filter(f => !formData[f]);
    if (missing.length) {
      setError(`Please fill in all required fields: ${missing.map(m => FIELD_LABELS[m]).join(', ')}`);
      return;
    }

    const rows = computeChanges(originalData, formData);
    if (!rows.length) {
      setError('No changes detected.');
      return;
    }
    setChanges(rows);
    setShowSummary(true);
  };

  // Confirm: persist to DB
  const handleConfirmUpdate = async () => {
    if (!formData) return;
    setError(null);
    setSuccess(null);

    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('employermaster')
        .update({
          OrganizationName: formData.OrganizationName,
          IncorporationDate: formData.IncorporationDate || null,
          Address1: formData.Address1,
          Address2: formData.Address2 || null,
          City: formData.City,
          Province: formData.Province,
          POBox: formData.POBox,
          Website: formData.Website || null,
          MobilePhone: formData.MobilePhone,
          LandLine: formData.LandLine || null,
          Email: formData.Email || null,
          OrganizationType: formData.OrganizationType,
          ValidationCode: formData.ValidationCode,
          InsuranceProviderIPACode: formData.InsuranceProviderIPACode || null,
          IsLevyPaid: normalizeYN(formData.IsLevyPaid),
          LevyReferenceNumber: formData.LevyReferenceNumber || null,
          IsAgent: normalizeYN(formData.IsAgent),
          IsLawyer: normalizeYN(formData.IsLawyer),
          IsInsuranceCompany: normalizeYN(formData.IsInsuranceCompany),
        })
        .eq('EMID', employerId);

      if (updateError) throw updateError;

      setSuccess(`Employer ${formData.OrganizationName} updated successfully!`);
      setShowSummary(false);
      setOriginalData(formData); // reset baseline
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('Error updating employer:', err);
      setError('Failed to update employer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-3 text-lg">Loading employer data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !formData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <X className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 1, name: 'Organization Details' },
    { id: 2, name: 'Contact Information' },
    { id: 3, name: 'Insurance Information' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            Edit Employer Registration - {formData?.OrganizationName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs with change badges */}
        <div className="border-b bg-gray-50 sticky top-[73px] z-10">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              const count = (tabChangeCounts as any)[tab.id] || 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{tab.name}</span>
                  {count > 0 && (
                    <span
                      className={`ml-1 inline-flex items-center justify-center px-2 min-w-[1.5rem] h-5 rounded-full text-xs font-semibold ${
                        isActive ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && formData && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>
          )}

          {/* FORM */}
          <form onSubmit={handleOpenSummary}>
            {/* Tab 1 */}
            {currentTab === 1 && formData && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPPS ID</label>
                    <input type="text" value={formData.CPPSID || ''} className="input bg-gray-50" disabled readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                    <input
                      type="text"
                      name="OrganizationName"
                      value={formData.OrganizationName || ''}
                      onChange={handleInputChange}
                      className="input"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Incorporation Date</label>
                    <input
                      type="date"
                      name="IncorporationDate"
                      value={formatDateForInput(formData.IncorporationDate) || ''}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Type *</label>
                    <select
                      name="OrganizationType"
                      value={formData.OrganizationType || ''}
                      onChange={handleInputChange}
                      className="input"
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="State">State</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                    <textarea
                      name="Address1"
                      value={formData.Address1 || ''}
                      onChange={handleInputChange}
                      className="input"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                    <textarea
                      name="Address2"
                      value={formData.Address2 || ''}
                      onChange={handleInputChange}
                      className="input"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input type="text" name="City" value={formData.City || ''} onChange={handleInputChange} className="input" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                    <select name="Province" value={formData.Province || ''} onChange={handleInputChange} className="input" required>
                      <option value="">Select Province</option>
                      {provinces.map(p => (
                        <option key={p.DValue} value={p.DValue}>{p.DValue}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">P.O. Box *</label>
                    <input type="text" name="POBox" value={formData.POBox || ''} onChange={handleInputChange} className="input" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validation Code *</label>
                    <input type="text" name="ValidationCode" value={formData.ValidationCode || ''} onChange={handleInputChange} className="input" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input type="text" name="Website" value={formData.Website || ''} onChange={handleInputChange} className="input" />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2 */}
            {currentTab === 2 && formData && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone *</label>
                    <input
                      type="text"
                      name="MobilePhone"
                      value={formData.MobilePhone || ''}
                      onChange={handleInputChange}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Landline</label>
                    <input
                      type="text"
                      name="LandLine"
                      value={formData.LandLine || ''}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="Email"
                      value={formData.Email || ''}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="IsLevyPaid"
                      checked={isChecked(formData.IsLevyPaid)}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-primary border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Is Levy Paid</label>
                  </div>

                  {isChecked(formData.IsLevyPaid) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Levy Reference Number</label>
                      <input
                        type="text"
                        name="LevyReferenceNumber"
                        value={formData.LevyReferenceNumber || ''}
                        onChange={handleInputChange}
                        className="input"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="IsAgent"
                      checked={isChecked(formData.IsAgent)}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-primary border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Is Agent</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="IsLawyer"
                      checked={isChecked(formData.IsLawyer)}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-primary border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Is Lawyer</label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="IsInsuranceCompany"
                      checked={isChecked(formData.IsInsuranceCompany)}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-primary border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">Is Insurance Company</label>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3 */}
            {currentTab === 3 && formData && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Insurance Provider Information</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                  <select
                    name="InsuranceProviderIPACode"
                    value={formData.InsuranceProviderIPACode || ''}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="">Select Insurance Provider</option>
                    {insuranceProviders.map(provider => (
                      <option key={provider.IPACODE} value={provider.IPACODE}>
                        {provider.InsuranceCompanyOrganizationName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={() => setCurrentTab(Math.max(1, currentTab - 1))}
                disabled={currentTab === 1}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex space-x-4">
                <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
                  Cancel
                </button>
                {currentTab === 3 && (
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Updating...' : 'Update Employer'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCurrentTab(Math.min(3, currentTab + 1))}
                disabled={currentTab === 3}
                className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </form>
        </div>

        {/* CHANGES SUMMARY MODAL */}
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
                      {changes.map((c, idx) => (
                        <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 font-medium text-gray-900">{c.field}</td>
                          <td className="px-3 py-2 text-gray-700">{c.from || <span className="italic text-gray-400">empty</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{c.to || <span className="italic text-gray-400">empty</span>}</td>
                        </tr>
                      ))}
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
    </div>
  );
};

export default EditEmployerRegistrationForm;
