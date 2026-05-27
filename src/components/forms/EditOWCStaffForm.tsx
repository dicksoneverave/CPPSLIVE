import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import bcrypt from 'bcryptjs';
import { supabase } from '../../services/supabase';

/**
 * Edit form for an existing OWC Staff member.
 *
 * Props:
 * - onClose: close the modal
 * - staffId: OSMStaffID (string) for the staff member to edit
 *
 * This component:
 * - Prefills data by joining owcstaffmaster → users (via cppsid) → profiles
 * - Lets you change email, name fields, designation (user group), province/region, etc
 * - Optionally change password (only if the password fields are provided & match)
 * - Updates users, profiles, and owcstaffmaster consistently
 * - Loads lists of usernames from `users` (emails) and `owcstaffmaster` (OSMStaffID) for validation and display
 */

interface EditOWCStaffFormProps {
  onClose: () => void;
  staffId: string; // OSMStaffID
}

interface Province { DValue: string }
interface UserGroup { id: number; title: string }

interface FormData {
  // Account
  email: string;
  password: string; // optional; update only if provided
  verifyPassword: string;

  // Staff
  OSMFirstName: string;
  OSMLastName: string;
  OSMDesignation: string; // maps to user group title → users.group_id
  InchargeProvince: string;
  InchargeRegion: string;
  OSMDepartment: string;
  OSMMobilePhone: string;
  OSMActive: boolean;
  OSMLocked: boolean;
  OSMStaffID: string; // readonly
}

const emptyForm: FormData = {
  email: '',
  password: '',
  verifyPassword: '',
  OSMFirstName: '',
  OSMLastName: '',
  OSMDesignation: '',
  InchargeProvince: '',
  InchargeRegion: '',
  OSMDepartment: '',
  OSMMobilePhone: '',
  OSMActive: true,
  OSMLocked: false,
  OSMStaffID: ''
};

