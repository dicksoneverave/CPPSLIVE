import React, { useState, useEffect } from 'react';
import { FileText, Users, Clock, CheckCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData
} from 'chart.js';
import ListPendingFormsPrescreeningReview from '../../components/forms/ListPendingFormsPrescreeningReview';
import ListOnHoldFormsPrescreeningReview from '../../components/forms/ListOnHoldFormsPrescreeningReview';
import ListResubmittedFormsPrescreeningReview from '../../components/forms/ListResubmittedFormsPrescreeningReview';
import ListApprovedFormsPrescreeningReview from '../../components/forms/ListApprovedFormsPrescreeningReview';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MenuItem {
  items: string[];
}

interface MenuItems {
  [key: string]: MenuItem;
}

interface RecentForm {
  id: string;
  type: string;
  submittedBy: string;
  dateSubmitted: string;
  status: string;
}

interface FormCount {
  pending: number;
  onHold: number;
  resubmitted: number;
  approved: number;
}

const DeputyRegistrarDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showPendingFormsList, setShowPendingFormsList] = useState(false);
  const [showOnHoldFormsList, setShowOnHoldFormsList] = useState(false);
  const [showResubmittedFormsList, setShowResubmittedFormsList] = useState(false);
  const [showApprovedFormsList, setShowApprovedFormsList] = useState(false);
  const [formCounts, setFormCounts] = useState<FormCount>({
    pending: 0,
    onHold: 0,
    resubmitted: 0,
    approved: 0
  });
  const [loading, setLoading] = useState(true);
  const [yearlyChartData, setYearlyChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });
  const [monthlyChartData, setMonthlyChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });

  const menuItems: MenuItems = {
    'Pending Forms': {
      items: []
    },
    'OnHold Forms': {
      items: []
    },
    'Resubmitted Forms': {
      items: []
    },
    'Approved Forms': {
      items: []
    }
  };

  const recentForms: RecentForm[] = [
    {
      id: 'F11-2023-001',
      type: 'Form 11',
      submittedBy: 'John Smith',
      dateSubmitted: '2023-05-15',
      status: 'Pending Review'
    },
    {
      id: 'F3-2023-002',
      type: 'Form 3',
      submittedBy: 'Mary Johnson',
      dateSubmitted: '2023-05-14',
      status: 'Documentation Required'
    },
    {
      id: 'F4-2023-003',
      type: 'Form 4',
      submittedBy: 'Peter Wilson',
      dateSubmitted: '2023-05-13',
      status: 'Under Review'
    }
  ];

  useEffect(() => {
    fetchFormCounts();
    generateChartData();
  }, []);

  const fetchFormCounts = async () => {
    try {
      setLoading(true);

      // Fetch pending forms count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('prescreening_pending_view')
        .select('*', { count: 'exact', head: true });

      if (pendingError) throw pendingError;

      // Fetch on hold forms count
      const { count: onHoldCount, error: onHoldError } = await supabase
        .from('prescreening_onhold_view')
        .select('*', { count: 'exact', head: true });

      if (onHoldError) throw onHoldError;

      // Fetch resubmitted forms count
      const { count: resubmittedCount, error: resubmittedError } = await supabase
        .from('prescreening_resubmitted_view')
        .select('*', { count: 'exact', head: true });

      if (resubmittedError) throw resubmittedError;

      // Fetch approved forms count
      const { count: approvedCount, error: approvedError } = await supabase
        .from('prescreening_approved_view')
        .select('*', { count: 'exact', head: true });

      if (approvedError) throw approvedError;

      setFormCounts({
        pending: pendingCount || 0,
        onHold: onHoldCount || 0,
        resubmitted: resubmittedCount || 0,
        approved: approvedCount || 0
      });
    } catch (error) {
      console.error('Error fetching form counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = () => {
    // Generate random data for demonstration purposes
    // In a real application, this would fetch actual data from the database

    // Yearly data (last 5 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => (currentYear - 4 + i).toString());

    const yearlyData = {
      labels: years,
      datasets: [
        {
          label: 'Pending',
          data: years.map(() => Math.floor(Math.random() * 100) + 10),
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.5)',
        },
        {
          label: 'On Hold',
          data: years.map(() => Math.floor(Math.random() * 100) + 10),
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
        },
        {
          label: 'Resubmitted',
          data: years.map(() => Math.floor(Math.random() * 100) + 10),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
        },
        {
          label: 'Approved',
          data: years.map(() => Math.floor(Math.random() * 100) + 10),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        }
      ]
    };

    setYearlyChartData(yearlyData);

    // Monthly data (current year)
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const monthlyData = {
      labels: months,
      datasets: [
        {
          label: 'Pending',
          data: months.map(() => Math.floor(Math.random() * 50) + 5),
          borderColor: 'rgb(153, 102, 255)',
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
        },
        {
          label: 'On Hold',
          data: months.map(() => Math.floor(Math.random() * 50) + 5),
          borderColor: 'rgb(255, 205, 86)',
          backgroundColor: 'rgba(255, 205, 86, 0.5)',
        },
        {
          label: 'Resubmitted',
          data: months.map(() => Math.floor(Math.random() * 50) + 5),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
        },
        {
          label: 'Approved',
          data: months.map(() => Math.floor(Math.random() * 50) + 5),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        }
      ]
    };

    setMonthlyChartData(monthlyData);
  };

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMenuItemClick = (menu: string, item: string) => {
    console.log(`Selected ${item} from ${menu}`);

    if (menu === 'Pending Forms') {
      setShowPendingFormsList(true);
    } else if (menu === 'OnHold Forms') {
      setShowOnHoldFormsList(true);
    } else if (menu === 'Resubmitted Forms') {
      setShowResubmittedFormsList(true);
    } else if (menu === 'Approved Forms') {
      setShowApprovedFormsList(true);
    }

    setActiveMenu(null);
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Deputy Registrar Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Deputy Registrar'}</p>
        <GoToReportsButton />
      </div>

      {/* Navigation Menu */}
      <div className="mb-8 bg-white rounded-lg shadow">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(menuItems).map(([menu, { items }]) => (
            <div key={menu} className="relative">
              <button
                onClick={() => {
                  if (menu === 'Pending Forms') {
                    setShowPendingFormsList(true);
                  } else if (menu === 'OnHold Forms') {
                    setShowOnHoldFormsList(true);
                  } else if (menu === 'Resubmitted Forms') {
                    setShowResubmittedFormsList(true);
                  } else if (menu === 'Approved Forms') {
                    setShowApprovedFormsList(true);
                  } else {
                    toggleMenu(menu);
                  }
                }}
                className="w-full flex items-center justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                <span className="font-medium">{menu}</span>
                {items.length > 0 && (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${activeMenu === menu ? 'transform rotate-180' : ''
                      }`}
                  />
                )}
              </button>
              {activeMenu === menu && items.length > 0 && (
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
              <p className="text-sm text-gray-600">Pending Forms</p>
              <p className="text-2xl font-bold">{loading ? '...' : formCounts.pending}</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-green-100 mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">On Hold Forms</p>
              <p className="text-2xl font-bold">{loading ? '...' : formCounts.onHold}</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-amber-100 mr-4">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Resubmitted Forms</p>
              <p className="text-2xl font-bold">{loading ? '...' : formCounts.resubmitted}</p>
            </div>
          </div>
        </div>

        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-purple-100 mr-4">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved Forms</p>
              <p className="text-2xl font-bold">{loading ? '...' : formCounts.approved}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Forms by Year</h2>
          <div className="h-64">
            <Line
              data={yearlyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Forms by Month (Current Year)</h2>
          <div className="h-64">
            <Line
              data={monthlyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Recent Forms Table */}
      <div className="card mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Forms</h2>
          <button className="text-primary hover:text-primary-dark text-sm font-medium">
            View All
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Form ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted By
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
              {recentForms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                    {form.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {form.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {form.submittedBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {form.dateSubmitted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${form.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' :
                        form.status === 'Documentation Required' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'}`}>
                      {form.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-primary hover:text-primary-dark">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Forms Prescreening Review Modal */}
      {showPendingFormsList && (
        <ListPendingFormsPrescreeningReview
          onClose={() => setShowPendingFormsList(false)}
        />
      )}

      {/* OnHold Forms Prescreening Review Modal */}
      {showOnHoldFormsList && (
        <ListOnHoldFormsPrescreeningReview
          onClose={() => setShowOnHoldFormsList(false)}
        />
      )}

      {/* Resubmitted Forms Prescreening Review Modal */}
      {showResubmittedFormsList && (
        <ListResubmittedFormsPrescreeningReview
          onClose={() => setShowResubmittedFormsList(false)}
        />
      )}

      {/* Approved Forms Prescreening Review Modal */}
      {showApprovedFormsList && (
        <ListApprovedFormsPrescreeningReview
          onClose={() => setShowApprovedFormsList(false)}
        />
      )}
    </div>
  );
};

export default DeputyRegistrarDashboard;
