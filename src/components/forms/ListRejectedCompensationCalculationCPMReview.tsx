import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

// ⬇️ make sure this path is correct for your project
import RejectedRegisteredClaimsRegistrarReview from '../forms/RejectedRegisteredClaimsRegistrarReview';

interface ListRejectedRegisteredClaimsRegistrarReviewProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, rrid: string, incidentType: string) => void;
}

interface ClaimData {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  SubmissionDate: string;
  IncidentType: string;
  RRID: string;
  RRStatus: string;
}

const ListRejectedRegisteredClaimsRegistrarReview: React.FC<ListRejectedRegisteredClaimsRegistrarReviewProps> = ({
  onClose,
  onSelectIRN,
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

  // Local state to open the embedded registrar review form
  const [selectedIRN, setSelectedIRN] = useState<string | number | null>(null);
  const [selectedIncidentType, setSelectedIncidentType] = useState<'Injury' | 'Death' | null>(null);

  useEffect(() => {
    fetchClaimsList();
  }, [currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchClaimsList = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the registrar_approved_view for a cleaner query
      let countQuery = supabase
        .from('registrar_rejected_view')
        .select('*', { count: 'exact', head: true });

      if (searchIRN) countQuery = countQuery.ilike('DisplayIRN', `%${searchIRN}%`);
      if (searchFirstName) countQuery = countQuery.ilike('WorkerFirstName', `%${searchFirstName}%`);
      if (searchLastName) countQuery = countQuery.ilike('WorkerLastName', `%${searchLastName}%`);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.ceil(totalCount / recordsPerPage));

      const start = (currentPage - 1) * recordsPerPage;

      let query = supabase
        .from('registrar_rejected_view')
        .select('*')
        .range(start, start + recordsPerPage - 1)
        .order('SubmissionDateFormatted', { ascending: false });

      if (searchIRN) query = query.ilike('DisplayIRN', `%${searchIRN}%`);
      if (searchFirstName) query = query.ilike('WorkerFirstName', `%${searchFirstName}%`);
      if (searchLastName) query = query.ilike('WorkerLastName', `%${searchLastName}%`);

      const { data, error } = await query;
      if (error) throw error;

      setClaimsList(data ?? []);
    } catch (err: any) {
      console.error('Error fetching claims list:', err);
      setError(err.message || 'Failed to load claims list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchClaimsList();
  };

  // ✅ this is the handler you defined — use this name in the button below
  const handleReview = (irn: string, rrid: string, incidentType: string) => {
    const normalizedIncident: 'Injury' | 'Death' = incidentType === 'Injury' ? 'Injury' : 'Death';
    setSelectedIRN(irn);
    setSelectedIncidentType(normalizedIncident);

    if (onSelectIRN) {
      onSelectIRN(irn, rrid, incidentType);
    }
  };

  // ✅ define page change handler (used in pagination)
  const handlePageChange = (page: number) => setCurrentPage(page);

  // ✅ define close handler for the embedded modal
  const closeEmbeddedReview = () => {
    setSelectedIRN(null);
    setSelectedIncidentType(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Rejected Registered Claims</h2>
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

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Total Records Found: {totalRecords} | Total Pages: {totalPages}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incident Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {claimsList.map((claim, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{claim.DisplayIRN}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{claim.WorkerFirstName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{claim.WorkerLastName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{claim.SubmissionDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{claim.IncidentType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{claim.RRStatus}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          // ⬇️ renamed to handleReview (the function that actually exists)
                          onClick={() => handleReview(claim.IRN, claim.RRID, claim.IncidentType)}
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
              <p className="text-gray-600">No Approved Forms For Review.</p>
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

        {/* Embedded Registrar Review Modal */}
        {selectedIRN !== null && selectedIncidentType !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h3 className="text-lg font-semibold">Registrar Review</h3>
                <button onClick={closeEmbeddedReview} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <RejectedRegisteredClaimsRegistrarReview
                  irn={selectedIRN}
                  incidentType={selectedIncidentType}
                  onClose={closeEmbeddedReview}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListRejectedRegisteredClaimsRegistrarReview;
