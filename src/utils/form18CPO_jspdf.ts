// form18CPO_jspdf.ts
// Rebuild of Form18 (CPO) PDF using jsPDF to match the provided PHP exactly.
// Single-page Body only (no extra pages), plus header/footer as per PHP.
// Tables mirror the PHP logic; field positions match the described layout.

import { jsPDF } from 'jspdf';
import { supabase } from '../services/supabase';

// ------------------ constants ------------------
const DEFAULT_LOGO_URL =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';

// ------------------ helpers ------------------

const num = (v: any) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtK = (n: number) =>
  `K ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;



const toTitle = (s?: string | null) =>
  (s ?? '')
    .toLowerCase()
    .replace(/(^|\s|-|\/)\S/g, (t) => t.toUpperCase());

const fmtDDMMYYYY = (d?: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const fetchImageAsDataURL = async (url: string): Promise<string> => {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to load logo: ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
};

const split = (doc: jsPDF, text: string, width: number) => doc.splitTextToSize(text, width);

// Draw the run-based paragraph with bold spans at fixed width (left aligned)
type Run = { text: string; bold?: boolean };
function drawRuns(doc: jsPDF, x: number, y: number, width: number, lineH: number, runs: Run[]) {
  const size = 9.5;
  const lines: Run[][] = [];
  let curLine: Run[] = [];
  let curWidth = 0;

  const measure = (t: string, bold?: boolean) => {
    doc.setFont('times', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return doc.getTextWidth(t);
  };

  const pushWord = (word: string, bold?: boolean) => {
    const w = measure((curLine.length ? ' ' : '') + word, bold);
    if (curWidth + w > width) {
      if (curLine.length) lines.push(curLine), (curLine = []), (curWidth = 0);
      // if still too long, force split
      const parts = word.split(/(\s+)/).filter(Boolean);
      let buff = '';
      for (const p of parts) {
        const w2 = measure((buff ? '' : curLine.length ? ' ' : '') + p, bold);
        if (curWidth + w2 > width) {
          if (buff) {
            curLine.push({ text: (curLine.length ? ' ' : '') + buff, bold });
            lines.push(curLine);
            curLine = [];
            curWidth = 0;
            buff = p.trim();
          } else {
            // single part too big, push and wrap
            curLine.push({ text: (curLine.length ? ' ' : '') + p, bold });
            lines.push(curLine);
            curLine = [];
            curWidth = 0;
            buff = '';
          }
        } else {
          buff += p;
          curWidth += w2;
        }
      }
      if (buff) {
        const w3 = measure((curLine.length ? ' ' : '') + buff, bold);
        curLine.push({ text: (curLine.length ? ' ' : '') + buff, bold });
        curWidth += w3;
      }
    } else {
      curLine.push({ text: (curLine.length ? ' ' : '') + word, bold });
      curWidth += w;
    }
  };

  // tokenize runs by spaces
  for (const r of runs) {
    const words = r.text.split(/\s+/).filter((w) => w.length > 0);
    for (let i = 0; i < words.length; i++) pushWord(words[i], r.bold);
  }
  if (curLine.length) lines.push(curLine);

  // draw
  let yy = y;
  for (const line of lines) {
    let xx = x;
    for (const seg of line) {
      doc.setFont('times', seg.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.text(seg.text, xx, yy);
      xx += measure(seg.text, seg.bold);
    }
    yy += lineH;
  }
  return yy;
}

// ------------------ data fetching ------------------
// Matches PHP queries (table/column names per your schema)
async function fetchBody(irn: string) {
  // Form1112Master: DisplayIRN, IncidentDate, IncidentType, WorkerID
  const { data: f112, error: e1 } = await supabase
    .from('form1112master')
    .select('DisplayIRN, IncidentDate, IncidentType, WorkerID')
    .eq('IRN', irn)
    .maybeSingle();
  if (e1 || !f112) throw new Error(e1?.message || 'Form1112Master not found');

  const RegisterNumber = String(f112.DisplayIRN ?? irn);
  const IncidentType = String(f112.IncidentType ?? '');
  const IncidentDate = fmtDDMMYYYY(f112.IncidentDate ?? '');

  // Worker name (uppercased) - Always needed for "IN RESPECT OF"
  let WorkerName = '';
  if (f112.WorkerID != null) {
    const { data: wn, error } = await supabase
      .from('workerpersonaldetails')
      .select('WorkerFirstName, WorkerLastName')
      .eq('WorkerID', f112.WorkerID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    WorkerName = `${(wn?.WorkerFirstName || '').toString().toUpperCase()} ${(wn?.WorkerLastName || '').toString().toUpperCase()}`.trim();
  }

  let PartyName1 = WorkerName;

  // ToAddress (Death => Form4Master; else => WorkerPersonalDetails address ONLY)
  let ToAddress = '';
  if (IncidentType === 'Death') {
    const { data: f4, error } = await supabase
      .from('form4master')
      .select(
        'ApplicantFirstName, ApplicantLastName, ApplicantAddress1, ApplicantAddress2, ApplicantCity, ApplicantProvince, ApplicantPOBox'
      )
      .eq('IRN', irn)
      .maybeSingle();
    if (error) throw new Error(error.message);
    PartyName1 = `${(f4?.ApplicantFirstName || '').toString().toUpperCase()} ${(f4?.ApplicantLastName || '').toString().toUpperCase()}`.trim();
    ToAddress = [
      toTitle(`${f4?.ApplicantFirstName || ''} ${f4?.ApplicantLastName || ''}`.trim()),
      toTitle(f4?.ApplicantAddress1 || ''),
      toTitle(f4?.ApplicantAddress2 || ''),
      (f4?.ApplicantCity || f4?.ApplicantProvince)
        ? `${toTitle(f4?.ApplicantCity || '')} , ${toTitle(f4?.ApplicantProvince || '')}`
        : '',
      f4?.ApplicantPOBox ? String(f4.ApplicantPOBox) : '',
    ]
      .filter(Boolean)
      .join('\r\n');
  } else {
    const { data: wAddr, error } = await supabase
      .from('workerpersonaldetails')
      .select('WorkerAddress1, WorkerAddress2, WorkerCity, WorkerProvince, WorkerPOBox')
      .eq('WorkerID', f112.WorkerID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    ToAddress = [
      toTitle(wAddr?.WorkerAddress1 || ''),
      toTitle(wAddr?.WorkerAddress2 || ''),
      (wAddr?.WorkerCity || wAddr?.WorkerProvince)
        ? `${toTitle(wAddr?.WorkerCity || '')} , ${toTitle(wAddr?.WorkerProvince || '')}`
        : '',
      wAddr?.WorkerPOBox ? String(wAddr.WorkerPOBox) : '',
    ]
      .filter(Boolean)
      .join('\r\n');
  }

  // Employer via CurrentEmploymentDetails -> EmployerMaster
  const { data: ced, error: e2 } = await supabase
    .from('currentemploymentdetails')
    .select('EmployerCPPSID, WorkerID')
    .eq('WorkerID', f112.WorkerID)
    .maybeSingle();
  if (e2) throw new Error(e2.message);

  let PartyName2 = '';
  let EmployerAddress = '';
  let ipIPAcode: string | null = null;

  if (ced?.EmployerCPPSID) {
    const { data: emp, error } = await supabase
      .from('employermaster')
      .select('OrganizationName, Address1, Address2, City, Province, POBox, InsuranceProviderIPACode')
      .eq('CPPSID', ced.EmployerCPPSID)
      .maybeSingle();
    if (error) throw new Error(error.message);

    PartyName2 = toTitle(emp?.OrganizationName || '');
    EmployerAddress = [
      toTitle(emp?.Address1 || ''),
      toTitle(emp?.Address2 || ''),
      toTitle(emp?.City || ''),
      `${toTitle(emp?.Province || '')} , ${emp?.POBox ? emp.POBox : ''}.`.replace(/\s+\./, '.'),
    ]
      .filter(Boolean)
      .join('\r\n');

    ipIPAcode = (emp?.InsuranceProviderIPACode ?? null) as string | null;
  }

  // InsuranceCompanyMaster by IPACODE
  let ipOrgName = '';
  let ICAddress = '';
  if (ipIPAcode) {
    const { data: ic, error } = await supabase
      .from('insurancecompanymaster')
      .select(
        'InsuranceCompanyOrganizationName, InsuranceCompanyAddress1, InsuranceCompanyAddress2, InsuranceCompanyCity, InsuranceCompanyProvince, InsuranceCompanyPOBox'
      )
      .eq('IPACODE', ipIPAcode)
      .maybeSingle();
    if (error) throw new Error(error.message);

    ipOrgName = toTitle(ic?.InsuranceCompanyOrganizationName || '');
    ICAddress = [
      toTitle(ic?.InsuranceCompanyAddress1 || ''),
      toTitle(ic?.InsuranceCompanyAddress2 || ''),
      toTitle(ic?.InsuranceCompanyCity || ''),
      `${toTitle(ic?.InsuranceCompanyProvince || '')} , ${ic?.InsuranceCompanyPOBox ? ic.InsuranceCompanyPOBox : ''}.`.replace(/\s+\./, '.'),
    ]
      .filter(Boolean)
      .join('\r\n');
  }

  // ClaimCompensationWorkerDetails -> base + medical + misc - deductions (payable total)
  let baseAmt = 0, medAmt = 0, miscAmt = 0, dedAmt = 0;
  {
    const { data: ccwd, error } = await supabase
      .from('claimcompensationworkerdetails')
      .select('CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions')
      .eq('IRN', irn)
      .maybeSingle();
    if (error) throw new Error(error.message);

    baseAmt = num(ccwd?.CCWDCompensationAmount);
    medAmt = num(ccwd?.CCWDMedicalExpenses);
    miscAmt = num(ccwd?.CCWDMiscExpenses);
    dedAmt = num(ccwd?.CCWDDeductions);
  }

  const payableAmtNum = Math.max(0, baseAmt + medAmt + miscAmt - dedAmt);


  return {
    RegisterNumber,
    IncidentType,
    IncidentDate,
    PartyName1,
    ToAddress,
    PartyName2,
    EmployerAddress,
    ipOrgName,
    ICAddress,
    payableAmtNum,
    WorkerName,
  };

}

// ------------------ rendering ------------------
function renderHeader(doc: jsPDF, logoDataUrl?: string) {
  // Crest
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 90, 3, 30, 0);
    } catch {
      /* ignore logo failure */
    }
  }

  // Watermark
  doc.setFont('times', 'bold');
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  doc.text('O R I G I N A L', 65, 190, { angle: 45 });

  // Titles
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('INDEPENDENT STATE OF PAPUA NEW GUINEA', 105, 33, { align: 'center' });

  // Reg / Act / Form (match strings in PHP exactly)
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('Reg, Sec. 25', 24, 43);
  doc.setFont('times', 'bold');
  doc.text('Workers  Compensation Act 1978', 105, 43, { align: 'center' }); // note double space
  doc.setFont('times', 'normal');
  doc.text('Form 18', 186, 43, { align: 'right' });
}

function renderFooter(doc: jsPDF) {
  // position near bottom (fits two 8mm rows)
  const dateY = 240;
  const row1Y = 249;
  const row2Y = 259;
  const leftX = 24;
  const cellW = 80;
  const cellH = 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Date : ${fmtDDMMYYYY(new Date().toISOString())}`, leftX, dateY);

  // Row 1: Signed by...
  doc.rect(leftX, row1Y, cellW, cellH);
  doc.text('Signed by or on behalf of the worker', leftX + 2, row1Y + 5);
  doc.rect(leftX + cellW, row1Y, cellW, cellH);
  doc.text('Signed by or on behalf of the employer', leftX + cellW + 2, row1Y + 5);

  // Row 2: In the presence of...
  doc.rect(leftX, row2Y, cellW, cellH);
  doc.text('In the presence of', leftX + 2, row2Y + 5);
  doc.rect(leftX + cellW, row2Y, cellW, cellH);
  doc.text('In the presence of', leftX + cellW + 2, row2Y + 5);
}

