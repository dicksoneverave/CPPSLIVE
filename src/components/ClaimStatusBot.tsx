// components/ClaimStatusBot.tsx
import { useState } from 'react';

type Option = { irn: number; label: string };
type HistoryRow = { displayIRN: string; submissionType: string; status: string; reason: string; takenBy: string; decisionDate: string; };
type PaymentRow = { bankName: string; chequeNo: string; issueDate: string; compensationAmount: string; issuedBy: string; };
type StatusResponse =
  | { needsDisambiguation: true; options: Option[] }
  | { irn: number; displayIRN: string | null; currentStage: string; decisions: HistoryRow[]; payments: PaymentRow[] };

export default function ClaimStatusBot() {
  const [crn, setCrn] = useState('');
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'ask'|'choose'|'show'>('ask');
  const [options, setOptions] = useState<Option[]>([]);
  const [data, setData] = useState<Extract<StatusResponse, { needsDisambiguation?: false }> | null>(null);
  const [error, setError] = useState<string|null>(null);

  async function go() {
    setError(null);
    setLoading(true);
    setOptions([]);
    setData(null);
    try {
      const r = await fetch('/api/chat/claim-status', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          crn: crn.trim() || undefined,
          firstName: crn ? undefined : firstName.trim() || undefined,
          lastName:  crn ? undefined : lastName.trim() || undefined,
        }),
      });
      const json: StatusResponse = await r.json();
      if (!r.ok) throw new Error((json as any).error || 'Lookup failed');

      if ('needsDisambiguation' in json && json.needsDisambiguation) {
        setOptions(json.options);
        setStep('choose');
      } else {
        setData(json);
        setStep('show');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function choose(irn: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/chat/claim-status/by-irn', { // optional helper route; or reuse the same with only CRN=DisplayIRN
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ irn }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Lookup failed');
      setData(json);
      setStep('show');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl border rounded-2xl p-4 space-y-4">
      <h3 className="text-lg font-semibold">Check your claim status</h3>

      {step === 'ask' && (
        <div className="space-y-3">
          <label className="block text-sm">CRN (recommended)</label>
          <input className="w-full border rounded px-3 py-2" value={crn} onChange={e=>setCrn(e.target.value)} placeholder="e.g. CRN-000123" />
          <div className="text-xs text-gray-500">No CRN? Enter your first and last name instead.</div>

          {!crn && (
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2" value={firstName} onChange={e=>setFirst(e.target.value)} placeholder="First name" />
              <input className="border rounded px-3 py-2" value={lastName} onChange={e=>setLast(e.target.value)} placeholder="Last name" />
            </div>
          )}

          <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={go} disabled={loading || (!crn && !firstName && !lastName)}>
            {loading ? 'Checking…' : 'Check status'}
          </button>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
      )}

      {step === 'choose' && (
        <div className="space-y-3">
          <div className="text-sm">We found multiple claims. Please choose yours:</div>
          <div className="flex flex-col gap-2">
            {options.map(o => (
              <button key={o.irn} onClick={()=>choose(o.irn)} className="text-left border rounded px-3 py-2 hover:bg-gray-50">
                {o.label}
              </button>
            ))}
          </div>
          <button className="text-sm text-gray-600" onClick={()=>setStep('ask')}>Go back</button>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
      )}

      {step === 'show' && data && (
        <div className="space-y-4">
          <div className="p-3 rounded bg-green-50">
            <div className="text-sm text-gray-700">Current stage</div>
            <div className="font-semibold">{data.currentStage}</div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Case history</h4>
            <div className="overflow-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border">Display IRN</th>
                    <th className="p-2 border">Submission Type</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border">Reason</th>
                    <th className="p-2 border">Taken By</th>
                    <th className="p-2 border">Decision Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.decisions.map((d,i)=>(
                    <tr key={i}>
                      <td className="p-2 border">{d.displayIRN}</td>
                      <td className="p-2 border">{d.submissionType}</td>
                      <td className="p-2 border">{d.status}</td>
                      <td className="p-2 border">{d.reason}</td>
                      <td className="p-2 border">{d.takenBy}</td>
                      <td className="p-2 border">{d.decisionDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.payments?.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Payment details</h4>
              <div className="overflow-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 border">Bank</th>
                      <th className="p-2 border">Cheque No.</th>
                      <th className="p-2 border">Issue Date</th>
                      <th className="p-2 border">Amount</th>
                      <th className="p-2 border">Issued By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p,i)=>(
                      <tr key={i}>
                        <td className="p-2 border">{p.bankName}</td>
                        <td className="p-2 border">{p.chequeNo}</td>
                        <td className="p-2 border">{p.issueDate}</td>
                        <td className="p-2 border">{p.compensationAmount}</td>
                        <td className="p-2 border">{p.issuedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button className="text-sm text-gray-600" onClick={()=>setStep('ask')}>Look up another claim</button>
        </div>
      )}
    </div>
  );
}
