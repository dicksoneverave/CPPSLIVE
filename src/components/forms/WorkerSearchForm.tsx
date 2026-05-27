import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { supabase } from '../../services/supabase';


import WorkerRegistrationForm from './WorkerRegistrationForm';
import ViewForm11 from './ViewForm11';
import ViewForm12 from './ViewForm12';
import NewForm11 from './NewForm11';
import NewForm12 from './NewForm12';
import EditForm11 from './EditForm11';
import EditForm12 from './EditForm12';


interface WorkerSearchFormProps {
  onClose: () => void;
  formType: 'Form11' | 'Form12';
  searchType: 'new' | 'edit' | 'view';
}

type Action = 'View' | 'Proceed' | 'Edit';

interface BaseResult {
  WorkerID: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  hasForm3: boolean;
  hasForm4: boolean;
}

/**
 * For "new" searches, rows are worker-centric (no IRN).
 * For "edit"/"view" searches, rows are form-centric (each IRN is its own row).
 */
type SearchResult =
  | (BaseResult & {
      // worker-centric (NEW)
      has1112: boolean;
     hasForm11?: boolean;          // Injury
    hasForm12?: boolean;          // Death
      IRN: null;
      DisplayIRN: null;
      _kind: 'worker';
    })
  | (BaseResult & {
      // form-centric (EDIT/VIEW)
      has1112: true;
      IRN: string;
      DisplayIRN: string | null;
      _kind: 'form';
    });

// Badge label (worker-centric) based on what's found and which formType user selected
const getWorkerBadgeLabel = (row: SearchResult, formType: 'Form11' | 'Form12') => {
if (row._kind !== 'worker') return '';
const has11 = !!row.hasForm11;
const has12 = !!row.hasForm12;
 if (has11 && has12) return 'Has Form 11 & 12';
if (formType === 'Form11') return has11 ? 'Has Form 11' : (has12 ? 'Has Form 12' : 'No Form 11/12');
 return has12 ? 'Has Form 12' : (has11 ? 'Has Form 11' : 'No Form 11/12');
 };



