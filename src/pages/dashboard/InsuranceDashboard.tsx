import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

// Lists and modals
import ListPendingForm6ForInsuranceProviderReview from '../../components/forms/ListPendingForm6ForInsuranceProviderReview';
import ListApprovedForm6ForInsuranceProviderReview from '../../components/forms/ListApprovedForm6ForInsuranceProviderReview';
//import PendingForm6ForInsuranceProviderReview from '../../components/forms/PendingForm6ForInsuranceProviderReview';

type IncidentType = 'Injury' | 'Death';

const InsuranceDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Modals state
  const [showForm6PendingList, setShowForm6PendingList] = useState(false);
  const [showForm6ApprovedList, setShowForm6ApprovedList] = useState(false);
  const [showPendingForm6Review, setShowPendingForm6Review] = useState(false);
  const [selectedIRN, setSelectedIRN] = useState<string>('');
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType>('Injury');

  const menuItems = {
    Form6: {
      items: ['Form6 Pending', 'Form6 Approved'],
    },
  };

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuItemClick = (menu: string, item: string) => {
    console.log(`Selected ${item} from ${menu}`);
    setActiveMenu(null);

    if (menu === 'Form6' && item === 'Form6 Pending') {
      setShowForm6PendingList(true);
    } else if (menu === 'Form6' && item === 'Form6 Approved') {
      setShowForm6ApprovedList(true);
    }
  };

  // Handle IRN selection from lists
  const handleSelectIRNFromList = (irn: string, incidentType: IncidentType) => {
    setSelectedIRN(irn);
    setSelectedIncidentType(incidentType);
    setShowPendingForm6Review(true);
  };

  const closeForm6PendingList = () => setShowForm6PendingList(false);
  const closeForm6ApprovedList = () => setShowForm6ApprovedList(false);
  const closePendingForm6Review = () => {
    setShowPendingForm6Review(false);
    setSelectedIRN('');
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Insurance Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {profile?.full_name || 'Insurance Officer'}
        </p>
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
                  className={`h-4 w-4 transition-transform ${
                    activeMenu === menu ? 'rotate-180' : ''
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
      </div>

      {/* Modal Sections */}
      {showForm6PendingList && (
        <ListPendingForm6ForInsuranceProviderReview
          onClose={closeForm6PendingList}
          onSelectWorker={handleSelectIRNFromList}
        />
      )}

      {showForm6ApprovedList && (
        <ListApprovedForm6ForInsuranceProviderReview
          onClose={closeForm6ApprovedList}
        />
      )}


    </div>
  );
};

export default InsuranceDashboard;
