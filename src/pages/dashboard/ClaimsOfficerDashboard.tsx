import React from 'react';
import { ClipboardCheck, Clock, Search, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

const ClaimsOfficerDashboard: React.FC = () => {
  const { profile } = useAuth();

  const pendingClaims = [
    { id: 'C-2023-04912', claimant: 'John Doe', employer: 'ABC Company', type: 'Injury', dateSubmitted: '2023-04-15', status: 'Pending Review' },
    { id: 'C-2023-04918', claimant: 'Jane Smith', employer: 'XYZ Ltd', type: 'Death', dateSubmitted: '2023-04-16', status: 'Documentation Required' },
    { id: 'C-2023-04925', claimant: 'Michael Brown', employer: 'Tech Solutions', type: 'Injury', dateSubmitted: '2023-04-18', status: 'Pending Review' },
    { id: 'C-2023-04930', claimant: 'Sarah Wilson', employer: 'Global Industries', type: 'Injury', dateSubmitted: '2023-04-20', status: 'Medical Verification' }
  ];

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Claims Officer Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Claims Officer'}</p>
				<GoToReportsButton />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-blue-50 border border-blue-100">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-full p-3 mr-4">
              <ClipboardCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">Assigned to You</p>
              <p className="text-2xl font-bold text-blue-800">12</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-amber-50 border border-amber-100">
          <div className="flex items-center">
            <div className="bg-amber-100 rounded-full p-3 mr-4">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600 font-medium">Pending Review</p>
              <p className="text-2xl font-bold text-amber-800">7</p>
            </div>
          </div>
        </div>
        
        <div className="card bg-green-50 border border-green-100">
          <div className="flex items-center">
            <div className="bg-green-100 rounded-full p-3 mr-4">
              <ClipboardCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600 font-medium">Completed Today</p>
              <p className="text-2xl font-bold text-green-800">5</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative md:w-1/3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search claims..." 
              className="input pl-10"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-secondary flex items-center text-sm">
              <Filter size={16} className="mr-1" />
              Filter
            </button>
            <select className="input py-2 text-sm">
              <option>All Claim Types</option>
              <option>Injury Claims</option>
              <option>Death Claims</option>
            </select>
            <select className="input py-2 text-sm">
              <option>All Statuses</option>
              <option>Pending Review</option>
              <option>Documentation Required</option>
              <option>Medical Verification</option>
            </select>
          </div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="card overflow-hidden">
        <h2 className="text-xl font-semibold mb-4">Pending Claims</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claim ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claimant
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employer
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
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
              {pendingClaims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                    {claim.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.claimant}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.employer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.dateSubmitted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${claim.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' : 
                      claim.status === 'Documentation Required' ? 'bg-red-100 text-red-800' : 
                      'bg-blue-100 text-blue-800'}`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-primary hover:text-primary-dark mr-3">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="py-3 flex items-center justify-between border-t border-gray-200 px-4">
          <div className="flex-1 flex justify-between sm:hidden">
            <button className="btn btn-secondary">Previous</button>
            <button className="btn btn-secondary ml-3">Next</button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">4</span> of{' '}
                <span className="font-medium">12</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  Previous
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-primary text-sm font-medium text-white hover:bg-primary-dark">
                  1
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  2
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  3
                </button>
                <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimsOfficerDashboard;
