import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form247Form17Injury from './247Form17Injury';
import Form246Form17Death from './246Form17Death';

interface ListForm17Props {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: string) => void;
}

interface Form17Data {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  RejectedDate: string;
  IncidentType: string;
  F17MID: string;
  F17MStatus: string;
}

const ListForm17: React.FC<ListForm17Props> = ({ 
  onClose,
  onSelectIRN 
}) => {
  const { profile, group } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form17List, setForm17List] = useState<Form17Data[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [groupID, setGroupID] = useState<number | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedFormIRN, setSelectedFormIRN] = useState<string | null>(null);
  const [selectedIncidentType, setSelectedIncidentType] = useState<string | null>(null);
  const [showForm246, setShowForm246] = useState(false);
  const [showForm247, setShowForm247] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState('');
 
	
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
  }, [profile, group]);

  useEffect(() => {
    if (userRegion) {
      fetchForm17List();
    }
  }, [userRegion, currentPage, searchIRN, searchFirstName, searchLastName]);

const fetchForm17List = async () => {
  try {
    setLoading(true);
    setError(null);

    if (!userRegion) {
      setError('Please wait while we load your region information.');
      return;
    }

    const start = (currentPage - 1) * recordsPerPage;
    const end = start + recordsPerPage - 1;

    // Try the view first (recommended)
    const { count: vCount, error: vCountErr } = await supabase
      .from('v_form17_joined')
      .select('IRN', { count: 'exact', head: true })
      .eq('IncidentRegion', userRegion);

    if (!vCountErr) {
      const totalCount = vCount || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.max(1, Math.ceil(totalCount / recordsPerPage)));

      const { data: viewRows, error: viewErr } = await supabase
        .from('v_form17_joined')
        .select(
          `
            IRN,
            DisplayIRN,
            WorkerFirstName,
            WorkerLastName,
            F17MWorkerRejectedDate,
            IncidentType,
            F17MID,
            F17MStatus
          `
        )
        .eq('IncidentRegion', userRegion)
        .order('F17MWorkerRejectedDate', { ascending: false, nullsFirst: false })
        .range(start, end);

      if (viewErr) throw viewErr;

      const rows = (viewRows || []).map((r: any) => ({
        IRN: String(r.IRN),
        DisplayIRN: r.DisplayIRN ?? 'N/A',
        WorkerFirstName: r.WorkerFirstName ?? 'N/A',
        WorkerLastName: r.WorkerLastName ?? 'N/A',
        RejectedDate: r.F17MWorkerRejectedDate
          ? new Date(r.F17MWorkerRejectedDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'N/A',
        IncidentType: r.IncidentType ?? 'N/A',
        F17MID: r.F17MID,
        F17MStatus: r.F17MStatus,
      }));

      // In-memory filters
      let filtered = rows;
      if (searchIRN) filtered = filtered.filter(x => x.DisplayIRN?.toLowerCase().includes(searchIRN.toLowerCase()));
      if (searchFirstName) filtered = filtered.filter(x => x.WorkerFirstName?.toLowerCase().includes(searchFirstName.toLowerCase()));
      if (searchLastName) filtered = filtered.filter(x => x.WorkerLastName?.toLowerCase().includes(searchLastName.toLowerCase()));

      setForm17List(filtered);
      return;
    }

    // ---- Fallback (if the view doesn't exist): do it server-side in one query
    // Requires FK relationships for PostgREST join syntax OR a SQL view/RPC.
    // If FKs exist:
    const { count, error: countErr } = await supabase
      .from('form17master')
      .select('IRN, form1112master!inner(IncidentRegion)', { count: 'exact', head: true })
      .eq('form1112master.IncidentRegion', userRegion);

    if (countErr) throw countErr;

    const totalCount = count || 0;
    setTotalRecords(totalCount);
    setTotalPages(Math.max(1, Math.ceil(totalCount / recordsPerPage)));

    const { data: joined, error: joinedErr } = await supabase
      .from('form17master')
      .select(
        `
          IRN,
          F17MWorkerRejectedDate,
          IncidentType,
          F17MID,
          F17MStatus,
          form1112master!inner(IRN, DisplayIRN, WorkerID, IncidentRegion),
          workerpersonaldetails!inner(WorkerID, WorkerFirstName, WorkerLastName)
        `
      )
      .eq('form1112master.IncidentRegion', userRegion)
      .order('F17MWorkerRejectedDate', { ascending: false, nullsFirst: false })
      .range(start, end);

    if (joinedErr) throw joinedErr;

    const rows = (joined || []).map((r: any) => ({
      IRN: String(r.IRN),
      DisplayIRN: r.form1112master?.DisplayIRN ?? 'N/A',
      WorkerFirstName: r.workerpersonaldetails?.WorkerFirstName ?? 'N/A',
      WorkerLastName: r.workerpersonaldetails?.WorkerLastName ?? 'N/A',
      RejectedDate: r.F17MWorkerRejectedDate
        ? new Date(r.F17MWorkerRejectedDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : 'N/A',
      IncidentType: r.IncidentType ?? 'N/A',
      F17MID: r.F17MID,
      F17MStatus: r.F17MStatus,
    }));

    let filtered = rows;
    if (searchIRN) filtered = filtered.filter(x => x.DisplayIRN?.toLowerCase().includes(searchIRN.toLowerCase()));
    if (searchFirstName) filtered = filtered.filter(x => x.WorkerFirstName?.toLowerCase().includes(searchFirstName.toLowerCase()));
    if (searchLastName) filtered = filtered.filter(x => x.WorkerLastName?.toLowerCase().includes(searchLastName.toLowerCase()));

    setForm17List(filtered);
  } catch (err: any) {
    console.error('Error fetching Form17 list:', err);
    setError(err.message || 'Failed to load Form17 list');
  } finally {
    setLoading(false);
  }
};


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
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
        console.log(`[DEBUG] Loading Form 247 for IRN: ${irn}`);
        setShowForm247(true);
      } else if (incidentType === 'Death') {
        console.log(`[DEBUG] Loading Form 246 for IRN: ${irn}`);
        setShowForm246(true);
      }
	}
  };

const handleCloseForm1 = () => {
    setShowForm247(false);
    //setShowForm139(false);
    setSelectedIRN('');
    setSelectedIncidentType('');
    console.log('[DEBUG] Form closed');
  };

const handleCloseForm2 = () => {
    setShowForm246(false);
    //setShowForm139(false);
    setSelectedIRN('');
    setSelectedIncidentType('');
    console.log('[DEBUG] Form closed');
  };


	
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Form 17 List
            {userRegion && <span className="text-sm font-normal ml-2 text-gray-600">({userRegion})</span>}
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
          ) : form17List.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      CRN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      First Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
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
                  {form17List.map((form, index) => (
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
              <p className="text-gray-600">No Form 17 Records to Display.</p>
            </div>
          )}

  {showForm247 && (
            < Form247Form17Injury
              irn={selectedIRN} 
              incidentType={selectedIncidentType} 
              onClose={handleCloseForm1} 
              onSubmit={() => console.log('Form 247 submitted')}
              onBack={() => {
                setShowForm247(false);
                console.log('Back to list from Form 247');
              }}
            />
          )}

          {showForm246 && (
            < Form246Form17Death
              irn={selectedIRN} 
              incidentType={selectedIncidentType} 
              onClose={handleCloseForm2} 
              onSubmit={() => console.log('Form 246 submitted')}
              onBack={() => {
                setShowForm246(false);
                console.log('Back to list from Form 246');
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

export default ListForm17;
