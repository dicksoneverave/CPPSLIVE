// src/components/forms/ListApprovedFormsPrescreeningReview.tsx
import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import DRApprovedForm from './DRApprovedForm';

interface ListApprovedFormsPrescreeningReviewProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, prid: string, formType: string, workerId?: string | null) => void; // ✅ include workerId
}


interface PrescreeningReviewData {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  SubmissionDate: string;
  PRFormType: string;
  PRID: string;
  WorkerID?: string; // ✅ new
}


const ListApprovedFormsPrescreeningReview: React.FC<ListApprovedFormsPrescreeningReviewProps> = ({
  onClose,
  onSelectIRN
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prescreeningList, setPrescreeningList] = useState<PrescreeningReviewData[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // modal state for DRApprovedForm
  const [openApproved, setOpenApproved] = useState(false);
  const [selected, setSelected] = useState<{ irn: number; prid: number; formType: string; workerId: number } | null>(null);

  useEffect(() => {
    fetchPrescreeningList();
  }, [currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchPrescreeningList = async () => {
  try {
    setLoading(true);
    setError(null);

    // Build filters once
    const applyFilters = (q: any) => {
      if (searchIRN) q = q.ilike('DisplayIRN', `%${searchIRN}%`);
      if (searchFirstName) q = q.ilike('WorkerFirstName', `%${searchFirstName}%`);
      if (searchLastName) q = q.ilike('WorkerLastName', `%${searchLastName}%`);
      return q;
    };

    // 1) Count (head query)
    const { count, error: countError } = await applyFilters(
      supabase
        .from('prescreening_approved_view')
        .select('*', { count: 'exact', head: true })
    );
    if (countError) throw countError;

    const totalCount = count ?? 0;
    setTotalRecords(totalCount);
    setTotalPages(Math.max(1, Math.ceil(totalCount / recordsPerPage)));

    // 2) Page data
    const start = (currentPage - 1) * recordsPerPage;
    const end = start + recordsPerPage - 1;

    const { data, error } = await applyFilters(
      supabase
        .from('prescreening_approved_view')
        .select('IRN, DisplayIRN, WorkerFirstName, WorkerLastName, SubmissionDate, PRFormType, PRID, WorkerID')
        .order('SubmissionDateFormatted', { ascending: false })
        .range(start, end)
    );
    if (error) throw error;

    if (!data || data.length === 0) {
      setPrescreeningList([]);
      return;
    }

    const formattedData = data.map((item: any) => ({
      IRN: item.IRN,
      DisplayIRN: item.DisplayIRN || 'N/A',
      WorkerFirstName: item.WorkerFirstName || 'N/A',
      WorkerLastName: item.WorkerLastName || 'N/A',
      SubmissionDate: item.SubmissionDate || 'N/A',
      PRFormType: item.PRFormType,
      PRID: item.PRID,
      WorkerID: item.WorkerID ?? null, // <-- ensure worker id flows through
    }));

    setPrescreeningList(formattedData); // <-- correct variable name
  } catch (err: any) {
    console.error('Error fetching prescreening list:', err);
    setError(err.message || 'Failed to load prescreening list');
    setPrescreeningList([]);
  } finally {
    setLoading(false);
  }
};


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPrescreeningList();
  };

const handleReview = (irn: string, prid: string, formType: string, workerId?: string | null) => {
  if (onSelectIRN) {
    onSelectIRN(irn, prid, formType, workerId ?? null); // ✅ pass workerId
    return;
  } else {
      setSelected({ irn: Number(irn), prid: Number(prid), formType, workerId: Number(workerId) });
      setOpenApproved(true);
    }
  };

  const handlePageChange = (page: number) => setCurrentPage(page);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Approved Forms For Prescreening</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* search form unchanged... */}

          {/* table */}
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : prescreeningList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CRN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submission Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {prescreeningList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.DisplayIRN}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.WorkerFirstName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.WorkerLastName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.SubmissionDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.PRFormType}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleReview(item.IRN, item.PRID, item.PRFormType, item.WorkerID)}
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
              <p className="text-gray-600">No Approved Forms For Prescreening.</p>
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

      {openApproved && selected && (
        <DRApprovedForm
          irn={selected.irn}
          prid={selected.prid}
          formType={selected.formType as "Form3"|"Form4"|"Form11"|"Form12"}
          workerId={selected.workerId}        
          onClose={() => {
           setOpenApproved(false);
            setSelected(null);
						
          }}
					usePortal // default true, can omit
        />
      )}
    </div>
  );
};

export default ListApprovedFormsPrescreeningReview;
