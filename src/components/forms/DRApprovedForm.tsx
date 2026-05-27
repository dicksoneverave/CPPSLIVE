// src/components/forms/DRApprovedForm.tsx
import React, { useMemo } from "react";
import { X } from "lucide-react";

// ⬇️ adjust imports
import ViewForm3 from "./ViewForm3";
import ViewForm4 from "./ViewForm4";
import ViewForm11 from "./ViewForm11";
import ViewForm12 from "./ViewForm12";
import ListClaimDecisions from "./ListClaimDecisions";

type FormType = "Form3" | "Form4" | "Form11" | "Form12";

interface DRApprovedFormProps {
  irn: number | string;
  prid: number | string;
  formType: FormType;
  workerId?: number | string | null;
  onClose: () => void;
}

const DRApprovedForm: React.FC<DRApprovedFormProps> = ({
  irn,
  prid,
  formType,
  workerId = null,
  onClose,
}) => {
  const irnNum = Number(irn);
  const workerIdStr = workerId != null ? String(workerId) : undefined;

  const title = useMemo(() => {
    switch (formType) {
      case "Form11": return "Deputy Registrar – Approved (Form 11)";
      case "Form12": return "Deputy Registrar – Approved (Form 12)";
      case "Form4":  return "Deputy Registrar – Approved (Form 4)";
      default:       return "Deputy Registrar – Approved (Form 3)";
    }
  }, [formType]);

  const renderForm = () => {
    switch (formType) {
      case "Form11":
        return <ViewForm11 irn={irnNum} workerId={workerIdStr} />;
      case "Form12":
        return <ViewForm12 irn={irnNum} workerId={workerIdStr} />;
      case "Form4":
        return (
          <ViewForm4
            workerIRN={irnNum}
            variant="embedded"    // ✅ ensures inline rendering
            className="w-full"
          />
        );
      case "Form3":
      default:
        return (
          <ViewForm3 workerIRN={irnNum} embedded />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="p-2 rounded hover:bg-gray-100 transition" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll container */}
        <div className="overflow-y-auto max-h-[calc(95vh-56px)]">
          {/* Section 1 */}
          <div className="p-5">
            <div className="text-sm text-gray-500 mb-2">
              <span className="font-medium">IRN:</span> {irn} &nbsp;|&nbsp;
              <span className="font-medium">PRID:</span> {prid}
              {workerIdStr && (
                <>
                  &nbsp;|&nbsp;<span className="font-medium">WorkerID:</span> {workerIdStr}
                </>
              )}
            </div>
            {renderForm()}
          </div>

          <div className="border-t" />

          {/* Section 2: Claim Decisions */}
          <div className="p-5">
            <h3 className="text-base font-semibold mb-3">Claim Decisions</h3>
            <ListClaimDecisions irn={irnNum} />
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t flex justify-end">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DRApprovedForm;
