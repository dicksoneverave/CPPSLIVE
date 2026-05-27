import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';

interface YearTotalsCardsProps {
  year?: number; // default current year
}

const ShimmerRow: React.FC = () => (
  <div className="animate-pulse h-16 bg-gray-100 rounded" />
);

const YearTotalsCards: React.FC<YearTotalsCardsProps> = ({ year = new Date().getFullYear() }) => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [f11, setF11] = useState(0);
  const [f12, setF12] = useState(0);
  const [f3, setF3] = useState(0);
  const [f4, setF4] = useState(0);

  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const [injury, death, form3, form4] = await Promise.all([
          supabase
            .from('form1112master')
            .select('IRN', { count: 'exact', head: true })
            .eq('IncidentType', 'Injury')
            .gte('FirstSubmissionDate', startISO)
            .lt('FirstSubmissionDate', endISO),
          supabase
            .from('form1112master')
            .select('IRN', { count: 'exact', head: true })
            .eq('IncidentType', 'Death')
            .gte('FirstSubmissionDate', startISO)
            .lt('FirstSubmissionDate', endISO),
          supabase
            .from('form3master')
            .select('IRN', { count: 'exact', head: true })
            .gte('Form3SubmissionDate', startISO)
            .lt('Form3SubmissionDate', endISO),
          supabase
            .from('form4master')
            .select('IRN', { count: 'exact', head: true })
            .gte('Form4SubmissionDate', startISO)
            .lt('Form4SubmissionDate', endISO),
        ]);

        if (injury.error) throw injury.error;
        if (death.error) throw death.error;
        if (form3.error) throw form3.error;
        if (form4.error) throw form4.error;

        setF11(injury.count ?? 0);
        setF12(death.count ?? 0);
        setF3(form3.count ?? 0);
        setF4(form4.count ?? 0);
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? 'Failed to load year totals');
      } finally {
        setLoading(false);
      }
    })();
  }, [startISO, endISO]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {err && (
        <div className="col-span-4 bg-red-50 text-red-700 p-3 rounded">{err}</div>
      )}

      {loading ? (
        <>
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
        </>
      ) : (
        <>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-xs text-gray-600">Form 11 (Injury) this year</div>
            <div className="text-2xl font-bold text-blue-700">{f11}</div>
          </div>
          <div className="bg-rose-50 p-4 rounded-lg">
            <div className="text-xs text-gray-600">Form 12 (Death) this year</div>
            <div className="text-2xl font-bold text-rose-700">{f12}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-lg">
            <div className="text-xs text-gray-600">Form 3 (Injury) this year</div>
            <div className="text-2xl font-bold text-emerald-700">{f3}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="text-xs text-gray-600">Form 4 (Death) this year</div>
            <div className="text-2xl font-bold text-amber-700">{f4}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default YearTotalsCards;
