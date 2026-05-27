// src/components/forms/ListPendingForm6ForStateSolicitorReview.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import PendingForm6ForStateSolicitorReview from './PendingForm6ForStateSolicitorReview';

interface ListPendingForm6ForStateSolicitorReviewProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: 'Injury' | 'Death') => void;
}

type IncidentType = 'Injury' | 'Death';

interface RowData {
  IRN: number;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  F6MApprovalDate: string | null;
  IncidentType: IncidentType;
  OrganizationName: string;
  F6MStatus: string;
}

const ListPendingForm6ForStateSolicitorReview: React.FC<ListPendingForm6ForStateSolicitorReviewProps> = ({
  onClose,
  onSelectIRN,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<RowData[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(10);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalRecords / recordsPerPage)),
    [totalRecords, recordsPerPage]
  );

  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');

  const [showPendingForm6, setShowPendingForm6] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string>('');
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType>('Injury');
  const [isForwarding, setIsForwarding] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Custom Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState<'single' | 'all'>('single');
  const [pendingIRN, setPendingIRN] = useState<number | null>(null);
  const [pendingDisplayIRN, setPendingDisplayIRN] = useState<string | null>(null);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, recordsPerPage, searchIRN, searchFirstName, searchLastName]);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);

      const start = (currentPage - 1) * recordsPerPage;
      const end = start + recordsPerPage - 1;

      // Build a single query against the VIEW with count + filters + paging
      let query = supabase
        .from('v_form6_state_solicitor_review')
        .select(
          'IRN, DisplayIRN, WorkerFirstName, WorkerLastName, F6MApprovalDate, IncidentType, OrganizationName, F6MStatus',
          { count: 'exact' }
        )
        .order('F6MApprovalDate', { ascending: false })
        .range(start, end);

      if (searchIRN) {
        query = query.ilike('DisplayIRN', `%${searchIRN}%`);
      }
      if (searchFirstName) {
        query = query.ilike('WorkerFirstName', `%${searchFirstName}%`);
      }
      if (searchLastName) {
        query = query.ilike('WorkerLastName', `%${searchLastName}%`);
      }

      const { data, error: viewErr, count } = await query;
      if (viewErr) throw viewErr;

      setRows(data || []);
      setTotalRecords(count || 0);
    } catch (err: any) {
      console.error('Error loading list from view:', err);
      setError(err.message || 'Failed to load list.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = rows; // server-side filtered already

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleView = (irn: number, incidentType: IncidentType) => {
    const irnStr = String(irn);
    if (onSelectIRN) {
      onSelectIRN(irnStr, incidentType);
      return;
    }
    setSelectedIRN(irnStr);
    setSelectedIncidentType(incidentType);
    setShowPendingForm6(true);
  };

  const handleForwardIndividual = (irn: number) => {
    const row = rows.find(r => r.IRN === irn);
    setPendingIRN(irn);
    setPendingDisplayIRN(row?.DisplayIRN || String(irn));
    setConfirmActionType('single');
    setShowConfirmModal(true);
  };

  const handleForwardAll = () => {
    setConfirmActionType('all');
    setShowConfirmModal(true);
  };

  const executeForwarding = async () => {
    try {
      setIsForwarding(true);
      setActionFeedback(null);
      setShowConfirmModal(false);
      
      const submissionDate = new Date().toISOString();
      let irnsToProcess: number[] = [];

      if (confirmActionType === 'single' && pendingIRN) {
        irnsToProcess = [pendingIRN];
      } else if (confirmActionType === 'all') {
        // Fetch all IRNs matching current filters
        let allQuery = supabase
          .from('v_form6_state_solicitor_review')
          .select('IRN');
        
        if (searchIRN) allQuery = allQuery.ilike('DisplayIRN', `%${searchIRN}%`);
        if (searchFirstName) allQuery = allQuery.ilike('WorkerFirstName', `%${searchFirstName}%`);
        if (searchLastName) allQuery = allQuery.ilike('WorkerLastName', `%${searchLastName}%`);

        const { data, error: fetchError } = await allQuery;
        if (fetchError) throw fetchError;

        if (!data || data.length === 0) {
          setActionFeedback({ type: 'error', message: 'No records found to forward.' });
          return;
        }
        irnsToProcess = data.map(d => d.IRN);
      }

      if (irnsToProcess.length === 0) return;

      // 1. Bulk insert into tribunalhearingschedule
      const insertData = irnsToProcess.map(irn => ({
        IRN: irn,
        THSSubmissionDate: submissionDate,
        THSSetForHearing: null,
        THSHearingStatus: 'HearingPending',
        THSHearingType: 'Form6StateSolicitorSumbission',
        THSWorkerOrganizationType: 'Public',
        THSHearingNo: null
      }));

      const { error: bulkInsertError } = await supabase
        .from('tribunalhearingschedule')
        .insert(insertData);

      if (bulkInsertError) throw bulkInsertError;

      // 2. Bulk update form6master
      const { error: bulkUpdateError } = await supabase
        .from('form6master')
        .update({ F6MStatus: 'CompensationAccepted' })
        .in('IRN', irnsToProcess);

      if (bulkUpdateError) throw bulkUpdateError;

      setActionFeedback({ 
        type: 'success', 
        message: irnsToProcess.length === 1 
          ? `Record ${pendingDisplayIRN} forwarded to Tribunal successfully.` 
          : `${irnsToProcess.length} records forwarded to Tribunal successfully.` 
      });
      fetchList();
    } catch (err: any) {
      console.error('Error in executeForwarding:', err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to process forwarding.' });
    } finally {
      setIsForwarding(false);
      setPendingIRN(null);
      setPendingDisplayIRN(null);
    }
  };

  const closeModal = () => {
    setShowPendingForm6(false);
    setSelectedIRN('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Form 6 Approved – Pending State Solicitor Review (State Insurer)
          </h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleForwardAll}
              disabled={isForwarding || rows.length === 0}
              className={`text-sm font-medium bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded shadow-sm disabled:opacity-50 flex items-center`}
            >
              {isForwarding ? 'Processing...' : 'Forward All To Tribunal'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Search */}
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

          {/* Meta */}
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Total Records Found: {totalRecords} | Total Pages: {totalPages}
            </p>
          </div>

          {/* Error/Loading/Table */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {actionFeedback && (
            <div className={`mb-4 p-4 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${
              actionFeedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center">
                <span className="text-sm font-medium">{actionFeedback.message}</span>
              </div>
              <button onClick={() => setActionFeedback(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CRN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      First Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approval Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Incident Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRows.map((r, idx) => {
                    const approvalDate =
                      r.F6MApprovalDate
                        ? new Date(r.F6MApprovalDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : 'N/A';
                    return (
                      <tr key={`${r.IRN}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.OrganizationName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {r.DisplayIRN}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.WorkerFirstName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.WorkerLastName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {approvalDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.IncidentType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleView(r.IRN, r.IncidentType)}
                              className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleForwardIndividual(r.IRN)}
                              disabled={isForwarding}
                              className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded disabled:opacity-50"
                            >
                              ForwardToTribunal
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No Pending Forms For Reviews</p>
            </div>
          )}

          {/* Pagination */}
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

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full mb-4">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {confirmActionType === 'all' ? 'Confirm Batch Forwarding' : 'Confirm Forwarding'}
              </h3>
              <p className="text-sm text-gray-600 mb-8">
                {confirmActionType === 'single' 
                  ? `Are you sure you want to forward record ${pendingDisplayIRN} to Tribunal?`
                  : `Are you sure you want to forward ALL ${totalRecords} pending records to Tribunal?`}
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={executeForwarding}
                  className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary-dark transition-colors"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline modal if no external handler provided */}
      {showPendingForm6 && selectedIRN && (
        <PendingForm6ForStateSolicitorReview
          irn={selectedIRN}
          incidentType={selectedIncidentType}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default ListPendingForm6ForStateSolicitorReview;
