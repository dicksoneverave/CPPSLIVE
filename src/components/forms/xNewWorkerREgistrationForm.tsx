import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import EmployerListModal from './EmployerListModal';
import InsuranceProviderListModal from './InsuranceProviderListModal';

interface NewWorkerRegistrationFormProps {
  onClose: () => void;
  /** Optional: when editing an existing worker, pass their WorkerID to pre-load work history */
  editingWorkerID?: string | number;
}

interface FormData {
  // Worker Personal Details
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerAliasName: string;
  WorkerDOB: string;
  WorkerGender: string;
  WorkerMarried: string;
  WorkerHanded: string;
  WorkerPlaceOfOriginVillage: string;
  WorkerPlaceOfOriginDistrict: string;
  WorkerPlaceOfOriginProvince: string;
  WorkerPassportPhoto: string;
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
  AverageWeeklyWage: number;
  WeeklyPaymentRate: number;
  WorkedUnderSubContractor: boolean;
  SubContractorOrganizationName: string;
  SubContractorLocation: string;
  SubContractorNatureOfBusiness: string;
  OrganizationType: string;

  // Insurance Details
  InsuranceProviderIPACode: string;
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
  insuranceProvider?: {
    IPACODE: string;
    InsuranceCompanyOrganizationName: string;
    InsuranceCompanyAddress1: string;
    InsuranceCompanyAddress2: string;
    InsuranceCompanyCity: string;
    InsuranceCompanyProvince: string;
    InsuranceCompanyPOBox: string;
    InsuranceCompanyLandLine: string;
  };
}

// Dependant row shape matching DB field names
interface DependantRow {
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

// Work history row shape matching PHP field names / DB columns
interface WorkHistoryRow {
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

const NewWorkerRegistrationForm: React.FC<NewWorkerRegistrationFormProps> = ({ onClose, editingWorkerID }) => {
  const { profile, group } = useAuth();
  const [currentTab, setCurrentTab] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    // Initialize with default values
    WorkerFirstName: '',
    WorkerLastName: '',
    WorkerAliasName: '',
    WorkerDOB: '',
    WorkerGender: 'M',
    WorkerMarried: '0',
    WorkerHanded: 'Right',
    WorkerPlaceOfOriginVillage: '',
    WorkerPlaceOfOriginDistrict: '',
    WorkerPlaceOfOriginProvince: '',
    WorkerPassportPhoto: '',
    WorkerAddress1: '',
    WorkerAddress2: '',
    WorkerCity: '',
    WorkerProvince: '',
    WorkerPOBox: '',
    WorkerEmail: '',
    WorkerMobile: '',
    WorkerLandline: '',
    SpouseFirstName: '',
    SpouseLastName: '',
    SpouseDOB: '',
    SpousePlaceOfOriginVillage: '',
    SpousePlaceOfOriginDistrict: '',
    SpousePlaceOfOriginProvince: '',
    SpouseAddress1: '',
    SpouseAddress2: '',
    SpouseCity: '',
    SpouseProvince: '',
    SpousePOBox: '',
    SpouseEmail: '',
    SpouseMobile: '',
    SpouseLandline: '',
    WorkerHaveDependants: false,
    WorkerHasHistory: false,
    EmployerCPPSID: '',
    EmploymentID: '',
    Occupation: '',
    PlaceOfEmployment: '',
    NatureOfEmployment: '',
    AverageWeeklyWage: 0,
    WeeklyPaymentRate: 0,
    WorkedUnderSubContractor: false,
    SubContractorOrganizationName: '',
    SubContractorLocation: '',
    SubContractorNatureOfBusiness: '',
    OrganizationType: '',
    InsuranceProviderIPACode: '',
    InsuranceCompanyOrganizationName: '',
    InsuranceCompanyAddress1: '',
    InsuranceCompanyAddress2: '',
    InsuranceCompanyCity: '',
    InsuranceCompanyProvince: '',
    InsuranceCompanyPOBox: '',
    InsuranceCompanyLandLine: ''
  });

