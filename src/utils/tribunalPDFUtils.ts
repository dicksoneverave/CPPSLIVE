import jsPDF from 'jspdf';
import { SupabaseClient } from '@supabase/supabase-js';

// Helper for date formatting with suffixes (e.g., 21st, 2nd)
const formatSuffixDate = (date: Date | string) => {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  const year = d.getFullYear();
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  const suffix = s[(v - 20) % 10] || s[v] || s[0];
  return `${day}${suffix} ${month} ${year}`;
};

/**
 * Shared data fetching logic for Tribunal PDF generation
 */
const fetchTribunalPDFData = async (supabase: SupabaseClient, irn: string) => {
  const { data: thoData } = await supabase.from('tribunalhearingoutcome').select('*').eq('THOIRN', irn).maybeSingle();
  const { data: f1112 } = await supabase.from('form1112master').select('DisplayIRN, WorkerID').eq('IRN', irn).maybeSingle();
  const { data: workerIrnData } = await supabase.from('workerirn').select('WorkerID').eq('IRN', irn).maybeSingle();
  
  const workerID = f1112?.WorkerID || workerIrnData?.WorkerID;
  let employerData = null;
  let workerPersonalData = null;

  if (workerID) {
    const { data: cedData } = await supabase
      .from('currentemploymentdetails')
      .select('EmployerCPPSID')
      .eq('WorkerID', workerID)
      .maybeSingle();

    if (cedData?.EmployerCPPSID) {
      const { data: empData } = await supabase
        .from('employermaster')
        .select('OrganizationName, Address1, Address2, City, OrganizationType')
        .eq('CPPSID', cedData.EmployerCPPSID)
        .maybeSingle();
      employerData = empData;
    }

    const { data: wpdData } = await supabase
      .from('workerpersonaldetails')
      .select('WorkerAddress1, WorkerAddress2')
      .eq('WorkerID', workerID)
      .maybeSingle();
    workerPersonalData = wpdData;
  }

  const orgName = employerData?.OrganizationName || 'THE STATE';
  const orgType = employerData?.OrganizationType || 'State';
  const empFullAddress = [employerData?.Address1, employerData?.Address2, employerData?.City].filter(Boolean).join(', ');
  const workerOwnAddr = [workerPersonalData?.WorkerAddress1, workerPersonalData?.WorkerAddress2].filter(Boolean).map(s => s.trim()).join(' ');

  let finalWorkerAddr = '';
  if (workerOwnAddr && workerOwnAddr.length > 0) {
    finalWorkerAddr = workerOwnAddr;
  } else {
    finalWorkerAddr = orgType === 'State' ? `C/- ${orgName}` : `C/- ${[orgName, empFullAddress].filter(Boolean).join(', ')}`;
  }
  const finalEmployerDetails = [orgName, empFullAddress].filter(Boolean).join(', ');

  return { thoData, f1112, orgName, orgType, finalWorkerAddr, finalEmployerDetails };
};

