import React, { useState, useEffect } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { supabase } from '../../services/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PrintHearingSetListAllProps {
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

const PrintHearingSetList: React.FC<PrintSetListAllProps> = ({ onClose }) => {
  const [hearingsList, setHearingsList] = useState<HearingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchHearingsList();
  }, []);

  const fetchHearingsList = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all pending hearings (both public and private)
      const { data: publicData, error: publicError } = await supabase
        .from('view_hearings_set_public')
        .select('*')
        .eq('THSHearingStatus', 'HearingSet')
        .eq('THSSetForHearing', 'Scheduled');

      if (publicError) throw publicError;

      const { data: privateData, error: privateError } = await supabase
        .from('view_hearings_set_private')
        .select('*')
       .eq('THSHearingStatus', 'HearingSet')
        .eq('THSSetForHearing', 'Scheduled');

      if (privateError) throw privateError;

      // Combine and format the data
      const combinedData = [...(publicData || []), ...(privateData || [])];
      
      const formattedData = combinedData.map(item => ({
        IRN: item.IRN,
        CRN: item.CRN,
        FirstName: item.FirstName,
        LastName: item.LastName,
        SubmissionDate: item.THSSubmissionDate ? new Date(item.THSSubmissionDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : 'N/A',
        SetForHearing: item.THSSetForHearing || 'Scheduled',
        Status: item.THSHearingStatus || 'HearingSet',
        Type: item.THSHearingType
      }));
      
      // Sort by submission date (newest first)
      formattedData.sort((a, b) => {
        const dateA = a.SubmissionDate ? new Date(a.SubmissionDate.split('-').reverse().join('-')).getTime() : 0;
        const dateB = b.SubmissionDate ? new Date(b.SubmissionDate.split('-').reverse().join('-')).getTime() : 0;
        return dateB - dateA;
      });
      
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
      
      // Create a new jsPDF instance
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
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
      doc.text('Office Of Workers Compensation - Tribunal Set Hearing Pending List', pageWidth / 2, 30, { align: 'center' });
      
      // Add horizontal lines
      doc.setLineWidth(0.5);
      doc.line(10, 35, pageWidth - 10, 35);
      
      // Add watermark
      doc.setFont('times', 'bold');
      doc.setFontSize(50);
      doc.setTextColor(230, 230, 230);
      
      // Add rotated watermark text
      doc.text('O R I G I N A L', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
        renderingMode: 'fill'
      });
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Create table
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
      doc.text(`Total Records: ${hearingsList.length}`, 14, finalY + 10);
      
      // Add quota message if needed
      if (hearingsList.length >= 59) {
        doc.setTextColor(255, 0, 0); // Red color
        doc.text('Quota Has Been Reached - Time to call Tribunal Hearing. Print this list and set schedule for claims as per this list.', 14, finalY + 20);
      }
      
      // Save the PDF
      doc.save('TribunalSetHearingList-All.pdf');
      
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setError(`Error generating PDF: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Print Hearing Set List - All
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
              This will generate a PDF report of all Set hearings (both public and private).
            </p>
            <p className="text-sm font-medium">
              Total Records: {loading ? '...' : hearingsList.length}
            </p>
            
            {hearingsList.length >= 59 && (
              <p className="text-sm text-red-600 font-medium mt-2">
                Quota Has Been Reached - Time to call Tribunal Hearing
              </p>
            )}
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

export default PrintHearingSetList;
