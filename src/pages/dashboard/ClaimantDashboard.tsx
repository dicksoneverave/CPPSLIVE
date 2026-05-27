import React from 'react';
import { Clock, CheckCircle, FileText, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import GoToReportsButton from '../../components/forms/GoToReportsButton';

const ClaimantDashboard: React.FC = () => {
  const { profile } = useAuth();

  const claims = [
    { 
      id: 'C-2023-04912',
      type: 'Injury',
      injuryDate: '2023-03-20',
      employer: 'ABC Company',
      status: 'In Review',
      lastUpdated: '2023-04-15',
      steps: [
        { name: 'Claim Submitted', completed: true, date: '2023-04-01' },
        { name: 'Documentation Verified', completed: true, date: '2023-04-08' },
        { name: 'Medical Review', completed: false },
        { name: 'Final Assessment', completed: false },
        { name: 'Payment Processing', completed: false }
      ]
    },
    { 
      id: 'C-2022-08754',
      type: 'Injury',
      injuryDate: '2022-07-15',
      employer: 'ABC Company',
      status: 'Completed',
      lastUpdated: '2022-09-30',
      steps: [
        { name: 'Claim Submitted', completed: true, date: '2022-08-01' },
        { name: 'Documentation Verified', completed: true, date: '2022-08-15' },
        { name: 'Medical Review', completed: true, date: '2022-09-01' },
        { name: 'Final Assessment', completed: true, date: '2022-09-15' },
        { name: 'Payment Processing', completed: true, date: '2022-09-30' }
      ]
    }
  ];

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Claimant Dashboard</h1>
        <p className="text-gray-600">Welcome back, {profile?.full_name || 'Claimant'}</p>
				<GoToReportsButton />
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-yellow-100 mr-4">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Claims</p>
              <p className="text-2xl font-bold">1</p>
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
              <p className="text-2xl font-bold">1</p>
            </div>
          </div>
        </div>
        
        <div className="card hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-blue-100 mr-4">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Claims</p>
              <p className="text-2xl font-bold">2</p>
            </div>
          </div>
        </div>
        
        <div className="card hover:shadow-md bg-primary-light text-white">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-white/20 mr-4">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm opacity-90">File New Claim</p>
              <button className="mt-2 bg-white text-primary-dark px-3 py-1 rounded text-sm font-medium hover:bg-gray-100 transition-colors">
                Start New Claim
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Claims */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Claims</h2>
        
        <div className="space-y-6">
          {claims.map((claim) => (
            <div key={claim.id} className="card hover:shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <div>
                  <div className="flex items-center mb-2">
                    <h3 className="font-semibold text-lg mr-3">{claim.id}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${claim.status === 'Completed' ? 'bg-green-100 text-green-800' : 
                      claim.status === 'In Review' ? 'bg-blue-100 text-blue-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Type:</span> {claim.type} | 
                    <span className="font-medium"> Injury Date:</span> {claim.injuryDate} |
                    <span className="font-medium"> Employer:</span> {claim.employer}
                  </p>
                </div>
                
                <div className="mt-4 md:mt-0">
                  <button className="btn btn-primary text-sm mr-2">View Details</button>
                  {claim.status !== 'Completed' && (
                    <button className="btn btn-secondary text-sm">Contact Officer</button>
                  )}
                </div>
              </div>
              
              {/* Progress Tracker */}
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-4">Claim Progress</h4>
                <div className="relative">
                  {/* Progress Bar */}
                  <div className="absolute top-1/4 left-0 h-1 bg-gray-200 w-full z-0"></div>
                  <div 
                    className="absolute top-1/4 left-0 h-1 bg-primary z-10"
                    style={{ 
                      width: `${(claim.steps.filter(step => step.completed).length / claim.steps.length) * 100}%` 
                    }}
                  ></div>
                  
                  {/* Steps */}
                  <div className="flex justify-between relative z-20">
                    {claim.steps.map((step, index) => (
                      <div key={index} className="flex flex-col items-center text-center">
                        <div 
                          className={`w-6 h-6 rounded-full ${
                            step.completed 
                              ? 'bg-primary text-white' 
                              : 'bg-gray-200 text-gray-500'
                          } flex items-center justify-center text-xs mb-2`}
                        >
                          {step.completed ? (
                            <CheckCircle size={14} />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className="text-xs w-20">
                          <p className={`font-medium ${step.completed ? 'text-primary' : 'text-gray-500'}`}>
                            {step.name}
                          </p>
                          {step.date && (
                            <p className="text-gray-400 text-[10px] mt-1">{step.date}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Alert if missing documentation */}
              {claim.status === 'In Review' && (
                <div className="mt-6 p-3 bg-yellow-50 rounded-md flex items-start">
                  <AlertTriangle size={18} className="text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700">Action Required</p>
                    <p className="text-xs text-yellow-600">
                      Please upload your medical certification to proceed with your claim.
                      <button className="text-primary hover:underline ml-1 font-medium">
                        Upload Document
                      </button>
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Personal Information */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <p className="border p-2 rounded-md bg-gray-50">{profile?.full_name || 'John Doe'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <p className="border p-2 rounded-md bg-gray-50">{profile?.email || 'john.doe@example.com'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                <p className="border p-2 rounded-md bg-gray-50">+675 7123 4567</p>
              </div>
            </div>
          </div>
          
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <p className="border p-2 rounded-md bg-gray-50">123 Main Street, Port Moresby</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identification Number</label>
                <p className="border p-2 rounded-md bg-gray-50">ID-98765432</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
                <p className="border p-2 rounded-md bg-gray-50">Employed</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <button className="btn btn-primary">Update Personal Information</button>
        </div>
      </div>
    </div>
  );
};

export default ClaimantDashboard;