function renderBody(doc: jsPDF, data: Awaited<ReturnType<typeof fetchBody>>) {
  // "Register No. :"
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('Register No. : ', 24, 55);
  doc.setFont('times', 'normal');
  doc.text(data.RegisterNumber || '', 24 + 35, 55);

  // "IN RESPECT OF" + PartyName1 + "a worker of"
  doc.setFont('times', 'bold');
  doc.text('IN RESPECT OF', 24, 67);
  doc.text(data.WorkerName || '', 105, 67, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('a worker of', 186, 67, { align: 'right' });

  // Left block address (ToAddress) width 75mm
  {
    const lines = split(doc, data.ToAddress || '', 75);
    let y = 73;
    lines.forEach((ln) => {
      doc.text(ln, 24, y);
      y += 4;
    });
  }

  // "AND" at approx y=83 per PHP
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('AND', 96, 83);

  // Insurance Company centered + label
  doc.setFont('times', 'bold');
  doc.text(data.ipOrgName || '', 105, 94, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('the Insurance Company', 186, 94, { align: 'right' });

  // Insurance address 65mm
  {
    const lines = split(doc, data.ICAddress || '', 65);
    let y = 100;
    lines.forEach((ln) => {
      doc.text(ln, 24, y);
      y += 4;
    });
  }

  // "Acting on behalf of"
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('Acting on behalf of', 105, 115, { align: 'center' });

  // Employer name + label
  doc.setFont('times', 'bold');
  doc.text(data.PartyName2 || '', 105, 123, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('the employer', 186, 123, { align: 'right' });

  // Employer address 65mm
  let afterEmployerY = 129;
  {
    const lines = split(doc, data.EmployerAddress || '', 65);
    let y = afterEmployerY;
    lines.forEach((ln) => {
      doc.text(ln, 24, y);
      y += 4;
    });
    afterEmployerY = y;
  }

  // Heading: APPLICATION FOR AN AWARD BY CONSENT
  const headingY = Math.max(afterEmployerY + 10, 160);
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('APPLICATION FOR AN AWARD BY CONSENT', 105, headingY, { align: 'center' });

  // "The Chief Commissioner," & "Office of Workers' Compensation"
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('The Chief Commissioner,', 24, headingY + 12);
  doc.text("Office of Workers' Compensation", 24, headingY + 16);

  // Application paragraph
  const p1 =
    'Application is made for a consent award by a tribunal in respect of an agreement reached between the above named worker and employer, particulars of the agreement are as follows: ';
  {
    const lines = split(doc, p1, 160);
    let y = headingY + 24;
    lines.forEach((ln) => {
      doc.text(ln, 24, y);
      y += 5;
    });

    // Final paragraph with bold spans
    const runs: Run[] = [
      { text: 'THE INSURER' },
      { text: ` ${data.ipOrgName || ''} `, bold: true },
      { text: 'ACTING ON BEHALF OF ' },
      { text: `${data.PartyName2 || ''} `, bold: true },
      { text: 'AGREES TO PAY ' },
      { text: `${fmtK(data.payableAmtNum)} `, bold: true },
      { text: 'AND I, ' },
      { text: `${data.PartyName1 || ''}`, bold: true },
      { text: ` ${data.IncidentType === 'Death' ? '(SIGNED ON BEHALF OF WORKER)' : '(SIGNED WORKER)'} AGREE TO ACCEPT THE SUM AS FULL AND FINAL PAYMENT FOR ` },
      { text: `${(data.IncidentType || '').toUpperCase()} `, bold: true },
      { text: `${data.IncidentType === 'Death' ? "DURING THE COURSE OF WORKER'S DUTIES ON THE " : "DURING THE COURSE OF MY DUTIES ON THE "}` },
      { text: `${data.IncidentDate || ''}`, bold: true },
      { text: '.' },
    ];
    drawRuns(doc, 24, y + 4, 160, 5, runs);
  }
}

// ------------------ main ------------------
export async function downloadForm18CPO(
  irn: string,
  opts?: {
    logoPath?: string; // optional override
    fileName?: string;
  }
) {
  if (!irn) throw new Error('IRN is required');

  // fetch all data
  const body = await fetchBody(irn);

  // fetch crest once
  let logoDataUrl: string | undefined;
  try {
    logoDataUrl = await fetchImageAsDataURL(opts?.logoPath || DEFAULT_LOGO_URL);
  } catch (e) {
    console.warn('Logo load failed:', e);
  }

  // build single-page PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  renderHeader(doc, logoDataUrl);
  renderBody(doc, body);
  renderFooter(doc);

  doc.save(opts?.fileName || `Form18_${body.RegisterNumber || irn}.pdf`);
}

export default downloadForm18CPO;

