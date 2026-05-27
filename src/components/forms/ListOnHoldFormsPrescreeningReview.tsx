// src/components/forms/ListOnHoldFormsPrescreeningReview.tsx
import React, { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { supabase } from "../../services/supabase";
import DROnHoldForm from "./DROnHoldForm";

interface ListOnHoldFormsPrescreeningReviewProps {
  onClose: () => void;
}

interface PrescreeningReviewData {
  IRN: string;            // keep as string if the view returns text
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  SubmissionDate: string; // formatted in the view
  PRFormType: string;     // "Form3" | "Form4"
  PRID: string;           // keep as string if the view returns text
}

const ListOnHoldFormsPrescreeningReview: React.FC<ListOnHoldFormsPrescreeningReviewProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prescreeningList, setPrescreeningList] = useState<PrescreeningReviewData[]>([]);

  // search
  const [searchIRN, setSearchIRN] = useState("");
  const [searchFirstName, setSearchFirstName] = useState("");
  const [searchLastName, setSearchLastName] = useState("");

  // paging
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // embedded review
  const [selectedForm, setSelectedForm] = useState<{ irn: string; formType: string; prid: string } | null>(null);

  useEffect(() => {
    fetchPrescreeningList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchPrescreeningList = async () => {
    try {
      setLoading(true);
      setError(null);

      // ---- COUNT query (head:true to avoid returning rows)
      let countQuery = supabase
        .from("prescreening_onhold_view")
        .select("*", { count: "exact", head: true });

      if (searchIRN) countQuery = countQuery.ilike("DisplayIRN", `%${searchIRN}%`);
      if (searchFirstName) countQuery = countQuery.ilike("WorkerFirstName", `%${searchFirstName}%`);
      if (searchLastName) countQuery = countQuery.ilike("WorkerLastName", `%${searchLastName}%`);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.max(1, Math.ceil(totalCount / recordsPerPage)));

      // ---- DATA query
      const start = (currentPage - 1) * recordsPerPage;

      let dataQuery = supabase.from("prescreening_onhold_view").select("*");
      if (searchIRN) dataQuery = dataQuery.ilike("DisplayIRN", `%${searchIRN}%`);
      if (searchFirstName) dataQuery = dataQuery.ilike("WorkerFirstName", `%${searchFirstName}%`);
      if (searchLastName) dataQuery = dataQuery.ilike("WorkerLastName", `%${searchLastName}%`);

      const { data, error } = await dataQuery
        .order("SubmissionDateFormatted", { ascending: false })
        .range(start, start + recordsPerPage - 1);

      if (error) throw error;

      setPrescreeningList(
        (data || []).map((item: any) => ({
          IRN: item.IRN,
          DisplayIRN: item.DisplayIRN || "N/A",
          WorkerFirstName: item.WorkerFirstName || "N/A",
          WorkerLastName: item.WorkerLastName || "N/A",
          SubmissionDate: item.SubmissionDate || "N/A",
          PRFormType: item.PRFormType,
          PRID: item.PRID,
        }))
      );
    } catch (err: any) {
      console.error("Error fetching on-hold prescreening list:", err);
      setError(err.message || "Failed to load on-hold list");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPrescreeningList();
  };

  const handleReview = (irn: string, formType: string, prid: string) => {
    setSelectedForm({ irn, formType, prid });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // When child closes, optimistically remove and refresh
  const handleCloseForm = () => {
    if (selectedForm) {
      setPrescreeningList((prev) => prev.filter((item) => item.IRN !== selectedForm.irn));
      setTotalRecords((prev) => Math.max(0, prev - 1));
    }
    setSelectedForm(null);
    fetchPrescreeningList();
  };

  // paging helpers for “showing X to Y”
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(startIndex + prescreeningList.length, totalRecords);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">On Hold Forms For Prescreening</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
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
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : prescreeningList.length > 0 ? (
            <>
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
                    {prescreeningList.map((item) => (
                      <tr key={item.PRID} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.DisplayIRN}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.WorkerFirstName}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.WorkerLastName}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.SubmissionDate}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.PRFormType}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleReview(item.IRN, item.PRFormType, item.PRID)}
                            className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination (inside the panel) */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {totalRecords === 0 ? 0 : startIndex + 1} to {endIndex} of {totalRecords} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                    >
                      First
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No Forms On Hold For Prescreening.</p>
            </div>
          )}
        </div>
      </div>

      {/* Embedded On-Hold Review Form */}
      {selectedForm && (
        <DROnHoldForm
          irn={parseInt(selectedForm.irn, 10)}
          formType={selectedForm.formType as "Form3" | "Form4"}
          prid={Number(selectedForm.prid)}
          variant="embedded"
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};

export default ListOnHoldFormsPrescreeningReview;
