import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';


// Forms & modals you already had
import WorkerSearchForm from '../../components/forms/WorkerSearchForm';
import SearchForm3 from '../../components/forms/SearchForm3';
import SearchForm4 from '../../components/forms/SearchForm4';
import WorkerRegistrationForm from '../../components/forms/WorkerRegistrationForm';
import EditWorkerRegistrationForm from '../../components/forms/EditWorkerRegistrationForm';
import ViewWorkerRegistrationForm from '../../components/forms/ViewWorkerRegistrationForm';
import WorkerSearchModal from '../../components/forms/WorkerSearchModal';
import EmployerSearchModal from '../../components/forms/EmployerSearchModal';
import SearchAttachments from '../../components/forms/SearchAttachments';

// New analytics bits
import DashboardAnalytics from '../../pages/dashboard/DashboardAnalytics';
import YearTotalsCards from '../../pages/dashboard/YearTotalsCards';

// View components (direct open)
import ViewForm11 from '../../components/forms/ViewForm11';
import ViewForm12 from '../../components/forms/ViewForm12';
import ViewForm3  from '../../components/forms/ViewForm3';
import ViewForm4  from '../../components/forms/ViewForm4';

const DataEntryDashboard: React.FC = () => {
  const { profile } = useAuth();

  // Year shared between totals & charts
  const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());

  // Menu UI state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Feature modals
  const [showWorkerSearchForm, setShowWorkerSearchForm] = useState(false);
  const [showSearchForm3, setShowSearchForm3] = useState(false);
  const [showSearchForm4, setShowSearchForm4] = useState(false);
  const [showWorkerRegistrationForm, setShowWorkerRegistrationForm] = useState(false);
  const [showEditWorkerSearch, setShowEditWorkerSearch] = useState(false);
  const [showViewWorkerSearch, setShowViewWorkerSearch] = useState(false);
  const [showEmployerSearchModal, setShowEmployerSearchModal] = useState(false);
  const [showSearchAttachments, setShowSearchAttachments] = useState(false);

  // Attachments modal type
  const [attachmentSearchType, setAttachmentSearchType] = useState<'Injury' | 'Death'>('Injury');

  // Worker registration
  const [showEditWorkerForm, setShowEditWorkerForm] = useState(false);
  const [showViewWorkerForm, setShowViewWorkerForm] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Employer registration
  const [employerSearchType, setEmployerSearchType] = useState<'new' | 'edit' | 'view'>('new');

  // Form type / modes
  const [currentFormType, setCurrentFormType] = useState<'Form11' | 'Form12' | 'Form3' | 'Form4'>('Form11');
  const [currentSearchFormType, setCurrentSearchFormType] = useState<'new' | 'view' | 'edit' | 'injury-case'>('new');
  const [workerSearchType, setWorkerSearchType] = useState<'new' | 'edit' | 'view'>('new');

  // Direct View (Option B)
const [view, setView] = useState<{
  type: 'F11' | 'F12' | 'F3' | 'F4';
  irn?: string;               // for F11/F12/F4
  workerIRN?: number;         // for F3
  workerId?: string | null;
} | null>(null);

  // “View” callbacks for DashboardAnalytics recent tables — open actual views directly

