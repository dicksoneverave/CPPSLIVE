import React, { useEffect, useMemo, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { supabase } from "../../services/supabase";
import ViewForm11 from "./ViewForm11";
import ViewForm12 from "./ViewForm12";

export type IncidentTypeKind = "Injury" | "Death" | string;

interface ApprovedTimebarredFormSubmissionRegistrarReviewProps {
  irn: number | string;
  incidentType: IncidentTypeKind; // expected: "Injury" | "Death"
  onClose: () => void;
}

const ApprovedTimebarredFormSubmissionRegistrarReview: React.FC<
  ApprovedTimebarredFormSubmissionRegistrarReviewProps
> = ({ irn, incidentType, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [recordIncidentType, setRecordIncidentType] = useState<string | null>(null);
  const [displayCRN, setDisplayCRN] = useState<string | null>(null); // NEW: CRN (DisplayIRN)

  const irnNumber = useMemo(() => {
    const n = typeof irn === "string" ? Number(irn) : irn;
    return Number.isFinite(n as number) ? (n as number) : null;
  }, [irn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch worker + type + CRN in one go
        const { data, error } = await supabase
          .from("form1112master")
          .select("WorkerID, IncidentType, DisplayIRN")
          .eq("IRN", irn)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("No form found for the provided IRN.");

        if (!cancelled) {
          setWorkerId(data.WorkerID || null);
          setRecordIncidentType(data.IncidentType || null);
          setDisplayCRN(data.DisplayIRN || null); // set CRN
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || "Failed to load form record.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [irn]);

  const effectiveIncidentType = (incidentType || recordIncidentType || "").toString();
  const showTypeMismatch = recordIncidentType && incidentType && recordIncidentType !== incidentType;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      {/* wider shell so the embedded view can span */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl md:w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 truncate">
              Registrar Review — Approved/Time-barred Submission
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              IRN: <span className="font-mono">{String(irn)}</span>
              {displayCRN ? (
                <>
                  {" "} | CRN: <span className="font-mono">{displayCRN}</span>
                </>
              ) : null}
              {workerId ? (
                <>
                  {" "} | Worker: <span className="font-mono">{workerId}</span>
                </>
              ) : null}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-sm text-gray-600">Loading…</div>}
          {!loading && error && (
            <div className="p-6">
              <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>
            </div>
          )}

          {!loading && !error && workerId && (
            <div className="p-6 space-y-4">
              {showTypeMismatch && (
                <div className="flex items-start gap-2 p-3 rounded border bg-amber-50 text-amber-800 border-amber-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="font-medium">Incident type mismatch</div>
                    <div>
                      Provided: <span className="font-mono">{incidentType}</span>; Record:{" "}
                      <span className="font-mono">{recordIncidentType}</span>. Using{" "}
                      <span className="font-semibold">{effectiveIncidentType}</span> to render.
                    </div>
                  </div>
                </div>
              )}

{/* Full-width embed wrapper that neutralizes any max-w / mx-auto coming from child */}
<div className="w-full
                [&_*]:w-full
                [&_div.max-w-4xl]:!max-w-none
                [&_div.max-w-5xl]:!max-w-none
                [&_.mx-auto]:!mx-0">
  {effectiveIncidentType === "Injury" ? (
    <ViewForm11 embedded workerId={workerId} irn={irn} onClose={onClose} />
  ) : effectiveIncidentType === "Death" ? (
    <ViewForm12 embedded workerId={workerId} irn={irn} onClose={onClose} />
  ) : (
    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
      Unsupported IncidentType: <span className="font-mono">{String(effectiveIncidentType)}</span>.
      Expected <span className="font-mono">"Injury"</span> or <span className="font-mono">"Death"</span>.
    </div>
  )}
</div>


              {/* Footer action */}
              <div className="pt-4 border-t mt-4 flex justify-end">
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovedTimebarredFormSubmissionRegistrarReview;
