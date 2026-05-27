import { jsPDF } from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';

const CREST_URL =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';

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

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtK = (n: number) =>
  `K ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type ReconRow = {
  Date: string;
  Description: string;
  Debit: number | null;
  Credit: number | null;
  Balance: number | null;
  // Some places call it "Reconcile", others "Reconciled". Support both.
  Reconcile?: boolean | string | null;
  Reconciled?: boolean | string | null;
};

type PaidRow = {
  IRN: string | number;
  DisplayIRN?: string | null;
  WorkerFirstName?: string | null;
  WorkerLastName?: string | null;
  EbankAmountPaid?: number | null;
  BankName?: string | null;
  IncidentType?: string | null;
};

// Normalize to boolean: accepts boolean, "true"/"false", "t"/"f", 1/0
const toBool = (v: any): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 't' || s === '1' || s === 'yes' || s === 'y';
  }
  return false;
};

export async function printBankReconciliationRegister(params: {
  account: string;
  fromDate: string;
  toDate: string;
  openingBalance?: number;
  rows: ReconRow[];
}) {
  const { account, fromDate, toDate, openingBalance = 0, rows } = params;

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  try {
    const crest = await toDataURL(CREST_URL);
    if (crest) doc.addImage(crest, 'PNG', 90, 6, 30, 0);
  } catch {}

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('INDEPENDENT STATE OF PAPUA NEW GUINEA', 105, 33, { align: 'center' });

  doc.setFontSize(14);
  doc.text('Bank Reconciliation Register', 105, 45, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Account: ${account}`, 12, 54);
  doc.text(`Period: ${fromDate} to ${toDate}`, 198, 54, { align: 'right' });

  const body: RowInput[] = rows.map(r => {
    // ✅ Use either "Reconciled" or "Reconcile"
    const reconciled = toBool(r.Reconciled ?? r.Reconcile ?? false);
    return [
      String(r.Date || '').slice(0, 10),
      String(r.Description || ''),
      fmtK(num(r.Debit)),
      fmtK(num(r.Credit)),
      fmtK(num(r.Balance)),
      reconciled ? 'Yes' : 'No',
    ];
  });

  autoTable(doc, {
    startY: 60,
    margin: { left: 12, right: 12 },
    head: [['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Reconciled']],
    body,
    styles: { font: 'times', fontSize: 10, cellPadding: 2 },
    headStyles: { halign: 'center' },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 90 },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 22, halign: 'center' },
    },
  });

  const totalDeb = rows.reduce((s, r) => s + num(r.Debit), 0);
  const totalCre = rows.reduce((s, r) => s + num(r.Credit), 0);
  const yAfter = (doc as any).lastAutoTable?.finalY ?? 270;

  doc.setFont('times', 'bold');
  doc.text(`Opening Balance: ${fmtK(openingBalance)}`, 12, yAfter + 8);
  doc.text(`Total Debits: ${fmtK(totalDeb)}`, 12, yAfter + 16);
  doc.text(`Total Credits: ${fmtK(totalCre)}`, 12, yAfter + 24);

  doc.save(`Bank_Reconciliation_Register_${account.replace(/\s+/g, '_')}.pdf`);
}

export async function printOutstandingUnreconciledPayments(params: {
  account: string;
  rows: PaidRow[];
}) {
  const { account, rows } = params;

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  try {
    const crest = await toDataURL(CREST_URL);
    if (crest) doc.addImage(crest, 'PNG', 90, 6, 30, 0);
  } catch {}

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('INDEPENDENT STATE OF PAPUA NEW GUINEA', 105, 33, { align: 'center' });

  doc.setFontSize(14);
  doc.text('Outstanding Unreconciled Payments', 105, 45, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Account: ${account}`, 12, 54);

  const body: RowInput[] = rows.map(r => [
    String(r.IRN ?? ''),
    String(r.DisplayIRN ?? ''),
    `${(r.WorkerFirstName ?? '').trim()} ${(r.WorkerLastName ?? '').trim()}`.trim(),
    String(r.IncidentType ?? ''),
    String(r.BankName ?? ''),
    fmtK(num(r.EbankAmountPaid)),
  ]);

  autoTable(doc, {
    startY: 60,
    margin: { left: 12, right: 12 },
    head: [['IRN', 'Display IRN', 'Worker', 'Incident', 'Bank', 'Amount Paid']],
    body,
    styles: { font: 'times', fontSize: 10, cellPadding: 2 },
    headStyles: { halign: 'center' },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 30 },
      2: { cellWidth: 52 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22 },
      5: { cellWidth: 26, halign: 'right' },
    },
  });

  const total = rows.reduce((s, r) => s + num(r.EbankAmountPaid), 0);
  const yAfter = (doc as any).lastAutoTable?.finalY ?? 270;

  doc.setFont('times', 'bold');
  doc.text(`Total Outstanding: ${fmtK(total)}`, 12, yAfter + 8);

  doc.save(`Outstanding_Unreconciled_${account.replace(/\s+/g, '_')}.pdf`);
}
