import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Edit2, Trash2, Eye, Save, Key, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import bcrypt from 'bcryptjs';

interface InsuranceCompanyManagerProps {
  onClose: () => void;
  initialView?: 'list' | 'add' | 'edit' | 'view';
}

interface InsuranceCompany {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyIncorporationDate: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  Latitude: string;
  Longitude: string;
  Website: string;
  MobilePhone: string;
  InsuranceCompanyLandLine: string;
  InsuranceCompanyEmailID: string;
  Fax: string;
  ICMID: number;
  InsuranceCompanyID: string;
  // Account fields (not in DB table but used for form)
  email?: string;
  password?: string;
}

const InsuranceCompanyManager: React.FC<InsuranceCompanyManagerProps> = ({ onClose, initialView = 'list' }) => {
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'view'>(initialView);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<InsuranceCompany | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ ipacode: string; userId: string | null; name: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<InsuranceCompany>>({
    IPACODE: '',
    InsuranceCompanyOrganizationName: '',
    InsuranceCompanyIncorporationDate: '',
    InsuranceCompanyAddress1: '',
    InsuranceCompanyAddress2: '',
    InsuranceCompanyCity: '',
    InsuranceCompanyProvince: '',
    InsuranceCompanyPOBox: '',
    Latitude: '',
    Longitude: '',
    Website: '',
    MobilePhone: '',
    InsuranceCompanyLandLine: '',
    InsuranceCompanyEmailID: '',
    Fax: '',
    InsuranceCompanyID: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    if (view === 'list') {
      fetchCompanies();
    }
  }, [view]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insurancecompanymaster')
        .select('*')
        .order('InsuranceCompanyOrganizationName');
      if (error) throw error;
      setCompanies(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const checkEmailExists = async (email: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return !!data;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.email || !formData.password) {
        throw new Error('Email and Password are required for new registration');
      }

      // 1. Check if email exists
      const emailExists = await checkEmailExists(formData.email);
      if (emailExists) throw new Error('Email already exists in the system');

      // 2. Create User and Profile
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(formData.password, salt);

      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .insert({
          email: formData.email.trim(),
          password: hashedPassword,
          name: formData.InsuranceCompanyOrganizationName?.trim(),
          group_id: 13 // Insurance Company Group
        })
        .select('id')
        .single();

      if (userErr) throw userErr;

      const { error: profileErr } = await supabase
        .from('profiles')
        .insert({
          id: userRow.id,
          email: formData.email.trim(),
          full_name: formData.InsuranceCompanyOrganizationName?.trim(),
          phone_number: formData.MobilePhone?.trim()
        });

      if (profileErr) {
        await supabase.from('users').delete().eq('id', userRow.id);
        throw profileErr;
      }

      // 3. Create Insurance Company Record
      const { email, password, ...dbData } = formData;
      const { error: insErr } = await supabase
        .from('insurancecompanymaster')
        .insert([{ ...dbData, InsuranceCompanyID: userRow.id }]);

      if (insErr) {
        await supabase.from('profiles').delete().eq('id', userRow.id);
        await supabase.from('users').delete().eq('id', userRow.id);
        throw insErr;
      }

      setSuccess('Insurance Provider created successfully');
      setView('list');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { email, password, ICMID, ...dbData } = formData;
      const { error: insErr } = await supabase
        .from('insurancecompanymaster')
        .update(dbData)
        .eq('IPACODE', formData.IPACODE);

      if (insErr) throw insErr;

      // Update profile if ID exists
      if (formData.InsuranceCompanyID) {
        await supabase
          .from('profiles')
          .update({
            full_name: formData.InsuranceCompanyOrganizationName?.trim(),
            phone_number: formData.MobilePhone?.trim()
          })
          .eq('id', formData.InsuranceCompanyID);
        
        await supabase
          .from('users')
          .update({
            name: formData.InsuranceCompanyOrganizationName?.trim()
          })
          .eq('id', formData.InsuranceCompanyID);
      }

      setSuccess('Insurance Provider updated successfully');
      setView('list');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { ipacode, userId } = deleteConfirm;
    
    setLoading(true);
    try {
      const { error: delErr } = await supabase
        .from('insurancecompanymaster')
        .delete()
        .eq('IPACODE', ipacode);
      if (delErr) throw delErr;

      if (userId) {
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.from('users').delete().eq('id', userId);
      }

      setSuccess('Insurance Provider deleted successfully');
      setDeleteConfirm(null);
      fetchCompanies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return companies;
    return companies.filter(c => 
      (c.InsuranceCompanyOrganizationName || '').toLowerCase().includes(q) ||
      (c.IPACODE || '').toLowerCase().includes(q)
    );
  }, [searchTerm, companies]);

  const openAdd = () => {
    setFormData({
      IPACODE: '',
      InsuranceCompanyOrganizationName: '',
      InsuranceCompanyIncorporationDate: '',
      InsuranceCompanyAddress1: '',
      InsuranceCompanyAddress2: '',
      InsuranceCompanyCity: '',
      InsuranceCompanyProvince: '',
      InsuranceCompanyPOBox: '',
      Latitude: '',
      Longitude: '',
      Website: '',
      MobilePhone: '',
      InsuranceCompanyLandLine: '',
      InsuranceCompanyEmailID: '',
      Fax: '',
      InsuranceCompanyID: '',
      email: '',
      password: ''
    });
    setView('add');
  };

  const openEdit = (company: InsuranceCompany) => {
    setFormData({ ...company });
    setView('edit');
  };

  const openView = (company: InsuranceCompany) => {
    setFormData({ ...company });
    setView('view');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {view === 'list' && 'Insurance Provider Management'}
            {view === 'add' && 'Add New Insurance Provider'}
            {view === 'edit' && 'Edit Insurance Provider'}
            {view === 'view' && 'View Insurance Provider'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

          {view === 'list' ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Company Name or IPA Code..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
                <button onClick={openAdd} className="btn btn-primary flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add Provider
                </button>
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IPA Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Province</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr><td colSpan={4} className="px-6 py-4 text-center">Loading...</td></tr>
                    ) : filteredCompanies.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-4 text-center">No providers found.</td></tr>
                    ) : (
                      filteredCompanies.map((c) => (
                        <tr key={c.IPACODE} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.IPACODE}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.InsuranceCompanyOrganizationName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.InsuranceCompanyProvince}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button onClick={() => openView(c)} className="text-blue-600 hover:text-blue-900"><Eye className="h-4 w-4 inline" /></button>
                            <button onClick={() => openEdit(c)} className="text-amber-600 hover:text-amber-900"><Edit2 className="h-4 w-4 inline" /></button>
                             <button onClick={() => setDeleteConfirm({ ipacode: c.IPACODE, userId: c.InsuranceCompanyID, name: c.InsuranceCompanyOrganizationName })} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4 inline" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <form onSubmit={view === 'add' ? handleAdd : handleEdit} className="space-y-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Company Information</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IPA CODE *</label>
                    <input
                      name="IPACODE"
                      value={formData.IPACODE}
                      onChange={handleInputChange}
                      disabled={view !== 'add'}
                      className="mt-1 block w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Organization Name *</label>
                    <input
                      name="InsuranceCompanyOrganizationName"
                      value={formData.InsuranceCompanyOrganizationName}
                      onChange={handleInputChange}
                      readOnly={view === 'view'}
                      className="mt-1 block w-full border rounded-md px-3 py-2"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Incorporation Date</label>
                      <input
                        type="date"
                        name="InsuranceCompanyIncorporationDate"
                        value={formData.InsuranceCompanyIncorporationDate}
                        onChange={handleInputChange}
                        readOnly={view === 'view'}
                        className="mt-1 block w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">IPA ID (Internal)</label>
                      <input
                        name="InsuranceCompanyID"
                        value={formData.InsuranceCompanyID}
                        className="mt-1 block w-full border rounded-md px-3 py-2 bg-gray-100"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Account Settings (Only for Add) */}
                {view === 'add' && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-primary/20">
                    <h3 className="text-lg font-medium text-primary flex items-center gap-2">
                      <Key className="h-5 w-5" /> Account Credentials
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email Address *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border rounded-md px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password *</label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border rounded-md px-3 py-2"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Contact Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Contact Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mobile Phone</label>
                      <input
                        name="MobilePhone"
                        value={formData.MobilePhone}
                        onChange={handleInputChange}
                        readOnly={view === 'view'}
                        className="mt-1 block w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Landline</label>
                      <input
                        name="InsuranceCompanyLandLine"
                        value={formData.InsuranceCompanyLandLine}
                        onChange={handleInputChange}
                        readOnly={view === 'view'}
                        className="mt-1 block w-full border rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Official Email</label>
                    <input
                      name="InsuranceCompanyEmailID"
                      value={formData.InsuranceCompanyEmailID}
                      onChange={handleInputChange}
                      readOnly={view === 'view'}
                      className="mt-1 block w-full border rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Website</label>
                    <input
                      name="Website"
                      value={formData.Website}
                      onChange={handleInputChange}
                      readOnly={view === 'view'}
                      className="mt-1 block w-full border rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Address</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
                    <input
                      name="InsuranceCompanyAddress1"
                      value={formData.InsuranceCompanyAddress1}
                      onChange={handleInputChange}
                      readOnly={view === 'view'}
                      className="mt-1 block w-full border rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                    <input
                      name="InsuranceCompanyAddress2"
                      value={formData.InsuranceCompanyAddress2}
                      onChange={handleInputChange}
                      readOnly={view === 'view'}
                      className="mt-1 block w-full border rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      <input
                        name="InsuranceCompanyCity"
                        value={formData.InsuranceCompanyCity}
                        onChange={handleInputChange}
                        readOnly={view === 'view'}
                        className="mt-1 block w-full border rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Province</label>
                      <input
                        name="InsuranceCompanyProvince"
                        value={formData.InsuranceCompanyProvince}
                        onChange={handleInputChange}
                        readOnly={view === 'view'}
                        className="mt-1 block w-full border rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
                >
                  {view === 'view' ? 'Back' : 'Cancel'}
                </button>
                {view !== 'view' && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <Save className="h-4 w-4" /> {view === 'add' ? 'Create Provider' : 'Save Changes'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4 text-red-600">
                <div className="p-3 bg-red-50 rounded-full">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold">Confirm Deletion</h3>
              </div>
              
              <div className="space-y-3">
                <p className="text-gray-600">
                  Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteConfirm.name}</span>?
                </p>
                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded border">
                  This action will permanently remove the insurance provider and their associated user account. This cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-4 bg-gray-50 border-t">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsuranceCompanyManager;
