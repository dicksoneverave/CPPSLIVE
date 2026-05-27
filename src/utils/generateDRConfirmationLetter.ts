// src/utils/generateDRConfirmationLetter.ts
import jsPDF from "jspdf";
import { supabase } from "../services/supabase";

// Crest in header (public storage)
const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

// ---- required attachment sets by form type ----
// (labels shown in the letter; must match what you save in `formattachments.AttachmentType`)
const REQUIRED_ATTACHMENTS: Record<"Form3" | "Form4", string[]> = {
  // Matches EditForm3's ATTACH_KEYS (injury). :contentReference[oaicite:1]{index=1}
  Form3: [
    "Interim medical report",
    "Final medical report",
    "Section 43 application form",
    "Supervisor statement",
    "Witness statement",
    "Injured worker's statement",
    "Payslip at time of accident",
    "Treatment records",
    "Police accident report",
    "Form 18 Scan",
    // expense buckets (if you track them as attachments)
    "MedicalExpenses",
    "MiscExpenses",
    "Deductions",
  ],
  // Death list (as used in your Form4 UI)
  Form4: [
    "Death Certificate",
    "Post Mortem report",
    "Section 43 application form",
    "Supervisor statement",
    "Witness statement",
    "Dependency declaration",
    "Payslip at time of accident",
    "Police incident report",
    "Funeral expenses receipts",
    "MedicalExpenses",
    "MiscExpenses",
    "Deductions",
    "Form 18 Scan",
  ],
};

// nicer display for a few machine-y names
const PRETTY_LABEL: Record<string, string> = {
  MedicalExpenses: "Medical Expenses",
  MiscExpenses: "Misc Expenses",
  Deductions: "Deductions",
};

function prettyAttachmentLabel(s: string) {
  return PRETTY_LABEL[s] || s;
}

async function urlToDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

function fmtDateISO(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(+dt)) return "";
  return dt.toLocaleDateString();
}

function drawWatermark(doc: jsPDF) {
  const { internal } = doc;
  const pageWidth = internal.pageSize.getWidth();
  const pageHeight = internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(90);
  doc.text("ORIGINAL", pageWidth / 2, pageHeight / 2, {
    angle: -30,
    align: "center",
  });
  doc.restoreGraphicsState();
}

