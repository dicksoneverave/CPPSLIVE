import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../services/supabase';

// ----- External embeddable components (adjust import paths as needed) -----
// These are assumed to already exist and support `variant="embedded"` when applicable.
import Form113View from '../forms/Form113View';
import Form124View from '../forms/Form124View';
import ListClaimDecisions from './ListClaimDecisions';

// ----- Props -----
export interface ApprovedRegisteredClaimsRegistrarReviewProps {
  irn: string | number;                     // passed from ListPendingRegisteredClaimsRegistrarReview
  incidentType: 'Injury' | 'Death';         // determines which Form to embed
  onClose?: () => void;                     // optional close handler for parent
  className?: string;                       // optional wrapper class
}

const ApprovedRegisteredClaimsRegistrarReview: React.FC<ApprovedRegisteredClaimsRegistrarReviewProps> = ({
  irn,
  incidentType,
  onClose,
  className,
}) => {
  // Normalize IRN for components that require a number
  const irnNumber: number | null = (() => {
    if (typeof irn === 'number') return irn;
    const n = Number(irn);
    return Number.isFinite(n) ? n : null;
  })();

  // Header: fetch CRN (DisplayIRN) for the given IRN
  const [displayIRN, setDisplayIRN] = useState<string | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setHeaderError(null);
        const { data: f1112, error: f1112Err } = await supabase
          .from('form1112master')
          .select('DisplayIRN')
          .eq('IRN', irn)
          .maybeSingle();
        if (f1112Err) throw f1112Err;
        if (!f1112) throw new Error('Form data not found');
        if (isMounted) setDisplayIRN(f1112.DisplayIRN as string);
      } catch (e: any) {
        if (isMounted) setHeaderError(e?.message ?? 'Failed to load CRN');
      }
    })();
    return () => {
      isMounted = false;
    };
		console.log('DisplayIRN:',f1112.DisplaiyIRN);
  }, [irn]);

  return (
    <div className={'w-full ' + (className ?? '')}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          CRN: {displayIRN ?? String(irn)}
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      {headerError && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
          {headerError}
        </div>
      )}

      {/* Content: stacked sections — Decisions below the Form */}
      <div className="space-y-6">
        {/* Section 1: Main Form */}
        <section>
          <div className="rounded-xl border bg-white shadow-sm p-4">
            {incidentType === 'Injury' && (
              <Form113View
                irn={irn}
                variant="embedded"
                className="w-full"
              />
            )}

            {incidentType === 'Death' && (
              <Form124View
                irn={irn}
                variant="embedded"
                className="w-full"
              />
            )}

            {incidentType !== 'Injury' && incidentType !== 'Death' && (
              <div className="p-4 text-sm text-red-700 bg-red-50 rounded-md">
                Unknown Incident Type: <span className="font-mono">{String(incidentType)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Decisions list (always below the form) */}
        <section>
          <div className="rounded-xl border bg-white shadow-sm p-4">
            <h3 className="text-base font-semibold mb-3">Claim Decisions</h3>
            {irnNumber === null ? (
              <div className="p-3 text-sm text-yellow-800 bg-yellow-50 rounded-md">
                Unable to render decisions: IRN is not a valid number.
              </div>
            ) : (
              <ListClaimDecisions irn={irnNumber} />
            )}
          </div>
        </section>

        {/* Footer */}
        {onClose && (
          <div className="p-4 border-t flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovedRegisteredClaimsRegistrarReview;
