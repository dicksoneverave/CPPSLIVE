import React, { useState, useEffect } from 'react';
import { Scale, Calendar, Users, FileText, ChevronDown, UserCheck, ClipboardCheck } from 'lucide-react';
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
}> = ({ title, count, icon, onClick, loading }) => (
  <div 
    onClick={onClick}
    className="bg-white rounded-lg shadow-md p-6 border-l-4 border-primary hover:shadow-lg transition-shadow cursor-pointer group"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 mr-4">
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
      <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <FileText size={20} />
      </div>
    </div>
  </div>
);

const TribunalDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
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
  }, []);

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
          />
          <DashboardCard
            title="Worker Notified"
            count={form18WorkerNotifiedCount}
            icon={<UserCheck size={24} />}
            onClick={() => setShowForm18WorkerNotified(true)}
            loading={loading}
          />
          <DashboardCard
            title="Worker Response"
            count={form18WorkerAcceptedCount}
            icon={<ClipboardCheck size={24} />}
            onClick={() => setShowForm18WorkerResponse(true)}
            loading={loading}
          />
          <DashboardCard
            title="Form 7 Claims"
            count={form7Count}
            icon={<Scale size={24} />}
            onClick={() => setShowForm7(true)}
            loading={loading}
          />
        </div>

        {/* Row 2: Hearing & Outcome Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <DashboardCard
            title="Hearing Pending"
            count={hearingPendingCount}
            icon={<Calendar size={24} className="text-blue-600" />}
            onClick={() => {}} // Could link to a aggregate pending view if needed
            loading={loading}
          />
          <DashboardCard
            title="Scheduled Hearings"
            count={scheduledHearingsCount}
            icon={<Calendar size={24} className="text-green-600" />} // Static icons for non-handled clicks
            onClick={() => {}}
            loading={loading}
          />
          <DashboardCard
            title="Approved / Consented"
            count={consentedCount}
            icon={<Scale size={24} className="text-amber-600" />}
            onClick={() => setShowConsentedApprovedList(true)}
            loading={loading}
          />
          <DashboardCard
            title="Adjourned"
            count={adjournedCount}
            icon={<Users size={24} className="text-purple-600" />}
            onClick={() => setShowAdjournedList(true)}
            loading={loading}
          />
          <DashboardCard
            title="Dismissed"
            count={dismissedCount}
            icon={<Users size={24} className="text-red-600" />}
            onClick={() => setShowDismissedAppealList(true)}
            loading={loading}
          />
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