const StatusBadge: React.FC<{ locked: boolean }> = ({ locked }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        locked
          ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
          : 'bg-green-100 text-green-700 ring-1 ring-green-200'
      }`}
      title={locked ? 'Form 3/4 exists; editing locked.' : 'No downstream forms; editable.'}
    >
      {locked && <Lock className="h-3 w-3" />}
      {locked ? 'Locked (Form 3/4)' : 'Editable'}
    </span>
  );
};

const WorkerSearchForm: React.FC<WorkerSearchFormProps> = ({ onClose, formType, searchType }) => {
  // Inputs
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workerIdInput, setWorkerIdInput] = useState('');
  const [crnInput, setCrnInput] = useState('');

  // Results/UI state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showNotFound, setShowNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Routing
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedIrn, setSelectedIrn] = useState<string | null>(null);

  const [showViewForm11, setShowViewForm11] = useState(false);
  const [showViewForm12, setShowViewForm12] = useState(false);
  const [showForm11, setShowForm11] = useState(false);
  const [showForm12, setShowForm12] = useState(false);
  const [showEditForm11, setShowEditForm11] = useState(false);
  const [showEditForm12, setShowEditForm12] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);

  const incidentType = formType === 'Form11' ? 'Injury' : 'Death';

  // -------------------- Validation --------------------
  const validateInputs = () => {
    if (searchType === 'new') {
      if (!firstName && !lastName) return 'For New, search by First or Last name.';
      return null;
    }
    if (!crnInput && !workerIdInput && !firstName && !lastName) {
      return 'Enter CRN, Worker ID, or First/Last name.';
    }
    return null;
  };


 const handleViewForType = (row: SearchResult, viewAs: 'Form11' | 'Form12') => {
   setSelectedWorkerId(row.WorkerID);   setSelectedIrn(row._kind === 'form' ? row.IRN : null);
   if (viewAs === 'Form11') {
     setShowViewForm11(true);
   } else {
     setShowViewForm12(true);
   }
 };

	
  // -------------------- Search --------------------
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowNotFound(false);
    setSearchResults([]);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      const isNew = searchType === 'new';
      const workerIdQuery = isNew ? '' : workerIdInput.trim();
      const crnQuery = isNew ? '' : crnInput.trim();

      // We will build one of two shapes:
      // - NEW: worker-centric results (no IRN)
      // - EDIT/VIEW: form-centric results (each IRN is a row)
      if (isNew) {
        // 1) Find workers by name
        let wq = supabase
          .from('workerpersonaldetails')
          .select('WorkerID, WorkerFirstName, WorkerLastName');

        if (firstName) wq = wq.ilike('WorkerFirstName', `%${firstName}%`);
        if (lastName)  wq = wq.ilike('WorkerLastName', `%${lastName}%`);

        const { data: workers, error: we } = await wq;
        if (we) throw we;

        if (!workers || workers.length === 0) {
          setShowNotFound(true);
          return;
        }

        const workerIds = workers.map(w => w.WorkerID);

        // 2) Pull ALL Form11/12 for those workers (both incident types)
       const { data: m1112All, error: m1112Err } = await supabase
				 .from('form1112master')
          .select('WorkerID, IRN, DisplayIRN, IncidentType')
          .in('WorkerID', workerIds);
        if (m1112Err) throw m1112Err;

        // Track per worker which incident types exist + collect all IRNs to check Form 3/4
        const byWorker: Record<string, { injuryIRNs: Set<string>; deathIRNs: Set<string>; allIRNs: Set<string>; }> = {};
        workerIds.forEach(id => {
          byWorker[id] = { injuryIRNs: new Set(), deathIRNs: new Set(), allIRNs: new Set() };
        });
        (m1112All || []).forEach(r => {
          if (!r.WorkerID || !r.IRN) return;
          const bucket = byWorker[r.WorkerID] || (byWorker[r.WorkerID] = { injuryIRNs: new Set(), deathIRNs: new Set(), allIRNs: new Set() });
          if (r.IncidentType === 'Injury') bucket.injuryIRNs.add(r.IRN);
          if (r.IncidentType === 'Death')  bucket.deathIRNs.add(r.IRN);
          bucket.allIRNs.add(r.IRN);
       });

     // 3) Downstream forms presence (any IRN for that worker)
        let hasForm3ByWorker = new Set<string>();
        let hasForm4ByWorker = new Set<string>();
        const allIrns = Array.from(
          new Set(
            Object.values(byWorker).flatMap(b => Array.from(b.allIRNs))
          )
        );
        if (allIrns.length > 0) {
          const [{ data: f3, error: f3e }, { data: f4, error: f4e }] = await Promise.all([
 supabase.from('form3master').select('WorkerID, IRN').in('WorkerID', workerIds).in('IRN', allIrns),
           supabase.from('form4master').select('WorkerID, IRN').in('WorkerID', workerIds).in('IRN', allIrns),
           
          ]);
          if (f3e) throw f3e;
          if (f4e) throw f4e;
          f3?.forEach(r => hasForm3ByWorker.add(r.WorkerID));
          f4?.forEach(r => hasForm4ByWorker.add(r.WorkerID));
        }

        const results: SearchResult[] = workers.map(w => {
		         const b = byWorker[w.WorkerID] || { injuryIRNs: new Set(), deathIRNs: new Set(), allIRNs: new Set() };
          const has11 = b.injuryIRNs.size > 0; // Injury => Form11
          const has12 = b.deathIRNs.size > 0;  // Death  => Form12
          return {			
          _kind: 'worker',
          WorkerID: w.WorkerID,
          WorkerFirstName: w.WorkerFirstName,
          WorkerLastName: w.WorkerLastName,
            hasForm11: has11,
            hasForm12: has12,
            has1112: has11 || has12,   
          IRN: null,
          DisplayIRN: null,
          hasForm3: hasForm3ByWorker.has(w.WorkerID),
          hasForm4: hasForm4ByWorker.has(w.WorkerID),
          };
       });

        setSearchResults(results);
        return;
      }

      // ---------------- EDIT/VIEW (form-centric; one row per IRN) ----------------

      // Gather matching form1112 rows (SCOPED by IncidentType).
      const forms: Array<{ WorkerID: string; IRN: string; DisplayIRN: string | null }> = [];
      const formsSeen = new Set<string>(); // de-dupe by IRN

      // a) By CRN (DisplayIRN)
      if (crnQuery) {
        const { data, error: err } = await supabase
          .from('form1112master')
          .select('WorkerID, IRN, DisplayIRN')
          .ilike('DisplayIRN', `%${crnQuery}%`)
          .eq('IncidentType', incidentType);
        if (err) throw err;
        (data || []).forEach(r => {
          if (r.IRN && !formsSeen.has(r.IRN)) {
            forms.push({ WorkerID: r.WorkerID, IRN: r.IRN, DisplayIRN: r.DisplayIRN ?? null });
            formsSeen.add(r.IRN);
          }
        });
      }

      // b) By WorkerID (exact)
      if (workerIdQuery) {
        const { data, error: err } = await supabase
          .from('form1112master')
          .select('WorkerID, IRN, DisplayIRN')
          .eq('WorkerID', workerIdQuery)
          .eq('IncidentType', incidentType);
        if (err) throw err;
        (data || []).forEach(r => {
          if (r.IRN && !formsSeen.has(r.IRN)) {
            forms.push({ WorkerID: r.WorkerID, IRN: r.IRN, DisplayIRN: r.DisplayIRN ?? null });
            formsSeen.add(r.IRN);
          }
        });
      }

      // c) By Name(s) -> find workers then pull ALL their 11/12 forms (each IRN)
      let nameFilteredWorkerIds: string[] = [];
      if (firstName || lastName) {
        let wq = supabase
          .from('workerpersonaldetails')
          .select('WorkerID, WorkerFirstName, WorkerLastName');
        if (firstName) wq = wq.ilike('WorkerFirstName', `%${firstName}%`);
        if (lastName)  wq = wq.ilike('WorkerLastName', `%${lastName}%`);
        const { data: workersByName, error: we } = await wq;
        if (we) throw we;

        nameFilteredWorkerIds = (workersByName || []).map(w => w.WorkerID);

        if (nameFilteredWorkerIds.length > 0) {
          const { data, error: err } = await supabase
            .from('form1112master')
            .select('WorkerID, IRN, DisplayIRN')
            .in('WorkerID', nameFilteredWorkerIds)
            .eq('IncidentType', incidentType);
          if (err) throw err;
          (data || []).forEach(r => {
            if (r.IRN && !formsSeen.has(r.IRN)) {
              forms.push({ WorkerID: r.WorkerID, IRN: r.IRN, DisplayIRN: r.DisplayIRN ?? null });
              formsSeen.add(r.IRN);
            }
          });
        }
      }

      if (forms.length === 0) {
        setShowNotFound(true);
        return;
      }

      // Build a map of names for all WorkerIDs in the forms
      const allWorkerIds = Array.from(new Set(forms.map(f => f.WorkerID)));
      const { data: workers, error: workersErr } = await supabase
        .from('workerpersonaldetails')
        .select('WorkerID, WorkerFirstName, WorkerLastName')
        .in('WorkerID', allWorkerIds);
      if (workersErr) throw workersErr;

      const nameByWorker: Record<string, { first: string; last: string }> = {};
      (workers || []).forEach(w => {
        nameByWorker[w.WorkerID] = { first: w.WorkerFirstName, last: w.WorkerLastName };
      });

      // Downstream forms presence keyed by (WorkerID|IRN)
      const irns = forms.map(f => f.IRN);
      const [{ data: f3, error: f3e }, { data: f4, error: f4e }] = await Promise.all([
        supabase.from('form3master').select('WorkerID, IRN').in('WorkerID', allWorkerIds).in('IRN', irns),
        supabase.from('form4master').select('WorkerID, IRN').in('WorkerID', allWorkerIds).in('IRN', irns),
      ]);
      if (f3e) throw f3e;
      if (f4e) throw f4e;

      const f3Keys = new Set((f3 || []).map(r => `${r.WorkerID}|${r.IRN}`));
      const f4Keys = new Set((f4 || []).map(r => `${r.WorkerID}|${r.IRN}`));

      // Compose IRN-rows
      const results: SearchResult[] = forms.map(row => {
        const nm = nameByWorker[row.WorkerID] ?? { first: '', last: '' };
        const key = `${row.WorkerID}|${row.IRN}`;
        return {
          _kind: 'form',
          WorkerID: row.WorkerID,
          WorkerFirstName: nm.first,
          WorkerLastName: nm.last,
          has1112: true,
          IRN: row.IRN,
          DisplayIRN: row.DisplayIRN ?? null,
          hasForm3: f3Keys.has(key),
          hasForm4: f4Keys.has(key),
        };
      });

      setSearchResults(results);
    } catch (err) {
      console.error('Error searching for worker:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Row Actions --------------------
  const handleRowAction = (row: SearchResult, action: Action) => {
    setSelectedWorkerId(row.WorkerID);
    setSelectedIrn(row._kind === 'form' ? row.IRN : null);

    if (formType === 'Form11') {
      if (action === 'View') setShowViewForm11(true);
      else if (action === 'Edit') setShowEditForm11(true);
      else setShowForm11(true);
    } else {
      if (action === 'View') setShowViewForm12(true);
      else if (action === 'Edit') setShowEditForm12(true);
      else setShowForm12(true);
    }
  };

const renderActions = (row: SearchResult) => {
  const hasLaterForms = row.hasForm3 || row.hasForm4;

  if (searchType === 'new') {
    const has11 = (row as any).hasForm11 === true;
    const has12 = (row as any).hasForm12 === true;

    if (row._kind === 'worker') {
      // both exist -> View only (open the tab you’re on)
      if (has11 && has12) {
        return (
          <button
            onClick={() => handleViewForType(row, formType)}
            className="font-medium text-sm text-primary hover:text-primary-dark"
          >
            View
          </button>
        );
      }

      // ✅ NEW RULE: New search from Form12 + worker already has Form12 => View ONLY
      if (formType === 'Form12' && has12) {
        return (
          <button
            onClick={() => handleViewForType(row, 'Form12')}
            className="font-medium text-sm text-primary hover:text-primary-dark"
          >
            View
          </button>
        );
      }

      // existing cross-type cases
      if (formType === 'Form11' && has12 && !has11) {
        return (
          <button
            onClick={() => handleViewForType(row, 'Form12')}
            className="font-medium text-sm text-primary hover:text-primary-dark"
          >
            View
          </button>
        );
      }
      if (formType === 'Form12' && has11 && !has12) {
        return (
          <div className="flex gap-3">
            <button
              onClick={() => handleViewForType(row, 'Form11')}
              className="font-medium text-sm text-primary hover:text-primary-dark"
            >
              View
            </button>
            <button
              onClick={() => handleRowAction(row, 'Proceed')}
              className="font-medium text-sm text-green-600 hover:text-green-700"
            >
              Proceed
            </button>
          </div>
        );
      }
    }

    // default behavior unchanged
    if (row.has1112) {
      return (
        <div className="flex gap-3">
          <button
            onClick={() => handleRowAction(row, 'View')}
            className="font-medium text-sm text-primary hover:text-primary-dark"
          >
            View
          </button>
          <button
            onClick={() => handleRowAction(row, 'Proceed')}
            className="font-medium text-sm text-green-600 hover:text-green-700"
            title="Create another Form 11/12 for this worker."
          >
            Proceed
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => handleRowAction(row, 'Proceed')}
        className="font-medium text-sm text-green-600 hover:text-green-700"
      >
        Proceed
      </button>
    );
  }

  if (searchType === 'edit') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleRowAction(row, 'View')}
          className="font-medium text-sm text-primary hover:text-primary-dark"
        >
          View
        </button>
        <button
          onClick={() => !hasLaterForms && handleRowAction(row, 'Edit')}
          className={`font-medium text-sm ${hasLaterForms ? 'text-gray-400 cursor-not-allowed' : 'text-amber-600 hover:text-amber-700'}`}
          title={hasLaterForms ? 'Form 3/4 exists; editing disabled.' : 'Edit this Form 11/12 record.'}
          disabled={hasLaterForms}
        >
          Edit
        </button>
      </div>
    );
  }

  // view search
  return (
    <button
      onClick={() => handleRowAction(row, 'View')}
      className="font-medium text-sm text-primary hover:text-primary-dark"
    >
      View
    </button>
  );
};


console.log('IRN:',selectedIrn);
  // -------------------- Routed screens (early returns) --------------------
  if (showViewForm11 && selectedWorkerId) {
    return (
      <ViewForm11
        workerId={selectedWorkerId}
        irn={selectedIrn}
        onClose={() => {
          setShowViewForm11(false);
          setSelectedWorkerId(null);
          setSelectedIrn(null);
          onClose();
        }}
      />
    );
  }
  if (showEditForm11 && selectedWorkerId) {
    return (
      <EditForm11
        workerId={selectedWorkerId}
        irn={selectedIrn}
        onClose={() => {
          setShowEditForm11(false);
          setSelectedWorkerId(null);
          setSelectedIrn(null);
          onClose();
        }}
      />
    );
  }
  if (showForm11 && selectedWorkerId) {
    return (
      <NewForm11
        workerId={selectedWorkerId}
        irn={selectedIrn}					
        onClose={() => {
          setShowForm11(false);
          setSelectedWorkerId(null);
          setSelectedIrn(null);
          onClose();
        }}
      />
    );
  }

  if (showViewForm12 && selectedWorkerId) {
    return (
      <ViewForm12
        workerId={selectedWorkerId}
        irn={selectedIrn}
        onClose={() => {
          setShowViewForm12(false);
          setSelectedWorkerId(null);
          setSelectedIrn(null);
          onClose();
        }}
      />
    );
  }
  if (showEditForm12 && selectedWorkerId) {
    return (
      <EditForm12
        workerId={selectedWorkerId}
        irn={selectedIrn}
        onClose={() => {
          setShowEditForm12(false);
          setSelectedWorkerId(null);
          setSelectedIrn(null);
          onClose();
        }}
      />
    );
  }
  if (showForm12 && selectedWorkerId) {
    return (
      <NewForm12
        workerId={selectedWorkerId}
        irn={selectedIrn}				
        onClose={() => {
          setShowForm12(false);
          setSelectedWorkerId(null);
          setSelectedIrn(null);
          onClose();
        }}
      />
    );
  }

  if (showRegistrationForm) {
    return <WorkerRegistrationForm onClose={() => setShowRegistrationForm(false)} />;
  }

  // -------------------- UI --------------------
  return (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">Search Worker</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="workerId" className="block text-sm font-medium text-gray-700 mb-1">
                Worker ID {searchType === 'new' && <span className="text-gray-400">(disabled in New)</span>}
              </label>
              <input
                type="text"
                id="workerId"
                value={workerIdInput}
                onChange={(e) => setWorkerIdInput(e.target.value)}
                className="input"
                placeholder="e.g. WKR12345"
                disabled={searchType === 'new'}
              />
            </div>

            <div>
              <label htmlFor="crn" className="block text-sm font-medium text-gray-700 mb-1">
                CRN (DisplayIRN) {searchType === 'new' && <span className="text-gray-400">(disabled in New)</span>}
              </label>
              <input
                type="text"
                id="crn"
                value={crnInput}
                onChange={(e) => setCrnInput(e.target.value)}
                className="input"
                placeholder="e.g. CRN-000123"
                disabled={searchType === 'new'}
              />
            </div>

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
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>

{/* Results */}
<div className="mt-6 max-h-[400px] overflow-y-auto">
  {searchResults.length > 0 && (
    <div className="border rounded-lg overflow-hidden">
      {/* NEW: horizontal scroll wrapper */}
      <div className="overflow-x-auto">
        <table className="min-w-[900px] divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">First Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Last Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Worker ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">CRN</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {searchResults.map((row) => (
              <tr key={`${row.WorkerID}-${row._kind === 'form' ? row.IRN : 'worker'}`} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.WorkerFirstName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.WorkerLastName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.WorkerID}</td>

                {/* CRN column (4th) */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row._kind === 'form' ? (row.DisplayIRN ?? '—') : '—'}
                </td>

                {/* Status column (5th) */}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {row._kind === 'form' ? (
                    <StatusBadge locked={row.hasForm3 || row.hasForm4} />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 ring-1 ring-blue-200">
                      {getWorkerBadgeLabel(row, formType)}
                    </span>
                  )}
                </td>

                {/* Action */}
                <td className="px-6 py-4 whitespace-nowrap">{renderActions(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )}

  {showNotFound && (
    <div className="text-center py-8">
      <p className="text-gray-600 mb-4">
        {searchType === 'new'
          ? 'No workers found. You can register a new worker.'
          : `No ${incidentType.toLowerCase()} (Form ${formType === 'Form11' ? '11' : '12'}) records found for your search.`}
      </p>
      {searchType === 'new' && (
        <button onClick={() => setShowRegistrationForm(true)} className="btn btn-primary">
          Register New Worker
        </button>
      )}
    </div>
  )}
</div>

      </div>
    </div>
  );
};

export default WorkerSearchForm;
