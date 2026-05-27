import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

// ✅ Read-only overlays for Approved lists
import Decision224ChiefCommissionerApprovedInjury from './224DecisionChiefCommissionerApprovedInjury';
import Decision225ChiefCommissionerApprovedDeath from './225DecisionChiefCommissionerApprovedDeath';

interface ListApproveClaimsForCommissionerReviewProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: string) => void;
}

interface ClaimData {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  SubmissionDate: string;
  IncidentType: string;
  CACRID: string;
}

type LockInfo = { id: number | null; name: string };

const ListApproveClaimsForCommissionerReview: React.FC<ListApproveClaimsForCommissionerReviewProps> = ({
  onClose,
  onSelectIRN
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

  // My staff ID (for "Locked by you")
  const [myStaffId, setMyStaffId] = useState<number | null>(null);

  // Lock info per IRN
  const [locks, setLocks] = useState<Record<string, LockInfo>>({});

  // Overlays
  const [selectedIRN, setSelectedIRN] = useState('');
  const [show224, setShow224] = useState(false); // Injury
  const [show225, setShow225] = useState(false); // Death

  // Load my staff id
  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID')
        .eq('cppsid', profile.id)
        .maybeSingle();
      if (!error && data?.OSMStaffID) {
        setMyStaffId(Number(data.OSMStaffID));
      }
    })();
  }, [profile?.id]);

  useEffect(() => {
    fetchClaimsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchLocks = async (irns: string[]) => {
    try {
      if (!irns.length) {
        setLocks({});
        return;
      }

      // 1) IRN -> LockedByID
      const { data: lockRows, error: lockErr } = await supabase
        .from('claimsawardedcommissionersreview')
        .select('IRN, LockedByID')
        .in('IRN', irns);
      if (lockErr) throw lockErr;

      const ids = Array.from(
        new Set((lockRows || []).map((r: any) => r.LockedByID).filter((v: any) => v != null))
      ) as number[];

      // 2) Staff names for those IDs
      let nameMap: Record<number, string> = {};
      if (ids.length) {
        const { data: staffRows } = await supabase
          .from('owcstaffmaster')
          .select('OSMStaffID, OSMFirstName, OSMLastName')
          .in('OSMStaffID', ids);
        (staffRows || []).forEach((s: any) => {
          const nm = `${s.OSMFirstName ?? ''} ${s.OSMLastName ?? ''}`.trim();
          nameMap[Number(s.OSMStaffID)] = nm || `User ${s.OSMStaffID}`;
        });
      }

      // 3) Build IRN -> lock info
      const map: Record<string, LockInfo> = {};
      (lockRows || []).forEach((r: any) => {
        const id = r.LockedByID != null ? Number(r.LockedByID) : null;
        map[String(r.IRN)] = { id, name: id ? (nameMap[id] || `User ${id}`) : '' };
      });
      setLocks(map);
    } catch (e) {
      console.error('fetchLocks error:', e);
      setLocks({});
    }
  };

  const fetchClaimsList = async () => {
    try {
      setLoading(true);
      setError(null);

      // Count
      let countQuery = supabase
        .from('commissioner_approved_view')
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

      // Data
      let query = supabase
        .from('commissioner_approved_view')
        .select('*')
        .range(start, start + recordsPerPage - 1)
        .order('SubmissionDateFormatted', { ascending: false });

      if (searchIRN) query = query.ilike('DisplayIRN', `%${searchIRN}%`);
      if (searchFirstName) query = query.ilike('WorkerFirstName', `%${searchFirstName}%`);
      if (searchLastName) query = query.ilike('WorkerLastName', `%${searchLastName}%`);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setClaimsList([]);
        setLocks({});
        return;
      }

      const formattedData = data.map((item: any) => ({
        IRN: String(item.IRN),
        DisplayIRN: item.DisplayIRN,
        WorkerFirstName: item.WorkerFirstName,
        WorkerLastName: item.WorkerLastName,
        SubmissionDate: item.SubmissionDate,
        IncidentType: item.IncidentType,
        CACRID: item.CACRID
      })) as ClaimData[];

      setClaimsList(formattedData);
      await fetchLocks(formattedData.map(d => d.IRN));
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

  // Open read-only overlay (no lock enforcement; just display)
  const handleView = (irn: string, incidentType: string) => {
    if (onSelectIRN) {
      onSelectIRN(irn, incidentType);
      return;
    }
    setSelectedIRN(irn);
    if (incidentType === 'Injury') setShow224(true);
    else if (incidentType === 'Death') setShow225(true);
  };

  const handleCloseOverlay = () => {
    setShow224(false);
    setShow225(false);
    setSelectedIRN('');
    // Optional: refresh lock badges
    fetchLocks(claimsList.map(c => c.IRN));
  };

  // Badge renderer (informational only)
  const renderLockBadge = (irn: string) => {
    const info = locks[irn];
    if (!info || !info.id) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
          Unlocked
        </span>
      );
    }
    if (myStaffId && info.id === myStaffId) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
          Locked by you
        </span>
      );
    }
    const isChief = info.id === 2811;
    const isCommissioner = info.id === 2812;
    const text = isChief
      ? 'Locked by Chief Commissioner'
      : isCommissioner
      ? 'Locked by Commissioner'
      : `Locked by ${info.name}`;
    const color =
      isChief
        ? 'bg-purple-100 text-purple-800'
        : isCommissioner
        ? 'bg-blue-100 text-blue-800'
        : 'bg-amber-100 text-amber-800';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${color}`}>
        {text}
      </span>
    );
  };

  const handlePageChange = (page: number) => setCurrentPage(page);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Commissioner Review Approved
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
                    {/* NEW: Lock */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lock</th>
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
                      {/* Badge */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {renderLockBadge(claim.IRN)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleView(claim.IRN, claim.IncidentType)}
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

          {/* Overlays */}
          {show224 && (
            <Decision224ChiefCommissionerApprovedInjury
              IRN={selectedIRN}
              onCloseAll={handleCloseOverlay}
            />
          )}
          {show225 && (
            <Decision225ChiefCommissionerApprovedDeath
              IRN={selectedIRN}
              onCloseAll={handleCloseOverlay}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <>
                    <button onClick={() => handlePageChange(1)} className="px-3 py-1 border rounded text-sm">First</button>
                    <button onClick={() => handlePageChange(currentPage - 1)} className="px-3 py-1 border rounded text-sm">Previous</button>
                  </>
                )}

                {currentPage < totalPages && (
                  <>
                    <button onClick={() => handlePageChange(currentPage + 1)} className="px-3 py-1 border rounded text-sm">Next</button>
                    <button onClick={() => handlePageChange(totalPages)} className="px-3 py-1 border rounded text-sm">Last</button>
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

export default ListApproveClaimsForCommissionerReview;
