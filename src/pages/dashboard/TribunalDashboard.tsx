import React, { useState, useEffect, useMemo } from 'react';
import { Scale, Calendar, Users, FileText, ChevronDown, UserCheck, ClipboardCheck } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import ListPendingHearingsPublic from '../../components/forms/ListPendingHearingsPublic';
import ListPendingHearingsPrivate from '../../components/forms/ListPendingHearingsPrivate';
import PrintListPublic from '../../components/forms/PrintListPublic';
import PrintListPrivate from '../../components/forms/PrintListPrivate';
import PrintListAll from '../../components/forms/PrintListAll';
import SetTribunalHearing from '../../components/forms/SetTribunalHearing';
import PrintHearingSetList from '../../components/forms/PrintHearingSetList';
import ListSetTribunalHearingPublic from '../../components/forms/ListSetTribunalHearingPublic';
import ListSetTribunalHearingPrivate from '../../components/forms/ListSetTribunalHearingPrivate';
import EditSetTribunalHearing from '../../components/forms/EditSetTribunalHearing';
import ViewSetTribunalHearing from '../../components/forms/ViewSetTribunalHearing';
import ListTribunalHearingConsented from '../../components/forms/ListTribunalHearingConsented';
import ListTribunalHearingAdjourned from '../../components/forms/ListTribunalHearingAdjourned';
import ListTribunalHearingDismissed from '../../components/forms/ListTribunalHearingDismissed';
import GoToReportsButton from '../../components/forms/GoToReportsButton';
import ListApprovedTimeBarredFormsRegistrarReview from '../../components/forms/ListApprovedTimeBarredFormsRegistrarReview';
import ListRejectedTimeBarredFormsRegistrarReview from '../../components/forms/ListRejectedTimeBarredFormsRegistrarReview';
import ListForm18EmployerAccepted from '../../components/forms/ListForm18EmployerAccepted';
import ListForm18WorkerNotified from '../../components/forms/ListForm18WorkerNotified';
import ListForm18WorkerResponse from '../../components/forms/ListForm18WorkerResponse';
import ListForm7 from '../../components/forms/ListForm7';
import Form238HearingForm11SubmissionPublic from '../../components/forms/238HearingForm11SubmissionPublic';
import Form238HearingForm11SubmissionPrivate from '../../components/forms/238HearingForm11SubmissionPrivate';
import Form239HearingForm12SubmissionPublic from '../../components/forms/239HearingForm12SubmissionPublic';
import Form239HearingForm12SubmissionPrivate from '../../components/forms/239HearingForm12SubmissionPrivate';
import Form253HearingForm7SubmissionPublic from '../../components/forms/253HearingForm7SubmissionPublic';
import Form253HearingForm7SubmissionPrivate from '../../components/forms/253HearingForm7SubmissionPrivate';

interface MenuItem {
  items: string[];
  submenus?: { [key: string]: string[] };
  additionalItems?: string[];
}

interface MenuItems {
  [key: string]: MenuItem;
}

const DashboardCard: React.FC<{
  title: string;
  count: number;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  borderClass?: string;
  iconBgClass?: string;
  iconTextClass?: string;
  iconHoverBgClass?: string;
}> = ({ 
  title, 
  count, 
  icon, 
  onClick, 
  loading, 
  borderClass = "border-primary", 
  iconBgClass = "bg-primary/10", 
  iconTextClass = "text-primary", 
  iconHoverBgClass = "group-hover:bg-primary" 
}) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${borderClass} hover:shadow-lg transition-shadow cursor-pointer group`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${iconBgClass} ${iconTextClass} ${iconHoverBgClass} group-hover:text-white transition-colors duration-300 mr-4`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">
            {loading ? (
              <span className="flex space-x-1">
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
              </span>
            ) : (
              count
            )}
          </p>
        </div>
      </div>
      <div className={`${iconTextClass} opacity-0 group-hover:opacity-100 transition-opacity`}>
        <FileText size={20} />
      </div>
    </div>
  </div>
);

const TribunalDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Yearly monthly stats states
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const initialMonthlyData = () => monthLabels.map(label => ({ label, count: 0 }));

  const [year, setYear] = useState(new Date().getFullYear());
  const [employerAcceptedMonthly, setEmployerAcceptedMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [workerNotifiedMonthly, setWorkerNotifiedMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [workerResponseMonthly, setWorkerResponseMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [form7ClaimsMonthly, setForm7ClaimsMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [hearingPendingMonthly, setHearingPendingMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [scheduledHearingsMonthly, setScheduledHearingsMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [consentedMonthly, setConsentedMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [adjournedMonthly, setAdjournedMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());
  const [dismissedMonthly, setDismissedMonthly] = useState<{ label: string; count: number }[]>(initialMonthlyData());

  const claimStatsData = useMemo(() => {
    return monthLabels.map((label, idx) => ({
      label,
      employerAccepted: employerAcceptedMonthly[idx]?.count || 0,
      workerNotified: workerNotifiedMonthly[idx]?.count || 0,
      workerResponse: workerResponseMonthly[idx]?.count || 0,
      form7Claims: form7ClaimsMonthly[idx]?.count || 0,
    }));
  }, [employerAcceptedMonthly, workerNotifiedMonthly, workerResponseMonthly, form7ClaimsMonthly]);

  const hearingStatsData = useMemo(() => {
    return monthLabels.map((label, idx) => ({
      label,
      hearingPending: hearingPendingMonthly[idx]?.count || 0,
      scheduled: scheduledHearingsMonthly[idx]?.count || 0,
      consented: consentedMonthly[idx]?.count || 0,
      adjourned: adjournedMonthly[idx]?.count || 0,
      dismissed: dismissedMonthly[idx]?.count || 0,
    }));
  }, [hearingPendingMonthly, scheduledHearingsMonthly, consentedMonthly, adjournedMonthly, dismissedMonthly]);

  const groupCountsByMonth = (dates: string[]): { label: string; count: number }[] => {
    const buckets = new Array(12).fill(0);
    for (const iso of dates) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        buckets[d.getMonth()] += 1;
      }
    }
    return buckets.map((count, i) => ({ label: monthLabels[i], count }));
  };
  
  // Stats counts
  const [form18EmployerAcceptedCount, setForm18EmployerAcceptedCount] = useState(0);
  const [form18WorkerNotifiedCount, setForm18WorkerNotifiedCount] = useState(0);
  const [form18WorkerAcceptedCount, setForm18WorkerAcceptedCount] = useState(0);
  const [form7Count, setForm7Count] = useState(0);
  const [hearingPendingCount, setHearingPendingCount] = useState(0);
  const [scheduledHearingsCount, setScheduledHearingsCount] = useState(0);
  const [consentedCount, setConsentedCount] = useState(0);
  const [adjournedCount, setAdjournedCount] = useState(0);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [showPendingHearingsPublic, setShowPendingHearingsPublic] = useState(false);
  const [showPendingHearingsPrivate, setShowPendingHearingsPrivate] = useState(false);
  const [showPrintListPublic, setShowPrintListPublic] = useState(false);
  const [showPrintListPrivate, setShowPrintListPrivate] = useState(false);
  const [showPrintListAll, setShowPrintListAll] = useState(false);
  const [showSetHearing, setShowSetHearing] = useState(false);
  const [showPrintHearingSetList, setShowPrintHearingSetList] = useState(false);
  const [showTribunalHearingPublic, setShowTribunalHearingPublic] = useState(false);
  const [showTribunalHearingPrivate, setShowTribunalHearingPrivate] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string | null>(null);
  const [selectedHearingNo, setSelectedHearingNo] = useState<string | null>(null);
  const [selectedHearingType, setSelectedHearingType] = useState<string | null>(null);
  const [showEditSetHearing, setShowEditSetHearing] = useState(false);
  const [showViewSetHearing, setShowViewSetHearing] = useState(false);
  const [showConsentedApprovedList, setShowConsentedApprovedList] = useState(false);
  const [showAdjournedList, setShowAdjournedList] = useState(false);
  const [showDismissedAppealList, setShowDismissedAppealList] = useState(false);
  const [showApprovedTimeBarred, setShowApprovedTimeBarred] = useState(false);
  const [showRejectedTimeBarred, setShowRejectedTimeBarred] = useState(false);
  const [showForm18EmployerAccepted, setShowForm18EmployerAccepted] = useState(false);
  const [showForm18WorkerNotified, setShowForm18WorkerNotified] = useState(false);
  const [showForm18WorkerResponse, setShowForm18WorkerResponse] = useState(false);
  const [showForm7, setShowForm7] = useState(false);
  const [showHearingCompletePublic, setShowHearingCompletePublic] = useState(false);
  const [showHearingCompletePrivate, setShowHearingCompletePrivate] = useState(false);
  const [showOutcomeFormPublic11, setShowOutcomeFormPublic11] = useState(false);
  const [showOutcomeFormPublic12, setShowOutcomeFormPublic12] = useState(false);
  const [showOutcomeFormPublic7, setShowOutcomeFormPublic7] = useState(false);
  const [showOutcomeFormPrivate11, setShowOutcomeFormPrivate11] = useState(false);
  const [showOutcomeFormPrivate12, setShowOutcomeFormPrivate12] = useState(false);
  const [showOutcomeFormPrivate7, setShowOutcomeFormPrivate7] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCounts = async () => {
    try {
      setLoading(true);

      // Fetch IRNs with processed tribunal outcomes for F18/F7 intersections
      const { data: thoData } = await supabase
        .from('tribunalhearingoutcome')
        .select('THOIRN')
        .eq('THODecision', 'Approved')
        .eq('THOHearingStatus', 'Processed');
      
      const tribunalIRNs = thoData?.map(d => d.THOIRN) || [];

      // Fetch primary metrics
      const [acceptedQ, notifiedQ, workerAcceptedQ, f7Q] = [
        supabase
          .from('form18master')
          .select('*', { count: 'exact', head: true })
          .eq('F18MStatus', 'EmployerAccepted'),
        supabase
          .from('form18master')
          .select('*', { count: 'exact', head: true })
          .eq('F18MStatus', 'NotifiedToWorker'),
        supabase
          .from('form18master')
          .select('*', { count: 'exact', head: true })
          .eq('F18MStatus', 'WorkerAccepted'),
        supabase
          .from('form7master')
          .select('*', { count: 'exact', head: true })
      ];

      // Tribunal-specific population filters
      if (tribunalIRNs.length > 0) {
        acceptedQ.in('IRN', tribunalIRNs);
        notifiedQ.in('IRN', tribunalIRNs);
        workerAcceptedQ.in('IRN', tribunalIRNs);
      }

      // 1. Pending Hearings (Public + Private)
      const pendingHearingsQ = supabase
        .from('tribunalhearingschedule')
        .select('*', { count: 'exact', head: true })
        .eq('THSHearingStatus', 'HearingPending');

      // 2. Scheduled Hearings (THSHStatus = Pending)
      const scheduledHearingsQ = supabase
        .from('tribunalhearingsethearing')
        .select('*', { count: 'exact', head: true })
        .eq('THSHStatus', 'Pending');

      // 3. Outcomes: Consented, Adjourned, Dismissed
      const consentedQ = supabase
        .from('tribunalhearingoutcome')
        .select('*', { count: 'exact', head: true })
        .eq('THODecision', 'Consented');

      const adjournedQ = supabase
        .from('tribunalhearingoutcome')
        .select('*', { count: 'exact', head: true })
        .eq('THODecision', 'Adjourned');

      const dismissedQ = supabase
        .from('tribunalhearingoutcome')
        .select('*', { count: 'exact', head: true })
        .eq('THODecision', 'Dismissed');

      const [
        accepted, notified, workerAccepted, f7,
        pending, scheduled, consented, adjourned, dismissed
      ] = await Promise.all([
        acceptedQ, notifiedQ, workerAcceptedQ, f7Q,
        pendingHearingsQ, scheduledHearingsQ, consentedQ, adjournedQ, dismissedQ
      ]);

      setForm18EmployerAcceptedCount(accepted.count || 0);
      setForm18WorkerNotifiedCount(notified.count || 0);
      setForm18WorkerAcceptedCount(workerAccepted.count || 0);
      setForm7Count(f7.count || 0);
      setHearingPendingCount(pending.count || 0);
      setScheduledHearingsCount(scheduled.count || 0);
      setConsentedCount(thoData?.length || 0); // Use the length of approved/processed outcomes
      setAdjournedCount(adjourned.count || 0);
      setDismissedCount(dismissed.count || 0);

      // Handle the case where no tribunal outcomes exist yet for F18s
      if (tribunalIRNs.length === 0) {
        setForm18EmployerAcceptedCount(0);
        setForm18WorkerNotifiedCount(0);
        setForm18WorkerAcceptedCount(0);
      }

      // Fetch Monthly Datasets for Selected Year
      const startISO = `${year}-01-01`;
      const endISO = `${year + 1}-01-01`;

      const mForm7Q = supabase
        .from('form7master')
        .select('F7MEmployerRejectedDate')
        .gte('F7MEmployerRejectedDate', startISO)
        .lt('F7MEmployerRejectedDate', endISO);

      const mPendingQ = supabase
        .from('tribunalhearingschedule')
        .select('THSSubmissionDate')
        .eq('THSHearingStatus', 'HearingPending')
        .gte('THSSubmissionDate', startISO)
        .lt('THSSubmissionDate', endISO);

      const mScheduledQ = supabase
        .from('tribunalhearingsethearing')
        .select('created_at')
        .eq('THSHStatus', 'Pending')
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const mConsentedQ = supabase
        .from('tribunalhearingoutcome')
        .select('created_at')
        .eq('THODecision', 'Approved')
        .eq('THOHearingStatus', 'Processed')
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const mAdjournedQ = supabase
        .from('tribunalhearingoutcome')
        .select('created_at')
        .eq('THODecision', 'Adjourned')
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const mDismissedQ = supabase
        .from('tribunalhearingoutcome')
        .select('created_at')
        .eq('THODecision', 'Dismissed')
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const mAcceptedQ = supabase
        .from('form18master')
        .select('F18MEmployerAcceptedDate')
        .eq('F18MStatus', 'EmployerAccepted')
        .gte('F18MEmployerAcceptedDate', startISO)
        .lt('F18MEmployerAcceptedDate', endISO);
        
      const mNotifiedQ = supabase
        .from('form18master')
        .select('F18MEmployerAcceptedDate')
        .eq('F18MStatus', 'NotifiedToWorker')
        .gte('F18MEmployerAcceptedDate', startISO)
        .lt('F18MEmployerAcceptedDate', endISO);
        
      const mWorkerAcceptedQ = supabase
        .from('form18master')
        .select('F18MWorkerAcceptedDate')
        .eq('F18MStatus', 'WorkerAccepted')
        .gte('F18MWorkerAcceptedDate', startISO)
        .lt('F18MWorkerAcceptedDate', endISO);

      if (tribunalIRNs.length > 0) {
        mAcceptedQ.in('IRN', tribunalIRNs);
        mNotifiedQ.in('IRN', tribunalIRNs);
        mWorkerAcceptedQ.in('IRN', tribunalIRNs);
      }

      if (tribunalIRNs.length === 0) {
        setEmployerAcceptedMonthly(initialMonthlyData());
        setWorkerNotifiedMonthly(initialMonthlyData());
        setWorkerResponseMonthly(initialMonthlyData());
        
        const [mForm7, mPending, mScheduled, mConsented, mAdjourned, mDismissed] = await Promise.all([
          mForm7Q, mPendingQ, mScheduledQ, mConsentedQ, mAdjournedQ, mDismissedQ
        ]);

        setForm7ClaimsMonthly(groupCountsByMonth((mForm7.data || []).map(r => r.F7MEmployerRejectedDate as string).filter(Boolean)));
        setHearingPendingMonthly(groupCountsByMonth((mPending.data || []).map(r => r.THSSubmissionDate as string).filter(Boolean)));
        setScheduledHearingsMonthly(groupCountsByMonth((mScheduled.data || []).map(r => r.created_at as string).filter(Boolean)));
        setConsentedMonthly(groupCountsByMonth((mConsented.data || []).map(r => r.created_at as string).filter(Boolean)));
        setAdjournedMonthly(groupCountsByMonth((mAdjourned.data || []).map(r => r.created_at as string).filter(Boolean)));
        setDismissedMonthly(groupCountsByMonth((mDismissed.data || []).map(r => r.created_at as string).filter(Boolean)));
      } else {
        const [
          mForm7, mPending, mScheduled, mConsented, mAdjourned, mDismissed,
          mAccepted, mNotified, mWorkerAccepted
        ] = await Promise.all([
          mForm7Q, mPendingQ, mScheduledQ, mConsentedQ, mAdjournedQ, mDismissedQ,
          mAcceptedQ, mNotifiedQ, mWorkerAcceptedQ
        ]);

        setEmployerAcceptedMonthly(groupCountsByMonth((mAccepted.data || []).map(r => r.F18MEmployerAcceptedDate as string).filter(Boolean)));
        setWorkerNotifiedMonthly(groupCountsByMonth((mNotified.data || []).map(r => r.F18MEmployerAcceptedDate as string).filter(Boolean)));
        setWorkerResponseMonthly(groupCountsByMonth((mWorkerAccepted.data || []).map(r => r.F18MWorkerAcceptedDate as string).filter(Boolean)));
        setForm7ClaimsMonthly(groupCountsByMonth((mForm7.data || []).map(r => r.F7MEmployerRejectedDate as string).filter(Boolean)));
        setHearingPendingMonthly(groupCountsByMonth((mPending.data || []).map(r => r.THSSubmissionDate as string).filter(Boolean)));
        setScheduledHearingsMonthly(groupCountsByMonth((mScheduled.data || []).map(r => r.created_at as string).filter(Boolean)));
        setConsentedMonthly(groupCountsByMonth((mConsented.data || []).map(r => r.created_at as string).filter(Boolean)));
        setAdjournedMonthly(groupCountsByMonth((mAdjourned.data || []).map(r => r.created_at as string).filter(Boolean)));
        setDismissedMonthly(groupCountsByMonth((mDismissed.data || []).map(r => r.created_at as string).filter(Boolean)));
      }

    } catch (err) {
      console.error('Error fetching dashboard counts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [year]);

  const incrementRefresh = () => setRefreshKey(prev => prev + 1);

  const menuItems: MenuItems = {
    'Pre-Hearing': {
      items: [
        'Print List (Public)',
        'Print List (Private)',
        'Print List (All)',
        'Hearing Pending (Public)',
        'Hearing Pending (Private)',
        'Print Set Hearing List (All)'
      ]
    },
    'Hearing': {
      items: [
        'Set Hearing',
        'Set for Hearing List (Public)',
        'Set for Hearing List (Private)',
        'Set Decision (Public)',
        'Set Decision (Private)'
      ],
      submenus: {
        'Set Hearing': ['New Hearing', 'Edit Hearing', 'View Hearing']
      }
    },
    'Hearing Decisions': {
      items: ['Consented', 'Adjourned', 'Dismissed/Appeal'],
      submenus: {
        'Consented': ['Approved List'],
        'Adjourned': ['Adjourned List'],
        'Dismissed/Appeal': ['Dismissed/Appeal List']
      }
    },
    'Time Barred Claims': {
      items: [
        'Approved',
        'Rejected'
      ]
    },
    Form18: { items: ['Employer Accepted'] },
    Worker: { items: ['Worker Decision to Form18', 'Worker Response'] },
    Form7: { items: ['Form7'] }
  };



  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuItemClick = (menu: string, item: string) => {
    console.log(`Selected ${item} from ${menu}`);

    if (menu === 'Pre-Hearing' && item === 'Hearing Pending (Public)') {
      setShowPendingHearingsPublic(true);
    } else if (menu === 'Pre-Hearing' && item === 'Hearing Pending (Private)') {
      setShowPendingHearingsPrivate(true);
    } else if (menu === 'Pre-Hearing' && item === 'Print List (Public)') {
      setShowPrintListPublic(true);
    } else if (menu === 'Pre-Hearing' && item === 'Print List (Private)') {
      setShowPrintListPrivate(true);
    } else if (menu === 'Pre-Hearing' && item === 'Print List (All)') {
      setShowPrintListAll(true);
    } else if (menu === 'Pre-Hearing' && item === 'Print Set Hearing List (All)') {
      setShowPrintHearingSetList(true);
    } else if (item === 'New Hearing') {
      setShowSetHearing(true);
    } else if (item === 'Edit Hearing') {
      setShowEditSetHearing(true);
    } else if (item === 'View Hearing') {
      setShowViewSetHearing(true);
    } else if (menu === 'Hearing' && item === 'Set for Hearing List (Public)') {
      setShowTribunalHearingPublic(true);
    } else if (menu === 'Hearing' && item === 'Set for Hearing List (Private)') {
      setShowTribunalHearingPrivate(true);
    } else if (menu === 'Hearing' && item === 'Set Decision (Public)') {
      setShowHearingCompletePublic(true);
    } else if (menu === 'Hearing' && item === 'Set Decision (Private)') {
      setShowHearingCompletePrivate(true);
    } else if (item === 'Approved List') {
      setShowConsentedApprovedList(true);
    } else if (item === 'Adjourned List' || (menu === 'Adjourned' && item === 'Adjourned List')) {
      setShowAdjournedList(true);
    } else if (item === 'Dismissed/Appeal List') {
      setShowDismissedAppealList(true);
    } else if (item === 'Approved') {
      setShowApprovedTimeBarred(true);
    } else if (item === 'Rejected') {
      setShowRejectedTimeBarred(true);
    } else if (menu === 'Form18' && item === 'Employer Accepted') {
      setShowForm18EmployerAccepted(true);
    } else if (menu === 'Worker' && item === 'Worker Decision to Form18') {
      setShowForm18WorkerNotified(true);
    } else if (menu === 'Worker' && item === 'Worker Response') {
      setShowForm18WorkerResponse(true);
    } else if (item === 'Consented Approved List') {
      setShowForm7(true);
    }
  };

  const handleSelectIRN = async (irn: string, action: string, hearingType?: string, hearingNo?: string) => {
    setSelectedIRN(irn);
    setSelectedHearingNo(hearingNo || null);
    setSelectedHearingType(hearingType || null);

    if (action === 'Record Outcome') {
      // Determine which outcome form to show
      const isPublic = showHearingCompletePublic;

      if (hearingType === 'TimeBarredForm11Submission') {
        if (isPublic) setShowOutcomeFormPublic11(true);
        else setShowOutcomeFormPrivate11(true);
      } else if (hearingType === 'TimeBarredForm12Submission') {
        if (isPublic) setShowOutcomeFormPublic12(true);
        else setShowOutcomeFormPrivate12(true);
      } else if (hearingType === 'Form7EmployerRejectedOtherReason') {
        if (isPublic) setShowOutcomeFormPublic7(true);
        else setShowOutcomeFormPrivate7(true);
      } else if (hearingType === 'Form6StateSolicitorSumbission') {
        try {
          // Determine incident type from form1112master
          const { data, error: lookupError } = await supabase
            .from('form1112master')
            .select('IncidentType')
            .eq('IRN', irn)
            .single();

          if (lookupError) throw lookupError;

          if (data?.IncidentType === 'Injury') {
            if (isPublic) setShowOutcomeFormPublic11(true);
            else setShowOutcomeFormPrivate11(true);
          } else if (data?.IncidentType === 'Death') {
            if (isPublic) setShowOutcomeFormPublic12(true);
            else setShowOutcomeFormPrivate12(true);
          } else {
            alert(`Unexpected incident type: ${data?.IncidentType}`);
          }
        } catch (err: any) {
          console.error('Error looking up incident type:', err);
          alert('Failed to determine incident type for recording outcome.');
        }
      }
    } else if (action === 'View') {
      setShowViewSetHearing(true);
    } else {
      setShowSetHearing(true);
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tribunal Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Tribunal Officer'}</p>
        <div className="mt-2">
          <GoToReportsButton />
        </div>
      </div>

      {/* Navigation Menu (Now at the top) */}
      <div className="mb-8 bg-white rounded-lg shadow">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(menuItems).map(([menu, { items, submenus = {}, additionalItems = [] }]) => (
            <div key={menu} className="relative">
              <button
                onClick={() => toggleMenu(menu)}
                className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span className="font-medium">{menu}</span>
                {(items.length > 0 || Object.keys(submenus).length > 0) && (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${activeMenu === menu ? 'transform rotate-180' : ''
                      }`}
                  />
                )}
              </button>
              {activeMenu === menu && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
                  {items.map((item) => (
                    <div key={item}>
                      <button
                        onClick={() => handleMenuItemClick(menu, item)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50"
                      >
                        {item}
                      </button>
                      {submenus[item] && (
                        <div className="pl-8 bg-gray-50">
                          {submenus[item].map((subitem) => (
                            <button
                              key={subitem}
                              onClick={() => handleMenuItemClick(item, subitem)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
                            >
                              {subitem}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {additionalItems.map((item) => (
                    <button
                      key={item}
                      onClick={() => handleMenuItemClick(menu, item)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50"
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

      {/* Dynamic Summary Cards (Now at the bottom) */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Status Overview</h2>
        
        {/* Row 1: Claim Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DashboardCard
            title="Employer Accepted"
            count={form18EmployerAcceptedCount}
            icon={<FileText size={24} />}
            onClick={() => setShowForm18EmployerAccepted(true)}
            loading={loading}
            borderClass="border-sky-500"
            iconBgClass="bg-sky-50"
            iconTextClass="text-sky-600"
            iconHoverBgClass="group-hover:bg-sky-600"
          />
          <DashboardCard
            title="Worker Notified"
            count={form18WorkerNotifiedCount}
            icon={<UserCheck size={24} />}
            onClick={() => setShowForm18WorkerNotified(true)}
            loading={loading}
            borderClass="border-orange-500"
            iconBgClass="bg-orange-50"
            iconTextClass="text-orange-600"
            iconHoverBgClass="group-hover:bg-orange-600"
          />
          <DashboardCard
            title="Worker Response"
            count={form18WorkerAcceptedCount}
            icon={<ClipboardCheck size={24} />}
            onClick={() => setShowForm18WorkerResponse(true)}
            loading={loading}
            borderClass="border-emerald-500"
            iconBgClass="bg-emerald-50"
            iconTextClass="text-emerald-600"
            iconHoverBgClass="group-hover:bg-emerald-600"
          />
          <DashboardCard
            title="Form 7 Claims"
            count={form7Count}
            icon={<Scale size={24} />}
            onClick={() => setShowForm7(true)}
            loading={loading}
            borderClass="border-teal-500"
            iconBgClass="bg-teal-50"
            iconTextClass="text-teal-600"
            iconHoverBgClass="group-hover:bg-teal-600"
          />
        </div>

        {/* Row 2: Hearing & Outcome Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <DashboardCard
            title="Hearing Pending"
            count={hearingPendingCount}
            icon={<Calendar size={24} />}
            onClick={() => {}}
            loading={loading}
            borderClass="border-violet-500"
            iconBgClass="bg-violet-50"
            iconTextClass="text-violet-600"
            iconHoverBgClass="group-hover:bg-violet-600"
          />
          <DashboardCard
            title="Scheduled Hearings"
            count={scheduledHearingsCount}
            icon={<Calendar size={24} />}
            onClick={() => {}}
            loading={loading}
            borderClass="border-indigo-500"
            iconBgClass="bg-indigo-50"
            iconTextClass="text-indigo-600"
            iconHoverBgClass="group-hover:bg-indigo-600"
          />
          <DashboardCard
            title="Approved / Consented"
            count={consentedCount}
            icon={<Scale size={24} />}
            onClick={() => setShowConsentedApprovedList(true)}
            loading={loading}
            borderClass="border-amber-500"
            iconBgClass="bg-amber-50"
            iconTextClass="text-amber-600"
            iconHoverBgClass="group-hover:bg-amber-600"
          />
          <DashboardCard
            title="Adjourned"
            count={adjournedCount}
            icon={<Users size={24} />}
            onClick={() => setShowAdjournedList(true)}
            loading={loading}
            borderClass="border-fuchsia-500"
            iconBgClass="bg-fuchsia-50"
            iconTextClass="text-fuchsia-600"
            iconHoverBgClass="group-hover:bg-fuchsia-600"
          />
          <DashboardCard
            title="Dismissed"
            count={dismissedCount}
            icon={<Users size={24} />}
            onClick={() => setShowDismissedAppealList(true)}
            loading={loading}
            borderClass="border-rose-500"
            iconBgClass="bg-rose-50"
            iconTextClass="text-rose-600"
            iconHoverBgClass="group-hover:bg-rose-600"
          />
        </div>
      </div>

      {/* Graphs Section */}
      <div className="mt-12 bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Analytics & Trends</h2>
            <p className="text-sm text-gray-500">Yearly trends and monthly statistics overview</p>
          </div>
          {/* Year selector */}
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <span className="text-sm font-semibold text-gray-600">Select Year:</span>
            <div className="flex items-center gap-1">
              <button 
                className="px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100 font-semibold transition-colors"
                onClick={() => setYear(y => y - 1)}
              >
                ←
              </button>
              <input
                type="number"
                className="w-20 px-2 py-1 border rounded text-center font-bold"
                value={year}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) setYear(v);
                }}
              />
              <button 
                className="px-3 py-1 border rounded bg-gray-50 hover:bg-gray-100 font-semibold transition-colors"
                onClick={() => setYear(y => y + 1)}
              >
                →
              </button>
              <button 
                className="ml-2 px-3 py-1 border rounded bg-primary text-white hover:bg-primary-dark font-semibold text-xs transition-colors"
                onClick={() => setYear(new Date().getFullYear())}
              >
                Current Year
              </button>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart 1: Claim Status Trends */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-800 mb-4">Claim Notifications & Responses ({year})</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={claimStatsData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="employerAccepted" name="Employer Accepted" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="workerNotified" name="Worker Notified" fill="#fb923c" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="workerResponse" name="Worker Response" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="form7Claims" name="Form 7 Claims" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Hearing & Outcome Activity */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-800 mb-4">Hearing Activity & Decisions ({year})</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hearingStatsData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="hearingPending" name="Hearing Pending" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="scheduled" name="Scheduled" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="consented" name="Consented" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adjourned" name="Adjourned" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dismissed" name="Dismissed" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Hearings Public Modal */}
      {showPendingHearingsPublic && (
        <ListPendingHearingsPublic
          onClose={() => setShowPendingHearingsPublic(false)}
          onSelectIRN={handleSelectIRN}
        />
      )}

      {/* Pending Hearings Private Modal */}
      {showPendingHearingsPrivate && (
        <ListPendingHearingsPrivate
          onClose={() => setShowPendingHearingsPrivate(false)}
          onSelectIRN={handleSelectIRN}
        />
      )}

      {/* Print List Public Modal */}
      {showPrintListPublic && (
        <PrintListPublic
          onClose={() => setShowPrintListPublic(false)}
        />
      )}

      {/* Print List Private Modal */}
      {showPrintListPrivate && (
        <PrintListPrivate
          onClose={() => setShowPrintListPrivate(false)}
        />
      )}

      {/* Print List All Modal */}
      {showPrintListAll && (
        <PrintListAll
          onClose={() => setShowPrintListAll(false)}
        />
      )}

      {/* Print Set Hearing List All Modal */}
      {showPrintHearingSetList && (
        <PrintHearingSetList
          onClose={() => setShowPrintHearingSetList(false)}
        />
      )}

      {/* Tribunal Hearing Public Modal */}
      {showTribunalHearingPublic && (
        <ListSetTribunalHearingPublic
          key={`public-${refreshKey}`}
          onClose={() => setShowTribunalHearingPublic(false)}
          onSelectIRN={handleSelectIRN}
        />
      )}

      {/* Tribunal Hearing Private Modal */}
      {showTribunalHearingPrivate && (
        <ListSetTribunalHearingPrivate
          key={`private-${refreshKey}`}
          onClose={() => setShowTribunalHearingPrivate(false)}
          onSelectIRN={handleSelectIRN}
        />
      )}

      {/* Hearing Complete Public Modal */}
      {showHearingCompletePublic && (
        <ListSetTribunalHearingPublic
          mode="completion"
          key={`public-complete-${refreshKey}`}
          onClose={() => setShowHearingCompletePublic(false)}
          onSelectIRN={handleSelectIRN}
        />
      )}

      {/* Hearing Complete Private Modal */}
      {showHearingCompletePrivate && (
        <ListSetTribunalHearingPrivate
          mode="completion"
          key={`private-complete-${refreshKey}`}
          onClose={() => setShowHearingCompletePrivate(false)}
          onSelectIRN={handleSelectIRN}
        />
      )}

      {/* Outcome Forms Public */}
      {showOutcomeFormPublic11 && (
        <Form238HearingForm11SubmissionPublic
          irn={selectedIRN || ''}
          hearingType={selectedHearingType || ''}
          onClose={() => {
            setShowOutcomeFormPublic11(false);
            incrementRefresh();
          }}
        />
      )}
      {showOutcomeFormPublic12 && (
        <Form239HearingForm12SubmissionPublic
          irn={selectedIRN || ''}
          hearingType={selectedHearingType || ''}
          onClose={() => {
            setShowOutcomeFormPublic12(false);
            incrementRefresh();
          }}
        />
      )}
      {showOutcomeFormPublic7 && (
        <Form253HearingForm7SubmissionPublic
          irn={selectedIRN || ''}
          hearingType={selectedHearingType || ''}
          onClose={() => {
            setShowOutcomeFormPublic7(false);
            incrementRefresh();
          }}
        />
      )}

      {/* Outcome Forms Private */}
      {showOutcomeFormPrivate11 && (
        <Form238HearingForm11SubmissionPrivate
          irn={selectedIRN || ''}
          hearingType={selectedHearingType || ''}
          onClose={() => {
            setShowOutcomeFormPrivate11(false);
            incrementRefresh();
          }}
        />
      )}
      {showOutcomeFormPrivate12 && (
        <Form239HearingForm12SubmissionPrivate
          irn={selectedIRN || ''}
          hearingType={selectedHearingType || ''}
          onClose={() => {
            setShowOutcomeFormPrivate12(false);
            incrementRefresh();
          }}
        />
      )}
      {showOutcomeFormPrivate7 && (
        <Form253HearingForm7SubmissionPrivate
          irn={selectedIRN || ''}
          hearingType={selectedHearingType || ''}
          onClose={() => {
            setShowOutcomeFormPrivate7(false);
            incrementRefresh();
          }}
        />
      )}

      {/* Set Hearing Modal */}
      {showSetHearing && (
        <SetTribunalHearing
          irn={selectedIRN || undefined}
          onClose={() => {
            setShowSetHearing(false);
            setSelectedIRN(null);
            incrementRefresh();
          }}
        />
      )}

      {/* Edit Set Hearing Modal */}
      {showEditSetHearing && (
        <EditSetTribunalHearing
          onClose={() => setShowEditSetHearing(false)}
        />
      )}

      {/* View Set Hearing Modal */}
      {showViewSetHearing && (
        <ViewSetTribunalHearing
          initialHearingNo={selectedHearingNo || undefined}
          onClose={() => {
            setShowViewSetHearing(false);
            setSelectedHearingNo(null);
          }}
        />
      )}

      {/* Consented Approved List Modal */}
      {showConsentedApprovedList && (
        <ListTribunalHearingConsented
          onClose={() => setShowConsentedApprovedList(false)}
        />
      )}

      {/* Adjourned List Modal */}
      {showAdjournedList && (
        <ListTribunalHearingAdjourned
          onClose={() => setShowAdjournedList(false)}
        />
      )}

      {/* Dismissed/Appeal List Modal */}
      {showDismissedAppealList && (
        <ListTribunalHearingDismissed
          onClose={() => setShowDismissedAppealList(false)}
        />
      )}
      {/* New Time Barred Modals */}
      {showApprovedTimeBarred && (
        <ListApprovedTimeBarredFormsRegistrarReview onClose={() => setShowApprovedTimeBarred(false)} />
      )}
      {showRejectedTimeBarred && (
        <ListRejectedTimeBarredFormsRegistrarReview onClose={() => setShowRejectedTimeBarred(false)} />
      )}

      {/* New Claims Modals */}
      {/* Employer Accepted List Modal */}
      {showForm18EmployerAccepted && (
        <ListForm18EmployerAccepted
          isRegionalized={false}
          onlyTribunal={true}
          onClose={() => {
            setShowForm18EmployerAccepted(false);
            fetchCounts();
          }}
        />
      )}
      {/* Worker → Form18 Worker Notified List Modal */}
      {showForm18WorkerNotified && (
        <ListForm18WorkerNotified
          isRegionalized={false}
          onlyTribunal={true}
          onClose={() => {
            setShowForm18WorkerNotified(false);
            fetchCounts();
          }}
        />
      )}
      {/* Worker → Form18 Worker Response (Accepted) List Modal */}
      {showForm18WorkerResponse && (
        <ListForm18WorkerResponse
          isRegionalized={false}
          onlyTribunal={true}
          onClose={() => {
            setShowForm18WorkerResponse(false);
            fetchCounts();
          }}
        />
      )}
      {showForm7 && (
        <ListForm7 
          isRegionalized={false}
          onClose={() => setShowForm7(false)} 
        />
      )}
    </div>
  );
};

export default TribunalDashboard;
