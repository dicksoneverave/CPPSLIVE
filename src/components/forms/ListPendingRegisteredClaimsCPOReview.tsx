import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
// Import specific form components for each incident type
import CPOClaimReviewForm from './110cpoclaimreviewform';       // Specifically for Injury claims
import CPODeathClaimReviewForm from './111cpoclaimreviewform';  // Specifically for Death claims

interface ListPendingRegisteredClaimsCPOReviewProps {
  onClose: () => void;
  onSelectWorker?: (workerId: string, incidentType: string) => void;
}

interface ClaimData {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  SubmissionDate: string;
  IncidentType: string;
  CPORID: string;
  CPORStatus: string;
  LockedByCPOID?: string | null;
  LockedByName?: string | null;
}

const ListPendingRegisteredClaimsCPOReview: React.FC<ListPendingRegisteredClaimsCPOReviewProps> = ({ 
  onClose,
  onSelectWorker 
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimsList, setClaimsList] = useState<ClaimData[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showCPOClaimReviewForm, setShowCPOClaimReviewForm] = useState<boolean>(false);
  const [showCPODeathClaimReviewForm, setShowCPODeathClaimReviewForm] = useState<boolean>(false);
  const [selectedIRN, setSelectedIRN] = useState<string | null>(null);
	const [pendingIncidentType, setPendingIncidentType] = useState<string | null>(null);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [userStaffID, setUserStaffID] = useState<string | null>(null);
	const [openReadOnly, setOpenReadOnly] = useState<boolean>(false);
  const [showLockPrompt, setShowLockPrompt] = useState<boolean>(false);

  useEffect(() => {
    const fetchUserRegion = async () => {
      try {
        if (!profile?.id) {
          console.warn('No profile ID available');
          return;
        }
        
        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('OSMFirstName, OSMLastName, OSMStaffID, InchargeRegion')
          .eq('cppsid', profile.id)
          .maybeSingle();
        
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        
        if (data) {
          setUserRegion(data.InchargeRegion);
          setUserStaffID(data.OSMStaffID ? data.OSMStaffID.toString() : null);
          console.log('User staff ID:', data.OSMStaffID);
        } else {
          console.warn('No region found for user:', profile.id);
          // Default to a region for testing/development
          setUserRegion('Momase Region');
          setUserStaffID('1000');
        }
      } catch (err) {
        console.error('Error fetching user region:', err);
        setError('Failed to fetch region information. Please try again later.');
        // Default to a region for testing/development
        setUserRegion('Momase Region');
        setUserStaffID('1000');
      }
    };
    
    fetchUserRegion();
  }, [profile]);

  useEffect(() => {
    if (userRegion) {
      fetchClaimsList();
    }
  }, [userRegion, currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchClaimsList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!userRegion) {
        setError('Please wait while we load your region information.');
        return;
      }
      
      // Get the count of matching records
      let countQuery = supabase
        .from('pending_cpor_claims')
        .select('*', { count: 'exact', head: true })
        .eq('IncidentRegion', userRegion);

      // Apply search filters if provided
      if (searchIRN) {
        countQuery = countQuery.ilike('DisplayIRN', `%${searchIRN}%`);
      }
      
      if (searchFirstName) {
        countQuery = countQuery.ilike('WorkerFirstName', `%${searchFirstName}%`);
      }
      
      if (searchLastName) {
        countQuery = countQuery.ilike('WorkerLastName', `%${searchLastName}%`);
      }

      const { count, error: countError } = await countQuery;

      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.ceil(totalCount / recordsPerPage));
      
      // Calculate pagination
      const start = (currentPage - 1) * recordsPerPage;
      
      // Get pending_cpor_claims data
      let query = supabase
        .from('pending_cpor_claims')
        .select('*')
        .eq('IncidentRegion', userRegion)
        .range(start, start + recordsPerPage - 1)
        .order('CPORSubmissionDate', { ascending: false });

      // Apply search filters if provided
      if (searchIRN) {
        query = query.ilike('DisplayIRN', `%${searchIRN}%`);
      }
      
      if (searchFirstName) {
        query = query.ilike('WorkerFirstName', `%${searchFirstName}%`);
      }
      
      if (searchLastName) {
        query = query.ilike('WorkerLastName', `%${searchLastName}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        setClaimsList([]);
        return;
      }

      // Get lock information for each claim
      const claimsWithLockInfo = await Promise.all(
        data.map(async (item) => {
          // Get lock information
          const { data: lockData, error: lockError } = await supabase
            .from('approvedclaimscporeview')
            .select('LockedByCPOID')
            .eq('IRN', item.IRN)
            .maybeSingle();

          let lockedByName = null;
          let lockedByCPOID = null;
          
          if (!lockError && lockData && lockData.LockedByCPOID && lockData.LockedByCPOID !== 0) {
            lockedByCPOID = lockData.LockedByCPOID.toString();
            
            // Get the name of the user who locked the record
            const { data: userData, error: userError } = await supabase
              .from('owcstaffmaster')
              .select('OSMFirstName, OSMLastName')
              .eq('OSMStaffID', lockData.LockedByCPOID)
              .maybeSingle();

            if (!userError && userData) {
              lockedByName = `${userData.OSMFirstName} ${userData.OSMLastName}`;
            } else {
              lockedByName = 'Unknown User';
            }
          }

          return {
            ...item,
            LockedByCPOID: lockedByCPOID,
            LockedByName: lockedByName
          };
        })
      );

      setClaimsList(claimsWithLockInfo);
    } catch (err: any) {
      console.error('Error fetching claims list:', err);
      setError(err.message || 'Failed to load claims list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    fetchClaimsList();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

const handleView = (irn: string, incidentType: string, lockedByCPOID: string | null, lockedByName: string | null) => {
  // If locked by another user
  if (lockedByCPOID && lockedByCPOID !== '0' && lockedByCPOID !== userStaffID) {
    alert(`This record is currently being processed by ${lockedByName || 'another user'}.`);
    return;
  }

    // If unlocked (or locked by me), use our custom modal to ask Lock vs Read-only
    const isUnlocked = !lockedByCPOID || lockedByCPOID === '0' || lockedByCPOID === userStaffID;
    setSelectedIRN(irn);
    setPendingIncidentType(incidentType);
    if (isUnlocked) {
      setShowLockPrompt(true);
    } else {
      // fallback (shouldn’t happen because we return above if locked by someone else)
      setOpenReadOnly(false);
      openReviewForm(incidentType);
    }
   };
// Helper to open the appropriate review form using current selectedIRN + openReadOnly
const openReviewForm = (incidentType: string) => {
  if (incidentType.trim() === 'Death') {
    setShowCPODeathClaimReviewForm(true);
    setShowCPOClaimReviewForm(false);
  } else {
    setShowCPOClaimReviewForm(true);
    setShowCPODeathClaimReviewForm(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Calculation Pending List
            {userRegion && <span className="text-sm font-normal ml-2 text-gray-600">({userRegion})</span>}
            {userStaffID && <span className="text-sm font-normal ml-2 text-gray-600">Staff ID: {userStaffID}</span>}
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
          ) : claimsList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      CRN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      First Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      Last Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      Submission Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      Incident Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      Lock Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {claimsList.map((claim, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                        {claim.DisplayIRN}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        {claim.WorkerFirstName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        {claim.WorkerLastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        {claim.CPORSubmissionDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        {claim.IncidentType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        {claim.CPORStatus}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        {claim.LockedByCPOID && claim.LockedByCPOID !== '0' ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            claim.LockedByCPOID === userStaffID 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {claim.LockedByCPOID === userStaffID ? 'Locked by you' : `Locked by ${claim.LockedByName || 'another user'}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Unlocked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border border-gray-300">
                        <button
                          onClick={() => handleView(claim.IRN, claim.IncidentType, claim.LockedByCPOID || null, claim.LockedByName || null)}
                          className={`text-sm font-medium ${
                            claim.LockedByCPOID && claim.LockedByCPOID !== '0' && claim.LockedByCPOID !== userStaffID
                              ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                              : 'bg-primary hover:bg-primary-dark text-white'
                          } px-3 py-1 rounded`}
                          title={claim.LockedByCPOID && claim.LockedByCPOID !== '0' 
                            ? claim.LockedByCPOID === userStaffID 
                              ? "You are currently processing this claim" 
                              : `This claim is being processed by ${claim.LockedByName || 'another user'}`
                            : "View claim details"}
                          disabled={claim.LockedByCPOID && claim.LockedByCPOID !== '0' && claim.LockedByCPOID !== userStaffID}
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
              <p className="text-gray-600">No Pending Forms For Calculation.</p>
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

 {/* Lock vs Read-Only Modal */}
      {showLockPrompt && selectedIRN && pendingIncidentType && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLockPrompt(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Open Claim</h3>
            <p className="text-sm text-gray-700 mb-4">
              Do you want to <span className="font-semibold">lock</span> this record for processing? <br />
              Choosing <span className="font-semibold">Yes</span> will open it in editable mode and lock it to you. <br />
              Choosing <span className="font-semibold">No</span> will open it in read-only mode without locking.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  // No => read-only
                  setOpenReadOnly(true);
                  setShowLockPrompt(false);
                  openReviewForm(pendingIncidentType);
                }}
              >
                No (Read-Only)
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  // Yes => editable (lock will be handled by the child form)
                  setOpenReadOnly(false);
                  setShowLockPrompt(false);
                  openReviewForm(pendingIncidentType);
                }}
              >
                Yes (Lock & Edit)
              </button>
            </div>
          </div>
        </div>
      )}
			
      {/* CPO Claim Review Form Modal */}
      {showCPOClaimReviewForm && selectedIRN && (
        <CPOClaimReviewForm 
          irn={selectedIRN} 
					readOnly={openReadOnly}
          onClose={() => {
            setShowCPOClaimReviewForm(false);
            setSelectedIRN(null);
						setOpenReadOnly(false);
						setPendingIncidentType(null);
            fetchClaimsList(); // Refresh the list after closing
          }}
        />
      )}

      {/* CPO Death Claim Review Form Modal */}
      {showCPODeathClaimReviewForm && selectedIRN && (
        <CPODeathClaimReviewForm 
          irn={selectedIRN} 
						readOnly={openReadOnly}
          onClose={() => {
            setShowCPODeathClaimReviewForm(false);
            setSelectedIRN(null);
					setOpenReadOnly(false);
setPendingIncidentType(null);
            fetchClaimsList(); // Refresh the list after closing
          }}
        />
      )}
    </div>
  );
};

export default ListPendingRegisteredClaimsCPOReview;
