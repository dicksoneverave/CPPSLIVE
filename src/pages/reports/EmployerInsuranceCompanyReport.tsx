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

type Row = {
  ipacode: string;
  company: string;
  Injury: number;
  Death: number;
  total: number;
};

const CREST_URL =
  "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

// Two clear colors for stacked series
const seriesColors = { Injury: "#0ea5e9", Death: "#ef4444" };

// Convert remote logo to data URL for jsPDF
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

async function loadInsuranceCompanyBreakdown(year: number): Promise<Row[]> {
  const startISO = `${year}-01-01`;
  const endISO = `${year + 1}-01-01`;

  // Pull all cases for the year with InsuranceProviderIPACode + IncidentType
  const { data, error } = await supabase
    .from("form1112master")
    .select("InsuranceProviderIPACode, IncidentType, FirstSubmissionDate")
    .not("InsuranceProviderIPACode", "is", null)
    .gte("FirstSubmissionDate", startISO)
    .lt("FirstSubmissionDate", endISO);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    InsuranceProviderIPACode: string | null;
    IncidentType: string | null;
  }>;

  // Aggregate by IPACode + IncidentType
  const byCode: Record<string, { Injury: number; Death: number }> = {};
  const codes = new Set<string>();
  for (const r of rows) {
    const code = (r.InsuranceProviderIPACode || "").trim();
    if (!code) continue;
    codes.add(code);
    if (!byCode[code]) byCode[code] = { Injury: 0, Death: 0 };
    const t = (r.IncidentType || "").toLowerCase();
    if (t === "injury") byCode[code].Injury += 1;
    else if (t === "death") byCode[code].Death += 1;
    else byCode[code].Injury += 1; // default bucket
  }

  // Map IPACode -> Company name
  let nameByCode: Record<string, string> = {};
  if (codes.size) {
    const { data: companies, error: compErr } = await supabase
      .from("insurancecompanymaster")
      .select("IPACODE, InsuranceCompanyOrganizationName")
      .in("IPACODE", Array.from(codes));
    if (compErr) throw compErr;
    for (const c of companies ?? []) {
      nameByCode[(c as any).IPACODE] =
        (c as any).InsuranceCompanyOrganizationName || (c as any).IPACODE;
    }
  }

  // Build final rows
  const out: Row[] = Object.entries(byCode).map(([code, v]) => {
    const company = nameByCode[code] || `${code} (Unknown)`;
    return { ipacode: code, company, Injury: v.Injury, Death: v.Death, total: v.Injury + v.Death };
  });

  // Sort by total desc
  out.sort((a, b) => b.total - a.total);
  return out;
}

const EmployerInsuranceCompanyReport: React.FC<{ year: number; title?: string }> = ({
  year,
  title = "Insurance Company wise – Accident Type",
}) => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const topForChart = useMemo(() => rows.slice(0, 12), [rows]); // keep chart readable

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const r = await loadInsuranceCompanyBreakdown(year);
        setRows(r);
      } catch (e: any) {
        console.error(e);
        setErr(e.message ?? "Failed to load report data");
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  const onDownloadPDF = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      let cursorY = 40;

      // Crest
      const crest = await imageUrlToDataUrl(CREST_URL);
      if (crest) {
        const w = 60;
        const h = 60;
        doc.addImage(crest, "PNG", (pageWidth - w) / 2, cursorY, w, h);
        cursorY += h + 10;
      }

      // Headings
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Office of Workers Compensation", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 22;

      doc.setFontSize(12);
      doc.text(`CPPS Report: ${title}`, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 18;

      doc.setFont("helvetica", "normal");
      doc.text(`Year: ${year}`, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 16;

      // Table
      const body = rows.map((r) => [r.company, r.ipacode, r.Injury, r.Death, r.total]);
      autoTable(doc, {
        head: [["Insurance Company", "IPACODE", "Injury", "Death", "Total"]],
        body,
        startY: cursorY + 8,
        styles: { fontSize: 10, halign: "left" },
        headStyles: { fillColor: [14, 165, 233], textColor: 255 }, // matches app-thead
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
        margin: { left: 40, right: 40 },
        didDrawPage: (data) => {
          const y = data.cursor.y + 12;
          doc.setFont("helvetica", "bold");
          doc.text(`Grand Total: ${total}`, pageWidth - 40, y, { align: "right" });
        },
      });

      doc.save(`InsuranceCompany_AccidentType_${year}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    }
  };

  return (
    <div className="space-y-4">
      {/* PDF Download */}
      <div className="flex items-center justify-end">
        <button
          onClick={onDownloadPDF}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-gray-50"
          title="Download PDF"
        >
          <Download className="h-4 w-4" />
          PDF
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">
          {title} — {year} · Total: {total}
        </h3>
        {err && <div className="bg-red-50 text-red-700 p-2 rounded mb-3">{err}</div>}
        {loading ? (
          <div className="h-96 animate-pulse bg-gray-100 rounded" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500">No records for {year}.</div>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topForChart}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="company" width={160} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Injury" stackId="a" name="Injury" fill={seriesColors.Injury} />
                <Bar dataKey="Death" stackId="a" name="Death" fill={seriesColors.Death} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Details Table */}
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="text-md font-semibold mb-2">Detailed Breakdown</h4>
        {loading ? (
          <div className="h-32 animate-pulse bg-gray-100 rounded" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-500">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="app-thead">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    Insurance Company
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white">
                    IPACODE
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white">
                    Injury
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white">
                    Death
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-sm">
                {rows.map((r) => (
                  <tr key={r.ipacode}>
                    <td className="px-4 py-2">{r.company}</td>
                    <td className="px-4 py-2">{r.ipacode}</td>
                    <td className="px-4 py-2 text-right">{r.Injury}</td>
                    <td className="px-4 py-2 text-right">{r.Death}</td>
                    <td className="px-4 py-2 text-right font-medium">{r.total}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="px-4 py-2 text-right" colSpan={4}>
                    Grand Total
                  </td>
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

export default EmployerInsuranceCompanyReport;
