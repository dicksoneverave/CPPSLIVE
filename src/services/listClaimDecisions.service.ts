// src/services/listClaimDecisions.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type Decision = {
  submissionType: string;
  status: string;
  reason: string;
  takenBy: string;
  decisionDate?: string | null;
  displayIRN?: string;
  IRN?: number;
};

export type PaymentDetail = {
  bankName: string;
  chequeNo: string;
  issueDate: string;
  compensationAmount: string;
  issuedBy: string;
};

function ddmmyyyy(d?: string | null) {
  if (!d) return '--';
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export async function fetchAllCaseData(supabase: SupabaseClient, irn: number) {
  let allDecisions: Decision[] = [];
  const payments: PaymentDetail[] = [];

  async function fetchAndFormat(
    table: string,
    selectFields: string,
    formatter: (row: any) => Decision
  ) {
    const { data, error } = await supabase.from(table).select(selectFields).eq('IRN', irn);
    if (error) throw error;
    return (data || []).map(formatter);
  }

  const pieces = await Promise.all([
    fetchAndFormat('timebarredclaimsregistrarreview', 'IRN, TBCRRFormType, TBCRRReviewStatus, TBCRRDecisionReason, TBCRRDecisionDate', r => ({
      IRN: r.IRN, submissionType: `${r.TBCRRFormType} - TimeBarred`, status: r.TBCRRReviewStatus, reason: r.TBCRRDecisionReason, takenBy: 'Registrar', decisionDate: r.TBCRRDecisionDate
    })),
    fetchAndFormat('prescreening_view', '*', r => ({
      IRN: r.IRN, submissionType: r.PRFormType, status: r.PRStatus, reason: r.PRDecisionReason, takenBy: 'Deputy Registrar', decisionDate: r.PRSubmissionDate
    })),
    fetchAndFormat('registrarreview', 'IRN, IncidentType, RRStatus, RRDecisionReason, RRDecisionDate', r => ({
      IRN: r.IRN, submissionType: r.IncidentType, status: r.RRStatus, reason: r.RRDecisionReason, takenBy: 'Registrar', decisionDate: r.RRDecisionDate
    })),
    fetchAndFormat('form6master', 'IRN, IncidentType, F6MStatus, F6MApprovalDate', r => ({
      IRN: r.IRN, submissionType: `${r.IncidentType} (Form6)`, status: `${r.F6MStatus} (Notification Received - Insurance Company)`, reason: '--', takenBy: '--', decisionDate: r.F6MApprovalDate
    })),
    fetchAndFormat('form18master', 'IRN, IncidentType, F18MStatus, F18MEmployerDecisionReason, F18MWorkerDecisionReason, F18MWorkerAcceptedDate', r => {
      let reason = '--', by = '--';
      if (r.F18MStatus === 'EmployerAccepted') { reason = r.F18MEmployerDecisionReason; by = 'Employer'; }
      else if (r.F18MStatus === 'WorkerAccepted') { reason = r.F18MWorkerDecisionReason; by = 'Worker'; }
      else if (r.F18MStatus === 'NotifiedToWorker') { by = 'PCO'; }
      return { IRN: r.IRN, submissionType: `${r.IncidentType} - Form18 Notification`, status: r.F18MStatus, reason, takenBy: by, decisionDate: r.F18MWorkerAcceptedDate };
    }),
    fetchAndFormat('approvedclaimscporeview', 'IRN, IncidentType, CPORStatus, LockedByCPOID, CPORApprovedDate', r => {
      let status = r.CPORStatus || 'Review Pending';
      let takenBy = 'Provincial Claims Officer';
      if (status === 'CompensationCalculated') takenBy = 'CPO';
      else if ((r.LockedByCPOID ?? 0) > 0) takenBy = 'CPO';
      return { IRN: r.IRN, submissionType: r.IncidentType, status, reason: '--', takenBy, decisionDate: r.CPORApprovedDate };
    }),
    fetchAndFormat('compensationcalculationcommissionersreview', 'IRN, IncidentType, CCCRReviewStatus, CCCRDecisionReason, CCCRDecisionDate', r => ({
      IRN: r.IRN, submissionType: r.IncidentType, status: r.CCCRReviewStatus, reason: r.CCCRDecisionReason, takenBy: r.CCCRReviewStatus?.startsWith('Chief') ? 'Chief Commissioner' : 'Commissioner', decisionDate: r.CCCRDecisionDate
    })),
    fetchAndFormat('claimsawardedcommissionersreview', 'IRN, IncidentType, CACRReviewStatus, CACRDecisionReason, CACRDecisionDate', r => ({
      IRN: r.IRN, submissionType: r.IncidentType, status: r.CACRReviewStatus, reason: r.CACRDecisionReason, takenBy: r.CACRReviewStatus?.startsWith('Chief') ? 'Chief Commissioner' : 'Commissioner', decisionDate: r.CACRDecisionDate
    })),
    fetchAndFormat('compensationcalculationcpmreview', 'IRN, IncidentType, CPMRStatus, CPMRDecisionReason, CPMRDecisionDate', r => ({
      IRN: r.IRN, submissionType: r.IncidentType, status: r.CPMRStatus, reason: r.CPMRDecisionReason, takenBy: 'CPM', decisionDate: r.CPMRDecisionDate
    })),
    fetchAndFormat('claimsawardedregistrarreview', 'IRN, IncidentType, CARRReviewStatus, CARRDecisionReason, CARRDecisionDate', r => ({
      IRN: r.IRN, submissionType: r.IncidentType, status: r.CARRReviewStatus, reason: r.CARRDecisionReason, takenBy: 'Registrar', decisionDate: r.CARRDecisionDate
    })),
  ]);

  allDecisions = pieces.flat();

  // Display IRN mapping
  const irns = allDecisions.map(d => d.IRN).filter(Boolean) as number[];
  if (irns.length) {
    const { data: irnData } = await supabase.from('form1112master').select('IRN, DisplayIRN').in('IRN', irns);
    const map = new Map<number, string>();
    irnData?.forEach(r => map.set(r.IRN, r.DisplayIRN));
    allDecisions = allDecisions.map(d => ({ ...d, displayIRN: d.IRN ? (map.get(d.IRN) || 'N/A') : 'N/A' }));
  }

  // Payments
  const { data: badm } = await supabase.from('bankaccountdepositmaster').select('*').eq('IRN', irn);
  if (badm?.length) {
    const b = badm[0];
    payments.push({
      bankName: b.BankName,
      chequeNo: b.EbankReferenceNo,
      issueDate: ddmmyyyy(b.EbankIssuedDate),
      compensationAmount: b.EbankAmountPaid,
      issuedBy: 'Insurance Provider',
    });
  }
  const { data: occd } = await supabase.from('owcclaimchequedetails').select('*').eq('IRN', irn);
  if (occd?.length) {
    const o = occd[0];
    payments.push({
      bankName: o.OCCDBankName,
      chequeNo: o.OCCDChequeNumber,
      issueDate: ddmmyyyy(o.OCCDIssueDate),
      compensationAmount: o.OCCDChequeAmount,
      issuedBy: 'OWC Trust',
    });
  }

  // Current stage
  const sorted = [...allDecisions].sort((a, b) => {
    const da = a.decisionDate ? new Date(a.decisionDate).getTime() : 0;
    const db = b.decisionDate ? new Date(b.decisionDate).getTime() : 0;
    return db - da;
  });
  const latest = sorted.find(d => d.status) || null;
  const currentStage = latest
    ? `${latest.status} — ${latest.submissionType}${latest.decisionDate ? ` (as of ${ddmmyyyy(latest.decisionDate)})` : ''}`
    : 'No status on record yet';

  const decisions = allDecisions.map(d => ({
    displayIRN: d.displayIRN ?? 'N/A',
    submissionType: d.submissionType,
    status: d.status,
    reason: d.reason ?? '--',
    takenBy: d.takenBy ?? '--',
    decisionDate: ddmmyyyy(d.decisionDate || undefined),
  }));

  return { currentStage, decisions, payments };
}
