import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import ViewWorkerRegistrationForm from './ViewWorkerRegistrationForm';
import WorkerRegistrationForm from './WorkerRegistrationForm';
import EditWorkerRegistrationForm from './EditWorkerRegistrationForm';

interface WorkerSearchModalProps {
  onClose: () => void;
  onSelectWorker: (workerId: string) => void;
  searchType: 'new' | 'edit' | 'view';
  initialProvince?: string;
  initialIncidentType?: string;
}


interface SearchResult {
  WorkerID: string;
  WorkerFirstName: string;
  WorkerLastName: string;
}

const WorkerSearchModal: React.FC<WorkerSearchModalProps> = ({ 
  onClose, 
  onSelectWorker,
  searchType,
  initialProvince,
  initialIncidentType
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [province, setProvince] = useState(initialProvince || '');
  const [incidentType, setIncidentType] = useState(initialIncidentType || '');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showNotFound, setShowNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showViewWorkerForm, setShowViewWorkerForm] = useState(false);
  const [showWorkerRegistrationForm, setShowWorkerRegistrationForm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [selectedWorkerForView, setSelectedWorkerForView] = useState<string | null>(null);
  const [showEditWorkerForm, setShowEditWorkerForm] = useState(false);
  const [selectedWorkerForEdit, setSelectedWorkerForEdit] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialProvince || initialIncidentType) {
      handleSearch(new Event('submit') as any);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setShowNotFound(false);
    setSearchResults([]);

    if (searchType === 'new') {
      if (!firstName && !lastName) {
        setError('Please enter a first name or last name to search');
        return;
      }
    } else {
      if (!firstName && !lastName && !workerId) {
        setError('Please enter a first name, last name, or worker ID to search');
        return;
      }
    }

    try {
      setLoading(true);

      // Build the query based on provided criteria and search type
      let query = supabase
        .from('workerpersonaldetails')
        .select('WorkerID, WorkerFirstName, WorkerLastName');

      if (searchType === 'new') {
        // For new registration, only search by name
        if (firstName && lastName) {
          query = query
            .ilike('WorkerFirstName', `%${firstName}%`)
            .ilike('WorkerLastName', `%${lastName}%`);
        } else if (firstName) {
          query = query.ilike('WorkerFirstName', `%${firstName}%`);
        } else if (lastName) {
          query = query.ilike('WorkerLastName', `%${lastName}%`);
        }
      } else {
        // For edit/view, allow all search criteria
        if (workerId) {
          query = query.eq('WorkerID', workerId);
        } else {
          if (firstName) query = query.ilike('WorkerFirstName', `%${firstName}%`);
          if (lastName) query = query.ilike('WorkerLastName', `%${lastName}%`);
          
          // Drill-down filters
          if (province || incidentType) {
             // We need to join or filter by form1112master. 
             // Since workerpersonaldetails doesn't have these, we'll do a subquery or separate fetch
             const { data: claims } = await supabase
               .from('form1112master')
               .select('WorkerID')
               .match({
                 ...(province ? { IncidentProvince: province } : {}),
                 ...(incidentType ? { IncidentType: incidentType } : {})
               });
             
             if (claims && claims.length > 0) {
               const wids = Array.from(new Set(claims.map(c => c.WorkerID)));
               query = query.in('WorkerID', wids);
             } else if (province || incidentType) {
               // if filters were set but no claims found, force no results
               query = query.eq('WorkerID', 'NONE');
             }
          }
        }
      }

      const { data, error: searchError } = await query;

      if (searchError) throw searchError;

      if (!data || data.length === 0) {
        setShowNotFound(true);
        return;
      }

      setSearchResults(data);
    } catch (err) {
      console.error('Error searching for workers:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorker = (workerId: string) => {
    if (searchType === 'new') {
      // For 'new' searchType, View button shows the existing worker details
      setSelectedWorkerForView(workerId);
      setShowViewWorkerForm(true);
    } else {
      onSelectWorker(workerId);
    }
  };

  const handleRegisterNewWorker = () => {
    setShowWorkerRegistrationForm(true);
  };

  // Show ViewWorkerRegistrationForm
  if (showViewWorkerForm && selectedWorkerForView) {
    return (
      <ViewWorkerRegistrationForm
        WorkerID={selectedWorkerForView}
        onClose={() => {
          setShowViewWorkerForm(false);
          setSelectedWorkerForView(null);
        }}
      />
    );
  }
console.log('selected worker for view', selectedWorkerForView);
  // Show WorkerRegistrationForm
  if (showWorkerRegistrationForm) {
    return (
      <WorkerRegistrationForm
        onClose={() => {
          setShowWorkerRegistrationForm(false);
          onClose();
        }}
      />
    );
  }

  // Show EditWorkerRegistrationForm
  if (showEditWorkerForm && selectedWorkerForEdit) {
    return (
      <EditWorkerRegistrationForm
        WorkerID={selectedWorkerForEdit}
        onClose={() => {
          setShowEditWorkerForm(false);
          setSelectedWorkerForEdit(null);
        }}
      />
    );
  }
console.log('selected worker for edit', selectedWorkerForEdit);
  
  
  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
            <h2 className="text-xl font-semibold text-gray-900">
              {searchType === 'new' ? 'Register New Worker' : 
               searchType === 'edit' ? 'Search Worker to Edit' : 
               'Search Worker to View'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
           {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
              )}

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label htmlFor="workerId" className="block text-sm font-medium text-gray-700 mb-1">
                  Worker ID
                </label>
                <input
                  type="text"
                  id="workerId"
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  className={`input ${searchType === 'new' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Enter Worker ID"
                  disabled={searchType === 'new'}
                />
              </div>

              <div className="text-center text-sm text-gray-500">OR</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                   className="input"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary flex items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Search Results */}
            <div className="mt-6 max-h-[400px] overflow-y-auto">
              {searchResults.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Worker ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          First Name
                                              </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Last Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Action
                        </th>
                        {searchType === 'new' && (
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Proceed
                          </th>
                        )}
                                          </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {searchResults.map((worker) => (
                        <tr key={worker.WorkerID} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {worker.WorkerID}
                          </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {worker.WorkerFirstName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {worker.WorkerLastName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleSelectWorker(worker.WorkerID)}
                              className="font-medium text-sm text-primary hover:text-primary-dark"
                            >
                              {searchType === 'new' ? 'View' : 
                               searchType === 'edit' ? 'Edit' : 'View'}
                            </button>
                          </td>
                          {searchType === 'new' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={handleRegisterNewWorker}
                                className="font-medium text-sm text-green-600 hover:text-green-700"
                              >
                                Proceed
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showNotFound && (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    {searchType === 'new' 
                      ? 'No existing workers found. You can register a new worker.'
                      : 'No workers found matching your search criteria.'
                    }
                  </p>
                  {searchType === 'new' && (
                    <button
                      onClick={handleRegisterNewWorker}
                      className="btn btn-primary"
                    >
                      Register New Worker
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
       </div>
      </div>
    </>
  );
};

export default WorkerSearchModal;
