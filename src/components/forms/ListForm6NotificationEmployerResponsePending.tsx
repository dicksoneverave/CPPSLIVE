import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form140NotificationEmployerResponsePendingInjury from './140NotificationEmployerResponsePendingInjury';
import Form139NotificationEmployerResponsePendingDeath from './139NotificationEmployerResponsePendingDeath';

interface ListForm6NotificationEmployerResponsePendingProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: string) => void;
}

interface Form6Data {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  ApprovalDate: string;
  IncidentType: string;
  F6MID: string;
  F6MStatus: string;
}

const ListForm6NotificationEmployerResponsePending: React.FC<ListForm6NotificationEmployerResponsePendingProps> = ({ 
  onClose,
  onSelectIRN 
}) => {
  const { profile, group } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form6List, setForm6List] = useState<Form6Data[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [groupID, setGroupID] = useState<number | null>(null);
  const [showForm140, setShowForm140] = useState(false);
  const [showForm139, setShowForm139] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState('');
  const [selectedIncidentType, setSelectedIncidentType] = useState('');

  useEffect(() => {
    const fetchUserRegion = async () => {
      try {
        if (!profile?.id) {
          console.warn('No profile ID available');
          return;
        }
        
        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('InchargeRegion')
          .eq('cppsid', profile.id)
          .maybeSingle();
        
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        
        if (data) {
          setUserRegion(data.InchargeRegion);
        } else {
          console.warn('No region found for user:', profile.id);
          setUserRegion('Momase Region');
        }

        if (group && 'id' in group) {
          setGroupID(group.id);
        }
      } catch (err) {
        console.error('Error fetching user region:', err);
        setError('Failed to fetch region information. Please try again later.');
        setUserRegion('Momase Region');
      }
    };
    
    fetchUserRegion();
  }, [profile, group]);

  useEffect(() => {
    if (userRegion) {
      fetchForm6List();
    }
  }, [userRegion, currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchForm6List = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!userRegion) {
        setError('Please wait while we load your region information.');
        return;
      }
      
      const { data: form1112Data, error: form1112Error } = await supabase
        .from('form1112master')
        .select('IRN')
        .eq('IncidentRegion', userRegion);

      if (form1112Error) throw form1112Error;

      if (!form1112Data || form1112Data.length === 0) {
        setForm6List([]);
        setTotalRecords(0);
        setTotalPages(1);
        return;
      }

      const regionIRNs = form1112Data.map(item => item.IRN);
      
      const { count, error: countError } = await supabase
        .from('form6master')
        .select('IRN', { count: 'exact', head: true })
        .eq('F6MStatus', 'Pending')
        .in('IRN', regionIRNs);

      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.ceil(totalCount / recordsPerPage));
      
      const start = (currentPage - 1) * recordsPerPage;
      
      const { data: form6Data, error: form6Error } = await supabase
        .from('form6master')
        .select(`
          IRN,
          F6MApprovalDate,
          IncidentType,
          F6MID,
          F6MStatus
        `)
        .eq('F6MStatus', 'Pending')
        .in('IRN', regionIRNs)
        .range(start, start + recordsPerPage - 1)
        .order('F6MApprovalDate', { ascending: false });

      if (form6Error) throw form6Error;

      if (!form6Data || form6Data.length === 0) {
        setForm6List([]);
        return;
      }

      const irns = form6Data.map(item => item.IRN);
      
      const { data: detailedForm1112Data, error: detailedForm1112Error } = await supabase
        .from('form1112master')
        .select(`
          IRN,
          DisplayIRN,
          WorkerID
        `)
        .in('IRN', irns);

      if (detailedForm1112Error) throw detailedForm1112Error;

      const workerIds = detailedForm1112Data.map(item => item.WorkerID).filter(Boolean);
      
      if (workerIds.length === 0) {
        setForm6List([]);
        return;
      }

      const { data: workerData, error: workerError } = await supabase
        .from('workerpersonaldetails')
        .select(`
          WorkerID,
          WorkerFirstName,
          WorkerLastName
        `)
        .in('WorkerID', workerIds);

      if (workerError) throw workerError;

      const formattedData = form6Data.map(item => {
        const form1112 = detailedForm1112Data.find(f => f.IRN === item.IRN);
        const worker = form1112 ? workerData.find(w => w.WorkerID === form1112.WorkerID) : null;

        return {
          IRN: item.IRN,
          DisplayIRN: form1112?.DisplayIRN || 'N/A',
          WorkerFirstName: worker?.WorkerFirstName || 'N/A',
          WorkerLastName: worker?.WorkerLastName || 'N/A',
          ApprovalDate: item.F6MApprovalDate ? new Date(item.F6MApprovalDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) : 'N/A',
          IncidentType: item.IncidentType || 'N/A',
          F6MID: item.F6MID,
          F6MStatus: item.F6MStatus
        };
      });

      let filteredData = formattedData;
      
      if (searchIRN) {
        filteredData = filteredData.filter(item => 
          item.DisplayIRN.toLowerCase().includes(searchIRN.toLowerCase())
        );
      }
      
      if (searchFirstName) {
        filteredData = filteredData.filter(item => 
          item.WorkerFirstName.toLowerCase().includes(searchFirstName.toLowerCase())
        );
      }
      
      if (searchLastName) {
        filteredData = filteredData.filter(item => 
          item.WorkerLastName.toLowerCase().includes(searchLastName.toLowerCase())
        );
      }
      
      setForm6List(filteredData);
    } catch (err: any) {
      console.error('Error fetching Form6 list:', err);
      setError(err.message || 'Failed to load Form6 list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchForm6List();
  };

  const handleView = (irn: string, incidentType: string) => {
    console.log(`[DEBUG] View clicked - IRN: ${irn}, Incident Type: ${incidentType}`);
    
    if (onSelectIRN) {
      console.log(`[DEBUG] onSelectIRN callback triggered for IRN: ${irn}, Incident Type: ${incidentType}`);
      onSelectIRN(irn, incidentType);
    } else {
      console.log(`[DEBUG] Displaying form for IRN: ${irn}, Incident Type: ${incidentType}`);
      setSelectedIRN(irn);
      setSelectedIncidentType(incidentType);
      
      if (incidentType === 'Injury') {
        console.log(`[DEBUG] Loading Form 140 for IRN: ${irn}`);
        setShowForm140(true);
      } else if (incidentType === 'Death') {
        console.log(`[DEBUG] Loading Form 139 for IRN: ${irn}`);
        setShowForm139(true);
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm140(false);
    setShowForm139(false);
    setSelectedIRN('');
    setSelectedIncidentType('');
    console.log('[DEBUG] Form closed');
  };

  const handlePageChange = (page: number) => {
    console.log(`[DEBUG] Changing page to: ${page}`);
    setCurrentPage(page);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Form 6 Notifications - Employer Response Pending
            {userRegion && <span className="text-sm font-normal ml-2 text-gray-600">({userRegion})</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
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
              <button
                type="submit"
                className="btn btn-primary flex items-center"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </div>
          </form>

          <hr className="mb-6" />

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Total Records Found: {totalRecords} | 
              Total Pages: {totalPages}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : form6List.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CRN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      First Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approval Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Incident Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {form6List.map((form, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {form.DisplayIRN}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.WorkerFirstName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.WorkerLastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.ApprovalDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.IncidentType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.F6MStatus}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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

          {showForm140 && (
            <Form140NotificationEmployerResponsePendingInjury 
              irn={selectedIRN} 
              incidentType={selectedIncidentType} 
              onClose={handleCloseForm} 
              onSubmit={() => console.log('Form 140 submitted')}
              onBack={() => {
                setShowForm140(false);
                console.log('Back to list from Form 140');
              }}
            />
          )}

          {showForm139 && (
            <Form139NotificationEmployerResponsePendingDeath 
              irn={selectedIRN} 
              incidentType={selectedIncidentType} 
              onClose={handleCloseForm} 
              onSubmit={() => console.log('Form 139 submitted')}
              onBack={() => {
                setShowForm139(false);
                console.log('Back to list from Form 139');
              }}
            />
          )}

          <div className="mt-6 flex justify-center">
            <div className="flex space-x-2">
              {currentPage > 1 && (
                <>
                  <button
                    onClick={() => handlePageChange(1)}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    First
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    Previous
                  </button>
                </>
              )}
              
              {currentPage < totalPages && (
                <>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    Last
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListForm6NotificationEmployerResponsePending;
