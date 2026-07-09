import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Cell,
} from "recharts";
import { supabase } from "../../services/supabase";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type MonthDatum = { label: string; count: number };

const monthLabels = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
];

const palette = [
  "#0ea5e9","#22c55e","#f59e0b","#ef4444","#8b5cf6","#14b8a6",
  "#f97316","#eab308","#06b6d4","#84cc16","#ec4899","#10b981"
];

const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function groupByMonth(dates: string[]): MonthDatum[] {
  const buckets = new Array(12).fill(0);
  for (const iso of dates) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) buckets[d.getMonth()] += 1;
  }
  return buckets.map((count, i) => ({ label: monthLabels[i], count }));
}

async function loadMonthlyFromForm1112(
  year: number,
  filterType: 'Annual' | 'Monthly' | 'Quarterly' = 'Annual',
  month: number = 1,
  quarter: number = 1
): Promise<MonthDatum[]> {
  let startISO = `${year}-01-01`;
  let endISO = `${year + 1}-01-01`;

  if (filterType === 'Monthly' && month) {
    const m = month < 10 ? `0${month}` : month;
    startISO = `${year}-${m}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nm = nextMonth < 10 ? `0${nextMonth}` : nextMonth;
    endISO = `${nextYear}-${nm}-01`;
  } else if (filterType === 'Quarterly' && quarter) {
    const qMap: any = { 1: ['01', '04'], 2: ['04', '07'], 3: ['07', '10'], 4: ['10', '01'] };
    startISO = `${year}-${qMap[quarter][0]}-01`;
    endISO = `${quarter === 4 ? year + 1 : year}-${qMap[quarter][1]}-01`;
  }

  const { data, error } = await supabase
    .from("form1112master")
    .select("FirstSubmissionDate")
    .gte("FirstSubmissionDate", startISO)
    .lt("FirstSubmissionDate", endISO);

  if (error) throw error;
  const dates = (data ?? [])
    .map((r: any) => r.FirstSubmissionDate as string)
    .filter(Boolean);
  return groupByMonth(dates);
}

interface CCPMCCStatsReportProps {
  year: number;
  filterType?: 'Annual' | 'Monthly' | 'Quarterly';
  month?: number;
  quarter?: number;
}

const CCPMCCStatsReport: React.FC<CCPMCCStatsReportProps> = ({
  year,
  filterType = 'Annual',
  month = 1,
  quarter = 1,
}) => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [monthly, setMonthly] = useState<MonthDatum[]>([]);

  const periodLabel = useMemo(() => {
    if (filterType === 'Annual') return String(year);
    if (filterType === 'Monthly') {
      return `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;
    }
    return `Q${quarter} (${['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'][quarter - 1]}) ${year}`;
  }, [year, filterType, month, quarter]);

  const filePeriod = useMemo(() => {
    if (filterType === 'Annual') return String(year);
    if (filterType === 'Monthly') {
      return `${new Date(year, month - 1).toLocaleString('default', { month: 'short' })}${year}`;
    }
    return `Q${quarter}_${year}`;
  }, [year, filterType, month, quarter]);

  const chartData = useMemo(() => {
    if (filterType === 'Monthly') {
      return monthly.filter((_, idx) => idx === month - 1);
    }
    if (filterType === 'Quarterly') {
      const startIdx = (quarter - 1) * 3;
      return monthly.slice(startIdx, startIdx + 3);
    }
    return monthly;
  }, [monthly, filterType, month, quarter]);

  const total = useMemo(() => chartData.reduce((s, d) => s + d.count, 0), [chartData]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const m = await loadMonthlyFromForm1112(year, filterType, month, quarter);
        setMonthly(m);
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? "Failed to load CCPMCC stats");
      } finally {
        setLoading(false);
      }
    })();
  }, [year, filterType, month, quarter]);

  const onDownloadPDF = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      let cursorY = 40;

      const crest = await imageUrlToDataUrl(CREST_URL);
      if (crest) {
        const crestW = 60;
        const crestH = 60;
        doc.addImage(crest, "PNG", (pageWidth - crestW) / 2, cursorY, crestW, crestH);
        cursorY += crestH + 10;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Office of Workers Compensation", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 22;

      doc.setFontSize(12);
      doc.text(`CPPS Report: CCPMCC Stats (All)`, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 18;

      doc.setFont("helvetica", "normal");
      doc.text(`Period: ${periodLabel}`, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 20;

      const filteredMonthly = monthly.filter((_, idx) => {
        if (filterType === 'Monthly') return idx === month - 1;
        if (filterType === 'Quarterly') {
          const startIdx = (quarter - 1) * 3;
          return idx >= startIdx && idx < startIdx + 3;
        }
        return true;
      });

      const tableBody = filteredMonthly.map((r) => [r.label, r.count]);
      autoTable(doc, {
        head: [["Month", "Count"]],
        body: tableBody,
        startY: cursorY,
        styles: { fontSize: 10, halign: "left" },
        headStyles: { fillColor: [14, 165, 233], textColor: 255 },
        columnStyles: { 1: { halign: "right" } },
        margin: { left: 40, right: 40 },
        didDrawPage: (data) => {
          const y = data.cursor.y + 10;
          doc.setFont("helvetica", "bold");
          doc.text(`Total: ${total}`, pageWidth - 40, y, { align: "right" });
        },
      });

      doc.save(`CCPMCC_Stats_${filePeriod}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={onDownloadPDF}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          PDF
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">
          Monthly Cases (Form 11 & 12) — {periodLabel} · Total: {total}
        </h3>
        {err && <div className="bg-red-50 text-red-700 p-2 rounded mb-3">{err}</div>}
        {loading ? (
          <div className="h-80 animate-pulse bg-gray-100 rounded" />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Cases">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="text-md font-semibold mb-2">Breakdown ({periodLabel})</h4>
        {loading ? (
          <div className="h-32 animate-pulse bg-gray-100 rounded" />
        ) : chartData.every((m) => m.count === 0) ? (
          <div className="text-sm text-gray-500">No records for {periodLabel}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="app-thead">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Month
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-sm">
                {chartData.map((r) => (
                  <tr key={r.label}>
                    <td className="px-4 py-2">{r.label}</td>
                    <td className="px-4 py-2 text-right">{r.count}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-4 py-2 text-right">Total</td>
                  <td className="px-4 py-2 text-right">{total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CCPMCCStatsReport;
