// src/utils/form6CPO_jspdf.ts
import { jsPDF } from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";
import { supabase } from "../services/supabase"; // <- utils -> services (adjust if your path differs)

// ---------- constants ----------
const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

// ---------- tiny helpers ----------

const num = (v: any) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtK = (n: number) =>
  `K ${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;



const ucwords = (s = "") =>
  s
    .toLowerCase()
    .replace(/(^|[^\p{L}'])\p{L}/gu, m => m.toUpperCase());

const ddmmyyyy = (v: any) => {
  if (!v) return "";
  if (typeof v === "string" && v.includes("/")) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const toDataURL = async (url: string) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
};

const safePart = (s: any) =>
  String(s ?? '')
    .trim()
    .replace(/[^\w.-]+/g, '_'); // keep letters/numbers/_ . -

// ---------- query exactly like Form6.php ----------
async function loadForm6Data(irn: string | number) {
  // Form1112Master
  const { data: f1112, error: e1112 } = await supabase
    .from("form1112master")
    .select("DisplayIRN, IncidentDate, IncidentType, WorkerID")
    .eq("IRN", irn)
    .single();
  if (e1112) throw e1112;

  // WorkerPersonalDetails
  const { data: worker, error: eWorker } = await supabase
    .from("workerpersonaldetails")
    .select(
      "WorkerFirstName, WorkerLastName, WorkerAddress1, WorkerAddress2, WorkerCity, WorkerProvince, WorkerPOBox"
    )
    .eq("WorkerID", f1112.WorkerID)
    .single();
  if (eWorker) throw eWorker;

  const PARTYNAME1 = (worker.WorkerFirstName + " " + worker.WorkerLastName).trim().toUpperCase();

  // ToAddress (Death vs Injury) — your flow is Injury here, but keep parity with PHP
  let ToAddress = ucwords(
    PARTYNAME1 +
      "\n" +
      [worker.WorkerAddress1, worker.WorkerAddress2, worker.WorkerCity + " , " + worker.WorkerProvince, worker.WorkerPOBox]
        .filter(Boolean)
        .join("\n")
  );

  if (f1112.IncidentType === "Death") {
    // Form4Master (only if Death)
    const { data: f4 } = await supabase
      .from("form4master")
      .select(
        "ApplicantFirstName, ApplicantLastName, ApplicantAddress1, ApplicantAddress2, ApplicantCity, ApplicantProvince, ApplicantPOBox"
      )
      .eq("IRN", irn)
      .maybeSingle();
    if (f4) {
      const name = ucwords((f4.ApplicantFirstName + " " + f4.ApplicantLastName).trim());
      ToAddress = ucwords(
        name +
          "\n" +
          [f4.ApplicantAddress1, f4.ApplicantAddress2, f4.ApplicantCity + " , " + f4.ApplicantProvince, f4.ApplicantPOBox]
            .filter(Boolean)
            .join("\n")
      );
    }
  }

  // CurrentEmploymentDetails -> EmployerMaster
  const { data: ced, error: eCed } = await supabase
    .from("currentemploymentdetails")
    .select("EmployerCPPSID")
    .eq("WorkerID", f1112.WorkerID)
    .single();
  if (eCed) throw eCed;

  const { data: employer, error: eEmployer } = await supabase
    .from("employermaster")
    .select(
      "OrganizationName, Address1, Address2, City, Province, POBox, InsuranceProviderIPACode"
    )
    .eq("CPPSID", ced.EmployerCPPSID)
    .single();
  if (eEmployer) throw eEmployer;

  const EmployerName = ucwords(employer.OrganizationName || "");
  const EmployerAddress = ucwords(
    [employer.Address1, employer.Address2, employer.City, `${employer.Province} , ${employer.POBox}.`]
      .filter(Boolean)
      .join("\n")
  );

  // InsuranceCompanyMaster (by IPACODE from EmployerMaster)
  const { data: insurer, error: eIns } = await supabase
    .from("insurancecompanymaster")
    .select(
      "InsuranceCompanyOrganizationName, InsuranceCompanyAddress1, InsuranceCompanyAddress2, InsuranceCompanyCity, InsuranceCompanyProvince, InsuranceCompanyPOBox"
    )
    .eq("IPACODE", employer.InsuranceProviderIPACode)
    .single();
  if (eIns) throw eIns;

  const InsuranceCompany = insurer.InsuranceCompanyOrganizationName || "";
  const ICAddress = ucwords(
    [
      insurer.InsuranceCompanyAddress1,
      insurer.InsuranceCompanyAddress2,
      insurer.InsuranceCompanyCity,
      `${insurer.InsuranceCompanyProvince} , ${insurer.InsuranceCompanyPOBox}.`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  // ClaimCompensationWorkerDetails (page 2)
  let ccwd:
    | {
        CCWDWorkerFirstName?: string;
        CCWDWorkerLastName?: string;
        CCWDWorkerDOB?: string;
        CCWDAnnualWage?: number | string;
        CCWDCompensationAmount?: number | string;
        CCWDMedicalExpenses?: number | string;
        CCWDMiscExpenses?: number | string;
        CCWDDeductions?: number | string;
        CCWDDeductionsNotes?: string;
      }
    | null = null;
  try {
    const { data } = await supabase
      .from("claimcompensationworkerdetails")
      .select(
        "CCWDWorkerFirstName, CCWDWorkerLastName, CCWDWorkerDOB, CCWDAnnualWage, CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions, CCWDDeductionsNotes"
      )
      .eq("IRN", irn)
      .single();
    ccwd = data;
  } catch {
    ccwd = null; // ok if absent
  }

  // InjuryCaseCheckList (page 3)
  const { data: injuries } = await supabase
    .from("injurycasechecklist")
    .select("ICCLCriteria, ICCLFactor, ICCLDoctorPercentage, ICCLCompensationAmount")
    .eq("IRN", irn);

  // ClaimCompensationPersonalDetails (page 4)
  const { data: dependants } = await supabase
    .from("claimcompensationpersonaldetails")
    .select(
      "CCPDPersonFirstName, CCPDPersonLastName, CCPDPersonDOB, CCPDRelationToWorker, CCPDCompensationAmount, CCPDDegreeOfDependance"
    )
    .eq("IRN", irn);

  return {
    DisplayIRN: f1112.DisplayIRN,
    IncidentType: f1112.IncidentType,
    PARTYNAME1,
    ToAddress,
    EmployerName,
    EmployerAddress,
    InsuranceCompany,
    ICAddress,
    // page 2
    CCWDWorkerFirstName: ccwd?.CCWDWorkerFirstName || worker.WorkerFirstName,
    CCWDWorkerLastName: ccwd?.CCWDWorkerLastName || worker.WorkerLastName,
    CCWDWorkerDOB: ccwd?.CCWDWorkerDOB || null,
    CCWDAnnualWage: ccwd?.CCWDAnnualWage ?? "",
    CCWDCompensationAmount: ccwd?.CCWDCompensationAmount ?? "",
    CCWDMedicalExpenses: ccwd?.CCWDMedicalExpenses ?? 0,
    CCWDMiscExpenses: ccwd?.CCWDMiscExpenses ?? 0,
    CCWDDeductions: ccwd?.CCWDDeductions ?? 0,
    CCWDDeductionsNotes: ccwd?.CCWDDeductionsNotes ?? "Nil",
    // page 3
    Injuries: injuries || [],
    // page 4
    Dependants: dependants || [],
  };
}

// ---------- renderer (absolute page 1, tables page 2–4) ----------
async function renderPDF(data: Awaited<ReturnType<typeof loadForm6Data>>) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  // crest + watermark + header
  const crest = await toDataURL(CREST_URL).catch(() => undefined);
  if (crest) doc.addImage(crest, "PNG", 90, 3, 30, 0);

  doc.setFont("times", "bold");
  doc.setFontSize(50);
  doc.setTextColor(228, 226, 220);
  (doc as any).text("O R I G I N A L", 65, 190, { angle: 45 });
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("INDEPENDENT STATE OF PAPUA NEW GUINEA", 105, 33, { align: "center" });
  doc.setFontSize(9.5);
  doc.setFont("times", "normal");
  doc.text("Reg, Sec. 8(1)(b).", 12, 37);
  doc.setFont("times", "bold");
  doc.text("Workers’ Compensation Act 1978", 105, 37, { align: "center" });
  doc.setFont("times", "normal");
  doc.text("Form 6.", 198, 37, { align: "right" });

  // ---- PAGE 1 body (matches PHP absolute flow; NO tables)
  const L = 12;
  const y0 = 48;

  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.text("Register No. : ", L, y0);
  doc.setFont("times", "normal");
  doc.text(String(data.DisplayIRN || ""), L + 28, y0);

  doc.setFont("times", "bold");
  doc.text("IN RESPECT OF", L, y0 + 14);
  doc.text(String(data.PARTYNAME1 || ""), 100, y0 + 14, { align: "center" });
  doc.setFont("times", "normal");
  doc.text("worker of", 198, y0 + 14, { align: "right" });

  doc.text(data.ToAddress || "", L, y0 + 22);

  doc.setFont("times", "bold");
  doc.text("AND", 96, 86);

  doc.setFont("times", "bold");
  doc.text(String(data.InsuranceCompany || ""), L + 90, 100, { align: "center" });
  doc.setFont("times", "normal");
  doc.text("the Insurance Company", 198, 100, { align: "right" });
  doc.text(data.ICAddress || "", L, 115);

  doc.setFont("times", "bold");
  doc.text("Acting on behalf of", 100, 130, { align: "center" });

  doc.setFont("times", "bold");
  doc.text(String(data.EmployerName || ""), L + 90, 140, { align: "center" });
  doc.setFont("times", "normal");
  doc.text("the employer", 198, 140, { align: "right" });
  doc.text(data.EmployerAddress || "", L, 150);

  doc.setFont("times", "bold");
  doc.text(
    "NOTICE TO EMPLOYER AS TO APPLICATION FOR COMPENSATION",
    105,
    175,
    { align: "center" }
  );
  doc.setFont("times", "normal");
  const p1 =
    "TAKE NOTICE that, if you intend to oppose the application, of which a copy is served with this notice, you must lodge with me, within one calendar month after the service, a written answer to it containing a concise statement of the extent and grounds of your opposition.";
  const p2 =
    "AND FURTHER TAKE NOTICE that in default of your lodging with me, within the time specified, a written answer as required, a tribunal may make such an award as it deems just and expedient.";
  doc.text(doc.splitTextToSize(p1, 180), L, 190);
  doc.text(doc.splitTextToSize(p2, 180), L, 208);

  // Date / Registrar (Footer in PHP; here we draw like the screenshot)
  doc.text("Date :", L, 240);
  doc.setFont("times", "bold");
  doc.text(ddmmyyyy(new Date()), L + 12, 240);
  doc.setFont("times", "normal");
  doc.text("Registrar.", 170, 240, { align: "right" });

  // ---- PAGE 2 (Worker & Compensation Details)
  doc.addPage();
  if (crest) doc.addImage(crest, "PNG", 90, 3, 30, 0);
  doc.setFont("times", "bold"); doc.setFontSize(12);
  doc.text("INDEPENDENT STATE OF PAPUA NEW GUINEA", 105, 33, { align: "center" });
  doc.setFontSize(9.5); doc.setFont("times", "normal");
  doc.text("Reg, Sec. 8(1)(b).", 12, 37);
  doc.setFont("times", "bold"); doc.text("Workers’ Compensation Act 1978", 105, 37, { align: "center" });
  doc.setFont("times", "normal"); doc.text("Form 6.", 198, 37, { align: "right" });
  doc.line(12, 39, 198, 39);
  doc.setFont("times", "bold"); doc.setFontSize(12);
  doc.text("Claim Compensation Summary", 105, 52, { align: "center" });
  doc.setFontSize(10);

  doc.setFont("times", "bold");
  doc.text("Worker Details", 12, 62);
  autoTable(doc, {
    startY: 66,
    margin: { left: 12, right: 12 },
    styles: { font: "times", fontSize: 10, halign: "left" },
    head: [],
    body: [
      ["CRN", String(data.DisplayIRN || "")],
      ["Worker Name", `${ucwords(data.CCWDWorkerFirstName || "")} ${ucwords(data.CCWDWorkerLastName || "")}`.trim() || ucwords(data.PARTYNAME1 || "")],
      ["Date Of Birth", ddmmyyyy(data.CCWDWorkerDOB)],
      ["Annual Wage", String(data.CCWDAnnualWage ?? "")],
    ] as RowInput[],
    theme: "grid",
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: "auto" } },
  });

doc.text("Compensation Details", 12, (doc as any).lastAutoTable.finalY + 8);

// compute payable = base + medical + misc - deductions (>= 0)
const baseAmt   = num(data.CCWDCompensationAmount);
const medAmt    = num(data.CCWDMedicalExpenses);
const miscAmt   = num(data.CCWDMiscExpenses);
const dedAmt    = num(data.CCWDDeductions);
const payable   = Math.max(0, Math.round((baseAmt + medAmt + miscAmt - dedAmt) * 100) / 100);

// Build rows (you can keep raw strings, but formatting looks nicer with fmtK)
const compBody: RowInput[] = [
  ["Compensation Amount", fmtK(baseAmt)],
  ["Medical Expenses",     fmtK(medAmt)],
  ["Misc. Expenses",       fmtK(miscAmt)],
  ["Deductions",           fmtK(dedAmt)],

  // ✅ NEW total row
  [{ content: "Total Compensation (Payable)", styles: { fontStyle: "bold" } }, { content: fmtK(payable), styles: { fontStyle: "bold", halign: "right" } }],

  // Keep notes after the total
  ["Deductions Notes", String(data.CCWDDeductionsNotes ?? "Nil")],
];

autoTable(doc, {
  startY: (doc as any).lastAutoTable.finalY + 12,
  margin: { left: 12, right: 12 },
  styles: { font: "times", fontSize: 10, halign: "left" },
  head: [],
  body: compBody,
  theme: "grid",
  columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: "auto", halign: "right" } },
});


  let y = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("times", "normal");
  doc.text("Date :", 12, y);
  doc.setFont("times", "bold"); doc.text(ddmmyyyy(new Date()), 26, y);
  doc.setFont("times", "normal"); doc.text("Registrar.", 170, y, { align: "right" });

  // ---- PAGE 3 (Injury Check List) — only if Injury like PHP
  if (data.IncidentType === "Injury") {
    doc.addPage();
    if (crest) doc.addImage(crest, "PNG", 90, 3, 30, 0);
    doc.setFont("times", "bold"); doc.setFontSize(12);
    doc.text("INDEPENDENT STATE OF PAPUA NEW GUINEA", 105, 33, { align: "center" });
    doc.setFontSize(9.5); doc.setFont("times", "normal");
    doc.text("Reg, Sec. 8(1)(b).", 12, 37);
    doc.setFont("times", "bold"); doc.text("Workers’ Compensation Act 1978", 105, 37, { align: "center" });
    doc.setFont("times", "normal"); doc.text("Form 6.", 198, 37, { align: "right" });
    doc.line(12, 39, 198, 39);
    doc.setFont("times", "bold"); doc.setFontSize(12);
    doc.text("Claim Compensation Summary", 105, 52, { align: "center" });
    doc.setFontSize(10);

    doc.setFont("times", "bold");
    doc.text("Applied Injuries Check List", 12, 62);

    const injuryRows: RowInput[] = (data.Injuries || []).map((m: any) => [
      m.ICCLCriteria,
      m.ICCLFactor,
      m.ICCLDoctorPercentage,
      m.ICCLCompensationAmount,
    ]);

    autoTable(doc, {
      startY: 66,
      margin: { left: 12, right: 12 },
      head: [["Criteria", "Factor", "Doctors Percentage", "Compensation Amount"]],
      body: injuryRows.length ? injuryRows : [["", "", "", ""]],
      styles: { font: "times", fontSize: 10 },
      headStyles: { halign: "center" },
      theme: "grid",
      columnStyles: {
        0: { cellWidth: "auto", halign: "left" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 39, halign: "center" },
        3: { cellWidth: 40, halign: "right" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 16;
    doc.setFont("times", "normal");
    doc.text("Date :", 12, y);
    doc.setFont("times", "bold"); doc.text(ddmmyyyy(new Date()), 26, y);
    doc.setFont("times", "normal"); doc.text("Registrar.", 170, y, { align: "right" });
  }

  // ---- PAGE 4 (Dependants) — only if rows exist (like PHP)
  const dependRows: RowInput[] = (data.Dependants || []).map((m: any) => [
    ucwords(m.CCPDPersonFirstName || ""),
    ucwords(m.CCPDPersonLastName || ""),
    ddmmyyyy(m.CCPDPersonDOB),
    m.CCPDRelationToWorker || "",
    m.CCPDDegreeOfDependance ?? 0,
    m.CCPDCompensationAmount ?? 0,
  ]);

  if (dependRows.length) {
    doc.addPage();
    if (crest) doc.addImage(crest, "PNG", 90, 3, 30, 0);
    doc.setFont("times", "bold"); doc.setFontSize(12);
    doc.text("INDEPENDENT STATE OF PAPUA NEW GUINEA", 105, 33, { align: "center" });
    doc.setFontSize(9.5); doc.setFont("times", "normal");
    doc.text("Reg, Sec. 8(1)(b).", 12, 37);
    doc.setFont("times", "bold"); doc.text("Workers’ Compensation Act 1978", 105, 37, { align: "center" });
    doc.setFont("times", "normal"); doc.text("Form 6.", 198, 37, { align: "right" });
    doc.line(12, 39, 198, 39);
    doc.setFont("times", "bold"); doc.setFontSize(12);
    doc.text("Claim Compensation Summary", 105, 52, { align: "center" });
    doc.setFontSize(10);

    doc.setFont("times", "bold");
    doc.text("Dependant & Applicant Details", 12, 62);

    autoTable(doc, {
      startY: 66,
      margin: { left: 12, right: 12 },
      head: [["First Name", "Last Name", "Date Of Birth", "Relation To\nWorker", "Dependance\nDegree", "Compensation\nAmount"]],
      body: dependRows,
      styles: { font: "times", fontSize: 10 },
      headStyles: { halign: "center" },
      theme: "grid",
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35 },
        2: { cellWidth: 23 },
        3: { cellWidth: 23, halign: "center" },
        4: { cellWidth: 23, halign: "center" },
        5: { cellWidth: 23, halign: "right" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 16;
    doc.setFont("times", "normal");
    doc.text("Date :", 12, y);
    doc.setFont("times", "bold"); doc.text(ddmmyyyy(new Date()), 26, y);
    doc.setFont("times", "normal"); doc.text("Registrar.", 170, y + 10, { align: "right" });
  }

   const crn = data?.DisplayIRN ? safePart(data.DisplayIRN) : 'IRN';
  doc.save(`Form6-${crn}.pdf`);
}


// ---------- public API ----------
export async function generateForm6CPO_jsPDF_byIRN(irn: string | number) {
  const data = await loadForm6Data(irn);
  await renderPDF(data);
}

// (keep the old function name for backwards compatibility if you want)
export default generateForm6CPO_jsPDF_byIRN;

