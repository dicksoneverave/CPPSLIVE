// /src/utils/DeputyConfirmationLetterFormatDeath_jspdf.ts
import { jsPDF } from 'jspdf';
import { supabase } from '../services/supabase';

// Crest (header) image
const CREST_URL =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';

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

// Inline bold renderer
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

  const boldStart = prefix.length;
  const boldEnd = boldStart + boldText.length;

  let y = yStart;
  let cursor = 0;

  for (const line of lines) {
    const lineStart = cursor;
    const lineEnd = cursor + line.length;

    if (lineEnd <= boldStart || lineStart >= boldEnd) {
      doc.setFont('times', 'normal');
      doc.text(line, leftX, y);
      y += lineLeading;
      cursor += line.length;
      continue;
    }

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

  return y;
}

async function fetchData(irn: string, userId: string) {
  // Applicant (Form4Master)
  const { data: f4 } = await supabase
    .from('form4master')
    .select(
      'ApplicantFirstName, ApplicantLastName, ApplicantAddress1, ApplicantAddress2, ApplicantCity, ApplicantProvince, ApplicantPOBox'
    )
    .eq('IRN', irn)
    .maybeSingle();

  // Incident / IRN data
  const { data: f1112 } = await supabase
    .from('form1112master')
    .select('DisplayIRN, IncidentDate, IncidentProvince, WorkerID')
    .eq('IRN', irn)
    .maybeSingle();

  const displayIRN = f1112?.DisplayIRN ?? '';
  const incidentDateDMY = fmtDMY(f1112?.IncidentDate);

  // Region from dictionary
  let regionProvince = '';
  if (f1112?.IncidentProvince) {
    const { data: dict } = await supabase
      .from('dictionary')
      .select('DValue')
      .eq('DKey', f1112.IncidentProvince)
      .maybeSingle();
    regionProvince = dict?.DValue ?? f1112.IncidentProvince ?? '';
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

  // DR Name
  let drName = '';
  if (userId) {
    const { data: staff } = await supabase
      .from('owcstaffmaster')
      .select('OSMFirstName, OSMLastName')
      .eq('OSMStaffID', userId)
      .maybeSingle();
    if (staff) drName = `${staff.OSMFirstName ?? ''} ${staff.OSMLastName ?? ''}`.trim();
  }

  // Prescreening dates
  const { data: ps } = await supabase
    .from('prescreeningreview')
    .select('PRDecisionDate, PRSubmissionDate')
    .eq('IRN', irn)
    .maybeSingle();

  const acknowledgedDate = fmtDMY(ps?.PRDecisionDate ?? new Date().toISOString());
  const submissionDate = fmtDMY(ps?.PRSubmissionDate);

  // Attachments
  const { data: atch } = await supabase
    .from('formattachments')
    .select('AttachmentType')
    .eq('IRN', irn);
  const submitted = (atch ?? []).map((r) => r.AttachmentType);

  const { data: master } = await supabase
    .from('attachmentmaster')
    .select('FormType')
    .eq('AttachmentType', 'Form12');
  const fullRequired = (master ?? []).map((r) => r.FormType);

  const submittedSet = new Set((submitted ?? []).map((s) => (s || '').trim()));
  const submittedList = fullRequired.filter((x) => submittedSet.has((x || '').trim()));
  const pendingList = fullRequired.filter((x) => !submittedSet.has((x || '').trim()));

  // Address block
  const toName = toTitle(`${f4?.ApplicantFirstName ?? ''} ${f4?.ApplicantLastName ?? ''}`.trim());
  const addrLines = [
    f4?.ApplicantAddress1,
    f4?.ApplicantAddress2,
    f4?.ApplicantCity ? `${f4?.ApplicantCity} , ${f4?.ApplicantProvince ?? ''}` : undefined,
    f4?.ApplicantPOBox ? `${f4.ApplicantPOBox}.` : undefined,
  ].filter(Boolean) as string[];
  const toAddress = [toName, ...addrLines].join('\n');

  return {
    toAddress,
    acknowledgedDate,
    submissionDate,
    displayIRN,
    incidentDateDMY,
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
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates "Deputy Registrar Confirmation Letter (Death)" PDF
 */
export async function generateDeputyConfirmationLetterDeath(
  irn: string,
  userId: string,
  save: boolean = true
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  // Header crest
  try {
    const crestData = await urlToDataUrl(CREST_URL);
    doc.addImage(crestData, 'PNG', 90, 5, 30, 30);
  } catch {}

  // Watermark
  doc.setFont('times', 'bold');
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  doc.text('O R I G I N A L', 65, 190, { angle: 45 });

  // Titles
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('DEPARTMENT OF LABOUR AND INDUSTRIAL RELATIONS', 105, 36, { align: 'center' });
  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.text('(Office of Workers’ Compensation)', 105, 42, { align: 'center' });

  // Contacts
  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  doc.text('Telephone: 675 321 3306', 20, 49);
  doc.text('Ground Floor ', 84, 49);
  doc.text('P.O. Box 5308', 153, 49);
  //doc.text('FACSIMILE:   675 321 5304', 20, 52);
  doc.text('Gaukara Rumana', 84, 52);
  doc.text('Port Moresby, NCD', 153, 52);
  doc.text('Gordons, Wards Road', 84, 55);
  doc.text('Papua New Guinea', 153, 55);

  doc.setLineWidth(0.2);
  doc.line(20, 56.5, 182, 56.5);

  // === Body ===
  const data = await fetchData(irn, userId);

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Date : ${data.acknowledgedDate}`, 138, 64);

  // Address block
  const leftX = 20;
  let y = 65;
  data.toAddress.split('\n').forEach((line) => {
    doc.text(line, leftX, y);
    y += 4;
  });

  y += 6;
  doc.text('Dear Sir', leftX, y);
  y += 7;

  doc.setFont('times', 'bold');
  doc.text(`RE: COMPENSATION CLAIM - ${data.workerName}`, leftX, y);
  y += 4;
  doc.text(`DATE OF LOSS: ${data.incidentDateDMY}`, leftX + 7, y);
  y += 7;

  // Paragraph 1
  doc.setFont('times', 'normal');
  const paraWidth = 150;
  y = drawInlineBold(
    doc,
    leftX,
    y,
    paraWidth,
    'We acknowledge your claim application received on ',
    data.submissionDate || '—',
    ''
  );
  y += 1;

  // Paragraph 2
  y = drawInlineBold(
    doc,
    leftX,
    y,
    paraWidth,
    'We advise the claim has been accepted and registered as ',
    data.displayIRN || '',
    '.'
  );
  y = drawInlineBold(
    doc,
    leftX,
    y,
    paraWidth,
    ' Should you wish to enquire on the status of your claim, contact our ',
    `${data.regionProvince} officer - Claims Branch`,
    ' on the phone numbers stated above.'
  );
  y += 2;

  doc.text('Further, we require', leftX, y);
  y += 10;

  // Tables
  doc.setFont('times', 'bold');
  doc.text('Submitted List', leftX, y);
  y += 5;
  doc.setFont('times', 'normal');
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

  // Footer
  doc.text('The matter will progress further upon receipt of above documents.', leftX, y);
  y += 10;
  doc.text('Yours faithfully,', leftX, y);
  y += 15;
  doc.setFont('times', 'bold');
 // doc.text(data.drName || '', leftX, y);
  y += 4;
  //doc.setFont('times', 'normal');
  doc.text('A/Deputy Registrar', leftX, y);

  if (save) {
    doc.save(`Deputy_Registrar_Letter_Death_${irn}.pdf`);
  }
  return doc;
}

export default generateDeputyConfirmationLetterDeath;

