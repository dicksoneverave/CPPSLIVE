import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar
} from "recharts";
import { supabase } from "../../services/supabase";
import { Download, Printer } from "lucide-react";

type Row = { province: string; injury: number; death: number; total: number };

const palette = ['#0ea5e9', '#ef4444']; // Injury, Death
const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

const ShimmerChart: React.FC = () => (
  <div className="h-80 rounded-lg bg-white shadow p-4 animate-pulse">
    <div className="h-6 w-1/3 bg-gray-200 rounded mb-4" />
    <div className="h-64 bg-gray-100 rounded" />
  </div>
);

interface Props {
  year: number;
}

const GeneralAccidentProvinceReport: React.FC<Props> = ({ year }) => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;

  const printableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setRows([]);

        // Pull province + incident type within the year window
        const { data, error } = await supabase
          .from("form1112master")
          .select("IncidentProvince, IncidentType, FirstSubmissionDate")
          .gte("FirstSubmissionDate", startISO)
          .lt("FirstSubmissionDate", endISO);

        if (error) throw error;

        // Aggregate by province for Injury/Death
        const agg = new Map<string, { injury: number; death: number }>();
        (data ?? []).forEach((r: any) => {
          const prov = (r.IncidentProvince ?? "Unknown").toString().trim() || "Unknown";
          const type = (r.IncidentType ?? "").toString();
          const slot = agg.get(prov) ?? { injury: 0, death: 0 };
          if (type === "Injury") slot.injury += 1;
          else if (type === "Death") slot.death += 1;
          agg.set(prov, slot);
        });

        const out: Row[] = Array.from(agg.entries())
          .map(([province, v]) => ({
            province,
            injury: v.injury,
            death: v.death,
            total: v.injury + v.death,
          }))
          .sort((a, b) => a.province.localeCompare(b.province));

        setRows(out);
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.injury += r.injury;
          acc.death += r.death;
          acc.total += r.total;
          return acc;
        },
        { injury: 0, death: 0, total: 0 }
      ),
    [rows]
  );

  const exportCSV = () => {
    try {
      const header = "Province,Injury,Death,Total\n";
      const content = rows
        .map((r) => `${r.province},${r.injury},${r.death},${r.total}`)
        .join("\n");
      const totalLine = `Total,${totals.injury},${totals.death},${totals.total}\n`;
      const csv = header + content + "\n" + totalLine;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Accident_Province_Injury_Death_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CSV export failed", e);
    }
  };

  const printPDF = () => {
    // Print layout mimics the PHP export header: crest, office title, CPPS Report title.
    try {
      window.print();
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Print header (hidden on screen, visible in print) */}
      <div className="hidden print:block text-center mb-2">
        <img
          src={CREST_URL}
          alt="Crest"
          style={{ height: 64, display: "inline-block" }}
        />
        <div className="font-semibold mt-2">Office of Workers Compensation</div>
        <div className="mt-1">
          CPPS Report: Accident Province wise - Accident Type Report
        </div>
        <div className="text-sm mt-1">Year: {year}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 print:hidden">
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
          title="Export CSV"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
        <button
          onClick={printPDF}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
          title="Print / Save as PDF"
        >
          <Printer className="h-4 w-4" />
          PDF
        </button>
        <div className="ml-auto text-sm text-gray-500">
          Total: <span className="font-medium">{totals.total}</span>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <ShimmerChart />
      ) : (
        <div
          className="bg-white rounded-lg shadow p-4"
          ref={printableRef}
          id="acc-prov-report"
        >
          <h3 className="text-lg font-semibold mb-4">
            Accident Province wise – Accident Type · Year {year} · Total:{" "}
            {totals.total}
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="province" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="injury" name="Injury" fill={palette[0]} />
                <Bar dataKey="death" name="Death" fill={palette[1]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="text-base font-semibold mb-3">Details</h4>
        {loading ? (
          <div className="animate-pulse">
            <div className="h-6 bg-gray-100 rounded mb-2" />
            <div className="h-6 bg-gray-100 rounded mb-2" />
            <div className="h-6 bg-gray-100 rounded mb-2" />
          </div>
        ) : err ? (
          <div className="bg-red-50 text-red-700 p-3 rounded">{err}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500">No records found for {year}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-primary-600 text-white">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                    Province
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                    Injury
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                    Death
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {rows.map((r) => (
                  <tr key={r.province}>
                    <td className="px-4 py-2">{r.province}</td>
                    <td className="px-4 py-2">{r.injury}</td>
                    <td className="px-4 py-2">{r.death}</td>
                    <td className="px-4 py-2 font-medium">{r.total}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 font-semibold">{totals.injury}</td>
                  <td className="px-4 py-2 font-semibold">{totals.death}</td>
                  <td className="px-4 py-2 font-semibold">{totals.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print stylesheet: print only the report + header */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block { display: block !important; }
          #acc-prov-report, #acc-prov-report * { visibility: visible; }
          #acc-prov-report { position: absolute; left: 0; top: 120px; width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default GeneralAccidentProvinceReport;