const EditOWCStaffForm: React.FC<EditOWCStaffFormProps> = ({ onClose, staffId }) => {
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // For validation / awareness
  const [allUserEmails, setAllUserEmails] = useState<string[]>([]);
  const [allStaffIds, setAllStaffIds] = useState<string[]>([]);

  // We keep track of current user id (cppsid) & current group id
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentGroupId, setCurrentGroupId] = useState<number | null>(null);

  // ------- helpers -------
  const selectedGroup = useMemo(() => userGroups.find(g => g.title === formData.OSMDesignation) || null, [userGroups, formData.OSMDesignation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // Auto-fill region when province changes
  useEffect(() => {
    const run = async () => {
      if (!formData.InchargeProvince) {
        setFormData(prev => ({ ...prev, InchargeRegion: '' }));
        return;
      }
      const { data, error } = await supabase
        .from('dictionary')
        .select('DValue')
        .eq('DType', 'ProvinceRegion')
        .eq('DKey', formData.InchargeProvince)
        .maybeSingle();

      if (error) {
        // don't hard fail—just clear region
        setFormData(prev => ({ ...prev, InchargeRegion: '' }));
        return;
      }
      setFormData(prev => ({ ...prev, InchargeRegion: data?.DValue || '' }));


    };
    run();
  }, [formData.InchargeProvince]);

  // Initial loads: provinces, groups, usernames, and the record to edit
  useEffect(() => {
    const load = async () => {
      try {
        setInitialLoading(true);
        setError(null);

        // Provinces
        const { data: provinceData, error: provinceErr } = await supabase
          .from('dictionary')
          .select('DValue')
          .eq('DType', 'Province')
          .order('DValue');
        if (provinceErr) throw provinceErr;
        setProvinces(provinceData || []);

        // User groups
        const { data: groupData, error: groupErr } = await supabase
          .from('owc_usergroups')
          .select('id, title')
          .order('title');
        if (groupErr) throw groupErr;
        setUserGroups(groupData || []);

        // All usernames
        const [{ data: usersList, error: usersErr }, { data: staffList, error: staffErr }] = await Promise.all([
          supabase.from('users').select('email'),
          supabase.from('owcstaffmaster').select('OSMStaffID')
        ]);
        if (usersErr) throw usersErr;
        if (staffErr) throw staffErr;
        setAllUserEmails((usersList || []).map(u => u.email).filter(Boolean));
        setAllStaffIds((staffList || []).map((s: any) => s.OSMStaffID).filter(Boolean));

        // Load the staff row by OSMStaffID
// Load the record from the view
const { data: vrow, error: viewErr } = await supabase
  .from('v_owcstaff_with_user')
  .select('*')
  .eq('OSMStaffID', staffId)
  .maybeSingle();
if (viewErr) throw viewErr;
if (!vrow) throw new Error('Staff record not found');

const cppsid: string = vrow.cppsid;
if (!cppsid) throw new Error('Linked user (cppsid) missing on staff record');
setCurrentUserId(cppsid);
setCurrentGroupId(vrow.group_id ?? null);

// Prefill form using the view row
const form: FormData = {
  email: vrow.email || '',
  password: '',
  verifyPassword: '',
  OSMFirstName: vrow.OSMFirstName || '',
  OSMLastName: vrow.OSMLastName || '',
  OSMDesignation: vrow.OSMDesignation || (groupData?.find(g => g.id === vrow.group_id)?.title ?? ''),
  InchargeProvince: vrow.InchargeProvince || '',
  InchargeRegion: vrow.InchargeRegion || '',
  OSMDepartment: vrow.OSMDepartment || '',
  OSMMobilePhone: vrow.OSMMobilePhone || '',
  OSMActive: vrow.OSMActive === '1' || vrow.OSMActive === 1 || vrow.OSMActive === true,
  OSMLocked: vrow.OSMLocked === 1 || vrow.OSMLocked === true,
  OSMStaffID: vrow.OSMStaffID || staffId
};
setFormData(form);

      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load staff record');
      } finally {
        setInitialLoading(false);
      }
    };

    load();
  }, [staffId]);

  // Validate email uniqueness (excluding the current user id)
  const emailExistsForOther = async (email: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .neq('id', currentUserId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic requireds
    const missing: string[] = [];
    const req: (keyof FormData)[] = ['email','OSMFirstName','OSMLastName','OSMDesignation','InchargeProvince','OSMDepartment','OSMMobilePhone'];
    req.forEach(k => { if (!formData[k]) missing.push(k); });
    if (missing.length) {
      setError(`Please fill in all required fields: ${missing.join(', ')}`);
      return;
    }

    // Password handling (optional)
    let newPasswordHash: string | null = null;
    if (formData.password || formData.verifyPassword) {
      if (formData.password !== formData.verifyPassword) {
        setError('Passwords do not match');
        return;
      }
      const salt = await bcrypt.genSalt(10);
      newPasswordHash = await bcrypt.hash(formData.password, salt);
    }

    try {
      setLoading(true);

      // Validate unique email if changed
      const emailTaken = await emailExistsForOther(formData.email);
      if (emailTaken) {
        setError('Email already exists. Please use a different email address.');
        return;
      }

      // Resolve group id from title
      const group = userGroups.find(g => g.title === formData.OSMDesignation);
      if (!group) {
        setError('Invalid designation selected');
        return;
      }

      // --- Update users ---
      const fullName = `${formData.OSMFirstName} ${formData.OSMLastName}`.trim();
      const userUpdate: any = {
        email: formData.email,
        name: fullName,
        group_id: group.id
      };
      if (newPasswordHash) userUpdate.password = newPasswordHash;

      const { error: userUpdateErr } = await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', currentUserId);
      if (userUpdateErr) throw new Error(`Failed to update user: ${userUpdateErr.message}`);

      // --- Update profiles ---
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          email: formData.email,
          full_name: fullName,
          phone_number: formData.OSMMobilePhone
        })
        .eq('id', currentUserId);
      if (profileErr) throw new Error(`Failed to update profile: ${profileErr.message}`);

      // --- Update owcstaffmaster ---
      const { error: staffErr } = await supabase
        .from('owcstaffmaster')
        .update({
          OSMFirstName: formData.OSMFirstName,
          OSMLastName: formData.OSMLastName,
          OSMDesignation: formData.OSMDesignation,
          InchargeProvince: formData.InchargeProvince,
          InchargeRegion: (formData.InchargeRegion ?? '').toString().trim(),
          OSMDepartment: formData.OSMDepartment,
          OSMMobilePhone: formData.OSMMobilePhone,
          OSMActive: formData.OSMActive ? '1' : '0',
          OSMLocked: formData.OSMLocked ? 1 : 0,
          // keep cppsid the same
        })
        .eq('OSMStaffID', formData.OSMStaffID);
      if (staffErr) throw new Error(`Failed to update staff record: ${staffErr.message}`);

      setSuccess('Staff record updated successfully');
      // Clear password fields after a successful save
      setFormData(prev => ({ ...prev, password: '', verifyPassword: '' }));

      // Hide success after a short delay
      setTimeout(() => setSuccess(null), 3500);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to update staff record');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-2">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Edit OWC Staff</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit}>
            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
            {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

            {/* Reference lists (collapsed helper) */}
            <details className="mb-6">
              <summary className="cursor-pointer text-sm text-gray-700">Reference: existing usernames</summary>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold">users.email</div>
                  <div className="mt-1 max-h-32 overflow-auto border rounded p-2 bg-gray-50">
                    {allUserEmails.map((e,i) => (<div key={i}>{e}</div>))}
                  </div>
                </div>
                <div>
                  <div className="font-semibold">owcstaffmaster.OSMStaffID</div>
                  <div className="mt-1 max-h-32 overflow-auto border rounded p-2 bg-gray-50">
                    {allStaffIds.map((e,i) => (<div key={i}>{e}</div>))}
                  </div>
                </div>
              </div>
            </details>

            {/* Account Credentials */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Account</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">New Password (optional)</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                  <div>
                    <label htmlFor="verifyPassword" className="block text-sm font-medium text-gray-700">Verify New Password</label>
                    <input
                      id="verifyPassword"
                      name="verifyPassword"
                      type="password"
                      value={formData.verifyPassword}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Re-enter new password"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Staff Details */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Staff Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="OSMFirstName" className="block text-sm font-medium text-gray-700">First Name</label>
                    <input id="OSMFirstName" name="OSMFirstName" type="text" value={formData.OSMFirstName} onChange={handleInputChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required />
                  </div>
                  <div>
                    <label htmlFor="OSMLastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input id="OSMLastName" name="OSMLastName" type="text" value={formData.OSMLastName} onChange={handleInputChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required />
                  </div>
                </div>

                <div>
                  <label htmlFor="OSMDesignation" className="block text-sm font-medium text-gray-700">Designation</label>
                  <select id="OSMDesignation" name="OSMDesignation" value={formData.OSMDesignation} onChange={handleInputChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required>
                    <option value="">--Select Designation--</option>
                    {userGroups.map(g => <option key={g.id} value={g.title}>{g.title}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="InchargeProvince" className="block text-sm font-medium text-gray-700">Province</label>
                  <select id="InchargeProvince" name="InchargeProvince" value={formData.InchargeProvince} onChange={handleInputChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required>
                    <option value="">--Select Province--</option>
                    {provinces.map(p => <option key={p.DValue} value={p.DValue}>{p.DValue}</option>)}
                  </select>
                </div>

                <div>
                  <label htmlFor="InchargeRegion" className="block text-sm font-medium text-gray-700">Region</label>
                  <input id="InchargeRegion" name="InchargeRegion" type="text" value={formData.InchargeRegion} readOnly className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500" />
                </div>

                <div>
                  <label htmlFor="OSMDepartment" className="block text-sm font-medium text-gray-700">Department</label>
                  <input id="OSMDepartment" name="OSMDepartment" type="text" value={formData.OSMDepartment} onChange={handleInputChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required />
                </div>

                <div>
                  <label htmlFor="OSMMobilePhone" className="block text-sm font-medium text-gray-700">Mobile Phone</label>
                  <input id="OSMMobilePhone" name="OSMMobilePhone" type="text" value={formData.OSMMobilePhone} onChange={handleInputChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required />
                </div>

                <div>
                  <label htmlFor="OSMStaffID" className="block text-sm font-medium text-gray-700">Staff ID</label>
                  <input id="OSMStaffID" name="OSMStaffID" type="text" value={formData.OSMStaffID} readOnly className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500" />
                </div>

                <div className="flex space-x-6">
                  <div className="flex items-center">
                    <input id="OSMActive" name="OSMActive" type="checkbox" checked={formData.OSMActive} onChange={handleInputChange} className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary" />
                    <label htmlFor="OSMActive" className="ml-2 block text-sm text-gray-900">Active</label>
                  </div>
                  <div className="flex items-center">
                    <input id="OSMLocked" name="OSMLocked" type="checkbox" checked={formData.OSMLocked} onChange={handleInputChange} className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary" />
                    <label htmlFor="OSMLocked" className="ml-2 block text-sm text-gray-900">Locked</label>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end space-x-3 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center"
            disabled={loading}
          >
            {loading && <div className="mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>}
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditOWCStaffForm;
