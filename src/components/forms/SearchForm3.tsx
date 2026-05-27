import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import NewForm3 from './NewForm3';
import ViewForm3 from './ViewForm3';
import EditForm3 from './EditForm3'; // ✅ now enabled

interface SearchForm3Props {
  onClose: () => void;
  formType?: 'new' | 'edit' | 'view';
}

type TBStatus = 'Pending' | 'Rejected' | 'OnHold' | 'Approved' | 'In Time' | 'ForwardToTribunal' | string;

interface SearchResult {
  IRN: number;
  WorkerID: number;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  IncidentType: string;
  hasForm3: boolean;
  actionType: 'Proceed' | 'Edit' | 'View';
  actionColor: string;
  // ⬇️ new
  timebarredStatus: TBStatus;
  timebarredBlock: boolean; // true when Proceed must be disabled
}

const normalizeTB = (raw?: string | null): TBStatus => {
  const v = (raw || '').trim();
  if (!v) return 'In Time';
  const up = v.toLowerCase();
  if (up === 'pending') return 'Pending';
  if (up === 'rejected') return 'Rejected';
  if (up === 'onhold' || up === 'keepOnHold'.toLowerCase()) return 'OnHold';
  if (up === 'approved') return 'Approved';
	if (up === 'forwardtotribunal') return 'ForwardToTribunal';
  // pass-through other statuses (e.g., ForwardToTribunal)
  return v;
};

const badgeClass = (status: TBStatus) => {
  switch (status) {
    case 'Pending':
      return 'bg-amber-100 text-amber-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    case 'OnHold':
      return 'bg-gray-100 text-gray-800';
    case 'Approved':
      return 'bg-green-100 text-green-800';
    case 'In Time':
      return 'bg-green-50 text-green-700';
			case 'ForwardToTribunal': return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-blue-50 text-blue-700';
  }
};

