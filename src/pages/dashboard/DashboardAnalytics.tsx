import React, { useEffect, useMemo, useState, useRef } from 'react';
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
} from 'recharts';
import { supabase } from '../../services/supabase';
import { Calendar, Filter, FileText, ChevronLeft, ChevronRight, Download, Printer, Users, TrendingUp } from 'lucide-react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Types
interface DataPoint {
  label: string;
  count: number;
  totalAmount: number;
}

interface DashboardAnalyticsProps {
  initialYear?: number;
  showRecents?: boolean;
}

const monthLabels = ['January','February','March', 'April','May','June','July','August','September','October','November','December'];
type BreakdownType = 'Province' | 'Industry' | 'Employer' | 'Insurance' | 'Sector' | 'Insurance Status';

const CREST_URL = "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

// --- Helper: Chunking for Supabase .in() filters
const chunkedFetch = async <T>(table: string, select: string, column: string, values: any[]): Promise<T[]> => {
  if (!values.length) return [];
  const chunkSize = 50;
  const chunks = [];
  for (let i = 0; i < values.length; i += chunkSize) chunks.push(values.slice(i, i + chunkSize));
  const results = await Promise.all(chunks.map(chunk => supabase.from(table).select(select).in(column, chunk)));
  return results.flatMap(r => r.data || []);
};

