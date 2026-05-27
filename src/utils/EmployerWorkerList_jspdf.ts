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

export type WorkerReportRow = {
  WorkerID: string;
  DisplayName: string;
  FirstName: string;
  LastName: string;
  Gender: string;
  Address: string;
  Mobile: string;
  Landline: string;
};

export async function generateEmployerWorkerListPDF(
  employerName: string,
  cppsId: string,
  workers: WorkerReportRow[]
) {
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
  doc.text("Employer - Worker List", 148, 55, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(`Employer: ${employerName}`, 15, 65);
  doc.text(`CPPS ID: ${cppsId}`, 15, 70);
  doc.text(`Total Workers: ${workers.length}`, 15, 75);
  doc.text(`Date Generated: ${ddmmyyyy(new Date())}`, 282, 75, { align: "right" });

  const body: RowInput[] = workers.map((w) => [
    w.WorkerID,
    w.DisplayName,
    `${w.FirstName} ${w.LastName}`,
    w.Gender,
    w.Address,
    w.Mobile,
    w.Landline
  ]);

  autoTable(doc, {
    startY: 80,
    margin: { left: 15, right: 15 },
    head: [
      ["Worker ID", "Display Name", "Full Name", "Gender", "Address", "Mobile", "Landline"]
    ],
    body,
    styles: { font: "times", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [139, 37, 0], textColor: [255, 255, 255], font: "times", fontStyle: "bold", halign: "center" },
    theme: "grid"
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, 282, 200, { align: "right" });
  }

  doc.save(`Employer_Worker_List_${cppsId}.pdf`);
}

export type MasterReportRow = {
  EmployerName: string;
  CPPSID: string;
  Workers: WorkerReportRow[];
};

export async function generateMasterEmployerWorkerListPDF(
  data: MasterReportRow[]
) {
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
  doc.text("Master Employer - Worker List", 148, 55, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text(`Date Generated: ${ddmmyyyy(new Date())}`, 282, 60, { align: "right" });

  let currentY = 65;
  let totalWorkers = 0;

  for (const emp of data) {
    totalWorkers += emp.Workers.length;
    
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(`Employer: ${emp.EmployerName} (${emp.CPPSID}) - Total Workers: ${emp.Workers.length}`, 15, currentY);
    
    const body: RowInput[] = emp.Workers.map((w) => [
      w.WorkerID,
      w.DisplayName,
      `${w.FirstName} ${w.LastName}`,
      w.Gender,
      w.Address,
      w.Mobile,
      w.Landline
    ]);

    autoTable(doc, {
      startY: currentY + 2,
      margin: { left: 15, right: 15 },
      head: [
        ["Worker ID", "Display Name", "Full Name", "Gender", "Address", "Mobile", "Landline"]
      ],
      body,
      styles: { font: "times", fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [139, 37, 0], textColor: [255, 255, 255], font: "times", fontStyle: "bold", halign: "center" },
      theme: "grid"
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
    
    // Check for page overflow
    if (currentY > 180 && data.indexOf(emp) < data.length - 1) {
      doc.addPage();
      currentY = 20;
    }
  }

  // Grand Totals
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  if (finalY > 185) doc.addPage();
  
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  const footerY = finalY > 185 ? 30 : finalY;
  doc.text(`GRAND TOTALS`, 15, footerY);
  doc.text(`Total Employers: ${data.length}`, 15, footerY + 7);
  doc.text(`Total Workers: ${totalWorkers}`, 15, footerY + 14);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, 282, 200, { align: "right" });
  }

  doc.save(`Master_Employer_Worker_List.pdf`);
}
