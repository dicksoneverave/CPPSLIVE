// /src/utils/CertificateOfClaimAward_jspdf.ts
// Generates the "Certificate of Claim Award" PDF exactly like the provided sample.
// Data sources (same as PHP):
//   - form1112master (DisplayIRN, IncidentDate)
//   - owcstaffmaster (OSMFirstName, OSMLastName) by OSMStaffID
//   - claimsawardedcommissionersreview (CACRDecisionDate)
// Assets (same as previous utils): crest, registrar stamp, registrar signature (optional draw)

import { jsPDF } from "jspdf";
import { supabase } from "../services/supabase";

// ---------- assets ----------
const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";
const REGISTRAR_STAMP_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/Registrar.png";
const REGISTRAR_SIGN_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/registrarsign.png";

// ---------- helpers ----------
const toOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
// Format exactly like PHP `date('jS F,Y')`  → "27th January,2025"
const formatPhpStyle = (d: Date) =>
  `${toOrdinal(d.getDate())} ${d.toLocaleString("en-US", {
    month: "long",
  })},${d.getFullYear()}`;

// Load image to data URL
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

// Draw underlined, centered header line
const centeredUnderlined = (
  doc: jsPDF,
  text: string,
  y: number,
  font: "normal" | "bold" | "italic" | "bolditalic" = "bold",
  size = 12
) => {
  doc.setFont("times", font);
  doc.setFontSize(size);
  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = doc.getTextWidth(text);
  const x = (pageWidth - textWidth) / 2;
  doc.text(text, x, y);
  // underline
  doc.setLineWidth(0.25);
  doc.line(x, y + 1.2, x + textWidth, y + 1.2);
};

// Rich paragraph with bold spans, auto-wrap to width
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
  let currStyle: "normal" | "bold" = "normal";
  const setStyle = (s: "normal" | "bold") => {
    if (currStyle !== s) {
      doc.setFont("times", s === "bold" ? "bold" : "normal");
      currStyle = s;
    }
  };
  doc.setFontSize(10);
  setStyle("normal");

  // tokenise by spaces, preserving spaces
  const tokens: Span[] = [];
  for (const s of spans) {
    const parts = s.text.split(/(\s+)/); // split but keep spaces
    for (const p of parts) {
      if (!p) continue;
      tokens.push({ text: p, bold: s.bold });
    }
  }

  for (const t of tokens) {
    setStyle(t.bold ? "bold" : "normal");
    const w = doc.getTextWidth(t.text);
    if (x + w > x0 + maxWidth && t.text.trim() !== "") {
      // wrap to next line
      x = x0;
      y += lineH;
    }
    doc.text(t.text, x, y);
    x += w;
  }

  return y; // last y rendered
};

// ---------- main ----------
export interface CertificateOfClaimAwardOptions {
  showStamps?: boolean; // default false to match sample image exactly
  crestInHeader?: boolean; // default false; sample image shows no crest
}

/**
 * Generate the "Certificate of Claim Award" PDF.
 * @param irn        IRN (number or string)
 * @param userStaffId  OWCStaffMaster.OSMStaffID of the acting registrar (for name line)
 * @param opts       Optional flags (stamps/crest off by default to match the provided image)
 */