const SearchForm3: React.FC<SearchForm3Props> = ({
  onClose,
  formType = 'new'
}) => {
  const [displayCRN, setDisplayCRN] = useState('');
  const [workerID, setWorkerID] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showNotFound, setShowNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewForm3, setShowNewForm3] = useState(false);
  const [showViewForm3, setShowViewForm3] = useState(false);
  const [showEditForm3, setShowEditForm3] = useState(false);

  // ✅ keep IRN numeric end-to-end
  const [selectedIRN, setSelectedIRN] = useState<number | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchTBMap = async (irns: number[]) => {
    if (!irns.length) return new Map<number, TBStatus>();
    const { data, error } = await supabase
      .from('timebarredclaimsregistrarreview')
      .select('IRN, TBCRRReviewStatus')
      .in('IRN', irns);
    if (error) {
      console.warn('timebarred lookup failed:', error);
      return new Map<number, TBStatus>();
    }
    const m = new Map<number, TBStatus>();
    for (const row of data ?? []) {
      m.set(row.IRN, normalizeTB(row.TBCRRReviewStatus));
    }
    return m;
  };

  const buildRows = async (
    form1112Data: Array<{ IRN: number; WorkerID: number; DisplayIRN: string; IncidentType: string }>,
    workerData: Array<{ WorkerID: number; WorkerFirstName: string; WorkerLastName: string }>,
  ) => {
    const irns = form1112Data.map(i => i.IRN);
    const { data: form3Data, error: form3Error } = await supabase
      .from('form3master')
      .select('IRN, WorkerID')
      .in('IRN', irns);
    if (form3Error) throw form3Error;

    const form3IRNs = new Set(form3Data?.map(f => f.IRN) || []);

    // ⬇️ get timebarred statuses
    const tbMap = await fetchTBMap(irns);

    return form1112Data.map(item => {
      const worker = workerData?.find(w => w.WorkerID === item.WorkerID);
      const hasForm3 = form3IRNs.has(item.IRN);

      let actionType: 'Proceed' | 'Edit' | 'View';
      let actionColor: string;

      if (formType === 'new') {
        actionType = hasForm3 ? 'View' : 'Proceed';
        actionColor = hasForm3 ? 'text-blue-600' : 'text-green-600';
      } else if (formType === 'edit') {
        actionType = hasForm3 ? 'Edit' : 'Proceed';
        actionColor = hasForm3 ? 'text-blue-600' : 'text-green-600';
      } else {
        actionType = hasForm3 ? 'View' : 'Proceed';
        actionColor = hasForm3 ? 'text-red-800' : 'text-green-600';
      }

      const tbStatus = tbMap.get(item.IRN) ?? 'In Time';
      const timebarredBlock = ['Pending', 'Rejected', 'OnHold', 'ForwardToTribunal'].includes(tbStatus);

      return {
        IRN: item.IRN,
        WorkerID: item.WorkerID,
        DisplayIRN: item.DisplayIRN,
        WorkerFirstName: worker?.WorkerFirstName || 'N/A',
        WorkerLastName: worker?.WorkerLastName || 'N/A',
        IncidentType: item.IncidentType,
        hasForm3,
        actionType,
        actionColor,
        timebarredStatus: tbStatus,
        timebarredBlock,
      } as SearchResult;
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowNotFound(false);
    setSearchResults([]);
    setCurrentPage(1);

    if (!displayCRN && !workerID && !firstName && !lastName) {
      setError('Please enter at least one search criteria');
      return;
    }

    try {
      setLoading(true);
      let results: SearchResult[] = [];

      // Search by DisplayCRN or WorkerID
      if (displayCRN || workerID) {
        let query = supabase
          .from('form1112master')
          .select('IRN, WorkerID, DisplayIRN, IncidentType')
          .eq('IncidentType', 'Injury');

        if (displayCRN) {
          query = query.eq('DisplayIRN', displayCRN);
        } else if (workerID) {
          query = query.eq('WorkerID', workerID);
        }

        const { data: form1112Data, error: form1112Error } = await query;
        if (form1112Error) throw form1112Error;

        if (form1112Data && form1112Data.length > 0) {
          const workerIds = form1112Data.map(item => item.WorkerID);
          const { data: workerData, error: workerError } = await supabase
            .from('workerpersonaldetails')
            .select('WorkerID, WorkerFirstName, WorkerLastName')
            .in('WorkerID', workerIds);
          if (workerError) throw workerError;

          results = await buildRows(form1112Data, workerData ?? []);
        }
      }
      // Search by First/Last Name
      else if (firstName || lastName) {
        let workerQuery = supabase
          .from('workerpersonaldetails')
          .select('WorkerID, WorkerFirstName, WorkerLastName');

        if (firstName && lastName) {
          workerQuery = workerQuery
            .ilike('WorkerFirstName', `%${firstName}%`)
            .ilike('WorkerLastName', `%${lastName}%`);
        } else if (firstName) {
          workerQuery = workerQuery.ilike('WorkerFirstName', `%${firstName}%`);
        } else if (lastName) {
          workerQuery = workerQuery.ilike('WorkerLastName', `%${lastName}%`);
        }

        const { data: workerData, error: workerError } = await workerQuery;
        if (workerError) throw workerError;

        if (workerData && workerData.length > 0) {
          const workerIds = workerData.map(w => w.WorkerID);
          const { data: form1112Data, error: form1112Error } = await supabase
            .from('form1112master')
            .select('IRN, WorkerID, DisplayIRN, IncidentType')
            .in('WorkerID', workerIds)
            .eq('IncidentType', 'Injury');
          if (form1112Error) throw form1112Error;

          if (form1112Data && form1112Data.length > 0) {
            results = await buildRows(form1112Data, workerData ?? []);
          }
        }
      }

      if (results.length === 0) {
        setShowNotFound(true);
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Error searching for workers:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setDisplayCRN('');
    setWorkerID('');
    setFirstName('');
    setLastName('');
    setSearchResults([]);
    setShowNotFound(false);
    setError(null);
    setCurrentPage(1);
  };

  const resetFlags = () => {
    setShowNewForm3(false);
    setShowViewForm3(false);
    setShowEditForm3(false);
  };

  const handleAction = (result: SearchResult) => {
    resetFlags();
    setSelectedIRN(result.IRN);

    if (result.actionType === 'Proceed' || (formType === 'new' && !result.hasForm3)) {
      setShowNewForm3(true);
    } else if (result.actionType === 'Edit' && formType === 'edit') {
      if (result.hasForm3) setShowEditForm3(true);
    } else if (result.actionType === 'View' || formType === 'view') {
      if (result.hasForm3) setShowViewForm3(true);
    }
  };

  // Pagination
  const totalPages = Math.ceil(searchResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = searchResults.slice(startIndex, endIndex);

  // New Form 3
  if (showNewForm3 && selectedIRN != null) {
    const selectedRow = searchResults.find(r => r.IRN === selectedIRN);
    return (
      <NewForm3
        irn={selectedIRN}
        workerId={selectedRow?.WorkerID}
        onClose={() => {
          setShowNewForm3(false);
          setSelectedIRN(null);
          onClose();
        }}
      />
    );
  }

  // View Form 3
  if (showViewForm3 && selectedIRN != null) {
    return (
      <ViewForm3
        workerIRN={selectedIRN}
        onClose={() => {
          setShowViewForm3(false);
          setSelectedIRN(null);
          onClose();
        }}
      />
    );
  }

  // ✅ Edit Form 3
  if (showEditForm3 && selectedIRN != null) {
    return (
      <EditForm3
        workerIRN={selectedIRN}
        onClose={() => {
          setShowEditForm3(false);
          setSelectedIRN(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Search Workers - Form 3 ({formType === 'new' ? 'New' : formType === 'view' ? 'View' : 'Edit'})
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
                <label htmlFor="displayCRN" className="block text-sm font-medium text-gray-700 mb-1">
                  Display CRN
                </label>
                <input
                  type="text"
                  id="displayCRN"
                  value={displayCRN}
                  onChange={(e) => setDisplayCRN(e.target.value)}
                  className="input"
                  placeholder="Enter Display CRN"
                />
              </div>

              <div>
                <label htmlFor="workerID" className="block text-sm font-medium text-gray-700 mb-1">
                  Worker ID
                </label>
                <input
                  type="text"
                  id="workerID"
                  value={workerID}
                  onChange={(e) => setWorkerID(e.target.value)}
                  className="input"
                  placeholder="Enter Worker ID"
                />
              </div>
            </div>

            <div className="text-center text-sm text-gray-500">OR</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input"
                  placeholder="Enter last name"
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
                            Display CRN
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Worker ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            First Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Last Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Incident Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Form 3 Status
                          </th>
                          {/* ⬇️ NEW: Timebarred column */}
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Timebarred
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentResults.map((result, index) => {
                          const disableProceed =
                            (result.actionType === 'Proceed' && result.timebarredBlock) ||
                            (formType === 'edit' && !result.hasForm3);

                          return (
                            <tr key={`${result.IRN}-${index}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.DisplayIRN}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.WorkerID}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.WorkerFirstName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.WorkerLastName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.IncidentType}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    result.hasForm3 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {result.hasForm3 ? 'Exists' : 'Not Created'}
                                </span>
                              </td>
                              {/* ⬇️ NEW: Timebarred badge */}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass(result.timebarredStatus)}`}
                                >
                                  {result.timebarredStatus}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleAction(result)}
                                  className={`font-medium text-sm ${result.actionColor} hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed`}
                                  disabled={disableProceed}
                                >
                                  {result.actionType}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
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
                  No injury cases found matching your search criteria.
                </p>
                <p className="text-sm text-gray-500">
                  Try adjusting your search terms or check if the worker has an injury incident registered.
                </p>
              </div>
            )}
          </div>

          {/* Form Type Information */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">
              Search Mode: {formType.charAt(0).toUpperCase() + formType.slice(1)}
            </h4>
            <p className="text-sm text-gray-600">
              {formType === 'new' && 'Search for injury cases to create new Form 3 applications or view existing ones.'}
              {formType === 'edit' && 'Search for injury cases with existing Form 3 to edit them.'}
              {formType === 'view' && 'Search for injury cases with existing Form 3 to view them.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-1"></div>
                <span className="text-green-600">Proceed - No Form 3 exists</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded mr-1"></div>
                <span className="text-blue-600">Edit/View - Form 3 exists</span>
              </div>
              {formType === 'view' && (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-100 border border-red-300 rounded mr-1"></div>
                  <span className="text-red-800">View - Form 3 exists</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchForm3;
