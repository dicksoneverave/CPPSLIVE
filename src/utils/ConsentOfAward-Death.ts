// /src/utils/ConsentOfAward-Death.ts
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

/** Load an image (crest/stamp/signature) as base64 for jsPDF */
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
  doc.text("O R I G I N A L", 150, 500, { angle: 45 }); // diagonal
  doc.setTextColor(0, 0, 0);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDateLong(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${ordinal(d.getDate())} day of ${d.toLocaleString("en-US", { month: "long" })} ${d.getFullYear()}`;
}

/** very simple integer to words converter (en) for KINA text */
function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";
  const ones = ["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  const scales = ["","thousand","million","billion"];
  const chunk = (x:number) => {
    let str = "";
    const a = Math.floor(x / 100);
    const b = x % 100;
    if (a) str += ones[a] + " hundred";
    if (a && b) str += " and ";
    if (b < 20) str += ones[b];
    else {
      const t = Math.floor(b / 10);
      const o = b % 10;
      str += tens[t] + (o ? "-" + ones[o] : "");
    }
    return str.trim();
  };
  const words: string[] = [];
  let scaleIdx = 0;
  while (n > 0) {
    const c = n % 1000;
    if (c) {
      const part = chunk(c);
      words.unshift(part + (scales[scaleIdx] ? " " + scales[scaleIdx] : ""));
    }
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return words.join(" ").trim();
}

function K(amount?: number | null): string {
  const val = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return val.toLocaleString("en-PG", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

type DepChild = { name: string; dob?: string | null; gender?: string | null };

// Align rounding logic with CompensationBreakupDetailsView.tsx
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function downloadConsentOfAwardDeath(
  IRN: string,
  opts?: {
    crestUrl?: string;            // crest logo URL (optional)
    includeSignature?: boolean;   // when true, add stamp/signature images to both pages
    signatureUrl?: string;        // signature image URL
    stampUrl?: string;            // stamp image URL
  }
) {
  const irn = IRN;

  // ---------- Data ----------
  // 1. Fetch Form1112Master
  const { data: f1112, error: e1112 } = await supabase
    .from("form1112master")
    .select("DisplayIRN, IncidentProvince, IncidentDate, WorkerID")
    .eq("IRN", irn)
    .maybeSingle();
  if (e1112) throw e1112;

  const displayIRN = f1112?.DisplayIRN ?? "";
  const incidentProvince = f1112?.IncidentProvince ?? "";
  const incidentDate = f1112?.IncidentDate ?? null;
  const workerId = f1112?.WorkerID;

  // 2. Fetch ClaimType from Review
  const { data: cacr, error: ecacr } = await supabase
    .from("claimsawardedcommissionersreview")
    .select("ClaimType, CACRDecisionDate, CACRReviewStatus")
    .eq("IRN", irn)
    .maybeSingle();
  if (ecacr) throw ecacr;
  const claimType = cacr?.ClaimType ?? "";
  const decisionDate = cacr?.CACRDecisionDate ?? null;

  // 3. Fetch Compensation Details (including Med, Misc, and Deductions)
  const { data: ccwd, error: eccwd } = await supabase
    .from("claimcompensationworkerdetails")
    .select("CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions")
    .eq("IRN", irn)
    .maybeSingle();
  if (eccwd) throw eccwd;
  
  // NEW: Calculate comprehensive lump sum mirroring UI: (Base + Med + Misc - Deductions)
  const baseComp = Number(ccwd?.CCWDCompensationAmount) || 0;
  const medExp   = Number(ccwd?.CCWDMedicalExpenses) || 0;
  const miscExp  = Number(ccwd?.CCWDMiscExpenses) || 0;
  const deduct   = Number(ccwd?.CCWDDeductions) || 0;
  
  const lumpSum = round2(baseComp + medExp + miscExp - deduct);

  // 4. Fetch Weekly Rate from Dictionary (System Parameter)
  const { data: sysParams, error: sysErr } = await supabase
    .from('dictionary')
    .select('DKey, DValue')
    .eq('DType', 'SystemParameter');
  if (sysErr) throw sysErr;
  const weeklyRate = Number(sysParams?.find((p: any) => p.DKey === 'WeeklyCompensationPerChildDeath')?.DValue) || 0;

  // 5. Fetch Employer
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
    ].filter(Boolean).join(", ").toUpperCase();
    insuranceProviderIPACode = em?.InsuranceProviderIPACode ?? null;
  }

  let insuranceCompanyName = "";
  if (insuranceProviderIPACode) {
    const { data: ic, error: eic } = await supabase
      .from("insurancecompanymaster")
      .select("InsuranceCompanyOrganizationName")
      .eq("IPACODE", insuranceProviderIPACode)
      .maybeSingle();
    if (eic) throw eic;
    insuranceCompanyName = (ic?.InsuranceCompanyOrganizationName || "").toString().toUpperCase();
  }
  if (!insuranceCompanyName || insuranceCompanyName === "SELF") {
    insuranceCompanyName = employerName;
  }

  // 6. Fetch Worker
  let workerName = "", workerAddress = "", workerGender = "", spouseName = "";
  if (workerId) {
    const { data: wpd, error: ewpd } = await supabase
      .from("workerpersonaldetails")
      .select("WorkerFirstName, WorkerLastName, WorkerPlaceOfOriginVillage, WorkerPlaceOfOriginDistrict, WorkerPlaceOfOriginProvince, WorkerGender, SpouseFirstName, SpouseLastName")
      .eq("WorkerID", workerId)
      .maybeSingle();
    if (ewpd) throw ewpd;

    workerName = `${(wpd?.WorkerFirstName || "").toString().toUpperCase()} ${(wpd?.WorkerLastName || "").toString().toUpperCase()}`.trim();
    workerAddress = `${(wpd?.WorkerPlaceOfOriginVillage || "").toString().toUpperCase()} VILLAGE, ${(wpd?.WorkerPlaceOfOriginDistrict || "").toString().toUpperCase()} DISTRICT, ${(wpd?.WorkerPlaceOfOriginProvince || "").toString().toUpperCase()} PROVINCE`;
    workerGender = (wpd?.WorkerGender || "").toString().toUpperCase();
    const spFirst = (wpd?.SpouseFirstName || "").toString();
    const spLast = (wpd?.SpouseLastName || "").toString();
    if (spFirst || spLast) {
      const label = workerGender === "M" ? "Wife" : workerGender === "F" ? "Husband" : "Spouse";
      spouseName = `${spFirst} ${spLast}`.trim();
      if (spouseName) spouseName = `${spouseName} (${label})`;
    }
  }

  // 7. Dependents String
  let dependentsStr = spouseName ? spouseName + ", " : "";
  if (workerId) {
    const { data: deps, error: edeps } = await supabase
      .from("dependantpersonaldetails")
      .select("DependantFirstName, DependantLastName, DependantGender, DependantType")
      .eq("WorkerID", workerId);
    if (edeps) throw edeps;

    const role = (type?: string | null, gender?: string | null) => {
      const t = (type || "").toLowerCase();
      const g = (gender || "").toUpperCase();
      if (t === "child") return g === "M" ? "Son" : "Daughter";
      if (t === "sibling") return g === "M" ? "Brother" : "Sister";
      if (t === "parent") return g === "M" ? "Father" : "Mother";
      if (t === "nominee") return "Nominee";
      return (t || "Dependant");
    };

    const parts = (deps || []).map(d => {
      const name = `${(d.DependantFirstName || "").toString()} ${(d.DependantLastName || "").toString()}`.trim();
      return `${name}(${role(d.DependantType, d.DependantGender)})`;
    });

    dependentsStr += parts.join(", ");
    dependentsStr = dependentsStr.replace(/,\s*$/, "");
  }

  // 8. Children Awards
  let children: DepChild[] = [];
  if (workerId) {
    const { data: kids, error: ekids } = await supabase
      .from("dependantpersonaldetails")
      .select("DependantFirstName, DependantLastName, DependantDOB, DependantGender, DependantType")
      .eq("WorkerID", workerId)
      .eq("DependantType", "Child");
    if (ekids) throw ekids;
    children = (kids || []).map(k => ({
      name: `${(k.DependantFirstName || "").toString()} ${(k.DependantLastName || "").toString()}`.trim(),
      dob: k.DependantDOB,
      gender: k.DependantGender
    }));
  }

  const incident = incidentDate ? new Date(incidentDate) : null;
  type ChildAward = {
    name: string;
    genderWord: "Son" | "Daughter";
    amount: number;
    dob?: string | null;
  };

  const childAwards: ChildAward[] = [];
  let totalAmountForChildren = 0;

  for (const ch of children) {
    const genderWord = (ch.gender || "").toUpperCase() === "M" ? "Son" : "Daughter";
    let amount = 0;

    if (incident && ch.dob) {
      const dob = new Date(ch.dob);
      if (!Number.isNaN(dob.getTime())) {
        const sixteen = new Date(dob);
        sixteen.setFullYear(sixteen.getFullYear() + 16);
        const daysUntil16 = Math.max(0, Math.round((sixteen.getTime() - incident.getTime()) / 86400000));
        const weeksUntil16 = Math.max(0, Number((daysUntil16 / 7).toFixed(3)));
        amount = round2(weeklyRate * weeksUntil16);
      }
    }

    childAwards.push({ name: ch.name, genderWord, amount, dob: ch.dob });
    totalAmountForChildren += amount;
  }

  const grandTotal = lumpSum + totalAmountForChildren;

  // 9. Signatures
  const cacrStatus = (cacr?.CACRReviewStatus || "").trim();
  let chosenSignUrl: string | null = null;
  let chosenStampUrl: string | null = null;
  if (cacrStatus === "ChiefCommissionerAccepted") {
    chosenSignUrl  = CHIEFCOMM_SIGN;
    chosenStampUrl = CHIEFCOMM_STAMP;
  } else if (cacrStatus === "CommissionerAccepted") {
    chosenSignUrl  = COMM_SIGN;
    chosenStampUrl = COMM_STAMP;
  } else {
    chosenSignUrl  = opts?.signatureUrl ?? null;
    chosenStampUrl = opts?.stampUrl ?? null;
  }

  const crestB64 = opts?.crestUrl ? await fetchImgAsBase64(opts.crestUrl) : null;
  let sigB64: string | null = null;
  let stampB64: string | null = null;
  if (opts?.includeSignature) {
    if (chosenSignUrl)  sigB64   = await fetchImgAsBase64(chosenSignUrl);
    if (chosenStampUrl) stampB64 = await fetchImgAsBase64(chosenStampUrl);
  }

  // 10. PDF Drawing
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 40;

  const drawCrest = () => { if (crestB64) doc.addImage(crestB64, "PNG", 270, 30, 80, 80); };
  const drawSignatures = () => {
    if (!opts?.includeSignature) return;
    if (stampB64) doc.addImage(stampB64, "PNG", 390, 640, 120, 120);
    if (sigB64)   doc.addImage(sigB64,   "PNG", 425, 700, 100,  40);
  };
  const wrap = (txt: string, y: number, width = 500) => {
    const lines = doc.splitTextToSize(txt, width);
    doc.text(lines, left, y);
    return y + lines.length * 14;
  };

  // --- Page 1 ---
  drawCrest();
  addWatermark(doc);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("PAPUA NEW GUINEA", 297.5, 120, { align: "center" });
  doc.text("PROCEEDINGS BEFORE A WORKER'S COMPENSATION TRIBUNAL", 297.5, 138, { align: "center" });
  doc.setFont("times", "bolditalic");
  doc.text("ESTABLISHED UNDER THE WORKER'S COMPENSATION ACT CH. 179 (11)", 297.5, 156, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  {
    const xLeft = 102;
    const width = 360;
    const startY = 190;
    const txt1 = `In the matter of an application for Worker's Compensation Claim Registration No. ${displayIRN} (Notice of death: ${incidentProvince}) by ${spouseName ? spouseName + ", " : ""}${dependentsStr} are all dependant of the deceased worker Late ${workerName} of ${workerAddress}`;
    const lines1 = doc.splitTextToSize(txt1, width);
    doc.text(lines1, xLeft, startY);
    doc.setFont("times", "italic");
    doc.text("(CLAIMANT)", xLeft, startY + lines1.length * 12 + 12);
    doc.setFont("times", "normal");
    const txt2 = `${insuranceCompanyName} acting for and on behalf of ${employerName} the employer of ${employerAddress}`;
    const lines2 = doc.splitTextToSize(txt2, width);
    const y2 = startY + lines1.length * 12 + 36;
    doc.text(lines2, xLeft, y2);
    doc.setFont("times", "italic");
    doc.text("(RESPONDENT)", xLeft, y2 + lines2.length * 12 + 12);
    doc.setFont("times", "normal");

    let yCur = y2 + lines2.length * 20 + 36;
    doc.setFont("times", "bold");
    doc.text("BEFORE A WORKER'S COMPENSATION TRIBUNAL CONSISTING OF:", left + 65, yCur);
    yCur += 40;
    if (claimType === "StateInsured") {
      doc.text("Mr. Chris Kolias", left + 65, yCur);
      doc.text("Commissioner", left + 250, yCur);
      yCur += 14;
      doc.text("Chairman Of Tribunal", left + 250, yCur);
    } else {
      doc.text("Mr. Martin Pala", left + 65, yCur);
      doc.text("Chief Commissioner", left + 300, yCur);
      yCur += 14;
      doc.text("Chairman Of Tribunal", left + 300, yCur);
    }
    yCur += 22;
    doc.setFont("times", "normal");
    doc.text("Decision at Port Moresby", left + 300, yCur);
    yCur += 14;
    doc.text(`On the ${fmtDateLong(decisionDate) || " "}`, left + 300, yCur);
  }
  drawSignatures();

  // --- Page 2 ---
  doc.addPage();
  drawCrest();
  addWatermark(doc);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("CONSENT AWARD", 297.5, 120, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  let yPos = 150;
  doc.text("1. ", left, yPos);
  yPos = wrap(`     This Award applies to ${dependentsStr.toUpperCase()} are all the dependant of LATE ${workerName} deceased worker of ${workerAddress} and ${insuranceCompanyName} acting for and on behalf of ${employerName} the employer of ${employerAddress}`, yPos, 500);

  yPos += 10;
  doc.text("2.", left, yPos);
  yPos = wrap("     The Tribunal having considered the Application for Compensation filed before it by the Applicant and all materials placed before it, makes the following Award:-", yPos, 500);

  yPos += 10;
  doc.text("2.1.1", left + 12, yPos);
  
  // Recalculate word form with cents consideration (Math.round for words, K() for numerical)
  const totalWords = numberToWords(Math.round(grandTotal)).toUpperCase();
  
  yPos = wrap(`               That the sum of ${totalWords} KINA (K ${K(grandTotal)}); - is made up of Total Final Lump Sum of K ${K(lumpSum)} on death and K ${K(totalAmountForChildren)} Being weekly benefit due for the period from ????? to ????? and is to be paid in full and final of this claim in the following manner.`, yPos, 460);

  yPos += 10;
  doc.text("2.1.2", left + 12, yPos);
  let clauseTxt = `               ${spouseName || "Nominal Dependant"} to receive K ${K(lumpSum)} Total Final Lump Sum as the nominal dependent and to distribute accordingly as per clauses.`;
  if (childAwards.length) {
    const refs = childAwards.map((_, i) => `3.1.${i + 1}`).join(", ");
    clauseTxt += ` ${refs}.`;
  }
  yPos = wrap(clauseTxt, yPos, 460);

  yPos += 10;
  doc.text("3", left, yPos);
  const childCount = children.length;
  let childLine = `     The ${numberToWords(childCount)} (${childCount}) children `;
  if (children.length) {
    const parts = children.map((c) => {
      if (!c.dob) return c.name;
      const d = new Date(c.dob);
      const dd = Number.isNaN(d.getTime()) ? "" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      return dd ? `${c.name} (Born on ${dd})` : c.name;
    });
    childLine += parts.join(", ");
  }
  childLine += ` each are receive the sub-total child award of K ${K(totalAmountForChildren)} proposed as follows,`;
  yPos = wrap(childLine, yPos, 500);

  yPos += 10;
  doc.setFont("times", "bold");
  let listText = "";
  childAwards.forEach((ca, i) => {
    listText += `3.1.${i + 1} ${ca.name} (${ca.genderWord}), is to receive K${K(ca.amount)}\n`;
  });
  const linesArr = doc.splitTextToSize(listText.trim() || "—", 500);
  doc.text(linesArr, left + 12, yPos);
  yPos += linesArr.length * 14;
  doc.setFont("times", "normal");

  yPos += 10;
  doc.text("4", left, yPos);
  yPos = wrap("     The Tribunal hereby orders that payment be effected within thirty days (30) days from the date of making this Award, and that the payment be made to the dependants of deceased employee by an officer or representative of the Office of Worker's Compensation.", yPos, 500);

  yPos += 10;
  doc.text("5", left, yPos);
  yPos = wrap(`     Furthermore, the tribunal reminds the ${insuranceCompanyName} acting for and on behalf of ${employerName} that under the Worker's Compensation Act, they have a legal obligation to make payments to the dependants of deceased worker at a rate not less than that prescribed in the Act, for the period the deceased worker was dead and all reasonable funeral expenses that were necessarily for the repatriation of the deceased worker.`, yPos, 500);

  yPos += 15;
  yPos = wrap(`Dated at Port Moresby this ${fmtDateLong(decisionDate) || " "}`, yPos, 500);

  yPos += 30;
  doc.setFont("times", "bold");
  const chairFinalY = yPos;
  if (claimType === "StateInsured") {
    doc.text("Mr. Chris Kolias", 297.5, chairFinalY, { align: "center" });
    doc.setFont("times", "normal");
    doc.text("Commissioner", 297.5, chairFinalY + 14, { align: "center" });
    doc.text("Chairman Of Tribunal", 297.5, chairFinalY + 28, { align: "center" });
  } else {
    doc.text("Mr. Martin Pala", 297.5, chairFinalY, { align: "center" });
    doc.setFont("times", "normal");
    doc.text("Chief Commissioner", 297.5, chairFinalY + 14, { align: "center" });
    doc.text("Chairman Of Tribunal", 297.5, chairFinalY + 28, { align: "center" });
  }
  drawSignatures();

  const filename = `ConsentOfAward-Death-${displayIRN || irn}.pdf`;
  doc.save(filename);
}
