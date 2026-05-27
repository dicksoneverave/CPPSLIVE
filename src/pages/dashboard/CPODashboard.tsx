import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart, Pie, Tooltip, Cell, Legend,
  BarChart, CartesianGrid, XAxis, YAxis, Bar
} from 'recharts';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { FileText, ChevronDown } from 'lucide-react';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

// MENUS & MODALS (from your original CPO dashboard)
import ListPendingRegisteredClaimsCPOReview from '../../components/forms/ListPendingRegisteredClaimsCPOReview';
import ListForm6NotificationEmployerResponsePending from '../../components/forms/ListForm6NotificationEmployerResponsePending';
import ListForm18EmployerAccepted from '../../components/forms/ListForm18EmployerAccepted';
import ListForm18WorkerResponse from '../../components/forms/ListForm18WorkerResponse';
import ListForm17 from '../../components/forms/ListForm17';
import ListForm7 from '../../components/forms/ListForm7';
import CPOClaimReviewForm from '../../components/forms/110cpoclaimreviewform';
import CPODeathClaimReviewForm from '../../components/forms/111cpoclaimreviewform';

type MonthDatum = { label: string; count: number };

const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const palette = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#eab308','#06b6d4','#84cc16','#ec4899','#10b981'];

const ShimmerCard: React.FC<{lines?: number}> = ({ lines = 1 }) => (
  <div className="p-4 rounded-lg bg-white shadow animate-pulse">
    <div className="h-4 w-1/3 bg-gray-200 rounded mb-2" />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-6 w-1/2 bg-gray-200 rounded mb-1" />
    ))}
  </div>
);

const ShimmerChart: React.FC = () => (
  <div className="h-72 rounded-lg bg-white shadow p-4 animate-pulse">
    <div className="h-6 w-1/3 bg-gray-200 rounded mb-4" />
    <div className="h-56 bg-gray-100 rounded" />
  </div>
);

// ---- Helpers
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

const regionOptions = ['All','Highlands Region','Islands Region','Momase Region','Papua Region'];

