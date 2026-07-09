import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { FileDown, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type MonthRow = {
  label: string; // Jan, Feb...
  inj_single: number;
  inj_married: number;
  death_single: number;
  death_married: number;
};
type TotalsRow = { status: "Single" | "Married"; injuries: number; deaths: number; total: number };

const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// palette (keep consistent with your app)
const COLORS = {
  inj_single: "#0ea5e9",   // sky-500
  inj_married: "#22c55e",  // green-500
  death_single: "#ef4444", // red-500
  death_married: "#8b5cf6" // violet-500
};

function emptyYear(): MonthRow[] {
  return monthLabels.map(l => ({
    label: l,
    inj_single: 0, inj_married: 0, death_single: 0, death_married: 0
  }));
}

function toMonthIndex(iso: string): number | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.getMonth();
}

interface EmployerMaritalStatusReportProps {
  year: number;
  filterType?: 'Annual' | 'Monthly' | 'Quarterly';
  month?: number;
  quarter?: number;
  title?: string;
}

export default function EmployerMaritalStatusReport({
  year,
  filterType = 'Annual',
  month = 1,
  quarter = 1,
  title = "Accident Types based on Marital Status",
}: EmployerMaritalStatusReportProps) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [monthly, setMonthly] = useState<MonthRow[]>(emptyYear());
  const [totals, setTotals] = useState<TotalsRow[]>([
    { status: "Single", injuries: 0, deaths: 0, total: 0 },
    { status: "Married", injuries: 0, deaths: 0, total: 0 },
  ]);

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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

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

        // Pull the period’s Form11/12 rows first
        const { data: forms, error: fErr } = await supabase
          .from("form1112master")
          .select("IRN, WorkerID, IncidentType, FirstSubmissionDate")
          .gte("FirstSubmissionDate", startISO)
          .lt("FirstSubmissionDate", endISO);
        if (fErr) throw fErr;

        // Map WorkerID → marital flag (1 = married, 0 = single)
        const workerIds = Array.from(new Set((forms ?? []).map(r => String(r.WorkerID))));
        let marriedByWorker: Record<string, "Married" | "Single"> = {};
        if (workerIds.length) {
          const { data: ppl, error: pErr } = await supabase
            .from("workerpersonaldetails")
            .select("WorkerID, WorkerMarried")
            .in("WorkerID", workerIds);
          if (pErr) throw pErr;
          marriedByWorker = Object.fromEntries(
            (ppl ?? []).map(r => [
              String(r.WorkerID),
              (String(r.WorkerMarried) === "1" ? "Married" : "Single") as "Married" | "Single"
            ])
          );
        }

        // Build monthly + totals
        const m = emptyYear();
        let tot = { Single: { injuries: 0, deaths: 0 }, Married: { injuries: 0, deaths: 0 } };

        for (const row of forms ?? []) {
          const status = marriedByWorker[String(row.WorkerID)] ?? "Single";
          const mi = toMonthIndex(row.FirstSubmissionDate);
          if (mi === null) continue;

          if (row.IncidentType === "Injury") {
            if (status === "Single") { m[mi].inj_single += 1; tot.Single.injuries += 1; }
            else { m[mi].inj_married += 1; tot.Married.injuries += 1; }
          } else if (row.IncidentType === "Death") {
            if (status === "Single") { m[mi].death_single += 1; tot.Single.deaths += 1; }
            else { m[mi].death_married += 1; tot.Married.deaths += 1; }
          }
        }

        setMonthly(m);
        setTotals([
          { status: "Single",  injuries: tot.Single.injuries,  deaths: tot.Single.deaths,  total: tot.Single.injuries + tot.Single.deaths },
          { status: "Married", injuries: tot.Married.injuries, deaths: tot.Married.deaths, total: tot.Married.injuries + tot.Married.deaths },
        ]);
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? "Failed to load report.");
      } finally {
        setLoading(false);
      }
    })();
  }, [year, filterType, month, quarter]);

  const grandTotal = useMemo(
    () => totals.reduce((s, r) => s + r.total, 0),
    [totals]
  );

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

  // ---------- EXPORTS ----------
  const exportCSV = () => {
    const header = ["Month","Injury (Single)","Injury (Married)","Death (Single)","Death (Married)"];
    const filteredRows = monthly.filter((_, idx) => {
      if (filterType === 'Monthly') return idx === month - 1;
      if (filterType === 'Quarterly') {
        const startIdx = (quarter - 1) * 3;
        return idx >= startIdx && idx < startIdx + 3;
      }
      return true;
    });
    const rows = filteredRows.map(r => [r.label, r.inj_single, r.inj_married, r.death_single, r.death_married]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `MaritalStatus_${filePeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    const crestUrl = "/images/crest.png";

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Header crest
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = crestUrl;
      await new Promise(res => { img.onload = res; img.onerror = res; });
      const w = 64, h = 64;
      doc.addImage(img, "PNG", (pageW - w)/2, 28, w, h);
    } catch {}

    // Titles
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Office of Workers Compensation", pageW/2, 110, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`CPPS Report: Accident Types based on Marital Status (${periodLabel})`, pageW/2, 130, { align: "center" });

    // Summary table
    const head = [["Marital Status","Injury","Death","Total"]];
    const body = totals.map(t => [t.status, String(t.injuries), String(t.deaths), String(t.total)]);
    body.push(["Grand Total", String(totals[0].injuries + totals[1].injuries), String(totals[0].deaths + totals[1].deaths), String(grandTotal)]);

    autoTable(doc, {
      head, body,
      startY: 160,
      styles: { font: "helvetica", fontSize: 10, halign: "center" },
      headStyles: { fillColor: [220, 38, 38], textColor: 255 },
      columnStyles: { 0: { halign: "left" } },
      margin: { left: 40, right: 40 }
    });

    const filteredMonthly = monthly.filter((_, idx) => {
      if (filterType === 'Monthly') return idx === month - 1;
      if (filterType === 'Quarterly') {
        const startIdx = (quarter - 1) * 3;
        return idx >= startIdx && idx < startIdx + 3;
      }
      return true;
    });

    // Data table per month
    autoTable(doc, {
      head: [["Month","Injury (Single)","Injury (Married)","Death (Single)","Death (Married)"]],
      body: filteredMonthly.map(r => [r.label, r.inj_single, r.inj_married, r.death_single, r.death_married]),
      styles: { font: "helvetica", fontSize: 9, halign: "center" },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      margin: { left: 40, right: 40 }
    });

    doc.save(`MaritalStatus_${filePeriod}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <button className="btn flex items-center gap-1" onClick={exportCSV} title="Download CSV">
            <FileDown className="h-4 w-4" /> CSV
          </button>
          <button className="btn flex items-center gap-1" onClick={exportPDF} title="Download PDF">
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Monthly breakdown by marital status ({periodLabel})</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {/* Four coloured series */}
              <Bar dataKey="inj_single"   name="Injury · Single"  stackId="inj"   fill={COLORS.inj_single} />
              <Bar dataKey="inj_married"  name="Injury · Married" stackId="inj"   fill={COLORS.inj_married} />
              <Bar dataKey="death_single" name="Death · Single"   stackId="death" fill={COLORS.death_single} />
              <Bar dataKey="death_married"name="Death · Married"  stackId="death" fill={COLORS.death_married} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Totals table */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Totals ({periodLabel})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="app-table-head">
              <tr>
                <th className="th">Marital Status</th>
                <th className="th">Injury</th>
                <th className="th">Death</th>
                <th className="th">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {totals.map(r => (
                <tr key={r.status}>
                  <td className="td">{r.status}</td>
                  <td className="td">{r.injuries}</td>
                  <td className="td">{r.deaths}</td>
                  <td className="td font-medium">{r.total}</td>
                </tr>
              ))}
              <tr>
                <td className="td font-semibold">Grand Total</td>
                <td className="td">{totals[0].injuries + totals[1].injuries}</td>
                <td className="td">{totals[0].deaths + totals[1].deaths}</td>
                <td className="td font-bold">{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {err && <div className="bg-red-50 text-red-700 p-3 rounded">{err}</div>}
      {loading && <div className="animate-pulse h-40 bg-gray-100 rounded" />}
    </div>
  );
}
