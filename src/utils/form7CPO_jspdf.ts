// src/utils/form7CPO_jspdf.ts
// Build Form 7 (CPO) PDF exactly like the PHP/FPDF version using jsPDF + Supabase.
// Usage: await downloadForm7CPO(irn);  // optional: pass custom logoPath/fileName

import { jsPDF } from 'jspdf';
import { supabase } from '../services/supabase';

// default crest (Supabase signed URL from your instructions)
const DEFAULT_LOGO =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';

// ---------- helpers ----------
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

const split = (doc: jsPDF, text: string, width: number) =>
  doc.splitTextToSize(text, width);

// Load an image URL into a data URL for addImage (more reliable across browsers)
async function toDataURL(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context missing');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ---------- data fetch (mirrors PHP queries) ----------
type Form7Data = {
  RegisterNumber: string;
  IncidentType: string;
  IncidentDate: string; // dd/mm/yyyy
  PartyName1: string; // worker/applicant (uppercase)
  ToAddress: string;  // left address block
};

async function fetchForm7Data(irn: string): Promise<Form7Data> {
  // Form1112Master fields
  const { data: f112, error: e1 } = await supabase
    .from('form1112master')
    .select('DisplayIRN, IncidentDate, IncidentType, WorkerID')
    .eq('IRN', irn)
    .maybeSingle();
  if (e1 || !f112) throw new Error(e1?.message || 'Form1112Master not found');

  const RegisterNumber = String(f112.DisplayIRN ?? irn);
  const IncidentType = String(f112.IncidentType ?? '');
  const IncidentDate = fmtDDMMYYYY(f112.IncidentDate) || '';

  // Worker full name (uppercase)
  let PartyName1 = '';
  if (f112.WorkerID != null) {
    const { data: wn, error: e2 } = await supabase
      .from('workerpersonaldetails')
      .select('WorkerFirstName, WorkerLastName')
      .eq('WorkerID', f112.WorkerID)
      .maybeSingle();
    if (e2) throw new Error(e2.message);
    PartyName1 = `${(wn?.WorkerFirstName || '').toString().toUpperCase()} ${(wn?.WorkerLastName || '')
      .toString()
      .toUpperCase()}`.trim();
  }

  // Address block
  let ToAddress = '';
  if (IncidentType === 'Death') {
    const { data: f4, error: e4 } = await supabase
      .from('form4master')
      .select(
        'ApplicantFirstName, ApplicantLastName, ApplicantAddress1, ApplicantAddress2, ApplicantCity, ApplicantProvince, ApplicantPOBox'
      )
      .eq('IRN', irn)
      .maybeSingle();
    if (e4) throw new Error(e4.message);

    const addr = [
      toTitle(`${f4?.ApplicantFirstName || ''} ${f4?.ApplicantLastName || ''}`.trim()),
      toTitle(f4?.ApplicantAddress1 || ''),
      toTitle(f4?.ApplicantAddress2 || ''),
      f4?.ApplicantCity || f4?.ApplicantProvince
        ? `${toTitle(f4?.ApplicantCity || '')} , ${toTitle(f4?.ApplicantProvince || '')}`
        : '',
      f4?.ApplicantPOBox ? `${f4.ApplicantPOBox}` : ''
    ]
      .filter(Boolean)
      .join('\r\n');

    ToAddress = addr;
  } else {
    const { data: wAddr, error: e3 } = await supabase
      .from('workerpersonaldetails')
      .select('WorkerAddress1, WorkerAddress2, WorkerCity, WorkerProvince, WorkerPOBox')
      .eq('WorkerID', f112.WorkerID)
      .maybeSingle();
    if (e3) throw new Error(e3.message);
    const addr = [
      toTitle(wAddr?.WorkerAddress1 || ''),
      toTitle(wAddr?.WorkerAddress2 || ''),
      wAddr?.WorkerCity || wAddr?.WorkerProvince
        ? `${toTitle(wAddr?.WorkerCity || '')} , ${toTitle(wAddr?.WorkerProvince || '')}`
        : '',
      wAddr?.WorkerPOBox ? `${wAddr.WorkerPOBox}` : ''
    ]
      .filter(Boolean)
      .join('\r\n');
    ToAddress = addr;
  }

  // (Employer & insurer & compensation were looked up in PHP but not rendered on Form 7 body.)
  return { RegisterNumber, IncidentType, IncidentDate, PartyName1, ToAddress };
}

// ---------- drawing ----------
function renderHeader(doc: jsPDF, logoDataUrl?: string) {
  // Crest centered like PHP: (x=90, y=3, w=30)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 90, 3, 30, 0);
    } catch {
      /* ignore image issues */
    }
  }
  // Watermark
  doc.setFont('times', 'bold');
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  // @ts-ignore: jsPDF supports angle via options
  doc.text('O R I G I N A L', 65, 190, { angle: 45 });

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('INDEPENDENT STATE OF PAPUA NEW GUINEA', 105, 33, { align: 'center' });

  // Reg / Act / Form (line under title)
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('Reg, Sec. 8(2)', 24, 43); // left
  doc.setFont('times', 'bold');
  doc.text('Workers’ Compensation Act 1978', 105, 43, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.text('Form 7', 186, 43, { align: 'right' });
}

