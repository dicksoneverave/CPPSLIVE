import React from 'react';
import { Users, ClipboardList, DollarSign, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();

  const stats = [
    { title: 'Total Users', value: '243', icon: <Users className="h-8 w-8 text-blue-500" />, change: '+12% from last month' },
    { title: 'Open Claims', value: '56', icon: <ClipboardList className="h-8 w-8 text-orange-500" />, change: '-3% from last month' },
    { title: 'Payments Processed', value: '₱ 1.2M', icon: <DollarSign className="h-8 w-8 text-green-500" />, change: '+8% from last month' },
    { title: 'System Usage', value: '89%', icon: <BarChart3 className="h-8 w-8 text-purple-500" />, change: '+5% from last month' }
  ];

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Administrator'}</p>
				<GoToReportsButton />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="card hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{stat.title}</h3>
              {stat.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-gray-900">{stat.value}</span>
              <span className="text-sm text-gray-500">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content with 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Feed - 2/3 width */}
        <div className="lg:col-span-2">
          <div className="card h-full">
            <h2 className="text-xl font-semibold mb-4">Recent System Activity</h2>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((_, index) => (
                <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">
                        {[
                          "New user registered",
                          "Claim #C-2023-04912 approved",
                          "Payment batch processed",
                          "System maintenance completed",
                          "Report generated"
                        ][index]}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[
                          "John Doe (employer) created an account",
                          "Mary Smith approved compensation claim",
                          "Batch #2023-04-22 processed successfully",
                          "Security patches applied",
                          "Monthly claims summary for April"
                        ][index]}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{`${index + 1}h ago`}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button className="text-sm text-primary font-medium hover:underline">
                View All Activity
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions - 1/3 width */}
        <div>
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="btn btn-primary w-full justify-start">
                <Users size={16} className="mr-2" />
                Manage Users
              </button>
              <button className="btn btn-primary w-full justify-start">
                <ClipboardList size={16} className="mr-2" />
                Review Claims
              </button>
              <button className="btn btn-primary w-full justify-start">
                <DollarSign size={16} className="mr-2" />
                Process Payments
              </button>
              <button className="btn btn-primary w-full justify-start">
                <BarChart3 size={16} className="mr-2" />
                Generate Reports
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">System Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Database</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Healthy
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">API Services</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Operational
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Backup System</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Scheduled
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Payment Gateway</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
