import React, { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import NewEmployerRegistrationForm from './NewEmployerRegistrationForm';
import ViewEmployerRegistrationForm from './ViewEmployerRegistrationForm';
import EditEmployerRegistrationForm from './EditEmployerRegistrationForm';

interface EmployerSearchModalProps {
  onClose: () => void;
  formType: 'new' | 'edit' | 'view';
}

interface SearchResult {
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
  actionType: 'View' | 'Edit' | 'Proceed';
  actionColor: string;
}

interface InsuranceProvider {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
}

interface EmployerFormData {
  OrganizationType: string;
  OrganizationName: string;
  ValidationCode: string;
  InsuranceProviderIPACode: string;
  IsLevyPaid: boolean;
  LevyReferenceNumber: string;
}

const EmployerSearchModal: React.FC<EmployerSearchModalProps> = ({ 
  onClose, 
  formType 
}) => {
  const [organizationName, setOrganizationName] = useState('');
  const [cppsId, setCppsId] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showNotFound, setShowNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewEmployerForm, setShowNewEmployerForm] = useState(false);
  const [showViewEmployerForm, setShowViewEmployerForm] = useState(false);
  const [showEditEmployerForm, setShowEditEmployerForm] = useState(false);
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ✅ Option A: parent-owned providers
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);

  // Load providers once (parent owns data)
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setProvidersLoading(true);
        setProvidersError(null);

        // Pick your actual table name; this tries a few common ones.
        const tableCandidates = [
          'insurancecompanymaster',
          'insuranceproviders',
          'insuranceprovider',
        ];

        let loaded: InsuranceProvider[] = [];
        for (const tbl of tableCandidates) {
          const { data, error } = await supabase
            .from(tbl)
            .select('IPACODE, InsuranceCompanyOrganizationName')
            .order('InsuranceCompanyOrganizationName', { ascending: true });

          if (!error && Array.isArray(data)) {
            loaded = data as InsuranceProvider[];
            break;
          }
        }

        setInsuranceProviders(Array.isArray(loaded) ? loaded : []);
      } catch (e: any) {
        console.error(e);
        setProvidersError(e?.message ?? 'Failed to load insurance providers');
        setInsuranceProviders([]); // always pass an array
      } finally {
        setProvidersLoading(false);
      }
    };

    loadProviders();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowNotFound(false);
    setSearchResults([]);
    setCurrentPage(1);

    if (!organizationName && !cppsId) {
      setError('Please enter an organization name or CPPS ID to search');
      return;
    }

    try {
      setLoading(true);

      let query = supabase.from('employermaster').select('*');

      if (organizationName && cppsId) {
        query = query.ilike('OrganizationName', `%${organizationName}%`).eq('CPPSID', cppsId);
      } else if (organizationName) {
        query = query.ilike('OrganizationName', `%${organizationName}%`);
      } else if (cppsId) {
        query = query.eq('CPPSID', cppsId);
      }

      const { data: employerData, error: employerError } = await query;
      if (employerError) throw employerError;

      if (employerData && employerData.length > 0) {
        const results = employerData.map((employer: any) => {
          let actionType: 'View' | 'Edit' | 'Proceed';
          let actionColor: string;

          if (formType === 'new') {
            actionType = 'View';
            actionColor = 'text-red-800';
          } else if (formType === 'edit') {
            actionType = 'Edit';
            actionColor = 'text-blue-600';
          } else {
            actionType = 'View';
            actionColor = 'text-red-800';
          }

          return {
            EMID: employer.EMID,
            CPPSID: employer.CPPSID || 'N/A',
            OrganizationName: employer.OrganizationName || 'N/A',
            Address1: employer.Address1 || 'N/A',
            Address2: employer.Address2 || 'N/A',
            City: employer.City || 'N/A',
            Province: employer.Province || 'N/A',
            POBox: employer.POBox || 'N/A',
            MobilePhone: employer.MobilePhone || 'N/A',
            LandLine: employer.LandLine || 'N/A',
            OrganizationType: employer.OrganizationType || 'N/A',
            InsuranceProviderIPACode: employer.InsuranceProviderIPACode || 'N/A',
            actionType,
            actionColor,
          } as SearchResult;
        });

        setSearchResults(results);
      } else {
        setShowNotFound(true);
      }
    } catch (err) {
      console.error('Error searching for employers:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setOrganizationName('');
    setCppsId('');
    setSearchResults([]);
    setShowNotFound(false);
    setError(null);
    setCurrentPage(1);
  };

  const handleAction = (result: SearchResult) => {
    setSelectedEmployerId(result.EMID);
    if (result.actionType === 'View') setShowViewEmployerForm(true);
    else if (result.actionType === 'Edit') setShowEditEmployerForm(true);
    else if (result.actionType === 'Proceed') setShowNewEmployerForm(true);
  };

  const handleRegisterNewEmployer = () => {
    setShowNewEmployerForm(true);
  };

  // ✅ Called by NewEmployerRegistrationForm (adapt to your schema)
  const handleEmployerSubmit = async (formData: EmployerFormData) => {
    try {
      // Map fields as needed for your DB schema
      const payload = {
        OrganizationType: formData.OrganizationType,
        OrganizationName: formData.OrganizationName,
        ValidationCode: formData.ValidationCode,
        InsuranceProviderIPACode: formData.InsuranceProviderIPACode,
        IsLevyPaid: formData.IsLevyPaid,
        LevyReferenceNumber: formData.LevyReferenceNumber,
      };

      const { error: insertError } = await supabase
        .from('employermaster')
        .insert([payload]);

      if (insertError) throw insertError;

      // After successful insert, close the form and parent modal
      setShowNewEmployerForm(false);
      onClose();
    } catch (e) {
      console.error('Failed to register employer', e);
      // You can surface a toast/snackbar here
      alert('Failed to register employer.');
    }
  };

  // Pagination
  const totalPages = Math.ceil(searchResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = searchResults.slice(startIndex, endIndex);

  // ✅ When user chooses to register new, render the form with providers passed (Option A)
  if (showNewEmployerForm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
					<div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
            <h2 className="text-lg font-semibold">Registerx New Employer</h2>
            <button onClick={() => setShowNewEmployerForm(false)} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div> 

          <div className="p-6">
            {/* You can show a subtle note if providers are still loading; the form safely handles [] */}
	  {providersError && (
              <div className="mb-3 text-sm text-red-600">
                Failed to load insurance providers. You can still proceed and select later.
              </div>
            )}
            {providersLoading && (
              <div className="mb-3 text-sm text-gray-600">Loading insurance providers…</div>
            )}   

            <NewEmployerRegistrationForm
              insuranceProviders={insuranceProviders}  
              onSubmit={handleEmployerSubmit}
							          onClose={() => {
          setShowNewEmployerForm(false);
         // setSelectedEmployerId(null);
          onClose();
        }} 
            />
          </div>
        </div>
      </div>
    );
  }




	
  if (showViewEmployerForm && selectedEmployerId) {
    return (
      <ViewEmployerRegistrationForm 
        employerId={selectedEmployerId} 
        onClose={() => {
          setShowViewEmployerForm(false);
          setSelectedEmployerId(null);
          onClose();
        }} 
      />
    );
  }

  if (showEditEmployerForm && selectedEmployerId) {
    return (
      <EditEmployerRegistrationForm 
        employerId={selectedEmployerId} 
        onClose={() => {
          setShowEditEmployerForm(false);
          setSelectedEmployerId(null);
          onClose();
        }} 
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Search Employers - {formType === 'new' ? 'Register New' : formType === 'view' ? 'View' : 'Edit'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  id="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="input"
                  placeholder="Enter organization name"
                />
              </div>

              <div>
                <label htmlFor="cppsId" className="block text-sm font-medium text-gray-700 mb-1">
                  CPPS ID
                </label>
                <input
                  type="text"
                  id="cppsId"
                  value={cppsId}
                  onChange={(e) => setCppsId(e.target.value)}
                  className="input"
                  placeholder="Enter CPPS ID"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={clearSearch}
                className="btn btn-secondary"
              >
                Clear
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Search Results */}
          <div className="mt-6">
            {searchResults.length > 0 && (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#8B2500]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            CPPS ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Organization Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            City
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Province
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Organization Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentResults.map((result, index) => (
                          <tr key={`${result.EMID}-${index}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result.CPPSID}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result.OrganizationName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result.City}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result.Province}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result.OrganizationType}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result.MobilePhone || result.LandLine || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleAction(result)}
                                className={`font-medium text-sm ${result.actionColor} hover:opacity-80`}
                              >
                                {result.actionType}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {startIndex + 1} to {Math.min(endIndex, searchResults.length)} of {searchResults.length} results
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {showNotFound && (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  {formType === 'new' 
                    ? 'No existing employers found. You can register a new employer.'
                    : 'No employers found matching your search criteria.'
                  }
                </p>
                <button
                  onClick={handleRegisterNewEmployer}
                  className="btn btn-primary"
                  disabled={providersLoading}  // optional: avoid opening while providers are loading
                >
                  Register New Employer
                </button>
              </div>
            )}
          </div>

          {/* Form Type Information */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Search Mode: {formType.charAt(0).toUpperCase() + formType.slice(1)}</h4>
            <p className="text-sm text-gray-600">
              {formType === 'new' && 'Search for employers to check if they are already registered or register a new one.'}
              {formType === 'edit' && 'Search for existing employers to edit their information.'}
              {formType === 'view' && 'Search for existing employers to view their information.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployerSearchModal;
