// /src/utils/BankConfirmationLetter_jspdf.ts
import { jsPDF } from "jspdf";
import { supabase } from "../services/supabase";

const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

const toOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const fmtPhp_dMY = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const fmtPhp_jsF_Y = (d: Date) =>
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

const moneyK = (v: any) => {
  const n = Number(v);
  if (!isFinite(n)) return "";
  return new Intl.NumberFormat("en-PG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
};

const drawRule = (doc: jsPDF, x: number, y: number, w: number) => {
  doc.setLineWidth(0.25);
  doc.line(x, y, x + w, y);
};

type Span = { text: string; bold?: boolean };
const drawRichParagraph = (
  doc: jsPDF,
  x0: number,
  y0: number,
  maxWidth: number,
  lineH: number,
  spans: Span[]
) => {
  let x = x0;
  let y = y0;
  let style: "normal" | "bold" = "normal";
  const set = (s: "normal" | "bold") => {
    if (s !== style) {
      doc.setFont("times", s === "bold" ? "bold" : "normal");
      style = s;
    }
  };
  doc.setFontSize(10);

  const tokens: Span[] = [];
  for (const s of spans) {
    const parts = s.text.split(/(\s+)/);
    for (const p of parts) if (p) tokens.push({ text: p, bold: s.bold });
  }

  for (const t of tokens) {
    set(t.bold ? "bold" : "normal");
    const w = doc.getTextWidth(t.text);
    if (x + w > x0 + maxWidth && t.text.trim() !== "") {
      x = x0;
      y += lineH;
    }
    doc.text(t.text, x, y);
    x += w;
  }
  return y;
};

export async function generateBankConfirmationLetter(irn: number | string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const irnNum = Number(irn);

  // --- data fetches ---
  const { data: chq, error: chqErr } = await supabase
    .from("owcclaimchequedetails")
    .select("OCCDChequeNumber, OCCDIssueDate, OCCDChequeAmount")
    .eq("IRN", irnNum)
    .maybeSingle();
  if (chqErr) throw chqErr;

  const { data: f1112, error: fErr } = await supabase
    .from("form1112master")
    .select("DisplayIRN, IncidentDate, IncidentType, WorkerID")
    .eq("IRN", irnNum)
    .maybeSingle();
  if (fErr) throw fErr;
  if (!f1112) throw new Error("form1112master row not found");

  let applicantName = "";
  let workerGender: string | null = null;

  if (String(f1112.IncidentType).toLowerCase() === "death") {
    const { data: f4 } = await supabase
      .from("form4master")
      .select("ApplicantFirstName, ApplicantLastName")
      .eq("IRN", irnNum)
      .maybeSingle();
    applicantName = `${f4?.ApplicantFirstName ?? ""} ${f4?.ApplicantLastName ?? ""}`.trim();
  } else {
    const { data: worker } = await supabase
      .from("workerpersonaldetails")
      .select("WorkerFirstName, WorkerLastName, WorkerGender")
      .eq("WorkerID", f1112.WorkerID)
      .maybeSingle();
    applicantName = `${worker?.WorkerFirstName ?? ""} ${worker?.WorkerLastName ?? ""}`.trim();
    workerGender = worker?.WorkerGender ?? null;
  }

  const pronoun = (workerGender || "").toLowerCase().startsWith("f") ? "her" : "his";

  const today = new Date();
  const headerDate = fmtPhp_jsF_Y(today);

  const chqDate = chq?.OCCDIssueDate ? new Date(chq.OCCDIssueDate) : new Date();
  const chqDate_dMY = fmtPhp_dMY(chqDate);
  const chqDate_jsF_Y = fmtPhp_jsF_Y(chqDate);

  const incDate = f1112.IncidentDate ? new Date(f1112.IncidentDate) : new Date();
  const incDate_jsF_Y = fmtPhp_jsF_Y(incDate);

  const chequeNo = chq?.OCCDChequeNumber ?? "";
  const chequeAmt = chq?.OCCDChequeAmount ?? null;

  // --- watermark ---
  doc.setFont("times", "bold");
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  (doc as any).text("O R I G I N A L", 65, 190, { angle: 45 });
  doc.setTextColor(0, 0, 0);

  // --- HEADER CREST (centered) ---
  const crestDataUrl = await fetchAsDataUrl(CREST_URL);
  // size tuned to match your screenshot
  const crestW = 30;
  const crestH = 22;
  const crestX = (pageW - crestW) / 2;
  const crestY = 6;
  if (crestDataUrl) {
    doc.addImage(crestDataUrl, "PNG", crestX, crestY, crestW, crestH);
  }

  // --- header text block ---
  let y = crestY + crestH + 4; // leave space below crest
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text(
    "DEPARTMENT OF LABOUR AND INDUSTRIAL RELATIONS",
    pageW / 2,
    y,
    { align: "center" }
  );

  y += 5;
  doc.setFont("times", "bolditalic");
  doc.setFontSize(9.5);
  doc.text("(Office of Workers’ Compensation)", pageW / 2, y, { align: "center" });

  // address rows
  const leftX = 12;
  const midX = 56;
  const rightX = 145;

  y += 8;
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.text("TELEPHONE: 675 321 3306", leftX, y);
  doc.text("LEVEL 2, B & D  HAUS,", midX, y);
  doc.text("P.O. Box 5308", rightX, y);

  y += 3;
  doc.text("FACSIMILE:   675 321 5304", leftX, y);
  doc.text("CORNER OF CUTHBERTSON STREET AND ERSKINE STREET", midX, y);
  doc.text("BOROKO, NCD", rightX, y);

  y += 3;
  doc.text("DOWNTOWN, OPPOSITE POST PNG", leftX + 44, y);
  doc.text("PAPUA NEW GUINEA", rightX, y);

  y += 5;
  drawRule(doc, leftX, y, pageW - leftX * 2);

  // right column (date/officer/ref)
  const rX = 120;
  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.text(`Date : ${headerDate}`, rX, y);
  y += 4;
  doc.text(`Action officer:`, rX, y);
  y += 4;
  doc.text(`Our Ref: ${f1112.DisplayIRN ?? ""}`, rX, y);

  // recipient / greeting
  y += 6;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("To Whom So Ever It May Concern", leftX, y);

  y += 10;
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.text("Dear Sir/Mam", leftX, y);

  // RE line
  y += 7;
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  const amtText = chequeAmt == null ? "" : moneyK(chequeAmt);
  doc.text(
    `RE: CONFIRMATION FOR BSP CHEQUE NO. ${chequeNo} DATE ${chqDate_dMY} FOR ${amtText}`,
    leftX,
    y
  );

  // body with bold IncidentType
  y += 7;
  doc.setFontSize(10);
  const spans: Span[] = [
    { text: "This is to confirm BPNG chq no. " },
    { text: chequeNo },
    { text: " date " },
    { text: chqDate_jsF_Y },
    { text: " for the sum of K" },
    { text: amtText },
    { text: " payable to " },
    { text: applicantName || "" },
    { text: ", is paid from this office as workers compensation benefit payable for " },
    { text: String(f1112.IncidentType || ""), bold: true },
    { text: ` during the course of ${pronoun} employment on the ` },
    { text: incDate_jsF_Y },
  ];
  y = drawRichParagraph(doc, leftX, y, 164, 5, spans);

  // extra info
  y += 7;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  const extra =
    "Should you require additional information, please do call the office on phone no. 3214939, and ask for Kila Dobo or Jenny Orim for assistance.";
  const lines = doc.splitTextToSize(extra, 164);
  doc.text(lines, leftX, y);

  // footer
  y = 240;
  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.text("For you information, attention and action", leftX, y);
  y += 10;
  doc.text("Yours faithfully,", leftX, y);
  y += 30;
  doc.text("Kila Dobo", leftX, y);
  y += 4;
  doc.text("Manageress Claims Payment", leftX, y);

  doc.save(`Bank_Confirmation_${f1112.DisplayIRN || irn}.pdf`);
}

export default generateBankConfirmationLetter;
export const printBankConfirmationLetter = generateBankConfirmationLetter;

