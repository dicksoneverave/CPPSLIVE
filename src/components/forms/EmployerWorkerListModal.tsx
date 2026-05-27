import React, { useEffect, useState, useMemo } from 'react';
import { X, Search, FileText, ChevronLeft, ChevronRight, Users, Download } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { generateEmployerWorkerListPDF, generateMasterEmployerWorkerListPDF, WorkerReportRow, MasterReportRow } from '../../utils/EmployerWorkerList_jspdf';

interface EmployerWorkerListModalProps {
  onClose: () => void;
}

interface Employer {
  EMID: string;
  CPPSID: string;
  OrganizationName: string;
}

interface WorkerInfo {
  WorkerID: string;
  DisplayName: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerGender: string;
  WorkerAddress1: string;
  WorkerAddress2: string;
  WorkerMobile: string;
  WorkerLandline: string;
}

const EmployerWorkerListModal: React.FC<EmployerWorkerListModalProps> = ({ onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [generatingMaster, setGeneratingMaster] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchEmployers();
  }, []);

  const fetchEmployers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employermaster')
        .select('EMID, CPPSID, OrganizationName')
        .order('OrganizationName', { ascending: true });

      if (error) throw error;
      setEmployers(data || []);
    } catch (err) {
      console.error('Error fetching employers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return employers;
    return employers.filter(e => 
      (e.OrganizationName || '').toLowerCase().includes(q) || 
      (e.CPPSID || '').toLowerCase().includes(q)
    );
  }, [searchTerm, employers]);

  const paginatedEmployers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployers.slice(start, start + itemsPerPage);
  }, [filteredEmployers, currentPage]);

  const totalPages = Math.ceil(filteredEmployers.length / itemsPerPage);

  const handleSelectEmployer = async (employer: Employer) => {
    try {
      setSelectedEmployer(employer);
      setLoadingWorkers(true);
      setWorkers([]);

      // 1. Get WorkerIDs from currentemploymentdetails
      const { data: empDetails, error: empErr } = await supabase
        .from('currentemploymentdetails')
        .select('WorkerID')
        .eq('EmployerCPPSID', employer.CPPSID);

      if (empErr) throw empErr;
      if (!empDetails || empDetails.length === 0) {
        setWorkers([]);
        return;
      }

      const workerIds = empDetails.map(d => d.WorkerID);

      // 2. Get DisplayName from workerirn and personal details from workerpersonaldetails
      // We'll fetch them in parallel or use a join if possible, but let's do parallel fetches for simplicity and data integrity
      const [irnRes, personalRes] = await Promise.all([
        supabase.from('workerirn').select('WorkerID, DisplayIRN').in('WorkerID', workerIds),
        supabase.from('workerpersonaldetails').select('*').in('WorkerID', workerIds)
      ]);

      if (irnRes.error) throw irnRes.error;
      if (personalRes.error) throw personalRes.error;

      const irnMap = new Map(irnRes.data?.map(i => [i.WorkerID, i.DisplayIRN]));
      const personalMap = new Map(personalRes.data?.map(p => [p.WorkerID, p]));

      const combined: WorkerInfo[] = workerIds.map(id => {
        const p = personalMap.get(id);
        return {
          WorkerID: String(id),
          DisplayName: String(irnMap.get(id) || id),
          WorkerFirstName: p?.WorkerFirstName || '',
          WorkerLastName: p?.WorkerLastName || '',
          WorkerGender: p?.WorkerGender || '',
          WorkerAddress1: p?.WorkerAddress1 || '',
          WorkerAddress2: p?.WorkerAddress2 || '',
          WorkerMobile: p?.WorkerMobile || '',
          WorkerLandline: p?.WorkerLandline || ''
        };
      });

      setWorkers(combined);
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!selectedEmployer) return;
    const reportData: WorkerReportRow[] = workers.map(w => ({
      WorkerID: w.WorkerID,
      DisplayName: w.DisplayName,
      FirstName: w.WorkerFirstName,
      LastName: w.WorkerLastName,
      Gender: w.WorkerGender,
      Address: `${w.WorkerAddress1}${w.WorkerAddress2 ? ', ' + w.WorkerAddress2 : ''}`,
      Mobile: w.WorkerMobile,
      Landline: w.WorkerLandline
    }));
    generateEmployerWorkerListPDF(selectedEmployer.OrganizationName, selectedEmployer.CPPSID, reportData);
  };

  const handleGenerateMasterReport = async () => {
    try {
      setGeneratingMaster(true);
      
      // 1. Fetch all employers
      const { data: allEmployers, error: empErr } = await supabase
        .from('employermaster')
        .select('EMID, CPPSID, OrganizationName')
        .order('OrganizationName', { ascending: true });
      if (empErr) throw empErr;

      // 2. Fetch all employment details to get worker mappings
      const { data: allEmployment, error: employmentErr } = await supabase
        .from('currentemploymentdetails')
        .select('WorkerID, EmployerCPPSID');
      if (employmentErr) throw employmentErr;

      // 3. Get all worker IDs to fetch their details
      const workerIds = allEmployment.map(e => e.WorkerID);
      
      // 4. Fetch worker IRN and personal details in chunks if necessary, but let's try direct first
      // Assuming reasonably sized dataset. For very large datasets, this would need batching.
      const [irnRes, personalRes] = await Promise.all([
        supabase.from('workerirn').select('WorkerID, DisplayIRN').in('WorkerID', workerIds),
        supabase.from('workerpersonaldetails').select('WorkerID, WorkerFirstName, WorkerLastName, WorkerGender, WorkerAddress1, WorkerAddress2, WorkerMobile, WorkerLandline').in('WorkerID', workerIds)
      ]);

      if (irnRes.error) throw irnRes.error;
      if (personalRes.error) throw personalRes.error;

      const irnMap = new Map(irnRes.data?.map(i => [i.WorkerID, i.DisplayIRN]));
      const personalMap = new Map(personalRes.data?.map(p => [p.WorkerID, p]));

      // 5. Group workers by EmployerCPPSID
      const workersByEmployer = new Map<string, WorkerReportRow[]>();
      allEmployment.forEach(rel => {
        const p = personalMap.get(rel.WorkerID);
        if (!p) return;
        
        const workerRow: WorkerReportRow = {
          WorkerID: String(rel.WorkerID),
          DisplayName: String(irnMap.get(rel.WorkerID) || rel.WorkerID),
          FirstName: p.WorkerFirstName || '',
          LastName: p.WorkerLastName || '',
          Gender: p.WorkerGender || '',
          Address: `${p.WorkerAddress1}${p.WorkerAddress2 ? ', ' + p.WorkerAddress2 : ''}`,
          Mobile: p.WorkerMobile || '',
          Landline: p.WorkerLandline || ''
        };

        if (!workersByEmployer.has(rel.EmployerCPPSID)) {
          workersByEmployer.set(rel.EmployerCPPSID, []);
        }
        workersByEmployer.get(rel.EmployerCPPSID)!.push(workerRow);
      });

      // 6. Build final report data structure
      const reportData: MasterReportRow[] = allEmployers
        .filter(emp => workersByEmployer.has(emp.CPPSID))
        .map(emp => ({
          EmployerName: emp.OrganizationName,
          CPPSID: emp.CPPSID,
          Workers: workersByEmployer.get(emp.CPPSID) || []
        }));

      await generateMasterEmployerWorkerListPDF(reportData);
    } catch (err) {
      console.error('Error generating master report:', err);
      alert('Failed to generate master report. See console for details.');
    } finally {
      setGeneratingMaster(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedEmployer ? `Workers for ${selectedEmployer.OrganizationName}` : 'Employer - Worker List'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {!selectedEmployer ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500">
                  Total Employers: {employers.length}
                </div>
                <button
                  onClick={handleGenerateMasterReport}
                  disabled={generatingMaster || loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {generatingMaster ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating Master PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download Master Employer-Worker List
                    </>
                  )}
                </button>
              </div>

              <div className="relative mb-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by Organization Name or CPPS ID..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#8B2500] sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">CPPS ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Organization Name</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center">Loading employers...</td></tr>
                    ) : paginatedEmployers.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center">No employers found.</td></tr>
                    ) : (
                      paginatedEmployers.map((emp) => (
                        <tr key={emp.EMID} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.CPPSID}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.OrganizationName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleSelectEmployer(emp)}
                              className="text-primary hover:text-primary-dark font-semibold"
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <p className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredEmployers.length)} of {filteredEmployers.length} entries
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setSelectedEmployer(null)}
                  className="flex items-center text-sm text-gray-600 hover:text-primary"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back to Employers
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={workers.length === 0}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" /> Download PDF Report
                </button>
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#8B2500] sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">Worker ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">Display Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">Gender</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">Address</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">Mobile</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">Landline</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loadingWorkers ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center">Loading workers...</td></tr>
                    ) : workers.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-4 text-center">No workers found for this employer.</td></tr>
                    ) : (
                      workers.map((w) => (
                        <tr key={w.WorkerID} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{w.WorkerID}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 font-medium">{w.DisplayName}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{w.WorkerFirstName} {w.WorkerLastName}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{w.WorkerGender}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{w.WorkerAddress1} {w.WorkerAddress2}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{w.WorkerMobile}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{w.WorkerLandline}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployerWorkerListModal;
