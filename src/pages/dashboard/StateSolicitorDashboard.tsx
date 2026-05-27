// src/pages/statesolicitor/StateSolicitorDashboard.tsx
import React, { useState } from 'react';
import { Scale, FileText, Clock, CheckCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

// NEW: import the list and the detail modal
import ListPendingForm6ForStateSolicitorReview from '../../components/forms/ListPendingForm6ForStateSolicitorReview';
import PendingForm6ForStateSolicitorReview from '../../components/forms/PendingForm6ForStateSolicitorReview';
import ListForm6ForwardedToTribunalForStateSolicitor from '../../components/forms/ListForm6ForwardedToTribunalForStateSolicitor';

type IncidentType = 'Injury' | 'Death';

const StateSolicitorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // NEW: modal state
  const [showForm6PendingList, setShowForm6PendingList] = useState(false);
  const [showForm6ForwardedList, setShowForm6ForwardedList] = useState(false);
  const [showPendingForm6Review, setShowPendingForm6Review] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string>('');
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType>('Injury');

  const menuItems = {
    'Form6': {
      items: [
        'Form6 Pending',
        'Form6 Forwarded To Tribunal'
      ]
    }
  };

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuItemClick = (menu: string, item: string) => {
    console.log(`Selected ${item} from ${menu}`);
    setActiveMenu(null);

    // NEW: open the Form6 Pending list
    if (menu === 'Form6' && item === 'Form6 Pending') {
      setShowForm6PendingList(true);
    }

    // NEW: open the Form6 Forwarded list
    if (menu === 'Form6' && item === 'Form6 Forwarded To Tribunal') {
      setShowForm6ForwardedList(true);
    }
  };

  // NEW: when a row is selected from the list, open the PendingForm6ForStateSolicitorReview modal
  const handleSelectIRNFromList = (irn: string, incidentType: IncidentType) => {
    setSelectedIRN(irn);
    setSelectedIncidentType(incidentType);
    setShowPendingForm6Review(true);
  };

  const closeForm6PendingList = () => setShowForm6PendingList(false);
  const closeForm6ForwardedList = () => setShowForm6ForwardedList(false);
  const closePendingForm6Review = () => {
    setShowPendingForm6Review(false);
    setSelectedIRN('');
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">State Solicitor Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'State Solicitor'}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-blue-100 mr-4">
              <Scale className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold">15</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-green-100 mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Reviewed Today</p>
              <p className="text-2xl font-bold">8</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-amber-100 mr-4">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg. Review Time</p>
              <p className="text-2xl font-bold">2.5h</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-purple-100 mr-4">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Reviews</p>
              <p className="text-2xl font-bold">124</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Claims Pending Legal Review</h2>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((_, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Claim #{2023450 + index}</p>
                  <p className="text-sm text-gray-500">Submitted on {new Date().toLocaleDateString()}</p>
                </div>
                <button className="btn btn-primary text-sm">Review</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Reviews</h2>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((_, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Claim #{2023447 + index}</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      index % 2 === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {index % 2 === 0 ? 'Approved' : 'Needs Revision'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Reviewed on {new Date().toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NEW: Modals */}
      {showForm6PendingList && (
        <ListPendingForm6ForStateSolicitorReview
          onClose={closeForm6PendingList}
          onSelectIRN={handleSelectIRNFromList}
        />
      )}

      {showForm6ForwardedList && (
        <ListForm6ForwardedToTribunalForStateSolicitor
          onClose={closeForm6ForwardedList}
          onSelectIRN={handleSelectIRNFromList}
        />
      )}

      {showPendingForm6Review && selectedIRN && (
        <PendingForm6ForStateSolicitorReview
          irn={selectedIRN}
          incidentType={selectedIncidentType}
          onClose={closePendingForm6Review}
        />
      )}
    </div>
  );
};

export default StateSolicitorDashboard;
