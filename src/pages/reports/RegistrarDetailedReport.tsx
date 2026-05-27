import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Cell
} from "recharts";
import { supabase } from "../../services/supabase";
import { Download, Printer, FileText, Table as TableIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Standard OWC Logo
const CREST_URL = "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

type SectionType = 'Submissions' | 'Approved' | 'DecisionAccepted' | 'DecisionRejected' | 'TimeBarredPending' | 'TimeBarredApproved' | 'TimeBarredRejected' | 'TimeBarredTribunal' | 'StaffF6' | 'StaffF18';
type FormType = 'F11' | 'F12' | 'F3' | 'F4' | 'All';
type BreakdownType = 'Province' | 'Industry' | 'Employer' | 'Insurance' | 'Sector' | 'Insurance Status' | 'Staff Name';

interface RegistrarDetailedReportProps {
  section: SectionType;
  formType: FormType;
  year: number;
  filterType: 'Annual' | 'Monthly' | 'Quarterly';
  month: number;
  quarter: number;
}

interface ReportRow {
  irn: string;
  crn: string;
  workerName: string;
  workerId: string;
  date: string;
  province: string;
  industry: string;
  employerName: string;
  employerId: string;
  insuranceName: string;
  sector: string;
  insuranceStatus: string;
  amount: number;
  staffName: string;
}

const RegistrarDetailedReport: React.FC<RegistrarDetailedReportProps> = ({
  section,
  formType,
  year,
  filterType,
  month,
  quarter
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [breakdownBy, setBreakdownBy] = useState<BreakdownType>(section.startsWith('Staff') ? 'Staff Name' : 'Province');
  
  const fetchInProgress = React.useRef(false);

  useEffect(() => {
    fetchData();
  }, [section, formType, year, filterType, month, quarter]);

  const fetchData = async () => {
    if (fetchInProgress.current) return;
    try {
      fetchInProgress.current = true;
      setLoading(true);
      setError(null);

      let startDate = `${year}-01-01`;
      let endDate = `${year + 1}-01-01`;
      if (filterType === 'Monthly') {
        const m = month < 10 ? `0${month}` : month;
        startDate = `${year}-${m}-01`;
        const nMonth = month === 12 ? 1 : month + 1;
        const nYear = month === 12 ? year + 1 : year;
        const nm = nMonth < 10 ? `0${nMonth}` : nMonth;
        endDate = `${nYear}-${nm}-01`;
      } else if (filterType === 'Quarterly') {
        const qMap: any = { 1: ['01', '04'], 2: ['04', '07'], 3: ['07', '10'], 4: ['10', '01'] };
        startDate = `${year}-${qMap[quarter][0]}-01`;
        endDate = `${quarter === 4 ? year + 1 : year}-${qMap[quarter][1]}-01`;
      }

      let baseRecords: any[] = [];
      const tbl_tbc = 'timebarredclaimsregistrarreview';
      const tbl_carr = 'claimsawardedregistrarreview';

      if (section === 'Submissions') {
        let q = supabase.from('form1112master').select('IRN, FirstSubmissionDate, DisplayIRN, WorkerID, IncidentProvince');
        if (formType === 'F11') q = q.eq('IncidentType', 'Injury');
        else if (formType === 'F12') q = q.eq('IncidentType', 'Death');
        else if (formType === 'F3') q = supabase.from('form3master').select('IRN, Form3SubmissionDate, WorkerID');
        else if (formType === 'F4') q = supabase.from('form4master').select('IRN, Form4SubmissionDate, WorkerID');
        
        const dateCol = formType.startsWith('F3') || formType.startsWith('F4') ? (formType === 'F3' ? 'Form3SubmissionDate' : 'Form4SubmissionDate') : 'FirstSubmissionDate';
        const { data: res, error: err } = await q.gte(dateCol, startDate).lt(dateCol, endDate);
        if (err) throw err;
        baseRecords = res || [];
      } 
      else if (section.startsWith('Decision')) {
        let q = supabase.from(tbl_carr).select('IRN, CARRReviewStatus, CARRDecisionDate, ClaimType').gte('CARRDecisionDate', startDate).lt('CARRDecisionDate', endDate);
        if (section === 'DecisionAccepted') q = q.eq('CARRReviewStatus', 'RegistrarAccepted');
        else q = q.not('CARRReviewStatus', 'in', '("RegistrarAccepted","RegistrarReviewPending")');
        const { data: res, error: err } = await q;
        if (err) throw err;
        baseRecords = res || [];
      }
      else if (section.startsWith('TimeBarred')) {
        let status = 'Pending';
        let dateCol = 'TBCRRSubmissionDate';
        if (section === 'TimeBarredApproved') { status = 'Approved'; dateCol = 'TBCRRDecisionDate'; }
        else if (section === 'TimeBarredRejected') { status = 'Rejected'; dateCol = 'TBCRRDecisionDate'; }
        else if (section === 'TimeBarredTribunal') { status = 'ForwardToTribunal'; dateCol = 'TBCRRDecisionDate'; }
        const { data: res, error: err } = await supabase.from(tbl_tbc).select('IRN, TBCRRReviewStatus, TBCRRSubmissionDate, TBCRRDecisionDate').eq('TBCRRReviewStatus', status).gte(dateCol, startDate).lt(dateCol, endDate);
        if (err) throw err;
        baseRecords = res || [];
      }
      else if (section.startsWith('Staff')) {
         const table = section === 'StaffF6' ? 'form6master' : 'form18master';
         const status = section === 'StaffF6' ? 'CompensationAccepted' : 'WorkerAccepted';
         const dateCol = section === 'StaffF6' ? 'F6MApprovalDate' : 'F18MWorkerAcceptedDate';
         const selectStr = section === 'StaffF6' ? 'IRN, F6MStatus, F6MApprovalDate' : 'IRN, F18MStatus, F18MWorkerAcceptedDate';
         
         const { data: res, error: err } = await supabase
           .from(table)
           .select(selectStr)
           .eq(section === 'StaffF6' ? 'F6MStatus' : 'F18MStatus', status)
           .gte(dateCol, startDate)
           .lt(dateCol, endDate);
           
         if (err) throw err;
         baseRecords = res || [];
      }
      else {
        const { data: appData, error: err } = await supabase.from(tbl_carr).select('IRN, CARRReviewStatus, CARRDecisionDate, ClaimType').eq('CARRReviewStatus', 'RegistrarAccepted').gte('CARRDecisionDate', startDate).lt('CARRDecisionDate', endDate);
        if (err) throw err;
        baseRecords = (appData || []).filter(r => {
           if (formType === 'F11' || formType === 'F3') return r.ClaimType === 'Injury';
           if (formType === 'F12') return r.ClaimType === 'Death';
           if (formType === 'F4') return r.ClaimType === 'Worker';
           return false;
        });
      }

      const irns = baseRecords.map(r => String(r.IRN));
      if (!irns.length) { setData([]); setLoading(false); return; }

      const chunkedFetch = async <T>(table: string, select: string, col: string, vals: any[]) => {
        const size = 50; const res = [];
        for (let i = 0; i < vals.length; i += size) {
          const { data } = await supabase.from(table).select(select).in(col, vals.slice(i, i + size));
          if (data) res.push(...data);
        }
        return res;
      };

      const [f1112, workIrn, comp, staffReview] = await Promise.all([
        chunkedFetch<any>('form1112master', 'IRN, IncidentProvince, WorkerID, DisplayIRN, InsuranceProviderIPACode', 'IRN', irns),
        chunkedFetch<any>('workerirn', 'IRN, WorkerID, Name', 'IRN', irns),
        chunkedFetch<any>('claimcompensationworkerdetails', 'IRN, CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions', 'IRN', irns),
        chunkedFetch<any>('approvedclaimscporeview', 'IRN, LockedByCPOID', 'IRN', irns)
      ]);

      const masterMap = new Map(f1112.map(f => [String(f.IRN), f]));
      const workerIrnMap = new Map(workIrn.map(w => [String(w.IRN), w]));
      const financialMap = new Map<string, number>();
      comp.forEach(c => financialMap.set(String(c.IRN), (financialMap.get(String(c.IRN)) || 0) + ((c.CCWDCompensationAmount || 0) + (c.CCWDMedicalExpenses || 0) + (c.CCWDMiscExpenses || 0) - (c.CCWDDeductions || 0))));

      const uniqueStaffIds = Array.from(new Set(staffReview.map(r => r.LockedByCPOID).filter(Boolean)));
      let staffNameMap = new Map<string, string>();
      if (uniqueStaffIds.length > 0) {
         const staffMasters = await chunkedFetch<any>('owcstaffmaster', 'OSMStaffID, OSMFirstName, OSMLastName', 'OSMStaffID', uniqueStaffIds);
         staffMasters.forEach(s => staffNameMap.set(String(s.OSMStaffID), `${s.OSMFirstName} ${s.OSMLastName}`));
      }
      const irnToStaffMap = new Map(staffReview.map(r => [String(r.IRN), staffNameMap.get(String(r.LockedByCPOID)) || 'Unassigned']));

      const irnToWorkerMap = new Map<string, string>();
      baseRecords.forEach(r => {
        const s = String(r.IRN);
        if (r.WorkerID) irnToWorkerMap.set(s, String(r.WorkerID));
        else if (masterMap.get(s)?.WorkerID) irnToWorkerMap.set(s, String(masterMap.get(s).WorkerID));
        else if (workerIrnMap.get(s)?.WorkerID) irnToWorkerMap.set(s, String(workerIrnMap.get(s).WorkerID));
      });

      const uwIds = Array.from(new Set(Array.from(irnToWorkerMap.values())));
      const employmentData = await chunkedFetch<any>('currentemploymentdetails', 'WorkerID, EmployerCPPSID', 'WorkerID', uwIds);
      const employmentMap = new Map(employmentData.map(e => [String(e.WorkerID), String(e.EmployerCPPSID)]));

      const ueIds = Array.from(new Set(Array.from(employmentMap.values())));
      const employerMasters = await chunkedFetch<any>('employermaster', 'CPPSID, Industry, OrganizationName, InsuranceProviderIPACode, OrganizationType', 'CPPSID', ueIds);
      const employerMap = new Map(employerMasters.map(e => [String(e.CPPSID), e]));

      const ipaCodes = Array.from(new Set(employerMasters.map(e => e.InsuranceProviderIPACode).filter(Boolean)));
      const insuranceMasters = await chunkedFetch<any>('insurancecompanymaster', 'IPACODE, InsuranceCompanyOrganizationName', 'IPACODE', ipaCodes);
      const insuranceMap = new Map(insuranceMasters.map(i => [String(i.IPACODE), i.InsuranceCompanyOrganizationName]));

      const rows: ReportRow[] = baseRecords.map(b => {
        const s = String(b.IRN);
        const m = masterMap.get(s);
        const wi = workerIrnMap.get(s);
        const wId = irnToWorkerMap.get(s);
        const eId = employmentMap.get(String(wId));
        const emp = employerMap.get(String(eId));
        const ins = insuranceMap.get(String(emp?.InsuranceProviderIPACode));
        const sector = emp?.OrganizationType === 'State' ? 'State (Public)' : emp?.OrganizationType === 'Private' ? 'Private' : 'Unknown';
        const inL = (ins || '').toLowerCase();
        let insS = 'Standard Insured';
        if (inL.includes('state')) insS = 'State'; else if (inL.includes('self')) insS = 'Self'; else if (inL.includes('un-insured')) insS = 'Un-Insured';

        return {
          irn: s, crn: m?.DisplayIRN || b.DisplayIRN || 'N/A', workerName: wi?.Name || 'Unknown', workerId: String(wId || 'N/A'),
          date: b.F6MApprovalDate || b.F18MWorkerAcceptedDate || b.TBCRRDecisionDate || b.TBCRRSubmissionDate || b.CARRDecisionDate || b.FirstSubmissionDate || b.Form3SubmissionDate || b.Form4SubmissionDate || 'N/A',
          province: m?.IncidentProvince || 'Unknown', industry: emp?.Industry || 'Unknown',
          employerName: emp?.OrganizationName || 'Unknown', employerId: String(eId || 'N/A'),
          insuranceName: ins || 'Unknown', sector, insuranceStatus: insS, amount: financialMap.get(s) || 0,
          staffName: irnToStaffMap.get(s) || 'Unassigned'
        };
      });
      setData(rows);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); fetchInProgress.current = false; }
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, ReportRow[]> = {};
    data.forEach(row => {
      let key = 'Unknown';
      if (breakdownBy === 'Province') key = row.province;
      else if (breakdownBy === 'Industry') key = row.industry;
      else if (breakdownBy === 'Employer') key = row.employerName;
      else if (breakdownBy === 'Insurance') key = row.insuranceName;
      else if (breakdownBy === 'Sector') key = row.sector;
      else if (breakdownBy === 'Insurance Status') key = row.insuranceStatus;
      else if (breakdownBy === 'Staff Name') key = row.staffName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [data, breakdownBy]);

  const aggregatedData = useMemo(() => {
    const agg: Record<string, any> = {};
    data.forEach(row => {
      let key = 'Unknown';
      if (breakdownBy === 'Province') key = row.province;
      else if (breakdownBy === 'Industry') key = row.industry;
      else if (breakdownBy === 'Employer') key = row.employerName;
      else if (breakdownBy === 'Insurance') key = row.insuranceName;
      else if (breakdownBy === 'Sector') key = row.sector;
      else if (breakdownBy === 'Insurance Status') key = row.insuranceStatus;
      else if (breakdownBy === 'Staff Name') key = row.staffName;
      if (!agg[key]) agg[key] = { label: key, count: 0, totalAmount: 0 };
      agg[key].count += 1;
      agg[key].totalAmount += row.amount;
    });
    return Object.values(agg).sort((a:any, b:any) => b.count - a.count);
  }, [data, breakdownBy]);

  const onDownloadPDF = async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
    const pW = doc.internal.pageSize.getWidth();
    let cY = 40;
    const img = new Image(); img.src = CREST_URL;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    if (img.complete) { doc.addImage(img, 'PNG', (pW - 40) / 2, cY, 40, 40); cY += 50; }
    doc.setFontSize(14).setFont("helvetica", "bold").text("OFFICE OF WORKERS COMPENSATION", pW / 2, cY, { align: "center" });
    cY += 20;
    doc.setFontSize(12).text(`Registrar Detailed Report: ${section.replace(/([A-Z])/g, ' $1').trim()}`, pW / 2, cY, { align: "center" });
    cY += 20;
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Grouped by: ${breakdownBy} | Year: ${year}`, pW / 2, cY, { align: "center" });
    cY += 30;

    const pdfRows: any[] = [];
    Object.entries(groupedData).forEach(([gName, rows]) => {
      pdfRows.push([{ content: `${breakdownBy}: ${gName}`, colSpan: 7, styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } }]);
      rows.forEach(r => pdfRows.push([r.crn, r.workerName, r.staffName, r.date, r.province, r.insuranceName, `K ${r.amount.toLocaleString()}`]));
      pdfRows.push([{ content: `SUBTOTAL: ${rows.length} Records | Value: K ${rows.reduce((s,r)=>s+r.amount,0).toLocaleString()}`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, fillColor: [248, 250, 252] } }]);
    });

    autoTable(doc, {
      head: [["CRN", "Worker Name", "Processed By", "Date", "Province", "Insurance", "Value"]],
      body: pdfRows,
      startY: cY,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59] },
      foot: [[{ content: `GRAND TOTAL: ${data.length} Records | K ${data.reduce((s,r)=>s+r.amount,0).toLocaleString()}`, colSpan: 7, styles: { halign: 'right' } }]],
      footStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' }
    });
    doc.save(`Registrar_Forensic_Staff_${section}_${year}.pdf`);
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="space-y-1">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 border-l-4 border-blue-600 pl-3 uppercase tracking-tight">
             {section.replace('Staff', 'Staff Performance: ')} Ledger
          </h2>
          <p className="text-sm text-gray-400 font-black uppercase tracking-widest">{data.length} Records Identified</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <span className="text-xs font-bold text-gray-400 uppercase">Group By:</span>
            <select value={breakdownBy} onChange={e => setBreakdownBy(e.target.value as any)} className="bg-transparent border-none text-sm font-bold text-gray-700 outline-none">
              <option value="Staff Name">Staff Officer</option><option value="Province">Province</option><option value="Industry">Industry</option><option value="Employer">Employer</option><option value="Insurance">Insurance</option><option value="Sector">Sector</option><option value="Insurance Status">Insurance Status</option>
            </select>
          </div>
          <button onClick={onDownloadPDF} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-bold shadow-sm transition-all"><Printer size={16} /> Print Report</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px]">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Volume Distribution (By {breakdownBy})</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aggregatedData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" hide /><YAxis dataKey="label" type="category" width={100} fontSize={10} tick={{ fontWeight: 600, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `${v} Records`} /><Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                {aggregatedData.map((_:any, i:any) => <Cell key={i} fill="#8b5cf6" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[350px]">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Financial Impact (By {breakdownBy})</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aggregatedData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" hide /><YAxis dataKey="label" type="category" width={100} fontSize={10} tick={{ fontWeight: 600, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `K ${v.toLocaleString()}`} /><Bar dataKey="totalAmount" radius={[0, 4, 4, 0]} barSize={16}>
                {aggregatedData.map((_:any, i:any) => <Cell key={i} fill="#ec4899" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center gap-2"><TableIcon size={16} className="text-gray-400" /><span className="text-sm font-bold text-gray-700">Analytical Performance Ledger</span></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50/10">
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">CRN</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Worker</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Processed By</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Industry / Province</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Value (K)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(groupedData).map(([gName, rows]) => {
                const subT = rows.reduce((sum, r) => sum + r.amount, 0);
                return (
                  <React.Fragment key={gName}>
                    <tr className="bg-blue-50/5"><td colSpan={6} className="px-6 py-2.5 font-black text-[10px] text-blue-600 uppercase tracking-wide border-l-2 border-blue-600">{breakdownBy}: {gName} ({rows.length} Records) | Subtotal Value: K {subT.toLocaleString()}</td></tr>
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-xs font-bold text-gray-600">{r.crn}</td>
                        <td className="px-6 py-3 text-xs font-medium text-gray-700">{r.workerName}</td>
                        <td className="px-6 py-3 text-xs text-purple-600 font-bold">{r.staffName}</td>
                        <td className="px-6 py-3 text-xs text-gray-500">{r.industry} / <span className="font-bold">{r.province}</span></td>
                        <td className="px-6 py-3 text-xs text-gray-400">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="px-6 py-3 text-right text-xs font-black text-gray-900 leading-none">K {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              <tr className="bg-gray-900"><td colSpan={5} className="px-6 py-6 text-right text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Grand Total Staff Value</td><td className="px-6 py-6 text-right text-xl font-black text-white leading-none">K {data.reduce((s,r)=>s+r.amount,0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RegistrarDetailedReport;
