import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form238HearingPendingForm11Submission from './238HearingPendingForm11Submission';
import Form239HearingPendingForm12Submission from './239HearingPendngForm12Submission';
import Form253HearingPendingForm7Submission from './253HearingPendingForm7Submission';

interface ListPendingHearingsPublicProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, action: string) => void;
}

interface HearingData {
  IRN: string;
  CRN: string;
  FirstName: string;
  LastName: string;
  SubmissionDate: string;
  SetForHearing: string;
  Status: string;
  Type: string;
}

const ListPendingHearingsPublic: React.FC<ListPendingHearingsPublicProps> = ({ 
  onClose,
  onSelectIRN 
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hearingsList, setHearingsList] = useState<HearingData[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showForm238, setShowForm238] = useState(false);
  const [showForm239, setShowForm239] = useState(false);
  const [showForm253, setShowForm253] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string>('');

  useEffect(() => {
    fetchHearingsList();
  }, [currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchHearingsList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the count of matching records
      let countQuery = supabase
        .from('tribunalhearingschedule')
        .select('*', { count: 'exact', head: true })
        .eq('THSHearingStatus', 'HearingPending')
        .eq('THSWorkerOrganizationType', 'Public');

      // Apply search filters if provided
      if (searchIRN) {
        // We need to join with form1112master to filter by DisplayIRN
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('IRN')
          .ilike('DisplayIRN', `%${searchIRN}%`);
        
        if (form1112Error) throw form1112Error;
        
        if (form1112Data && form1112Data.length > 0) {
          const irns = form1112Data.map(item => item.IRN);
          countQuery = countQuery.in('IRN', irns);
        } else {
          // No matching IRNs found
          setHearingsList([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }
      
      // For first name and last name, we need to join with workerpersonaldetails
      if (searchFirstName || searchLastName) {
        // First get the worker IDs that match the name criteria
        let workerQuery = supabase
          .from('workerpersonaldetails')
          .select('WorkerID');
        
        if (searchFirstName) {
          workerQuery = workerQuery.ilike('WorkerFirstName', `%${searchFirstName}%`);
        }
        
        if (searchLastName) {
          workerQuery = workerQuery.ilike('WorkerLastName', `%${searchLastName}%`);
        }
        
        const { data: workerData, error: workerError } = await workerQuery;
        
        if (workerError) throw workerError;
        
        if (workerData && workerData.length > 0) {
          // Now get the IRNs for these workers
          const workerIDs = workerData.map(item => item.WorkerID);
          
          const { data: form1112Data, error: form1112Error } = await supabase
            .from('form1112master')
            .select('IRN')
            .in('WorkerID', workerIDs);
          
          if (form1112Error) throw form1112Error;
          
          if (form1112Data && form1112Data.length > 0) {
            const irns = form1112Data.map(item => item.IRN);
            countQuery = countQuery.in('IRN', irns);
          } else {
            // No matching IRNs found
            setHearingsList([]);
            setTotalRecords(0);
            setTotalPages(1);
            setLoading(false);
            return;
          }
        } else {
          // No matching workers found
          setHearingsList([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }

      const { count, error: countError } = await countQuery;

      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.ceil(totalCount / recordsPerPage));
      
      // Calculate pagination
      const start = (currentPage - 1) * recordsPerPage;
      
      // Build the main query
      // We need to join multiple tables to get all the required data
      const { data, error } = await supabase
        .rpc('get_pending_hearings_public', {
          p_limit: recordsPerPage,
          p_offset: start,
          p_search_irn: searchIRN,
          p_search_first_name: searchFirstName,
          p_search_last_name: searchLastName
        });

      if (error) {
        // If the RPC function doesn't exist, fall back to a manual query
        console.error('RPC error, falling back to manual query:', error);
        
        // This is a complex query that joins multiple tables
        // We'll need to do it in multiple steps
        
        // Step 1: Get the hearing schedule records
        let query = supabase
          .from('tribunalhearingschedule')
          .select(`
            IRN,
            THSSubmissionDate,
            THSSetForHearing,
            THSHearingStatus,
            THSHearingType
          `)
          .eq('THSHearingStatus', 'HearingPending')
          .eq('THSWorkerOrganizationType', 'Public')
          .range(start, start + recordsPerPage - 1)
          .order('THSSubmissionDate', { ascending: false });
        
        // Apply the same filters as the count query
        if (searchIRN || searchFirstName || searchLastName) {
          // We already have the filtered IRNs from the count query
          // Reuse the same logic
          let filteredIRNs: string[] = [];
          
          if (searchIRN) {
            const { data: form1112Data } = await supabase
              .from('form1112master')
              .select('IRN')
              .ilike('DisplayIRN', `%${searchIRN}%`);
            
            if (form1112Data && form1112Data.length > 0) {
              filteredIRNs = form1112Data.map(item => item.IRN);
            }
          }
          
          if (searchFirstName || searchLastName) {
            let workerQuery = supabase
              .from('workerpersonaldetails')
              .select('WorkerID');
            
            if (searchFirstName) {
              workerQuery = workerQuery.ilike('WorkerFirstName', `%${searchFirstName}%`);
            }
            
            if (searchLastName) {
              workerQuery = workerQuery.ilike('WorkerLastName', `%${searchLastName}%`);
            }
            
            const { data: workerData } = await workerQuery;
            
            if (workerData && workerData.length > 0) {
              const workerIDs = workerData.map(item => item.WorkerID);
              
              const { data: form1112Data } = await supabase
                .from('form1112master')
                .select('IRN')
                .in('WorkerID', workerIDs);
              
              if (form1112Data && form1112Data.length > 0) {
                const irns = form1112Data.map(item => item.IRN);
                
                // If we already have filtered IRNs from searchIRN, we need to find the intersection
                if (filteredIRNs.length > 0) {
                  filteredIRNs = filteredIRNs.filter(irn => irns.includes(irn));
                } else {
                  filteredIRNs = irns;
                }
              }
            }
          }
          
          if (filteredIRNs.length > 0) {
            query = query.in('IRN', filteredIRNs);
          } else {
            // No matching IRNs found
            setHearingsList([]);
            setLoading(false);
            return;
          }
        }
        
        const { data: hearingData, error: hearingError } = await query;
        
        if (hearingError) throw hearingError;
        
        if (!hearingData || hearingData.length === 0) {
          setHearingsList([]);
          setLoading(false);
          return;
        }
        
        // Step 2: Get the form1112master data for these IRNs
        const irns = hearingData.map(item => item.IRN);
        
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('IRN, DisplayIRN, WorkerID')
          .in('IRN', irns);
        
        if (form1112Error) throw form1112Error;
        
        // Create a map of IRN to DisplayIRN and WorkerID
        const form1112Map = new Map();
        form1112Data?.forEach(item => {
          form1112Map.set(item.IRN, {
            DisplayIRN: item.DisplayIRN,
            WorkerID: item.WorkerID
          });
        });
        
        // Step 3: Get the worker details for these WorkerIDs
        const workerIDs = form1112Data?.map(item => item.WorkerID).filter(Boolean) || [];
        
        const { data: workerData, error: workerError } = await supabase
          .from('workerpersonaldetails')
          .select('WorkerID, WorkerFirstName, WorkerLastName')
          .in('WorkerID', workerIDs);
        
        if (workerError) throw workerError;
        
        // Create a map of WorkerID to worker details
        const workerMap = new Map();
        workerData?.forEach(item => {
          workerMap.set(item.WorkerID, {
            FirstName: item.WorkerFirstName,
            LastName: item.WorkerLastName
          });
        });
        
        // Step 4: Combine all the data
        const formattedData = hearingData.map(item => {
          const form1112 = form1112Map.get(item.IRN);
          const worker = form1112 ? workerMap.get(form1112.WorkerID) : null;
          
          return {
            IRN: item.IRN,
            CRN: form1112?.DisplayIRN || 'N/A',
            FirstName: worker?.FirstName || 'N/A',
            LastName: worker?.LastName || 'N/A',
            SubmissionDate: item.THSSubmissionDate ? new Date(item.THSSubmissionDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }) : 'N/A',
            SetForHearing: item.THSSetForHearing || 'Not Scheduled',
            Status: item.THSHearingStatus,
            Type: item.THSHearingType
          };
        });
        
        setHearingsList(formattedData);
      } else {
        // If the RPC function exists, use its results
        const formattedData = data.map((item: any) => ({
          IRN: item.irn,
          CRN: item.crn,
          FirstName: item.firstname,
          LastName: item.lastname,
          SubmissionDate: item.submissiondate,
          SetForHearing: item.setforhearing || 'Not Scheduled',
          Status: item.status,
          Type: item.type
        }));
        
        setHearingsList(formattedData);
      }
    } catch (err: any) {
      console.error('Error fetching hearings list:', err);
      setError(err.message || 'Failed to load hearings list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    fetchHearingsList();
  };

  const handleAction = async (irn: string, setForHearing: string) => {
    if (setForHearing === 'Not Scheduled' || setForHearing === 'Appealed') {
      // Schedule action - show appropriate form based on hearing type
      const hearing = hearingsList.find(h => h.IRN === irn);
      
      if (hearing) {
        setSelectedIRN(irn);
        
        switch (hearing.Type) {
          case 'TimeBarredForm11Submission':
            setShowForm238(true);
            break;
          case 'TimeBarredForm12Submission':
            setShowForm239(true);
            break;
          case 'Form7EmployerRejectedOtherReason':
            setShowForm253(true);
            break;
          case 'Form6StateSolicitorSumbission':
            try {
              // Determine incident type from form1112master
              const { data, error: lookupError } = await supabase
                .from('form1112master')
                .select('IncidentType')
                .eq('IRN', irn)
                .single();

              if (lookupError) throw lookupError;

              if (data?.IncidentType === 'Injury') {
                setShowForm238(true);
              } else if (data?.IncidentType === 'Death') {
                setShowForm239(true);
              } else {
                alert(`Unexpected incident type: ${data?.IncidentType}`);
              }
            } catch (err: any) {
              console.error('Error looking up incident type:', err);
              alert('Failed to determine incident type for scheduling.');
            }
            break;
          default:
            // For other types, you might want to show a default form or handle differently
            console.log('Unknown hearing type:', hearing.Type);
        }
      }
    } else {
      // View action - you can implement view logic here if needed
      console.log('View action for IRN:', irn);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Hearing Pending (Public)
          </h2>
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
          ) : hearingsList.length > 0 ? (
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
                      Submission Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Set For Hearing
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Incident Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {hearingsList.map((hearing, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {hearing.CRN}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.FirstName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.LastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.SubmissionDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={hearing.SetForHearing === 'Appealed' ? 'text-red-600 font-bold' : 'text-gray-900'}>
                          {hearing.SetForHearing}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.Type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleAction(hearing.IRN, hearing.SetForHearing)}
                          className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                        >
                          {(hearing.SetForHearing === 'Not Scheduled' || hearing.SetForHearing === 'Appealed') ? 'Schedule' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No Hearings Pending</p>
            </div>
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

      {/* Form 238 Modal */}
      {showForm238 && (
        <Form238HearingPendingForm11Submission
          irn={selectedIRN}
          onClose={() => {
            setShowForm238(false);
            setSelectedIRN('');
            fetchHearingsList();
          }}
        />
      )}

      {/* Form 239 Modal */}
      {showForm239 && (
        <Form239HearingPendingForm12Submission
          irn={selectedIRN}
          onClose={() => {
            setShowForm239(false);
            setSelectedIRN('');
            fetchHearingsList();
          }}
        />
      )}

      {/* Form 253 Modal */}
      {showForm253 && (
        <Form253HearingPendingForm7Submission
          irn={selectedIRN}
          onClose={() => {
            setShowForm253(false);
            setSelectedIRN('');
            fetchHearingsList();
          }}
        />
      )}
    </div>
  );
};

export default ListPendingHearingsPublic;
