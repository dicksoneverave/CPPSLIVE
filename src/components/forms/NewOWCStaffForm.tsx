import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import bcrypt from 'bcryptjs';

interface NewOWCStaffFormProps {
  onClose: () => void;
}

interface FormData {
  // Account Credentials
  email: string;
  password: string;
  verifyPassword: string;

  // Staff Details
  OSMFirstName: string;
  OSMLastName: string;
  OSMDesignation: string;
  InchargeProvince: string;
  InchargeRegion: string;
  OSMDepartment: string;
  OSMMobilePhone: string;
  OSMActive: boolean;
  OSMLocked: boolean;
  OSMStaffID: string;
}

interface UserGroup {
  id: number;
  title: string;
}

interface Province {
  DValue: string;
}

const initialFormState: FormData = {
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

const NewOWCStaffForm: React.FC<NewOWCStaffFormProps> = ({ onClose }) => {
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch provinces from dictionary table where DType = Province
        const { data: provinceData, error: provinceError } = await supabase
          .from('dictionary')
          .select('DValue')
          .eq('DType', 'Province')
          .order('DValue');

        if (provinceError) throw provinceError;
        setProvinces(provinceData || []);

        // Fetch user groups
        const { data: groupData, error: groupError } = await supabase
          .from('owc_usergroups')
          .select('id, title')
          .order('title');

        if (groupError) throw groupError;
        setUserGroups(groupData || []);

        await getNextStaffId();

      } catch (err) {
        console.error('Error fetching form data:', err);
        setError('Failed to load form data');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, []);

  const getNextStaffId = async () => {
    try {
      const { data: lastStaffData, error: staffError } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID')
        .order('OSMStaffID', { ascending: false })
        .limit(1);

      if (staffError) throw staffError;

      let nextStaffId = '1000'; // Default starting ID
      if (lastStaffData && lastStaffData.length > 0 && lastStaffData[0].OSMStaffID) {
        const lastId = parseInt(lastStaffData[0].OSMStaffID);
        nextStaffId = (lastId + 1).toString();
      }

      setFormData(prev => ({ ...prev, OSMStaffID: nextStaffId }));
    } catch (err) {
      console.error('Error getting next staff ID:', err);
      setError('Failed to generate staff ID');
    }
  };

  // Fetch region when province changes
  useEffect(() => {
    const fetchRegion = async () => {
      if (!formData.InchargeProvince) {
        setFormData(prev => ({ ...prev, InchargeRegion: '' }));
        return;
      }

      try {
        const { data: regionData, error: regionError } = await supabase
          .from('dictionary')
          .select('DValue')
          .eq('DType', 'ProvinceRegion')
          .eq('DKey', formData.InchargeProvince)
          .single();

        if (regionError) {
          if (regionError.code === 'PGRST116') {
            // No region found for this province
            setFormData(prev => ({ ...prev, InchargeRegion: '' }));
            return;
          }
          throw regionError;
        }

        setFormData(prev => ({ ...prev, InchargeRegion: regionData.DValue }));



      } catch (err) {
        console.error('Error fetching region:', err);
        setError('Failed to load region data');
        setFormData(prev => ({ ...prev, InchargeRegion: '' }));
      }
    };

    fetchRegion();
  }, [formData.InchargeProvince]);

  const resetForm = async () => {
    // Reset all fields except OSMStaffID
    setFormData({ 
      ...initialFormState,
      OSMStaffID: formData.OSMStaffID // Keep the current staff ID
    });
    
    // Get next staff ID
    await getNextStaffId();
    
    setError(null);
    
    // Keep success message visible for 3 seconds
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      if (error) throw error;
      
      return !!data; // Return true if data exists (email found)
    } catch (err) {
      console.error('Error checking email existence:', err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);

      // Validate passwords match
      if (formData.password !== formData.verifyPassword) {
        setError('Passwords do not match');
        return;
      }

      // Validate required fields
      const requiredFields = [
        'email', 'password', 'OSMFirstName', 'OSMLastName', 
        'OSMDesignation', 'InchargeProvince', 'OSMDepartment', 
        'OSMMobilePhone'
      ];

      const missingFields = requiredFields.filter(field => !formData[field as keyof FormData]);
      if (missingFields.length > 0) {
        setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
        return;
      }

      // Check if email already exists
      const emailExists = await checkEmailExists(formData.email);
      if (emailExists) {
        setError('Email already exists. Please use a different email address.');
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(formData.password, salt);

      // Find the group ID based on designation
      const group = userGroups.find(g => g.title === formData.OSMDesignation);
      if (!group) {
        setError('Invalid designation selected');
        return;
      }

      // Step 1: Create user in public.users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          email: formData.email,
          password: hashedPassword,
          name: `${formData.OSMFirstName} ${formData.OSMLastName}`,
          group_id: group.id
        })
        .select('id')
        .single();

      if (userError) {
        throw new Error(`Error creating user: ${userError.message}`);
      }

      if (!userData?.id) {
        throw new Error('User ID not returned after creation');
      }

      // Step 2: Create profile in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userData.id,
          email: formData.email,
          full_name: `${formData.OSMFirstName} ${formData.OSMLastName}`,
          phone_number: formData.OSMMobilePhone
        });

      if (profileError) {
        // Rollback user creation if profile creation fails
        await supabase.from('users').delete().eq('id', userData.id);
        throw new Error(`Error creating profile: ${profileError.message}`);
      }

      // Step 3: Create staff record in owcstaffmaster table
      const { error: staffError } = await supabase
        .from('owcstaffmaster')
        .insert({
          OSMFirstName: formData.OSMFirstName,
          OSMLastName: formData.OSMLastName,
          OSMDesignation: formData.OSMDesignation,
          InchargeProvince: formData.InchargeProvince,
          InchargeRegion: (formData.InchargeRegion ?? '').toString().trim(),
          OSMDepartment: formData.OSMDepartment,
          OSMMobilePhone: formData.OSMMobilePhone,
          OSMActive: formData.OSMActive ? '1' : '0',
          OSMLocked: formData.OSMLocked ? 1 : 0,
          OSMStaffID: formData.OSMStaffID,
          cppsid: userData.id
        });

      if (staffError) {
        // Rollback profile and user creation if staff creation fails
        await supabase.from('profiles').delete().eq('id', userData.id);
        await supabase.from('users').delete().eq('id', userData.id);
        throw new Error(`Error creating staff record: ${staffError.message}`);
      }

      setSuccess(`Staff member ${formData.OSMFirstName} ${formData.OSMLastName} created successfully`);
      await resetForm();

    } catch (err) {
      console.error('Error creating staff:', err);
      setError(err instanceof Error ? err.message : 'Failed to create staff member. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-2">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">New OWC Staff</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit}>
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

            {/* Account Credentials */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Account Credentials</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="verifyPassword" className="block text-sm font-medium text-gray-700">
                    Verify Password
                  </label>
                  <input
                    type="password"
                    id="verifyPassword"
                    name="verifyPassword"
                    value={formData.verifyPassword}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Staff Details */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Staff Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="OSMFirstName" className="block text-sm font-medium text-gray-700">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="OSMFirstName"
                      name="OSMFirstName"
                      value={formData.OSMFirstName}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="OSMLastName" className="block text-sm font-medium text-gray-700">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="OSMLastName"
                      name="OSMLastName"
                      value={formData.OSMLastName}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="OSMDesignation" className="block text-sm font-medium text-gray-700">
                    Designation
                  </label>
                  <select
                    id="OSMDesignation"
                    name="OSMDesignation"
                    value={formData.OSMDesignation}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">--Select Designation--</option>
                    {userGroups.map(group => (
                      <option key={group.id} value={group.title}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="InchargeProvince" className="block text-sm font-medium text-gray-700">
                    Province
                  </label>
                  <select
                    id="InchargeProvince"
                    name="InchargeProvince"
                    value={formData.InchargeProvince}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    <option value="">--Select Province--</option>
                    {provinces.map(province => (
                      <option key={province.DValue} value={province.DValue}>
                        {province.DValue}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="InchargeRegion" className="block text-sm font-medium text-gray-700">
                    Region
                  </label>
                  <input
                    type="text"
                    id="InchargeRegion"
                    name="InchargeRegion"
                    value={formData.InchargeRegion}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500"
                    readOnly
                  />
                </div>

                <div>
                  <label htmlFor="OSMDepartment" className="block text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <input
                    type="text"
                    id="OSMDepartment"
                    name="OSMDepartment"
                    value={formData.OSMDepartment}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="OSMMobilePhone" className="block text-sm font-medium text-gray-700">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    id="OSMMobilePhone"
                    name="OSMMobilePhone"
                    value={formData.OSMMobilePhone}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="OSMStaffID" className="block text-sm font-medium text-gray-700">
                    Staff ID
                  </label>
                  <input
                    type="text"
                    id="OSMStaffID"
                    name="OSMStaffID"
                    value={formData.OSMStaffID}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500"
                    readOnly
                  />
                </div>

                <div className="flex space-x-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="OSMActive"
                      name="OSMActive"
                      checked={formData.OSMActive}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="OSMActive" className="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="OSMLocked"
                      name="OSMLocked"
                      checked={formData.OSMLocked}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="OSMLocked" className="ml-2 block text-sm text-gray-900">
                      Locked
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

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
            {loading && (
              <div className="mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            )}
            {loading ? 'Creating...' : 'Create Staff'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewOWCStaffForm;
