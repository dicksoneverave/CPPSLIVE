import React, { useEffect, useMemo, useState } from 'react';
import { Users, Settings, Shield, Activity, ChevronDown, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import NewOWCStaffForm from '../../components/forms/NewOWCStaffForm';
import EditOWCStaffForm from '../../components/forms/EditOWCStaffForm';
import GoToReportsButton from '../../components/forms/GoToReportsButton';
import EmployerSearchModal from '../../components/forms/EmployerSearchModal';
import WorkerSearchModal from '../../components/forms/WorkerSearchModal';
import ViewWorkerRegistrationForm from '../../components/forms/ViewWorkerRegistrationForm';
import EditWorkerRegistrationForm from '../../components/forms/EditWorkerRegistrationForm';
import EmployerWorkerListModal from '../../components/forms/EmployerWorkerListModal';
import EmployerInsuranceListModal from '../../components/forms/EmployerInsuranceListModal';
import InsuranceCompanyManager from '../../components/forms/InsuranceCompanyManager';
import EmployerPasswordManager from '../../components/forms/EmployerPasswordManager';
import OWCBankAccountManager from '../../components/forms/OWCBankAccountManager';
import OWCProvinceManager from '../../components/forms/OWCProvinceManager';
import OWCRegionManager from '../../components/forms/OWCRegionManager';
import OWCSystemParameterManager from '../../components/forms/OWCSystemParameterManager';
import OWCInjuryPercentManager from '../../components/forms/OWCInjuryPercentManager';
import OWCBodyPartManager from '../../components/forms/OWCBodyPartManager';
import OWCEditCompensationCalculation from '../../components/forms/OWCEditCompensationCalculation';
import OWCAdminAnalytics from '../../components/dashboard/OWCAdminAnalytics';
import UnlockCPOModal from '../../components/forms/UnlockCPOModal';

// --- Small helper modal to pick a staff record to edit ---
interface StaffRow {
  OSMStaffID: string;
  OSMFirstName: string;
  OSMLastName: string;
  OSMDesignation: string;
  OSMMobilePhone?: string;
  InchargeProvince?: string;
  cppsid?: string;
  email?: string;
}

const StaffPickerModal: React.FC<{
  onClose: () => void;
  onSelect: (staffId: string) => void; // returns OSMStaffID
}> = ({ onClose, onSelect }) => {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Join staff with users to get email (optional if you store name/email on staff)
        const { data, error } = await supabase
          .from('v_owcstaff_with_user')
          .select('OSMStaffID, OSMFirstName, OSMLastName, OSMDesignation, OSMMobilePhone, InchargeProvince, cppsid, email')
          .order('OSMStaffID', { ascending: true });
        if (error) throw error;
        const mapped: StaffRow[] = (data || []).map((r: any) => ({
          OSMStaffID: r.OSMStaffID,
          OSMFirstName: r.OSMFirstName,
          OSMLastName: r.OSMLastName,
          OSMDesignation: r.OSMDesignation,
          OSMMobilePhone: r.OSMMobilePhone,
          InchargeProvince: r.InchargeProvince,
          cppsid: r.cppsid,
          email: r.email
        }));
        setRows(mapped);
      } catch (e: any) {
        setError(e?.message || 'Failed to load staff');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    const field = (x: any) => (x ?? '').toString().toLowerCase();
    return rows.filter(r =>
      field(r.OSMStaffID).includes(qq) ||
      field(`${r.OSMFirstName ?? ''} ${r.OSMLastName ?? ''}`).includes(qq) ||
      field(r.email).includes(qq) ||
      field(r.OSMDesignation).includes(qq) ||
      field(r.InchargeProvince).includes(qq)
    );
  }, [q, rows]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Select Staff to Edit</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 flex-1 min-h-0 flex flex-col">
          <div className="relative mb-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 pr-9 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search by StaffID, name, email, designation, province…"
            />
            <Search className="absolute right-2 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-600">Loading…</div>
          )}
          {error && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>
          )}

          {!loading && !error && (
            <div className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((r) => (
                    <tr key={r.OSMStaffID} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-sm">{r.OSMStaffID}</td>
                      <td className="px-3 py-2">{r.OSMFirstName} {r.OSMLastName}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{r.email || '—'}</td>
                      <td className="px-3 py-2 text-sm">{r.OSMDesignation}</td>
                      <td className="px-3 py-2 text-sm">{r.InchargeProvince || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary-dark"
                          onClick={() => onSelect(r.OSMStaffID)}
                        >Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="p-6 text-center text-gray-500">No matches.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main dashboard ---
const OWCAdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showNewStaffForm, setShowNewStaffForm] = useState(false);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  const [showEmployerSearch, setShowEmployerSearch] = useState(false);
  const [showWorkerSearch, setShowWorkerSearch] = useState(false);
  const [viewWorkerId, setViewWorkerId] = useState<string | null>(null);
  const [editWorkerId, setEditWorkerId] = useState<string | null>(null);
  const [showEmployerWorkerList, setShowEmployerWorkerList] = useState(false);
  const [showEmployerInsuranceList, setShowEmployerInsuranceList] = useState(false);
  const [showInsuranceCompanyManager, setShowInsuranceCompanyManager] = useState(false);
  const [insuranceCompanyView, setInsuranceCompanyView] = useState<'list' | 'add' | 'edit' | 'view'>('list');
  const [showEmployerPasswordManager, setShowEmployerPasswordManager] = useState(false);
  const [showOWCBankAccountManager, setShowOWCBankAccountManager] = useState(false);
  const [owcBankAccountView, setOWCBankAccountView] = useState<'list' | 'add' | 'edit' | 'view'>('list');
  const [showOWCProvinceManager, setShowOWCProvinceManager] = useState(false);
  const [owcProvinceView, setOWCProvinceView] = useState<'list' | 'add' | 'edit' | 'view'>('list');
  const [showOWCRegionManager, setShowOWCRegionManager] = useState(false);
  const [owcRegionView, setOWCRegionView] = useState<'list' | 'add' | 'edit' | 'view'>('list');
  const [showOWCSystemParameterManager, setShowOWCSystemParameterManager] = useState(false);
  const [owcSystemParameterView, setOWCSystemParameterView] = useState<'list' | 'add' | 'edit' | 'view'>('list');
  const [showOWCInjuryPercentManager, setShowOWCInjuryPercentManager] = useState(false);
  const [owcInjuryPercentView, setOWCInjuryPercentView] = useState<'list' | 'add' | 'edit' | 'view'>('list');
  const [showOWCBodyPartManager, setShowOWCBodyPartManager] = useState(false);
  const [owcBodyPartView, setOWCBodyPartView] = useState<'list' | 'add' | 'edit' | 'view'>('list');
  const [showOWCEditCompensationCalculation, setShowOWCEditCompensationCalculation] = useState(false);
  const [showUnlockCPO, setShowUnlockCPO] = useState(false);

  const [drillDownFilter, setDrillDownFilter] = useState<{ type: 'incidentType' | 'province', value: string } | null>(null);

  const menuItems: Record<string, { items: string[]; submenus?: Record<string, string[]> }> = {
    'Search Employer To Edit': { items: [] },
    'Search Worker To Edit': { items: [] },
    'Employer - Workers List': { items: [] },
    'Employer - Insurance List': { items: [] },
    'Province': { items: ['New', 'Edit', 'View'] },
    'Insurance Company': { items: ['Insurance Provider Manager List', 'New', 'Edit', 'View'] },
    'Employer Password Change': { items: [] },
    'OWC Bank Accounts': { items: ['New', 'Edit', 'View'] },
    'Region': { items: ['New', 'Edit', 'View'] },
    'OWCStaff': { items: ['New', 'Edit', 'View'] },
    'System Parameter': { items: ['New', 'Edit', 'View'] },
    'InjuryPercent': { items: ['New', 'Edit', 'View'] },
    'BodyPart': { items: ['New', 'Edit', 'View'] },
    'Edit Compensation Calculation': { items: [] },
    'Unlock CPO': { items: [] },

    'Archives': {
      items: ['Registrars Basket', 'Payment Section', 'Tribunal'],
      submenus: { 'Registrars Basket': ['Closed Time Barred Files', 'Non Work Related Cases'] }
    }
  };

  const toggleMenu = (menu: string) => setActiveMenu(activeMenu === menu ? null : menu);

  const handleMenuItemClick = (menu: string, item: string) => {
    // Direct Actions
    if (menu === 'Search Employer To Edit') setShowEmployerSearch(true);
    if (menu === 'Search Worker To Edit') setShowWorkerSearch(true);
    if (menu === 'Employer Password Change') setShowEmployerPasswordManager(true);
    if (menu === 'Employer - Workers List') setShowEmployerWorkerList(true);
    if (menu === 'Employer - Insurance List') setShowEmployerInsuranceList(true);

    if (menu === 'Province') {
      setOWCProvinceView('list');
      setShowOWCProvinceManager(true);
    }

    if (menu === 'Region') {
      setOWCRegionView('list');
      setShowOWCRegionManager(true);
    }

    if (menu === 'Insurance Company') {
      if (item === 'Insurance Provider Manager List' || item === '') {
        setInsuranceCompanyView('list');
        setShowInsuranceCompanyManager(true);
      } else {
        const v = item.toLowerCase();
        const mappedView = v === 'new' ? 'add' : (['add', 'edit', 'view', 'list'].includes(v) ? v : 'list');
        setInsuranceCompanyView(mappedView as any);
        setShowInsuranceCompanyManager(true);
      }
    }

    if (menu === 'OWC Bank Accounts') {
      setOWCBankAccountView('list');
      setShowOWCBankAccountManager(true);
    }

    if (menu === 'OWCStaff') {
      if (item === 'New') setShowNewStaffForm(true);
      if (item === 'Edit') setShowStaffPicker(true);
    }

    if (menu === 'System Parameter') {
      setOWCSystemParameterView('list');
      setShowOWCSystemParameterManager(true);
    }

    if (menu === 'InjuryPercent') {
      setOWCInjuryPercentView('list');
      setShowOWCInjuryPercentManager(true);
    }

    if (menu === 'BodyPart') {
      setOWCBodyPartView('list');
      setShowOWCBodyPartManager(true);
    }

    if (menu === 'Edit Compensation Calculation') {
      setShowOWCEditCompensationCalculation(true);
    }

    if (menu === 'Unlock CPO') {
      setShowUnlockCPO(true);
    }


    setActiveMenu(null);
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">OWC Admin Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Administrator'}</p>
        <GoToReportsButton />
      </div>

      {/* Navigation Menu */}
      <div className="mb-8 bg-white rounded-lg shadow">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(menuItems).map(([menu, { items, submenus = {} }]) => (
            <div key={menu} className="relative">
              <button
                onClick={() => items.length > 0 ? toggleMenu(menu) : handleMenuItemClick(menu, '')}
                className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span className="font-medium">{menu}</span>
                {items.length > 0 && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${activeMenu === menu ? 'transform rotate-180' : ''}`} />
                )}
              </button>
              {activeMenu === menu && items.length > 0 && (
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
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Business Intelligence & Analytics Section */}
      <OWCAdminAnalytics
        onDrillDown={(type, value) => {
          setDrillDownFilter({ type, value });
          setShowWorkerSearch(true);
        }}
      />

      {/* System Activity & Additional Insights (Optional/Future) */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* You can add more specific admin reports or logs here if needed */}
      </div>

      {/* Modals */}
      {showNewStaffForm && (
        <NewOWCStaffForm onClose={() => setShowNewStaffForm(false)} />
      )}

      {showStaffPicker && (
        <StaffPickerModal
          onClose={() => setShowStaffPicker(false)}
          onSelect={(id) => {
            setShowStaffPicker(false);
            setEditStaffId(id);
          }}
        />
      )}

      {editStaffId && (
        <EditOWCStaffForm
          staffId={editStaffId}
          onClose={() => setEditStaffId(null)}
        />
      )}

      {showEmployerSearch && (
        <EmployerSearchModal
          onClose={() => setShowEmployerSearch(false)}
          formType="edit"
        />
      )}

      {showWorkerSearch && (
        <WorkerSearchModal
          onClose={() => {
            setShowWorkerSearch(false);
            setDrillDownFilter(null);
          }}
          searchType="edit"
          onSelectWorker={(id) => {
            setShowWorkerSearch(false);
            setEditWorkerId(id);
          }}
          initialProvince={drillDownFilter?.type === 'province' ? drillDownFilter.value : undefined}
          initialIncidentType={drillDownFilter?.type === 'incidentType' ? drillDownFilter.value : undefined}
        />
      )}

      {viewWorkerId && (
        <ViewWorkerRegistrationForm
          WorkerID={viewWorkerId}
          onClose={() => setViewWorkerId(null)}
        />
      )}

      {editWorkerId && (
        <EditWorkerRegistrationForm
          WorkerID={editWorkerId}
          onClose={() => setEditWorkerId(null)}
        />
      )}

      {showEmployerWorkerList && (
        <EmployerWorkerListModal
          onClose={() => setShowEmployerWorkerList(false)}
        />
      )}

      {showEmployerInsuranceList && (
        <EmployerInsuranceListModal
          onClose={() => setShowEmployerInsuranceList(false)}
        />
      )}

      {showInsuranceCompanyManager && (
        <InsuranceCompanyManager
          onClose={() => setShowInsuranceCompanyManager(false)}
          initialView={insuranceCompanyView}
        />
      )}

      {showEmployerPasswordManager && (
        <EmployerPasswordManager
          onClose={() => setShowEmployerPasswordManager(false)}
        />
      )}

      {showOWCBankAccountManager && (
        <OWCBankAccountManager
          onClose={() => setShowOWCBankAccountManager(false)}
          initialView={owcBankAccountView}
        />
      )}

      {showOWCProvinceManager && (
        <OWCProvinceManager
          onClose={() => setShowOWCProvinceManager(false)}
          initialView={owcProvinceView}
        />
      )}

      {showOWCRegionManager && (
        <OWCRegionManager
          onClose={() => setShowOWCRegionManager(false)}
          initialView={owcRegionView}
        />
      )}

      {showOWCSystemParameterManager && (
        <OWCSystemParameterManager
          onClose={() => setShowOWCSystemParameterManager(false)}
          initialView={owcSystemParameterView}
        />
      )}

      {showOWCInjuryPercentManager && (
        <OWCInjuryPercentManager
          onClose={() => setShowOWCInjuryPercentManager(false)}
          initialView={owcInjuryPercentView}
        />
      )}

      {showOWCBodyPartManager && (
        <OWCBodyPartManager
          onClose={() => setShowOWCBodyPartManager(false)}
          initialView={owcBodyPartView}
        />
      )}

      {showOWCEditCompensationCalculation && (
        <OWCEditCompensationCalculation
          onClose={() => setShowOWCEditCompensationCalculation(false)}
        />
      )}

      {showUnlockCPO && (
        <UnlockCPOModal onClose={() => setShowUnlockCPO(false)} />
      )}

    </div>
  );
};

export default OWCAdminDashboard;
