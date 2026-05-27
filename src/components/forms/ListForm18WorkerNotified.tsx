import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import PendingForm18WorkerResponseToNotification from './PendingForm18WorkerResponseToNotification';
import Logo from '../common/Logo';

interface ListForm18WorkerNotifiedProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: string) => void;
  region?: string;
  isRegionalized?: boolean;
  onlyTribunal?: boolean;
}

interface ViewRow {
  IRN: string | number;
  DisplayIRN: string | null;
  WorkerFirstName: string | null;
  WorkerLastName: string | null;
  IncidentType: string | null;
  F18MID?: string | number | null;
  F18MStatus: string | null;
  IncidentRegion?: string | null;
}

interface F18DateRow {
  IRN: string | number;
  F18MWorkerNotifiedDate: string | null;
}

interface Form18Data {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerNotifiedDate: string; // <-- this is what we render in the table
  IncidentType: string;
  F18MID: string | number | null;
  Status: string;
}

const RECORDS_PER_PAGE = 10;

const ListForm18WorkerNotified: React.FC<ListForm18WorkerNotifiedProps> = ({
  onClose,
  onSelectIRN,
  region,
  isRegionalized = true,
  onlyTribunal = false
}) => {
  const { profile, group } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form18List, setForm18List] = useState<Form18Data[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');

  const [currentPage, setCurrentPage] = useState(1);

  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [groupID, setGroupID] = useState<number | null>(null);

  const [selectedIRN, setSelectedIRN] = useState('');
  const [selectedIncidentType, setSelectedIncidentType] = useState<'Injury' | 'Death'>('Injury');
  const [showForm142, setShowForm142] = useState(false);

  // region
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

        if (!profile?.id) return;

        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('InchargeRegion')
          .eq('cppsid', profile.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.InchargeRegion) {
          setUserRegion(data.InchargeRegion);
        } else {
          setUserRegion('Momase Region');
        }

        if (group) setGroupID(group.id);
      } catch (err: any) {
        console.error('Error fetching user region:', err);
        setError('Failed to fetch region information. Please try again later.');
        setUserRegion('Momase Region');
      }
    };

    fetchUserRegion();
  }, [profile, group, region, isRegionalized]);

  useEffect(() => {
    if (userRegion) {
      fetchForm18List();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRegion, currentPage, searchIRN, searchFirstName, searchLastName]);

  // apply the exact same filters to count + data queries
  const applyCommonFilters = (qb: any) => {
    let q = qb.eq('F18MStatus', 'NotifiedToWorker');

    if (isRegionalized && userRegion && userRegion !== 'All Regions') {
      q = q.eq('IncidentRegion', userRegion);
    }

    return q;
  };

  const fetchForm18List = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userRegion) {
        setError('Please wait while we load your region information.');
        return;
      }

      // ---------- TRIBUNAL FILTER ----------
      let tribunalIRNs: string[] | null = null;
      if (onlyTribunal) {
        const { data: thoData } = await supabase
          .from('tribunalhearingoutcome')
          .select('THOIRN')
          .eq('THODecision', 'Approved')
          .eq('THOHearingStatus', 'Processed');
        
        tribunalIRNs = thoData?.map(d => d.THOIRN) || [];
        if (tribunalIRNs.length === 0) {
          setForm18List([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }

      // ---------- COUNT ----------
      let countQ = supabase
        .from('v_form18_joined')
        .select('IRN', { count: 'exact', head: true });
      countQ = applyCommonFilters(countQ);
      if (tribunalIRNs) {
        countQ = countQ.in('IRN', tribunalIRNs);
      }

      const { count, error: countError } = await countQ;
      if (countError) throw countError;

      const totalCount = count ?? 0;
      setTotalRecords(totalCount);
      const pages = Math.max(1, Math.ceil(totalCount / RECORDS_PER_PAGE));
      setTotalPages(pages);
      if (currentPage > pages) {
        setCurrentPage(1);
        return; // will re-fire useEffect
      }

      // ---------- PAGE DATA (from the VIEW) ----------
      const start = (currentPage - 1) * RECORDS_PER_PAGE;
      const end = start + RECORDS_PER_PAGE - 1;

      let dataQ = supabase
        .from('v_form18_joined')
        .select('*');
      dataQ = applyCommonFilters(dataQ);
      if (tribunalIRNs) {
        dataQ = dataQ.in('IRN', tribunalIRNs);
      }

      const { data: rows, error: dataError } = await dataQ
        .order('IRN', { ascending: false })
        .range(start, end) as {
        data: ViewRow[] | null;
        error: any;
      };
      if (dataError) throw dataError;

      const pageRows = rows ?? [];
      const pageIRNs = pageRows.map((r) => r.IRN).filter(Boolean);

      // ---------- OPTIONAL: fallback to base table if view lacks date ----------
      let dateMap = new Map<string, string | null>();
      if (pageIRNs.length > 0) {
        const { data: dateRows, error: dateErr } = await supabase
          .from('form18master')
          .select('IRN, F18MWorkerNotifiedDate')
          .eq('F18MStatus', 'NotifiedToWorker')
          .in('IRN', pageIRNs as any);

        if (dateErr) throw dateErr;

        (dateRows as F18DateRow[] | null)?.forEach((r) => {
          dateMap.set(String(r.IRN), r.F18MWorkerNotifiedDate);
        });
      }

      // ---------- MERGE + sort within the page by WorkerNotifiedDate ----------
      const merged: Form18Data[] = pageRows.map((r) => {
        const rawDate = dateMap.get(String(r.IRN)) ?? null;
        const formattedDate = rawDate
          ? new Date(rawDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'N/A';

        return {
          IRN: String(r.IRN),
          DisplayIRN: r.DisplayIRN || 'N/A',
          WorkerFirstName: r.WorkerFirstName || 'N/A',
          WorkerLastName: r.WorkerLastName || 'N/A',
          WorkerNotifiedDate: formattedDate,
          IncidentType: r.IncidentType || 'N/A',
          F18MID: (r.F18MID as any) ?? null,
          Status: r.F18MStatus || '',
        };
      });

      // Client-side sort *within the current page* by WorkerNotifiedDate desc
      merged.sort((a, b) => {
        const ad = a.WorkerNotifiedDate === 'N/A' ? 0 : Date.parse(a.WorkerNotifiedDate.split('/').reverse().join('-'));
        const bd = b.WorkerNotifiedDate === 'N/A' ? 0 : Date.parse(b.WorkerNotifiedDate.split('/').reverse().join('-'));
        return bd - ad;
      });

      setForm18List(merged);
    } catch (err: any) {
      console.error('Error fetching Form18 list:', err);
      setError(err.message || 'Failed to load Form18 list');
      setForm18List([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleView = (irn: string, incidentType: string) => {
    if (typeof irn !== 'string' || !irn.trim()) {
      setError('Invalid IRN. Please select a valid claim to view.');
      return;
    }
    setSelectedIRN(irn);
    setSelectedIncidentType(incidentType as 'Injury' | 'Death');

    if (incidentType === 'Injury' || incidentType === 'Death') {
      setShowForm142(true);
    }
  };

  const handleCloseForm142 = () => {
    setShowForm142(false);
    setSelectedIRN('');
    fetchForm18List(); // Refresh the list
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div className="flex items-center">
            <Logo size={40} className="mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              Form 18 - Worker Response to Form18 Notification
              {userRegion && <span className="text-sm font-normal ml-2 text-gray-600">({userRegion})</span>}
            </h2>
          </div>
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

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Total Records Found: {totalRecords} | Total Pages: {totalPages}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
          ) : form18List.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border border-primary/20">
                      CRN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border border-primary/20">
                      First Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border border-primary/20">
                      Last Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border border-primary/20">
                      Worker Notified Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border border-primary/20">
                      Incident Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border border-primary/20">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border border-primary/20">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {form18List.map((form, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                        {form.DisplayIRN}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.WorkerFirstName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.WorkerLastName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.WorkerNotifiedDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.IncidentType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">{form.Status}</td>
                      <td className="px-6 py-4 whitespace-nowrap border border-gray-300">
                        <button
                          onClick={() => handleView(form.IRN, form.IncidentType)}
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
              <p className="text-gray-600">No Notifications to Display.</p>
            </div>
          )}

          {/* Modal for Form 142 */}
          {showForm142 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <PendingForm18WorkerResponseToNotification
                  irn={selectedIRN}
                  incidentType={selectedIncidentType}
                  onClose={handleCloseForm142}
                  onSuccess={() => fetchForm18List()}
                />
              </div>
            </div>
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

export default ListForm18WorkerNotified;
