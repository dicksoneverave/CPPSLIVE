import React, { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, AlertTriangle, ChevronDown, Shield, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import GoToReportsButton from '../../components/forms/GoToReportsButton';
import ListClaimDecisions from '../../components/forms/ListClaimDecisions';
import ListPendingRegisteredClaimsRegistrarReview from '../../components/forms/ListPendingRegisteredClaimsRegistrarReview';
import ListApprovedRegisteredClaimsRegistrarReview from '../../components/forms/ListApprovedRegisteredClaimsRegistrarReview';
import ListRejectedRegisteredClaimsRegistrarReview from '../../components/forms/ListRejectedRegisteredClaimsRegistrarReview';
import ListPendingAwardedClaimsForRegistrarReview from '../../components/forms/ListPendingAwardedClaimsForRegistrarReview';
import ListApprovedAwardedClaimsForRegistrarReview from '../../components/forms/ListApprovedAwardedClaimsForRegistrarReview';
import ListPendingTimeBarredFormsRegistrarReview from '../../components/forms/ListPendingTimeBarredFormsRegistrarReview';
import ListApprovedTimeBarredFormsRegistrarReview from '../../components/forms/ListApprovedTimeBarredFormsRegistrarReview';
import ListRejectedTimeBarredFormsRegistrarReview from '../../components/forms/ListRejectedTimeBarredFormsRegistrarReview';
import ListForwardToTribunalTimeBarredFormsRegistrarReview from '../../components/forms/ListForwardToTribunalTimeBarredFormsRegistrarReview';
import DashboardAnalytics from './DashboardAnalytics';

const RegistrarDashboard: React.FC = () => {
  const { profile } = useAuth();

  // NEW: staff id
  const [staffId, setStaffId] = useState<number | null>(null);

  // existing state ...
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showListClaimDecisions, setShowListClaimDecisions] = useState(false);
  const [showPendingRegisteredClaims, setShowPendingRegisteredClaims] = useState(false);
  const [showApprovedRegisteredClaims, setShowApprovedRegisteredClaims] = useState(false);
  const [showRejectedRegisteredClaims, setShowRejectedRegisteredClaims] = useState(false);
  const [showPendingAwardedClaims, setShowPendingAwardedClaims] = useState(false);
  const [showApprovedAwardedClaims, setShowApprovedAwardedClaims] = useState(false);
  const [showPendingTimeBarredForms, setShowPendingTimeBarredForms] = useState(false);
  const [showApprovedTimeBarredForms, setShowApprovedTimeBarredForms] = useState(false);
  const [showRejectedTimeBarredForms, setShowRejectedTimeBarredForms] = useState(false);
  const [showForwardToTribunalTimeBarredForms, setShowForwardToTribunalTimeBarredForms] = useState(false);

  const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());

  // NEW: load staff id for the signed-in user
  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID')
        .eq('cppsid', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to load staff id', error);
        return;
      }
      setStaffId(data?.OSMStaffID ?? null);
    })();
  }, [profile?.id]);

  const menuItems = {
    'Registered Claims': { items: ['Approved', 'Rejected'] },
    'Awarded Claims': { items: ['Pending', 'Approved'] },
    'Time Barred Claims': { items: ['Pending', 'Approved', 'Rejected', 'Forward To Tribunal'] }
  };



  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuItemClick = (menu: string, item: string) => {
    console.log(`Selected ${item} from ${menu}`);

    if (menu === 'Registered Claims' && item === 'Pending') {
      setShowPendingRegisteredClaims(false); //not used by Registrar
    } else if (menu === 'Registered Claims' && item === 'Approved') {
      setShowApprovedRegisteredClaims(true);
    } else if (menu === 'Registered Claims' && item === 'Rejected') {
      setShowRejectedRegisteredClaims(true);
    } else if (menu === 'Awarded Claims' && item === 'Approved') {
      setShowApprovedAwardedClaims(true);
    } else if (menu === 'Awarded Claims' && item === 'Pending') {
      setShowPendingAwardedClaims(true);
    } else if (menu === 'Time Barred Claims' && item === 'Pending') {
      setShowPendingTimeBarredForms(true);
    } else if (menu === 'Time Barred Claims' && item === 'Approved') {
      setShowApprovedTimeBarredForms(true);
    } else if (menu === 'Time Barred Claims' && item === 'Rejected') {
      setShowRejectedTimeBarredForms(true);
    } else if (menu === 'Time Barred Claims' && item === 'Forward To Tribunal') {
      setShowForwardToTribunalTimeBarredForms(true);
    }

    setActiveMenu(null);
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Registrar Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Registrar'}</p>

        {/* NEW: Staff ID line shown between welcome and reports button */}
        <p className="text-gray-700 mt-1">
          <span className="font-medium">Staff ID:</span>{' '}
          {staffId != null ? staffId : <span className="text-gray-400">loading…</span>}
        </p>

        <GoToReportsButton />
      </div>

      {/* Navigation Menu */}
      <div className="mb-8 bg-white rounded-lg shadow">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(menuItems).map(([menu, { items }]) => (
            <div key={menu} className="relative">
              <button
                onClick={() => toggleMenu(menu)}
                className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span className="font-medium">{menu}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${activeMenu === menu ? 'transform rotate-180' : ''
                    }`}
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
      </div>      {/* Old charts removed in favor of DashboardAnalytics */}
      
      {/* New Dashboard Analytics Charts */}
      <div className="mt-8">
        <DashboardAnalytics
          initialYear={dashboardYear}
        />
      </div>

      {/* List Claim Decisions Modal */}
      {showListClaimDecisions && (
        <ListClaimDecisions onClose={() => setShowListClaimDecisions(false)} />
      )}

      {/* List Pending Registered Claims Modal */}
      {showPendingRegisteredClaims && (
        <ListPendingRegisteredClaimsRegistrarReview onClose={() => setShowPendingRegisteredClaims(false)} />
      )}

      {/* List Approved Registered Claims Modal */}
      {showApprovedRegisteredClaims && (
        <ListApprovedRegisteredClaimsRegistrarReview onClose={() => setShowApprovedRegisteredClaims(false)} />
      )}

      {/* List Rejected Registered Claims Modal */}
      {showRejectedRegisteredClaims && (
        <ListRejectedRegisteredClaimsRegistrarReview onClose={() => setShowRejectedRegisteredClaims(false)} />
      )}

      {/* List Pending Awarded Claims Modal */}
      {showPendingAwardedClaims && (
        <ListPendingAwardedClaimsForRegistrarReview onClose={() => setShowPendingAwardedClaims(false)} />
      )}

      {/* List Approved Awarded Claims Modal */}
      {showApprovedAwardedClaims && (
        <ListApprovedAwardedClaimsForRegistrarReview onClose={() => setShowApprovedAwardedClaims(false)} />
      )}

      {/* List Pending Time Barred Forms Modal */}
      {showPendingTimeBarredForms && (
        <ListPendingTimeBarredFormsRegistrarReview onClose={() => setShowPendingTimeBarredForms(false)} />
      )}

      {/* List Approved Time Barred Forms Modal */}
      {showApprovedTimeBarredForms && (
        <ListApprovedTimeBarredFormsRegistrarReview onClose={() => setShowApprovedTimeBarredForms(false)} />
      )}

      {/* List Rejected Time Barred Forms Modal */}
      {showRejectedTimeBarredForms && (
        <ListRejectedTimeBarredFormsRegistrarReview onClose={() => setShowRejectedTimeBarredForms(false)} />
      )}

      {/* List Forward To Tribunal Time Barred Forms Modal */}
      {showForwardToTribunalTimeBarredForms && (
        <ListForwardToTribunalTimeBarredFormsRegistrarReview onClose={() => setShowForwardToTribunalTimeBarredForms(false)} />
      )}
    </div>
  );
};

export default RegistrarDashboard;
