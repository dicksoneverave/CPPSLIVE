import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form133CPOForm18InjuryEmployerResponseReview from './133CPOForm18InjuryEmployerResponseReview';
import Form213CPOForm18DeathEmployerResponseReview from './213CPOForm18DeathEmployerResponseReview';
import Logo from '../common/Logo';

interface ListForm18EmployerAcceptedProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: string) => void;
  region?: string;
  isRegionalized?: boolean;
  onlyTribunal?: boolean;
}

interface Form18Data {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  EmployerAcceptedDate: string;
  IncidentType: string;
  F18MID: string;
  Status: string;
}

const ListForm18EmployerAccepted: React.FC<ListForm18EmployerAcceptedProps> = ({
  onClose,
  onSelectIRN,
  region,
  isRegionalized = true,
  onlyTribunal = false
}) => {
  const { profile, group } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form18List, setForm18List] = useState<Form18Data[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsPerPage] = useState(10);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [groupID, setGroupID] = useState<number | null>(null);
  const [selectedIRN, setSelectedIRN] = useState('');
  const [selectedIncidentType, setSelectedIncidentType] = useState('');
  const [showForm133, setShowForm133] = useState(false);
  const [showForm213, setShowForm213] = useState(false);

  useEffect(() => {
    const fetchUserRegion = async () => {
      try {
        if (!isRegionalized) {
          setUserRegion('All Regions');
          if (group) setGroupID(group.id);
          return;
        }

        if (region) {
          setUserRegion(region.trim());
          if (group) setGroupID(group.id);
          return;
        }

        if (!profile?.id) return;

        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('InchargeRegion')
          .eq('cppsid', profile.id)
          .maybeSingle();

        if (error) throw error;

        setUserRegion(data?.InchargeRegion?.trim() || 'Momase Region');

        if (group) setGroupID(group.id);
      } catch (err) {
        setError('Failed to fetch region information. Please try again later.');
        setUserRegion('Momase Region');
      }
    };

    fetchUserRegion();
  }, [profile, group, region]);

  useEffect(() => {
    if (userRegion) {
      fetchForm18List();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRegion, currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchForm18List = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userRegion) {
        setError('Please wait while we load your region information.');
        return;
      }

      const start = (currentPage - 1) * recordsPerPage;
      const end = start + recordsPerPage - 1;

      // Query the VIEW with an inner join already applied server-side
      let query = supabase
        .from('v_form18_joined')
        .select(
          `
          IRN,
          F18MID,
          F18MStatus,
          IncidentType,
          F18MEmployerAcceptedDate,
          DisplayIRN,
          WorkerFirstName,
          WorkerLastName
        `,
          { count: 'exact' }
        )
        .eq('F18MStatus', 'EmployerAccepted'); // <- filter here for this screen only

      if (isRegionalized && userRegion && userRegion !== 'All Regions') {
        const cleanRegion = userRegion.trim();
        query = query.eq('IncidentRegion', cleanRegion);
      }

      if (onlyTribunal) {
        // Fetch IRNs with processed hearing outcomes
        const { data: thoData } = await supabase
          .from('tribunalhearingoutcome')
          .select('THOIRN')
          .eq('THODecision', 'Approved')
          .eq('THOHearingStatus', 'Processed');
        
        const tribunalIRNs = thoData?.map(d => d.THOIRN) || [];
        if (tribunalIRNs.length > 0) {
          query = query.in('IRN', tribunalIRNs);
        } else {
          // If no tribunal IRNs, return empty list
          setForm18List([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }

      const { data, error, count } = await query
        .order('F18MEmployerAcceptedDate', { ascending: false, nullsFirst: false })
        .range(start, end);

      if (error) throw error;

      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.max(1, Math.ceil(totalCount / recordsPerPage)));

      const formattedData: Form18Data[] = (data ?? []).map((row: any) => ({
        IRN: String(row.IRN ?? 'N/A'),
        DisplayIRN: row.DisplayIRN ?? 'N/A',
        WorkerFirstName: row.WorkerFirstName ?? 'N/A',
        WorkerLastName: row.WorkerLastName ?? 'N/A',
        EmployerAcceptedDate: row.F18MEmployerAcceptedDate
          ? new Date(row.F18MEmployerAcceptedDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'N/A',
        IncidentType: row.IncidentType ?? 'N/A',
        F18MID: row.F18MID,
        Status: row.F18MStatus,
      }));

      // Client-side search filters (optional)
      let filteredData = formattedData;

      if (searchIRN) {
        const q = searchIRN.toLowerCase();
        filteredData = filteredData.filter((i) => i.DisplayIRN.toLowerCase().includes(q));
      }
      if (searchFirstName) {
        const q = searchFirstName.toLowerCase();
        filteredData = filteredData.filter((i) => i.WorkerFirstName.toLowerCase().includes(q));
      }
      if (searchLastName) {
        const q = searchLastName.toLowerCase();
        filteredData = filteredData.filter((i) => i.WorkerLastName.toLowerCase().includes(q));
      }

      setForm18List(filteredData);
    } catch (err: any) {
      setError(err.message || 'Failed to load Form18 list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleView = (irn: string, incidentType: string) => {
    if (typeof irn !== 'string' || !irn || irn.trim() === '') {
      setError('Invalid IRN. Please select a valid claim to view.');
      return;
    }

    setSelectedIRN(irn);
    setSelectedIncidentType(incidentType);

    if (incidentType === 'Injury') {
      setShowForm133(true);
    } else if (incidentType === 'Death') {
      setShowForm213(true);
    }
  };

  const handleCloseForm133 = () => {
    setShowForm133(false);
    setSelectedIRN('');
    setSelectedIncidentType('');
    fetchForm18List(); // Refresh the list
  };

  const handleCloseForm213 = () => {
    setShowForm213(false);
    setSelectedIRN('');
    setSelectedIncidentType('');
    fetchForm18List(); // Refresh the list
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div className="flex items-center">
            <Logo size={40} className="mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              Form 18 - Employer Accepted
              {userRegion && <span className="text-sm font-normal ml-2 text-gray-600">({userRegion})</span>}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="searchIRN" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by Display IRN
                </label>
                <input
                  type="text"
                  id="searchIRN"
                  value={searchIRN}
                  onChange={(e) => setSearchIRN(e.target.value)}
                  className="input"
                  placeholder="Enter Display IRN"
                />
              </div>

              <div>
                <label htmlFor="searchFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by First Name
                </label>
                <input
                  type="text"
                  id="searchFirstName"
                  value={searchFirstName}
                  onChange={(e) => setSearchFirstName(e.target.value)}
                  className="input"
                  placeholder="Enter First Name"
                />
              </div>

              <div>
                <label htmlFor="searchLastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by Last Name
                </label>
                <input
                  type="text"
                  id="searchLastName"
                  value={searchLastName}
                  onChange={(e) => setSearchLastName(e.target.value)}
                  className="input"
                  placeholder="Enter Last Name"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary flex items-center">
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </div>
          </form>

          <hr className="mb-6" />

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>
          )}

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Total Records Found: {totalRecords} | Total Pages: {totalPages}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : form18List.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">CRN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">First Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Accepted Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Incident Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {form18List.map((form, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">{form.DisplayIRN}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.WorkerFirstName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.WorkerLastName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.EmployerAcceptedDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.IncidentType}</td>
                      <td className="px-6 py-4 whitespace-nowrap border border-gray-300">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            form.Status === 'EmployerAccepted'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {form.Status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border border-gray-300">
                        <button
                          onClick={() => handleView(form.IRN, form.IncidentType)}
                          className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No Notifications to Display.</p>
            </div>
          )}

          {/* Modal for Form 133 */}
          {showForm133 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <Form133CPOForm18InjuryEmployerResponseReview
                  irn={selectedIRN}
                  incidentType={selectedIncidentType}
                  onClose={handleCloseForm133}
                  onSubmit={() => console.log('Form 133 submitted')}
                  onBack={() => console.log('Back from Form 133')}
                />
              </div>
            </div>
          )}

          {/* Modal for Form213 */}
          {showForm213 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <Form213CPOForm18DeathEmployerResponseReview
                  irn={selectedIRN}
                  incidentType={selectedIncidentType}
                  onClose={handleCloseForm213}
                  onSubmit={() => console.log('Form 213 submitted')}
                  onBack={() => console.log('Back from Form 213')}
                />
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <>
                    <button onClick={() => handlePageChange(1)} className="px-3 py-1 border rounded text-sm">
                      First
                    </button>
                    <button onClick={() => handlePageChange(currentPage - 1)} className="px-3 py-1 border rounded text-sm">
                      Previous
                    </button>
                  </>
                )}
                {currentPage < totalPages && (
                  <>
                    <button onClick={() => handlePageChange(currentPage + 1)} className="px-3 py-1 border rounded text-sm">
                      Next
                    </button>
                    <button onClick={() => handlePageChange(totalPages)} className="px-3 py-1 border rounded text-sm">
                      Last
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListForm18EmployerAccepted;
