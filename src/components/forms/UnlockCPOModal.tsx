import React, { useState } from 'react';
import { X, Search, Lock, Unlock, AlertCircle, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface UnlockCPOModalProps {
  onClose: () => void;
}

interface WorkerIRNRecord {
  IRN: number;
  DisplayIRN: string;
  FirstName: string;
  LastName: string;
}

interface CPOReviewDetails {
  IRN: number;
  IncidentType: string;
  CPORStatus: string;
  CPORSubmissionDate: string | null;
  LockedByCPOID: number | null;
}

interface StaffDetails {
  OSMFirstName: string;
  OSMLastName: string;
  InchargeRegion: string;
}

const UnlockCPOModal: React.FC<UnlockCPOModalProps> = ({ onClose }) => {
  // Search state
  const [searchCRN, setSearchCRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchResults, setSearchResults] = useState<WorkerIRNRecord[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected Record details
  const [selectedIRN, setSelectedIRN] = useState<number | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerIRNRecord | null>(null);
  const [reviewDetails, setReviewDetails] = useState<CPOReviewDetails | null>(null);
  const [staffDetails, setStaffDetails] = useState<StaffDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Confirmation/Unlock state
  const [showConfirmUnlock, setShowConfirmUnlock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setSearchResults([]);
    setHasSearched(false);

    if (!searchCRN.trim() && !searchFirstName.trim() && !searchLastName.trim()) {
      setSearchError('Please enter at least one search criterion (CRN, First Name, or Last Name).');
      return;
    }

    try {
      setLoadingSearch(true);
      let query = supabase
        .from('workerirn')
        .select('IRN, DisplayIRN, FirstName, LastName');

      if (searchCRN.trim()) {
        query = query.ilike('DisplayIRN', `%${searchCRN.trim()}%`);
      }
      if (searchFirstName.trim()) {
        query = query.ilike('FirstName', `%${searchFirstName.trim()}%`);
      }
      if (searchLastName.trim()) {
        query = query.ilike('LastName', `%${searchLastName.trim()}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setSearchResults(data || []);
      setHasSearched(true);
    } catch (err: any) {
      console.error('Error searching workerirn:', err);
      setSearchError(err.message || 'An error occurred while searching.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleClearSearch = () => {
    setSearchCRN('');
    setSearchFirstName('');
    setSearchLastName('');
    setSearchResults([]);
    setSearchError(null);
    setHasSearched(false);
  };

  const handleSelectRecord = async (worker: WorkerIRNRecord) => {
    setSelectedIRN(worker.IRN);
    setSelectedWorker(worker);
    setReviewDetails(null);
    setStaffDetails(null);
    setDetailsError(null);
    setShowConfirmUnlock(false);
    setUnlockSuccess(false);

    try {
      setLoadingDetails(true);
      
      // Step 2: Look up IRN in approvedclaimscporeview
      const { data: cporData, error: cporError } = await supabase
        .from('approvedclaimscporeview')
        .select('IRN, IncidentType, CPORStatus, CPORSubmissionDate, LockedByCPOID')
        .eq('IRN', worker.IRN)
        .maybeSingle();

      if (cporError) throw cporError;

      if (!cporData) {
        setDetailsError(`No CPO review record found for claim IRN: ${worker.DisplayIRN} (${worker.IRN})`);
        return;
      }

      setReviewDetails(cporData);

      // Step 3: Check if LockedByCPOID is non-zero and look up staff details
      if (cporData.LockedByCPOID && cporData.LockedByCPOID !== 0) {
        const { data: staffData, error: staffError } = await supabase
          .from('owcstaffmaster')
          .select('OSMFirstName, OSMLastName, InchargeRegion')
          .eq('OSMStaffID', cporData.LockedByCPOID)
          .maybeSingle();

        if (staffError) {
          console.error('Error fetching staff details:', staffError);
        } else if (staffData) {
          setStaffDetails(staffData);
        }
      }
    } catch (err: any) {
      console.error('Error loading claim details:', err);
      setDetailsError(err.message || 'Failed to load CPO review details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUnlockClick = () => {
    setShowConfirmUnlock(true);
  };

  const handleProceedUnlock = async () => {
    if (!selectedIRN) return;

    try {
      setUnlocking(true);
      // Step 4: Proceed with setting LockedByCPOID to 0
      const { error } = await supabase
        .from('approvedclaimscporeview')
        .update({ LockedByCPOID: 0 })
        .eq('IRN', selectedIRN);

      if (error) throw error;

      setUnlockSuccess(true);
      setShowConfirmUnlock(false);

      // Reload claim details to reflect the unlocked status
      if (selectedWorker) {
        await handleSelectRecord(selectedWorker);
      }
    } catch (err: any) {
      console.error('Error unlocking claim:', err);
      alert(err.message || 'Failed to unlock the claim. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const staffName = staffDetails 
    ? `${staffDetails.OSMFirstName} ${staffDetails.OSMLastName}`
    : `Staff ID ${reviewDetails?.LockedByCPOID || 'Unknown'}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-red-900 to-[#8B2500] text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Unlock className="h-6 w-6 text-amber-400" />
            Search claim to Unlock
          </h2>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
            id="btn-close-unlock-modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6 min-h-0 bg-gray-50/50">
          
          {/* Left Panel: Search & Results */}
          <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-[#8B2500]" />
              Find Worker Claim
            </h3>
            
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="searchCRN" className="block text-xs font-semibold text-gray-600 mb-1">
                    CRN (Display IRN)
                  </label>
                  <input
                    type="text"
                    id="searchCRN"
                    value={searchCRN}
                    onChange={(e) => setSearchCRN(e.target.value)}
                    className="input text-sm"
                    placeholder="Enter CRN"
                  />
                </div>
                <div>
                  <label htmlFor="searchFirstName" className="block text-xs font-semibold text-gray-600 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="searchFirstName"
                    value={searchFirstName}
                    onChange={(e) => setSearchFirstName(e.target.value)}
                    className="input text-sm"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label htmlFor="searchLastName" className="block text-xs font-semibold text-gray-600 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="searchLastName"
                    value={searchLastName}
                    onChange={(e) => setSearchLastName(e.target.value)}
                    className="input text-sm"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              {searchError && (
                <div className="text-xs text-red-600 flex items-center gap-1.5 bg-red-50 p-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  id="btn-clear-unlock-search"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={loadingSearch}
                  className="btn btn-primary flex items-center gap-1.5 shadow-sm text-sm"
                  id="btn-submit-unlock-search"
                >
                  {loadingSearch ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-1"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </form>

            <hr className="my-4 border-gray-100" />

            {/* Results table */}
            <div className="flex-1 overflow-y-auto max-h-[300px] md:max-h-[none]">
              {loadingSearch ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-3"></div>
                  <span className="text-sm">Fetching matching records...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CRN</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Worker Name</th>
                        <th scope="col" className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {searchResults.map((row) => (
                        <tr 
                          key={row.IRN} 
                          className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${selectedIRN === row.IRN ? 'bg-orange-50/40' : ''}`}
                          onClick={() => handleSelectRecord(row)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{row.DisplayIRN}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.FirstName} {row.LastName}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRecord(row);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                selectedIRN === row.IRN
                                  ? 'bg-[#8B2500] text-white'
                                  : 'bg-gray-100 text-[#8B2500] hover:bg-[#8B2500] hover:text-white'
                              }`}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : hasSearched ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm">No matching records found.</p>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">Enter search parameters above to locate a claim.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Claim Details & Unlock */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#8B2500]" />
              Claim Status Details
            </h3>

            {loadingDetails ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-3"></div>
                <span className="text-sm">Loading details...</span>
              </div>
            ) : reviewDetails ? (
              <div className="flex-1 flex flex-col justify-between">
                
                {/* Details layout */}
                <div className="space-y-4">
                  
                  {/* Worker display name & CRN header card */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="text-xs font-semibold text-gray-500">Selected Claim</div>
                    <div className="text-base font-bold text-gray-800">{selectedWorker?.FirstName} {selectedWorker?.LastName}</div>
                    <div className="text-sm font-semibold text-[#8B2500] mt-0.5">CRN: {selectedWorker?.DisplayIRN}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="block text-xs font-semibold text-gray-500">Incident Type</span>
                      <span className="font-semibold text-gray-800">{reviewDetails.IncidentType || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-gray-500">CPO Review Status</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mt-0.5">
                        {reviewDetails.CPORStatus || 'Pending'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-xs font-semibold text-gray-500">CPO Submission Date</span>
                      <span className="font-semibold text-gray-800">{formatDate(reviewDetails.CPORSubmissionDate)}</span>
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Lock status section */}
                  <div>
                    <span className="block text-xs font-semibold text-gray-500 mb-2">Current Lock Status</span>
                    {reviewDetails.LockedByCPOID && reviewDetails.LockedByCPOID !== 0 ? (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-pulse-once">
                        <Lock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-bold text-red-800">Locked</div>
                          <div className="text-xs text-red-700 mt-1 space-y-1">
                            <p><strong>Locked By Staff ID:</strong> {reviewDetails.LockedByCPOID}</p>
                            {staffDetails ? (
                              <>
                                <p><strong>Staff Name:</strong> {staffDetails.OSMFirstName} {staffDetails.OSMLastName}</p>
                                <p><strong>Region:</strong> {staffDetails.InchargeRegion}</p>
                              </>
                            ) : (
                              <p className="italic">Staff details not found in staff master.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
                        <Unlock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-bold text-green-800">Unlocked</div>
                          <div className="text-xs text-green-700 mt-0.5">
                            This claim is not currently locked by any Provincial Claims Officer.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom button controls */}
                <div className="pt-6 border-t border-gray-100 mt-6 flex justify-end">
                  {reviewDetails.LockedByCPOID && reviewDetails.LockedByCPOID !== 0 ? (
                    <button
                      onClick={handleUnlockClick}
                      disabled={unlocking}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                      id="btn-unlock-claim"
                    >
                      <Unlock className="h-4 w-4" />
                      Unlock Claim
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-6 py-2.5 bg-gray-100 text-gray-400 rounded-lg text-sm font-bold cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Unlock className="h-4 w-4" />
                      Claim is Unlocked
                    </button>
                  )}
                </div>
              </div>
            ) : detailsError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-amber-50/50 rounded-xl border border-amber-200">
                <AlertCircle className="h-8 w-8 text-amber-600 mb-2" />
                <p className="text-sm text-center text-amber-800 font-semibold">{detailsError}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-300 text-gray-400">
                <p className="text-sm text-center">Select a claim from the search results to view details and locking status.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmUnlock && reviewDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2 bg-red-50 rounded-full">
                <Lock className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Unlock Confirmation</h3>
            </div>
            
            <p className="text-sm text-gray-700 leading-relaxed mb-6">
              This will unlock the claim from <span className="font-bold text-gray-900">'{staffName}'</span>. Proceed?
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmUnlock(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                id="btn-confirm-unlock-back"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleProceedUnlock}
                disabled={unlocking}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all"
                id="btn-confirm-unlock-proceed"
              >
                {unlocking ? 'Unlocking...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification for Success */}
      {unlockSuccess && (
        <div className="fixed bottom-5 right-5 z-[70] bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-1 bg-white/20 rounded-full">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold">Success</div>
            <div className="text-xs text-white/90">Claim has been successfully unlocked.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnlockCPOModal;
