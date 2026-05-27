// /src/utils/ConsentOfAward-Injury.ts
// Requires: npm i jspdf
import { jsPDF } from "jspdf";
import { supabase } from "../services/supabase";

const COMM_SIGN =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Comsignature.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbXNpZ25hdHVyZS5wbmciLCJpYXQiOjE3NTQxNTA4ODAsImV4cCI6MjA2OTUxMDg4MH0.R4wqJdga2M1RJZ1uxxG_0VgeFd-66fHIT9sscQGgYeE'
const COMM_STAMP =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Commissionstamp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbW1pc3Npb25zdGFtcC5wbmciLCJpYXQiOjE3NTQxNTA3MDIsImV4cCI6MjA2OTUxMDcwMn0.ET2gqM5ln9zbJbb5jH1gMHFz42HazTIoQ5s-BaUlADU'
const CHIEFCOMM_SIGN =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/commsign.png'
const CHIEFCOMM_STAMP =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/ChiefCommissioner.png'

// Helper: fetch an image and return base64 (works for same-origin or CORS-enabled URLs)
async function fetchImgAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve((fr.result as string) || null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addWatermark(doc: jsPDF) {
  doc.setFont("times", "bold");
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  // "ORIGINAL" diagonally across the page
  doc.text("O R I G I N A L", 150, 500, { angle: 45 });
  // restore text color to normal for content
  doc.setTextColor(0, 0, 0);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDateDMY(dateStr?: string | null): { day: string; month: string; year: string } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const day = ordinal(d.getDate());
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = `${d.getFullYear()}`;
  return { day, month, year };
}

function K(amount?: number | null): string {
  const val = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return val.toLocaleString("en-PG", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

export async function downloadConsentOfAwardInjury(
  IRN: string,
  opts?: {
    crestUrl?: string;            // crest logo URL (optional)
    includeSignature?: boolean;   // when true, add stamp/signature images to both pages
    signatureUrl?: string;        // signature image URL
    stampUrl?: string;            // stamp image URL
  }
) {
  // ---------- 1) Load data (mirror of the PHP) ----------
  const irn = IRN;

  // Form1112Master
  const { data: f1112, error: e1112 } = await supabase
    .from("form1112master")
    .select("DisplayIRN, IncidentDate, IncidentProvince, WorkerID")
    .eq("IRN", irn)
    .maybeSingle();
  if (e1112) throw e1112;

  const displayIRN = f1112?.DisplayIRN ?? "";
  const incidentDate = f1112?.IncidentDate ?? null;
  const incidentProvince = f1112?.IncidentProvince ?? "";
  const workerId = f1112?.WorkerID;

  // ClaimsAwardedCommissionersReview
  const { data: cacr, error: ecacr } = await supabase
    .from("claimsawardedcommissionersreview")
    .select("ClaimType, CACRDecisionDate, CACRReviewStatus")
    .eq("IRN", irn)
    .maybeSingle();
  if (ecacr) throw ecacr;

  const claimType = cacr?.ClaimType ?? "";
  const decisionDate = cacr?.CACRDecisionDate ?? null;
  const decisionStatus = cacr?.CACRReviewStatus ?? "";

  // ClaimCompensationWorkerDetails
  const { data: ccwd, error: eccwd } = await supabase
    .from("claimcompensationworkerdetails")
    .select("CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions")
    .eq("IRN", irn)
    .maybeSingle();
  if (eccwd) throw eccwd;

  const compensationAmount =
    (Number(ccwd?.CCWDCompensationAmount) || 0) +
    (Number(ccwd?.CCWDMedicalExpenses) || 0) +
    (Number(ccwd?.CCWDMiscExpenses) || 0) -
    (Number(ccwd?.CCWDDeductions) || 0);

  // WorkerPersonalDetails
  let workerName = "", workerAddress = "";
  if (workerId) {
    const { data: wpd, error: ewpd } = await supabase
      .from("workerpersonaldetails")
      .select("WorkerFirstName, WorkerLastName, WorkerPlaceOfOriginVillage, WorkerPlaceOfOriginDistrict, WorkerPlaceOfOriginProvince")
      .eq("WorkerID", workerId)
      .maybeSingle();
    if (ewpd) throw ewpd;

    workerName = `${(wpd?.WorkerFirstName || "").toString().toUpperCase()} ${(wpd?.WorkerLastName || "").toString().toUpperCase()}`.trim();
    workerAddress = `${(wpd?.WorkerPlaceOfOriginVillage || "").toString().toUpperCase()} VILLAGE, ${(wpd?.WorkerPlaceOfOriginDistrict || "").toString().toUpperCase()} DISTRICT, ${(wpd?.WorkerPlaceOfOriginProvince || "").toString().toUpperCase()} PROVINCE`;
  }

  // Employer (via CurrentEmploymentDetails)
  let employerCPPSID: string | null = null;
  if (workerId) {
    const { data: ced, error: eced } = await supabase
      .from("currentemploymentdetails")
      .select("EmployerCPPSID")
      .eq("WorkerID", workerId)
      .maybeSingle();
    if (eced) throw eced;
    employerCPPSID = ced?.EmployerCPPSID ?? null;
  }

  let employerName = "", employerAddress = "", insuranceProviderIPACode: string | null = null;
  if (employerCPPSID) {
    const { data: em, error: eem } = await supabase
      .from("employermaster")
      .select("OrganizationName, Address1, Address2, City, Province, POBox, InsuranceProviderIPACode")
      .eq("CPPSID", employerCPPSID)
      .maybeSingle();
    if (eem) throw eem;

    employerName = (em?.OrganizationName || "").toString().toUpperCase();
    employerAddress = [
      em?.Address1, em?.Address2, em?.City, em?.Province, em?.POBox ? `P.O. BOX ${em.POBox}` : ""
    ]
      .filter(Boolean)
      .join(", ")
      .toUpperCase();
    insuranceProviderIPACode = em?.InsuranceProviderIPACode ?? null;
  }

  // InsuranceCompany
  let insuranceCompanyName = "";
  if (insuranceProviderIPACode) {
    const { data: icm, error: eicm } = await supabase
      .from("insurancecompanymaster")
      .select("InsuranceCompanyOrganizationName")
      .eq("IPACODE", insuranceProviderIPACode)
      .maybeSingle();
    if (eicm) throw eicm;
    insuranceCompanyName = (icm?.InsuranceCompanyOrganizationName || "").toString().toUpperCase();
  }
  if (!insuranceCompanyName || insuranceCompanyName === "SELF") {
    insuranceCompanyName = employerName;
  }


  //-------------

  const cacrStatus = (cacr?.CACRReviewStatus || "").trim();

  let chosenSignUrl: string | null = null;
  let chosenStampUrl: string | null = null;

  if (cacrStatus === "ChiefCommissionerAccepted") {
    chosenSignUrl = CHIEFCOMM_SIGN;
    chosenStampUrl = CHIEFCOMM_STAMP;
  } else if (cacrStatus === "CommissionerAccepted") {
    chosenSignUrl = COMM_SIGN;
    chosenStampUrl = COMM_STAMP;
  } else {
    // fallback to any explicit overrides passed from UI
    chosenSignUrl = opts?.signatureUrl ?? null;
    chosenStampUrl = opts?.stampUrl ?? null;
  }


  // ---------- 2) Prepare images once ----------
  const crestB64 = opts?.crestUrl ? await fetchImgAsBase64(opts.crestUrl) : null;

  let sigB64: string | null = null;
  let stampB64: string | null = null;
  if (opts?.includeSignature) {
    if (chosenSignUrl) sigB64 = await fetchImgAsBase64(chosenSignUrl);
    if (chosenStampUrl) stampB64 = await fetchImgAsBase64(chosenStampUrl);
  }

  // ---------- 3) Build the PDF ----------
  // A4: 595 x 842 pt
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 40;

  // helper to place crest at top of the page
  const drawCrest = () => {
    if (crestB64) doc.addImage(crestB64, "PNG", 270, 30, 80, 80);
  };

  // helper to place stamp + signature at bottom-right
  const drawSignatures = () => {
    if (!(opts?.includeSignature)) return;
    // Stamp first, then signature slightly below/right
    if (stampB64) doc.addImage(stampB64, "PNG", 340, 480, 120, 120);
    if (sigB64) doc.addImage(sigB64, "PNG", 375, 520, 100, 80);
  };

  // ---------- Page 1 ----------
  drawCrest();
  addWatermark(doc);

  // Headers
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("PAPUA NEW GUINEA", 297.5, 120, { align: "center" });
  doc.text("WORKERS COMPENSATION TRIBUNAL", 297.5, 160, { align: "center" });
  doc.setFontSize(14);
  doc.text(
    "CONSENT AWARD IN THE CASE OF SPECIFIED INJURIES TO WORKER",
    297.5,
    190,
    { align: "center" }
  );

  // Body
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(
    "This Award is issued pursuant to the Workers Compensation Act 1978 (as consolidated).",
    left,
    225
  );
  doc.text(`Claim No.      ${displayIRN}`, left, 265);

  doc.setFont("times", "bold");
  doc.text("The Parties", left, 295);
  doc.setFont("times", "normal");
  doc.text("Injured Worker /", left, 320);
  doc.text(`Claimant : ${workerName}`, left, 333);
  doc.text(`Insurer : ${insuranceCompanyName} acting for and on behalf of`, left, 345);
  doc.text(`Employer : ${employerName}`, left, 357);

  doc.text("BEFORE A WORKERS COMPENSATION TRIBUNAL CONSISTING OF:", left, 395);
  doc.setFont("times", "bold");
  doc.text("The Tribunal", left, 427);
  doc.setFont("times", "normal");
  doc.text("Mr. Chris. Kolias.", left, 450);
  doc.text("As Chairman of the Tribunal", 400, 452, { align: "left" });
  doc.text("Commissioner", left, 462);
  doc.text("Office of Workers Compensation", left, 474);
  doc.text("Papua New Guinea", left, 486);

  doc.text(
    `Decision at WAIGANI on : ${decisionDate ? new Date(decisionDate).toISOString().slice(0, 10) : ""}`,
    left,
    520
  );

  // Bottom-right stamp + signature (Page 1)
  drawSignatures();

  // ---------- Page 2 ----------
  doc.addPage();
  drawCrest();
  addWatermark(doc);

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("PAPUA NEW GUINEA", 297.5, 120, { align: "center" });
  doc.text("WORKERS COMPENSATION TRIBUNAL", 297.5, 160, { align: "center" });
  doc.setFontSize(14);
  doc.text(
    "CONSENT AWARD IN THE CASE OF SPECIFIED INJURIES TO WORKER",
    297.5,
    190,
    { align: "center" }
  );

  doc.setFont("times", "normal");
  doc.setFontSize(11);

  const wrap = (txt: string, y: number) => {
    const lines = doc.splitTextToSize(txt, 500);
    doc.text(lines, left, y);
    return y + lines.length * 14;
  };

  let y = 225;
  y = wrap(
    "Wherefore, based on the foregoing findings of fact and pursuant to the law applicable thereto, the claim for worker's compensation under Papua New Guinea's Workers Compensation Act is hereby awarded as follows:",
    y
  );
  y += 10;
  y = wrap(
    "The Tribunal, after such investigation as it thinks proper, makes an award by consent of the Parties.",
    y
  );

  y += 10;
  y = wrap(
    `That the sum of K ${K(compensationAmount)} ("the Amount") be paid by the Insurer / Employer to the Office of Workers Compensation, being the Trustee of the Workers Compensation Fund on behalf of the Worker.`,
    y
  );

  y += 6;
  y = wrap(
    `That the Amount be redrawn and paid to Claimant by the Office of Workers Compensation in the manner outlined in the schedule of payment ("the Schedule") attached to the Award.`,
    y
  );

  y += 6;
  y = wrap(
    `That the Amount paid is full and final / an interim award of (cross out which is not applicable) compensation for the the specified injury or injuries sustained from or arising out of the employment on ${incidentDate ? new Date(incidentDate).toISOString().slice(0, 10) : ""}.`,
    y
  );

  y += 6;
  y = wrap(
    "The Tribunal hereby orders that payment be effected within 30 days from the date of the making of this Award, and that the payment be made to the claimant or claimants as the case may be, by an officer or representative of the Office of Workers Compensation.",
    y
  );

  y += 16;

  const dd = fmtDateDMY(decisionDate);
  doc.setFont("times", "bold");
  doc.text(
    `IT IS SO AWARDED, this the ${dd ? dd.day : ""} day of ${dd ? dd.month : ""}, ${dd ? dd.year : ""}.`,
    left,
    y
  );

  y += 50;
  doc.text("WORKERS COMPENSATION TRIBUNAL", left + 260, y);
  y += 70;

  // Signature line (always visible text)
  doc.setFont("times", "normal");
  doc.text("____________________________________", left + 260, y);
  y += 16;
  doc.setFont("times", "bold");
  doc.text("Chris Kolias", left + 320, y);
  y += 16;
  doc.text("CHAIRMAN OF TRIBUNAL /", left + 275, y);
  y += 16;
  doc.text("COMMISSIONER", left + 310, y);

  // Bottom-right stamp + signature (Page 2)
  drawSignatures();

  // ---------- 4) Save ----------
  const filename = `ConsentOfAward-Injury-${displayIRN || irn}.pdf`;
  doc.save(filename);
}
