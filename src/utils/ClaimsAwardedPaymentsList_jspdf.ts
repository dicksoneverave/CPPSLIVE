// src/utils/ClaimsAwardedPaymentsList_jspdf.ts
import { jsPDF } from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";

// ---------- crest (use your existing public URL or signed URL if needed) ----------
const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

// ---------- tiny helpers (mirroring form6CPO_jspdf.ts style) ----------
const num = (v: any) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtK = (n: number) =>
  `K ${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

const ddmmyyyy = (v: any) => {
  if (!v) return "";
  if (typeof v === "string" && v.includes("/")) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const today_ddmmyyyy = () => ddmmyyyy(new Date());

const toDataURL = async (url: string) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
};

const safePart = (s: any) =>
  String(s ?? "")
    .trim()
    .replace(/[^\w.-]+/g, "_");

const safeTxt = (v: any) => String(v ?? "").trim();

// ---------- types ----------
export type ClaimsRow = {
  IRN: string | number;
  DisplayIRN?: string | null;
  SubmissionDate?: string | null; // ISO or dd/mm/yyyy
  IncidentType?: string | null;   // "Injury" | "Death" | etc
  WorkerFirstName?: string | null;
  WorkerLastName?: string | null;
  EbankAmountPaid?: number | string | null;
  BankName?: string | null;

  // ✅ NEW: worker bank details
  WorkerBankName?: string | null;
  WorkerBSBBranchNo?: string | null;     // ✅ correct field name
  WorkerAccountNumber?: string | null;
  PaymentDetails?: string | null;         // ✅ kept for fallback
  Recipients?: string | null;             // ✅ added for cleaner name exports
};

// ---------- core renderer ----------
async function renderPaymentsListPDF(
  rows: ClaimsRow[],
  opts: {
    title: string;
    subtitle?: string;
    showBatch?: boolean;
    batchNo?: string;
    footerNote?: string;
    fileName?: string;
  }
) {
  const {
    title,
    subtitle,
    showBatch = false,
    batchNo,
    footerNote,
    fileName = `${safePart(title)}.pdf`,
  } = opts;

  // Landscape now (more columns)
  const doc = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });

  // Crest
  try {
    const crest = await toDataURL(CREST_URL);
    if (crest) doc.addImage(crest, "PNG", 135, 6, 30, 0);
  } catch {
    // ignore crest load failure
  }

  // Header
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("INDEPENDENT STATE OF PAPUA NEW GUINEA", 148, 35, { align: "center" });
  doc.text("Office Of Workers Compensation", 148, 39, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(title, 148, 47, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  if (subtitle) doc.text(subtitle, 148, 54, { align: "center" });

  // Date & (optional) Batch
  let y0 = subtitle ? 58 : 55;
  doc.setFontSize(10);
  doc.text(`Date: ${today_ddmmyyyy()}`, 12, y0);

  if (showBatch && batchNo) {
    doc.text(`Batch No: ${batchNo}`, 285, y0, { align: "right" });
  }

  // Table rows
  const body: RowInput[] = rows.map((r) => {
    const workerName = `${safeTxt(r.WorkerFirstName)} ${safeTxt(r.WorkerLastName)}`.trim();

    return [
      safeTxt(r.IRN),
      safeTxt(r.DisplayIRN),
      ddmmyyyy(r.SubmissionDate),
      safeTxt(r.IncidentType),
      workerName,
      // Priority: 1) Recipients column, 2) PaymentDetails split, 3) None
      safeTxt(r.Recipients || r.PaymentDetails?.split(' | ')[0]), 
      fmtK(num(r.EbankAmountPaid ?? 0)),
      safeTxt(r.WorkerBankName),       // Recipient Bank
      safeTxt(r.WorkerBSBBranchNo),
      safeTxt(r.WorkerAccountNumber),
    ];
  });

  autoTable(doc, {
    startY: y0 + 6,
    margin: { left: 12, right: 12 },
    head: [
      [
        "IRN",
        "CRN",
        "Submission Date",
        "Incident",
        "Worker Name",
        "Recipient",
        "Amount Paid",
        "Recipient Bank",
        "BSB/Branch No",
        "Worker Account No",
      ],
    ],
    body,
    styles: { font: "times", fontSize: 9, halign: "left", cellPadding: 2.0 },
    headStyles: { font: "times", fontSize: 9, halign: "center" },
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 12 },                 // IRN
      1: { cellWidth: 24 },                 // CRN
      2: { cellWidth: 24 },                 // Submission Date
      3: { cellWidth: 16 },                 // Incident
      4: { cellWidth: 32 },                 // Worker Name
      5: { cellWidth: 34 },                 // Recipient
      6: { cellWidth: 24, halign: "right" },// Amount
      7: { cellWidth: 30 },                 // Recipient Bank
      8: { cellWidth: 22 },                 // BSB/Branch
      9: { cellWidth: "auto" },             // Worker Acct
    },
    didDrawPage: () => {
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.text(str, 285, 200, { align: "right" });
    },
  });

  // Totals
  const total = rows.reduce((s, r) => s + num(r.EbankAmountPaid ?? 0), 0);
  const yAfter = (doc as any).lastAutoTable?.finalY ?? 170;

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(`Total Claims: ${rows.length}`, 12, yAfter + 8);
  doc.text(`Total Value: ${fmtK(total)}`, 285, yAfter + 8, { align: "right" });

  // Footer note
  if (footerNote) {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text(footerNote, 12, yAfter + 16);
  }

  doc.save(fileName);
}

// ---------- public API ----------

/**
 * Print the confirmation list BEFORE batching (no Batch No).
 */
export async function printApprovedPaymentsListNoBatch(
  rows: ClaimsRow[],
  opts?: { title?: string; subtitle?: string; fileName?: string }
) {
  const title = opts?.title ?? "Approved Claims Payments List (No Batch)";
  const subtitle = opts?.subtitle ?? "For confirmation prior to processing";
  const fileName = opts?.fileName ?? "Approved_Claims_Payments_List_No_Batch.pdf";

  return renderPaymentsListPDF(rows, {
    title,
    subtitle,
    showBatch: false,
    footerNote: "Note: This is a pre-batch confirmation list.",
    fileName,
  });
}

/**
 * Print the FINAL paid list WITH Batch No (after processing).
 */
export async function printClaimsPaidBatchWithBatchNo(
  rows: ClaimsRow[],
  batchNo: string,
  opts?: { title?: string; fileName?: string }
) {
  const title = opts?.title ?? `Claims Paid — Batch ${batchNo}`;
  const fileName = opts?.fileName ?? `Claims_Paid_Batch_${safePart(batchNo)}.pdf`;

  return renderPaymentsListPDF(rows, {
    title,
    subtitle: "Processed claims paid summary",
    showBatch: true,
    batchNo,
    footerNote: "This list reflects claims processed as 'PaymentProcessed'.",
    fileName,
  });
}