export const generateSingleForm18 = async (supabase: SupabaseClient, irn: string, hearingNo: string) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const logoUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/logocrest.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL2xvZ29jcmVzdC5wbmciLCJpYXQiOjE3NTI2MDg2MzEsImV4cCI6MjM4MzMyODYzMX0.cZ8Px1aDewyNCGugVA5WUNqSUGyu28LvfU5VfmR3jao';

  const { thoData, f1112, orgName, orgType, finalWorkerAddr, finalEmployerDetails } = await fetchTribunalPDFData(supabase, irn);
  if (!thoData) throw new Error('Outcome not found');

  let y = 10;

  // Header Logo
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = () => { doc.addImage(img, 'PNG', (pageWidth - 25) / 2, y, 25, 25); resolve(true); };
      img.onerror = () => resolve(true);
      img.src = logoUrl;
    });
    y += 32;
  } catch (e) { y += 10; }

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('PAPUA NEW GUINEA', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(12);
  doc.text('WORKERS COMPENSATION TRIBUNAL', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(14); doc.setTextColor(200, 0, 0);
  doc.text('APPLICATION FOR AN AWARD BY CONSENT', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(11); doc.setTextColor(0, 0, 0);
  doc.text('Act, Sec. 74.', margin, y);
  doc.text('Workers\' Compensation Act 1978', pageWidth / 2, y, { align: 'center' });
  doc.text('Form 18', pageWidth - margin, y, { align: 'right' });
  y += 12;

  doc.text(`Register No: CRN ${f1112?.DisplayIRN || irn}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.text('RESPECT OF', margin, y);
  y += 10;

  // Worker Info
  doc.setFont('times', 'normal');
  doc.text('(full name of worker)', margin, y);
  doc.setFont('times', 'bold');
  doc.text(thoData.THOClaimant.toUpperCase(), margin + 50, y);
  doc.setFont('times', 'normal');
  doc.text('the worker of', pageWidth - margin, y, { align: 'right' });
  y += 6;
  doc.text('(address)', margin, y);
  doc.setFont('times', 'bold');
  const workerAddrLines = doc.splitTextToSize(finalWorkerAddr, pageWidth - margin - (margin + 50));
  doc.text(workerAddrLines, margin + 50, y);
  y += (workerAddrLines.length * 5) + 5;

  doc.text('AND', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Employer Info
  doc.setFont('times', 'normal');
  doc.text('(full name of employer)', margin, y);
  doc.setFont('times', 'bold');
  doc.text(orgName.toUpperCase(), margin + 50, y);
  doc.setFont('times', 'normal');
  doc.text('the employer of', pageWidth - margin, y, { align: 'right' });
  y += 6;
  doc.text('(address) acting for and on behalf of', margin, y);
  doc.setFont('times', 'bold');
  const employerAddrLines = doc.splitTextToSize(`C/- ${finalEmployerDetails}`, pageWidth - margin - (margin + 65));
  doc.text(employerAddrLines, margin + 65, y);
  y += (employerAddrLines.length * 5) + 8;

  doc.setFontSize(12);
  // y += 12; was removed above

  doc.setFontSize(11);
  doc.text('The Chief Commissioner', margin, y); y += 5;
  doc.text('Office of Workers\' Compensation', margin, y); y += 5;
  doc.text('P O Box 5308', margin, y); y += 5;
  doc.text('BOROKO', margin, y); y += 5;
  doc.text('NCD', margin, y); y += 15;

  doc.setFont('times', 'normal');
  const body1 = "Application is hereby made for a consent award by a tribunal in respect of an agreement reached between the aforesaid worker and employer, particulars of the agreement are as follows:-";
  const bodyLines1 = doc.splitTextToSize(body1, pageWidth - (margin * 2));
  doc.text(bodyLines1, margin, y);
  y += (bodyLines1.length * 6) + 6;

  const amount = thoData?.THOConfirmedAmount ? Number(thoData.THOConfirmedAmount).toLocaleString() : '0.00';
  const reason = thoData?.THOReason || 'settlement of the claim';
  const agreeEntity = orgType === 'State' ? 'STATE' : 'EMPLOYER';

  const segments = [
    { text: 'I, ', bold: false },
    { text: `${thoData.THOClaimant.trim()}`, bold: true },
    { text: ' (claimant) hereby agree to accept the sum of ', bold: false },
    { text: `K${amount}`, bold: true },
    { text: ' for the ', bold: false },
    { text: `${reason.trim()}`, bold: true },
    { text: ` as full and final settlement and the ${agreeEntity} agrees to settle this claim on the amount agreed and discharges any further liability under the Act.`, bold: false }
  ];

  let currentX = margin;
  const lineHeight = 6;
  segments.forEach(seg => {
    doc.setFont('times', seg.bold ? 'bold' : 'normal');
    const segText = seg.text;
    const parts = segText.split(/(\s+)/);
    parts.forEach(part => {
      if (!part) return;
      const partWidth = doc.getTextWidth(part);
      if (currentX + partWidth > pageWidth - margin && part.trim() !== "") {
        currentX = margin;
        y += lineHeight;
      }
      doc.text(part, currentX, y);
      currentX += partWidth;
    });
  });

  const { data: hearingSetData } = await supabase.from('tribunalhearingsethearing').select('*').eq('THSHHearingNo', hearingNo).maybeSingle();

  y += 15;
  doc.setFont('times', 'bold');
  const formattedDate = hearingSetData?.THSHToDate 
    ? new Date(hearingSetData.THSHToDate).toLocaleDateString('en-GB') 
    : new Date().toLocaleDateString('en-GB');
  doc.text(`Date: ${formattedDate}`, margin, y);
  y += 15;

  const sigYStart = y;
  const colWidth = (pageWidth - (margin * 2)) / 2;

  // Signatures Logic
  doc.line(margin, y, margin + 65, y);
  y += 5;
  doc.text(`${thoData.THOClaimant.toUpperCase()}   (Claimant)`, margin, y);
  y += 5;
  doc.setFont('times', 'normal'); doc.setFontSize(10);
  doc.text('(Signed by or on behalf of the worker)', margin, y);

  y = sigYStart;
  const rightCol = margin + colWidth + 5;
  if (orgType === 'State') {
    doc.line(rightCol, y, rightCol + 75, y);
    y += 5;
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    const solGen = hearingSetData?.THSHStateRep1 || 'EAVA GEITA';
    doc.text(`${solGen.toUpperCase()} (Acting Solicitor General)`, rightCol, y);
    y += 5; doc.text('INDEPENDENT STATE OF PNG', rightCol, y);
  } else {
    y += 5; doc.setFont('times', 'bold'); doc.setFontSize(11);
    doc.text('........................................................', rightCol, y);
    y += 5; doc.setFont('times', 'normal'); doc.setFontSize(10);
    doc.text('(Insurance/Legal Officer)', rightCol, y);
    y += 5; doc.setFont('times', 'bold'); doc.setFontSize(11);
    doc.text(orgName.toUpperCase(), rightCol, y);
  }
  y += 5;
  doc.setFont('times', 'normal'); doc.setFontSize(10);
  doc.text('(Signed by or on behalf of the Employer)', rightCol, y);

  y += 20;
  const witY = y;
  doc.setFontSize(11);
  doc.text('In the Presence of ........................................................', margin, y);
  y += 5;
  doc.setFont('times', 'bold');
  const clerk = hearingSetData?.THSHSeniorTribunalClerk || 'NANCY VAGI';
  doc.text(`${clerk.toUpperCase()}   (A/Snr Tribunal Clerk)`, margin, y);
  y += 5;
  doc.setFont('times', 'normal');
  doc.text('Office of Workers\' Compensation', margin, y);

  if (orgType === 'State') {
    y = witY;
    doc.text('In the Presence of ........................................................', rightCol, y);
    y += 5;
    doc.setFont('times', 'bold');
    const legalOff = hearingSetData?.THSHStateRep2 || 'ROY YOMILEWAU';
    doc.text(`${legalOff.toUpperCase()} - Legal Officer`, rightCol, y);
    y += 5;
    doc.setFont('times', 'normal');
    doc.text('Solicitor Generals\' Office', rightCol, y);
  }

  doc.save(`Form18-${f1112?.DisplayIRN || irn}.pdf`);
};

export const generateSingleROP = async (supabase: SupabaseClient, irn: string, hearingNo: string) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const logoUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/logocrest.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL2xvZ29jcmVzdC5wbmciLCJpYXQiOjE3NTI2MDg2MzEsImV4cCI6MjM4MzMyODYzMX0.cZ8Px1aDewyNCGugVA5WUNqSUGyu28LvfU5VfmR3jao';
  const stampUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Commissionstamp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbW1pc3Npb25zdGFtcC5wbmciLCJpYXQiOjE3NTQxNTA3MDIsImV4cCI6MjA2OTUxMDcwMn0.ET2gqM5ln9zbJbb5jH1gMHFz42HazTIoQ5s-BaUlADU';

  const { thoData, f1112, orgName } = await fetchTribunalPDFData(supabase, irn);
  if (!thoData) throw new Error('Outcome not found');

  let yPosition = 5;

  // Header Logo
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = () => { doc.addImage(img, 'PNG', (pageWidth - 25) / 2, yPosition, 25, 25); resolve(true); };
      img.onerror = () => resolve(true);
      img.src = logoUrl;
    });
    yPosition += 32;
  } catch (error) { yPosition += 10; }

  const { data: shData } = await supabase.from('tribunalhearingsethearing').select('*').eq('THSHHearingNo', hearingNo).maybeSingle();

  doc.setFontSize(12); doc.setFont('times', 'bold');
  doc.text('PAPUA NEW GUINEA', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 6;
  doc.setFontSize(14); doc.text('WORKERS COMPENSATION TRIBUNAL', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 12;

  doc.setFontSize(14); doc.setTextColor(200, 0, 0);
  doc.text('RECORD OF PROCEEDINGS (ROP)', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 12;
  
  doc.setFontSize(12); doc.setTextColor(0, 0, 0);
  doc.text(thoData.THOClaimant.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' }); yPosition += 6;
  doc.text('(CLAIMANT)', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 10;
  doc.text(orgName.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' }); yPosition += 6;
  doc.text('(EMPLOYER/INSURER)', pageWidth / 2, yPosition, { align: 'center' }); yPosition += 12;

  doc.setFont('times', 'normal'); doc.setFontSize(10);
  doc.text(`FILE REF: CRN: ${f1112?.DisplayIRN || irn}`, margin, yPosition); yPosition += 5;
  if (shData) {
    const hDate = shData.THSHFromDate ? new Date(shData.THSHFromDate).toLocaleDateString('en-GB') : 'N/A';
    doc.text(`HEARING: ${hDate} AT ${shData.THSHLocation || 'TRIBUNAL HEARING ROOM'}`, margin, yPosition);
  }
  yPosition += 10;

  doc.setFont('times', 'bold'); doc.text('CORAM', margin, yPosition); yPosition += 6;
  doc.setFont('times', 'normal');
  if (shData?.THSHTribunalChair) {
    doc.text(`${shData.THSHTribunalChair.toUpperCase()} (COMMISSIONER, OWC)`, margin, yPosition); yPosition += 5;
  }
  doc.setFont('times', 'bold'); doc.text('TRIBUNAL CHAIR', margin, yPosition); yPosition += 10;

  if (shData?.THSHClaimantRep1) {
    doc.text(`${shData.THSHClaimantRep1.toUpperCase()} (REGISTRAR OWC)`, margin, yPosition); yPosition += 6;
  }
  doc.text('REPRESENTING THE CLAIMANT', margin, yPosition); yPosition += 15;

  if (shData?.THSHStateRep1) {
    doc.text(`${shData.THSHStateRep1.toUpperCase()} (SENIOR LEGAL OFFICER, SGD)`, margin, yPosition); yPosition += 6;
  }
  if (shData?.THSHStateRep2) {
    doc.text(`${shData.THSHStateRep2.toUpperCase()} (LEGAL OFFICER, SGD)`, margin, yPosition); yPosition += 6;
  }
  doc.text('REPRESENTING THE STATE', margin, yPosition); yPosition += 15;

  if (shData?.THSHObserver1) {
    doc.text(`${shData.THSHObserver1.toUpperCase()} (A/S ADMINISTRATION, CORPORATE SERVICE, DEPARTMENT OF FINANCE)`, margin, yPosition); yPosition += 6;
    doc.text('OBSERVER', margin, yPosition); yPosition += 15;
  }

  if (shData?.THSHTribunal1) {
    doc.text(`${shData.THSHTribunal1.toUpperCase()} (SENIOR TRIBUNAL OFFICER)`, margin, yPosition); yPosition += 6;
  }
  if (shData?.THSHTribunal2) {
    doc.text(`${shData.THSHTribunal2.toUpperCase()} (TRIBUNAL OFFICER)`, margin, yPosition); yPosition += 6;
  }
  doc.text('TRIBUNAL', margin, yPosition); yPosition += 15;

  if (shData?.THSHOfficerAssistTribunal1) {
    doc.setFont('times', 'normal');
    doc.text(`${shData.THSHOfficerAssistTribunal1.toUpperCase()} (A/CLAIMS MANAGER-MOMASE REGION)`, margin, yPosition); yPosition += 6;
    doc.setFont('times', 'bold'); doc.text('OFFICER ASSISTING THE TRIBUNAL', margin, yPosition); yPosition += 15;
  }

  doc.setFont('times', 'bold'); doc.text('DECISION:', margin, yPosition); yPosition += 8;
  doc.setFont('times', 'normal');
  const dTxt = thoData?.THOReason || thoData?.THODecision || 'N/A';
  if (thoData?.THODecision === 'Consented' && !thoData?.THOReason) {
    doc.text('Within time', margin, yPosition); yPosition += 6;
    doc.text('Liability accepted', margin, yPosition); yPosition += 6;
    if (thoData?.THOConfirmedAmount) {
      const cTxt = `Consented @ K${Number(thoData.THOConfirmedAmount).toLocaleString()} (Inclusive of K200 medical expenses) 35% loss of efficient use of left lower limb.`;
      const cLines = doc.splitTextToSize(cTxt, pageWidth - (margin * 2));
      doc.text(cLines, margin, yPosition); yPosition += cLines.length * 6;
    }
  } else {
    const dLines = doc.splitTextToSize(dTxt, pageWidth - (margin * 2));
    doc.text(dLines, margin, yPosition); yPosition += dLines.length * 6 + 10;
  }

  if (yPosition + 50 > pageHeight - margin) { doc.addPage(); yPosition = margin + 20; }
  else { yPosition = Math.max(yPosition + 10, pageHeight - 65); }

  doc.setFont('times', 'bold');
  if (shData?.THSHTribunalChair) {
    doc.text(shData.THSHTribunalChair.toUpperCase(), margin, yPosition); yPosition += 6;
  }
  doc.text('TRIBUNAL CHAIR', margin, yPosition); yPosition += 12;
  doc.text(`DATED: ${thoData?.THODOA ? formatSuffixDate(thoData.THODOA) : formatSuffixDate(new Date())}`, margin, yPosition);

  const sealX = pageWidth - 65, sealY = yPosition - 20;
  try {
    const sImg = new Image();
    sImg.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      sImg.onload = () => { doc.addImage(sImg, 'PNG', sealX - 25, sealY - 25, 55, 55); resolve(true); };
      sImg.onerror = () => resolve(true);
      sImg.src = stampUrl;
    });
  } catch (e) {}

  doc.save(`ROP-${f1112?.DisplayIRN || irn}.pdf`);
};

export const generateSingleConsentLetter = async (supabase: SupabaseClient, irn: string, hearingNo: string, decision: 'Consented' | 'Adjourned' | 'Dismissed') => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  const logoUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/logocrest.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL2xvZ29jcmVzdC5wbmciLCJpYXQiOjE3NTI2MDg2MzEsImV4cCI6MjM4MzMyODYzMX0.cZ8Px1aDewyNCGugVA5WUNqSUGyu28LvfU5VfmR3jao';

  const { thoData, f1112, finalWorkerAddr } = await fetchTribunalPDFData(supabase, irn);
  const { data: shData } = await supabase.from('tribunalhearingsethearing').select('*').eq('THSHHearingNo', hearingNo).maybeSingle();

  let y = 15;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = () => { doc.addImage(img, 'PNG', (pageWidth - 25) / 2, y, 25, 25); resolve(true); };
      img.onerror = () => resolve(true);
      img.src = logoUrl;
    });
    y += 32;
  } catch (e) { y += 10; }

  doc.setFontSize(10); doc.setFont('times', 'bold'); doc.setTextColor(0, 0, 0);
  doc.text('PAPUA NEW GUINEA', pageWidth / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(12);
  doc.text('WORKERS COMPENSATION TRIBUNAL', pageWidth / 2, y, { align: 'center' }); y += 15;

  doc.setFontSize(14); doc.setTextColor(200, 0, 0);
  let title = 'CONSENT CLAIM - COVER LETTER';
  if (decision === 'Adjourned') title = 'ADJOURN CLAIM - COVER LETTER';
  if (decision === 'Dismissed') title = 'DISMISS CLAIM - COVER LETTER';
  doc.text(title, pageWidth / 2, y, { align: 'center' }); y += 20;

  doc.setFontSize(11); doc.setTextColor(0, 0, 0); doc.setFont('times', 'bold');
  doc.text(`DATE: ${formatSuffixDate(new Date())}`, margin, y); y += 6;
  doc.text(`REF: ${f1112?.DisplayIRN || irn}`, margin, y); y += 15;

  doc.text(thoData?.THOClaimant || 'N/A', margin, y); y += 6;
  doc.setFont('times', 'normal');
  const workerAddrLines = doc.splitTextToSize(finalWorkerAddr, pageWidth - margin * 2);
  doc.text(workerAddrLines, margin, y); y += (workerAddrLines.length * 6) + 12;

  const firstName = thoData?.THOClaimant ? thoData.THOClaimant.split(' ')[0] : 'Claimant';
  doc.text(`Dear ${firstName},`, margin, y); y += 10;
  doc.setFont('times', 'bold');
  doc.text(decision === 'Dismissed' ? 'Subject: Tribunal Decision' : 'Subject: Workers Compensation Tribunal Decision', margin, y); y += 10;

  doc.setFont('times', 'normal');
  const hDateStr = shData?.THSHFromDate ? formatSuffixDate(shData.THSHFromDate) : 'recently';
  const venue = shData?.THSHVenue || 'Port Moresby';
  const loc = shData?.THSHLocation || 'NCDC';

  let bodies: string[] = [];
  if (decision === 'Consented') {
    bodies = [
      `I am writing to inform you that your workers' compensation claim was heard during the recent Workers Compensation Tribunal Hearing, which took place in ${venue}, ${loc}, on ${hDateStr}.`,
      `The State has accepted liability and, accordingly, has consented to your claim, as documented in the attached Record of Proceedings (ROP). Kindly review and sign the attached Form 18 and return it to our office at your earliest convenience.`,
      `Should you require any further information or assistance, please do not hesitate to contact our office or your nearest Provincial Labour Office.`
    ];
  } else if (decision === 'Adjourned') {
    bodies = [
      `I am writing to inform you that your workers' compensation claim was heard during the recent Workers Compensation Tribunal Hearing, which took place in ${venue}, ${loc}, on ${hDateStr}.`,
      `The Tribunal has adjourned your claim, as detailed in the attached Record of Proceedings (ROP).`,
      `If you require further information or assistance, please do not hesitate to contact our office or visit the nearest Provincial Labour Office.`
    ];
  } else {
    bodies = [
      `We refer to your workers' compensation claim, which was reviewed during the recent Workers' Compensation Tribunal Hearing held in ${venue}, ${loc}, on ${hDateStr}.`,
      `Following the tribunal’s deliberation, the State has denied liability, and your claim has been dismissed. The reasons for this decision are outlined in the attached Record of Proceedings (ROP).`,
      `Should you wish to appeal the tribunal’s decision, you may do so by filing an appeal with the National Court within 30 days from the date of receipt of this letter.`
    ];
  }

  bodies.forEach(b => {
    const lines = doc.splitTextToSize(b, pageWidth - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 6 + 6;
  });

  y += 10;
  doc.text('Yours faithfully,', margin, y); y += 15;
  doc.setFont('times', 'bold');
  doc.text('Ms. Louisa Pambel', margin, y); y += 6;
  doc.text('Registrar', margin, y);

  doc.save(`${decision}-Cover-Letter-${f1112?.DisplayIRN || irn}.pdf`);
};

/**
 * Generates the "Cover Letter to Solgen for Hearing" based on the provided image.
 * VERBATIM text for Solgen.
 */
export const generateSolgenHearingLetter = async (
  formData: any, 
  claimsCount: number,
  logoUrl?: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 25;
  const pageWidth = 210;
  let y = 15;

  // 1. Logo (Robust asycn loading)
  if (logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        img.onload = () => {
          doc.addImage(img, 'PNG', (pageWidth - 25) / 2, y, 25, 25);
          resolve(true);
        };
        img.onerror = () => resolve(true);
        img.src = logoUrl;
      });
    y += 32;
  } catch (e) {
    console.error('Error loading logo for Solgen letter:', e);
  }
}
y = 15 + 32; // Reset y based on start + spacing

  // 2. Heading
  doc.setFont('times', 'bold');
  doc.setFontSize(10); doc.setTextColor(0, 0, 0);
  doc.text('PAPUA NEW GUINEA', pageWidth / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(12);
  doc.text('WORKERS COMPENSATION TRIBUNAL', pageWidth / 2, y, { align: 'center' }); y += 15;

  doc.setTextColor(200, 0, 0);
  doc.setFontSize(14);
  const title = 'COVER LETTER TO SOLGEN FOR HEARING';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 25;

  // 3. Reset Text Color & Font
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('times', 'bold');

  // Date
  const currentFullDate = formatSuffixDate(new Date().toISOString());
  doc.text(currentFullDate, margin, y); y += 10;

  // Recipient
  doc.setFont('times', 'normal');
  const recipient = [
    'The Solicitor General',
    'Department of Justice & Attorney General',
    'PO Box 591',
    'Waigani',
    'National Capital District'
  ];
  doc.text(recipient, margin, y); y += 35;

  // Dear...
  doc.text('Dear Solicitor General,', margin, y); y += 10;

  // Subject
  const currentYear = new Date().getFullYear();
  doc.setFont('times', 'bold');
  const subject = `Subject: Request for State Counsel Representation \u2013 ${currentYear} Workers' Compensation State Tribunal Hearing`;
  const splitSubject = doc.splitTextToSize(subject, pageWidth - margin * 2);
  doc.text(splitSubject, margin, y); y += (splitSubject.length * 6) + 6;

  // Body
  doc.setFont('times', 'normal');
  const hFromDate = formData.THSHFromDate ? formatSuffixDate(new Date(formData.THSHFromDate).toISOString()) : '[Hearing From Date]';
  const hToDate = formData.THSHToDate ? formatSuffixDate(new Date(formData.THSHToDate).toISOString()) : '[Hearing To Date]';
  const venue = formData.THSHVenue || '[Venue]';
  const location = formData.THSHLocation || '[Location]';

  const body1 = `I am writing to formally request the assignment of one (1) State Counsel to represent the State at the upcoming Workers' Compensation State Tribunal Hearing, scheduled to take place from ${hFromDate} to ${hToDate}, in ${venue}, ${location} Province.`;
  const body2 = `Your support in assigning legal representation for this matter would be greatly appreciated.`;
  const body3 = `Should you require any further details, please feel free to contact our Tribunal Clerk, Ms. Nancy Vagi, at nvagi@owc.gov.pg, or me directly at ckolias@owc.gov.pg.`;
  const body4 = `For your reference and record, I have attached the final listing of ${claimsCount} claims to be considered during this hearing.`;
  const body5 = `We sincerely appreciate your assistance and look forward to your favorable response.`;

  const bodies = [body1, body2, body3, body4, body5];

  bodies.forEach(body => {
    const splitText = doc.splitTextToSize(body, pageWidth - margin * 2);
    doc.text(splitText, margin, y);
    y += (splitText.length * 6) + 6;
  });

  y += 10;
  doc.text('Yours faithfully,', margin, y);
  y += 15;
  doc.setFont('times', 'bold');
  doc.text('Chris Kolias LLB', margin, y); y += 6;
  doc.text('Chairman', margin, y); y += 6;
  doc.text("Workers' Compensation State Tribunal", margin, y);

  doc.save(`Solgen_Hearing_Letter_${formData.THSHHearingNo || 'Draft'}.pdf`);
};

/**
 * Generates the "Cover Letter to Solgen for Form 18 Endorsement" based on the provided image.
 * VERBATIM text for Solgen.
 */
export const generateSolgenEndorsementLetter = async (
  logoUrl?: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 25;
  const pageWidth = 210;
  let y = 15;

  // 1. Logo (Robust async loading)
  if (logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        img.onload = () => {
          doc.addImage(img, 'PNG', (pageWidth - 25) / 2, y, 25, 25);
          resolve(true);
        };
        img.onerror = () => resolve(true);
        img.src = logoUrl;
      });
      y += 32;
    } catch (e) {
      console.error('Error loading logo for Solgen letter:', e);
      y += 10;
    }
  } else {
    y += 10;
  }
  
  // Standard y reset if logo was at y=15
  y = 15 + 32;

  // 2. Heading
  doc.setFont('times', 'bold');
  doc.setFontSize(10); doc.setTextColor(0, 0, 0);
  doc.text('PAPUA NEW GUINEA', pageWidth / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(12);
  doc.text('WORKERS COMPENSATION TRIBUNAL', pageWidth / 2, y, { align: 'center' }); y += 15;

  doc.setTextColor(200, 0, 0);
  doc.setFontSize(14);
  const title = 'COVER LETTER TO SOLGEN FOR FORM 18 ENDORSEMENT';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 25;

  // 3. Reset Text Color & Font
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('times', 'bold');

  // Date
  const currentFullDate = formatSuffixDate(new Date().toISOString());
  doc.text(currentFullDate, margin, y); y += 10;

  // Recipient
  doc.setFont('times', 'normal');
  const recipient = [
    'The Solicitor General',
    'Department of Justice & Attorney General',
    'PO Box 591',
    'Waigani',
    'National Capital District'
  ];
  doc.text(recipient, margin, y); y += 35;

  // Dear...
  doc.text('Dear Solicitor General,', margin, y); y += 10;

  // Subject
  doc.setFont('times', 'bold');
  const subject = `Subject: Workers' Compensation Consented Claims & Form 18 Endorsement`;
  const splitSubject = doc.splitTextToSize(subject, pageWidth - margin * 2);
  doc.text(splitSubject, margin, y); y += (splitSubject.length * 6) + 6;

  // Body
  doc.setFont('times', 'normal');
  const body1 = `I would like to take this opportunity to extend our appreciation to your office for assigning a legal officer to represent the State in the recent Workers' Compensation (WC) State Tribunal Hearing.`;
  const body2 = `As a result of the hearing, please find attached the listing of WC Consented Claims that were addressed during the recent Tribunal session.`;
  const body3 = `Kindly note that the endorsement of the Form 18s will be processed as a single batch of claims. Therefore, we respectfully request your endorsement on the Form 18s, following the advice and verification from your State Counsel who attended the hearing.`;
  const body4 = `Should you require any further information or clarification, please do not hesitate to contact our Tribunal Clerk, Ms. Nancy Vagi, at nvagi@owc.gov.pg, or alternatively, you may contact me directly at lpambel@owc.gov.pg`;
  const body5 = `We greatly appreciate your ongoing support and cooperation in this matter.`;

  const bodies = [body1, body2, body3, body4, body5];

  bodies.forEach(body => {
    const splitText = doc.splitTextToSize(body, pageWidth - margin * 2);
    doc.text(splitText, margin, y);
    y += (splitText.length * 6) + 6;
  });

  y += 10;
  doc.text('Yours faithfully,', margin, y);
  y += 15;
  doc.setFont('times', 'bold');
  doc.text('Ms. Louisa Pambel', margin, y); y += 6;
  doc.text('Registrar', margin, y);

  doc.save(`Solgen_Form18_Endorsement_Letter_${new Date().getFullYear()}.pdf`);
};
