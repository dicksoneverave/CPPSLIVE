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
  PieChart,
  Pie
} from "recharts";
import { supabase } from "../../services/supabase";
import { Download, Printer, FileText, Table as TableIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Standard OWC Logo
const CREST_URL = "https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png";

type ReportType = 'Sector' | 'Insurance' | 'Officer' | 'Injury' | 'Province' | 'Region';

interface ApprovedAwardsDetailedReportProps {
  reportType: ReportType;
  year: number;
  filterType?: 'Annual' | 'Monthly' | 'Quarterly';
  month?: number; // 1-12
  quarter?: number; // 1-4
}

interface ReportRow {
  irn: string;
  crn: string;
  workerName: string;
  incidentType: string;
  incidentProvince: string;
  incidentRegion: string;
  sector: string;
  insuranceCompany: string;
  compensationAmount: number;
  officerName: string;
  month: number;
  quarter: number;
}

const REGION_NAMES = ['Highlands Region', 'Islands Region', 'Momase Region', 'Papua Region'];

const ApprovedAwardsDetailedReport: React.FC<ApprovedAwardsDetailedReportProps> = ({
  reportType,
  year,
  filterType = 'Annual',
  month = 1,
  quarter = 1
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fetchInProgress = React.useRef(false);

  useEffect(() => {
    fetchData();
  }, [year, filterType, month, quarter]);

  const fetchData = async () => {
    if (fetchInProgress.current) return;
    try {
      fetchInProgress.current = true;
      setLoading(true);
      setError(null);

      let startDate = `${year}-01-01`;
      let endDate = `${year + 1}-01-01`;

      if (filterType === 'Monthly' && month) {
        const m = month < 10 ? `0${month}` : month;
        startDate = `${year}-${m}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const nm = nextMonth < 10 ? `0${nextMonth}` : nextMonth;
        endDate = `${nextYear}-${nm}-01`;
      } else if (filterType === 'Quarterly' && quarter) {
        const qMap: any = { 1: ['01', '04'], 2: ['04', '07'], 3: ['07', '10'], 4: ['10', '01'] };
        startDate = `${year}-${qMap[quarter][0]}-01`;
        endDate = `${quarter === 4 ? year + 1 : year}-${qMap[quarter][1]}-01`;
      }

      // 1. Get main records with optimized server-side filter
      const { data: cacrRecords, error: cacrErr } = await supabase
        .from('claimsawardedcommissionersreview')
        .select('IRN, CACRReviewStatus, CACRDecisionDate, CACRSubmissionDate')
        .or('CACRReviewStatus.ilike.*Accepted*,CACRReviewStatus.ilike.*Approved*')
        .gte('CACRDecisionDate', startDate)
        .lt('CACRDecisionDate', endDate)
        .limit(2000);

      if (cacrErr) throw cacrErr;
      if (!cacrRecords || cacrRecords.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Filter by year if necessary (assuming some timestamp exists on cacrRecords, or we join first)
      // The user wants it by year/month/qtr, so we need a date.
      // Let's assume the date comes from form1112master's FirstSubmissionDate or cacrRecords's own created_at.
      // Based on the user's prompt, we'll link to form1112master.

      const irns = cacrRecords.map(r => r.IRN);

      // 2. Fetch all related data in batches to fulfill linking requirements
      const [
        { data: f1112Records },
        { data: workerRecords },
        { data: amountRecords },
        { data: approvedCpoRecords }
      ] = await Promise.all([
        supabase.from('form1112master').select('*').in('IRN', irns),
        supabase.from('workerirn').select('IRN, Name').in('IRN', irns),
        supabase.from('claimcompensationworkerdetails').select('IRN, CCWDCompensationAmount').in('IRN', irns),
        supabase.from('approvedclaimscporeview').select('IRN, LockedByCPOID').in('IRN', irns)
      ]);

      // 3. Officer lookup
      const officerIds = Array.from(new Set(approvedCpoRecords?.map(r => r.LockedByCPOID).filter(Boolean) || []));
      const { data: staffRecords } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID, OSMFirstName, OSMLastName, OSMDesignation, InchargeProvince, InchargeRegion')
        .in('OSMStaffID', officerIds);

      const staffMap = (staffRecords || []).reduce((acc: any, s: any) => {
        acc[s.OSMStaffID] = {
          fullName: `${s.OSMFirstName} ${s.OSMLastName}`,
          designation: s.OSMDesignation,
          province: s.InchargeProvince,
          region: s.InchargeRegion
        };
        return acc;
      }, {});

      // 4. Insurance lookup - this is the "long way"
      // We'll need a map of WorkerID -> EmployerCPPSID -> employermaster.InsuranceProviderIPACode -> insurancecompanymaster.InsuranceCompanyOrganizationName
      const workerIdsForInsurance = Array.from(new Set(f1112Records?.map(r => r.WorkerID).filter(Boolean) || []));
      const { data: employDetails } = await supabase
        .from('currentemploymentdetails')
        .select('WorkerID, EmployerCPPSID')
        .in('WorkerID', workerIdsForInsurance);

      const employerIds = Array.from(new Set(employDetails?.map(r => r.EmployerCPPSID).filter(Boolean) || []));
      const { data: employerMasters } = await supabase
        .from('employermaster')
        .select('CPPSID, InsuranceProviderIPACode')
        .in('CPPSID', employerIds);

      const ipaCodesForInsurance = Array.from(new Set([
        ...(f1112Records?.map(r => r.InsuranceProviderIPACode).filter(Boolean) || []),
        ...(employerMasters?.map(r => r.InsuranceProviderIPACode).filter(Boolean) || [])
      ]));

      const { data: insuranceMasters } = await supabase
        .from('insurancecompanymaster')
        .select('IPACODE, InsuranceCompanyOrganizationName')
        .in('IPACODE', ipaCodesForInsurance);

      const insuranceMap = (insuranceMasters || []).reduce((acc: any, i: any) => {
        acc[i.IPACODE] = i.InsuranceCompanyOrganizationName;
        return acc;
      }, {});

      // 5. Assemble final rows with linking logic
      const finalRows: ReportRow[] = cacrRecords.map(cacr => {
        const curIrn = String(cacr.IRN);
        const f = f1112Records?.find(x => String(x.IRN) === curIrn);
        const w = workerRecords?.find(x => String(x.IRN) === curIrn);
        const a = amountRecords?.filter(x => String(x.IRN) === curIrn).reduce((sum, curr) => sum + (curr.CCWDCompensationAmount || 0), 0);
        const cpo = approvedCpoRecords?.find(x => String(x.IRN) === curIrn);
        const cpoid = cpo?.LockedByCPOID;
        const staff = cpoid ? (staffMap[cpoid] || cpoid) : 'N/A';
        if (cpoid && !staffMap[cpoid]) {
          console.info(`[UNMAPPED OFFICER REPORT] IRN: ${cacr.IRN}, CPO ID: ${cpoid}`);
        }

        // Robust Insurance Identification Logic (Prioritizing 'Long Way' per user instruction)
        let insuranceName: string = '';
        const isPublic = f?.IncidentType === 'Public';

        if (isPublic) {
          insuranceName = 'State';
        } else {
          const shortIpa = f?.InsuranceProviderIPACode;
          let longIpa = undefined;

          // Perform 'Long Way' Lookup
          if (f?.WorkerID) {
            const detail = employDetails?.find(ed => ed.WorkerID === f.WorkerID);
            if (detail) {
              const master = employerMasters?.find(em => em.CPPSID === detail.EmployerCPPSID);
              longIpa = master?.InsuranceProviderIPACode;
            }
          }

          // Hierarchy Priority: Long Way > Short Way
          let finalIpa = shortIpa;
          if (!shortIpa || (longIpa && shortIpa !== longIpa)) {
            finalIpa = longIpa || shortIpa;
          }

          if (finalIpa) {
            const insNameFromMap = insuranceMap[finalIpa];
            if (insNameFromMap) {
              insuranceName = insNameFromMap;
            } else {
              insuranceName = finalIpa; // Fallback to IPA Code
              console.info(`[UNMAPPED INSURANCE REPORT] IRN: ${cacr.IRN}, CRN: ${f?.DisplayIRN}, IPA Code: ${finalIpa} (Used ${finalIpa === longIpa ? 'Long Way' : 'Short Way'})`);
            }
          } else {
            insuranceName = 'Unknown (No IPA Code)';
            console.info(`[MISSING IPA CODE REPORT] IRN: ${cacr.IRN}, CRN: ${f?.DisplayIRN}`);
          }
        }
        
        let sector = (insuranceName === 'State') ? 'Public' : 'Private';

        // Date extraction (STRICTLY Decision Date per user instruction)
        const dateStr = cacr.CACRDecisionDate;
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        const recordYear = parseInt(parts[0]);
        const recordMonth = parseInt(parts[1]);
        const recordQuarter = Math.ceil(recordMonth / 3);

        if (recordYear !== year) return null;
        if (filterType === 'Monthly' && month && recordMonth !== month) return null;
        if (filterType === 'Quarterly' && quarter && recordQuarter !== quarter) return null;

        // NEW: Filter out Region names from Province reports
        if (reportType === 'Province' && REGION_NAMES.includes(f?.IncidentProvince || '')) {
          return null;
        }

        return {
          irn: String(cacr.IRN),
          crn: f?.DisplayIRN || 'N/A',
          workerName: w?.Name || 'Unknown',
          incidentType: f?.IncidentType || 'N/A',
          incidentProvince: f?.IncidentProvince || 'N/A',
          incidentRegion: f?.IncidentRegion || 'N/A',
          sector,
          insuranceCompany: insuranceName,
          compensationAmount: a || 0,
          officerName: staff?.fullName || 'N/A',
          month: recordMonth,
          quarter: recordQuarter
        };
      }).filter(Boolean) as ReportRow[];

      setData(finalRows);
    } catch (err: any) {
      console.error('Error fetching report data:', err);
      setError(err.message || 'Failed to fetch report data');
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  };

  const aggregatedData = useMemo(() => {
    const agg: Record<string, { label: string; count: number; totalAmount: number }> = {};
    data.forEach(row => {
      let key = '';
      if (reportType === 'Sector') key = row.sector;
      else if (reportType === 'Insurance') key = row.insuranceCompany;
      else if (reportType === 'Officer') key = row.officerName;
      else if (reportType === 'Injury') key = row.incidentType;
      else if (reportType === 'Province') key = row.incidentProvince;
      else if (reportType === 'Region') key = row.incidentRegion;

      if (!agg[key]) agg[key] = { label: key, count: 0, totalAmount: 0 };
      agg[key].count += 1;
      agg[key].totalAmount += row.compensationAmount;
    });
    return Object.values(agg).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [data, reportType]);

  const groupedData = useMemo(() => {
    const groups: Record<string, ReportRow[]> = {};
    data.forEach(row => {
      let key = '';
      if (reportType === 'Sector') key = row.sector;
      else if (reportType === 'Insurance') key = row.insuranceCompany;
      else if (reportType === 'Officer') key = row.officerName;
      else if (reportType === 'Injury') key = row.incidentType;
      else if (reportType === 'Province') key = row.incidentProvince;
      else if (reportType === 'Region') key = row.incidentRegion;

      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [data, reportType]);

  const grandTotalAmount = useMemo(() => data.reduce((s, r) => s + r.compensationAmount, 0), [data]);

  const onDownloadPDF = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      let cursorY = 40;

      // Logo
      const img = new Image();
      img.src = CREST_URL;
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      if (img.complete) {
        doc.addImage(img, 'PNG', (pageWidth - 60) / 2, cursorY, 60, 60);
        cursorY += 70;
      }

      // Standard Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PAPUA NEW GUINEA", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 20;
      doc.text("OFFICE OF WORKERS COMPENSATION", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 30;

      // Dynamic Title
      const periodLabel = filterType === 'Annual' ? String(year) : 
                          filterType === 'Monthly' ? `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}` :
                          `Q${quarter} (${['Jan-Mar','Apr-Jun','Jul-Sep','Oct-Dec'][quarter-1]}) ${year}`;

      doc.setFontSize(12);
      doc.text("List of Approved Awards", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 20;
      doc.setFont("helvetica", "normal");
      doc.text(`Report: Approved awards by ${reportType}`, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 20;
      doc.setFont("helvetica", "bold");
      doc.text(`Period: ${periodLabel}`, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 30;

      // Table
      const columns = ["CRN", "Worker Name", "Incident Type", "Province", "Region", "Sector", "Insurance", "Amount"];
      const pdfRows: any[] = [];

      Object.entries(groupedData).forEach(([groupName, rows]) => {
        // Group Header Row
        pdfRows.push([
          { content: `${reportType}: ${groupName}`, colSpan: 7, styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } },
          { content: "", styles: { fillColor: [241, 245, 249] } }
        ]);

        rows.forEach(r => {
          pdfRows.push([
            r.crn,
            r.workerName,
            r.incidentType,
            r.incidentProvince,
            r.incidentRegion,
            r.sector,
            r.insuranceCompany,
            `K ${r.compensationAmount.toLocaleString()}`
          ]);
        });

        // Group Subtotal Row
        const subtotal = rows.reduce((s, r) => s + r.compensationAmount, 0);
        pdfRows.push([
          { content: `SUBTOTAL: ${groupName}`, colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: `K ${subtotal.toLocaleString()}`, styles: { fontStyle: 'bold' } }
        ]);
      });

      autoTable(doc, {
        head: [columns],
        body: pdfRows,
        startY: cursorY,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [51, 65, 85] },
        foot: [
          [{ content: "GRAND TOTAL", colSpan: 7, styles: { halign: 'right' } }, `K ${grandTotalAmount.toLocaleString()}`]
        ],
        footStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      const filePeriod = filterType === 'Annual' ? String(year) : 
                         filterType === 'Monthly' ? `${new Date(year, month-1).toLocaleString('default', { month: 'short' })}${year}` :
                         `Q${quarter}_${year}`;

      doc.save(`Approved_Awards_By_${reportType}_${filePeriod}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    }
  };

  const onDownloadCSV = () => {
    const csvRows: string[] = [];
    const headers = ["CRN", "Worker Name", "Incident Type", "Incident Province", "Incident Region", "Sector", "Insurance Company", "Compensation Amount"];
    csvRows.push(headers.join(","));

    Object.entries(groupedData).forEach(([groupName, rows]) => {
      // Group Header Row
      csvRows.push(`${reportType}: ${groupName},,,,,,,`);

      rows.forEach(r => {
        csvRows.push([
          r.crn,
          `"${r.workerName}"`,
          r.incidentType,
          r.incidentProvince,
          r.incidentRegion,
          r.sector,
          `"${r.insuranceCompany}"`,
          r.compensationAmount
        ].join(","));
      });

      // Group Subtotal Row
      const subtotal = rows.reduce((s, r) => s + r.compensationAmount, 0);
      csvRows.push(`,,,,,,SUBTOTAL (${groupName}),${subtotal}`);
      csvRows.push(",,,,,,,"); // Spacer
    });

    // Grand Total Row
    csvRows.push(`,,,,,,GRAND TOTAL,${grandTotalAmount}`);

    const csvContent = csvRows.join("\n");

    const filePeriod = filterType === 'Annual' ? String(year) : 
                       filterType === 'Monthly' ? `${new Date(year, month-1).toLocaleString('default', { month: 'short' })}${year}` :
                       `Q${quarter}_${year}`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Approved_Awards_By_${reportType}_${filePeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Approved Awards by {reportType}
        </h2>
        <div className="flex gap-2">
          <button onClick={onDownloadPDF} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-sm">
            <Printer className="h-4 w-4" /> PDF
          </button>
          <button onClick={onDownloadCSV} className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-sm">
            <Download className="h-4 w-4" /> CSV/Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm h-[400px]">
          <h3 className="text-lg font-semibold mb-4">Summary View</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aggregatedData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="label" type="category" width={100} />
              <Tooltip formatter={(value: number) => `K ${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="totalAmount" name="Total Amount (K)" fill="#0ea5e9">
                {aggregatedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'][index % 6]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm h-[400px]">
          <h3 className="text-lg font-semibold mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={aggregatedData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {aggregatedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316'][index % 6]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <TableIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-md font-semibold text-gray-700">Detailed Report List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">CRN</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sector</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-sm">
              {Object.entries(groupedData).map(([groupName, rows]) => {
                const subtotal = rows.reduce((s, r) => s + r.compensationAmount, 0);
                return (
                  <React.Fragment key={groupName}>
                    {/* Group Header */}
                    <tr className="bg-gray-50/50">
                      <td colSpan={6} className="px-4 py-2 font-bold text-primary bg-blue-50/30">
                        {reportType}: {groupName}
                      </td>
                    </tr>
                    
                    {/* Data Rows */}
                    {rows.map((row, i) => (
                      <tr key={`${groupName}-${i}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2 font-medium">{row.crn}</td>
                        <td className="px-4 py-2">{row.workerName}</td>
                        <td className="px-4 py-2">{row.incidentType}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${row.sector === 'Public' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {row.sector}
                          </span>
                        </td>
                        <td className="px-4 py-2">{row.insuranceCompany}</td>
                        <td className="px-4 py-2 text-right font-semibold">K {row.compensationAmount.toLocaleString()}</td>
                      </tr>
                    ))}

                    {/* Group Subtotal */}
                    <tr className="bg-gray-100/20 font-bold border-t border-gray-200">
                      <td colSpan={5} className="px-4 py-2 text-right text-gray-600">SUBTOTAL ({groupName})</td>
                      <td className="px-4 py-2 text-right">K {subtotal.toLocaleString()}</td>
                    </tr>
                    
                    {/* Spacer row */}
                    <tr className="h-4"><td colSpan={6}></td></tr>
                  </React.Fragment>
                );
              })}
              
              {/* Grand Total */}
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={5} className="px-4 py-4 text-right label text-lg uppercase tracking-wider">Grand Total Amount</td>
                <td className="px-4 py-4 text-right text-xl">K {grandTotalAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApprovedAwardsDetailedReport;
