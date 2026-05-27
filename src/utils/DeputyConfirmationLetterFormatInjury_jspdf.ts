// /src/utils/DeputyConfirmationLetterFormatInjury_jspdf.ts
import { jsPDF } from 'jspdf';
import { supabase } from '../services/supabase'; // adjust: '../../services/supabase' if this file sits beside components

// Crest (header) image (signed Supabase URL provided)
const CREST_URL =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';

// Helpers
// Renders (prefix + bold + suffix) across wrapped lines with correct inline bold
function drawInlineBold(
  doc: jsPDF,
  leftX: number,
  yStart: number,
  wrapWidth: number,
  prefix: string,
  boldText: string,
  suffix: string,
  lineLeading = 7
): number {
  const full = prefix + boldText + suffix;
  const lines = doc.splitTextToSize(full, wrapWidth);

  // global indices for the bold window inside `full`
  const boldStart = prefix.length;
  const boldEnd = boldStart + boldText.length;

  let y = yStart;
  let cursor = 0; // global index in `full`

  for (const line of lines) {
    const lineStart = cursor;
    const lineEnd = cursor + line.length;

    // Nothing bold on this line
    if (lineEnd <= boldStart || lineStart >= boldEnd) {
      doc.setFont('times', 'normal');
      doc.text(line, leftX, y);
      y += lineLeading;
      cursor += line.length;
      continue;
    }

    // There is an overlap with the bold window; slice 3 segments
    const beforeLen = Math.max(0, boldStart - lineStart);
    const boldLen = Math.min(lineEnd, boldEnd) - Math.max(lineStart, boldStart);
    const afterLen = Math.max(0, lineEnd - Math.max(lineStart, boldEnd));

    const before = beforeLen > 0 ? line.slice(0, beforeLen) : '';
    const boldSeg = boldLen > 0 ? line.slice(beforeLen, beforeLen + boldLen) : '';
    const after = afterLen > 0 ? line.slice(beforeLen + boldLen) : '';

    let x = leftX;

    if (before) {
      doc.setFont('times', 'normal');
      doc.text(before, x, y);
      x += doc.getTextWidth(before);
    }
    if (boldSeg) {
      doc.setFont('times', 'bold');
      doc.text(boldSeg, x, y);
      x += doc.getTextWidth(boldSeg);
    }
    if (after) {
      doc.setFont('times', 'normal');
      doc.text(after, x, y);
    }

    y += lineLeading;
    cursor += line.length;
  }

  return y; // return next y position after the block
}


//---------

const toTitle = (s?: string | null) =>
  (s ?? '').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const fmtDMY = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

async function fetchData(irn: string, userId: string) {
  // Applicant (Form3Master)
  const { data: f3a } = await supabase
    .from('form3master')
    .select(
      'ApplicantFirstName, ApplicantLastName, ApplicantAddress1, ApplicantAddress2, ApplicantCity, ApplicantProvince, ApplicantPOBox' + 
      ', Form3SubmissionDate' // optional fallback
    )
    .eq('IRN', irn)
    .maybeSingle();

  // Form1112Master
  const { data: f1112 } = await supabase
    .from('form1112master')
    .select('DisplayIRN, IncidentDate, IncidentProvince, WorkerID')
    .eq('IRN', irn)
    .maybeSingle();

  // Region by province (Dictionary) — fall back to the raw province text if no mapping
  let regionProvince = '';
  if (f1112?.IncidentProvince) {
    const { data: dict, error: dictErr } = await supabase
      .from('dictionary')
      .select('DValue')
      .eq('DKey', f1112.IncidentProvince)
      .maybeSingle();
    if (!dictErr && dict?.DValue) {
      regionProvince = dict.DValue;
    } else {
      // fallback: show the province as-is so the letter never shows blank
      regionProvince = f1112.IncidentProvince ?? '';
    }
  }

  // Worker name
  let workerName = '';
  if (f1112?.WorkerID) {
    const { data: worker } = await supabase
      .from('workerpersonaldetails')
      .select('WorkerFirstName, WorkerLastName')
      .eq('WorkerID', f1112.WorkerID)
      .maybeSingle();
    if (worker) workerName = toTitle(`${worker.WorkerFirstName} ${worker.WorkerLastName}`.trim());
  }

  // Deputy Registrar name by UserID
  let drName = '';
  if (userId) {
    const { data: staff } = await supabase
      .from('owcstaffmaster')
      .select('OSMFirstName, OSMLastName') // OSMLastName expected; OSMPLastName added just in case schema differs
      .eq('OSMStaffID', userId)
      .maybeSingle();
    if (staff) drName = `${staff.OSMFirstName ?? ''} ${staff.OSMLastName ?? staff.OSMPLastName ?? ''}`.trim();
  }

  // Prescreening dates (+ fallbacks)
  let acknowledgedDate = '';
  let submissionDate = '';

  // 1) Primary: prescreeningreview
  const { data: ps1 } = await supabase
    .from('prescreeningreview')
    .select('PRDecisionDate, PRSubmissionDate')
    .eq('IRN', irn)
    .maybeSingle();

  let ack: string | null = ps1?.PRDecisionDate ?? null;
  let sub: string | null = ps1?.PRSubmissionDate ?? null;

  // 2) Fallback: a view (if you actually have one)
  if (!ack || !sub) {
    const { data: ps2 } = await supabase
      .from('prescreening_view')
      .select('PRSubmissionDate')
      .eq('IRN', irn)
      .maybeSingle();
    ack = ack ?? ps2?.PRDecisionDate ?? null;
    sub = sub ?? ps2?.PRSubmissionDate ?? null;
  }

  // 3) Fallback: earliest history for this IRN
  if (!sub) {
    const { data: hist } = await supabase
      .from('prescreeningreviewhistory')
      .select('PRHSubmissionDate')
      .eq('IRN', irn)
      .order('PRHSubmissionDate', { ascending: true })
      .limit(1)
      .maybeSingle();
    sub = hist?.PRHSubmissionDate ?? null;
  }

  // 4) Fallback: Form3 submission date (if you capture it there)
  if (!sub) {
    sub = (f3a as any)?.SubmissionDate ?? null;
  }

  acknowledgedDate = fmtDMY(ack);
  submissionDate = fmtDMY(sub);

  // Attachments actually submitted
  const { data: atch } = await supabase
    .from('formattachments')
    .select('AttachmentType')
    .eq('IRN', irn);

  const submitted = (atch ?? []).map((r) => r.AttachmentType);

  // Attachment master list for Form11 (Injury)
  const { data: master } = await supabase
    .from('attachmentmaster')
    .select('FormType')
    .eq('AttachmentType', 'Form11');

  const fullRequired = (master ?? []).map((r) => r.FormType);

  const submittedSet = new Set((submitted ?? []).map((s) => (s || '').trim()));
  const submittedList = fullRequired.filter((x) => submittedSet.has((x || '').trim()));
  const pendingList = fullRequired.filter((x) => !submittedSet.has((x || '').trim()));

  // Applicant to-address block
  const toName = toTitle(`${f3a?.ApplicantFirstName ?? ''} ${f3a?.ApplicantLastName ?? ''}`.trim());
  const addrLines = [
    f3a?.ApplicantAddress1,
    f3a?.ApplicantAddress2,
    f3a?.ApplicantCity ? `${f3a?.ApplicantCity} , ${f3a?.ApplicantProvince ?? ''}` : undefined,
    f3a?.ApplicantPOBox ? `${f3a.ApplicantPOBox}.` : undefined,
  ].filter(Boolean) as string[];
  const toAddress = [toName, ...addrLines].join('\n');

  return {
    toAddress,
    acknowledgedDate,
    submissionDate,
    displayIRN: f1112?.DisplayIRN ?? '',
    incidentDateDMY: fmtDMY(f1112?.IncidentDate ?? ''),
    regionProvince,
    workerName,
    drName,
    submittedList,
    pendingList,
  };
}



async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
} 

/**
 * Generates the "Deputy Registrar Confirmation Letter (Injury)" PDF
 * faithful to the original PHP/FPDF layout.
 */
export async function generateDeputyConfirmationLetterInjury(
  irn: string,
  userId: string,
  save: boolean = true
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  // === HEADER ===
  // Crest (centered width ~30mm, near top)
  try {
    const crestData = await urlToDataUrl(CREST_URL);
    doc.addImage(crestData, 'PNG', 90, 5, 30, 30);
  } catch {
    // continue without crest if fetch fails
  }

  // Watermark "O R I G I N A L" like PHP
  doc.setFont('times', 'bold');
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  // Position and angle roughly matching the example
  doc.text('O R I G I N A L', 65, 190, { angle: 45 });

  // Title lines
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('DEPARTMENT OF LABOUR AND INDUSTRIAL RELATIONS', 105, 36, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.text('(Office of Workers  Compensation)', 105, 42, { align: 'center' });

  // Contact block (mirrors the cell placements in PHP)
  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);

  // Row 1
  doc.text('Telephone: 675 321 3306',20, 49);
  doc.text('Ground Floor', 84, 49);
  doc.text('P.O. Box 5308', 153, 49);

  // Row 2
  //doc.text('FACSIMILE:   675 321 5304', 20, 52);
  doc.text('Gaukara Rumana', 84, 52);
  doc.text('Port Moresby, NCD', 153, 52);

  // Row 3
  doc.text('Gordons, Wards Road', 84, 55);
  doc.text('Papua New Guinea', 153, 55);

  // Separator line (162 tiny '=' in PHP; draw a thin line across instead)
  doc.setLineWidth(0.2);
  doc.line(20, 56.5, 182, 56.5);

  // === BODY DATA ===
  const data = await fetchData(irn, userId);

  // Date (right column, small indent to match PHP)
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const todayStr = fmtDMY(new Date().toISOString());
doc.text(`Date : ${todayStr}`, 138, 64);


  // Address block (left indent 12mm)
  const leftX = 20;
  let y = 65;
  const addressLines = (data.toAddress || '').split('\n');
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  addressLines.forEach((line) => {
    doc.text(line, leftX, y);
    y += 4; // 75,4 -> leading ~4
  });

  y += 6; // extra spacing before greeting
  doc.text('Dear Sir', leftX, y);
  y += 7;

  // Subject lines (bold)
  doc.setFont('times', 'bold');
  doc.text(`RE: COMPENSATION CLAIM - ${data.workerName}`, leftX, y);
  y += 4;
  doc.text(`DATE OF INJURY: ${data.incidentDateDMY}`, leftX + 7, y); // PHP: $this->Cell(19) indent
  y += 7;

// Paragraph 1: ack received on <SubmissionDate> (with <pb> styled as bold)
// === Paragraph 1: "We acknowledge ... received on <submissionDate>" ===
doc.setFont('times', 'normal');
doc.setFontSize(10);
const paraWidth = 150;

const p1prefix = 'We acknowledge your claim application received on ';
const p1bold = data.submissionDate || '—';
const p1suffix = '';

y = drawInlineBold(doc, leftX, y, paraWidth, p1prefix, p1bold, p1suffix);

// Add a little gap
y += 1;

// === Paragraph 2: "... accepted and registered as <CRN>. Should you ... our <Region> officer ... on the phone numbers stated above." ===
const p2prefixA = 'We advise the claim has been accepted and registered as  ';
const p2boldCRN = (data.displayIRN || '') + '.';
const p2suffixA = '';

y = drawInlineBold(doc, leftX, y, paraWidth, p2prefixA, p2boldCRN, p2suffixA);

// Join the rest as one stitched sentence with the Region bold
const p2prefixB = ' Should you wish to enquire on the status of your claim, contact our ';
const p2boldRegion = (data.regionProvince || '') + ' officer - Claims Branch';
const p2suffixB = ' on the phone numbers stated above.';

y = drawInlineBold(doc, leftX, y, paraWidth, p2prefixB, p2boldRegion, p2suffixB);

// small comfy gap
y += 2;

  // "Further, we require"
  doc.text('Further, we require', leftX, 140);
  y += 10;

  // === TABLES ===
  doc.setFont('times', 'bold');
  doc.text('Submitted List', leftX, y);
  y += 5;

  // Table: Submitted (two columns: No, Description)
  doc.setFont('times', 'normal');
  doc.setLineWidth(0.2);
  const tableX = leftX;
  const colNoW = 10;
  const colDescW = 100;
  const rowH = 6;

  const drawRow = (n: number, text: string, yPos: number) => {
    doc.rect(tableX, yPos - rowH + 1, colNoW, rowH);
    doc.rect(tableX + colNoW, yPos - rowH + 1, colDescW, rowH);
    doc.text(String(n), tableX + 2, yPos - 1.7);
    doc.text(text || '', tableX + colNoW + 2, yPos - 1.7);
  };

  if (data.submittedList.length > 0) {
    for (let i = 0; i < data.submittedList.length; i++) {
      drawRow(i + 1, data.submittedList[i], y + rowH);
      y += rowH;
    }
  } else {
    // still draw an empty row for aesthetics
    drawRow(1, '', y + rowH);
    y += rowH;
  }

  y += 6;
  doc.setFont('times', 'bold');
  doc.text('To Be Submitted List', leftX, y);
  y += 6;
  doc.setFont('times', 'normal');

  if (data.pendingList.length > 0) {
    for (let i = 0; i < data.pendingList.length; i++) {
      drawRow(i + 1, data.pendingList[i], y + rowH);
      y += rowH;
    }
  } else {
    drawRow(1, '', y + rowH);
    y += rowH;
  }

  y += 8;

  // === FOOTER (sign-off) ===
  // “The matter will progress…” (one line)
  doc.text('The matter will progress further upon receipt of above documents.', leftX, y);
  y += 10;
  doc.text('Yours faithfully,', leftX, y);
  y += 15;

  doc.setFont('times', 'bold');
  doc.text(data.drName || '', leftX, y);
  y += 4;
 // doc.setFont('times', 'normal');
  doc.text('A/Deputy Registrar', leftX, y);

  if (save) {
    const fileName = `Deputy_Registrar_Letter_${irn}.pdf`;
    doc.save(fileName);
  }
  return doc;
}

export default generateDeputyConfirmationLetterInjury;

