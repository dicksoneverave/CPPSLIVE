import React, { useEffect, useState } from 'react'
import { supabase } from '../../services/supabase'

interface Decision {
  submissionType: string
  status: string
  reason: string
  takenBy: string
  /** formatted for display (dd/mm/yyyy) */
  decisionDate?: string
  /** raw ISO date (used for sorting) */
  decisionDateRaw?: string
  displayIRN?: string
  IRN?: number
}

interface PaymentDetail {
  bankName: string
  chequeNo: string
  issueDate: string
  compensationAmount: string
  issuedBy: string
}

interface Props {
  irn: number
  onClose?: () => void
}

// Local date formatter (dd/mm/yyyy)
const pretty = (d?: string | null) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yyyy = dt.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const ListClaimDecisions: React.FC<Props> = ({ irn }) => {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [payments, setPayments] = useState<PaymentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        // 1) Pre-fetch CPO rows so we can enrich with staff/region names
        const { data: accpRows, error: accpErr } = await supabase
          .from('approvedclaimscporeview')
          .select('IRN, IncidentType, CPORStatus, LockedByCPOID, CPORApprovedDate')
          .eq('IRN', irn)
        if (accpErr) throw accpErr

        // Collect CPO staff IDs from those rows
        const cpoIds = Array.from(
          new Set((accpRows ?? []).map(r => Number(r.LockedByCPOID)).filter(id => id > 0))
        )

        // 2) Look up CPO staff names + regions
        let staffMap = new Map<number, { name: string; region?: string }>()
        if (cpoIds.length) {
          const { data: staff, error: staffErr } = await supabase
            .from('owcstaffmaster')
            .select('OSMStaffID, OSMFirstName, OSMLastName, InchargeRegion')
            .in('OSMStaffID', cpoIds)
          if (staffErr) throw staffErr
          staff?.forEach((s: any) => {
            const name = `${s.OSMFirstName ?? ''} ${s.OSMLastName ?? ''}`.trim()
            staffMap.set(Number(s.OSMStaffID), { name, region: s.InchargeRegion || undefined })
          })
        }

        // 3) If we learned regions from CPOs, fetch CPM names by region
        const regions = Array.from(
          new Set(Array.from(staffMap.values()).map(v => v.region).filter(Boolean) as string[])
        )
        let cpmByRegion = new Map<string, string>()
        if (regions.length) {
          const { data: cpms, error: cpmErr } = await supabase
            .from('owcstaffmaster')
            .select('OSMFirstName, OSMID, OSMLastName, InchargeRegion')
            .eq('OSMDesignation', 'Claims Manager')
            .in('InchargeRegion', regions)
          if (cpmErr) throw cpmErr
          cpms?.forEach((c: any) => {
            const name = `${c.OSMFirstName ?? ''} ${c.OSMLastName ?? ''}`.trim()
            if (c.InchargeRegion) cpmByRegion.set(c.InchargeRegion, `${name} (Claims Manager)`) // match old UI
          })
        }

        // 4) Helper to run a table query and map rows → Decision[]
        const fetchAndFormat = async (
          table: string,
          selectFields: string,
          map: (row: any) => Decision
        ) => {
          const { data, error } = await supabase.from(table).select(selectFields).eq('IRN', irn)
          if (error) throw error
          return (data || []).map(map)
        }

        // 5) Try both possible CCR table names to ensure parity with legacy (ModelCCR)
        const fetchCCR = async (): Promise<Decision[]> => {
          // Newer schema name first
          {/*  const try1 = await supabase
            .from('compensationcalculationregistrarreview')
            .select('IRN, IncidentType, CCRReviewStatus, CCRDecisionReason, CCRDecisionDate')
            .eq('IRN', irn)
          if (try1.error && try1.error.code !== 'PGRST116') throw try1.error
          if (try1.data && try1.data.length) {
            return try1.data.map((row: any) => ({
              IRN: row.IRN,
              submissionType: row.IncidentType,
              status: row.CCRReviewStatus,
              reason: row.CCRDecisionReason,
              takenBy: 'Registrar',
              decisionDate: pretty(row.CCRDecisionDate),
              decisionDateRaw: row.CCRReviewStatus ? row.CCRDecisionDate : undefined,
            }))
          } */}
          // Fallback to legacy table name
          const try2 = await supabase
            .from('compensationcalculationreview')
            .select('IRN, IncidentType, CCRReviewStatus, CCRDecisionReason, CCRDecisionDate')
            .eq('IRN', irn)
          if (try2.error && try2.error.code !== 'PGRST116') throw try2.error
          return (try2.data || []).map((row: any) => ({
            IRN: row.IRN,
            submissionType: row.IncidentType,
            status: row.CCRReviewStatus,
            reason: row.CCRDecisionReason,
            takenBy: 'Registrar',
            decisionDate: pretty(row.CCRDecisionDate),
            decisionDateRaw: row.CCRDecisionDate,
          }))
        }

        // Derive a displayable CPO name for Form 18 rows
        const cpoNameForForm18 = (() => {
          const withId = (accpRows || []).find(r => Number(r.LockedByCPOID) > 0)
          if (!withId) return 'Provincial Claims Officer'
          const staff = staffMap.get(Number(withId.LockedByCPOID))
          return staff?.name ? `${staff.name} (Provincial Claims Officer)` : 'Provincial Claims Officer'
        })()



        // 6) Build decisions from all relevant sources (Tribunal intentionally commented out per request)
        const decisionsParts: Decision[][] = await Promise.all([
          // Time Barred Claims Registrar Review (ModelTBCRR)
          fetchAndFormat(
            'timebarredclaimsregistrarreview',
            'IRN, TBCRRFormType, TBCRRReviewStatus, TBCRRDecisionReason, TBCRRDecisionDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: `${row.TBCRRFormType} - TimeBarred`,
              status: row.TBCRRReviewStatus,
              reason: row.TBCRRDecisionReason,
              takenBy: 'Registrar',
              decisionDate: pretty(row.TBCRRDecisionDate),
              decisionDateRaw: row.TBCRRDecisionDate,
            })
          ),

          // Deputy Registrar (ModalPR) — current app uses a view
          fetchAndFormat('prescreening_view', '*', (row: any) => ({
            IRN: row.IRN,
            submissionType: row.PRFormType,
            status: row.PRStatus,
            reason: row.PRDecisionReason,
            takenBy: row.PRFormType === 'Form11' || row.PRFormType === 'Form12'
              ? 'Registrar'
              : 'Deputy Registrar',
            decisionDate: pretty(row.PRSubmissionDate || row.PRDecisionDate),
            decisionDateRaw: row.PRSubmissionDate || row.PRDecisionDate,
          })),

          // Registrar (ModalRegistrarReview)
          fetchAndFormat(
            'registrarreview',
            'IRN, IncidentType, RRStatus, RRDecisionReason, RRDecisionDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: row.IncidentType,
              status: row.RRStatus,
              reason: row.RRDecisionReason,
              takenBy: 'Registrar',
              decisionDate: pretty(row.RRDecisionDate),
              decisionDateRaw: row.RRDecisionDate,
            })
          ),

          // Form 6 (ModelForm6Master)
          fetchAndFormat(
            'form6master',
            'IRN, IncidentType, F6MStatus, F6MApprovalDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: `${row.IncidentType} (Form6)`,
              status: `${row.F6MStatus} (Notification Received - Insurance Company)`,
              reason: '--',
              takenBy: '--',
              decisionDate: pretty(row.F6MApprovalDate),
              decisionDateRaw: row.F6MApprovalDate,
            })
          ),

          // Form 18 (ModalForm18Master) — employer / PCO / worker branches
          // Form 18 (ModalForm18Master) — always list up to THREE separate entries as the case progresses
          (async () => {
            const { data, error } = await supabase
              .from('form18master')
              .select(
                'IRN, IncidentType, F18MStatus, ' +
                'F18MEmployerDecisionReason, F18MEmployerAcceptedDate, ' +
                'F18MWorkerDecisionReason, F18MWorkerAcceptedDate, ' +
                'F18MWorkerNotifiedDate'
              )
              .eq('IRN', irn)

            if (error) throw error

            const out: Decision[] = []
              ; (data || []).forEach((row: any) => {
                const submissionType = `${row.IncidentType} - Form18 Notification`

                // 1) EmployerAccepted — include when status is EmployerAccepted OR later (NotifiedToWorker/WorkerAccepted)
                if (['EmployerAccepted', 'NotifiedToWorker', 'WorkerAccepted'].includes(row.F18MStatus)) {
                  out.push({
                    IRN: row.IRN,
                    submissionType,
                    status: 'EmployerAccepted',
                    reason: row.F18MEmployerDecisionReason ?? '--',
                    takenBy: 'Employer',
                    decisionDate: pretty(row.F18MEmployerAcceptedDate),
                    decisionDateRaw: row.F18MEmployerAcceptedDate,
                  })
                }

                // 2) Notified to Worker — include when status is NotifiedToWorker OR later (WorkerAccepted)
                if (['NotifiedToWorker', 'WorkerAccepted'].includes(row.F18MStatus)) {
                  out.push({
                    IRN: row.IRN,
                    submissionType,
                    status: 'Notified to Worker', // note the spaced label
                    reason: '--',
                    takenBy: cpoNameForForm18,
                    decisionDate: pretty(row.F18MWorkerNotifiedDate),
                    decisionDateRaw: row.F18MWorkerNotifiedDate,
                  })
                }

                // 3) WorkerAccepted — include only when status is WorkerAccepted
                if (row.F18MStatus === 'WorkerAccepted') {
                  out.push({
                    IRN: row.IRN,
                    submissionType,
                    status: 'WorkerAccepted',
                    reason: row.F18MWorkerDecisionReason ?? '--',
                    takenBy: 'Worker',
                    decisionDate: pretty(row.F18MWorkerNotifiedDate),
                    decisionDateRaw: row.F18MWorkerAcceptedDate,
                  })
                }
              })

            return out
          })(),

          // Approved Claims CPO Review (ModalACCR) — replicate legacy logic for status/takenBy + enrich with CPO name
          (async () => {
            const rows = accpRows || []
            return rows.map((row: any) => {
              let status: string
              let takenBy: string
              const staff = row.LockedByCPOID ? staffMap.get(Number(row.LockedByCPOID)) : undefined
              const cpoName = staff?.name ? `${staff.name} (Provincial Claims Officer)` : 'Provincial Claims Officer'

              if (row.CPORStatus !== 'CompensationCalculated') {
                if (!row.LockedByCPOID || Number(row.LockedByCPOID) === 0) {
                  status = 'Review Pending'
                  takenBy = 'Provincial Claims Officer'
                } else {
                  status = 'Review in Progress'
                  takenBy = cpoName
                }
              } else {
                status = 'Compensation Calculated'
                takenBy = cpoName
              }

              return {
                IRN: row.IRN,
                submissionType: row.IncidentType,
                status,
                reason: '--',
                takenBy,
                decisionDate: pretty(row.CPORApprovedDate),
                decisionDateRaw: row.CPORApprovedDate,
              } as Decision
            })
          })(),

          // Compensation Calculation Registrar Review (ModelCCR)
          fetchCCR(),

          // Compensation Calculation Commissioner Review (ModelCCCR)
          fetchAndFormat(
            'compensationcalculationcommissionersreview',
            'IRN, IncidentType, CCCRReviewStatus, CCCRDecisionReason, CCCRDecisionDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: row.IncidentType,
              status: row.CCCRReviewStatus,
              reason: row.CCCRDecisionReason,
              takenBy: (row.CCCRReviewStatus || '').startsWith('Chief') ? 'Chief Commissioner' : 'Commissioner',
              decisionDate: pretty(row.CCCRDecisionDate),
              decisionDateRaw: row.CCCRDecisionDate,
            })
          ),

          // Compensation Calculation CPM Review (ModelCCCPM) — enrich takenBy with CPM name when we know the region
          fetchAndFormat(
            'compensationcalculationcpmreview',
            'IRN, IncidentType, CPMRStatus, CPMRDecisionReason, CPMRDecisionDate',
            (row: any) => {
              // Pick the first region we learned (legacy took it from CPO name)
              const region = regions[0]
              const cpmName = region ? cpmByRegion.get(region) : undefined
              return {
                IRN: row.IRN,
                submissionType: row.IncidentType,
                status: row.CPMRStatus,
                reason: row.CPMRDecisionReason,
                takenBy: cpmName || 'CPM',
                decisionDate: pretty(row.CPMRDecisionDate),
                decisionDateRaw: row.CPMRDecisionDate,
              }
            }
          ),

          // Commissioner after Award (ModalCACR)
          fetchAndFormat(
            'claimsawardedcommissionersreview',
            'IRN, IncidentType, CACRReviewStatus, CACRDecisionReason, CACRDecisionDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: row.IncidentType,
              status: row.CACRReviewStatus,
              reason: row.CACRDecisionReason,
              takenBy: (row.CACRReviewStatus || '').startsWith('Chief') ? 'Chief Commissioner' : 'Commissioner',
              decisionDate: pretty(row.CACRDecisionDate),
              decisionDateRaw: row.CACRDecisionDate,
            })
          ),

          // Registrar after Award (ModalCARR)
          fetchAndFormat(
            'claimsawardedregistrarreview',
            'IRN, IncidentType, CARRReviewStatus, CARRDecisionReason, CARRDecisionDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: row.IncidentType,
              status: row.CARRReviewStatus,
              reason: row.CARRDecisionReason,
              takenBy: 'Registrar',
              decisionDate: pretty(row.CARRDecisionDate),
              decisionDateRaw: row.CARRDecisionDate,
            })
          ),

          /*
          // ─────────────────────────────────────────────────────────────────────
          // TRIBUNAL (Time-barred) — COMMENTED OUT. Uncomment to include later.
          // Legacy equivalents: ModelTHS (schedule), ModelTHO (outcome), tribunalreview

          // Time-barred Tribunal Hearing Schedule (ModelTHS)
          fetchAndFormat(
            'tribunalhearingschedule',
            'IRN, THSHearingType, THSHearingStatus, THSDecisionDate',
            (row: any) => {
              const ht: string = row.THSHearingType || ''
              const ht1 = ht === 'Form7EmployerRejectedOtherReason' ? 'Form7' : ht.substring(10, 16)
              return {
                IRN: row.IRN,
                submissionType: `${ht1} - TimeBarred`,
                status: row.THSHearingStatus || 'Pending',
                reason: 'To Be Taken',
                takenBy: 'Tribunal',
                decisionDate: pretty(row.THSDecisionDate),
                decisionDateRaw: row.THSDecisionDate,
              }
            }
          ),

          // Time-barred Tribunal Hearing Outcome (ModelTHO)
          fetchAndFormat(
            'tribunalhearingoutcome',
            'IRN, THOStatus, THODetails, THODecisionDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: 'Tribunal Outcome - TimeBarred',
              status: row.THOStatus || '',
              reason: row.THODetails || '',
              takenBy: 'Tribunal',
              decisionDate: pretty(row.THODecisionDate),
              decisionDateRaw: row.THODecisionDate,
            })
          ),

          // Tribunal Review (general)
          fetchAndFormat(
            'tribunalreview',
            'IRN, TRReviewStatus, TRReviewReason, TRReviewDate',
            (row: any) => ({
              IRN: row.IRN,
              submissionType: 'Tribunal Review',
              status: row.TRReviewStatus,
              reason: row.TRReviewReason,
              takenBy: 'Tribunal',
              decisionDate: pretty(row.TRReviewDate),
              decisionDateRaw: row.TRReviewDate,
            })
          ),
          // ─────────────────────────────────────────────────────────────────────
          */
        ])

        let allDecisions = decisionsParts.flat()

        // Lookup DisplayIRN (optional, used elsewhere in UI)
        if (allDecisions.length) {
          const irns = Array.from(new Set(allDecisions.map(d => d.IRN).filter(Boolean))) as number[]
          if (irns.length) {
            const { data: irnRows } = await supabase
              .from('form1112master')
              .select('IRN, DisplayIRN')
              .in('IRN', irns)
            const map = new Map<number, string>()
            irnRows?.forEach((r: any) => map.set(r.IRN, r.DisplayIRN))
            allDecisions = allDecisions.map(d => ({ ...d, displayIRN: d.IRN ? map.get(d.IRN) || 'N/A' : 'N/A' }))
          }
        }

        // Order by decision date (latest first)
        const toEpoch = (s?: string) => {
          const t = s ? Date.parse(s) : NaN
          return isNaN(t) ? -Infinity : t
        }
        //  allDecisions.sort((a, b) => toEpoch(b.decisionDateRaw) - toEpoch(a.decisionDateRaw)) //latest first
        allDecisions.sort((a, b) => toEpoch(a.decisionDateRaw) - toEpoch(b.decisionDateRaw)) //earliest first


        // Payments
        const paymentsOut: PaymentDetail[] = []
        const { data: badm } = await supabase
          .from('bankaccountdepositmaster')
          .select('BankName, EbankReferenceNo, EbankIssuedDate, EbankAmountPaid')
          .eq('IRN', irn)
        if (badm && badm.length) {
          const totalPaid = badm.reduce((sum, row) => sum + Number(row.EbankAmountPaid ?? 0), 0)
          const b = badm[0] // use first record for metadata like bank/ref
          paymentsOut.push({
            bankName: b.BankName,
            chequeNo: b.EbankReferenceNo,
            issueDate: pretty(b.EbankIssuedDate),
            compensationAmount: totalPaid.toLocaleString(), // ✅ Sum of all splits
            issuedBy: 'Insurance Provider',
          })
        }
        const { data: occd } = await supabase
          .from('owcclaimchequedetails')
          .select('OCCDBankName, OCCDChequeNumber, OCCDIssueDate, OCCDChequeAmount')
          .eq('IRN', irn)
        if (occd && occd.length) {
          const o = occd[0]
          paymentsOut.push({
            bankName: o.OCCDBankName,
            chequeNo: o.OCCDChequeNumber,
            issueDate: pretty(o.OCCDIssueDate),
            compensationAmount: o.OCCDChequeAmount,
            issuedBy: 'OWC Trust',
          })
        }

        setDecisions(allDecisions)
        setPayments(paymentsOut)
      } catch (e: any) {
        console.error(e)
        setError(e?.message || 'Failed to load case data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [irn])

  if (loading) return <div className="p-4 text-center text-gray-600">Loading...</div>
  if (error) return <div className="p-4 text-center text-red-600">{error}</div>

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Case History</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 border">Submission Type</th>
              <th className="px-2 py-1 border">Status of Approval</th>
              <th className="px-2 py-1 border">Decision Reason</th>
              <th className="px-2 py-1 border">Decision Taken By</th>
              <th className="px-2 py-1 border">Decision Date</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                <td className="px-2 py-1 border">{d.submissionType}</td>
                <td className="px-2 py-1 border">{d.status}</td>
                <td className="px-2 py-1 border">{d.reason || '--'}</td>
                <td className="px-2 py-1 border">{d.takenBy}</td>
                <td className="px-2 py-1 border">{d.decisionDate || '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payments.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Payment Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 border">Bank Name</th>
                  <th className="px-2 py-1 border">Cheque No.</th>
                  <th className="px-2 py-1 border">Issue Date</th>
                  <th className="px-2 py-1 border">Compensation Amount</th>
                  <th className="px-2 py-1 border">Issued By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} className="odd:bg-white even:bg-gray-50">
                    <td className="px-2 py-1 border">{p.bankName}</td>
                    <td className="px-2 py-1 border">{p.chequeNo}</td>
                    <td className="px-2 py-1 border">{p.issueDate}</td>
                    <td className="px-2 py-1 border">{p.compensationAmount}</td>
                    <td className="px-2 py-1 border">{p.issuedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ListClaimDecisions
