import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Download } from "lucide-react";
import { supabase } from "../../services/supabase";

type Props = {
  /** Defaults to the PHP report heading; override if you want a different label in the UI/PDF. */
  title?: string;
  /** Standalone mode (legacy): if you don’t pass `year`, it will use this as the starting year and show its own controls. */
  initialYear?: number;
  /** Controlled mode from parent (ReportsDashboard): pass `year` and set `showControls={false}` to hide internal year picker. */
  year?: number;
  /** Force showing/hiding header controls. Defaults to !controlled. */
  showControls?: boolean;
};

type IncRow = { WorkerID: string; FirstSubmissionDate: string; IncidentType: string };
type WorkerRow = { WorkerID: string; WorkerGender: string | null };

type TableRow = {
  gender: string;
  Injury: number;
  Death: number;
  total: number;
};

const crestUrl =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

const palette = ["#0ea5e9", "#ef4444", "#22c55e", "#8b5cf6", "#f59e0b", "#14b8a6"];

function normalizeGender(g?: string | null): "Male" | "Female" | "Unknown" {
  const v = (g || "").trim().toLowerCase();
  if (v === "m" || v === "male") return "Male";
  if (v === "f" || v === "female") return "Female";
  return "Unknown";
}

const WorkerGenderAccidentTypeReport: React.FC<Props> = ({
  title = "Accident Types by Worker Gender",
  initialYear,
  year,
  showControls,
}) => {
  const isControlled = typeof year === "number";
  const [localYear, setLocalYear] = useState<number>(initialYear ?? new Date().getFullYear());
  const activeYear = isControlled ? (year as number) : localYear;
  const renderControls = showControls ?? !isControlled;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<TableRow[]>([]);
  const [total, setTotal] = useState(0);

  const captureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setRows([]);
        setTotal(0);

        const startISO = `${activeYear}-01-01`;
        const endISO = `${activeYear + 1}-01-01`;

        // Pull incidents for the year
        const { data: inc, error: incErr } = await supabase
          .from("form1112master")
          .select("WorkerID, FirstSubmissionDate, IncidentType")
          .gte("FirstSubmissionDate", startISO)
          .lt("FirstSubmissionDate", endISO);
        if (incErr) throw incErr;

        const incidents = (inc ?? []) as IncRow[];
        if (!incidents.length) {
          setRows([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        // Get genders for the involved workers
        const workerIds = Array.from(new Set(incidents.map(i => i.WorkerID).filter(Boolean)));
        let gmap = new Map<string, string | null>();
        if (workerIds.length) {
          const { data: w, error: wErr } = await supabase
            .from("workerpersonaldetails")
            .select("WorkerID, WorkerGender")
            .in("WorkerID", workerIds);
          if (wErr) throw wErr;
          for (const r of (w ?? []) as WorkerRow[]) gmap.set(r.WorkerID, r.WorkerGender ?? null);
        }

        const agg = new Map<string, { Injury: number; Death: number; total: number }>();
        for (const r of incidents) {
          const g = normalizeGender(gmap.get(r.WorkerID) ?? null);
          const ex = agg.get(g) ?? { Injury: 0, Death: 0, total: 0 };
          if (String(r.IncidentType) === "Death") ex.Death += 1;
          else ex.Injury += 1;
          ex.total += 1;
          agg.set(g, ex);
        }

        const order: Array<"Male" | "Female" | "Unknown"> = ["Male", "Female", "Unknown"];
        const table: TableRow[] = order
          .filter(g => agg.has(g))
          .map(g => ({ gender: g, ...agg.get(g)!, total: agg.get(g)!.total }));

        setRows(table);
        setTotal(table.reduce((s, r) => s + r.total, 0));
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? "Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, [activeYear]);

  const colors = useMemo(() => {
    return {
      Injury: palette[0],
      Death: palette[1],
    };
  }, []);

  const exportCSV = () => {
    if (!rows.length) return;
    const header = "Gender,Injury,Death,Total\n";
    const body = rows.map(r => `${r.gender},${r.Injury},${r.Death},${r.total}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Accident_Types_by_Worker_Gender_${activeYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!captureRef.current) return;

    const canvas = await html2canvas(captureRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#FFFFFF",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 36;
    const cursorX = marginX;
    let cursorY = 36;

    // Crest
    try {
      const crestImg = await fetch(crestUrl).then(r => r.blob()).then(URL.createObjectURL);
      pdf.addImage(crestImg, "PNG", pageWidth / 2 - 24, cursorY, 48, 48);
    } catch {}
    cursorY += 60;

    // Headings — mimic PHP style
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Office of Workers Compensation", pageWidth / 2, cursorY, { align: "center" });
    cursorY += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(`CPPS Report: ${title}`, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 14;
    pdf.text(`Year: ${activeYear}`, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 18;

    // Captured content (chart + table)
    const maxWidth = pageWidth - marginX * 2;
    const imgW = maxWidth;
    const ratio = canvas.height / canvas.width;
    const imgH = imgW * ratio;
    pdf.addImage(imgData, "PNG", cursorX, cursorY, imgW, imgH);

    pdf.save(`Accident_Types_by_Worker_Gender_${activeYear}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Header line (internal controls only when not controlled) */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>

        {renderControls && (
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 border rounded"
              onClick={() => setLocalYear(y => y - 1)}
              aria-label="Previous year"
            >
              ←
            </button>
            <input
              type="number"
              className="w-24 px-2 py-1 border rounded"
              value={activeYear}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) setLocalYear(v);
              }}
            />
            <button
              className="px-2 py-1 border rounded"
              onClick={() => setLocalYear(y => y + 1)}
              aria-label="Next year"
            >
              →
            </button>
            <button
              className="px-2 py-1 border rounded"
              onClick={() => setLocalYear(new Date().getFullYear())}
            >
              This Year
            </button>
          </div>
        )}
      </div>

      {/* Content to capture for PDF */}
      <div ref={captureRef} className="space-y-4">
        {/* Chart */}
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-medium mb-3">
            Year {activeYear} · Total: {total}
          </h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="gender" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {/* Stacked Injury + Death by gender */}
                <Bar dataKey="Injury" name="Injury" stackId="a" fill={colors.Injury}>
                  {rows.map((_, i) => <Cell key={i} fill={colors.Injury} />)}
                </Bar>
                <Bar dataKey="Death" name="Death" stackId="a" fill={colors.Death}>
                  {rows.map((_, i) => <Cell key={i} fill={colors.Death} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-medium mb-3">Details</h4>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-1/3 bg-gray-200 rounded" />
                <div className="h-6 bg-gray-100 rounded" />
                <div className="h-6 bg-gray-100 rounded" />
                <div className="h-6 bg-gray-100 rounded" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-gray-500">No records found.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-primary text-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Gender</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Injury</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Death</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                  {rows.map((r) => (
                    <tr key={r.gender}>
                      <td className="px-4 py-2">{r.gender}</td>
                      <td className="px-4 py-2">{r.Injury}</td>
                      <td className="px-4 py-2">{r.Death}</td>
                      <td className="px-4 py-2 font-medium">{r.total}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-2">Grand Total</td>
                    <td className="px-4 py-2">
                      {rows.reduce((s, r) => s + r.Injury, 0)}
                    </td>
                    <td className="px-4 py-2">
                      {rows.reduce((s, r) => s + r.Death, 0)}
                    </td>
                    <td className="px-4 py-2">
                      {rows.reduce((s, r) => s + r.total, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Exports */}
      <div className="flex items-center gap-2">
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
          title="Export CSV"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
        <button
          onClick={exportPDF}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
          title="Download PDF"
        >
          <Download className="h-4 w-4" />
          PDF
        </button>
      </div>
    </div>
  );
};

export default WorkerGenderAccidentTypeReport;
