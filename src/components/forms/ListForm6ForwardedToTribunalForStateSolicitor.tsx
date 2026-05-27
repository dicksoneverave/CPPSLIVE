// src/components/forms/ListForm6ForwardedToTribunalForStateSolicitor.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import PendingForm6ForStateSolicitorReview from './PendingForm6ForStateSolicitorReview';

interface ListForm6ForwardedToTribunalForStateSolicitorProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, incidentType: 'Injury' | 'Death') => void;
}

type IncidentType = 'Injury' | 'Death';

interface RowData {
  IRN: number;
  CRN: string;
  FirstName: string;
  LastName: string;
  SubmittedDate: string;
  HearingNo: string | null;
  IncidentType: IncidentType;
}

const ListForm6ForwardedToTribunalForStateSolicitor: React.FC<ListForm6ForwardedToTribunalForStateSolicitorProps> = ({
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

  const [searchCRN, setSearchCRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');

  const [showPendingForm6, setShowPendingForm6] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string>('');
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType>('Injury');

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, recordsPerPage]);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);

      const start = (currentPage - 1) * recordsPerPage;
      const end = start + recordsPerPage - 1;

      // 1. Fetch records from tribunalhearingschedule
      let query = supabase
        .from('tribunalhearingschedule')
        .select('IRN, THSSubmissionDate, THSHearingNo', { count: 'exact' })
        .eq('THSHearingType', 'Form6StateSolicitorSumbission')
        .order('THSSubmissionDate', { ascending: false });

      const { data: scheduleData, error: scheduleError, count } = await query.range(start, end);
      if (scheduleError) throw scheduleError;

      if (!scheduleData || scheduleData.length === 0) {
        setRows([]);
        setTotalRecords(0);
        return;
      }

      const irns = scheduleData.map(d => d.IRN);

      // 2. Lookup IRN value back in 'workerirn' table for DisplayIRN, FirstName, and LastName
      const { data: workerData, error: workerErr } = await supabase
        .from('workerirn')
        .select('IRN, DisplayIRN, FirstName, LastName')
        .in('IRN', irns);
      
      if (workerErr) {
        console.error('Error fetching worker records:', workerErr);
      }

      // 3. Get IncidentType from form6master
      const { data: f6mData, error: f6mErr } = await supabase
        .from('form6master')
        .select('IRN, IncidentType')
        .in('IRN', irns);

      if (f6mErr) {
        console.error('Error fetching form6master records:', f6mErr);
      }

      // Merge data
      const mergedRows: RowData[] = scheduleData.map(s => {
        const worker = workerData?.find(w => w.IRN === s.IRN);
        const f6m = f6mData?.find(f => f.IRN === s.IRN);
        
        return {
          IRN: s.IRN,
          CRN: worker?.DisplayIRN || 'N/A',
          FirstName: worker?.FirstName || 'N/A',
          LastName: worker?.LastName || 'N/A',
          SubmittedDate: s.THSSubmissionDate,
          HearingNo: s.THSHearingNo,
          IncidentType: (f6m?.IncidentType as IncidentType) || 'Injury'
        };
      });

      setRows(mergedRows);
      setTotalRecords(count || 0);
    } catch (err: any) {
      console.error('Error loading forwarded list:', err);
      setError(err.message || 'Failed to load list.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchCRN = r.CRN.toLowerCase().includes(searchCRN.toLowerCase());
      const matchFirst = r.FirstName.toLowerCase().includes(searchFirstName.toLowerCase());
      const matchLast = r.LastName.toLowerCase().includes(searchLastName.toLowerCase());
      return matchCRN && matchFirst && matchLast;
    });
  }, [rows, searchCRN, searchFirstName, searchLastName]);


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
            Form 6 Forwarded To Tribunal
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Search */}
          <form className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search by CRN
                </label>
                <input
                  type="text"
                  value={searchCRN}
                  onChange={(e) => setSearchCRN(e.target.value)}
                  className="input"
                  placeholder="Enter CRN"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search by First Name
                </label>
                <input
                  type="text"
                  value={searchFirstName}
                  onChange={(e) => setSearchFirstName(e.target.value)}
                  className="input"
                  placeholder="Enter First Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search by Last Name
                </label>
                <input
                  type="text"
                  value={searchLastName}
                  onChange={(e) => setSearchLastName(e.target.value)}
                  className="input"
                  placeholder="Enter Last Name"
                />
              </div>
            </div>
          </form>

          <hr className="mb-6" />

          {/* Meta */}
          <div className="mb-4 text-sm text-gray-600">
            Total Forwarded Records: {totalRecords}
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
                      CRN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      First Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted To Tribunal Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hearing No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRows.map((r, idx) => {
                    const submittedDate = r.SubmittedDate
                      ? new Date(r.SubmittedDate).toLocaleDateString('en-GB')
                      : 'N/A';
                    return (
                      <tr key={`${r.IRN}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {r.CRN}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.FirstName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.LastName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submittedDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {r.HearingNo || 'Pending'}
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
              <p className="text-gray-600">No Forwarded Forms Found</p>
            </div>
          )}

          {/* Pagination */}
          <div className="mt-6 flex justify-center">
            <div className="flex space-x-2">
              {currentPage > 1 && (
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
              {currentPage < totalPages && (
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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

export default ListForm6ForwardedToTribunalForStateSolicitor;
