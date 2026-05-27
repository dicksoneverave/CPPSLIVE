import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form245EmployerRejectNotificationInjury from './245EmployerRejectNotificationInjury';
import Form244EmployerRejectNotificationDeath from './244EmployerRejectNotificationDeath';
import Logo from '../common/Logo';

interface ListForm7Props {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: string) => void;
  region?: string;
  isRegionalized?: boolean;
}

interface Form7Data {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  RejectedDate: string;
  IncidentType: string;
  F7MID: string;
  F7MStatus: string;
}

const ListForm7: React.FC<ListForm7Props> = ({ 
  onClose,
  onSelectIRN,
  region,
  isRegionalized = true
}) => {
  const { profile, group } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form7List, setForm7List] = useState<Form7Data[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [groupID, setGroupID] = useState<number | null>(null);
  const [showForm245, setShowForm245] = useState(false);
  const [showForm244, setShowForm244] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState('');
  const [selectedIncidentType, setSelectedIncidentType] = useState('');


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
          // Default to a region for testing/development
          setUserRegion('Momase Region');
        }

        if (group) {
          setGroupID(group.id);
        }
      } catch (err) {
        console.error('Error fetching user region:', err);
        setError('Failed to fetch region information. Please try again later.');
        // Default to a region for testing/development
        setUserRegion('Momase Region');
      }
    };
    
    fetchUserRegion();
  }, [profile, group, region]);

  useEffect(() => {
    if (userRegion) {
      fetchForm7List();
    }
  }, [userRegion, currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchForm7List = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the count of matching records
      const { count, error: countError } = await supabase
        .from('form7master')
        .select('IRN', { count: 'exact', head: true });

      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.ceil(totalCount / recordsPerPage));
      
      // Calculate pagination
      const start = (currentPage - 1) * recordsPerPage;
      
      // Get form7master data
      const { data: form7Data, error: form7Error } = await supabase
        .from('form7master')
        .select(`
          IRN,
          F7MEmployerRejectedDate,
          IncidentType,
          F7MID,
          F7MStatus
        `)
        .range(start, start + recordsPerPage - 1)
        .order('F7MEmployerRejectedDate', { ascending: false });

      if (form7Error) throw form7Error;

      if (!form7Data || form7Data.length === 0) {
        setForm7List([]);
        return;
      }

      // Get the IRNs from the result
      const irns = form7Data.map(item => item.IRN);

      // Get the form1112master data for these IRNs
      const { data: form1112Data, error: form1112Error } = await supabase
        .from('form1112master')
        .select(`
          IRN,
          DisplayIRN,
          WorkerID
        `)
        .in('IRN', irns);

      if (form1112Error) throw form1112Error;

      // Create a map of IRN to form1112master data
      const form1112Map = new Map();
      form1112Data.forEach(item => {
        form1112Map.set(item.IRN, item);
      });

      // Get worker details for all WorkerIDs
      const workerIds = form1112Data.map(item => item.WorkerID).filter(Boolean);
      
      if (workerIds.length === 0) {
        setForm7List([]);
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

      // Create a map of WorkerID to worker data
      const workerMap = new Map();
      workerData.forEach(item => {
        workerMap.set(item.WorkerID, item);
      });

      // Combine all the data
      const formattedData = form7Data.map(item => {
        const form1112 = form1112Map.get(item.IRN);
        const worker = form1112 ? workerMap.get(form1112.WorkerID) : null;

        return {
          IRN: item.IRN,
          DisplayIRN: form1112?.DisplayIRN || 'N/A',
          WorkerFirstName: worker?.WorkerFirstName || 'N/A',
          WorkerLastName: worker?.WorkerLastName || 'N/A',
          RejectedDate: item.F7MEmployerRejectedDate ? new Date(item.F7MEmployerRejectedDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }) : 'N/A',
          IncidentType: item.IncidentType || 'N/A',
          F7MID: item.F7MID,
          F7MStatus: item.F7MStatus
        };
      });

      // Apply filters if needed
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
      
      setForm7List(filteredData);
    } catch (err: any) {
      console.error('Error fetching Form7 list:', err);
      setError(err.message || 'Failed to load Form7 list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
		fetchForm7List();
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
        console.log(`[DEBUG] Loading Form 245 for IRN: ${irn}`);
        setShowForm245(true);
      } else if (incidentType === 'Death') {
        console.log(`[DEBUG] Loading Form 244 for IRN: ${irn}`);
        setShowForm244(true);
      }
	}
  };

const handleCloseForm1 = () => {
    setShowForm245(false);
    //setShowForm139(false);
    setSelectedIRN('');
    setSelectedIncidentType('');
    console.log('[DEBUG] Form closed');
  };

const handleCloseForm2 = () => {
    setShowForm244(false);
    //setShowForm139(false);
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
          <div className="flex items-center">
            <Logo size={40} className="mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              Form 7 List
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
          ) : form7List.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#8B2500]">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      CRN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      First Name
                    </th>
                    <th scope="col" className="px-6 py-3  text-left text-xs font-medium text-white uppercase tracking-wider">
                      Last Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Rejected Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Form Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {form7List.map((form, index) => (
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
                        {form.RejectedDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {form.IncidentType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleView(form.IRN, form.IncidentType)}
                          className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No Pending Forms For Prescreening.</p>
            </div>
          )}

          {showForm245 && (
            <Form245EmployerRejectNotificationInjury 
              irn={selectedIRN} 
              incidentType={selectedIncidentType} 
              onClose={handleCloseForm1} 
              onSubmit={() => console.log('Form 245 submitted')}
              onBack={() => {
                setShowForm245(false);
                console.log('Back to list from Form 245');
              }}
            />
          )}

          {showForm244 && (
            <Form244EmployerRejectNotificationDeath 
              irn={selectedIRN} 
              incidentType={selectedIncidentType} 
              onClose={handleCloseForm2} 
              onSubmit={() => console.log('Form 245 submitted')}
              onBack={() => {
                setShowForm244(false);
                console.log('Back to list from Form 245');
              }}
            />
          )}
					
          {/* Pagination */}
          {totalPages > 1 && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ListForm7;
