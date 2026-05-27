import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import ViewForm18 from './ViewForm18';
//import ForwardForm18ToWorker from './ForwardForm18ToWorker';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';


interface InjuryReviewProps {
  irn: string;
  incidentType: string;
  onClose: () => void;
  onSubmit: () => void;
  onBack: () => void;
}

const Form142CPOForm18InjuryWorkerResponseView: React.FC<InjuryReviewProps> = ({ 
  irn, 
  incidentType, 
  onClose, 
  onSubmit, 
  onBack 
}) => {
  const [loading, setLoading] = useState(true);
  const [form18Data, setForm18Data] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForm18Data = async () => {
      if (!irn) {
        setError('IRN is required to load this form.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('form18master')
          .select('*')
          .eq('IRN', irn)
          .maybeSingle();

        if (error) {
          setError('Failed to load Form 18 data.');
          return;
        }

        setForm18Data(data);
      } catch (err) {
        setError('An unexpected error occurred while loading Form 18 data.');
      } finally {
        setLoading(false);
      }
    };

    fetchForm18Data();
  }, [irn]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Form 18 - Employer Accepted
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <span className="sr-only">Close</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            onClick={onClose}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <ViewForm18 irn={irn} />
          </div>

           <div className="p-6 space-y-8">
          {/* Section 1: Form 113 - Injury Claim Detail */}
          <div className="border rounded-lg p-4" id="injuryclaims-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 113 - Injury Claim Detail</h3>
            {irn ? (
              <Form113View irn={irn.toString()} onClose={onClose} />
            ) : (
              <p className="text-textSecondary">Injury claim details cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 2: Claim Decisions */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
            {{irn} ? (
              <ListClaimDecisions irn={irn} />
            ) : (
              <p className="text-textSecondary">Claim decisions cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 3: Compensation Breakup */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
            {{irn}? (
              <CompensationBreakupDetailsView 
                IRN={irn.toString()} 
                DisplayIRN={form18Data.DisplayIRN} 
                IncidentType="Injury" 
              />
            ) : (
              <p className="text-textSecondary">Compensation data cannot be loaded without a valid IRN.</p>
            )}
          </div>
</div>
						 
          <div className="mt-8 flex justify-between">
            <button 
              onClick={onBack}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <div className="space-x-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={onSubmit}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm font-medium"
              >
                Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Form142CPOForm18InjuryWorkerResponseView;
