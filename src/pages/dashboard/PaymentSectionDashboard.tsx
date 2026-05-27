import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Clock, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';
import { supabase } from '../../services/supabase';

// Lists
import ListPendingClaimsAwardedPaymentSection
  from '../../components/forms/ListPendingClaimsAwardedPaymentSection';
import ListOnHoldClaimsAwardedPaymentSectionReview
  from '../../components/forms/ListOnHoldClaimsAwardedPaymentSectionReview';
import ListApprovedClaimsAwardedPaymentSectionReview
  from '../../components/forms/ListApprovedClaimsAwardedPaymentSectionReview';
import ListRejectedClaimsAwardedPaymentSectionReview
  from '../../components/forms/ListRejectedClaimsAwardedPaymentSectionReview';

// Process Payments view
import ProcessPaymentsForClaimsAwardedPaymentSection
  from '../../components/forms/ProcessPaymentsForClaimsAwardedPaymentSection';

// Bank Reconciliation view
import BankReconciliation
  from '../../components/forms/BankReconciliation';

type ViewKey =
  | 'pending-awarded'
  | 'onhold-manager'
  | 'approved-manager'
  | 'rejected-manager'
  | 'process-payments'
  | 'bank-recon'
  | null;

// ---------- lightweight SVG charts (no external chart libs) ----------
const SvgLineChart: React.FC<{
  labels: string[];
  series: { name: string; data: number[]; color: string }[];
  title: string;
  yearlyTotal: number;
}> = ({ labels, series, title, yearlyTotal }) => {
  const W = 980, H = 260, P = 50; // bigger padding so Y ticks fit
  const maxVal = Math.max(1, ...series.flatMap(s => s.data));

  const xStep = (W - P * 2) / Math.max(1, labels.length - 1);
  const x = (i: number) => P + i * xStep;
  const y = (v: number) => H - P - (v / maxVal) * (H - P * 2);

  const pathFor = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');

  // Y-axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal * i) / tickCount);

  const fmtK = (n: number) => {
    const v = Math.round(n);
    return `K${v.toLocaleString()}`;
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="text-sm text-gray-600">
          Yearly Total: <b>{`K${yearlyTotal.toLocaleString()}`}</b>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px]">
        {/* Axes */}
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#cbd5e1" />
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#cbd5e1" />

        {/* Y-axis label (Amount) */}
        <text
          x={14}
          y={H / 2}
          fontSize="12"
          fill="#475569"
          textAnchor="middle"
          transform={`rotate(-90 14 ${H / 2})`}
        >
					{/* Amount (Kina) */}
        </text>

        {/* Y-axis ticks + labels */}
        {ticks.map((tv, i) => {
          const yy = y(tv);
          return (
            <g key={`yt-${i}`}>
              <line x1={P - 6} y1={yy} x2={P} y2={yy} stroke="#94a3b8" />
              <text x={P - 10} y={yy + 3} fontSize="10" fill="#475569" textAnchor="end">
                {fmtK(tv)}
              </text>
              {/* light gridline */}
              <line x1={P} y1={yy} x2={W - P} y2={yy} stroke="#e2e8f0" />
            </g>
          );
        })}

        {/* Lines */}
        {series.map((s) => (
          <path key={s.name} d={pathFor(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" />
        ))}

        {/* X-axis labels (months) */}
        {labels.map((lab, i) =>
          i % 1 === 0 ? (
            <text key={lab} x={x(i)} y={H - 12} fontSize="10" textAnchor="middle" fill="#475569">
              {lab}
            </text>
          ) : null
        )}
      </svg>

      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ background: s.color }} />
            <span className="text-gray-700">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};


const SvgGroupedBarChart: React.FC<{
  labels: string[];
  groups: { name: string; data: number[]; color: string }[];
  title: string;
  yearlyTotal: number;
}> = ({ labels, groups, title, yearlyTotal }) => {
  const W = 980, H = 300, P = 50; // bigger padding so Y ticks fit
  const maxVal = Math.max(1, ...groups.flatMap(g => g.data));

  const n = labels.length;
  const groupCount = groups.length;
  const slot = (W - P * 2) / n;
  const barW = Math.max(4, (slot * 0.7) / groupCount);

  const y = (v: number) => H - P - (v / maxVal) * (H - P * 2);

  // Y-axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal * i) / tickCount);

  const fmtK = (n: number) => {
    const v = Math.round(n);
    return `K${v.toLocaleString()}`;
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="text-sm text-gray-600">
          Yearly Total: <b>{`K${yearlyTotal.toLocaleString()}`}</b>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[300px]">
        {/* Axes */}
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#cbd5e1" />
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#cbd5e1" />

        {/* Y-axis label (Amount) */}
        <text
          x={14}
          y={H / 2}
          fontSize="12"
          fill="#475569"
          textAnchor="middle"
          transform={`rotate(-90 14 ${H / 2})`}
        >
					{/* Amount (Kina)*/}
        </text>

        {/* Y-axis ticks + labels */}
        {ticks.map((tv, i) => {
          const yy = y(tv);
          return (
            <g key={`ytb-${i}`}>
              <line x1={P - 6} y1={yy} x2={P} y2={yy} stroke="#94a3b8" />
              <text x={P - 10} y={yy + 3} fontSize="10" fill="#475569" textAnchor="end">
                {fmtK(tv)}
              </text>
              {/* light gridline */}
              <line x1={P} y1={yy} x2={W - P} y2={yy} stroke="#e2e8f0" />
            </g>
          );
        })}

        {/* Bars + X labels */}
        {labels.map((lab, i) => {
          const baseX = P + i * slot + slot * 0.15;
          return (
            <g key={lab}>
              {groups.map((g, gi) => {
                const v = g.data[i] || 0;
                const yTop = y(v);
                const h = (H - P) - yTop;
                const xBar = baseX + gi * barW;
                return (
                  <rect
                    key={`${lab}-${g.name}`}
                    x={xBar}
                    y={yTop}
                    width={barW - 2}
                    height={h}
                    fill={g.color}
                    rx="2"
                  />
                );
              })}

              <text
                x={P + i * slot + slot / 2}
                y={H - 12}
                fontSize="10"
                textAnchor="middle"
                fill="#475569"
              >
                {lab}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {groups.map((g) => (
          <div key={g.name} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ background: g.color }} />
            <span className="text-gray-700">{g.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------- component --------------------
const PaymentSectionDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewKey>(null);

  // Year switcher
  const thisYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(thisYear);

  // Cards (counts)
  const [pendingCount, setPendingCount] = useState(0);
  const [onHoldCount, setOnHoldCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  // Charts data
  const empty12 = () => Array.from({ length: 12 }, () => 0);
  const [monthlyTotals, setMonthlyTotals] = useState<number[]>(empty12());

  const [monthlyClaimType, setMonthlyClaimType] = useState<{
    StateInsured: number[];
    PrivateInsured: number[];
    PrivateUninsured: number[];
  }>({
    StateInsured: empty12(),
    PrivateInsured: empty12(),
    PrivateUninsured: empty12(),
  });

  const [monthlyIncident, setMonthlyIncident] = useState<{
    Injury: number[];
    Death: number[];
  }>({
    Injury: empty12(),
    Death: empty12(),
  });

  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  const monthLabels = useMemo(
    () => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    []
  );

  const menuItems = {
    'Claims Awarded For Payment': {
      items: [
        'Payment Pending from Insurance/Employer',
        'Payment OnHold by Payments Manager',
        'Payment Approved by Payments Manager',
        'Payment Rejected by Payments Manager',
      ],
    },
    'Process Payments': { items: ['Process Payments'] },
    'Bank Reconciliation': { items: ['Bank Reconciliation'] },
  } as const;

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const handleMenuItemClick = (menu: string, item: string) => {
    const m = normalize(menu);
    const i = normalize(item);

    if (m === normalize('Claims Awarded For Payment')) {
      if (i === normalize('Payment Pending from Insurance/Employer') || i === normalize('Payment Pending Insurance/Employer')) {
        setCurrentView('pending-awarded');
      } else if (i === normalize('Payment OnHold by Payments Manager')) {
        setCurrentView('onhold-manager');
      } else if (i === normalize('Payment Approved by Payments Manager')) {
        setCurrentView('approved-manager');
      } else if (i === normalize('Payment Rejected by Payments Manager')) {
        setCurrentView('rejected-manager');
      } else {
        setCurrentView(null);
      }
    } else if (m === normalize('Process Payments')) {
      setCurrentView(i === normalize('Process Payments') ? 'process-payments' : null);
    } else if (m === normalize('Bank Reconciliation')) {
      setCurrentView(i === normalize('Bank Reconciliation') ? 'bank-recon' : null);
    } else {
      setCurrentView(null);
    }

    setActiveMenu(null);
  };

  const handleCloseList = () => setCurrentView(null);

  // ---------- dashboard loaders ----------
  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;

  // Fetch all rows helper (handles > 1000 rows)
  const fetchAll = async <T,>(
    queryFactory: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
  ): Promise<T[]> => {
    const pageSize = 1000;
    let out: T[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await queryFactory(from, from + pageSize - 1);
      if (error) throw error;
      const chunk = (data || []) as T[];
      out = out.concat(chunk);
      if (chunk.length < pageSize) break;
      from += pageSize;
    }
    return out;
  };

  // Counts from views (SubmissionDateFormatted)
  const loadCardCounts = async () => {
    // Using a broad match for year so it works if format is dd/mm/yyyy or yyyy-mm-dd
    const yearNeedle = String(selectedYear);

    const getCount = async (viewName: string) => {
      const { count, error } = await supabase
        .from(viewName)
        .select('IRN', { count: 'exact', head: true })
        .ilike('SubmissionDate', `%${yearNeedle}%`);

      if (error) throw error;
      return count || 0;
    };

    const [p, h, a, r] = await Promise.all([
      getCount('pending_awarded_claims_paymentsection_view'),
      getCount('onhold_awarded_claims_paymentsmanagerreview_view'),
      getCount('approved_awarded_claims_paymentsmanagerreview_view'),
      getCount('rejected_awarded_claims_paymentsmanagerreview_view'),
    ]);

    setPendingCount(p);
    setOnHoldCount(h);
    setApprovedCount(a);
    setRejectedCount(r);
  };

  type ReviewRow = {
    IRN: string | number;
    CAPSRReviewDate?: string | null;
    ClaimType?: string | null;     // StateInsured | PrivateInsured | PrivateUninsured
    IncidentType?: string | null;  // Injury | Death
  };

  type DepRow = {
    IRN: string | number;
    EbankAmountPaid?: number | string | null;
  };

  const monthIndex = (d: any) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return -1;
    return dt.getMonth(); // 0..11
  };

  const loadCharts = async () => {
    // 1) review rows for year
    const reviews = await fetchAll<ReviewRow>((from, to) =>
      supabase
        .from('claimsawardedpaymentsectionreview')
        .select('IRN, CAPSRReviewDate, ClaimType, IncidentType')
        .gte('CAPSRReviewDate', yearStart)
        .lte('CAPSRReviewDate', yearEnd)
        .range(from, to)
    );

    const irns = Array.from(new Set(reviews.map(r => r.IRN).filter(Boolean)));
    if (irns.length === 0) {
      setMonthlyTotals(empty12());
      setMonthlyClaimType({ StateInsured: empty12(), PrivateInsured: empty12(), PrivateUninsured: empty12() });
      setMonthlyIncident({ Injury: empty12(), Death: empty12() });
      return;
    }

    // 2) deposits for IRNs
    const deposits = await fetchAll<DepRow>((from, to) =>
      supabase
        .from('bankaccountdepositmaster')
        .select('IRN, EbankAmountPaid')
        .in('IRN', irns)
        .range(from, to)
    );

    const paidByIrn: Record<string, number> = {};
    for (const d of deposits) {
      paidByIrn[String(d.IRN)] = Number(d.EbankAmountPaid ?? 0) || 0;
    }

    // 3) aggregate by month
    const totals = empty12();

    const ct = {
      StateInsured: empty12(),
      PrivateInsured: empty12(),
      PrivateUninsured: empty12(),
    };

    const it = {
      Injury: empty12(),
      Death: empty12(),
    };

    for (const r of reviews) {
      const mi = monthIndex(r.CAPSRReviewDate);
      if (mi < 0) continue;

      const amt = paidByIrn[String(r.IRN)] ?? 0;
      totals[mi] += amt;

      const claimType = String(r.ClaimType ?? '').trim();
      if (claimType === 'StateInsured') ct.StateInsured[mi] += amt;
      else if (claimType === 'PrivateInsured') ct.PrivateInsured[mi] += amt;
      else if (claimType === 'PrivateUninsured') ct.PrivateUninsured[mi] += amt;

      const incidentType = String(r.IncidentType ?? '').trim();
      if (incidentType === 'Injury') it.Injury[mi] += amt;
      else if (incidentType === 'Death') it.Death[mi] += amt;
    }

    setMonthlyTotals(totals);
    setMonthlyClaimType(ct);
    setMonthlyIncident(it);
  };

  const loadDashboard = async () => {
    setDashLoading(true);
    setDashError(null);
    try {
      await Promise.all([loadCardCounts(), loadCharts()]);
    } catch (e: any) {
      console.error(e);
      setDashError(e?.message || 'Failed to load dashboard data.');
    } finally {
      setDashLoading(false);
    }
  };

  useEffect(() => {
    if (currentView !== null) return; // only load on default dashboard view
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, currentView]);

  // Totals
  const yearlyTotalPayments = monthlyTotals.reduce((s, v) => s + (Number(v) || 0), 0);

  const yearlyTotalClaimType =
    [...monthlyClaimType.StateInsured, ...monthlyClaimType.PrivateInsured, ...monthlyClaimType.PrivateUninsured]
      .reduce((s, v) => s + (Number(v) || 0), 0);

  const yearlyTotalIncident =
    [...monthlyIncident.Injury, ...monthlyIncident.Death]
      .reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payment Section Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Payment Officer'}</p>
        <GoToReportsButton />
      </div>

      {/* Navigation Menu */}
      <div className="mb-8 bg-white rounded-lg shadow">
        <div className="p-4 grid grid-cols-1 gap-4">
          {Object.entries(menuItems).map(([menu, { items }]) => (
            <div key={menu} className="relative">
              <button
                onClick={() => toggleMenu(menu)}
                className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span className="font-medium">{menu}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${activeMenu === menu ? 'transform rotate-180' : ''}`}
                />
              </button>
              {activeMenu === menu && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
                  {items.map((item) => (
                    <button
                      key={item}
                      onClick={() => handleMenuItemClick(menu, item)}
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

      {/* Conditional view area */}
      {currentView === 'pending-awarded' ? (
        <div className="card p-4">
          <h2 className="text-xl font-semibold mb-4">
            Claims Awarded — Payment Pending (Insurance/Employer)
          </h2>
          <ListPendingClaimsAwardedPaymentSection onClose={handleCloseList} />
        </div>
      ) : currentView === 'onhold-manager' ? (
        <div className="card p-4">
          <h2 className="text-xl font-semibold mb-4">
            Claims Awarded — Payment On Hold (by Payments Manager)
          </h2>
          <ListOnHoldClaimsAwardedPaymentSectionReview onClose={handleCloseList} />
        </div>
      ) : currentView === 'approved-manager' ? (
        <div className="card p-4">
          <h2 className="text-xl font-semibold mb-4">
            Claims Awarded — Payment Approved (by Payments Manager)
          </h2>
          <ListApprovedClaimsAwardedPaymentSectionReview onClose={handleCloseList} />
        </div>
      ) : currentView === 'rejected-manager' ? (
        <div className="card p-4">
          <h2 className="text-xl font-semibold mb-4">
            Claims Awarded — Payment Rejected (by Payments Manager)
          </h2>
          <ListRejectedClaimsAwardedPaymentSectionReview onClose={handleCloseList} />
        </div>
      ) : currentView === 'process-payments' ? (
        <div className="card p-4">
          <h2 className="text-xl font-semibold mb-4">Process Payments</h2>
          <ProcessPaymentsForClaimsAwardedPaymentSection onClose={handleCloseList} />
        </div>
      ) : currentView === 'bank-recon' ? (
        <div className="card p-4">
          <h2 className="text-xl font-semibold mb-4">Bank Reconciliation</h2>
          <BankReconciliation onClose={handleCloseList} />
        </div>
      ) : (
        <>
          {/* Year Switcher */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
              <p className="text-sm text-gray-600">
                Showing statistics for year: <b>{selectedYear}</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                onClick={() => setSelectedYear(y => y - 1)}
              >
                &laquo; {selectedYear - 1}
              </button>

              <button
                className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                onClick={() => setSelectedYear(thisYear)}
              >
                Current Year ({thisYear})
              </button>

              <button
                className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setSelectedYear(y => y + 1)}
                disabled={selectedYear >= thisYear}
                title={selectedYear >= thisYear ? 'You are already on the current year' : 'Go forward'}
              >
                {selectedYear + 1} &raquo;
              </button>
            </div>
          </div>

          {dashError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
              {dashError}
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card hover:shadow-md">
              <div className="flex items-center">
                <div className="rounded-full p-3 bg-amber-100 mr-4">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pending Payments</p>
                  <p className="text-2xl font-bold">{dashLoading ? '…' : pendingCount}</p>
                </div>
              </div>
            </div>

            <div className="card hover:shadow-md">
              <div className="flex items-center">
                <div className="rounded-full p-3 bg-blue-100 mr-4">
                  <ArrowUpRight className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">OnHold Payments</p>
                  <p className="text-2xl font-bold">{dashLoading ? '…' : onHoldCount}</p>
                </div>
              </div>
            </div>

            <div className="card hover:shadow-md">
              <div className="flex items-center">
                <div className="rounded-full p-3 bg-green-100 mr-4">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Approved Payment</p>
                  <p className="text-2xl font-bold">{dashLoading ? '…' : approvedCount}</p>
                </div>
              </div>
            </div>

            <div className="card hover:shadow-md">
              <div className="flex items-center">
                <div className="rounded-full p-3 bg-red-100 mr-4">
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rejected Payments</p>
                  <p className="text-2xl font-bold">{dashLoading ? '…' : rejectedCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SvgLineChart
              title="Total Payments by Month"
              labels={monthLabels}
              series={[
                { name: 'Total', data: monthlyTotals, color: '#2563eb' },
              ]}
              yearlyTotal={yearlyTotalPayments}
            />

            <SvgLineChart
              title="Payments by ClaimType per Month"
              labels={monthLabels}
              series={[
                { name: 'StateInsured', data: monthlyClaimType.StateInsured, color: '#16a34a' },
                { name: 'PrivateInsured', data: monthlyClaimType.PrivateInsured, color: '#2563eb' },
                { name: 'PrivateUninsured', data: monthlyClaimType.PrivateUninsured, color: '#dc2626' },
              ]}
              yearlyTotal={yearlyTotalClaimType}
            />
          </div>

          <div className="mt-8">
            <SvgGroupedBarChart
              title="Payments by IncidentType per Month"
              labels={monthLabels}
              groups={[
                { name: 'Injury', data: monthlyIncident.Injury, color: '#2563eb' },
                { name: 'Death', data: monthlyIncident.Death, color: '#dc2626' },
              ]}
              yearlyTotal={yearlyTotalIncident}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PaymentSectionDashboard;
