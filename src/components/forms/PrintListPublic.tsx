import React, { useState, useEffect } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { supabase } from '../../services/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PrintListPublicProps {
  onClose: () => void;
}

interface HearingData {
  IRN: string;
  CRN: string;
  FirstName: string;
  LastName: string;
  SubmissionDate: string;
  SetForHearing: string;
  Status: string;
  Type: string;
}

const PrintListPublic: React.FC<PrintListPublicProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hearingsList, setHearingsList] = useState<HearingData[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchHearingsList();
  }, []);

  const fetchHearingsList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the count of matching records from the view
      const { count, error: countError } = await supabase
        .from('view_hearings_pending_public')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalRecords(totalCount);
      
      // Get all records from the view
      const { data, error } = await supabase
        .from('view_hearings_pending_public')
        .select('*')
        .order('THSSubmissionDate', { ascending: false });

      if (error) throw error;

      // Format the data
      const formattedData = data.map(item => ({
        IRN: item.IRN,
        CRN: item.CRN,
        FirstName: item.FirstName,
        LastName: item.LastName,
        SubmissionDate: item.THSSubmissionDate ? new Date(item.THSSubmissionDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : 'N/A',
        SetForHearing: item.THSSetForHearing || 'Not Scheduled',
        Status: item.THSHearingStatus,
        Type: item.THSHearingType
      }));
      
      setHearingsList(formattedData);
    } catch (err: any) {
      console.error('Error fetching hearings list:', err);
      setError(err.message || 'Failed to load hearings list');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    try {
      setGenerating(true);
      
      // Create a new PDF document
      const doc = new jsPDF('landscape');
      
      // Get page dimensions
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Add header text
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text('INDEPENDENT STATE OF PAPUA NEW GUINEA', pageWidth / 2, 20, { align: 'center' });
      
      // Add title
      doc.setFontSize(14);
      doc.text('Office Of Workers Compensation - Tribunal Hearing Pending List - Public', pageWidth / 2, 30, { align: 'center' });
      
      // Add horizontal lines
      doc.setLineWidth(0.5);
      doc.line(10, 35, pageWidth - 10, 35);
      
      // Add watermark
      doc.setFont('times', 'bold');
      doc.setFontSize(50);
      doc.setTextColor(230, 230, 230);
      
      // Add rotated watermark
      doc.saveGraphicsState();
      // @ts-ignore - GState is available in jsPDF
      doc.setGState(new doc.GState({ opacity: 0.8 }));
      
      // Calculate center position and add rotated text
      const watermarkX = pageWidth / 2;
      const watermarkY = pageHeight / 2;
      doc.text('O R I G I N A L', watermarkX, watermarkY, {
        align: 'center',
        angle: 45
      });
      
      doc.restoreGraphicsState();
      
      // Add table
      const tableColumn = ["#", "IRN", "CRN", "First Name", "Last Name", "Submission Date", "Set For Hearing", "Status", "Type"];
      const tableRows: any[] = [];
      
      // Add data rows
      hearingsList.forEach((hearing, index) => {
        const tableRow = [
          index + 1,
          hearing.IRN,
          hearing.CRN,
          hearing.FirstName,
          hearing.LastName,
          hearing.SubmissionDate,
          hearing.SetForHearing,
          hearing.Status,
          hearing.Type
        ];
        tableRows.push(tableRow);
      });
      
      // @ts-ignore - autoTable is added as a plugin
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10 }, // #
          1: { cellWidth: 15 }, // IRN
          2: { cellWidth: 40 }, // CRN
          3: { cellWidth: 25 }, // First Name
          4: { cellWidth: 25 }, // Last Name
          5: { cellWidth: 25 }, // Submission Date
          6: { cellWidth: 25 }, // Set For Hearing
          7: { cellWidth: 30 }, // Status
          8: { cellWidth: 50 }  // Type
        },
        headStyles: {
          fillColor: [139, 37, 0], // #8B2500 (primary color)
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        }
      });
      
      // Add total count at the end of the report
      const finalY = (doc as any).lastAutoTable.finalY || 45;
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text(`Total Records: ${totalRecords}`, 14, finalY + 10);
      
      // Save the PDF
      doc.save('TribunalHearingPendingList-Public.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Print List - Public
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="text-center mb-6">
            <FileText className="h-16 w-16 mx-auto text-primary mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Generate PDF Report
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will generate a PDF report of all pending hearings for public organizations.
            </p>
            <p className="text-sm font-medium">
              Total Records: {loading ? '...' : totalRecords}
            </p>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={onClose}
              className="btn btn-secondary flex items-center"
              disabled={generating}
            >
              Cancel
            </button>
            <button
              onClick={generatePDF}
              className="btn btn-primary flex items-center"
              disabled={loading || generating}
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintListPublic;