export async function generateDRConfirmationLetter(params: {
  irn: number;
  formType: "Form3" | "Form4";
}): Promise<Blob> {
  const { irn, formType } = params;

  // --- fetch core data ---
  const { data: workerIrn, error: wErr } = await supabase
    .from("workerirn")
    .select("WorkerID, FirstName, LastName, DisplayIRN")
    .eq("IRN", irn)
    .single();
  if (wErr || !workerIrn) throw new Error("IRN not found");

  const wid = workerIrn.WorkerID;

  const [{ data: worker }, { data: f1112 }, { data: prRows }] = await Promise.all([
    supabase
      .from("workerpersonaldetails")
      .select(
        "WorkerFirstName, WorkerLastName, WorkerAddress1, WorkerAddress2, WorkerCity, WorkerProvince, WorkerPOBox, WorkerEmail, WorkerMobile"
      )
      .eq("WorkerID", wid)
      .maybeSingle(),
    supabase
      .from("form1112master")
      .select("IncidentDate, IncidentRegion, IncidentProvince, IncidentLocation")
      .eq("IRN", irn)
      .maybeSingle(),
    supabase
      .from("prescreeningreview")
      .select("PRSubmissionDate, PRDecisionDate, PRStatus")
      .eq("IRN", irn)
      .order("PRSubmissionDate", { ascending: false })
      .limit(1),
  ]);

  const pr = Array.isArray(prRows) ? prRows[0] : prRows || null;

  // attachments present for this IRN
  const { data: attachRows } = await supabase
    .from("formattachments")
    .select("AttachmentType")
    .eq("IRN", irn);

  const presentTypes = new Set((attachRows || []).map((r) => String(r.AttachmentType || "").trim()));
  const required = REQUIRED_ATTACHMENTS[formType];
  const submitted = required.filter((t) => presentTypes.has(t));
  const missing = required.filter((t) => !presentTypes.has(t));

  const workerFirst = worker?.WorkerFirstName || workerIrn.FirstName || "";
  const workerLast = worker?.WorkerLastName || workerIrn.LastName || "";
  const displayIRN = workerIrn.DisplayIRN || `IRN-${irn}`;
  const incidentDate = fmtDateISO(f1112?.IncidentDate);
  const region = f1112?.IncidentRegion || "";
  const province = f1112?.IncidentProvince || "";
  const location = f1112?.IncidentLocation || "";
  const prSubmit = fmtDateISO(pr?.PRSubmissionDate);
  const prDecision = fmtDateISO(pr?.PRDecisionDate);

  // recipient (we’ll use worker address; adjust if you prefer employer or applicant)
  const addr1 = worker?.WorkerAddress1 || "";
  const addr2 = worker?.WorkerAddress2 || "";
  const city = worker?.WorkerCity || "";
  const prov = worker?.WorkerProvince || "";
  const po = worker?.WorkerPOBox ? `P.O. Box ${worker.WorkerPOBox}` : "";

  // === build PDF ===
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawWatermark(doc);

  // header: crest + institution lines
  try {
    const crestData = await urlToDataURL(CREST_URL);
    doc.addImage(crestData, "PNG", 15, 12, 22, 22); // left crest
  } catch {
    // ignore crest load failure
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DEPARTMENT OF LABOUR AND INDUSTRIAL RELATIONS", 105, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Office of Workers Compensation", 105, 24, { align: "center" });
  doc.text("Claims Branch", 105, 30, { align: "center" });
  // thin rule
  doc.setLineWidth(0.4);
  doc.line(15, 36, 195, 36);

  // right column date & ref
  doc.setFontSize(10);
  const today = fmtDateISO(new Date().toISOString());
  doc.text(`Date: ${today}`, 195, 44, { align: "right" });
  doc.text(`Ref: ${displayIRN}`, 195, 50, { align: "right" });

  // recipient block (left)
  let y = 44;
  doc.text(`${workerFirst} ${workerLast}`, 15, y);
  if (addr1) {
    y += 6;
    doc.text(addr1, 15, y);
  }
  if (addr2) {
    y += 6;
    doc.text(addr2, 15, y);
  }
  if (city || prov) {
    y += 6;
    doc.text([city, prov].filter(Boolean).join(", "), 15, y);
  }
  if (po) {
    y += 6;
    doc.text(po, 15, y);
  }
  y += 10;

  // subject line
  doc.setFont("helvetica", "bold");
  doc.text(
    `RE: COMPENSATION CLAIM – ${workerFirst} ${workerLast} (IRN: ${displayIRN})`,
    15,
    y
  );
  y += 8;
  doc.setFont("helvetica", "normal");

  // body paragraphs (kept very close to the sample structure)
  const body1 = [
    `We acknowledge receipt of your claim application submitted on ${prSubmit || today}.`,
    `Your claim has been accepted and registered as ${displayIRN}.`,
  ];
  const body2 = [
    `Date of Loss: ${incidentDate || "—"}`,
    `Location of Incident: ${location || "—"}, ${province || "—"}`,
    `Region: ${region || "—"}`,
  ];
  const body3 =
    "For further information, please contact the Claims Branch at the Workers Compensation Commission.";

  body1.forEach((line) => {
    doc.text(line, 15, y);
    y += 6;
  });
  y += 2;
  body2.forEach((line) => {
    doc.text(line, 15, y);
    y += 6;
  });
  y += 4;
  doc.text(body3, 15, y);
  y += 8;

  // Submitted list
  doc.setFont("helvetica", "bold");
  doc.text("Submitted Documents", 15, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  if (submitted.length === 0) {
    doc.text("- None", 20, y);
    y += 6;
  } else {
    submitted.forEach((item) => {
      doc.text(`- ${prettyAttachmentLabel(item)}`, 20, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        drawWatermark(doc);
        y = 20;
      }
    });
  }

  // To be submitted
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("To be Submitted", 15, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  if (missing.length === 0) {
    doc.text("- None", 20, y);
    y += 6;
  } else {
    missing.forEach((item) => {
      doc.text(`- ${prettyAttachmentLabel(item)}`, 20, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        drawWatermark(doc);
        y = 20;
      }
    });
  }

  // closing
  y += 8;
  doc.text("Yours faithfully,", 15, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text("Deputy Registrar", 15, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.text("Office of Workers Compensation", 15, y);


  return doc.output("blob");
}
