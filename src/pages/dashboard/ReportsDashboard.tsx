import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart, Pie, Tooltip, Cell, Legend,
  BarChart, CartesianGrid, XAxis, YAxis, Bar
} from 'recharts';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { ChevronDown, ChevronLeft, ChevronRight, Printer, Download, ArrowLeft } from 'lucide-react';

// Custom reports
import EmployerMaritalStatusReport from "../reports/EmployerMaritalStatusReport";
import GeneralAccidentProvinceReport from "../reports/GeneralAccidentProvinceReport";
import AgeGroupAccidentTypeReport from "../reports/AgeGroupAccidentTypeReport";
import WorkerGenderAccidentTypeReport from "../reports/WorkerGenderAccidentTypeReport";
import CCPMCCStatsReport from "../reports/CCPMCCStatsReport";
import EmployerInsuranceCompanyReport from "../reports/EmployerInsuranceCompanyReport";
import ApprovedAwardsDetailedReport from "../reports/ApprovedAwardsDetailedReport";
import RegistrarDetailedReport from "../reports/RegistrarDetailedReport";




// ---------- Types ----------
type MonthDatum = { label: string; count: number };
type ReportKind = 'pie-monthly' | 'bar-monthly' | 'table' | 'placeholder' | 'custom';

interface ReportConfig {
  key: string;
  title: string;
  section: string;
  kind: ReportKind;
  needsRegion?: boolean;
  loader?: (args: { year: number; region: string }) => Promise<{
    monthly?: MonthDatum[];
    tableRows?: any[];
    total?: number;
  }>;
}

// ---------- Constants ----------
const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const palette = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#eab308','#06b6d4','#84cc16','#ec4899','#10b981'];
const REGIONS = ['All','Highlands Region','Islands Region','Momase Region','Papua Region'];

// ---------- Shimmers ----------
const ShimmerCard: React.FC<{lines?: number}> = ({ lines = 1 }) => (
  <div className="p-4 rounded-lg bg-white shadow animate-pulse">
    <div className="h-4 w-1/3 bg-gray-200 rounded mb-2" />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-6 w-1/2 bg-gray-200 rounded mb-1" />
    ))}
  </div>
);

const ShimmerChart: React.FC = () => (
  <div className="h-80 rounded-lg bg-white shadow p-4 animate-pulse">
    <div className="h-6 w-1/3 bg-gray-200 rounded mb-4" />
    <div className="h-64 bg-gray-100 rounded" />
  </div>
);

// ---------- Helpers ----------
function groupCountsByMonth(dates: string[]): MonthDatum[] {
  const buckets = new Array(12).fill(0);
  for (const iso of dates) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) buckets[d.getMonth()] += 1;
  }
  return buckets.map((count, i) => ({ label: monthLabels[i], count }));
}

async function getUserRegion(cppsid?: string | null): Promise<string | null> {
  if (!cppsid) return null;
  const { data, error } = await supabase
    .from('owcstaffmaster')
    .select('InchargeRegion')
    .eq('cppsid', cppsid)
    .maybeSingle();
  if (error) throw error;
  return data?.InchargeRegion ?? null;
}

async function getRegionIRNs(region: string | null): Promise<string[]> {
  const q = supabase.from('form1112master').select('IRN');
  const { data, error } = region && region !== 'All'
    ? await q.eq('IncidentRegion', region)
    : await q;
  if (error) throw error;
  return (data ?? []).map(r => String(r.IRN));
}

// ---------- Data Loaders (Working Reports) ----------

