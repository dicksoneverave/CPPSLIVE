// /src/utils/ChecklistForPayment_jspdf.ts
import { jsPDF } from "jspdf";
import { supabase } from "../services/supabase";

/** PNG crest shown in the header (centered) */
const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

const toOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const fmtDate_JSF_Y = (d: Date) =>
  `${toOrdinal(d.getDate())} ${d.toLocaleString("en-US", { month: "long" })}, ${d.getFullYear()}`;

const fetchAsDataUrl = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
};

type Row = { submission: string; remarks: string; by: string };

/**
 * Generate "Checklist for Payment" PDF (matches legacy PHP layout)
 * @param irn IRN (number or string)
 */
export async function generateChecklistForPayment(irn: number | string) {
  //const irnNum = Number(irn);
	 const irnNum = typeof irn === 'string' ? irn : String(irn);

  // ======== Fetch base entities (mirrors PHP queries) ========
  const { data: f1112 } = await supabase
    .from("form1112master")
    .select("DisplayIRN, WorkerID, IncidentType")
    .eq("IRN", irnNum)
    .maybeSingle();

  if (!f1112) throw new Error("form1112master not found for IRN");

  const { data: worker } = await supabase
    .from("workerpersonaldetails")
    .select("WorkerFirstName, WorkerLastName")
    .eq("WorkerID", f1112.WorkerID)
    .maybeSingle();

  const { data: empSnap } = await supabase
    .from("currentemploymentdetails")
    .select("EmployerCPPSID")
    .eq("WorkerID", f1112.WorkerID)
    .maybeSingle();

  const employerCPPSID =
    (empSnap as any)?.EmployerCPPSID ?? (empSnap as any)?.EmployercppsID ?? null;

  let employerName = "";
  if (employerCPPSID != null) {
    const { data: employer } = await supabase
      .from("employermaster")
      .select("OrganizationName")
      .eq("CPPSID", employerCPPSID)
      .maybeSingle();
    employerName = employer?.OrganizationName ?? "";
  }

  const workerName = `${worker?.WorkerFirstName ?? ""} ${worker?.WorkerLastName ?? ""}`.trim();
  const displayIRN = f1112.DisplayIRN ?? String(irn);
  const incidentType = f1112.IncidentType ?? "";

  // ======== Build “Table 2” rows from all the review/attachment tables, like PHP ========
  const rows: Row[] = [];
  let sno = 0;
  const push = (submission: string, remarks: string, by: string) =>
    rows.push({ submission, remarks, by });

  // PrescreeningReview: PRStatus='Approved'
  try {
    const { data } = await supabase
      .from("prescreeningreview")
      .select("PRFormType, PRDecisionReason")
      .eq("IRN", irnNum)
      .eq("PRStatus", "Approved");
    (data ?? []).forEach((r) => push(r.PRFormType || "", r.PRDecisionReason || "", "Deputy Registrar"));
  } catch (e) {
    console.warn("prescreeningreview fetch error", e);
  }

  // FormAttachments: list all attachments as Submitted by Worker/Repr
  try {
    const { data } = await supabase
      .from("formattachments")
      .select("AttachmentType")
      .eq("IRN", irnNum);
    (data ?? []).forEach((r) => push(r.AttachmentType || "", "Submitted", "Worker/Repr"));
  } catch (e) {
    console.warn("formattachments fetch error", e);
  }

  // RegistrarReview: RRStatus='Approved'
  try {
    const { data } = await supabase
      .from("registrarreview")
      .select("IncidentType, RRDecisionReason")
      .eq("IRN", irnNum)
      .eq("RRStatus", "Approved")
      .maybeSingle();
    if (data) push(data.IncidentType || "", data.RRDecisionReason || "", "Registrar");
  } catch (e) {
    console.warn("registrarreview fetch error", e);
  }

  // ApprovedClaimsCPOReview: CPORStatus='CompensationCalculated'
  try {
    const { data } = await supabase
      .from("approvedclaimscporeview")
      .select("IncidentType, CPORStatus")
      .eq("IRN", irnNum)
      .eq("CPORStatus", "CompensationCalculated")
      .maybeSingle();
    if (data) push(data.IncidentType || "", "Compensation Calculated", "CPO");
  } catch (e) {
    console.warn("approvedclaimscporeview fetch error", e);
  }

  // Form6Master: F6MStatus='CompensationAccepted'
  try {
    const { data } = await supabase
      .from("form6master")
      .select("IncidentType, F6MStatus")
      .eq("IRN", irnNum)
      .eq("F6MStatus", "CompensationAccepted")
      .maybeSingle();
    if (data) push(data.IncidentType || "", "Compensation Accepted", "Employer");
  } catch (e) {
    console.warn("form6master fetch error", e);
  }

  // Form18Master: F18MStatus='WorkerAccepted' => two rows (Employer Accepted, Worker Accepted)
  try {
    const { data } = await supabase
      .from("form18master")
      .select("IncidentType, F18MStatus")
      .eq("IRN", irnNum)
      .eq("F18MStatus", "WorkerAccepted")
      .maybeSingle();
    if (data) {
      push(data.IncidentType || "", "Employer Accepted", "Employer");
      push(data.IncidentType || "", "Worker Accepted", "Worker");
    }
  } catch (e) {
    console.warn("form18master fetch error", e);
  }

  // ClaimsAwardedCommissionersReview: CACRReviewStatus LIKE '%CommissionerAccepted'
  try {
    const { data } = await supabase
      .from("claimsawardedcommissionersreview")
      .select("IncidentType, ClaimType, CACRReviewStatus")
      .eq("IRN", irnNum)
      .maybeSingle();
    if (data && String(data.CACRReviewStatus || "").toLowerCase().includes("commissioneraccepted")) {
      const isPrivate = (data.ClaimType || "") === "PrivateInsured";
      push(
        data.IncidentType || "",
        isPrivate ? "Commissioner Accepted" : "Chief Commissioner Accepted",
        isPrivate ? "Commissioner" : "Chief Commissioner"
      );
    }
  } catch (e) {
    console.warn("claimsawardedcommissionersreview fetch error", e);
  }

  // ClaimsAwardedRegistrarReview: CARRReviewStatus='RegistrarAccepted'
  try {
    const { data } = await supabase
      .from("claimsawardedregistrarreview")
      .select("IncidentType, CARRDecisionReason, CARRReviewStatus")
      .eq("IRN", irnNum)
      .eq("CARRReviewStatus", "RegistrarAccepted")
      .maybeSingle();
    if (data) push(data.IncidentType || "", data.CARRDecisionReason || "", "Registrar");
  } catch (e) {
    console.warn("claimsawardedregistrarreview fetch error", e);
  }

  // ClaimsAwardedPaymentSectionReview: CAPSRReviewStatus='ReviewCompleted'
  try {
    const { data } = await supabase
      .from("claimsawardedpaymentsectionreview")
      .select("IncidentType, CAPSRNotes, CAPSRReviewStatus")
      .eq("IRN", irnNum)
      .eq("CAPSRReviewStatus", "ReviewCompleted")
      .maybeSingle();
    if (data) push(data.IncidentType || "", data.CAPSRNotes || "", "Payment Section");
  } catch (e) {
    console.warn("claimsawardedpaymentsectionreview fetch error", e);
  }

  // ======== PDF LAYOUT ========
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Watermark
  doc.setFont("times", "bold");
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  (doc as any).text("O R I G I N A L", 65, 190, { angle: 45 });
  doc.setTextColor(0, 0, 0);

  // Header crest (center)
  const crestData = await fetchAsDataUrl(CREST_URL);
  const crestW = 30,
    crestH = 22,
    crestX = (pageW - crestW) / 2,
    crestY = 6;
  if (crestData) doc.addImage(crestData, "PNG", crestX, crestY, crestW, crestH);

  // Header lines
  let y = crestY + crestH + 2;
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("OFFICE OF WORKERS’ COMPENSATION", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("times", "bolditalic");
  doc.setFontSize(9.5);
  doc.text("DEPARTMENT OF LABOUR AND INDUSTRIAL RELATIONS", pageW / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.text("(MAMOSE CLAIMS PROCESSING BRANCH)", pageW / 2, y, { align: "center" });

  // Thin rule
  y += 4;
  doc.setLineWidth(0.25);
  doc.line(12, y, pageW - 12, y);

  // Title
  y += 10;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("CHECKLIST FOR PAYMENT", pageW / 2, y, { align: "center" });

  // Info table (Name Of Worker / Employer / CRN / Injury Type)
  const left = 20;
  const labelW = 45;
  const valueW = 115; // matches PHP widths (45 + 115 = 160)
  const rowH = 8;
  y += 6;

  const drawRow = (label: string, value: string) => {
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.rect(left, y, labelW, rowH);
    doc.text(label, left + 2, y + 5);
    doc.setFont("times", "normal");
    doc.rect(left + labelW, y, valueW, rowH);
    doc.text(value || "", left + labelW + 2, y + 5);
    y += rowH;
  };

  drawRow("Name Of Worker", workerName);
  drawRow("Name Of Employer", employerName);
  drawRow("CRN", displayIRN);
  drawRow("Injury Type", incidentType);

  // Submissions grid
  y += 6;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  const noW = 10,
    subW = 50,
    remW = 70,
    byW = 30;
  doc.rect(left, y, noW, rowH);
  doc.rect(left + noW, y, subW, rowH);
  doc.rect(left + noW + subW, y, remW, rowH);
  doc.rect(left + noW + subW + remW, y, byW, rowH);
  doc.text("No", left + 2, y + 5);
  doc.text("Submission", left + noW + 2, y + 5);
  doc.text("Remarks", left + noW + subW + 2, y + 5);
  doc.text("Action Taken By", left + noW + subW + remW + 2, y + 5);

  doc.setFont("times", "normal");
  y += rowH;

  const drawDataRow = (n: number, r: Row) => {
    doc.rect(left, y, noW, rowH);
    doc.rect(left + noW, y, subW, rowH);
    doc.rect(left + noW + subW, y, remW, rowH);
    doc.rect(left + noW + subW + remW, y, byW, rowH);
    doc.text(String(n), left + 2, y + 5);
    doc.text(r.submission || "", left + noW + 2, y + 5);
    doc.text(r.remarks || "", left + noW + subW + 2, y + 5);
    doc.text(r.by || "", left + noW + subW + remW + 2, y + 5);
    y += rowH;
  };

  rows.forEach((r, i) => drawDataRow(i + 1, r));

  // PART 'B' OTHERS
  y += 6;
  doc.setFont("times", "bolditalic");
  doc.setFontSize(7.5);
  doc.text("PART 'B' OTHERS", left, y);

  y += 6;
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text("1. State the cause of accident in brief", left, y);

  y += 10;
  doc.text("2. State the cause of delay", left, y);

  // Footer (prepared/verified + date)
  y = 262; // near bottom like sample
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text("Prepared & Certified by: : _______________________", left, y);
  doc.text("Verified by: : _______________________", left + 106, y); // spacing to mirror PHP

  y += 10;
  doc.text(`Date : ${fmtDate_JSF_Y(new Date())}`, left, y);

  // Save
  doc.save(`Checklist_For_Payment_${displayIRN}.pdf`);
}

export default generateChecklistForPayment;
export const printChecklistForPayment = generateChecklistForPayment;

