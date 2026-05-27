import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import ApprovedTimebarredFormSubmissionRegistrarReview from './ApprovedTimebarredFormSubmissionRegistrarReview';
import Logo from '../common/Logo';

interface ListApprovedTimeBarredFormsRegistrarReviewProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, tbcrrid: string, formType: string) => void;
}

interface TimeBarredFormData {
  IRN: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  SubmissionDate: string;
  TBCRRFormType: string; // "Form11" | "Form12"
  TBCRRID: string;
  TBCRRReviewStatus: string;
}

const ListApprovedTimeBarredFormsRegistrarReview: React.FC<ListApprovedTimeBarredFormsRegistrarReviewProps> = ({ 
  onClose,
  onSelectIRN 
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formsList, setFormsList] = useState<TimeBarredFormData[]>([]);
  const [searchIRN, setSearchIRN] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Local modal state for embedded Registrar Review
  const [showReview, setShowReview] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string | number | null>(null);
  const [selectedIncidentType, setSelectedIncidentType] = useState<'Injury' | 'Death' | ''>('');

  useEffect(() => {
    fetchFormsList();
  }, [currentPage, searchIRN, searchFirstName, searchLastName]);

  const fetchFormsList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the count of matching records
      let countQuery = supabase
        .from('timebarred_approved_view')
        .select('*', { count: 'exact', head: true });

      // Apply search filters if provided
      if (searchIRN) countQuery = countQuery.ilike('DisplayIRN', `%${searchIRN}%`);
      if (searchFirstName) countQuery = countQuery.ilike('WorkerFirstName', `%${searchFirstName}%`);
      if (searchLastName) countQuery = countQuery.ilike('WorkerLastName', `%${searchLastName}%`);

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.ceil(totalCount / recordsPerPage));
      
      // Calculate pagination
      const start = (currentPage - 1) * recordsPerPage;
      
      // Execute the SQL query to get the data
      let query = supabase
        .from('timebarred_approved_view')
        .select('*')
        .range(start, start + recordsPerPage - 1)
        .order('SubmissionDateFormatted', { ascending: false });

      // Apply search filters if provided
      if (searchIRN) query = query.ilike('DisplayIRN', `%${searchIRN}%`);
      if (searchFirstName) query = query.ilike('WorkerFirstName', `%${searchFirstName}%`);
      if (searchLastName) query = query.ilike('WorkerLastName', `%${searchLastName}%`);

      const { data, error } = await query;
      if (error) throw error;

      setFormsList(data || []);
    } catch (err: any) {
      console.error('Error fetching time-barred forms list:', err);
      setError(err.message || 'Failed to load time-barred forms list');
      setFormsList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    fetchFormsList();
  };

  // Map the view's TBCRRFormType to IncidentType expected by the embedded review
  const mapFormTypeToIncident = (formType: string): 'Injury' | 'Death' | '' => {
    if (!formType) return '';
    const t = formType.toLowerCase();
    if (t.includes('form11')) return 'Injury';
    if (t.includes('form12')) return 'Death';
    // Sometimes the view might already expose words Injury/Death
    if (t.includes('injury')) return 'Injury';
    if (t.includes('death')) return 'Death';
    return '';
  };

  const openEmbeddedReview = (irn: string, tbcrrid: string, formType: string) => {
    const mapped = mapFormTypeToIncident(formType);
    if (onSelectIRN) {
      // Preserve original callback behavior if parent wants to control navigation
      onSelectIRN(irn, tbcrrid, formType);
      return;
    }
    setSelectedIncidentType(mapped);
    // Try to coerce numeric IRNs, but keep string if not a plain number
    const asNum = Number(irn);
    setSelectedIRN(Number.isFinite(asNum) ? asNum : irn);
    setShowReview(true);
  };

  const closeEmbeddedReview = () => {
    setShowReview(false);
    setSelectedIRN(null);
    setSelectedIncidentType('');
    // Optional: refresh list on close in case anything changed upstream
    fetchFormsList();
  };

  const handlePageChange = (page: number) => setCurrentPage(page);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center">
            <Logo size={40} className="mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Approved Time-Barred Forms</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="searchIRN" className="block text-sm font-medium text-gray-700 mb-1">Search by Display IRN</label>
                <input type="text" id="searchIRN" value={searchIRN} onChange={(e) => setSearchIRN(e.target.value)} className="input" placeholder="Enter Display IRN" />
              </div>
              <div>
                <label htmlFor="searchFirstName" className="block text-sm font-medium text-gray-700 mb-1">Search by First Name</label>
                <input type="text" id="searchFirstName" value={searchFirstName} onChange={(e) => setSearchFirstName(e.target.value)} className="input" placeholder="Enter First Name" />
              </div>
              <div>
                <label htmlFor="searchLastName" className="block text-sm font-medium text-gray-700 mb-1">Search by Last Name</label>
                <input type="text" id="searchLastName" value={searchLastName} onChange={(e) => setSearchLastName(e.target.value)} className="input" placeholder="Enter Last Name" />
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
            <p className="text-sm text-gray-600">Total Records Found: {totalRecords} | Total Pages: {totalPages}</p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : formsList.length > 0 ? (
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
                  {formsList.map((form, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{form.DisplayIRN}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{form.WorkerFirstName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{form.WorkerLastName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{form.SubmissionDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{form.TBCRRFormType}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => openEmbeddedReview(form.IRN, form.TBCRRID, form.TBCRRFormType)}
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
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No Approved Forms For Reviews.</p>
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

      {/* Embedded Registrar Review modal */}
      {showReview && selectedIRN != null && selectedIncidentType && (
        <ApprovedTimebarredFormSubmissionRegistrarReview
          irn={selectedIRN}
          incidentType={selectedIncidentType}
          onClose={closeEmbeddedReview}
        />
      )}
    </div>
  );
};

export default ListApprovedTimeBarredFormsRegistrarReview;
