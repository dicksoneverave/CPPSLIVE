// src/components/forms/DRPendingForm.tsx
import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "../../services/supabase";
import ViewForm3 from "./ViewForm3";
import ViewForm4 from "./ViewForm4";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { generateDeputyConfirmationLetterInjury } from "../../utils/DeputyConfirmationLetterFormatInjury_jspdf";
import { generateDeputyConfirmationLetterDeath } from "../../utils/DeputyConfirmationLetterFormatDeath_jspdf";

// … keep the rest of your types/props …

const DRPendingForm: React.FC<DRPendingFormProps> = ({ irn, formType, prid, onClose }) => {
  const [decision, setDecision] = useState<"OnHold" | "Acknowledge">("OnHold");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const todayStr = () => new Date().toISOString().slice(0, 10);

  // 🔹 track the logged-in staff id for the PDF (OWCStaffMaster.OSMStaffID)
  const [userStaffID, setUserStaffID] = useState<string>("");

  useEffect(() => {
    (async () => {
      // Try to read session and map to staff id like your other files
      try {
        const raw = localStorage.getItem("session");
        if (!raw) return;
        const { user } = JSON.parse(raw);
        if (!user?.id) return;

        const { data, error } = await supabase
          .from("owcstaffmaster")
          .select("OSMStaffID")
          .eq("cppsid", user.id)
          .maybeSingle();
        if (!error && data?.OSMStaffID) {
          setUserStaffID(String(data.OSMStaffID));
        }
      } catch (e) {
        // fail-soft; PDF will still render with blank name if user id missing
        console.warn("[DRPendingForm] could not resolve OSMStaffID", e);
      }
    })();
  }, []);

  // modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ⛔️ REMOVE approvedRef + download flow since the generator already saves the file
  // const [approvedRef, setApprovedRef] = useState<ApprovedRef>(null);

  const Title = useMemo(
    () =>
      formType === "Form4"
        ? "Deputy Registrar – Prescreening (Form 4)"
        : "Deputy Registrar – Prescreening (Form 3)",
    [formType]
  );

  // ---------- helpers (unchanged except where noted) ----------

  const insertOnHoldHistory = async (): Promise<void> => {
    const payload = {
      IRN: irn,
      PRHFormType: formType,
      PRHDecisionReason: reason.trim(),
      PRHSubmissionDate: todayStr(),
      PRHDecisionDate: todayStr(),   // add as per your last instruction
    };
    const { error } = await supabase.from("prescreeningreviewhistory").insert(payload);
    if (error) throw error;
  };

  const ensurePrescreeningRow = async (): Promise<void> => {
    const status = decision === "OnHold" ? "OnHold" : "Approved";
    const payload: any = {
      PRStatus: status,
      PRDecisionReason: reason.trim(),
      PRDecisionDate: todayStr(),
    };
    // … keep your existence checks and update logic unchanged …
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

    if (Number.isFinite(prid)) {
      const { error } = await supabase.from("prescreeningreview").update(payload).eq("PRID", prid as number);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("prescreeningreview").update(payload).eq("IRN", irn);
      if (error) throw error;
    }
  };

  const runApprovedInserts = async (): Promise<void> => {
    if (decision !== "Acknowledge") return;
    const incType = formType === "Form4" ? "Death" : "Injury";

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

    const cpoPayload = {
      IRN: irn,
      IncidentType: incType,
      CPORStatus: "DocumentationPending",
      CPORSubmissionDate: todayStr(),
    };
    const { error: cpoInsErr } = await supabase.from("approvedclaimscporeview").insert(cpoPayload);
    if (cpoInsErr) throw cpoInsErr;
  };

  // ---------- submit flow ----------

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

    

      if (decision === "Acknowledge") {
				  await ensurePrescreeningRow();
        await runApprovedInserts();

  if (formType === "Form4") {
    // Death
    await generateDeputyConfirmationLetterDeath(String(irn), String(userStaffID || ""));
  } else {
    // Injury (Form3)
    await generateDeputyConfirmationLetterInjury(String(irn), String(userStaffID || ""));
  }
				

        setOkMsg("Saved: claim Approved and forwarded to Claims Processing Officer.");
        setShowConfirm(false);
        setShowSuccess(true);
      } else {
        // On Hold: log history then close
        await insertOnHoldHistory();
        setOkMsg("Saved: claim kept On Hold.");
        setShowConfirm(false);
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

  // --- UI ---

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{Title}</h2>
          <button className="p-2 rounded hover:bg-gray-100 transition" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-56px)]">
          <div className="p-5">
            {formType === "Form4" ? (
              <ViewForm4 workerIRN={irn} variant="embedded" className="mt-2" />
            ) : (
              <ViewForm3 workerIRN={irn} embedded />
            )}
          </div>

          <div className="border-t" />

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

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary disabled:opacity-60"
                onClick={() => setShowConfirm(true)}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b">
              <h4 className="font-semibold">Confirm submission</h4>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700">
              Proceed to {decision === "OnHold" ? "keep On Hold" : "Acknowledge (Approve)"} this claim? The Confirmation Letter will be automatically downloaded once you confirm.
            </div>
            <div className="px-5 py-4 flex justify-end gap-3 border-t">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary disabled:opacity-60"
                onClick={handleConfirmSubmit}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="btn btn-primary"
                onClick={() => {
                  setShowSuccess(false);
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

export default DRPendingForm;