  const [loading, setLoading] = useState(false);
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
  const [generatedFileName, setGeneratedFileName] = useState<string>('');
  const [success, setSuccess] = useState<string | null>(null);
  const [dependants, setDependants] = useState<DependantRow[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistoryRow[]>([]);

  useEffect(() => {
    const initializeForm = async () => {
      try {
        setLoading(true);
        
        // Check user group
        if (group) {
          const groupId = group.id;
          setIsEmployer(groupId === 15);
          setIsDataEntry(groupId === 18);
        }

        // Fetch provinces
        const { data: provinceData, error: provinceError } = await supabase
          .from('dictionary')
          .select('DKey, DValue')
          .eq('DType', 'Province');
        if (provinceError) throw provinceError;
        setProvinces(provinceData || []);

        // Fetch insurance providers
        const { data: insuranceData, error: insuranceError } = await supabase
          .from('insurancecompanymaster')
          .select('*');
        if (insuranceError) throw insuranceError;
        setInsuranceProviders(insuranceData || []);

        // If user is an employer (group 15), auto-fill employer details
        if (group?.id === 15 && profile?.organization_id) {
          await fetchEmployerDetails(profile.organization_id);
        }

        // If editing, pre-load work history
        if (editingWorkerID) {
          await loadWorkHistoryForEdit(editingWorkerID);
        }
      } catch (err: any) {
        console.error('Error initializing form:', err);
        setError(err.message || 'Failed to initialize form');
      } finally {
        setLoading(false);
      }
    };

    initializeForm();
  }, [group, profile, editingWorkerID]);

  const fetchEmployerDetails = async (organizationId: string) => {
    try {
      const { data: employerData, error: employerError } = await supabase
        .from('employermaster')
        .select('*')
        .or(`EMID.eq.${organizationId},CPPSID.eq.${organizationId}`)
        .single();

      if (employerError) {
        console.error('Error fetching employer details:', employerError);
        return;
      }

      if (employerData) {
        await populateEmployerData(employerData);
      }
    } catch (err) {
      console.error('Error fetching employer details:', err);
    }
  };

  const populateEmployerData = async (employer: EmployerData) => {
    try {
      setEmployerData(employer);
      setFormData(prev => ({
        ...prev,
        EmployerCPPSID: employer.CPPSID || '',
        PlaceOfEmployment: employer.OrganizationName || '',
        OrganizationType: employer.OrganizationType || '',
        InsuranceProviderIPACode: employer.InsuranceProviderIPACode || ''
      }));

      if (employer.InsuranceProviderIPACode) {
        const { data: insuranceData, error: insuranceError } = await supabase
          .from('insurancecompanymaster')
          .select('*')
          .eq('IPACODE', employer.InsuranceProviderIPACode)
					.limit(1)
          .single();

        if (!insuranceError && insuranceData) {
          setFormData(prev => ({
            ...prev,
            InsuranceCompanyOrganizationName: insuranceData.InsuranceCompanyOrganizationName || '',
            InsuranceCompanyAddress1: insuranceData.InsuranceCompanyAddress1 || '',
            InsuranceCompanyAddress2: insuranceData.InsuranceCompanyAddress2 || '',
            InsuranceCompanyCity: insuranceData.InsuranceCompanyCity || '',
            InsuranceCompanyProvince: insuranceData.InsuranceCompanyProvince || '',
            InsuranceCompanyPOBox: insuranceData.InsuranceCompanyPOBox || '',
            InsuranceCompanyLandLine: insuranceData.InsuranceCompanyLandLine || ''
          }));
        }
      }
    } catch (err) {
      console.error('Error populating employer data:', err);
    }
  };

  const handleEmployerSelect = (employer: EmployerData) => {
    populateEmployerData(employer);
    setShowEmployerList(false);
  };

  const handleInsuranceProviderSelect = (provider: any) => {
    setFormData(prev => ({
      ...prev,
      InsuranceProviderIPACode: provider.IPACODE || '',
      InsuranceCompanyOrganizationName: provider.InsuranceCompanyOrganizationName || '',
      InsuranceCompanyAddress1: provider.InsuranceCompanyAddress1 || '',
      InsuranceCompanyAddress2: provider.InsuranceCompanyAddress2 || '',
      InsuranceCompanyCity: provider.InsuranceCompanyCity || '',
      InsuranceCompanyProvince: provider.InsuranceCompanyProvince || '',
      InsuranceCompanyPOBox: provider.InsuranceCompanyPOBox || '',
      InsuranceCompanyLandLine: provider.InsuranceCompanyLandLine || ''
    }));
    setInsuranceOverridden(true);
    setShowInsuranceList(false);
  };

  const loadWorkHistoryForEdit = async (workerId: string | number) => {
    try {
      const { data, error } = await supabase
        .from('workhistory')
        .select('*')
        .eq('WorkerID', workerId);
      if (error) throw error;

      const rows: WorkHistoryRow[] = (data || []).map((r: any) => ({
        _id: `${r.id || r.WorkHistoryID || Math.random()}`,
        OrganizationName: r.OrganizationName || '',
        OrganizationAddress1: r.OrganizationAddress1 || '',
        OrganizationAddress2: r.OrganizationAddress2 || '',
        OrganizationCity: r.OrganizationCity || '',
        OrganizationProvince: r.OrganizationProvince || '',
        OrganizationPOBox: r.OrganizationPOBox || '',
        OrganizationLandline: r.OrganizationLandline || '',
        OrganizationCPPSID: r.OrganizationCPPSID || '',
        WorkerJoiningDate: r.WorkerJoiningDate || '',
        WorkerLeavingDate: r.WorkerLeavingDate || '',
      }));

      setWorkHistory(rows);
      setFormData(prev => ({ ...prev, WorkerHasHistory: rows.length > 0 }));
    } catch (err) {
      console.error('Failed to load work history:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Validate required fields first
      const requiredFields = [
        'WorkerFirstName', 'WorkerLastName', 'WorkerDOB', 'WorkerGender',
        'EmployerCPPSID', 'Occupation', 'PlaceOfEmployment'
      ];

      const missingFields = requiredFields.filter(field => !(formData as any)[field]);
      if (missingFields.length > 0) {
        setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
        return;
      }

      let finalFormData = { ...formData };

      // Upload file first if one is selected
      if (selectedFile && generatedFileName) {
        const filePath = `attachments/workerpassportphotos/${generatedFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('cpps')
          .upload(filePath, selectedFile);
        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }
        finalFormData.WorkerPassportPhoto = `cpps/${filePath}`;
      }

      // Helper function to convert empty strings to null for date fields
      const formatDateForDB = (dateString: string) => {
        return dateString && dateString.trim() !== '' ? dateString : null;
      };

      // Save worker personal details
      const { data: workerData, error: workerError } = await supabase
        .from('workerpersonaldetails')
        .insert([{
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
          SpouseLandline: finalFormData.SpouseLandline
        }])
        .select()
        .single();

      if (workerError) throw workerError;

      // Save current employment details
      const { error: employmentError } = await supabase
        .from('currentemploymentdetails')
        .insert([{
          WorkerID: workerData.WorkerID,
          EmploymentID: finalFormData.EmploymentID,
          Occupation: finalFormData.Occupation,
          PlaceOfEmployment: finalFormData.PlaceOfEmployment,
          NatureOfEmployment: finalFormData.NatureOfEmployment,
          AverageWeeklyWage: finalFormData.AverageWeeklyWage,
          WeeklyPaymentRate: finalFormData.WeeklyPaymentRate,
          WorkedUnderSubContractor: finalFormData.WorkedUnderSubContractor ? 'Yes' : 'No',
          SubContractorOrganizationName: finalFormData.SubContractorOrganizationName,
          SubContractorLocation: finalFormData.SubContractorLocation,
          SubContractorNatureOfBusiness: finalFormData.SubContractorNatureOfBusiness,
          EmployerCPPSID: finalFormData.EmployerCPPSID,
          OrganizationType: finalFormData.OrganizationType
        }]);
      if (employmentError) throw employmentError;

      // Save dependants if any
      if (finalFormData.WorkerHaveDependants && dependants.length > 0) {
        const dependantInserts = dependants.map((dep) => ({
          WorkerID: workerData.WorkerID,
          DependantFirstName: dep.DependantFirstName,
          DependantLastName: dep.DependantLastName,
          DependantDOB: formatDateForDB(dep.DependantDOB),
          DependantGender: dep.DependantGender,
          DependantType: dep.DependantType,
          DependantAddress1: dep.DependantAddress1,
          DependantAddress2: dep.DependantAddress2,
          DependantCity: dep.DependantCity,
          DependantProvince: dep.DependantProvince,
          DependantPOBox: dep.DependantPOBox,
          DependantEmail: dep.DependantEmail,
          DependantMobile: dep.DependantMobile,
          DependantLandline: dep.DependantLandline,
          DependanceDegree: dep.DependanceDegree === '' ? null : Number(dep.DependanceDegree),
        }));
        const { error: depErr } = await supabase
          .from('workerdependantdetails')
          .insert(dependantInserts);
        if (depErr) throw depErr;
      }

      // Save work history if any
      if (finalFormData.WorkerHasHistory && workHistory.length > 0) {
        const whInserts = workHistory.map((w) => ({
          WorkerID: workerData.WorkerID,
          OrganizationName: w.OrganizationName,
          OrganizationAddress1: w.OrganizationAddress1,
          OrganizationAddress2: w.OrganizationAddress2,
          OrganizationCity: w.OrganizationCity,
          OrganizationProvince: w.OrganizationProvince,
          OrganizationPOBox: w.OrganizationPOBox,
          OrganizationLandline: w.OrganizationLandline,
          OrganizationCPPSID: w.OrganizationCPPSID,
          WorkerJoiningDate: formatDateForDB(w.WorkerJoiningDate),
          WorkerLeavingDate: formatDateForDB(w.WorkerLeavingDate),
        }));
        const { error: whErr } = await supabase
          .from('workhistory')
          .insert(whInserts);
        if (whErr) throw whErr;
      }
      
      // Show success message
      setSuccess(`Worker ${finalFormData.WorkerFirstName} ${finalFormData.WorkerLastName} has been registered successfully!`);
      
      // Close after short delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error saving worker:', err);
      setError(err.message || 'Failed to save worker. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // ------- Dependants helpers -------
  const addDependant = () => {
    const newDependant: DependantRow = {
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      DependantFirstName: '',
      DependantLastName: '',
      DependantDOB: '',
      DependantGender: 'M',
      DependantType: 'Child',
      DependantAddress1: '',
      DependantAddress2: '',
      DependantCity: '',
      DependantProvince: provinces[0]?.DValue || '',
      DependantPOBox: '',
      DependantEmail: '',
      DependantMobile: '',
      DependantLandline: '',
      DependanceDegree: '',
      SameAsWorker: false,
    };
    setDependants(prev => [...prev, newDependant]);
  };

  const removeDependant = (idx: number) => {
    setDependants(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDependantField = (idx: number, field: keyof DependantRow, value: any) => {
    setDependants(prev => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };

  const toggleSameAsWorker = (idx: number, checked: boolean) => {
    setDependants(prev => prev.map((d, i) => {
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
        DependantAddress1: '',
        DependantAddress2: '',
        DependantCity: '',
        DependantProvince: provinces[0]?.DValue || '',
        DependantPOBox: '',
      };
    }));
  };

  const degreeError = (val: string | number) => {
    const str = String(val ?? '').trim();
    if (str === '') return undefined;
    const n = Number(str);
    if (Number.isNaN(n)) return 'Enter a valid number';
    if (n < 0 || n > 100) return 'Value must be between 0 and 100';
    return undefined;
  };

  // ------- Work History helpers -------
  const addWorkHistory = () => {
    const row: WorkHistoryRow = {
      _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      OrganizationName: '',
      OrganizationAddress1: '',
      OrganizationAddress2: '',
      OrganizationCity: '',
      OrganizationProvince: provinces[0]?.DValue || '',
      OrganizationPOBox: '',
      OrganizationLandline: '',
      OrganizationCPPSID: '',
      WorkerJoiningDate: '',
      WorkerLeavingDate: '',
    };
    setWorkHistory(prev => [...prev, row]);
  };

  const removeWorkHistory = (idx: number) => {
    setWorkHistory(prev => prev.filter((_, i) => i !== idx));
  };

  const updateWorkHistoryField = (idx: number, field: keyof WorkHistoryRow, value: any) => {
    setWorkHistory(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  // ------- File change handler -------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setGeneratedFileName('');
      setFormData(prev => ({ ...prev, [fieldName]: '' }));
      return;
    }

    try {
      const currentDate = new Date();
      const day = String(currentDate.getDate()).padStart(2, '0');
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();
      const datePrefix = `${day}${month}${year}`;
      const hh = String(currentDate.getHours()).padStart(2, '0');
      const min = String(currentDate.getMinutes()).padStart(2, '0');
      const ss = String(currentDate.getSeconds()).padStart(2, '0');
      const timestamp = `${hh}${min}${ss}`;
      const fileExt = file.name.split('.').pop();
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      const newFileName = `${datePrefix}_${timestamp}_${originalName}.${fileExt}`;
      setSelectedFile(file);
      setGeneratedFileName(newFileName);
      setFormData(prev => ({ ...prev, [fieldName]: newFileName }));
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to process file. Please try again.');
    }
  };

  // ------- Render Sections -------
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
            {provinces.map(province => (
              <option key={province.DValue} value={province.DValue}>
                {province.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Passport Photo</label>
          <input
            type="file"
            name="WorkerPassportPhoto"
            onChange={(e) => handleFileChange(e as any, 'WorkerPassportPhoto')}
            className="input"
            accept=".png,.jpg,.jpeg"
          />
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
          <input
            type="text"
            name="WorkerCity"
            value={formData.WorkerCity}
            onChange={handleInputChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <select
            name="WorkerProvince"
            value={formData.WorkerProvince}
            onChange={handleInputChange}
            className="input"
          >
            <option value="">Select Province</option>
            {provinces.map(province => (
              <option key={province.DValue} value={province.DValue}>
                {province.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input
            type="text"
            name="WorkerPOBox"
            value={formData.WorkerPOBox}
            onChange={handleInputChange}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="WorkerEmail"
            value={formData.WorkerEmail}
            onChange={handleInputChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input
            type="tel"
            name="WorkerMobile"
            value={formData.WorkerMobile}
            onChange={handleInputChange}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input
            type="tel"
            name="WorkerLandline"
            value={formData.WorkerLandline}
            onChange={handleInputChange}
            className="input"
          />
        </div>
      </div>
    </div>
  );

  const renderSpouseDetails = () => (
    <div className="space-y-4">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {formData.WorkerMarried === '1' 
            ? 'Please fill in spouse details below:' 
            : 'Spouse details are disabled because worker is not married.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            name="SpouseFirstName"
            value={formData.SpouseFirstName}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            name="SpouseLastName"
            value={formData.SpouseLastName}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
          <input
            type="date"
            name="SpouseDOB"
            value={formData.SpouseDOB}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Village</label>
          <input
            type="text"
            name="SpousePlaceOfOriginVillage"
            value={formData.SpousePlaceOfOriginVillage}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text_sm font-medium text-gray-700">Place of Origin District</label>
          <input
            type="text"
            name="SpousePlaceOfOriginDistrict"
            value={formData.SpousePlaceOfOriginDistrict}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Origin Province</label>
          <select
            name="SpousePlaceOfOriginProvince"
            value={formData.SpousePlaceOfOriginProvince}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          >
            <option value="">Select Province</option>
            {provinces.map(province => (
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
          <textarea
            name="SpouseAddress1"
            value={formData.SpouseAddress1}
            onChange={handleInputChange}
            className="input"
            rows={3}
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea
            name="SpouseAddress2"
            value={formData.SpouseAddress2}
            onChange={handleInputChange}
            className="input"
            rows={3}
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input
            type="text"
            name="SpouseCity"
            value={formData.SpouseCity}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <select
            name="SpouseProvince"
            value={formData.SpouseProvince}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          >
            <option value="">Select Province</option>
            {provinces.map(province => (
              <option key={province.DValue} value={province.DValue}>
                {province.DValue}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input
            type="text"
            name="SpousePOBox"
            value={formData.SpousePOBox}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="SpouseEmail"
            value={formData.SpouseEmail}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input
            type="tel"
            name="SpouseMobile"
            value={formData.SpouseMobile}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Landline</label>
          <input
            type="tel"
            name="SpouseLandline"
            value={formData.SpouseLandline}
            onChange={handleInputChange}
            className="input"
            disabled={formData.WorkerMarried !== '1'}
          />
        </div>
      </div>
    </div>
  );

  const renderDependentDetails = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="WorkerHaveDependants"
          checked={formData.WorkerHaveDependants}
          onChange={handleInputChange}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label className="text-sm text-gray-900">Worker has dependants</label>
      </div>

      {formData.WorkerHaveDependants && (
        <>
          <div className="flex items-center justify_between">
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
                      <button type="button" className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600" onClick={() => removeDependant(idx)}>Delete</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">First Name</label>
                        <input className="input" value={d.DependantFirstName} onChange={(e) => updateDependantField(idx, 'DependantFirstName', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Last Name</label>
                        <input className="input" value={d.DependantLastName} onChange={(e) => updateDependantField(idx, 'DependantLastName', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Date of Birth</label>
                        <input type="date" className="input" value={d.DependantDOB} onChange={(e) => updateDependantField(idx, 'DependantDOB', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Dependant Type</label>
                        <select className="input" value={d.DependantType} onChange={(e) => updateDependantField(idx, 'DependantType', e.target.value)}>
                          <option value="Child">Child</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Parent">Parent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Dependant Gender</label>
                        <select className="input" value={d.DependantGender} onChange={(e) => updateDependantField(idx, 'DependantGender', e.target.value)}>
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
                        <input className="input" value={d.DependantAddress1} onChange={(e) => updateDependantField(idx, 'DependantAddress1', e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Address 2</label>
                        <input className="input" value={d.DependantAddress2} onChange={(e) => updateDependantField(idx, 'DependantAddress2', e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">City</label>
                        <input className="input" value={d.DependantCity} onChange={(e) => updateDependantField(idx, 'DependantCity', e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Province</label>
                        <select className="input" value={d.DependantProvince} onChange={(e) => updateDependantField(idx, 'DependantProvince', e.target.value)} disabled={!!d.SameAsWorker}>
                          {provinces.map((p) => (
                            <option key={p.DValue} value={p.DValue}>{p.DValue}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">P.O. Box</label>
                        <input className="input" value={d.DependantPOBox} onChange={(e) => updateDependantField(idx, 'DependantPOBox', e.target.value)} readOnly={!!d.SameAsWorker} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Email</label>
                        <input type="email" className="input" value={d.DependantEmail} onChange={(e) => updateDependantField(idx, 'DependantEmail', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Mobile</label>
                        <input className="input" value={d.DependantMobile} onChange={(e) => updateDependantField(idx, 'DependantMobile', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Landline</label>
                        <input className="input" value={d.DependantLandline} onChange={(e) => updateDependantField(idx, 'DependantLandline', e.target.value)} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium">Degree of Dependance (0–100)</label>
                        <input className={`input ${err ? 'border-red-500' : ''}`} value={String(d.DependanceDegree ?? '')} onChange={(e) => updateDependantField(idx, 'DependanceDegree', e.target.value)} />
                        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
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
      {/* Group-based employer selection */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Employer Information</h4>
        {isEmployer && (
          <p className="text-sm text-green-600 mb-2">
            ✓ Employer details auto-filled based on your organization
          </p>
        )}
        {isDataEntry && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowEmployerList(true)}
              className="btn btn-primary text-sm"
            >
              Select Employer
            </button>
            {formData.EmployerCPPSID && (
              <span className="text-sm text-green-600">
                ✓ Employer selected: {formData.PlaceOfEmployment}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Employer CPPSID *</label>
          <input
            type="text"
            name="EmployerCPPSID"
            value={formData.EmployerCPPSID}
            onChange={handleInputChange}
            className="input"
            required
            readOnly={isEmployer}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Employment ID</label>
          <input
            type="text"
            name="EmploymentID"
            value={formData.EmploymentID}
            onChange={handleInputChange}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Occupation *</label>
          <input
            type="text"
            name="Occupation"
            value={formData.Occupation}
            onChange={handleInputChange}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Place of Employment *</label>
          <input
            type="text"
            name="PlaceOfEmployment"
            value={formData.PlaceOfEmployment}
            onChange={handleInputChange}
            className="input"
            required
            readOnly={isEmployer || (isDataEntry && formData.EmployerCPPSID)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nature of Employment</label>
        <input
          type="text"
          name="NatureOfEmployment"
          value={formData.NatureOfEmployment}
          onChange={handleInputChange}
          className="input"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Average Weekly Wage</label>
          <input
            type="number"
            name="AverageWeeklyWage"
            value={formData.AverageWeeklyWage}
            onChange={handleInputChange}
            className="input"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Weekly Payment Rate</label>
          <input
            type="number"
            name="WeeklyPaymentRate"
            value={formData.WeeklyPaymentRate}
            onChange={handleInputChange}
            className="input"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            name="WorkedUnderSubContractor"
            checked={formData.WorkedUnderSubContractor}
            onChange={handleInputChange}
            className="h-4 w-4 text-primary border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900">
            Worked Under Sub-Contractor
          </label>
        </div>

        {formData.WorkedUnderSubContractor && (
          <div className="space-y-4 pl-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Organization Name</label>
              <input
                type="text"
                name="SubContractorOrganizationName"
                value={formData.SubContractorOrganizationName}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-Contractor Location</label>
              <input
                type="text"
                name="SubContractorLocation"
                value={formData.SubContractorLocation}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nature of Business</label>
              <input
                type="text"
                name="SubContractorNatureOfBusiness"
                value={formData.SubContractorNatureOfBusiness}
                onChange={handleInputChange}
                className="input"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderWorkHistory = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="WorkerHasHistory"
          checked={formData.WorkerHasHistory}
          onChange={handleInputChange}
          className="h-4 w-4 rounded border-gray-300"
        />
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
                    <button
                      type="button"
                      className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
                      onClick={() => removeWorkHistory(idx)}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">Organization Name</label>
                      <input className="input" value={w.OrganizationName} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationName', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Landline</label>
                      <input className="input" value={w.OrganizationLandline} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationLandline', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Address 1</label>
                      <input className="input" value={w.OrganizationAddress1} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationAddress1', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Address 2</label>
                      <input className="input" value={w.OrganizationAddress2} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationAddress2', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">City</label>
                      <input className="input" value={w.OrganizationCity} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationCity', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Province</label>
                      <select className="input" value={w.OrganizationProvince} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationProvince', e.target.value)}>
                        {provinces.map((p) => (
                          <option key={p.DValue} value={p.DValue}>{p.DValue}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">P.O. Box</label>
                      <input className="input" value={w.OrganizationPOBox} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationPOBox', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">CPPSID</label>
                      <input className="input" value={w.OrganizationCPPSID} onChange={(e) => updateWorkHistoryField(idx, 'OrganizationCPPSID', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Joining Date</label>
                      <input type="date" className="input" value={w.WorkerJoiningDate} onChange={(e) => updateWorkHistoryField(idx, 'WorkerJoiningDate', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Leaving Date</label>
                      <input type="date" className="input" value={w.WorkerLeavingDate} onChange={(e) => updateWorkHistoryField(idx, 'WorkerLeavingDate', e.target.value)} />
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
          <p className="text-sm text-green-600">
            ✓ Insurance details auto-filled based on employer's insurance provider
          </p>
        )}
        {insuranceOverridden && (
          <p className="text-sm text-blue-600">
            ✓ Insurance provider manually selected and overridden
          </p>
        )}
        <div className="flex items-center space-x-2 mt-2">
          <button
            type="button"
            onClick={() => setShowInsuranceList(true)}
            className="btn btn-secondary text-sm"
          >
            Change Insurance Provider
          </button>
          {formData.InsuranceProviderIPACode && (
            <span className="text-sm text-green-600">
              ✓ Selected: {formData.InsuranceCompanyOrganizationName}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Insurance Provider</label>
        <select
          name="InsuranceProviderIPACode"
          value={formData.InsuranceProviderIPACode}
          onChange={handleInputChange}
          className="input"
          disabled
        >
          <option value="">Select Insurance Provider</option>
          {insuranceProviders.map(provider => (
            <option key={provider.IPACODE} value={provider.IPACODE}>
              {provider.InsuranceCompanyOrganizationName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Company Name</label>
        <input
          type="text"
          name="InsuranceCompanyOrganizationName"
          value={formData.InsuranceCompanyOrganizationName}
          onChange={handleInputChange}
          className="input"
          readOnly
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
          <textarea
            name="InsuranceCompanyAddress1"
            value={formData.InsuranceCompanyAddress1}
            onChange={handleInputChange}
            className="input"
            rows={3}
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
          <textarea
            name="InsuranceCompanyAddress2"
            value={formData.InsuranceCompanyAddress2}
            onChange={handleInputChange}
            className="input"
            rows={3}
            readOnly
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input
            type="text"
            name="InsuranceCompanyCity"
            value={formData.InsuranceCompanyCity}
            onChange={handleInputChange}
            className="input"
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Province</label>
          <input
            type="text"
            name="InsuranceCompanyProvince"
            value={formData.InsuranceCompanyProvince}
            onChange={handleInputChange}
            className="input"
            readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">P.O. Box</label>
          <input
            type="text"
            name="InsuranceCompanyPOBox"
            value={formData.InsuranceCompanyPOBox}
            onChange={handleInputChange}
            className="input"
            readOnly
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Landline</label>
        <input
          type="text"
          name="InsuranceCompanyLandLine"
          value={formData.InsuranceCompanyLandLine}
          onChange={handleInputChange}
          className="input"
          readOnly
        />
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
    'Worker Personal Details',
    'Spouse Details',
    'Dependent Details',
    'Other Employment Details',
    'Work History',
    'Insurance Details'
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Worker Registration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

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
          {(isEmployer || isDataEntry) && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md">
              <p className="text-sm">
                {isEmployer && 'You are logged in as an Employer. Employer and insurance details will be auto-filled.'}
                {isDataEntry && 'You are logged in as Data Entry. Please select an employer to auto-fill details.'}
              </p>
            </div>
          )}

          <div className="flex space-x-2 overflow-x-auto pb-4 mb-6">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setCurrentTab(index + 1)}
                className={`px-4 py-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${currentTab === index + 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {renderTabContent()}
            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Register Worker'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Employer List Modal for Data Entry users */}
      {showEmployerList && isDataEntry && (
        <EmployerListModal onClose={() => setShowEmployerList(false)} onSelectEmployer={handleEmployerSelect} />
      )}

      {/* Insurance Provider List Modal */}
      {showInsuranceList && (
        <InsuranceProviderListModal onClose={() => setShowInsuranceList(false)} onSelectProvider={handleInsuranceProviderSelect} />
      )}
    </div>
  );
};

export default NewWorkerRegistrationForm;
