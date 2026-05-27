import React, { useEffect, useState, useMemo } from 'react';
import { X, Search, FileText, ChevronLeft, ChevronRight, Download, Filter } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { generateEmployerInsuranceMasterListPDF, generateGroupedEmployerInsuranceListPDF, EmployerInsuranceRow, GroupedInsuranceReportRow } from '../../utils/EmployerInsuranceList_jspdf';

interface EmployerInsuranceListModalProps {
  onClose: () => void;
}

interface Employer {
  EMID: string;
  CPPSID: string;
  OrganizationName: string;
  OrganizationType: string;
  InsuranceProviderIPACode: string;
}

interface InsuranceProvider {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
}

const EmployerInsuranceListModal: React.FC<EmployerInsuranceListModalProps> = ({ onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Employers
      const { data: empData, error: empErr } = await supabase
        .from('employermaster')
        .select('EMID, CPPSID, OrganizationName, OrganizationType, InsuranceProviderIPACode')
        .order('OrganizationName', { ascending: true });

      if (empErr) throw empErr;

      // 2. Fetch Insurance Providers
      const { data: insData, error: insErr } = await supabase
        .from('insurancecompanymaster')
        .select('IPACODE, InsuranceCompanyOrganizationName');

      if (insErr) throw insErr;

      const insMap = new Map();
      insData?.forEach(ins => {
        insMap.set(ins.IPACODE, ins.InsuranceCompanyOrganizationName);
      });

      setEmployers(empData || []);
      setInsuranceProviders(insMap);
    } catch (err) {
      console.error('Error fetching data:', err);
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

  const handleDownloadPDF = () => {
    const reportData: EmployerInsuranceRow[] = filteredEmployers.map(e => ({
      CPPSID: e.CPPSID || 'N/A',
      OrganizationName: e.OrganizationName || 'N/A',
      OrganizationType: e.OrganizationType || 'N/A',
      InsuranceProvider: insuranceProviders.get(e.InsuranceProviderIPACode) || 'N/A',
      IPACODE: e.InsuranceProviderIPACode || 'N/A'
    }));
    generateEmployerInsuranceMasterListPDF(reportData);
  };

  const handleDownloadGroupedPDF = () => {
    const groupedMap = new Map<string, EmployerInsuranceRow[]>();
    
    employers.forEach(e => {
      const ipacode = e.InsuranceProviderIPACode || 'N/A';
      if (!groupedMap.has(ipacode)) {
        groupedMap.set(ipacode, []);
      }
      groupedMap.get(ipacode)!.push({
        CPPSID: e.CPPSID || 'N/A',
        OrganizationName: e.OrganizationName || 'N/A',
        OrganizationType: e.OrganizationType || 'N/A',
        InsuranceProvider: insuranceProviders.get(e.InsuranceProviderIPACode) || 'N/A',
        IPACODE: e.InsuranceProviderIPACode || 'N/A'
      });
    });

    const reportData: GroupedInsuranceReportRow[] = Array.from(groupedMap.entries())
      .map(([ipacode, emps]) => ({
        InsuranceProviderName: insuranceProviders.get(ipacode) || (ipacode === 'N/A' ? 'Not Assigned' : ipacode),
        IPACODE: ipacode,
        Employers: emps
      }))
      .sort((a, b) => a.InsuranceProviderName.localeCompare(b.InsuranceProviderName));

    generateGroupedEmployerInsuranceListPDF(reportData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Employer - Insurance List</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              Total Employers: {employers.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={loading || employers.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Download Master List
              </button>
              <button
                onClick={handleDownloadGroupedPDF}
                disabled={loading || employers.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                <Filter className="h-4 w-4" />
                Group by Insurance
              </button>
            </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Organization Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Insurance Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">IPA CODE</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading data...</td></tr>
                ) : paginatedEmployers.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No employers found.</td></tr>
                ) : (
                  paginatedEmployers.map((emp) => (
                    <tr key={emp.EMID} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.CPPSID}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.OrganizationName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.OrganizationType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {insuranceProviders.get(emp.InsuranceProviderIPACode) || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.InsuranceProviderIPACode || '—'}</td>
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
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployerInsuranceListModal;