const ProvincialClaimsOfficerDashboard: React.FC = () => {
  const { profile } = useAuth();

  // --- Menus state (restored from your original)
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showPendingClaimsList, setShowPendingClaimsList] = useState(false);
  const [showForm6PendingList, setShowForm6PendingList] = useState(false);
  const [showForm18EmployerAcceptedList, setShowForm18EmployerAcceptedList] = useState(false);
  const [showForm18WorkerResponseList, setShowForm18WorkerResponseList] = useState(false);
  const [showForm17List, setShowForm17List] = useState(false);
  const [showForm7List, setShowForm7List] = useState(false);
  const [showCPOClaimReviewForm, setShowCPOClaimReviewForm] = useState(false);
  const [showCPODeathClaimReviewForm, setShowCPODeathClaimReviewForm] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string | null>(null);
  const [selectedIncidentType, setSelectedIncidentType] = useState<string | null>(null);

  // --- Dashboard filters
  const [year, setYear] = useState(new Date().getFullYear());
  const [region, setRegion] = useState<string>('All');

  // --- Greetings / user info
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [userStaffID, setUserStaffID] = useState<string | null>(null);

  // --- Data loading
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // KPI totals
  const [calcPendingTotal, setCalcPendingTotal] = useState(0);
  const [f6PendingTotal, setF6PendingTotal] = useState(0);
  const [f18EmpAcceptedTotal, setF18EmpAcceptedTotal] = useState(0);
  const [f18WorkerRespTotal, setF18WorkerRespTotal] = useState(0);

  // Monthly datasets
  const [calcPendingMonthly, setCalcPendingMonthly] = useState<MonthDatum[]>([]);
  const [f6PendingMonthly, setF6PendingMonthly] = useState<MonthDatum[]>([]);
  const [f18EmpAcceptedMonthly, setF18EmpAcceptedMonthly] = useState<MonthDatum[]>([]);
  const [f18WorkerRespMonthly, setF18WorkerRespMonthly] = useState<MonthDatum[]>([]);

  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;

  // Bootstrap: fetch user details & set default region
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!profile?.id) {
          setUserFullName('Provincial Officer');
          setUserStaffID('1000');
          setUserRegion('Momase Region');
          setRegion('Momase Region');
          return;
        }

        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('OSMFirstName, OSMLastName, OSMStaffID, InchargeRegion')
          .eq('cppsid', profile.id)
          .maybeSingle();
        if (error) throw error;

        const fullName = data ? `${data.OSMFirstName} ${data.OSMLastName}` : (profile.full_name || 'Provincial Officer');
        const staffId = data?.OSMStaffID ? String(data.OSMStaffID) : '1000';
        const reg = data?.InchargeRegion ?? 'Momase Region';
        const defaultRegion = regionOptions.includes(reg) ? reg : 'All';

        setUserFullName(fullName);
        setUserStaffID(staffId);
        setUserRegion(reg);
        setRegion(defaultRegion);
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? 'Failed to load user profile');
        // fallback
        setUserFullName(profile?.full_name || 'Provincial Officer');
        setUserStaffID('1000');
        setUserRegion('Momase Region');
        setRegion('Momase Region');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load KPI + charts when year/region changes
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const irns = await getRegionIRNs(region);
        const irnClause = (q: any) => (irns.length ? q.in('IRN', irns) : q);

        // 1) Calculation Pending (pending_cpor_claims) — date: CPORSubmissionDate, Region available directly
        {
          const base = supabase
            .from('pending_cpor_claims')
            .select('CPORSubmissionDate, IncidentRegion')
            .gte('CPORSubmissionDate', startISO)
            .lt('CPORSubmissionDate', endISO);
          const { data, error } = region !== 'All' ? await base.eq('IncidentRegion', region) : await base;
          if (error) throw error;
          const dates = (data ?? []).map(r => r.CPORSubmissionDate as string).filter(Boolean);
          setCalcPendingTotal(dates.length);
          setCalcPendingMonthly(groupCountsByMonth(dates));
        }

        // 2) F6 Employer Response Pending — table: form6master; status; date: F6MApprovalDate
        {
          const base = supabase
            .from('form6master')
            .select('IRN, F6MStatus, F6MApprovalDate')
            .eq('F6MStatus', 'Pending')
            .gte('F6MApprovalDate', startISO)
            .lt('F6MApprovalDate', endISO);
          const { data, error } = await irnClause(base);
          if (error) throw error;
          const dates = (data ?? []).map(r => r.F6MApprovalDate as string).filter(Boolean);
          setF6PendingTotal(dates.length);
          setF6PendingMonthly(groupCountsByMonth(dates));
        }

        // 3) F18 Employer Accepted — table: form18master; status; date: F18MEmployerAcceptedDate
        {
          const base = supabase
            .from('form18master')
            .select('IRN, F18MStatus, F18MEmployerAcceptedDate')
            .eq('F18MStatus', 'EmployerAccepted')
            .gte('F18MEmployerAcceptedDate', startISO)
            .lt('F18MEmployerAcceptedDate', endISO);
          const { data, error } = await irnClause(base);
          if (error) throw error;
          const dates = (data ?? []).map(r => r.F18MEmployerAcceptedDate as string).filter(Boolean);
          setF18EmpAcceptedTotal(dates.length);
          setF18EmpAcceptedMonthly(groupCountsByMonth(dates));
        }

        // 4) F18 Worker Response — table: form18master; NOT EmployerAccepted; date: F18MWorkerAcceptedDate
        {
          const base = supabase
            .from('form18master')
            .select('IRN, F18MStatus, F18MWorkerAcceptedDate')
            .neq('F18MStatus', 'EmployerAccepted')
            .gte('F18MWorkerAcceptedDate', startISO)
            .lt('F18MWorkerAcceptedDate', endISO);
          const { data, error } = await irnClause(base);
          if (error) throw error;
          const dates = (data ?? []).map(r => r.F18MWorkerAcceptedDate as string).filter(Boolean);
          setF18WorkerRespTotal(dates.length);
          setF18WorkerRespMonthly(groupCountsByMonth(dates));
        }
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    })();
  }, [region, year]);

  const pieF18Emp = useMemo(() => f18EmpAcceptedMonthly.filter(d => d.count > 0), [f18EmpAcceptedMonthly]);
  const pieF18Wrk = useMemo(() => f18WorkerRespMonthly.filter(d => d.count > 0), [f18WorkerRespMonthly]);

  // --- Menus (restored)
  const menuItems: Record<string, { items: string[] }> = {
    Claims: { items: ['Calculation Pending', 'Form6 Response Pending'] },
    Form18: { items: ['Employer Accepted', 'Worker Response'] },
    Form17: { items: [] },
    Form7:   { items: [] },
  };

  const toggleMenu = (menu: string) => setActiveMenu(activeMenu === menu ? null : menu);

  const handleMenuItemClick = (menu: string, item: string) => {
    if (menu === 'Claims' && item === 'Calculation Pending') {
      setShowPendingClaimsList(true);
    } else if (menu === 'Claims' && item === 'Form6 Response Pending') {
      setShowForm6PendingList(true);
    } else if (menu === 'Form18' && item === 'Employer Accepted') {
      setShowForm18EmployerAcceptedList(true);
    } else if (menu === 'Form18' && item === 'Worker Response') {
      setShowForm18WorkerResponseList(true);
    } else if (menu === 'Form17') {
      setShowForm17List(true);
    } else if (menu === 'Form7') {
      setShowForm7List(true);
    }
    setActiveMenu(null);
  };

  // When a worker is chosen from Calculation Pending list
  const handleWorkerSelect = (irn: string, incidentType: string) => {
    setSelectedIRN(irn);
    setSelectedIncidentType(incidentType);
    if (incidentType === 'Death') {
      setShowCPODeathClaimReviewForm(true);
      setShowCPOClaimReviewForm(false);
    } else {
      setShowCPOClaimReviewForm(true);
      setShowCPODeathClaimReviewForm(false);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header (matches DataEntryDashboard style) */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Provincial Claims Officer Dashboard</h1>
        <p className="text-gray-600">Welcome back, {userFullName || 'Provincial Officer'}</p>
        {userRegion && <p className="text-sm text-gray-500">Region: {userRegion}</p>}
        {userStaffID && <p className="text-sm text-gray-500">Staff ID: {userStaffID}</p>}
								  <GoToReportsButton />
      </div>

      {/* Navigation Menu (restored CPO menus) */}
      <div className="mb-8 bg-white rounded-lg shadow">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(menuItems).map(([menu, { items }]) => (
            <div key={menu} className="relative">
              <button
                onClick={() => toggleMenu(menu)}
                className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span className="font-medium">{menu}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${activeMenu === menu ? 'rotate-180' : ''}`}
                />
              </button>
              {activeMenu === menu && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
                  {(items.length ? items : ['View All']).map((item) => (
                    <button
                      key={item}
                      onClick={() => handleMenuItemClick(menu, item === 'View All' ? '' : item)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-md last:rounded-b-md"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Controls row: Year + Region */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
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

        {/* Region selector */}
        <div className="flex items-center gap-2 md:ml-auto">
          <span className="text-sm text-gray-600">Region:</span>
          <select
            className="px-2 py-1 border rounded"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={loading}
          >
            {regionOptions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{err}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loading ? <ShimmerCard lines={2} /> : (
          <div className="p-4 rounded-lg bg-white shadow">
            <div className="text-sm text-gray-600">Calculation Pending ({year})</div>
            <div className="text-3xl font-bold">{calcPendingTotal}</div>
          </div>
        )}
        {loading ? <ShimmerCard lines={2} /> : (
          <div className="p-4 rounded-lg bg-white shadow">
            <div className="text-sm text-gray-600">F6 Employer Response Pending ({year})</div>
            <div className="text-3xl font-bold">{f6PendingTotal}</div>
          </div>
        )}
        {loading ? <ShimmerCard lines={2} /> : (
          <div className="p-4 rounded-lg bg-white shadow">
            <div className="text-sm text-gray-600">F18 Employer Accepted ({year})</div>
            <div className="text-3xl font-bold">{f18EmpAcceptedTotal}</div>
          </div>
        )}
        {loading ? <ShimmerCard lines={2} /> : (
          <div className="p-4 rounded-lg bg-white shadow">
            <div className="text-sm text-gray-600">F18 Worker Response ({year})</div>
            <div className="text-3xl font-bold">{f18WorkerRespTotal}</div>
          </div>
        )}
      </div>

      {/* Charts Row 1: Bars (colorful) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {loading ? <ShimmerChart /> : (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">
              Calculation Pending per Month · Total: {calcPendingTotal}
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calcPendingMonthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Calculation Pending">
                    {calcPendingMonthly.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {loading ? <ShimmerChart /> : (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">
              F6 Employer Response Pending per Month · Total: {f6PendingTotal}
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={f6PendingMonthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="F6 Pending">
                    {f6PendingMonthly.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row 2: Pies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {loading ? <ShimmerChart /> : (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">
              F18 Employer Accepted per Month · Total: {f18EmpAcceptedTotal}
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="count" data={pieF18Emp} nameKey="label" label>
                    {pieF18Emp.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {loading ? <ShimmerChart /> : (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">
              F18 Worker Response per Month · Total: {f18WorkerRespTotal}
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="count" data={pieF18Wrk} nameKey="label" label>
                    {pieF18Wrk.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* LIST/REVIEW MODALS (restored) */}
      {showPendingClaimsList && (
        <ListPendingRegisteredClaimsCPOReview
          onClose={() => setShowPendingClaimsList(false)}
          onSelectWorker={handleWorkerSelect}
        />
      )}
      {showForm6PendingList && (
        <ListForm6NotificationEmployerResponsePending
          onClose={() => setShowForm6PendingList(false)}
        />
      )}
      {showForm18EmployerAcceptedList && (
        <ListForm18EmployerAccepted
          onClose={() => setShowForm18EmployerAcceptedList(false)}
        />
      )}
      {showForm18WorkerResponseList && (
        <ListForm18WorkerResponse
          onClose={() => setShowForm18WorkerResponseList(false)}
        />
      )}
      {showForm17List && (
        <ListForm17 onClose={() => setShowForm17List(false)} />
      )}
      {showForm7List && (
        <ListForm7 onClose={() => setShowForm7List(false)} />
      )}

      {showCPOClaimReviewForm && selectedIRN && (
        <CPOClaimReviewForm
          irn={selectedIRN}
          onClose={() => {
            setShowCPOClaimReviewForm(false);
            setSelectedIRN(null);
            setSelectedIncidentType(null);
          }}
        />
      )}
      {showCPODeathClaimReviewForm && selectedIRN && (
        <CPODeathClaimReviewForm
          irn={selectedIRN}
          onClose={() => {
            setShowCPODeathClaimReviewForm(false);
            setSelectedIRN(null);
            setSelectedIncidentType(null);
          }}
        />
      )}
    </div>
  );
};

export default ProvincialClaimsOfficerDashboard;