function renderBody(doc: jsPDF, d: Form7Data) {
  // "Register No."
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('Register No. : ', 24, 55);
  doc.setFont('times', 'normal');
  doc.text(d.RegisterNumber || '', 24 + 30, 55);

  // "IN RESPECT OF" row
  doc.setFont('times', 'bold');
  doc.text('IN RESPECT OF', 24, 67);
  doc.text(d.PartyName1 || '', 105, 67, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('a worker of', 186, 67, { align: 'right' });

  // Address block (width 75mm)
  {
    const lines = split(doc, d.ToAddress || '', 75);
    let y = 73;
    for (const ln of lines) {
      doc.text(ln, 24, y);
      y += 4;
    }
  }

  // Heading
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('EMPLOYER’S ANSWER TO APPLICATION FOR COMPENSATION', 105, 120, { align: 'center' });

  // Registrar address
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  const lines = [
    'The Registrar,',
    "Office of Workers' Compensation",
    'Department of Labour & Industrial Relations',
    'P O Box 5308',
    'BOROKO'
  ];
  let y = 132;
  for (const ln of lines) {
    doc.text(ln, 24, y);
    y += 4;
  }

  y += 4;
  doc.text('The employer intends to oppose the application for compensation', 24, y);
  y += 6;
  doc.text('The following is a concise statement of the extent and grounds of his opposition:-', 24, y);
  y += 6;

  // Four dotted lines like the sample/PHP
  const dots =
    '...........................................................................................................................................................................................';
  for (let i = 0; i < 4; i++) {
    doc.text(dots, 24, y);
    y += 6;
  }
}

function renderFooter(doc: jsPDF) {
  // Position near bottom of the page to mimic FPDF Footer()
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);

  let y = 242;
  doc.text('Dated this.....................................day of................................20.....', 24, y);

  y += 10;
  // signature line right aligned
  doc.text('.............................................', 200, y, { align: 'right' });
  y += 6;
  doc.text('(Signature of Employer)', 200, y, { align: 'right' });

  y += 21;
  doc.text('Place:  ...............................................', 24, y);

  y += 21;
  // NOTE (normal weight like PHP but we can keep bold or switch to normal)
  doc.setFont('times', 'normal');
  doc.text(
    'NOTE:              The answer may be signed by the employer, his lawyer or other agent.',
    24,
    y
  );
}

// ---------- main ----------
export async function downloadForm7CPO(
  irn: string,
  opts?: {
    logoPath?: string; // crest
    fileName?: string;
  }
) {
  if (!irn) throw new Error('IRN is required');

  // Fetch data
  const data = await fetchForm7Data(irn);

  // Prepare PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  // Load crest
  let logoDataUrl: string | undefined = undefined;
  const logoSrc = opts?.logoPath || DEFAULT_LOGO;
  try {
    logoDataUrl = await toDataURL(logoSrc);
  } catch {
    // fallback: leave undefined (PDF will render without crest)
  }

  // Render
  renderHeader(doc, logoDataUrl);
  renderBody(doc, data);
  renderFooter(doc);

  // Save
  const out = opts?.fileName || `Form7_${data.RegisterNumber || irn}.pdf`;
  doc.save(out);
}

export default downloadForm7CPO;

