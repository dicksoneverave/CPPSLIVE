// src/components/forms/DRPendingForm.tsx
import React, { useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import ViewForm3 from "./ViewForm3";
import ViewForm4 from "./ViewForm4";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { generateDRConfirmationLetter } from "../../utils/generateDRConfirmationLetter";

type FormType = "Form3" | "Form4";
type ApprovedRef = { irn: number; formType: FormType } | null;

interface DROnHoldFormProps {
  irn: number;
  formType: FormType;
  prid: number;
  onClose: () => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const DROnHoldForm: React.FC<DROnHoldFormProps> = ({ irn, formType, prid, onClose }) => {
  const [decision, setDecision] = useState<"OnHold" | "Acknowledge">("OnHold");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // for confirmation letter
  const [approvedRef, setApprovedRef] = useState<ApprovedRef>(null);

  const Title = useMemo(
    () =>
      formType === "Form4"
        ? "Deputy Registrar – Prescreening (Form 4)"
        : "Deputy Registrar – Prescreening (Form 3)",
    [formType]
  );

  // ---------------- helpers ----------------

  // Update-only: PRStatus, PRDecisionDate, PRDecisionReason
  const ensurePrescreeningRow = async (): Promise<void> => {
    const status = decision === "OnHold" ? "OnHold" : "Approved";
    const payload: any = {
      PRStatus: status,
      PRDecisionReason: reason.trim(),
    };
    // For both decisions we stamp DecisionDate now (keep your previous behavior)
    payload.PRDecisionDate = todayStr();

    // Preflight: confirm a row exists (no inserts allowed here)
    let exists = false;

    if (Number.isFinite(prid)) {
      const { count, error } = await supabase
        .from("prescreeningreview")
        .select("PRID", { count: "exact", head: true })
        .eq("PRID", prid as number);
      if (error) throw error;
      exists = (count ?? 0) > 0;
    }

    if (!exists) {
      const { count, error } = await supabase
        .from("prescreeningreview")
        .select("PRID", { count: "exact", head: true })
        .eq("IRN", irn);
      if (error) throw error;
      exists = (count ?? 0) > 0;
    }

    if (!exists) {
      throw new Error("No matching prescreeningreview row (by PRID or IRN) to update.");
    }

    // Run the update
    if (Number.isFinite(prid)) {
      const { error } = await supabase.from("prescreeningreview").update(payload).eq("PRID", prid as number);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("prescreeningreview").update(payload).eq("IRN", irn);
      if (error) throw error;
    }
  };

  // On Approved: set IncType FIRST, then insert into registrarreview and approvedclaimscporeview
  const runApprovedInserts = async (): Promise<void> => {
    if (decision !== "Acknowledge") return;

    const incType = formType === "Form4" ? "Death" : "Injury";

    // registrarreview (Approved)
    const rrPayload = {
      IRN: irn,
      RRStatus: "Approved",
      RRSubmissionDate: todayStr(),
      RRDecisionDate: todayStr(),
      IncidentType: incType,
      RRDecisionReason: "Auto Approved",
    };
    const { error: rrInsErr } = await supabase.from("registrarreview").insert(rrPayload);
    if (rrInsErr) throw rrInsErr;

    // approvedclaimscporeview (DocumentationPending)
    const cpoPayload = {
      IRN: irn,
      IncidentType: incType,
      CPORStatus: "DocumentationPending",
      CPORSubmissionDate: todayStr(),
    };
    const { error: cpoInsErr } = await supabase.from("approvedclaimscporeview").insert(cpoPayload);
    if (cpoInsErr) throw cpoInsErr;
  };

  // ---------------- submit flow ----------------

  const handleConfirmSubmit = async () => {
    setError(null);
    setOkMsg(null);

    if (!reason.trim()) {
      setShowConfirm(false);
      setError("Decision Reason is required.");
      return;
    }

    try {
      setSubmitting(true);

      // Always update prescreeningreview first (update-only)
      await ensurePrescreeningRow();

      if (decision === "Acknowledge") {
        // On Approved: perform both inserts as requested
        await runApprovedInserts();
      }

      setOkMsg(
        decision === "OnHold"
          ? "Saved: claim kept On Hold."
          : "Saved: claim Approved and forwarded to Claims Processing Officer."
      );

      setShowConfirm(false);

      if (decision === "Acknowledge") {
        // Keep a reference for the PDF button
        setApprovedRef({ irn, formType });
        setShowSuccess(true);
      } else {
        // For On Hold, just close right away
        onClose();
      }
    } catch (e: any) {
      console.error("[DRPendingForm] submit error", e);
      setError(e?.message || "Failed to save decision.");
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadLetter = async () => {
    if (!approvedRef) return;
    try {
      const blob = await generateDRConfirmationLetter({
        irn: approvedRef.irn,
        formType: approvedRef.formType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DeputyRegistrarConfirmation_${approvedRef.formType}_${approvedRef.irn}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate letter:", err);
      setError("Failed to generate Confirmation Letter. Please try again.");
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{Title}</h2>
          <button className="p-2 rounded hover:bg-gray-100 transition" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* content: ONE scroll container for both sections */}
        <div className="overflow-y-auto max-h-[calc(95vh-56px)]">
          {/* TOP: embedded view */}
          <div className="p-5">
            {formType === "Form4" ? (
              <ViewForm4 workerIRN={irn} variant="embedded" className="mt-2" />
            ) : (
              <ViewForm3 workerIRN={irn} embedded />
            )}
          </div>

          {/* divider */}
          <div className="border-t" />

          {/* Decision section */}
          <div className="p-5">
            <h3 className="text-base font-semibold">Decision</h3>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="decision"
                  className="h-4 w-4"
                  value="OnHold"
                  checked={decision === "OnHold"}
                  onChange={() => setDecision("OnHold")}
                />
                <span>On Hold</span>
              </label>

              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="decision"
                  className="h-4 w-4"
                  value="Acknowledge"
                  checked={decision === "Acknowledge"}
                  onChange={() => setDecision("Acknowledge")}
                />
                <span>Acknowledge</span>
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Decision Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide brief justification…"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                A reason is required whether you keep the claim On Hold or Acknowledge (Approve).
              </p>
            </div>

            {/* status / errors */}
            {error && (
              <div className="mt-4 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {okMsg && (
              <div className="mt-4 flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">
                <CheckCircle2 className="w-4 h-4 mt-0.5" />
                <span>{okMsg}</span>
              </div>
            )}

            {/* actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" className="px-4 py-2 rounded border hover:bg-gray-50" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={() => setShowConfirm(true)}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b">
              <h4 className="font-semibold">Confirm submission</h4>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700">
              Proceed to {decision === "OnHold" ? "keep On Hold" : "Acknowledge (Approve)"} this claim?
            </div>
            <div className="px-5 py-4 flex justify-end gap-3 border-t">
              <button
                type="button"
                className="px-3 py-2 rounded border hover:bg-gray-50"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={handleConfirmSubmit}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal (Approve only) */}
      {showSuccess && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-6">
              <h4 className="font-semibold text-lg">Submission Complete</h4>
              <p className="mt-2 text-sm text-gray-700">
                Claim has been Approved and forwarded to Claims Processing Officer.
              </p>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2 border-t">
              <button
                type="button"
                onClick={downloadLetter}
                className="px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100"
              >
                Confirmation Letter
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  setShowSuccess(false);
                  setApprovedRef(null);
                  onClose();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DROnHoldForm;
