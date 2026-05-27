// /src/pages/dashboard/CommissionerDashboard.tsx
import React, { useState, useEffect } from 'react';
import { FileText, Users, Clock, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData
} from 'chart.js';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ✅ Use the SAME list components as Chief Commissioner
import ListPendingClaimsForChiefCommissionerReview from '../../components/forms/ListPendingClaimsForChiefCommissionerReview';
import ListApproveClaimsForCommissionerReview from '../../components/forms/ListApprovedClaimsForCommissionerReview';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Standard OWC Logo
const CREST_URL = "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

const CommissionerDashboard: React.FC = () => {
  const { profile } = useAuth();

  const [userFullName, setUserFullName] = useState<string>(profile?.full_name || 'Commissioner');
  const [userStaffID, setUserStaffID] = useState<string>('1000');

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const fetchCountsInProgress = React.useRef(false);
  const fetchReportInProgress = React.useRef(false);
  const [showPendingClaimsList, setShowPendingClaimsList] = useState(false);
  const [showApprovedClaimsList, setShowApprovedClaimsList] = useState(false);

  // Counts
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Charts
  const [yearlyChartData, setYearlyChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });
  const [monthlyChartData, setMonthlyChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });

  // Approved Award Reports State
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [filterType, setFilterType] = useState<'Annual' | 'Monthly' | 'Quarterly'>('Annual');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));

  const [reportData, setReportData] = useState<any>({
    sector: { labels: [], datasets: [] },
    insurance: { labels: [], datasets: [] },
    officer: { labels: [], datasets: [] },
    injury: { labels: [], datasets: [] },
    province: { labels: [], datasets: [] },
    region: { labels: [], datasets: [] }
  });
  const [grandTotalAmount, setGrandTotalAmount] = useState<number>(0);
  const [reportLoading, setReportLoading] = useState(false);

  const menuItems = {
    'Awarded Claim Review': {
      items: ['Pending', 'Approved']
    }
  };

  useEffect(() => {
    fetchCounts();
    generateChartData();
    fetchReportData();

    const interval = setInterval(() => {
      fetchCounts();
    }, 60000);

    return () => clearInterval(interval);
  }, [selectedYear, filterType, selectedMonth, selectedQuarter]);

  const fetchCounts = async () => {
    if (fetchCountsInProgress.current) return;
    try {
      fetchCountsInProgress.current = true;
      setLoading(true);

      // Simplified counts
      const { count: pendingCnt, error: pendingErr } = await supabase
        .from('commissioner_pending_view')
        .select('*', { count: 'exact', head: true });
      if (pendingErr) throw pendingErr;

      const { count: approvedCnt, error: approvedErr } = await supabase
        .from('commissioner_approved_view')
        .select('*', { count: 'exact', head: true });
      if (approvedErr) throw approvedErr;

      setPendingCount(pendingCnt || 0);
      setApprovedCount(approvedCnt || 0);
    } catch (error) {
      console.error('Error fetching counts:', error);
    } finally {
      setLoading(false);
      fetchCountsInProgress.current = false;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (!profile?.id) {
          setUserFullName('Commissioner');
          setUserStaffID('1000');
          return;
        }
        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('OSMFirstName, OSMFirstName, OSMStaffID, OSMLastName')
          .eq('cppsid', profile.id)
          .maybeSingle();

        if (error) throw error;

        const fullName =
          data ? `${data.OSMFirstName} ${data.OSMLastName}` : (profile.full_name || 'Commissioner');
        const staffId = data?.OSMStaffID ? String(data.OSMStaffID) : '1000';

        setUserFullName(fullName);
        setUserStaffID(staffId);
      } catch (e) {
        console.error('Failed to load user profile for dashboard header:', e);
        setUserFullName(profile?.full_name || 'Commissioner');
        setUserStaffID('1000');
      }
    })();
  }, [profile?.id]);

  const fetchReportData = async () => {
    if (fetchReportInProgress.current) return;
    try {
      fetchReportInProgress.current = true;
      setReportLoading(true);
      
      let startDate = `${selectedYear}-01-01`;
      let endDate = `${selectedYear + 1}-01-01`;

      if (filterType === 'Monthly') {
        const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
        startDate = `${selectedYear}-${m}-01`;
        const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
        const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
        const nm = nextMonth < 10 ? `0${nextMonth}` : nextMonth;
        endDate = `${nextYear}-${nm}-01`;
      } else if (filterType === 'Quarterly') {
        const qMap: any = { 1: ['01', '04'], 2: ['04', '07'], 3: ['07', '10'], 4: ['10', '01'] };
        startDate = `${selectedYear}-${qMap[selectedQuarter][0]}-01`;
        endDate = `${selectedQuarter === 4 ? selectedYear + 1 : selectedYear}-${qMap[selectedQuarter][1]}-01`;
      }

      // 1. Fetch records with optimized server-side filter (STRICTLY Decision Date)
      const { data: cacrRecords, error: cacrErr } = await supabase
        .from('claimsawardedcommissionersreview')
        .select('IRN, CACRReviewStatus, CACRDecisionDate, CACRSubmissionDate')
        .or('CACRReviewStatus.ilike.*Accepted*,CACRReviewStatus.ilike.*Approved*')
        .gte('CACRDecisionDate', startDate)
        .lt('CACRDecisionDate', endDate)
        .limit(2000);

      if (cacrErr) throw cacrErr;
      if (!cacrRecords || cacrRecords.length === 0) {
        setReportData({
          sector: { labels: [], datasets: [] },
          insurance: { labels: [], datasets: [] },
          officer: { labels: [], datasets: [] },
          injury: { labels: [], datasets: [] },
          province: { labels: [], datasets: [] },
          region: { labels: [], datasets: [] }
        });
        return;
      }

      const irns = cacrRecords.map(r => r.IRN);

      const [
        { data: f1112Records },
        { data: amountRecords },
        { data: approvedCpoRecords }
      ] = await Promise.all([
        supabase.from('form1112master').select('IRN, WorkerID, IncidentProvince, IncidentRegion, IncidentType, InsuranceProviderIPACode, FirstSubmissionDate').in('IRN', irns),
        supabase.from('claimcompensationworkerdetails').select('IRN, CCWDCompensationAmount').in('IRN', irns),
        supabase.from('approvedclaimscporeview').select('IRN, LockedByCPOID').in('IRN', irns)
      ]);

      const validF1112 = (f1112Records || []).filter(f => {
        const cacr = cacrRecords.find(c => String(c.IRN) === String(f.IRN));
        const dateStr = cacr?.CACRDecisionDate;
        if (!dateStr) return false;
        
        const parts = dateStr.split('-');
        const recordYear = parseInt(parts[0]);
        const recordMonth = parseInt(parts[1]);
        const recordQuarter = Math.ceil(recordMonth / 3);

        if (recordYear !== selectedYear) return false;
        if (filterType === 'Monthly' && recordMonth !== selectedMonth) return false;
        if (filterType === 'Quarterly' && recordQuarter !== selectedQuarter) return false;

        return true;
      });
      const validIrns = new Set(validF1112.map(f => String(f.IRN)));

      const officerIds = Array.from(new Set(approvedCpoRecords?.filter(r => validIrns.has(String(r.IRN))).map(r => r.LockedByCPOID).filter(Boolean) || []));
      const { data: staffRecords } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID, OSMFirstName, OSMLastName')
        .in('OSMStaffID', officerIds);

      const staffMap = (staffRecords || []).reduce((acc: any, s: any) => {
        acc[s.OSMStaffID] = `${s.OSMFirstName} ${s.OSMLastName}`;
        return acc;
      }, {});

      const workerIds = Array.from(new Set(validF1112.map(f => f.WorkerID).filter(Boolean)));
      const { data: employDetails } = await supabase.from('currentemploymentdetails').select('WorkerID, EmployerCPPSID').in('WorkerID', workerIds);
      const employerIds = Array.from(new Set(employDetails?.map(r => r.EmployerCPPSID).filter(Boolean) || []));
      const { data: employerMasters } = await supabase.from('employermaster').select('CPPSID, InsuranceProviderIPACode').in('CPPSID', employerIds);
      const ipaCodes = Array.from(new Set([
        ...validF1112.map(f => f.InsuranceProviderIPACode).filter(Boolean),
        ...employerMasters?.map(em => em.InsuranceProviderIPACode).filter(Boolean) || []
      ]));
      const { data: insuranceMasters } = await supabase.from('insurancecompanymaster').select('IPACODE, InsuranceCompanyOrganizationName').in('IPACODE', ipaCodes);
      const insuranceMap = (insuranceMasters || []).reduce((acc: any, i: any) => {
        acc[i.IPACODE] = i.InsuranceCompanyOrganizationName;
        return acc;
      }, {});
      // Removed unused insuranceMap declaration to satisfy lint

      const aggregates: any = {
        sector: {}, insurance: {}, officer: {}, injury: {}, province: {}, region: {}
      };

      let gTotal = 0;
      validF1112.forEach(f => {
        const irn = String(f.IRN);
        const amount = amountRecords?.filter(a => String(a.IRN) === irn).reduce((s, c) => s + (c.CCWDCompensationAmount || 0), 0) || 0;
        gTotal += amount;
        
        // Robust Insurance Identification Logic (Prioritizing 'Long Way' per user instruction)
        let insName = '';
        const isPublic = f.IncidentType === 'Public';

        if (isPublic) {
          insName = 'State';
        } else {
          const shortIpa = f.InsuranceProviderIPACode;
          let longIpa = undefined;

          // Perform 'Long Way' Lookup
          if (f.WorkerID) {
            const det = employDetails?.find(d => d.WorkerID === f.WorkerID);
            if (det) {
              const mast = employerMasters?.find(m => m.CPPSID === det.EmployerCPPSID);
              longIpa = mast?.InsuranceProviderIPACode;
            }
          }

          // Hierarchy Priority: Long Way > Short Way
          // Use Long Way if Short Way is missing OR different from Long Way
          let finalIpa = shortIpa;
          if (!shortIpa || (longIpa && shortIpa !== longIpa)) {
            finalIpa = longIpa || shortIpa;
          }

          if (finalIpa) {
            const insNameFromMap = insuranceMap[finalIpa];
            if (insNameFromMap) {
              insName = insNameFromMap;
            } else {
              insName = finalIpa; // Fallback to IPA Code
              console.info(`[UNMAPPED INSURANCE] IRN: ${irn}, IPA Code: ${finalIpa} (Used ${finalIpa === longIpa ? 'Long Way' : 'Short Way'})`);
            }
          } else {
            insName = 'Unknown (No IPA Code)';
            console.info(`[MISSING IPA CODE] IRN: ${irn}`);
          }
        }

        const sec = (insName === 'State') ? 'Public' : 'Private';
        const cpo = approvedCpoRecords?.find(c => String(c.IRN) === irn);
        const cpoid = cpo?.LockedByCPOID;
        let off = 'N/A';
        if (cpoid) {
          off = staffMap[cpoid] || cpoid;
          if (!staffMap[cpoid]) {
            console.info(`[UNMAPPED OFFICER] IRN: ${irn}, CPO ID: ${cpoid}`);
          }
        }

        const update = (cat: string, key: string) => {
          if (!aggregates[cat][key]) aggregates[cat][key] = 0;
          aggregates[cat][key] += amount;
        };

        update('sector', sec);
        update('insurance', insName);
        update('officer', off);
        update('injury', f.IncidentType || 'N/A');
        update('province', f.IncidentProvince || 'N/A');
        update('region', f.IncidentRegion || 'N/A');
      });

      setGrandTotalAmount(gTotal);

      const filterLabel = filterType === 'Annual' ? String(selectedYear) : 
                          filterType === 'Monthly' ? `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear}` :
                          `Q${selectedQuarter} ${selectedYear}`;

      const buildChart = (data: any, label: string, color: string) => ({
        labels: Object.keys(data),
        datasets: [{
          label: `${label} (${filterLabel})`,
          data: Object.values(data),
          backgroundColor: color,
        }]
      });

      setReportData({
        sector: buildChart(aggregates.sector, 'Amount by Sector', '#0ea5e9'),
        insurance: buildChart(aggregates.insurance, 'Amount by Insurance', '#22c55e'),
        officer: buildChart(aggregates.officer, 'Amount by Officer', '#f59e0b'),
        injury: buildChart(aggregates.injury, 'Amount by Injury', '#ef4444'),
        province: buildChart(aggregates.province, 'Amount by Province', '#8b5cf6'),
        region: buildChart(aggregates.region, 'Amount by Region', '#14b8a6')
      });

    } catch (e) {
      console.error('fetchReportData error:', e);
    } finally {
      setReportLoading(false);
      fetchReportInProgress.current = false;
    }
  };

  const handleExportAll = async (format: 'pdf' | 'csv') => {
    const periodLabel = filterType === 'Annual' ? `Yearly_${selectedYear}` : 
                        filterType === 'Monthly' ? `${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })}_${selectedYear}` :
                        `Q${selectedQuarter}_${selectedYear}`;
    
    const displayTitle = filterType === 'Annual' ? `Annual View Report ${selectedYear}` :
                         filterType === 'Monthly' ? `Monthly View Report - ${new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} ${selectedYear}` :
                         `Quarterly View Report - Q${selectedQuarter} (${['Jan-Mar','Apr-Jun','Jul-Sep','Oct-Dec'][selectedQuarter-1]}) ${selectedYear}`;

    if (format === 'csv') {
      const headers = ["Category", "Key", "Total Amount"];
      let csv = `Report Title: ${displayTitle}\n`;
      csv += `Grand Total: K ${grandTotalAmount.toLocaleString()}\n\n`;
      csv += headers.join(",") + "\n";
      Object.entries(reportData).forEach(([cat, data]: [string, any]) => {
        data.labels.forEach((label: string, i: number) => {
          csv += `${cat},"${label}",${data.datasets[0].data[i]}\n`;
        });
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `Approved_Awards_Summary_${periodLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let cursorY = 20;

      // Logo Support
      try {
        const img = new Image();
        img.src = CREST_URL;
        await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        if (img.complete) {
          doc.addImage(img, 'PNG', (pageWidth - 30) / 2, cursorY, 30, 30);
          cursorY += 40;
        }
      } catch (e) { console.warn("Logo failed to load", e); }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PAPUA NEW GUINEA", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 15;
      doc.text("OFFICE OF WORKERS COMPENSATION", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 20;

      doc.setFontSize(12);
      doc.text(displayTitle, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 15;
      doc.setFont("helvetica", "normal");
      doc.text(`Grand Total For Selection: K ${grandTotalAmount.toLocaleString()}`, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 20;

      Object.entries(reportData).forEach(([cat, data]: [string, any]) => {
        if (cursorY > 250) { doc.addPage(); cursorY = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`By ${cat.toUpperCase()}`, 14, cursorY);
        cursorY += 7;

        const rows = data.labels.map((label: string, i: number) => [label, `K ${data.datasets[0].data[i].toLocaleString()}`]);
        autoTable(doc, {
          startY: cursorY,
          head: [['Category Label', 'Amount']],
          body: rows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [51, 65, 85] }
        });
        cursorY = (doc as any).lastAutoTable.finalY + 20;
      });
      doc.save(`Approved_Awards_Summary_${periodLabel}.pdf`);
    }
  };

  const generateChartData = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const currentMonthIndex = new Date().getMonth();
      const years = Array.from({ length: 5 }, (_, i) => (currentYear - 4 + i));

      // 1. Fetch historical record statuses and dates for last 5 years
      const fiveYearsAgo = `${currentYear - 4}-01-01`;
      
      const [approvedRes, pendingRes] = await Promise.all([
        supabase
          .from('claimsawardedcommissionersreview')
          .select('CACRReviewStatus, CACRDecisionDate')
          .or('CACRReviewStatus.ilike.*Accepted*,CACRReviewStatus.ilike.*Approved*')
          .gte('CACRDecisionDate', fiveYearsAgo)
          .order('CACRDecisionDate', { ascending: false })
          .limit(5000),
        supabase
          .from('claimsawardedcommissionersreview')
          .select('CACRReviewStatus, CACRSubmissionDate')
          .eq('CACRReviewStatus', 'ChiefCommissionerReviewPending')
          .gte('CACRSubmissionDate', fiveYearsAgo)
          .order('CACRSubmissionDate', { ascending: false })
          .limit(5000)
      ]);

      if (approvedRes.error) throw approvedRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const approvedRecords = approvedRes.data || [];
      const pendingRecords = pendingRes.data || [];

      // 2. Aggregate Yearly Data
      const yearlyPending = years.map(y => pendingRecords.filter(r => {
        const dateStr = r.CACRSubmissionDate;
        if (!dateStr) return false;
        return parseInt(dateStr.split('-')[0]) === y;
      }).length);

      const yearlyApproved = years.map(y => approvedRecords.filter(r => {
        const dateStr = r.CACRDecisionDate;
        if (!dateStr) return false;
        return parseInt(dateStr.split('-')[0]) === y;
      }).length);

      setYearlyChartData({
        labels: years.map(String),
        datasets: [
          { label: 'Pending Claims', data: yearlyPending, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true },
          { label: 'Approved Claims', data: yearlyApproved, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }
        ]
      });

      // 3. Aggregate Monthly Data for current year
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyPending = months.map((_, i) => pendingRecords.filter(r => {
        const dateStr = r.CACRSubmissionDate;
        if (!dateStr) return false;
        const parts = dateStr.split('-');
        return parseInt(parts[0]) === selectedYear && (parseInt(parts[1]) - 1) === i;
      }).length);

      const monthlyApproved = months.map((_, i) => approvedRecords.filter(r => {
        const dateStr = r.CACRDecisionDate;
        if (!dateStr) return false;
        const parts = dateStr.split('-');
        return parseInt(parts[0]) === selectedYear && (parseInt(parts[1]) - 1) === i;
      }).length);

      const labels = selectedYear === currentYear ? months.slice(0, currentMonthIndex + 1) : months;
      const truncate = (arr: number[]) => selectedYear === currentYear ? arr.slice(0, currentMonthIndex + 1) : arr;

      setMonthlyChartData({
        labels,
        datasets: [
          { label: 'Pending Claims', data: truncate(monthlyPending), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true },
          { label: 'Approved Claims', data: truncate(monthlyApproved), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }
        ]
      });

    } catch (e) {
      console.error("Error generating chart data:", e);
    }
  };

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuItemClick = (menu: string, item: string) => {
    if (menu === 'Awarded Claim Review' && item === 'Pending') {
      setShowPendingClaimsList(true);
    } else if (menu === 'Awarded Claim Review' && item === 'Approved') {
      setShowApprovedClaimsList(true);
    }
    setActiveMenu(null);
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Commissioner Dashboard</h1>
        <p className="text-gray-600">Welcome back, {userFullName}</p>
        <p className="text-gray-500 text-sm -mt-1">User ID: {userStaffID}</p>
        <GoToReportsButton />
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-blue-100 mr-4">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Claims</p>
              <p className="text-2xl font-bold">{loading ? '...' : (pendingCount + approvedCount)}</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-green-100 mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved Claims</p>
              <p className="text-2xl font-bold">{loading ? '...' : approvedCount}</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-amber-100 mr-4">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold">{loading ? '...' : pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-purple-100 mr-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Officers</p>
              <p className="text-2xl font-bold">24</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div className="card shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Claims by Year</h2>
          <div className="h-64">
            <Line
              data={yearlyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' as const },
                  title: { display: false },
                },
                scales: { y: { beginAtZero: true } }
              }}
            />
          </div>
        </div>

        <div className="card shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Claims by Month (Current Year)</h2>
          <div className="h-64">
            <Line
              data={monthlyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top' as const },
                  title: { display: false },
                },
                scales: { y: { beginAtZero: true } }
              }}
            />
          </div>
        </div>
      </div>

      {/* Approved Award Reports Section */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-1 hover:bg-white rounded-md transition-all text-gray-600"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="px-4 font-bold text-gray-800 min-w-[60px] text-center">
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
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
          
          <div className="flex gap-2">
            <button 
              onClick={() => handleExportAll('pdf')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg shadow-md hover:bg-primary-dark text-sm font-bold transition-all"
            >
              <FileDown className="h-4 w-4" /> PDF Report
            </button>
            <button 
              onClick={() => handleExportAll('csv')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg shadow-md hover:bg-black text-sm font-bold transition-all"
            >
              <FileDown className="h-4 w-4" /> CSV/Excel
            </button>
          </div>
        </div>

        {reportLoading ? (
          <div className="flex justify-center items-center h-80 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-primary"></div>
              <p className="text-gray-500 font-medium">Crunching data for {selectedYear}...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Approved awards by Sectors', data: reportData.sector, color: '#0ea5e9' },
              { title: 'Approved awards by Insurance Company', data: reportData.insurance, color: '#22c55e' },
              { title: 'Approved awards by Claims Officers', data: reportData.officer, color: '#f59e0b' },
              { title: 'Approved awards by Injury Type', data: reportData.injury, color: '#ef4444' },
              { title: 'Approved awards by Province', data: reportData.province, color: '#8b5cf6' },
              { title: 'Approved awards by Region', data: reportData.region, color: '#14b8a6' }
            ].map((report, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 leading-snug">{report.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: report.color }}></div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Grand Total</span>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-primary whitespace-nowrap bg-blue-50 px-3 py-1 rounded-lg">
                    K {grandTotalAmount.toLocaleString()}
                  </div>
                </div>
                <div className="h-56">
                  {report.data.labels.length > 0 ? (
                    <Bar
                      data={report.data}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: '#1f2937',
                            padding: 12,
                            cornerRadius: 8,
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            callbacks: {
                              label: (context: any) => ` K ${context.parsed.x.toLocaleString()}`
                            }
                          }
                        },
                        scales: { 
                          x: { display: false }, 
                          y: { 
                            grid: { display: false },
                            ticks: {
                              font: { size: 10, weight: 600 },
                              color: '#6b7280'
                            }
                          } 
                        }
                      }}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                      <FileText className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-xs font-medium italic">No reported awards in {selectedYear}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPendingClaimsList && (
        <ListPendingClaimsForChiefCommissionerReview
          onClose={() => setShowPendingClaimsList(false)}
        />
      )}

      {showApprovedClaimsList && (
        <ListApproveClaimsForCommissionerReview
          onClose={() => setShowApprovedClaimsList(false)}
        />
      )}
    </div>
  );
};

export default CommissionerDashboard;
