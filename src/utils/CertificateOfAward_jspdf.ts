// /src/utils/CertificateOfAward_jspdf.ts
import jsPDF from 'jspdf';
import { supabase } from '../services/supabase';

// Assets (defaults)
const CREST_URL =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';
const REGISTRAR_STAMP_URL =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/Registrar.png';
const REGISTRAR_SIGN_URL =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/registrarsign.png';

type CertOpts = {
  // either of these can trigger stamps before DB update
  includeSignature?: boolean;
  showStamps?: boolean;         // backward-compat alias
  signatureUrl?: string;        // override registrar sign
  stampUrl?: string;            // override registrar stamp
  crestUrl?: string;            // override crest
};

const toUpper = (v?: any) => (v ?? '').toString().toUpperCase();
const fmtDate = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v.toString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function fetchCertificateData(irn: string | number) {
  const IRN = typeof irn === 'string' ? irn : String(irn);

  const { data: f1112, error: f1112Err } = await supabase
    .from('form1112master')
    .select('DisplayIRN, IncidentDate, IncidentProvince, WorkerID')
    .eq('IRN', IRN)
    .maybeSingle();
  if (f1112Err) throw f1112Err;

  const { data: carr, error: carrErr } = await supabase
    .from('claimsawardedregistrarreview')
    .select('CARRDecisionDate, CARRReviewStatus')
    .eq('IRN', IRN)
    .maybeSingle();
  if (carrErr) throw carrErr;

  const { data: worker } = await supabase
    .from('workerpersonaldetails')
    .select('WorkerFirstName, WorkerLastName, WorkerPlaceOfOriginVillage, WorkerPlaceOfOriginDistrict, WorkerPlaceOfOriginProvince')
    .eq('WorkerID', f1112?.WorkerID ?? -1)
    .maybeSingle();

  const { data: empSnap } = await supabase
    .from('currentemploymentdetails')
    .select('EmployerCPPSID')
    .eq('WorkerID', f1112?.WorkerID ?? -1)
    .maybeSingle();

  const employerCpps =
    (empSnap?.EmployerCPPSID as any) ?? (empSnap as any)?.EmployercppsID ?? null;

  const { data: employer } = await supabase
    .from('employermaster')
    .select('OrganizationName, Address1, Address2, City, Province, POBox, InsuranceProviderIPACode')
    .eq('CPPSID', employerCpps ?? '')
    .maybeSingle();

  let insurerName = '';
  if (employer?.InsuranceProviderIPACode) {
    const { data: ins } = await supabase
      .from('insurancecompanymaster')
      .select('InsuranceCompanyOrganizationName')
      .eq('IPACODE', employer.InsuranceProviderIPACode)
      .maybeSingle();
    insurerName = toUpper(ins?.InsuranceCompanyOrganizationName);
  }
  if (!insurerName || insurerName === 'SELF') {
    insurerName = toUpper(employer?.OrganizationName);
  }

  // Use today's date for printing
  const todayISO = new Date().toISOString();

  const registerNumber = f1112?.DisplayIRN ?? '';
  const decisionDate = fmtDate(todayISO);
  const decision = carr?.CARRReviewStatus ?? '';
  const workerName = toUpper(`${worker?.WorkerFirstName ?? ''} ${worker?.WorkerLastName ?? ''}`.trim());
  const workerAddress = toUpper(
    `${worker?.WorkerPlaceOfOriginVillage ?? ''} Village, ${worker?.WorkerPlaceOfOriginDistrict ?? ''} District, ${worker?.WorkerPlaceOfOriginProvince ?? ''} Province`
  ).replace(/\s+,/g, ',');
  const employerName = toUpper(employer?.OrganizationName);
  const employerAddress = toUpper(
    `${employer?.Address1 ?? ''}, ${employer?.Address2 ?? ''}, ${employer?.City ?? ''}, ${employer?.Province ?? ''}, ${employer?.POBox ?? ''}.`
  ).replace(/\s+,/g, ',');

  return {
    registerNumber,
    decisionDate,
    decision,
    workerName,
    workerAddress,
    employerName,
    employerAddress,
    insurerName,
  };
}

export async function generateCertificateOfAward(
  irn: string | number,
  opts?: CertOpts
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFont('times', 'normal');

  // watermark
  doc.saveGraphicsState();
  doc.setFont('times', 'bold');
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  doc.text('O R I G I N A L', 65, 190, { angle: 45 });
  doc.restoreGraphicsState();

  // crest (allow override)
  const crestData = await toDataUrl(opts?.crestUrl || CREST_URL);
  if (crestData) {
    const pageW = doc.internal.pageSize.getWidth();
    const crestW = 22;
    const crestX = (pageW - crestW) / 2;
    doc.addImage(crestData, 'PNG', crestX, 10, crestW, 22);
  }

  const d = await fetchCertificateData(irn);

  // headings
  let y = crestData ? 36 : 20;
  doc.setTextColor(0, 0, 0);

  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('PAPUA NEW GUINEA', 105, y, { align: 'center' }); y += 16;

  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.text('WORKERS COMPENSATION TRIBUNAL', 105, y, { align: 'center' }); y += 16;

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('CERTIFICATE OF AWARD', 105, y, { align: 'center' }); y += 16;

  // body
  const left = 20;
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text(
    'This Certificate is issued pursuant to s 30 of the Workers Compensation Act 1978 (as consolidated).',
    left,
    y
  ); y += 16;

  doc.text(`Award No: ${d.registerNumber}`, left, y); y += 8;
  doc.text(`Claim No: ${d.registerNumber}`, left, y); y += 8;
  doc.text(`Claimant: ${d.workerName}`, left, y); y += 8;
  doc.text(`Employer: ${d.employerName}`, left, y); y += 8;
  doc.text(`Insurer: ${d.insurerName}`, left, y); y += 16;

  doc.text(`Date of Decision: ${d.decisionDate}`, left, y); y += 16;

  doc.text('The Award is attached.', left, y); y += 16;

  doc.text('I CERTIFY THAT THIS IS A TRUE AND ACCURATE CERTIFICATE OF THE AWARD ISSUED', left, y); y += 6;
  doc.text('BY THE WORKERS COMPENSATION TRIBUNAL', left, y); y += 26;

  // Name + Title
  doc.text('LOUISA PAMBEL', left, y); y += 6;
  doc.text('REGISTRAR', left, y);

  // ---- signatures (Registrar) ----
  const forced = !!(opts?.includeSignature || opts?.showStamps);
  const accepted = (d.decision || '').trim() === 'RegistrarAccepted';
  if (forced || accepted) {
    const signUrl = opts?.signatureUrl || REGISTRAR_SIGN_URL;
    const stampUrl = opts?.stampUrl || REGISTRAR_STAMP_URL;
    const sign = await toDataUrl(signUrl);
    const stamp = await toDataUrl(stampUrl);
    if (sign) doc.addImage(sign, 'PNG', 20, 193, 36, 0);
    if (stamp) doc.addImage(stamp, 'PNG', 70, 200, 36, 0);
  }

  const fname = `CertificateOfAward_${(d.registerNumber || irn).toString()}.pdf`;
  doc.save(fname);
}

export default generateCertificateOfAward;

