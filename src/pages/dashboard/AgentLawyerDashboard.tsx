import React, { useState } from 'react';
import { FileText, Users, AlertTriangle, Plus, ChevronDown, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import WorkerSearchForm from '../../components/forms/WorkerSearchForm';
import SearchForm3 from '../../components/forms/SearchForm3';
import SearchForm4 from '../../components/forms/SearchForm4';
import GoToReportsButton from '../../components/forms/GoToReportsButton';


const AgentLawyerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showWorkerSearchForm, setShowWorkerSearchForm] = useState(false);
  const [showSearchForm3, setShowSearchForm3] = useState(false);
  const [showSearchForm4, setShowSearchForm4] = useState(false);
  const [currentFormType, setCurrentFormType] = useState<'Form11' | 'Form12' | 'Form3' | 'Form4'>('Form11');
  const [currentSearchFormType, setCurrentSearchFormType] = useState<'new' | 'view' | 'edit' | 'injury-case'>('new');

  const menuItems = {
    'Form3': {
      items: [
        'New',
        'Edit',
        'View'
      ]
    },
    'Form4': {
      items: [
        'New',
        'Edit',
        'View'
      ]
    },
    'Form11': {
      items: [
        'New',
        'Edit',
        'View'
      ]
    },
    'Form12': {
      items: [
        'New',
        'Edit',
        'View'
      ]
    },
    'Attachments': {
      items: [
        'Injury Case',
        'Death Case'
      ]
    }
  };

  const recentClaims = [
    {
      id: 'CLM-2023-001',
      type: 'Injury Claim',
      client: 'John Smith',
      dateSubmitted: '2023-05-15',
      status: 'Pending Review'
    },
    {
      id: 'CLM-2023-002',
      type: 'Death Claim',
      client: 'Mary Johnson',
      dateSubmitted: '2023-05-14',
      status: 'Documentation Required'
    },
    {
      id: 'CLM-2023-003',
      type: 'Injury Claim',
      client: 'Peter Wilson',
      dateSubmitted: '2023-05-13',
      status: 'Under Review'
    }
  ];

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuItemClick = (menu: string, item: string) => {
    if (menu === 'Form11' && item === 'New') {
      setCurrentFormType('Form11');
      setShowWorkerSearchForm(true);
    } else if (menu === 'Form12' && item === 'New') {
      setCurrentFormType('Form12');
      setShowWorkerSearchForm(true);
    } else if (menu === 'Form3') {
      if (item === 'New') {
        setCurrentFormType('Form3');
        setShowWorkerSearchForm(true);
      } else if (item === 'View' || item === 'Edit') {
        setCurrentSearchFormType(item.toLowerCase() as 'view' | 'edit');
        setShowSearchForm3(true);
      }
    } else if (menu === 'Form4') {
      if (item === 'New') {
        setCurrentFormType('Form4');
        setShowWorkerSearchForm(true);
      } else if (item === 'View' || item === 'Edit') {
        setShowSearchForm4(true);
      }
    } else if (menu === 'Attachments' && item === 'Injury Case') {
      setCurrentSearchFormType('injury-case');
      setShowSearchForm3(true);
    }
    
    setActiveMenu(null);
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Agent/Lawyer Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Agent/Lawyer'}</p>
				<GoToReportsButton />
      </div>

      {/* Navigation Menu */}
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
                  className={`h-4 w-4 transition-transform ${
                    activeMenu === menu ? 'transform rotate-180' : ''
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

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-blue-100 mr-4">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Claims</p>
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
              <p className="text-sm text-gray-600">Completed Claims</p>
              <p className="text-2xl font-bold">42</p>
            </div>
          </div>
        </div>
        
        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-amber-100 mr-4">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Requires Attention</p>
              <p className="text-2xl font-bold">3</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md bg-gradient-to-br from-primary to-primary-dark text-white">
          <h3 className="text-lg font-semibold mb-2">Quick Actions</h3>
          <p className="text-sm mb-4 opacity-90">Submit new claims or review existing ones</p>
          <button 
            className="btn bg-white text-primary hover:bg-gray-100 inline-flex items-center"
            onClick={() => {
              setCurrentFormType('Form11');
              setShowWorkerSearchForm(true);
            }}
          >
            <Plus size={16} className="mr-2" /> New Claim
          </button>
        </div>
      </div>

      {/* Recent Claims Table */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Recent Claims</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claim ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Submitted
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentClaims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                    {claim.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.client}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.dateSubmitted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      claim.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' : 
                      claim.status === 'Documentation Required' ? 'bg-red-100 text-red-800' : 
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-primary hover:text-primary-dark mr-3">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showWorkerSearchForm && (
        <WorkerSearchForm 
          onClose={() => setShowWorkerSearchForm(false)} 
          formType={currentFormType}
        />
      )}

      {showSearchForm3 && (
        <SearchForm3 
          onClose={() => setShowSearchForm3(false)}
          formType={currentSearchFormType}
        />
      )}

      {showSearchForm4 && (
        <SearchForm4 
          onClose={() => setShowSearchForm4(false)}
        />
      )}
    </div>
  );
};

export default AgentLawyerDashboard;
