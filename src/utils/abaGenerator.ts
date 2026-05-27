/**
 * ABA File Generator utility
 * Based on KunduPei (BSP PNG) 132-character fixed-width format.
 */

export interface ABAPayerInfo {
  companyName: string;
  bsb: string;
  accountNumber: string;
  userId: string;
  description: string; // Header description (e.g. PAYROLL)
  debitDescription: string; // Detail debit line reference (e.g. SALARY)
}

export interface ABAPayeeRow {
  bsb: string;
  accountNumber: string;
  accountName: string;
  amount: number; // in Kina (decimal)
  reference: string;
}

const pad = (str: string | number, length: number, char: string = ' ', side: 'left' | 'right' = 'right'): string => {
  const s = String(str);
  if (s.length >= length) return s.slice(0, length);
  return side === 'right' ? s.padEnd(length, char) : s.padStart(length, char);
};

/**
 * Ensures characters are in standard ANSI set (32-127) as per specification.
 * Removes/replaces special characters.
 */
const cleanANSI = (str: string): string => {
  if (!str) return '';
  // Replace common special characters or just filter to allowed range
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\x20-\x7E]/g, '') // Keep only printable ASCII/ANSI 32-127
    .toUpperCase();
};

const formatBSB = (bsb: string): string => {
  const clean = bsb.replace(/[^\d]/g, '');
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return pad(bsb, 7);
};

const formatAmountCents = (amt: number): string => {
  const cents = Math.round(amt * 100);
  return pad(cents, 10, '0', 'left');
};

export function generateABAFile(payees: ABAPayeeRow[], payer: ABAPayerInfo): string {
  const lines: string[] = [];
  const today = new Date();
  const dateStr = today.getFullYear() + 
                  String(today.getMonth() + 1).padStart(2, '0') + 
                  String(today.getDate()).padStart(2, '0');

  // --- 1. Header (Type 0) ---
  // Lengths: 1 + 17 + 2 + 3 + 7 + 26 + 6 + 12 + 8 + 50 = 132
  let header = '0';
  header += pad('', 17);
  header += '01'; // Reel sequence
  header += 'BSP'; // Bank
  header += pad('', 7);
  header += pad(cleanANSI(payer.companyName), 26);
  header += pad(payer.userId, 6, '0', 'left');
  header += pad(cleanANSI(payer.description), 12);
  header += dateStr;
  header += pad('', 50);
  lines.push(header);

  let totalCredit = 0;

  // Trace Block (used in every detail line - Pos 87-132)
  // Lengths: 7 (BSB) + 15 (Acct) + 16 (PayerName) + 8 (WHT) = 46
  const traceBlock = 
    formatBSB(payer.bsb) + 
    pad(payer.accountNumber.replace(/[^\d]/g, ''), 15, '0', 'left') + 
    pad(cleanANSI(payer.companyName), 16) + 
    pad('00000000', 8);

  // --- 2. Detail Lines (Type 1 - Credits) ---
  for (const payee of payees) {
    totalCredit += payee.amount;
    
    // Lengths: 1 (Type) + 7 (BSB) + 15 (Acct) + 1 (Ind) + 2 (Code) + 10 (Amt) + 32 (Name) + 18 (Ref) + 46 (Trace) = 132
    let line = '1';
    line += formatBSB(payee.bsb);
    line += pad(payee.accountNumber.replace(/[^\d]/g, ''), 15, '0', 'left');
    line += ' '; // Indicator (blank)
    line += '53'; // Transaction Code (Credit)
    line += formatAmountCents(payee.amount);
    line += pad(cleanANSI(payee.accountName), 32);
    line += pad(cleanANSI(payee.reference), 18);
    line += traceBlock;
    lines.push(line);
  }

  // --- 3. Detail Line (Type 1 - Debit) ---
  // Must balance - every credit needs a debit from the payer's account.
  // Lengths: 1 + 7 + 15 + 1 + 2 + 10 + 32 + 18 + 46 = 132
  let debitLine = '1';
  debitLine += formatBSB(payer.bsb);
  debitLine += pad(payer.accountNumber.replace(/[^\d]/g, ''), 15, '0', 'left');
  debitLine += ' ';
  debitLine += '13'; // Transaction Code (Debit)
  debitLine += formatAmountCents(totalCredit);
  debitLine += pad(cleanANSI(payer.companyName), 32);
  debitLine += pad(cleanANSI(payer.debitDescription), 18);
  debitLine += traceBlock;
  lines.push(debitLine);

  // --- 4. Footer (Type 7) ---
  // Lengths: 1 + 7 + 12 + 10 + 10 + 10 + 24 + 6 + 52 = 132
  let footer = '7';
  footer += '999-999';
  footer += pad('', 12);
  footer += pad(0, 10, '0', 'left'); // Net Total Amount (Debit - Credit) = 0
  footer += formatAmountCents(totalCredit); // Credit Total
  footer += formatAmountCents(totalCredit); // Debit Total (balanced)
  footer += pad('', 24);
  footer += pad(payees.length + 1, 6, '0', 'left'); // Record count (credits + 1 debit)
  footer += pad('', 52);
  lines.push(footer);

  return lines.join('\r\n'); // Use Windows line endings for banking files
}