// Form 11 (Injury) by month (FirstSubmissionDate)
async function loadF11Monthly(year: number) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const { data, error } = await supabase
    .from('form1112master')
    .select('FirstSubmissionDate')
    .eq('IncidentType', 'Injury')
    .gte('FirstSubmissionDate', startISO)
    .lt('FirstSubmissionDate', endISO);
  if (error) throw error;
  const dates = (data ?? []).map(r => r.FirstSubmissionDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// Form 12 (Death) by month (FirstSubmissionDate)
async function loadF12Monthly(year: number) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const { data, error } = await supabase
    .from('form1112master')
    .select('FirstSubmissionDate')
    .eq('IncidentType', 'Death')
    .gte('FirstSubmissionDate', startISO)
    .lt('FirstSubmissionDate', endISO);
  if (error) throw error;
  const dates = (data ?? []).map(r => r.FirstSubmissionDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// Form 3 monthly (Form3SubmissionDate)
async function loadF3Monthly(year: number) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const { data, error } = await supabase
    .from('form3master')
    .select('Form3SubmissionDate')
    .gte('Form3SubmissionDate', startISO)
    .lt('Form3SubmissionDate', endISO);
  if (error) throw error;
  const dates = (data ?? []).map(r => r.Form3SubmissionDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// Form 4 monthly (Form4SubmissionDate)
async function loadF4Monthly(year: number) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const { data, error } = await supabase
    .from('form4master')
    .select('Form4SubmissionDate')
    .gte('Form4SubmissionDate', startISO)
    .lt('Form4SubmissionDate', endISO);
  if (error) throw error;
  const dates = (data ?? []).map(r => r.Form4SubmissionDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// Calculation Pending by month (pending_cpor_claims.CPORSubmissionDate) + region
async function loadCalcPendingMonthly(year: number, region: string) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const base = supabase
    .from('pending_cpor_claims')
    .select('CPORSubmissionDate, IncidentRegion')
    .gte('CPORSubmissionDate', startISO)
    .lt('CPORSubmissionDate', endISO);
  const { data, error } = region !== 'All'
    ? await base.eq('IncidentRegion', region)
    : await base;
  if (error) throw error;
  const dates = (data ?? []).map(r => r.CPORSubmissionDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// F6 Employer Response Pending by month (form6master.F6MApprovalDate) + region via IRN
async function loadF6PendingMonthly(year: number, region: string) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const irns = await getRegionIRNs(region);
  const q = supabase
    .from('form6master')
    .select('IRN, F6MStatus, F6MApprovalDate')
    .eq('F6MStatus', 'Pending')
    .gte('F6MApprovalDate', startISO)
    .lt('F6MApprovalDate', endISO);
  const { data, error } = irns.length ? await q.in('IRN', irns) : await q;
  if (error) throw error;
  const dates = (data ?? []).map(r => r.F6MApprovalDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// F18 Employer Accepted by month (form18master.F18MEmployerAcceptedDate) + region via IRN
async function loadF18EmployerAcceptedMonthly(year: number, region: string) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const irns = await getRegionIRNs(region);
  const q = supabase
    .from('form18master')
    .select('IRN, F18MStatus, F18MEmployerAcceptedDate')
    .eq('F18MStatus', 'EmployerAccepted')
    .gte('F18MEmployerAcceptedDate', startISO)
    .lt('F18MEmployerAcceptedDate', endISO);
  const { data, error } = irns.length ? await q.in('IRN', irns) : await q;
  if (error) throw error;
  const dates = (data ?? []).map(r => r.F18MEmployerAcceptedDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// F18 Worker Response by month (form18master.F18MWorkerAcceptedDate) + region via IRN
async function loadF18WorkerResponseMonthly(year: number, region: string) {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;
  const irns = await getRegionIRNs(region);
  const q = supabase
    .from('form18master')
    .select('IRN, F18MStatus, F18MWorkerAcceptedDate')
    .neq('F18MStatus', 'EmployerAccepted')
    .gte('F18MWorkerAcceptedDate', startISO)
    .lt('F18MWorkerAcceptedDate', endISO);
  const { data, error } = irns.length ? await q.in('IRN', irns) : await q;
  if (error) throw error;
  const dates = (data ?? []).map(r => r.F18MWorkerAcceptedDate as string).filter(Boolean);
  return { monthly: groupCountsByMonth(dates), total: dates.length };
}

// ---------- Reports Registry ----------
const reports: ReportConfig[] = [
  // General Reports (custom)
  { key: 'gen-marital-status',   title: 'Accident Types based on Marital Status', section: 'General Reports', kind: 'custom' },
  { key: 'gen-accident-province', title: 'Accident Province wise – Accident Type', section: 'General Reports', kind: 'custom' },
	{ key: 'gen-agegroup', title: 'Accident Types by Age Group', section: 'General Reports', kind: 'custom' },
	{ key: 'gen-worker-gender',     title: 'Accident Types by Worker Gender',        section: 'General Reports', kind: 'custom' },
	

	

  // Employer Reports (placeholder)
  { key: 'emp-insurance-company', title: 'Insurance Company wise – Accident Type', section: 'Employer Reports', kind: 'custom' },

  // Data Entry
  { key: 'de-f11-monthly', title: 'Form 11 – Injury by Month', section: 'Data Entry', kind: 'pie-monthly', loader: async ({year}) => loadF11Monthly(year) },
  { key: 'de-f12-monthly', title: 'Form 12 – Death by Month', section: 'Data Entry', kind: 'pie-monthly', loader: async ({year}) => loadF12Monthly(year) },
  { key: 'de-f3-monthly',  title: 'Form 3 – by Month',        section: 'Data Entry', kind: 'bar-monthly', loader: async ({year}) => loadF3Monthly(year) },
  { key: 'de-f4-monthly',  title: 'Form 4 – by Month',        section: 'Data Entry', kind: 'bar-monthly', loader: async ({year}) => loadF4Monthly(year) },

  // Provincial Claims Officer
  { key: 'pco-calc-pending', title: 'Calculation Pending by Month',              section: 'Provincial Claims Officer', kind: 'bar-monthly', needsRegion: true, loader: async ({year, region}) => loadCalcPendingMonthly(year, region) },
  { key: 'pco-f6-pending',   title: 'F6 Employer Response Pending by Month',     section: 'Provincial Claims Officer', kind: 'bar-monthly', needsRegion: true, loader: async ({year, region}) => loadF6PendingMonthly(year, region) },
  { key: 'pco-f18-employer', title: 'F18 Employer Accepted by Month',            section: 'Provincial Claims Officer', kind: 'pie-monthly', needsRegion: true, loader: async ({year, region}) => loadF18EmployerAcceptedMonthly(year, region) },
  { key: 'pco-f18-worker',   title: 'F18 Worker Response by Month',              section: 'Provincial Claims Officer', kind: 'pie-monthly', needsRegion: true, loader: async ({year, region}) => loadF18WorkerResponseMonthly(year, region) },

  // Claims Manager .. Commissioner .. etc (placeholders)
	{ key: 'gen-ccpmccstats', title: 'CCPMCC Stats (All)', section: 'Claims Manager', kind: 'custom' },


  { key: 'dr-overview',  title: 'Deputy Registrar Overview',        section: 'Deputy Registrar',      kind: 'placeholder' },
  
  // Registrar Detailed Reports
  { key: 'reg-accepted', title: 'Detailed Registrar Accepted Claims', section: 'Registrar', kind: 'custom' },
  { key: 'reg-rejected', title: 'Detailed Registrar Rejected Claims', section: 'Registrar', kind: 'custom' },
  { key: 'reg-tb-pending', title: 'Detailed Time-Barred: Pending', section: 'Registrar', kind: 'custom' },
  { key: 'reg-tb-approved', title: 'Detailed Time-Barred: Approved', section: 'Registrar', kind: 'custom' },
  { key: 'reg-tb-rejected', title: 'Detailed Time-Barred: Rejected', section: 'Registrar', kind: 'custom' },
  { key: 'reg-tb-tribunal', title: 'Detailed Time-Barred: Forward To Tribunal', section: 'Registrar', kind: 'custom' },
  { key: 'reg-staff-f6', title: 'Staff Performance: F6 Verified Ledger', section: 'Registrar', kind: 'custom' },
  { key: 'reg-staff-f18', title: 'Staff Performance: F18 Resolved Ledger', section: 'Registrar', kind: 'custom' },
  { key: 'reg-sub-f11', title: 'Detailed Submissions: Form 11 (Injury)', section: 'Registrar', kind: 'custom' },
  { key: 'reg-sub-f12', title: 'Detailed Submissions: Form 12 (Death)',  section: 'Registrar', kind: 'custom' },
  { key: 'reg-sub-f3',  title: 'Detailed Submissions: Form 3 (Injury)',  section: 'Registrar', kind: 'custom' },
  { key: 'reg-sub-f4',  title: 'Detailed Submissions: Form 4 (Death)',   section: 'Registrar', kind: 'custom' },

  { key: 'tc-overview',  title: 'Tribunal Clerk Overview',          section: 'Tribunal Clerk',        kind: 'placeholder' },
  { key: 'com-overview', title: 'Commissioner Overview',            section: 'Commissioner',          kind: 'placeholder' },
  { key: 'cc-overview',  title: 'Chief Commissioner Overview',      section: 'Chief Commissioner',    kind: 'placeholder' },
  { key: 'fos-overview', title: 'FOS Reports Overview',             section: 'FOS Reports',           kind: 'placeholder' },
  { key: 'ss-overview',  title: 'State Solicitor Overview',         section: 'State Solicitor',       kind: 'placeholder' },
  { key: 'fin-overview', title: 'Finance Department Overview',      section: 'Finance Department',    kind: 'placeholder' },
  { key: 'pay-overview', title: 'Payments Section Overview',        section: 'Payments Section',      kind: 'placeholder' },
  { key: 'ins-overview', title: 'Insurance Reports Overview',       section: 'Insurance Reports',     kind: 'placeholder' },
  { key: 'law-overview', title: 'Lawyer Reports Overview',          section: 'Lawyer Reports',        kind: 'placeholder' },

  // Commissioner & Chief Commissioner - Approved Awards
  { key: 'com-approved-sector',   title: 'Approved awards by Sectors – Private & Public', section: 'Commissioner', kind: 'custom' },
  { key: 'com-approved-insurance', title: 'Approved awards by Insurance Company',         section: 'Commissioner', kind: 'custom' },
  { key: 'com-approved-officer',   title: 'Approved awards by Per Claims Officers',        section: 'Commissioner', kind: 'custom' },
  { key: 'com-approved-injury',    title: 'Approved awards by Injury type',               section: 'Commissioner', kind: 'custom' },
  { key: 'com-approved-province',  title: 'Approved awards by Province',                   section: 'Commissioner', kind: 'custom' },
  { key: 'com-approved-region',    title: 'Approved awards by Region',                     section: 'Commissioner', kind: 'custom' },

  { key: 'cc-approved-sector',    title: 'Approved awards by Sectors – Private & Public', section: 'Chief Commissioner', kind: 'custom' },
  { key: 'cc-approved-insurance',  title: 'Approved awards by Insurance Company',         section: 'Chief Commissioner', kind: 'custom' },
  { key: 'cc-approved-officer',    title: 'Approved awards by Per Claims Officers',        section: 'Chief Commissioner', kind: 'custom' },
  { key: 'cc-approved-injury',     title: 'Approved awards by Injury type',               section: 'Chief Commissioner', kind: 'custom' },
  { key: 'cc-approved-province',   title: 'Approved awards by Province',                   section: 'Chief Commissioner', kind: 'custom' },
  { key: 'cc-approved-region',     title: 'Approved awards by Region',                     section: 'Chief Commissioner', kind: 'custom' },
];

const sections = Array.from(new Set(reports.map(r => r.section)));

// ---------- Component ----------
const ReportsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => sections.reduce((acc, s) => ({
      ...acc,
      [s]: ['General Reports','Data Entry','Provincial Claims Officer'].includes(s)
    }), {})
  );
  const [selectedKey, setSelectedKey] = useState<string>('gen-marital-status');

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [filterType, setFilterType] = useState<'Annual' | 'Monthly' | 'Quarterly'>('Annual');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));
  const [region, setRegion] = useState<string>('All');

  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const [monthlyData, setMonthlyData] = useState<MonthDatum[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);

  const reportRef = useRef<HTMLDivElement | null>(null);


	
  // Default region = logged-in user's region (if valid)
  useEffect(() => {
    (async () => {
      try {
        const reg = await getUserRegion(profile?.id ?? null);
        const def = reg && REGIONS.includes(reg) ? reg : 'All';
        setRegion(def);
      } catch {
        setRegion('All');
      }
    })();
  }, [profile?.id]);

  // Reset filter type to Annual for Data Entry, Provincial Claims Officer & Claims Manager reports
  useEffect(() => {
    const rep = reports.find(r => r.key === selectedKey);
    if (rep && ['Data Entry', 'Provincial Claims Officer', 'Claims Manager'].includes(rep.section)) {
      setFilterType('Annual');
    }
  }, [selectedKey]);

  // Load report whenever selection / filters change (generic reports only)
  const customKeys = useMemo(
    () => new Set([
      'cc-approved-sector', 'cc-approved-insurance', 'cc-approved-officer', 'cc-approved-injury', 'cc-approved-province', 'cc-approved-region',
      'reg-sub-f11', 'reg-sub-f12', 'reg-sub-f3', 'reg-sub-f4', 'reg-app-f11', 'reg-app-f12', 'reg-app-f3', 'reg-app-f4'
    ]),
    []
  );

  useEffect(() => {
    (async () => {
      const rep = reports.find(r => r.key === selectedKey);
      if (!rep) return;

      if (customKeys.has(rep.key)) {
        // Custom components manage their own data/exports
        setLoading(false);
        setErr(null);
        setMonthlyData([]);
        setTableRows([]);
        setTotal(0);
        return;
      }

      try {
        setLoading(true);
        setErr(null);
        setMonthlyData([]);
        setTableRows([]);
        setTotal(0);

        if (rep.kind === 'placeholder') return;

        if (rep.loader) {
          const useRegion = rep.needsRegion ? region : 'All';
          const { monthly, tableRows: trows, total: t } =
            await rep.loader({ year, region: useRegion });
          if (monthly) setMonthlyData(monthly);
          if (trows) setTableRows(trows);
          if (typeof t === 'number') setTotal(t);
          else if (monthly) setTotal(monthly.reduce((s, d) => s + d.count, 0));
        }
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKey, year, region, customKeys]);

  const currentReport = useMemo(() => reports.find(r => r.key === selectedKey), [selectedKey]);
  const needsRegion = currentReport?.needsRegion ?? false;
  const isCustom = customKeys.has(currentReport?.key ?? '');

  // ---- Generic exports (for non-custom reports) ----
  const exportCSV = () => {
    try {
      if (currentReport?.kind === 'bar-monthly' || currentReport?.kind === 'pie-monthly') {
        const header = 'Month,Count\n';
        const rows = monthlyData.map(r => `${r.label},${r.count}`).join('\n');
        const csv = header + rows;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentReport.title.replace(/\s+/g,'_')}_${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (currentReport?.kind === 'table') {
        if (!tableRows.length) return;
        const keys = Object.keys(tableRows[0]);
        const header = keys.join(',') + '\n';
        const rows = tableRows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(',')).join('\n');
        const csv = header + rows;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentReport.title.replace(/\s+/g,'_')}_${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('CSV export failed', e);
    }
  };

  const printPDF = () => {
    try { window.print(); } catch {}
  };

  const toggle = (sec: string) => setExpanded(prev => ({ ...prev, [sec]: !prev[sec] }));

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
          <p className="text-gray-600">Central place to access system-wide reports and exports.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const from = (location.state as any)?.from;
              if (from) navigate(from);
              else if (window.history.length > 1) navigate(-1);
              else navigate('/dashboard');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
            title="Exit Reports Area"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit Reports Area
          </button>
        </div>
      </div>

      {/* Body: Sidebar (1/4) + Report canvas (3/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-1 bg-white rounded-lg shadow print:hidden">
          <div className="p-4 border-b">
            <div className="font-medium text-gray-900">Reports</div>
            <div className="text-xs text-gray-500">Select a category to expand</div>
          </div>
          <nav className="p-2">
            {sections.map(sec => {
              const items = reports.filter(r => r.section === sec);
              return (
                <div key={sec} className="mb-2">
                  <button
                    onClick={() => toggle(sec)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-800">{sec}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded[sec] ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded[sec] && (
                    <div className="pl-2 mt-1 space-y-1">
                      {items.map(item => (
                        <button
                          key={item.key}
                          onClick={() => setSelectedKey(item.key)}
                          className={`w-full text-left text-sm px-3 py-2 rounded-md hover:bg-gray-50 ${
                            selectedKey === item.key ? 'bg-gray-100 font-medium' : ''
                          }`}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Canvas */}
        <section className="lg:col-span-3">
          {/* Controls & Heading */}
          <div className="bg-white rounded-lg shadow p-4 print:border print:rounded-none" ref={reportRef} id="report-canvas">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">
                {currentReport?.title ?? 'Report'}
                {total ? <span className="ml-2 text-sm text-gray-500">· Total: {total}</span> : null}
              </h2>
              <div className="flex items-center gap-2">
                {/* Year controls */}
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 border rounded" onClick={() => setYear(y => y - 1)} aria-label="Previous year">←</button>
                  <input
                    type="number"
                    className="w-24 px-2 py-1 border rounded"
                    value={year}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v)) setYear(v);
                    }}
                  />
                  <button className="px-2 py-1 border rounded" onClick={() => setYear(y => y + 1)} aria-label="Next year">→</button>
                  <button className="px-2 py-1 border rounded" onClick={() => setYear(new Date().getFullYear())}>This Year</button>
                </div>

                {/* Region (only when needed by the selected report) */}
                {needsRegion && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Region:</span>
                    <select
                      className="px-2 py-1 border rounded"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    >
                      {REGIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Export actions (generic only; custom components have their own) */}
                {!isCustom && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportCSV}
                      className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
                      title="Export CSV"
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </button>
                    <button
                      onClick={printPDF}
                      className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
                      title="Print / Save as PDF"
                    >
                      <Printer className="h-4 w-4" />
                      PDF
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Errors */}
            {!['Data Entry', 'Provincial Claims Officer', 'Claims Manager'].includes(currentReport?.section ?? '') && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setYear(year - 1)}
                      className="p-1 hover:bg-white rounded-md transition-all text-gray-600"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="px-4 font-bold text-gray-800 min-w-[60px] text-center">
                      {year}
                    </span>
                    <button
                      onClick={() => setYear(year + 1)}
                      className="p-1 hover:bg-white rounded-md transition-all text-gray-600"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="px-3 py-2 border rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="Annual">Annual View</option>
                    <option value="Quarterly">Quarterly View</option>
                    <option value="Monthly">Monthly View</option>
                  </select>

                  {filterType === 'Monthly' && (
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-2 border rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 font-medium animate-in fade-in"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  )}

                  {filterType === 'Quarterly' && (
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                      className="px-3 py-2 border rounded-md bg-white text-sm focus:ring-2 focus:ring-blue-500 font-medium animate-in fade-in"
                    >
                      <option value={1}>Q1 (Jan-Mar)</option>
                      <option value={2}>Q2 (Apr-Jun)</option>
                      <option value={3}>Q3 (Jul-Sep)</option>
                      <option value={4}>Q4 (Oct-Dec)</option>
                    </select>
                  )}
                </div>
              </div>
            )}

            {err && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{err}</div>}

            {/* ---- CUSTOM REPORTS ---- */}
            {currentReport?.key === 'gen-marital-status' && (
              <div className="space-y-4">
                <EmployerMaritalStatusReport
                  year={year}
                  filterType={filterType}
                  month={selectedMonth}
                  quarter={selectedQuarter}
                />
              </div>
            )}
            {currentReport?.key === 'gen-accident-province' && (
              <div className="space-y-4">
                <GeneralAccidentProvinceReport
                  year={year}
                  filterType={filterType}
                  month={selectedMonth}
                  quarter={selectedQuarter}
                />
              </div>
            )}

{currentReport?.key === 'gen-agegroup' && (
  <div className="space-y-4">
    <AgeGroupAccidentTypeReport
      title="Accident Types by Age Group"
      year={year}           // controlled by ReportsDashboard
      showControls={false}  // hide internal year picker here
      filterType={filterType}
      month={selectedMonth}
      quarter={selectedQuarter}
      key={`${year}-${filterType}-${selectedMonth}-${selectedQuarter}`}
    />
  </div>
)}

{currentReport?.key === 'gen-worker-gender' && (
  <div className="space-y-4">
    <WorkerGenderAccidentTypeReport
      title="Accident Types by Worker Gender"
      year={year}           // controlled from dashboard
      showControls={false}  // hide internal year picker here
      filterType={filterType}
      month={selectedMonth}
      quarter={selectedQuarter}
      key={`${year}-${filterType}-${selectedMonth}-${selectedQuarter}`}
    />
  </div>
)}

            {currentReport?.key === 'gen-cpmcc-stats' && (
              <div className="space-y-4">
                <CCPMCCStatsReport
                  year={year}
                  filterType={filterType}
                  month={selectedMonth}
                  quarter={selectedQuarter}
                  key={`${year}-${filterType}-${selectedMonth}-${selectedQuarter}`}
                />
              </div>
            )}

{currentReport?.key === 'gen-ccpmccstats' && (
  <div className="space-y-4">
    <CCPMCCStatsReport
      year={year}
      filterType={filterType}
      month={selectedMonth}
      quarter={selectedQuarter}
      key={`${year}-${filterType}-${selectedMonth}-${selectedQuarter}`}
    />
  </div>
)}

						{currentReport?.key === 'emp-insurance-company' && (
  				 <div className="space-y-4">
    			 <EmployerInsuranceCompanyReport
             year={year}
             filterType={filterType}
             month={selectedMonth}
             quarter={selectedQuarter}
           />
  			</div>
			)}

            {/* Approved Awards Reports */}
            {currentReport?.key.includes('-approved-sector') && (
              <ApprovedAwardsDetailedReport reportType="Sector" year={year} filterType={filterType} month={selectedMonth} quarter={selectedQuarter} />
            )}
            {currentReport?.key.includes('-approved-insurance') && (
              <ApprovedAwardsDetailedReport reportType="Insurance" year={year} filterType={filterType} month={selectedMonth} quarter={selectedQuarter} />
            )}
            {currentReport?.key.includes('-approved-officer') && (
              <ApprovedAwardsDetailedReport reportType="Officer" year={year} filterType={filterType} month={selectedMonth} quarter={selectedQuarter} />
            )}
            {currentReport?.key.includes('-approved-injury') && (
              <ApprovedAwardsDetailedReport reportType="Injury" year={year} filterType={filterType} month={selectedMonth} quarter={selectedQuarter} />
            )}
            {currentReport?.key.includes('-approved-province') && (
              <ApprovedAwardsDetailedReport reportType="Province" year={year} filterType={filterType} month={selectedMonth} quarter={selectedQuarter} />
            )}
            {currentReport?.key.includes('-approved-region') && (
              <ApprovedAwardsDetailedReport reportType="Region" year={year} filterType={filterType} month={selectedMonth} quarter={selectedQuarter} />
            )}

            {/* Registrar Detailed Reports */}
            {currentReport?.key.startsWith('reg-') && (
              <RegistrarDetailedReport 
                section={
                  currentReport.key === 'reg-accepted' ? 'DecisionAccepted' :
                  currentReport.key === 'reg-rejected' ? 'DecisionRejected' :
                  currentReport.key === 'reg-tb-pending' ? 'TimeBarredPending' :
                  currentReport.key === 'reg-tb-approved' ? 'TimeBarredApproved' :
                  currentReport.key === 'reg-tb-rejected' ? 'TimeBarredRejected' :
                  currentReport.key === 'reg-tb-tribunal' ? 'TimeBarredTribunal' :
                  currentReport.key === 'reg-staff-f6' ? 'StaffF6' :
                  currentReport.key === 'reg-staff-f18' ? 'StaffF18' :
                  currentReport.key.includes('-sub-') ? 'Submissions' : 'Approved'
                }
                formType={
                  currentReport.key.endsWith('f11') ? 'F11' : 
                  currentReport.key.endsWith('f12') ? 'F12' : 
                  currentReport.key.endsWith('f3') ? 'F3' : 
                  currentReport.key.endsWith('f4') ? 'F4' : 'All'
                }
                year={year}
                filterType={filterType}
                month={selectedMonth}
                quarter={selectedQuarter}
              />
            )}


						
            {/* ---- GENERIC CHARTS (non-custom) ---- */}
            {!isCustom && (currentReport?.kind === 'pie-monthly' || currentReport?.kind === 'bar-monthly') && (
              <>
                {loading ? (
                  <ShimmerChart />
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      {currentReport.kind === 'pie-monthly' ? (
                        <PieChart>
                          <Pie dataKey="count" data={monthlyData.filter(d => d.count > 0)} nameKey="label" label>
                            {monthlyData.filter(d => d.count > 0).map((_, i) => (
                              <Cell key={i} fill={palette[i % palette.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      ) : (
                        <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="count" name="Count">
                            {monthlyData.map((_, i) => (
                              <Cell key={i} fill={palette[i % palette.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}

            {/* ---- GENERIC TABLE (none wired yet) ---- */}
            {!isCustom && currentReport?.kind === 'table' && (
              loading ? <ShimmerCard lines={6} /> : (
                <div className="overflow-x-auto">
                  {tableRows.length === 0 ? (
                    <div className="text-sm text-gray-500">No records found.</div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(tableRows[0]).map((k) => (
                            <th key={k} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 text-sm">
                        {tableRows.map((r, idx) => (
                          <tr key={idx}>
                            {Object.keys(tableRows[0]).map((k) => (
                              <td key={k} className="px-4 py-2">{String(r[k] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            )}
          </div>
        </section>
      </div>

      {/* Print styles: print only the canvas */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-canvas, #report-canvas * { visibility: visible; }
          #report-canvas { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default ReportsDashboard;
