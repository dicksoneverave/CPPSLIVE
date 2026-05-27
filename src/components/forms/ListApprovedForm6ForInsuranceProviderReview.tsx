// src/components/forms/ListPendingForm6ForInsuranceProviderReview.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import ApprovedForm6ForInsuranceProviderReview from './ApprovedForm6ForInsuranceProviderReview';

interface ListApprovedForm6ForInsuranceProviderReviewProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: 'Injury' | 'Death') => void;
  onRefreshParent?: () => void;
  onRemovedIRN?: () => void;
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

const ListApprovedForm6ForInsuranceProviderReview: React.FC<ListApprovedForm6ForInsuranceProviderReviewProps> = ({
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
        .from('v_form6_insurance_provider_review_approved')
        .select(
          'IRN, DisplayIRN, WorkerFirstName, WorkerLastName, F6MApprovalDate, IncidentType, OrganizationName, F6MStatus',
          { count: 'exact' }
        )
        .order('F6MApprovalDateFormatted', { ascending: false })
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
            Form 6 Approved – Pending Insurance Provider Review
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
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
                          <button
                            onClick={() => handleView(r.IRN, r.IncidentType)}
                            className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                          >
                            View
                          </button>
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

      {/* Inline modal if no external handler provided */}
      {showPendingForm6 && selectedIRN && (
        <ApprovedForm6ForInsuranceProviderReview
          irn={selectedIRN}
          incidentType={selectedIncidentType}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default ListApprovedForm6ForInsuranceProviderReview;