export async function generateCertificateOfClaimAward(
  irn: number | string,
  userStaffId: number | string,
  opts: CertificateOfClaimAwardOptions = {}
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // --- fetch data like the PHP ---
  const irnNum = Number(irn);

  // 1) Registration Number (DisplayIRN) from form1112master
  const { data: f1112, error: f1112Err } = await supabase
    .from("form1112master")
    .select("DisplayIRN, IncidentDate")
    .eq("IRN", irnNum)
    .maybeSingle();
  if (f1112Err) throw f1112Err;
  if (!f1112) throw new Error("Form1112Master not found for IRN");

  const registrationNumber: string = f1112.DisplayIRN || String(irn);

  // 2) Registrar (acting) name from owcstaffmaster
  const { data: staff, error: staffErr } = await supabase
    .from("owcstaffmaster")
    .select("OSMFirstName, OSMLastName")
    .eq("OSMStaffID", userStaffId)
    .maybeSingle();
  if (staffErr) throw staffErr;

  const registrarName = staff
    ? `${staff.OSMFirstName ?? ""} ${staff.OSMLastName ?? ""}`.trim()
    : "Acting Registrar";

  // 3) Date of Award from claimsawardedcommissionersreview
  const { data: carr, error: carrErr } = await supabase
    .from("claimsawardedcommissionersreview")
    .select("CACRDecisionDate")
    .eq("IRN", irnNum)
    .maybeSingle();
  if (carrErr) throw carrErr;

  const awardDate = carr?.CACRDecisionDate
    ? new Date(carr.CACRDecisionDate)
    : new Date();
  const awardDatePhp = formatPhpStyle(awardDate);
  const awardYear = awardDate.getFullYear();

  // --- watermark "ORIGINAL" (like PHP header) ---
  doc.setFont("times", "bold");
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  // angle property is available in jsPDF 2.x; fallback: rotation via internal API if needed
  (doc as any).text("O R I G I N A L", 65, 190, { angle: 45 });

  // reset text color to black
  doc.setTextColor(0, 0, 0);

  // --- optional crest in header (default off to match sample) ---
  if (opts.crestInHeader) {
    const crest = await fetchAsDataUrl(CREST_URL);
    if (crest) {
      // small crest over the title if desired
      doc.addImage(crest, "PNG", 14, 10, 18, 18);
    }
  }

  // --- top headings (all underlined, centered) ---
  let y = 20;
  centeredUnderlined(doc, "PAPUA NEW GUINEA", y, "bold", 12);
  y += 10;
  centeredUnderlined(
    doc,
    "WORKER’S COMPENSATION ACT NO. 59 OF 1978",
    y,
    "bold",
    12
  );
  y += 10;
  centeredUnderlined(doc, `Worker’s Compensation Award ${awardYear}`, y, "normal", 12);
  y += 10;
  centeredUnderlined(
    doc,
    `No. ${registrationNumber} of ${awardYear}`,
    y,
    "normal",
    12
  );

  // --- body paragraph ---
  y += 14;
  const left = 18;
  const width = 150; // match PHP width
  doc.setFont("times", "normal");
  doc.setFontSize(10);

  const spans: Span[] = [
    { text: "I, Worker’s Compensation " },
    { text: "Registrar", bold: true },
    {
      text:
        ", hereby certify that the document set out hereunder is a true copy of a Worker’s Compensation Award made on the ",
    },
    { text: ` ${awardDatePhp} `, bold: true },
    { text: "in reference to the Worker’s Compensation Claim Registration No. " },
    { text: registrationNumber, bold: true },
    { text: " as registered by me under Section 30 of the Worker’s Compensation Act No. 59 of 1978 as No. " },
    { text: registrationNumber, bold: true },
    { text: " on the " },
    { text: ` ${awardDatePhp}`, bold: true },
    { text: "." },
  ];

  y = drawRichParagraph(doc, left, y, width, 5, spans);

  // --- footer name line (center) ---
  // The sample shows just the title centered low on the page.
  const footerY = 160;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("Registrar", doc.internal.pageSize.getWidth() / 2, footerY, {
    align: "center",
  });

  // --- optional signature & stamp (default OFF to match the sample image) ---
  if (opts.showStamps) {
    const sign = await fetchAsDataUrl(REGISTRAR_SIGN_URL);
    const stamp = await fetchAsDataUrl(REGISTRAR_STAMP_URL);
    // place these above the footer title
    const signY = footerY - 25;
    if (sign) doc.addImage(sign, "PNG", 90, signY, 36, 18);
    if (stamp) doc.addImage(stamp, "PNG", 130, signY, 36, 36);
  }

  // Output
  doc.save(`Certificate_of_Claim_Award_${registrationNumber}.pdf`);
}

// Provide multiple export names to be easy to call from UI code
export default generateCertificateOfClaimAward;
// keep an alias compatible with possible misspellings in handlers
export const generateCertifcateOfClaimAward = generateCertificateOfClaimAward;

