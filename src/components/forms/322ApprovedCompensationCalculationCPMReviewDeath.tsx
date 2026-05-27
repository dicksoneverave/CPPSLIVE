// /src/components/forms/322ApprovedCompensationCalculationCPMReviewDeath.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';

interface Form322ApprovedCompensationCalculationCPMReviewDeathProps {
  IRN?: string;
  irn?: string;
  onCloseAll?: (refresh?: boolean) => void;
}

const Form322ApprovedCompensationCalculationCPMReviewDeath: React.FC<
  Form322ApprovedCompensationCalculationCPMReviewDeathProps
> = ({ IRN, irn, onCloseAll }) => {
  const resolvedIRN = useMemo(() => (IRN ?? irn ?? '').toString(), [IRN, irn]);
  const [displayIRN, setDisplayIRN] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!resolvedIRN) return;
      const { data, error } = await supabase
        .from('workerirn')
        .select('DisplayIRN')
        .eq('IRN', resolvedIRN)
        .maybeSingle();
      if (!error && data?.DisplayIRN) setDisplayIRN(String(data.DisplayIRN));
    })();
  }, [resolvedIRN]);

  const handlePrintForm6 = async () => {
    if (!resolvedIRN) return;
    try {
      const mod = await import('../../utils/form6CPO_jspdf');
      const fn =
        (mod as any).default ??
        (mod as any).printForm6CPO ??
        (mod as any).generateForm6;
      if (typeof fn === 'function') {
        await fn(resolvedIRN);
      } else {
        alert('Form 6 printer is not available.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate Form 6.');
    }
  };

  const handleClose = () => onCloseAll?.(false);

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Compensation Calculation — CPM Review (Death) — Approved
              </h2>
              {displayIRN && (
                <span className="text-sm text-gray-600">CRN: {displayIRN}</span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
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

          {/* Body */}
          <div className="p-6 space-y-8 overflow-y-auto">
            {/* Form 113 */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                Form 113 — Death Claim Detail
              </h3>
              {resolvedIRN ? (
                <Form113View irn={resolvedIRN} onClose={handleClose} />
              ) : (
                <p className="text-gray-500">
                  Death claim details cannot be loaded without a valid IRN.
                </p>
              )}
            </section>

            {/* Claim Decisions */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                Claim Decisions
              </h3>
              {resolvedIRN ? (
                <ListClaimDecisions irn={resolvedIRN} />
              ) : (
                <p className="text-gray-500">
                  Claim decisions cannot be loaded without a valid IRN.
                </p>
              )}
            </section>

            {/* Compensation Breakup */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                Compensation Breakup
              </h3>
              {resolvedIRN ? (
                <CompensationBreakupDetailsView
                  IRN={resolvedIRN}
                  IncidentType="Death"
                />
              ) : (
                <p className="text-gray-500">
                  Compensation data cannot be loaded without a valid IRN.
                </p>
              )}
            </section>

            {/* Print Form 6 */}
            <section className="border rounded-lg p-4 bg-amber-50">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  className="px-3 py-1.5 border border-primary text-primary hover:bg-primary/5 rounded-md"
                  onClick={handlePrintForm6}
                >
                  Print Form 6
                </button>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Form322ApprovedCompensationCalculationCPMReviewDeath;
