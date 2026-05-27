import React, { useEffect, useState } from 'react';

interface Decision {
  displayIRN: string;
  submissionType: string;
  status: string;
  reason: string;
  takenBy: string;
  decisionDate: string;
}

interface PaymentDetail {
  bankName: string;
  chequeNo: string;
  issueDate: string;
  compensationAmount: string;
  issuedBy: string;
}

interface Props { irn: number }

const ListClaimDecisions: React.FC<Props> = ({ irn }) => {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`/api/case-history?irn=${encodeURIComponent(irn)}`);
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load case data');
        if (!alive) return;
        setCurrentStage(json.currentStage);
        setDecisions(json.decisions || []);
        setPayments(json.payments || []);
      } catch (e: any) {
        if (!alive) return;
        setError(e.message || 'Failed to load case data');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [irn]);

  if (loading) return <div className="p-4 text-center text-gray-600">Loading...</div>;
  if (error) return <div className="p-4 text-center text-red-600">{error}</div>;

  return (
    <div>
      <h3 className="header">Case History</h3>

      {currentStage && (
        <div className="mb-3 p-2 rounded bg-green-50 text-sm">
          <strong>Current stage:</strong> {currentStage}
        </div>
      )}

      <table className="case-table">
        <thead>
          <tr>
            <th>Display IRN</th>
            <th>Submission Type</th>
            <th>Status of Approval</th>
            <th>Decision Reason</th>
            <th>Decision Taken By</th>
            <th>Decision Date</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d, i) => (
            <tr key={i}>
              <td>{d.displayIRN || 'N/A'}</td>
              <td>{d.submissionType}</td>
              <td>{d.status}</td>
              <td>{d.reason}</td>
              <td>{d.takenBy}</td>
              <td>{d.decisionDate || '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {payments.length > 0 && (
        <>
          <h3 className="header">Payment Details</h3>
          <table className="payment-table">
            <thead>
              <tr>
                <th>Bank Name</th>
                <th>Cheque No.</th>
                <th>Issue Date</th>
                <th>Compensation Amount</th>
                <th>Issued By</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td>{p.bankName}</td>
                  <td>{p.chequeNo}</td>
                  <td>{p.issueDate}</td>
                  <td>{p.compensationAmount}</td>
                  <td>{p.issuedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default ListClaimDecisions;
