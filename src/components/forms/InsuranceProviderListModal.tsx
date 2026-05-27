import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface InsuranceProviderListModalProps {
  onClose: () => void;
  onSelectProvider: (provider: InsuranceProviderData) => void;
}

interface InsuranceProviderData {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
  InsuranceCompanyAddress1: string;
  InsuranceCompanyAddress2: string;
  InsuranceCompanyCity: string;
  InsuranceCompanyProvince: string;
  InsuranceCompanyPOBox: string;
  InsuranceCompanyLandLine: string;
  InsuranceCompanyEmailID: string;
  Website: string;
  MobilePhone: string;
  Fax: string;
}

const InsuranceProviderListModal: React.FC<InsuranceProviderListModalProps> = ({ onClose, onSelectProvider }) => {
  const [providers, setProviders] = useState<InsuranceProviderData[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<InsuranceProviderData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [searchTerm, providers]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      
      const { data: providerData, error: providerError } = await supabase
        .from('insurancecompanymaster')
        .select('*')
        .order('InsuranceCompanyOrganizationName');

      if (providerError) throw providerError;

      setProviders(providerData || []);
    } catch (err: any) {
      console.error('Error fetching insurance providers:', err);
      setError(err.message || 'Failed to load insurance providers');
    } finally {
      setLoading(false);
    }
  };

  const filterProviders = () => {
    if (!searchTerm) {
      setFilteredProviders(providers);
      return;
    }

    const filtered = providers.filter(provider =>
      provider.InsuranceCompanyOrganizationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.IPACODE?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredProviders(filtered);
  };

  const handleSelectProvider = (provider: InsuranceProviderData) => {
    onSelectProvider(provider);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Select Insurance Provider</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by company name or IPA code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto border rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IPA Code
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      City
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Province
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProviders.length > 0 ? (
                    filteredProviders.map((provider) => (
                      <tr key={provider.IPACODE} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {provider.IPACODE || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {provider.InsuranceCompanyOrganizationName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {provider.InsuranceCompanyCity || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {provider.InsuranceCompanyProvince || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {provider.InsuranceCompanyLandLine || provider.MobilePhone || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleSelectProvider(provider)}
                            className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? 'No insurance providers found matching your search.' : 'No insurance providers available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsuranceProviderListModal;