const handleViewForm11 = ({ irn, workerId }: { irn: string; workerId?: string | null }) => setView({ type: 'F11', irn, workerId });
const handleViewForm12 = ({ irn, workerId }: { irn: string; workerId?: string | null }) => setView({ type: 'F12', irn, workerId });
const handleViewForm3  = ({ workerIRN, workerId }: { workerIRN: number; workerId?: string | null }) => setView({ type: 'F3', workerIRN, workerId });
const handleViewForm4  = ({ workerIRN, workerId }: { workerIRN: number; workerId?: string | null }) => setView({ type: 'F4', workerIRN, workerId });


  // Menu config
  const menuItems = {
    'Register Employer': { items: ['New', 'Edit', 'View'] },
    'Register Worker': { items: ['New', 'Edit', 'View'] },
    'Form3': { items: ['New', 'Edit', 'View'] },
    'Form4': { items: ['New', 'Edit', 'View'] },
    'Form11': { items: ['New', 'Edit', 'View'] },
    'Form12': { items: ['New', 'Edit', 'View'] },
    'Attachments': { items: ['Death Case', 'Injury Case'] }
  };

  const toggleMenu = (menu: string) => setActiveMenu(activeMenu === menu ? null : menu);

  const handleMenuItemClick = (menu: string, item: string) => {
    if (menu === 'Register Employer') {
      setEmployerSearchType(item.toLowerCase() as 'new' | 'edit' | 'view');
      setShowEmployerSearchModal(true);
    } else if (menu === 'Register Worker') {
      setWorkerSearchType(item.toLowerCase() as 'new' | 'edit' | 'view');
      if (item === 'View') setShowViewWorkerSearch(true);
      else setShowEditWorkerSearch(true);
    } else if (menu === 'Form11') {
      setCurrentFormType('Form11');
      setWorkerSearchType(item.toLowerCase() as 'new' | 'edit' | 'view');
      setShowWorkerSearchForm(true);
    } else if (menu === 'Form12') {
      setCurrentFormType('Form12');
      setWorkerSearchType(item.toLowerCase() as 'new' | 'edit' | 'view');
      setShowWorkerSearchForm(true);
    } else if (menu === 'Form3') {
      setCurrentSearchFormType(item.toLowerCase() as 'new' | 'view' | 'edit');
      setShowSearchForm3(true);
    } else if (menu === 'Form4') {
      setCurrentSearchFormType(item.toLowerCase() as 'new' | 'view' | 'edit');
      setShowSearchForm4(true);
    } else if (menu === 'Attachments') {
      setAttachmentSearchType(item === 'Injury Case' ? 'Injury' : 'Death');
      setShowSearchAttachments(true);
    }
    setActiveMenu(null);
  };

  const handleWorkerSelectForEdit = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setShowEditWorkerSearch(false);
    setShowEditWorkerForm(true);
  };
  const handleWorkerSelectForView = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setShowViewWorkerSearch(false);
    setShowViewWorkerForm(true);
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
			<div className="mb-8 flex items-center justify-between">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Data Entry Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Data Entry Officer'}</p>
      </div>
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
                <ChevronDown className={`h-4 w-4 transition-transform ${activeMenu === menu ? 'rotate-180' : ''}`} />
              </button>
              {activeMenu === menu && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
                  {items.map(item => (
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

      {/* Year totals (replaces Pending/Completed/etc.) */}
      <YearTotalsCards year={dashboardYear} />

      {/* Charts + Recents */}
      <DashboardAnalytics
        initialYear={dashboardYear}
        showRecents={false}
      />

      {/* Modals & forms */}
      {showWorkerSearchForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <WorkerSearchForm
            onClose={() => setShowWorkerSearchForm(false)}
            formType={currentFormType as 'Form11' | 'Form12'}
            searchType={workerSearchType}
          />
        </div>
      )}

      {showSearchForm3 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <SearchForm3 onClose={() => setShowSearchForm3(false)} formType={currentSearchFormType} />
        </div>
      )}

      {showSearchForm4 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <SearchForm4 onClose={() => setShowSearchForm4(false)} formType={currentSearchFormType}  />
        </div>
      )}

      {showWorkerRegistrationForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <WorkerRegistrationForm onClose={() => setShowWorkerRegistrationForm(false)} />
        </div>
      )}

      {showEditWorkerSearch && (
        <WorkerSearchModal
          onClose={() => setShowEditWorkerSearch(false)}
          onSelectWorker={handleWorkerSelectForEdit}
          searchType={workerSearchType}
        />
      )}

      {showViewWorkerSearch && (
        <WorkerSearchModal
          onClose={() => setShowViewWorkerSearch(false)}
          onSelectWorker={handleWorkerSelectForView}
          searchType={workerSearchType}
        />
      )}

      {showEditWorkerForm && selectedWorkerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <EditWorkerRegistrationForm
            WorkerID={selectedWorkerId}
            onClose={() => {
              setShowEditWorkerForm(false);
              setSelectedWorkerId(null);
            }}
          />
        </div>
      )}

      {showViewWorkerForm && selectedWorkerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <ViewWorkerRegistrationForm
            WorkerID={selectedWorkerId}
            onClose={() => {
              setShowViewWorkerForm(false);
              setSelectedWorkerId(null);
            }}
          />
        </div>
      )}

      {showEmployerSearchModal && (
        <EmployerSearchModal onClose={() => setShowEmployerSearchModal(false)} formType={employerSearchType} />
      )}

      {showSearchAttachments && (
        <SearchAttachments onClose={() => setShowSearchAttachments(false)} searchType={attachmentSearchType} />
      )}

      {/* Direct View modals */}
{view?.type === 'F11' && <ViewForm11 irn={view.irn} workerId={view.workerId ?? undefined} onClose={() => setView(null)} />}
{view?.type === 'F12' && <ViewForm12 irn={view.irn} workerId={view.workerId ?? undefined} onClose={() => setView(null)} />}
{view?.type === 'F3'  && view.workerIRN != null && (
  <ViewForm3
    workerIRN={view.workerIRN}
    onClose={() => setView(null)}
    embedded={false}     // or omit if default
  />
)}
{view?.type === 'F4'  && view.workerIRN != null && (
  <ViewForm4
    workerIRN={view.workerIRN}
    onClose={() => setView(null)}
    embedded={false}     // or omit if default
  />
)}

    </div>
  );
};

export default DataEntryDashboard;