const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({ 
  initialYear = new Date().getFullYear(),
  showRecents = true 
}) => {
  const [year, setYear] = useState(initialYear);
  const [filterType, setFilterType] = useState<'Annual' | 'Quarterly' | 'Monthly'>('Annual');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [breakdownBy, setBreakdownBy] = useState<BreakdownType>('Province');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [priorData, setPriorData] = useState<{ 
    form11: DataPoint[]; form12: DataPoint[]; form3: DataPoint[]; form4: DataPoint[];
    f6AcceptedInjury: DataPoint[]; f6AcceptedDeath: DataPoint[]; f6RejectedInjury: DataPoint[]; f6RejectedDeath: DataPoint[];
    f18AcceptedInjury: DataPoint[]; f18AcceptedDeath: DataPoint[]; f18RejectedInjury: DataPoint[]; f18RejectedDeath: DataPoint[];
    f6Totals: { accepted: number; rejected: number }; f18Totals: { accepted: number; rejected: number };
    f6Staff: DataPoint[]; f18Staff: DataPoint[];
  }>({
    form11: [], form12: [], form3: [], form4: [],
    f6AcceptedInjury: [], f6AcceptedDeath: [], f6RejectedInjury: [], f6RejectedDeath: [],
    f18AcceptedInjury: [], f18AcceptedDeath: [], f18RejectedInjury: [], f18RejectedDeath: [],
    f6Totals: { accepted: 0, rejected: 0 }, f18Totals: { accepted: 0, rejected: 0 },
    f6Staff: [], f18Staff: []
  });

  const [registrarData, setRegistrarData] = useState<{
    accepted: DataPoint[]; rejected: DataPoint[];
    acceptedTotal: number; rejectedTotal: number;
    acceptedValue: number; rejectedValue: number;
  }>({
    accepted: [], rejected: [], acceptedTotal: 0, rejectedTotal: 0, acceptedValue: 0, rejectedValue: 0
  });

  const [timeBarredData, setTimeBarredData] = useState<{
    pending: DataPoint[]; approved: DataPoint[]; rejected: DataPoint[]; tribunal: DataPoint[];
    totals: { pending: number; approved: number; rejected: number; tribunal: number };
  }>({
    pending: [], approved: [], rejected: [], tribunal: [],
    totals: { pending: 0, approved: 0, rejected: 0, tribunal: 0 }
  });

  useEffect(() => {
    fetchData();
  }, [year, filterType, selectedMonth, selectedQuarter, breakdownBy]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let startDate = `${year}-01-01`;
      let endDate = `${year + 1}-01-01`;
      if (filterType === 'Monthly') {
        const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
        startDate = `${year}-${m}-01`;
        const nMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
        const nYear = selectedMonth === 12 ? year + 1 : year;
        const nm = nMonth < 10 ? `0${nMonth}` : nMonth;
        endDate = `${nYear}-${nm}-01`;
      } else if (filterType === 'Quarterly') {
        const qMap: any = { 1: ['01', '04'], 2: ['04', '07'], 3: ['07', '10'], 4: ['10', '01'] };
        startDate = `${year}-${qMap[selectedQuarter][0]}-01`;
        endDate = `${selectedQuarter === 4 ? year + 1 : year}-${qMap[selectedQuarter][1]}-01`;
      }

      const getBase = async (table: string, dateCol: string, filter?: any) => {
        let cols = 'IRN';
        if (['form1112master', 'form3master', 'form4master'].includes(table)) cols += ', WorkerID';
        if (['form6master', 'form18master'].includes(table)) cols += ', EmployerCPPSID';
        if (table === 'claimsawardedregistrarreview') cols += ', CARRDecisionDate';
        if (table === 'timebarredclaimsregistrarreview') cols += ', TBCRRReviewStatus, TBCRRSubmissionDate, TBCRRDecisionDate';
        
        let q = supabase.from(table).select(`${cols}, ${dateCol}`);
        if (table === 'form1112master' && filter) q = q.eq('IncidentType', filter);
        if (table === 'form6master' && filter) q = q.eq('F6MStatus', filter === 'Accepted' ? 'CompensationAccepted' : 'CompensationRejected');
        if (table === 'form18master' && filter) q = q.eq('F18MStatus', filter === 'Accepted' ? 'WorkerAccepted' : 'WorkerRejected');
        if (table === 'claimsawardedregistrarreview') {
           if (filter === 'Accepted') q = q.eq('CARRReviewStatus', 'RegistrarAccepted');
           else if (filter === 'Rejected') q = q.not('CARRReviewStatus', 'in', '("RegistrarAccepted","RegistrarReviewPending")');
        }
        if (table === 'timebarredclaimsregistrarreview' && filter) q = q.eq('TBCRRReviewStatus', filter);

        const { data: resData } = await q.gte(dateCol, startDate).lt(dateCol, endDate);
        return resData || [];
      };

      const [f11, f12, f3, f4, f6Acc, f6Rej, f18Acc, f18Rej, regAcc, regRej, tbcPen, tbcApp, tbcRej, tbcTrib] = await Promise.all([
        getBase('form1112master', 'FirstSubmissionDate', 'Injury'),
        getBase('form1112master', 'FirstSubmissionDate', 'Death'),
        getBase('form3master', 'Form3SubmissionDate'),
        getBase('form4master', 'Form4SubmissionDate'),
        getBase('form6master', 'F6MApprovalDate', 'Accepted'),
        getBase('form6master', 'F6MApprovalDate', 'Rejected'),
        getBase('form18master', 'F18MWorkerAcceptedDate', 'Accepted'),
        getBase('form18master', 'F18MWorkerAcceptedDate', 'Rejected'),
        getBase('claimsawardedregistrarreview', 'CARRDecisionDate', 'Accepted'),
        getBase('claimsawardedregistrarreview', 'CARRDecisionDate', 'Rejected'),
        getBase('timebarredclaimsregistrarreview', 'TBCRRSubmissionDate', 'Pending'),
        getBase('timebarredclaimsregistrarreview', 'TBCRRDecisionDate', 'Approved'),
        getBase('timebarredclaimsregistrarreview', 'TBCRRDecisionDate', 'Rejected'),
        getBase('timebarredclaimsregistrarreview', 'TBCRRDecisionDate', 'ForwardToTribunal')
      ]);

      const allBaseRecords = [...f11, ...f12, ...f3, ...f4, ...f6Acc, ...f6Rej, ...f18Acc, ...f18Rej, ...regAcc, ...regRej, ...tbcPen, ...tbcApp, ...tbcRej, ...tbcTrib];
      const allIrns = Array.from(new Set(allBaseRecords.map(r => String(r.IRN))));
      
      if (!allIrns.length) {
        setPriorData(prev => ({...prev, form11: [], form12: [], form3: [], form4: []}));
        setRegistrarData({ accepted: [], rejected: [], acceptedTotal: 0, rejectedTotal: 0, acceptedValue: 0, rejectedValue: 0 });
        setLoading(false);
        return;
      }

      // Hydrate financials for ALL records
      const compDetails = await chunkedFetch<any>('claimcompensationworkerdetails', 'IRN, CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions', 'IRN', allIrns);
      const financialMap = new Map<string, number>();
      compDetails.forEach(c => {
         const total = (c.CCWDCompensationAmount || 0) + (c.CCWDMedicalExpenses || 0) + (c.CCWDMiscExpenses || 0) - (c.CCWDDeductions || 0);
         financialMap.set(String(c.IRN), (financialMap.get(String(c.IRN)) || 0) + total);
      });

      // Hydrate Shared Master Data
      const masterData = await chunkedFetch<any>('form1112master', 'IRN, IncidentProvince, IncidentType, WorkerID', 'IRN', allIrns);
      const workerIrnData = await chunkedFetch<any>('workerirn', 'IRN, WorkerID', 'IRN', allIrns);
      const masterMap = new Map(masterData.map(m => [String(m.IRN), m]));
      const workerIrnMap = new Map(workerIrnData.map(w => [String(w.IRN), String(w.WorkerID)]));

      const irnToWorkerMap = new Map<string, string>();
      const irnToEmployerMap_Direct = new Map<string, string>();
      allBaseRecords.forEach(r => {
        const s = String(r.IRN);
        if (r.WorkerID) irnToWorkerMap.set(s, String(r.WorkerID));
        else if (masterMap.get(s)?.WorkerID) irnToWorkerMap.set(s, String(masterMap.get(s).WorkerID));
        else if (workerIrnMap.get(s)) irnToWorkerMap.set(s, workerIrnMap.get(s)!);
        if (r.EmployerCPPSID) irnToEmployerMap_Direct.set(s, String(r.EmployerCPPSID));
      });

      // Industrial Joins
      const uwIds = Array.from(new Set(Array.from(irnToWorkerMap.values())));
      let employmentMap = new Map<string, string>();
      let employerMap = new Map<string, any>();
      let insuranceMap = new Map<string, string>();
      if (uwIds.length > 0 && breakdownBy !== 'Province') {
        const empData = await chunkedFetch<any>('currentemploymentdetails', 'WorkerID, EmployerCPPSID', 'WorkerID', uwIds);
        empData.forEach(e => { if (e.EmployerCPPSID) employmentMap.set(String(e.WorkerID), String(e.EmployerCPPSID)); });
      }
      const ueIds = Array.from(new Set([...Array.from(employmentMap.values()), ...Array.from(irnToEmployerMap_Direct.values())]));
      if (ueIds.length > 0 && breakdownBy !== 'Province') {
        const employerData = await chunkedFetch<any>('employermaster', 'CPPSID, OrganizationName, Industry, InsuranceProviderIPACode, OrganizationType', 'CPPSID', ueIds);
        employerData.forEach(e => employerMap.set(String(e.CPPSID), e));
        if (['Insurance', 'Insurance Status'].includes(breakdownBy)) {
          const codes = Array.from(new Set(employerData.map(e => e.InsuranceProviderIPACode).filter(Boolean)));
          const insData = await chunkedFetch<any>('insurancecompanymaster', 'IPACODE, InsuranceCompanyOrganizationName', 'IPACODE', codes);
          insData.forEach(i => insuranceMap.set(String(i.IPACODE), i.InsuranceCompanyOrganizationName));
        }
      }

      // Staff Joins
      const staffIrns = Array.from(new Set([...f6Acc, ...f18Acc].map(r => String(r.IRN))));
      let staffMapping = new Map<string, string>();
      if (staffIrns.length > 0) {
        const cpoRes = await chunkedFetch<any>('approvedclaimscporeview', 'IRN, LockedByCPOID', 'IRN', staffIrns);
        const sIds = Array.from(new Set(cpoRes.map(r => r.LockedByCPOID).filter(Boolean)));
        const sMaster = await chunkedFetch<any>('owcstaffmaster', 'OSMStaffID, OSMFirstName, OSMLastName', 'OSMStaffID', sIds);
        const sNames = new Map(sMaster.map(s => [String(s.OSMStaffID), `${s.OSMFirstName} ${s.OSMLastName}`]));
        cpoRes.forEach(r => staffMapping.set(String(r.IRN), sNames.get(String(r.LockedByCPOID)) || 'Unassigned'));
      }

      const process = (recs: any[], useStaff = false) => {
        const agg: Record<string, DataPoint> = {};
        recs.forEach(r => {
          const s = String(r.IRN);
          const master = masterMap.get(s);
          const wId = irnToWorkerMap.get(s);
          const eId = irnToEmployerMap_Direct.get(s) || employmentMap.get(String(wId));
          const emp = employerMap.get(String(eId));
          const insN = insuranceMap.get(String(emp?.InsuranceProviderIPACode));
          let key = 'Unknown';
          if (useStaff) key = staffMapping.get(s) || 'Unassigned';
          else if (breakdownBy === 'Province') key = master?.IncidentProvince || 'Unknown';
          else if (breakdownBy === 'Industry') key = emp?.Industry || 'Unknown';
          else if (breakdownBy === 'Employer') key = emp?.OrganizationName || 'Unknown';
          else if (breakdownBy === 'Insurance') { 
            const n = insN || 'Unknown'; 
            const l = n.toLowerCase(); 
            key = (l.includes('self') || l.includes('state') || l.includes('un-insured')) ? 'Unknown' : n; 
          }
          else if (breakdownBy === 'Sector') { const t = emp?.OrganizationType || 'Unknown'; key = t === 'State' ? 'State (Public)' : t === 'Private' ? 'Private' : t; }
          else if (breakdownBy === 'Insurance Status') {
            const l = insN?.toLowerCase() || 'un-insured';
            key = l.includes('state') ? 'State' : l.includes('self') ? 'Self' : l.includes('un-insured') ? 'Un-Insured' : 'Standard Insured';
          }
          if (!agg[key]) agg[key] = { label: key, count: 0, totalAmount: 0 };
          agg[key].count += 1;
          agg[key].totalAmount += financialMap.get(s) || 0;
        });
        return Object.values(agg).sort((a,b) => b.count - a.count);
      };

      const filterInc = (recs: any[], type: string) => recs.filter(r => masterMap.get(String(r.IRN))?.IncidentType === type);

      setPriorData({
        form11: process(f11), form12: process(f12), form3: process(f3), form4: process(f4),
        f6AcceptedInjury: process(filterInc(f6Acc, 'Injury')), f6AcceptedDeath: process(filterInc(f6Acc, 'Death')),
        f6RejectedInjury: process(filterInc(f6Rej, 'Injury')), f6RejectedDeath: process(filterInc(f6Rej, 'Death')),
        f18AcceptedInjury: process(filterInc(f18Acc, 'Injury')), f18AcceptedDeath: process(filterInc(f18Acc, 'Death')),
        f18RejectedInjury: process(filterInc(f18Rej, 'Injury')), f18RejectedDeath: process(filterInc(f18Rej, 'Death')),
        f6Totals: { accepted: f6Acc.length, rejected: f6Rej.length }, f18Totals: { accepted: f18Acc.length, rejected: f18Rej.length },
        f6Staff: process(f6Acc, true), f18Staff: process(f18Acc, true)
      });

      setRegistrarData({
        accepted: process(regAcc), rejected: process(regRej),
        acceptedTotal: regAcc.length, rejectedTotal: regRej.length,
        acceptedValue: regAcc.reduce((s,r) => s + (financialMap.get(String(r.IRN)) || 0), 0),
        rejectedValue: regRej.reduce((s,r) => s + (financialMap.get(String(r.IRN)) || 0), 0)
      });

      setTimeBarredData({
        pending: process(tbcPen), approved: process(tbcApp), rejected: process(tbcRej), tribunal: process(tbcTrib),
        totals: { pending: tbcPen.length, approved: tbcApp.length, rejected: tbcRej.length, tribunal: tbcTrib.length }
      });

    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const getReportTitle = () => {
    let t = `${filterType} View Report ${year}`;
    if (filterType === 'Monthly') t += ` - ${monthLabels[selectedMonth-1]}`;
    else if (filterType === 'Quarterly') t += ` - Q${selectedQuarter}`;
    return t;
  };

  const onExportCSV = () => {
    let csv = `PAPUA NEW GUINEA\nOFFICE OF WORKERS COMPENSATION\n${getReportTitle()}\n\n`;
    csv += `Section,Metrics,Records,Total Value (K)\n`;
    
    const categories = [
      { l: "Form 11 (Injury)", i: priorData.form11 },
      { l: "Form 12 (Death)", i: priorData.form12 },
      { l: "Form 3 (Injury)", i: priorData.form3 },
      { l: "Form 4 (Death)", i: priorData.form4 },
      { l: "F6 Verified", i: priorData.f6Staff },
      { l: "F18 Resolved", i: priorData.f18Staff },
      { l: "TimeBarred Pending", i: timeBarredData.pending },
      { l: "TimeBarred Approved", i: timeBarredData.approved },
      { l: "TimeBarred Rejected", i: timeBarredData.rejected },
      { l: "TimeBarred Tribunal", i: timeBarredData.tribunal },
      { l: "Accepted Claims", i: registrarData.accepted },
      { l: "Rejected Claims", i: registrarData.rejected }
    ];

    categories.forEach(cat => {
      let catCount = 0;
      let catValue = 0;
      cat.i.forEach(itm => {
        csv += `"${cat.l}","${itm.label}",${itm.count},${itm.totalAmount}\n`;
        catCount += itm.count;
        catValue += itm.totalAmount;
      });
      csv += ` SUBTOTAL: ${cat.l},,${catCount},${catValue}\n\n`;
    });

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `Registrar_Summary_${filterType}_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadPDF = async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pW = doc.internal.pageSize.getWidth();
    let cY = 40;
    
    const img = new Image(); img.src = CREST_URL;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    if (img.complete) { doc.addImage(img, 'PNG', (pW - 60) / 2, cY, 60, 60); cY += 90; }
    
    doc.setFontSize(16).setFont("helvetica", "bold").text("PAPUA NEW GUINEA", pW / 2, cY, { align: "center" });
    cY += 25;
    doc.setFontSize(14).text("OFFICE OF WORKERS COMPENSATION", pW / 2, cY, { align: "center" });
    cY += 40;
    doc.setFontSize(12).text(getReportTitle(), pW / 2, cY, { align: "center" });
    cY += 30;

    const categories = [
      { l: "Form 11 (Injury)", i: priorData.form11 },
      { l: "Form 12 (Death)", i: priorData.form12 },
      { l: "Form 3 (Injury)", i: priorData.form3 },
      { l: "Form 4 (Death)", i: priorData.form4 },
      { l: "F6 Verified", i: priorData.f6Staff },
      { l: "F18 Resolved", i: priorData.f18Staff },
      { l: "TimeBarred Pending", i: timeBarredData.pending },
      { l: "TimeBarred Approved", i: timeBarredData.approved },
      { l: "TimeBarred Rejected", i: timeBarredData.rejected },
      { l: "TimeBarred Tribunal", i: timeBarredData.tribunal },
      { l: "Accepted Claims", i: registrarData.accepted },
      { l: "Rejected Claims", i: registrarData.rejected }
    ];

    categories.forEach(cat => {
      const rows = cat.i.map(itm => [cat.l, itm.label, itm.count, `K ${itm.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]);
      const catCount = cat.i.reduce((s, itm) => s + itm.count, 0);
      const catValue = cat.i.reduce((s, itm) => s + itm.totalAmount, 0);

      autoTable(doc, {
        head: [[{ content: cat.l, colSpan: 2 }, "Records", "Value (K)"]],
        body: rows,
        startY: cY,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59] },
        foot: [[{ content: `SUBTOTAL: ${cat.l}`, colSpan: 2, styles: { halign: 'right' } }, catCount, `K ${catValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` ]],
        footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' }
      });
      cY = (doc as any).lastAutoTable.finalY + 25;

      if (cY > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); cY = 40; }
    });

    doc.save(`Registrar_Summary_${filterType}_${year}.pdf`);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100 ring-1 ring-black/5 min-w-[180px]">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 border-b border-gray-50 pb-1">{label}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Records:</span>
              <span className="text-sm font-black text-gray-900">{d.count.toLocaleString()}</span>
            </div>
            {d.totalAmount > 0 && (
              <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-gray-50">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Total Value:</span>
                <span className="text-sm font-black text-blue-600">K {d.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const ReportCard = ({title, data, color}: any) => {
    const tC = data.reduce((s:any, d:any) => s + d.count, 0);
    const tV = data.reduce((s:any, d:any) => s + d.totalAmount, 0);
    return (
      <div className="card hover:shadow-lg transition-all flex flex-col h-[380px]">
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex justify-between">{title} <span className="bg-gray-100 px-2 py-0.5 rounded">{data.length} Groups</span></h3>
          <div className="flex items-baseline gap-3">
             <span className="text-2xl font-black text-gray-900 leading-none">{tC.toLocaleString()} <span className="text-[10px] font-bold text-gray-300 uppercase">Reports</span></span>
             {tV > 0 && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black border border-blue-100">K {tV.toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ left: -20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} width={110} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {data.map((_:any, i:any) => <Cell key={i} fill={i === 0 ? color : `${color}80`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl text-[10px] font-black text-gray-300 uppercase tracking-widest">No active records found</div>}
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-[600px] flex items-center justify-center bg-white rounded-3xl"><div className="flex flex-col items-center gap-4"><div className="h-12 w-12 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin" /><p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Synching Ledger...</p></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-gray-100">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Registrar Dashboard</h1>
          <div className="flex items-center gap-2">
             <button onClick={onExportCSV} className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors"><Download size={14} /> CSV Summary</button>
             <button onClick={onDownloadPDF} className="text-[10px] font-black uppercase text-gray-400 hover:text-rose-600 flex items-center gap-1 transition-colors"><Printer size={14} /> PDF Summary</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-50 p-1 rounded-2xl border">
            {(['Annual', 'Quarterly', 'Monthly'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${filterType === t ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl border">
            <button onClick={() => setYear(year - 1)} className="text-gray-400 hover:text-blue-600 transition-colors"><ChevronLeft size={16}/></button>
            <span className="text-sm font-black w-12 text-center text-gray-700">{year}</span>
            <button onClick={() => setYear(year + 1)} className="text-gray-400 hover:text-blue-600 transition-colors"><ChevronRight size={16}/></button>
          </div>
          {filterType === 'Monthly' && <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-gray-50 border-gray-200 rounded-xl text-xs font-black px-4 py-2 uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all">{monthLabels.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>}
          {filterType === 'Quarterly' && <select value={selectedQuarter} onChange={e => setSelectedQuarter(Number(e.target.value))} className="bg-gray-50 border-gray-200 rounded-xl text-xs font-black px-4 py-2 uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all"><option value="1">Q1 (Jan-Mar)</option><option value="2">Q2 (Apr-Jun)</option><option value="3">Q3 (Jul-Sep)</option><option value="4">Q4 (Oct-Dec)</option></select>}
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center justify-between pt-2">
           <h2 className="text-xl font-bold flex items-center gap-3 text-gray-800"><TrendingUp size={20} className="text-blue-600"/> Operational Submissions</h2>
           <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border shadow-sm">
              <Filter size={14} className="text-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-2">Breakdown</span>
              <select value={breakdownBy} onChange={e => setBreakdownBy(e.target.value as any)} className="bg-transparent border-none rounded-xl text-[11px] font-black px-2 py-0 uppercase outline-none focus:ring-0 text-gray-700">
                <option value="Province">Province</option><option value="Industry">Industry</option><option value="Employer">Employer</option><option value="Insurance">Insurance</option><option value="Sector">Sector</option><option value="Insurance Status">Insurance Status</option>
              </select>
           </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ReportCard title="Form 11 (Injury)" data={priorData.form11} color="#0ea5e9" />
          <ReportCard title="Form 12 (Death)" data={priorData.form12} color="#22c55e" />
          <ReportCard title="Form 3 (Injury)" data={priorData.form3} color="#f59e0b" />
          <ReportCard title="Form 4 (Death)" data={priorData.form4} color="#ef4444" />
        </div>

        <div className="p-8 rounded-[3rem] bg-gray-50/20 border border-dashed border-gray-200 space-y-6">
            <div className="flex items-center gap-3 justify-center mb-2"><Users size={20} className="text-purple-600"/><h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-400 text-center">Staff Processing Pipeline</h3></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ReportCard title="F6 Verified: Staff Performance" data={priorData.f6Staff} color="#8b5cf6" />
              <ReportCard title="F18 Resolved: Staff Performance" data={priorData.f18Staff} color="#ec4899" />
            </div>
        </div>

        <div className="space-y-6 py-10 border-y border-gray-100 animate-in slide-in-from-right duration-700">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="h-6 w-1.5 bg-rose-600 rounded-full"/><h2 className="text-xl font-bold text-gray-800">Time-Barred Claims Audit</h2><span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest leading-none">Registrar Oversight</span></div>
              <div className="flex gap-10 text-right bg-white px-6 py-4 rounded-3xl border shadow-sm">
                  <div><p className="text-[9px] font-black text-gray-300 uppercase mb-0.5 tracking-widest">Pending</p><p className="text-lg font-black text-rose-600 leading-none">{timeBarredData.totals.pending}</p></div>
                  <div className="h-8 w-px bg-gray-100" />
                  <div><p className="text-[9px] font-black text-gray-300 uppercase mb-0.5 tracking-widest">Approved</p><p className="text-lg font-black text-green-600 leading-none">{timeBarredData.totals.approved}</p></div>
                  <div className="h-8 w-px bg-gray-100" />
                  <div><p className="text-[9px] font-black text-gray-300 uppercase mb-0.5 tracking-widest">To Tribunal</p><p className="text-lg font-black text-blue-600 leading-none">{timeBarredData.totals.tribunal}</p></div>
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <ReportCard title="TimeBarred Pending" data={timeBarredData.pending} color="#f43f5e" />
              <ReportCard title="TimeBarred Approved" data={timeBarredData.approved} color="#10b981" />
              <ReportCard title="TimeBarred Rejected" data={timeBarredData.rejected} color="#f97316" />
              <ReportCard title="TimeBarred Tribunal" data={timeBarredData.tribunal} color="#3b82f6" />
           </div>
        </div>

        <div className="space-y-6 pt-10">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="h-6 w-1.5 bg-indigo-600 rounded-full"/><h2 className="text-xl font-bold text-gray-800">Registrar Decision Registry</h2><span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest leading-none">Financial Finality</span></div>
              <div className="flex gap-12 text-right bg-white p-6 rounded-[2rem] shadow-sm border">
                  <div>
                    <p className="text-[9px] font-black text-gray-300 uppercase mb-1 tracking-widest">Decision: Accepted</p>
                    <div className="flex items-baseline gap-2">
                       <p className="text-2xl font-black text-green-600 leading-none">{registrarData.acceptedTotal}</p>
                       <span className="text-[11px] font-black text-gray-400">/ K {registrarData.acceptedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-gray-100" />
                  <div>
                    <p className="text-[9px] font-black text-gray-300 uppercase mb-1 tracking-widest">Decision: Rejected</p>
                    <div className="flex items-baseline gap-2">
                       <p className="text-2xl font-black text-rose-600 leading-none">{registrarData.rejectedTotal}</p>
                       <span className="text-[11px] font-black text-gray-400">/ K {registrarData.rejectedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
              </div>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ReportCard title="Registrar Accepted Claims" data={registrarData.accepted} color="#10b981" />
              <ReportCard title="Registrar Rejected Claims" data={registrarData.rejected} color="#f43f5e" />
           </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardAnalytics;
