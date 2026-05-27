import { jsPDF } from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";

const CREST_URL = "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

const ddmmyyyy = (v: any) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const toDataURL = async (url: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
};

export type EmployerInsuranceRow = {
  CPPSID: string;
  OrganizationName: string;
  OrganizationType: string;
  InsuranceProvider: string;
  IPACODE: string;
};

export async function generateEmployerInsuranceMasterListPDF(data: EmployerInsuranceRow[]) {
  const doc = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });

  // Crest
  const crest = await toDataURL(CREST_URL);
  if (crest) doc.addImage(crest, "PNG", 135, 10, 25, 0);

  // Header
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("INDEPENDENT STATE OF PAPUA NEW GUINEA", 148, 40, { align: "center" });
  doc.text("Office Of Workers Compensation", 148, 45, { align: "center" });

  doc.setFontSize(14);
  doc.text("Employer - Insurance Master List", 148, 55, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(`Date Generated: ${ddmmyyyy(new Date())}`, 282, 60, { align: "right" });

  const body: RowInput[] = data.map((d) => [
    d.CPPSID,
    d.OrganizationName,
    d.OrganizationType,
    d.InsuranceProvider,
    d.IPACODE
  ]);

  autoTable(doc, {
    startY: 65,
    margin: { left: 15, right: 15 },
    head: [
      ["CPPS ID", "Organization Name", "Organization Type", "Insurance Provider", "IPA CODE"]
    ],
    body,
    styles: { font: "times", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [139, 37, 0], textColor: [255, 255, 255], font: "times", fontStyle: "bold", halign: "center" },
    theme: "grid"
  });

  doc.setFont("times", "bold");
  doc.setFontSize(11);
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.text(`Total Employers: ${data.length}`, 15, finalY);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, 282, 200, { align: "right" });
  }

  doc.save("Employer_Insurance_Master_List.pdf");
}

export type GroupedInsuranceReportRow = {
  InsuranceProviderName: string;
  IPACODE: string;
  Employers: EmployerInsuranceRow[];
};

export async function generateGroupedEmployerInsuranceListPDF(data: GroupedInsuranceReportRow[]) {
  const doc = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });

  // Crest
  const crest = await toDataURL(CREST_URL);
  if (crest) doc.addImage(crest, "PNG", 135, 10, 25, 0);

  // Header
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("INDEPENDENT STATE OF PAPUA NEW GUINEA", 148, 40, { align: "center" });
  doc.text("Office Of Workers Compensation", 148, 45, { align: "center" });

  doc.setFontSize(14);
  doc.text("Employers Grouped by Insurance Provider", 148, 55, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(`Date Generated: ${ddmmyyyy(new Date())}`, 282, 60, { align: "right" });

  let currentY = 65;
  let totalEmployers = 0;

  for (const group of data) {
    totalEmployers += group.Employers.length;

    // Check for page overflow before header
    if (currentY > 185) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(`${group.InsuranceProviderName} (${group.IPACODE}) - Total Employers: ${group.Employers.length}`, 15, currentY);
    
    const body: RowInput[] = group.Employers.map((e) => [
      e.CPPSID,
      e.OrganizationName,
      e.OrganizationType
    ]);

    autoTable(doc, {
      startY: currentY + 2,
      margin: { left: 15, right: 15 },
      head: [
        ["CPPS ID", "Organization Name", "Organization Type"]
      ],
      body,
      styles: { font: "times", fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [139, 37, 0], textColor: [255, 255, 255], font: "times", fontStyle: "bold", halign: "center" },
      theme: "grid"
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Grand Totals
  if (currentY > 185) {
    doc.addPage();
    currentY = 20;
  }
  
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("GRAND TOTALS", 15, currentY);
  doc.text(`Total Insurance Providers: ${data.length}`, 15, currentY + 7);
  doc.text(`Total Employers: ${totalEmployers}`, 15, currentY + 14);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, 282, 200, { align: "right" });
  }

  doc.save("Employers_By_Insurance_Provider.pdf");
}
