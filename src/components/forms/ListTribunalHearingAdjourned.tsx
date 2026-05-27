import React, { useState, useEffect } from 'react';
import { X, Search, Download } from 'lucide-react';
import { supabase } from '../../services/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ViewHearingForm11Public from './ViewHearingForm11Public';
import ViewHearingForm11Private from './ViewHearingForm11Private';
import ViewHearingForm12Public from './ViewHearingForm12Public';
import ViewHearingForm12Private from './ViewHearingForm12Private';
import ViewHearingForm7Public from './ViewHearingForm7Public';
import ViewHearingForm7Private from './ViewHearingForm7Private';

interface ListTribunalHearingAdjournedProps {
  onClose: () => void;
  onSelectIRN?: (irn: string, hearingNo: string) => void;
}

interface AdjournedHearingData {
  THOIRN: string;
  THOClaimant: string;
  THODecision: string;
  THOHearingNo: string;
  THOOrganizationType: string;
  THOHearingStatus: string;
  THODOA: string;
  THOReason: string;
  THOActionOfficer: string;
  DisplayIRN: string;
  THOEmployer?: string;
  THORegion?: string;
  THONatureOfAccident?: string;
  THOProposedAmount?: string;
  THOConfirmedAmount?: string;
}

const ListTribunalHearingAdjourned: React.FC<ListTribunalHearingAdjournedProps> = ({ 
  onClose,
  onSelectIRN 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentedList, setConsentedList] = useState<AdjournedHearingData[]>([]);
  const [searchClaimant, setSearchClaimant] = useState('');
  const [searchCRN, setSearchCRN] = useState('');
  const [searchHearingNo, setSearchHearingNo] = useState('');
  const [filterHearingNo, setFilterHearingNo] = useState('');
  const [filterOrgType, setFilterOrgType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [recordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hearingNumbers, setHearingNumbers] = useState<string[]>([]);
  const [organizationTypes, setOrganizationTypes] = useState<string[]>([]);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingROP, setGeneratingROP] = useState(false);

  // View Modal State
  const [viewingIRN, setViewingIRN] = useState<string | null>(null);
  const [viewingHearingNo, setViewingHearingNo] = useState<string | null>(null);
  const [viewingFormType, setViewingFormType] = useState<string | null>(null);
  const [viewingOrgType, setViewingOrgType] = useState<string | null>(null);
  const [generatingCoverLetters, setGeneratingCoverLetters] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchConsentedList();
  }, [currentPage, searchClaimant, searchCRN, searchHearingNo, filterHearingNo, filterOrgType]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch unique hearing numbers
      const { data: hearingData, error: hearingError } = await supabase
        .from('tribunalhearingoutcome')
        .select('THOHearingNo')
        .eq('THODecision', 'Adjourned')
        .eq('THOHearingStatus', 'Processed')
        .not('THOHearingNo', 'is', null);

      if (hearingError) throw hearingError;

      const uniqueHearingNos = [...new Set(hearingData?.map(item => item.THOHearingNo).filter(Boolean) || [])];
      setHearingNumbers(uniqueHearingNos);

      setHearingNumbers(uniqueHearingNos);
      setOrganizationTypes(['Public', 'Private']);

    } catch (err: any) {
      console.error('Error fetching filter options:', err);
    }
  };

  const fetchConsentedList = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build the base query
      let query = supabase
        .from('tribunalhearingoutcome')
        .select('*', { count: 'exact' })
        .eq('THODecision', 'Adjourned')
        .eq('THOHearingStatus', 'Processed');

      // Apply filters
      if (filterOrgType) {
        const dbValue = filterOrgType === 'Public' ? 'State' : 'Private';
        
        // Find Employers of this type
        const { data: empData } = await supabase
          .from('employermaster')
          .select('CPPSID')
          .eq('OrganizationType', dbValue);
          
        const empCppsIds = empData?.map(e => e.CPPSID).filter(Boolean) || [];
        
        if (empCppsIds.length === 0) {
          setConsentedList([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }

        // Find worker IDs for those employers
        const { data: cedData } = await supabase
          .from('currentemploymentdetails')
          .select('WorkerID')
          .in('EmployerCPPSID', empCppsIds);
          
        const workerIds = cedData?.map(c => c.WorkerID).filter(Boolean) || [];
        
        if (workerIds.length === 0) {
          setConsentedList([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }

        // Find the specific IRNs
        const { data: wiData } = await supabase
          .from('workerirn')
          .select('IRN')
          .in('WorkerID', workerIds);
          
        const filteredIrns = wiData?.map(w => w.IRN).filter(Boolean) || [];
        
        if (filteredIrns.length === 0) {
          setConsentedList([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }

        query = query.in('THOIRN', filteredIrns);
      }

      if (filterHearingNo) {
        query = query.eq('THOHearingNo', filterHearingNo);
      }

      // Apply search filters
      if (searchClaimant) {
        query = query.ilike('THOClaimant', `%${searchClaimant}%`);
      }

      if (searchHearingNo) {
        query = query.ilike('THOHearingNo', `%${searchHearingNo}%`);
      }

      // For CRN search, we need to get IRNs from form1112master first
      if (searchCRN) {
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('IRN')
          .ilike('DisplayIRN', `%${searchCRN}%`);
        
        if (form1112Error) throw form1112Error;
        
        if (form1112Data && form1112Data.length > 0) {
          const irns = form1112Data.map(item => item.IRN);
          query = query.in('THOIRN', irns);
        } else {
          // No matching CRNs found
          setConsentedList([]);
          setTotalRecords(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }
      
      // Get the count
      const { count, error: countError } = await query;
      
      if (countError) throw countError;
      
      const totalCount = count || 0;
      setTotalRecords(totalCount);
      setTotalPages(Math.ceil(totalCount / recordsPerPage));
      
      // Calculate pagination
      const start = (currentPage - 1) * recordsPerPage;
      
      // Execute the query with pagination
      const { data, error } = await query
        .range(start, start + recordsPerPage - 1)
        .order('THODOA', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setConsentedList([]);
        return;
      }

      // Get DisplayIRN and OrganizationType for each record
      const irns = data.map(item => item.THOIRN);
      
      // Fetch DisplayIRN
      const { data: form1112Data } = await supabase
        .from('form1112master')
        .select('IRN, DisplayIRN')
        .in('IRN', irns);

      // Fetch OrganizationType (Multi-step lookup for the batch)
      const { data: workerIrnData } = await supabase
        .from('workerirn')
        .select('IRN, WorkerID')
        .in('IRN', irns);
      
      const workerIds = workerIrnData?.map(w => w.WorkerID).filter(Boolean) || [];
      const { data: cedData } = await supabase
        .from('currentemploymentdetails')
        .select('WorkerID, EmployerCPPSID')
        .in('WorkerID', workerIds);

      const employerCppsIds = cedData?.map(c => c.EmployerCPPSID).filter(Boolean) || [];
      const { data: empData } = await supabase
        .from('employermaster')
        .select('CPPSID, OrganizationType')
        .in('CPPSID', employerCppsIds);

      // Create maps for fast lookups
      const irnMap = new Map();
      form1112Data?.forEach(item => irnMap.set(item.IRN, item.DisplayIRN));

      const irnToWorkerId = new Map();
      workerIrnData?.forEach(w => irnToWorkerId.set(w.IRN, w.WorkerID));

      const workerIdToEmployerId = new Map();
      cedData?.forEach(c => workerIdToEmployerId.set(c.WorkerID, c.EmployerCPPSID));

      const employerIdToType = new Map();
      empData?.forEach(e => employerIdToType.set(e.CPPSID, e.OrganizationType));

      // Format the data with DisplayIRN
      const formattedData = data.map(item => {
        const workerId = irnToWorkerId.get(item.THOIRN);
        const empId = workerIdToEmployerId.get(workerId);
        const dbType = employerIdToType.get(empId);
        const displayType = dbType === 'State' ? 'Public' : (dbType === 'Private' ? 'Private' : 'N/A');

        return {
          ...item,
          DisplayIRN: irnMap.get(item.THOIRN) || 'N/A',
          THOOrganizationType: displayType,
          THODOA: item.THODOA ? new Date(item.THODOA).toLocaleDateString('en-GB') : 'N/A'
        };
      });
      
      setConsentedList(formattedData);
    } catch (err: any) {
      console.error('Error fetching Adjourned hearings list:', err);
      setError(err.message || 'Failed to load Adjourned hearings list');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    fetchConsentedList();
  };

  const generatePDF = async () => {
    try {
      setGeneratingPDF(true);
      
      // Create a new jsPDF instance
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Get page dimensions
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
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
      
      
      // Add logo
      try {
        const logoUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve) => {
          img.onload = () => {
            const logoWidth = 20;
            const logoHeight = 20;
            const logoX = (pageWidth - logoWidth) / 2;
            
            doc.addImage(img, 'PNG', logoX, 10, logoWidth, logoHeight);
            resolve(true);
          };
          img.onerror = () => {
            console.warn('Could not load logo, proceeding without it');
            resolve(true);
          };
          img.src = logoUrl;
        });
      } catch (error) {
        console.warn('Error loading logo:', error);
      }
      
      // Add header text
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
        // Add commissioner stamp
        // Add commissioner stamp
      doc.text('INDEPENDENT STATE OF PAPUA NEW GUINEA', pageWidth / 2, 35, { align: 'center' });
      
      // Add title
      doc.setFontSize(14);
      doc.text('Office Of Workers Compensation - Tribunal Hearing - Adjourned List', pageWidth / 2, 45, { align: 'center' });
      
      // Add horizontal lines
      doc.setLineWidth(0.5);
      doc.line(10, 50, pageWidth - 10, 50);
      

      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Create table
      const tableColumn = [
        "#", "CRN", "Claimant", "Decision", "Reason", "DOA", "Employer", 
        "Region", "Action Officer", "Nature of Accident", "Proposed Amount", 
        "Confirmed Amount", "Hearing No", "Organization Type"
      ];
      const tableRows: any[] = [];
      
      // Add data rows
      consentedList.forEach((hearing, index) => {
        const tableRow = [
          index + 1,
          hearing.DisplayIRN,
          hearing.THOClaimant,
          hearing.THODecision,
          hearing.THOReason || 'N/A',
          hearing.THODOA,
          hearing.THOEmployer || 'N/A',
          hearing.THORegion || 'N/A',
          hearing.THOActionOfficer || 'N/A',
          hearing.THONatureOfAccident || 'N/A',
          hearing.THOProposedAmount || 'N/A',
          hearing.THOConfirmedAmount || 'N/A',
          hearing.THOHearingNo,
          hearing.THOOrganizationType || 'N/A'
        ];
        tableRows.push(tableRow);
      });
      
      // @ts-ignore - autoTable is added as a plugin
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 60,
        styles: { fontSize: 6, cellPadding: 1 },
        columnStyles: {
          0: { cellWidth: 5 },   // #
          1: { cellWidth: 20 },  // CRN
          2: { cellWidth: 25 },  // Claimant
          3: { cellWidth: 15 },  // Decision
          4: { cellWidth: 30 },  // Reason
          5: { cellWidth: 18 },  // DOA
          6: { cellWidth: 25 },  // Employer
          7: { cellWidth: 20 },  // Region
          8: { cellWidth: 25 },  // Action Officer
          9: { cellWidth: 25 },  // Nature of Accident
          10: { cellWidth: 15 }, // Proposed Amount
          11: { cellWidth: 15 }, // Confirmed Amount
          12: { cellWidth: 20 }, // Hearing No
          13: { cellWidth: 10 }  // Organization Type
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
      doc.text(`Total Records: ${consentedList.length}`, 14, finalY + 10);
      
      // Add generation date
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 14, finalY + 20);
      
      // Save the PDF
      doc.save('TribunalHearing-AdjournedList.pdf');
      
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setError(`Error generating PDF: ${err.message}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const generateCoverLettersPDF = async () => {
    try {
      setGeneratingCoverLetters(true);
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 25;
      const logoUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';

      for (let i = 0; i < consentedList.length; i++) {
        const hearing = consentedList[i];
        if (i > 0) doc.addPage();
        
        let y = 15;

        // Fetch Address Logic
        const { data: workerIrnData } = await supabase
          .from('workerirn')
          .select('WorkerID')
          .eq('IRN', hearing.THOIRN)
          .maybeSingle();

        const workerID = workerIrnData?.WorkerID;
        let employerData = null;
        let workerPersonalData = null;

        if (workerID) {
          const { data: cedData } = await supabase
            .from('currentemploymentdetails')
            .select('EmployerCPPSID')
            .eq('WorkerID', workerID)
            .maybeSingle();

          if (cedData?.EmployerCPPSID) {
            const { data: empData } = await supabase
              .from('employermaster')
              .select('OrganizationName, Address1, Address2, City, OrganizationType')
              .eq('CPPSID', cedData.EmployerCPPSID)
              .maybeSingle();
            employerData = empData;
          }

          const { data: wpdData } = await supabase
            .from('workerpersonaldetails')
            .select('WorkerAddress1, WorkerAddress2')
            .eq('WorkerID', workerID)
            .maybeSingle();
          workerPersonalData = wpdData;
        }

        const orgName = employerData?.OrganizationName || 'THE STATE';
        const orgType = employerData?.OrganizationType || 'State';
        const empFullAddress = [employerData?.Address1, employerData?.Address2, employerData?.City].filter(Boolean).join(', ');
        const workerOwnAddr = [workerPersonalData?.WorkerAddress1, workerPersonalData?.WorkerAddress2].filter(Boolean).map(s => s.trim()).join(' ');

        let finalWorkerAddr = '';
        if (workerOwnAddr && workerOwnAddr.length > 0) {
          finalWorkerAddr = workerOwnAddr;
        } else {
          if (orgType === 'State') {
            finalWorkerAddr = `C/- ${orgName}`;
          } else {
            const privateFallback = [orgName, empFullAddress].filter(Boolean).join(', ');
            finalWorkerAddr = `C/- ${privateFallback}`;
          }
        }

        // Header Logo
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve) => {
            img.onload = () => {
              const lw = 20, lh = 20;
              doc.addImage(img, 'PNG', (pageWidth - lw) / 2, y, lw, lh);
              resolve(true);
            };
            img.onerror = () => resolve(true);
            img.src = logoUrl;
          });
          y += 25;
        } catch (e) { y += 10; }

        // Header Branding
        doc.setFontSize(10);
        doc.setFont('times', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('PAPUA NEW GUINEA', pageWidth / 2, y, { align: 'center' });
        y += 6;
        doc.text('WORKERS COMPENSATION TRIBUNAL', pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Title (Red)
        doc.setFontSize(14);
        doc.setTextColor(200, 0, 0);
        doc.text('ADJOURN CLAIM - COVER LETTER', pageWidth / 2, y, { align: 'center' });
        y += 20;

        // Date & Ref
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.setFont('times', 'bold');
        
        const formatDate = (dateStr: string) => {
          const d = new Date(dateStr);
          const day = d.getDate();
          const month = d.toLocaleDateString('en-GB', { month: 'long' });
          const year = d.getFullYear();
          const s1 = ["th", "st", "nd", "rd"];
          const v1 = day % 100;
          const suffix = s1[(v1 - 20) % 10] || s1[v1] || s1[0];
          return `${day}${suffix} ${month} ${year}`;
        };

        const todayFormatted = formatDate(new Date().toISOString());
        
        doc.text(`DATE: ${todayFormatted}`, margin, y);
        y += 6;
        doc.text(`REF: ${hearing.DisplayIRN}`, margin, y);
        y += 15;

        // Recipient
        doc.text(hearing.THOClaimant, margin, y);
        y += 6;
        doc.setFont('times', 'normal');
        const addrLines = doc.splitTextToSize(finalWorkerAddr, pageWidth - (margin * 2));
        doc.text(addrLines, margin, y);
        y += (addrLines.length * 6) + 9;

        // Dear...
        const firstName = hearing.THOClaimant.split(' ')[0];
        doc.text(`Dear ${firstName},`, margin, y);
        y += 10;

        // Subject
        doc.setFont('times', 'bold');
        doc.text('Subject: Workers Compensation Tribunal Decision', margin, y);
        y += 10;

        // Body
        doc.setFont('times', 'normal');
        
        // Need hearing details from THSH
        const { data: shData } = await supabase
          .from('tribunalhearingsethearing')
          .select('THSHFromDate, THSHToDate, THSHVenue, THSHLocation')
          .eq('THSHHearingNo', hearing.THOHearingNo)
          .maybeSingle();

        const fromDate = shData?.THSHFromDate ? formatDate(shData.THSHFromDate) : 'recently';
        const toDate = shData?.THSHToDate ? formatDate(shData.THSHToDate) : '';
        const dateStr = toDate ? `from ${fromDate} to ${toDate}` : `on ${fromDate}`;
        const venue = shData?.THSHVenue || 'Port Moresby';
        const location = shData?.THSHLocation || 'NCDC';

        const body1 = `I am writing to inform you that your workers' compensation claim was heard during the recent Workers Compensation Tribunal Hearing, which took place in ${venue}, ${location}, ${dateStr}.`;
        const body2 = `The Tribunal has adjourned your claim, as detailed in the attached Record of Proceedings (ROP).`;
        const body3 = `If you require further information or assistance, please do not hesitate to contact our office or visit the nearest Provincial Labour Office.`;

        const split1 = doc.splitTextToSize(body1, pageWidth - margin * 2);
        doc.text(split1, margin, y);
        y += split1.length * 6 + 6;

        const split2 = doc.splitTextToSize(body2, pageWidth - margin * 2);
        doc.text(split2, margin, y);
        y += split2.length * 6 + 6;

        const split3 = doc.splitTextToSize(body3, pageWidth - margin * 2);
        doc.text(split3, margin, y);
        y += 20;

        // Yours faithfully
        doc.text('Yours faithfully,', margin, y);
        y += 15;
        doc.setFont('times', 'bold');
        doc.text('Ms. Louisa Pambel', margin, y);
        y += 6;
        doc.text('Registrar', margin, y);
      }

      doc.save('Adjourn-Cover-Letters.pdf');
    } catch (err: any) {
      console.error('Error:', err);
      setError(`Failed: ${err.message}`);
    } finally {
      setGeneratingCoverLetters(false);
    }
  };

  const generateROPPDF = async () => {
    try {
      setGeneratingROP(true);
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      
      for (let i = 0; i < consentedList.length; i++) {
        const hearing = consentedList[i];
        if (i > 0) doc.addPage();
        
        let yPosition = 5; // Move logo up (initially 20)
        
        try {
          const logoUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve) => {
            img.onload = () => {
              const logoWidth = 25;
              const logoHeight = 25;
              const logoX = (pageWidth - logoWidth) / 2;
              doc.addImage(img, 'PNG', logoX, yPosition, logoWidth, logoHeight);
              resolve(true);
            };
            img.onerror = () => resolve(true);
            img.src = logoUrl;
          });
          yPosition += 25; // Space after logo (initially 30)
        } catch (error) {
          yPosition += 10;
        }
        
        const { data: hearingSetData } = await supabase
          .from('tribunalhearingsethearing')
          .select('*')
          .eq('THSHHearingNo', hearing.THOHearingNo)
          .maybeSingle();
        
        const { data: outcomeData } = await supabase
          .from('tribunalhearingoutcome')
          .select('*')
          .eq('THOIRN', hearing.THOIRN)
          .maybeSingle();
        
        doc.setFontSize(12);
        doc.setFont('times', 'bold');
        doc.text('PAPUA NEW GUINEA', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 6; // Initially 10
        
        doc.setFontSize(14);
        doc.text('WORKERS COMPENSATION TRIBUNAL', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 12; // Initially 20
        
        doc.setFontSize(12);
        doc.text(hearing.THOClaimant.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 6; // Initially 8
        doc.text('(CLAIMANT)', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10; // Initially 15
        
        doc.text('DEPT OF EDUCATION/THE STATE', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 6; // Initially 8
        doc.text('(EMPLOYER/INSURER)', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 12; // Initially 20
        
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.text(`FILE REF: CRN: ${hearing.DisplayIRN}`, margin, yPosition);
        yPosition += 5; // Initially 6
        
        if (hearingSetData) {
          const hearingDate = hearingSetData.THSHFromDate ? new Date(hearingSetData.THSHFromDate).toLocaleDateString('en-GB') : 'N/A';
          const hearingLocation = hearingSetData.THSHLocation || 'TRIBUNAL HEARING ROOM';
          doc.text(`HEARING: ${hearingDate} AT ${hearingLocation}`, margin, yPosition);
        }
        yPosition += 10; // Initially 15
        
        doc.setFont('times', 'bold');
        doc.text('CORAM', margin, yPosition);
        yPosition += 6; // Initially 8
        
        doc.setFont('times', 'normal');
        if (hearingSetData?.THSHTribunalChair) {
          doc.text(`${hearingSetData.THSHTribunalChair.toUpperCase()} (COMMISSIONER, OWC)`, margin, yPosition);
          yPosition += 5; // Initially 6
        }
        doc.setFont('times', 'bold');
        doc.text('TRIBUNAL CHAIR', margin, yPosition);
        yPosition += 10; // Initially 15
        
        if (hearingSetData?.THSHClaimantRep1) {
          doc.text(`${hearingSetData.THSHClaimantRep1.toUpperCase()} (REGISTRAR OWC)`, margin, yPosition);
          yPosition += 6;
        }
        doc.text('REPRESENTING THE CLAIMANT', margin, yPosition);
        yPosition += 15;
        
        if (hearingSetData?.THSHStateRep1) {
          doc.text(`${hearingSetData.THSHStateRep1.toUpperCase()} (SENIOR LEGAL OFFICER, SGD)`, margin, yPosition);
          yPosition += 6;
        }
        if (hearingSetData?.THSHStateRep2) {
          doc.text(`${hearingSetData.THSHStateRep2.toUpperCase()} (LEGAL OFFICER, SGD)`, margin, yPosition);
          yPosition += 6;
        }
        doc.setFont('times', 'bold');
        doc.text('REPRESENTING THE STATE', margin, yPosition);
        yPosition += 15;
        
        // Observer
        if (hearingSetData?.THSHObserver1) {
          doc.setFont('times', 'normal');
          doc.text(`${hearingSetData.THSHObserver1.toUpperCase()} (A/S ADMINISTRATION, CORPORATE SERVICE, DEPARTMENT OF FINANCE)`, margin, yPosition);
          yPosition += 6;
          doc.setFont('times', 'bold');
          doc.text('OBSERVER', margin, yPosition);
          yPosition += 10; // Initially 15
        }

        // Tribunal members
        if (hearingSetData?.THSHTribunal1 || hearingSetData?.THSHTribunal2) {
          doc.setFont('times', 'normal');
          if (hearingSetData?.THSHTribunal1) {
            doc.text(`${hearingSetData.THSHTribunal1.toUpperCase()} (SENIOR TRIBUNAL OFFICER)`, margin, yPosition);
            yPosition += 6;
          }
          if (hearingSetData?.THSHTribunal2) {
            doc.text(`${hearingSetData.THSHTribunal2.toUpperCase()} (TRIBUNAL OFFICER)`, margin, yPosition);
            yPosition += 6;
          }
          doc.setFont('times', 'bold');
          doc.text('TRIBUNAL', margin, yPosition);
          yPosition += 10; // Initially 15
        }

        // Officer assisting tribunal
        if (hearingSetData?.THSHOfficerAssistTribunal1) {
          doc.setFont('times', 'normal');
          doc.text(`${hearingSetData.THSHOfficerAssistTribunal1.toUpperCase()} (A/CLAIMS MANAGER-MOMASE REGION)`, margin, yPosition);
          yPosition += 6;
          doc.setFont('times', 'bold');
          doc.text('OFFICER ASSISTING THE TRIBUNAL', margin, yPosition);
          yPosition += 10; // Initially 15
        }
        
        // Decision section
        doc.setFont('times', 'bold');
        doc.text('DECISION:', margin, yPosition);
        yPosition += 8;
        
        doc.setFont('times', 'normal');
        if (outcomeData?.THOReason) {
          const decisionLines = doc.splitTextToSize(outcomeData.THOReason, pageWidth - (margin * 2));
          doc.text(decisionLines, margin, yPosition);
          yPosition += decisionLines.length * 6 + 10;
        } else {
          doc.text('Adjourned', margin, yPosition);
          yPosition += 10; // Initially 15
        }
        
        // Signature section - Dynamic placement to prevent overlap
        const signatureBlockHeight = 50;
        if (yPosition + signatureBlockHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin + 20;
        } else {
          yPosition = Math.max(yPosition + 10, pageHeight - 65);
        }
        
        // Add signature placeholder
        doc.setFont('times', 'bold');
        if (hearingSetData?.THSHTribunalChair) {
          doc.text(hearingSetData.THSHTribunalChair.toUpperCase(), margin, yPosition);
          yPosition += 6;
        }
        doc.text('TRIBUNAL CHAIR', margin, yPosition);
        yPosition += 12;
        
        // Date formatting based on image
        const decisionDate = outcomeData?.THODOA ? new Date(outcomeData.THODOA).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).replace(/(\d+)/, (m) => {
          const n = parseInt(m);
          const s = ["th", "st", "nd", "rd"];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        }) : new Date().toLocaleDateString('en-GB');
        
        doc.setFont('times', 'bold');
        doc.text(`DATED: ${decisionDate}`, margin, yPosition);
        
        // Add tribunal seal placeholder - Match red color
        const sealX = pageWidth - 65;
        const sealY = yPosition - 20;
        
        try {
          const stampUrl = 'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/sign/cpps/Commissionstamp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8xMmRkZDBlOC05MjU4LTQ5ZmEtYTUyYy03NmRlZDY5MTM4OTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjcHBzL0NvbW1pc3Npb25zdGFtcC5wbmciLCJpYXQiOjE3NTQxNTA3MDIsImV4cCI6MjA2OTUxMDcwMn0.ET2gqM5ln9zbJbb5jH1gMHFz42HazTIoQ5s-BaUlADU';
          const stampImg = new Image();
          stampImg.crossOrigin = 'anonymous';
          
          await new Promise((resolve) => {
            stampImg.onload = () => {
              doc.addImage(stampImg, 'PNG', sealX - 25, sealY - 25, 55, 55);
              resolve(true);
            };
            stampImg.onerror = () => {
              doc.setDrawColor(200, 0, 0);
              doc.setTextColor(200, 0, 0);
              doc.circle(sealX, sealY, 25);
              resolve(true);
            };
            stampImg.src = stampUrl;
          });
        } catch (e) {
          doc.setDrawColor(200, 0, 0);
          doc.setTextColor(200, 0, 0);
          doc.circle(sealX, sealY, 25);
        }
      }
      
      doc.save('TribunalHearing-ROP-Adjourned.pdf');
    } catch (err: any) {
      console.error('Error:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setGeneratingROP(false);
    }
  };
  const handleView = async (irn: string, hearingNo: string) => {
    try {
      const record = consentedList.find(h => h.THOIRN === irn);
      const orgType = record?.THOOrganizationType === 'Private' ? 'Private' : 'Public';

      const { data: f1112 } = await supabase
        .from('form1112master')
        .select('IncidentType')
        .eq('IRN', parseInt(irn, 10))
        .maybeSingle();

      const { data: f7 } = await supabase
        .from('form7master')
        .select('IRN')
        .eq('IRN', parseInt(irn, 10))
        .maybeSingle();

      let formType = '11';
      if (f7) {
        formType = '7';
      } else if (f1112?.IncidentType === 'Death') {
        formType = '12';
      }

      setViewingFormType(formType);
      setViewingOrgType(orgType);
      setViewingIRN(irn);
      setViewingHearingNo(hearingNo);
    } catch (err: any) {
      console.error('Error opening view:', err);
      setError('Failed to open details view');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setSearchClaimant('');
    setSearchCRN('');
    setSearchHearingNo('');
    setFilterHearingNo('');
    setFilterOrgType('');
    setCurrentPage(1);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Tribunal Hearing Adjourned - Adjourned List
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Filters Section */}
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Filters & Search</h3>
              <button
                onClick={generatePDF}
                disabled={generatingPDF || consentedList.length === 0}
                className="btn btn-primary flex items-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Print List PDF
                  </>
                )}
              </button>
              <button
                onClick={generateCoverLettersPDF}
                disabled={generatingCoverLetters || consentedList.length === 0}
                className="btn btn-primary flex items-center text-sm disabled:opacity-50 disabled:cursor-not-allowed ml-2"
              >
                {generatingCoverLetters ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Print Adjourn Cover Letters
                  </>
                )}
              </button>
              <button
                onClick={generateROPPDF}
                disabled={generatingROP || consentedList.length === 0}
                className="btn btn-primary flex items-center text-sm disabled:opacity-50 disabled:cursor-not-allowed ml-2"
              >
                {generatingROP ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Print ROP PDF
                  </>
                )}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label htmlFor="filterHearingNo" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Hearing Number
                </label>
                <select
                  id="filterHearingNo"
                  value={filterHearingNo}
                  onChange={(e) => setFilterHearingNo(e.target.value)}
                  className="input"
                >
                  <option value="">All Hearing Numbers</option>
                  {hearingNumbers.map(hearingNo => (
                    <option key={hearingNo} value={hearingNo}>
                      {hearingNo}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="filterOrgType" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Organization Type
                </label>
                <select
                  id="filterOrgType"
                  value={filterOrgType}
                  onChange={(e) => setFilterOrgType(e.target.value)}
                  className="input"
                >
                  <option value="">All Organization Types</option>
                  {organizationTypes.map(orgType => (
                    <option key={orgType} value={orgType}>
                      {orgType}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="searchClaimant" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by Claimant
                </label>
                <input
                  type="text"
                  id="searchClaimant"
                  value={searchClaimant}
                  onChange={(e) => setSearchClaimant(e.target.value)}
                  className="input"
                  placeholder="Enter claimant name"
                />
              </div>
              
              <div>
                <label htmlFor="searchCRN" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by CRN
                </label>
                <input
                  type="text"
                  id="searchCRN"
                  value={searchCRN}
                  onChange={(e) => setSearchCRN(e.target.value)}
                  className="input"
                  placeholder="Enter CRN"
                />
              </div>
              
              <div>
                <label htmlFor="searchHearingNo" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by Hearing No
                </label>
                <input
                  type="text"
                  id="searchHearingNo"
                  value={searchHearingNo}
                  onChange={(e) => setSearchHearingNo(e.target.value)}
                  className="input"
                  placeholder="Enter hearing number"
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={clearFilters}
                className="btn btn-secondary text-sm"
              >
                Clear Filters
              </button>
              <button
                onClick={handleSearch}
                className="btn btn-primary flex items-center text-sm"
              >
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Total Records Found: {totalRecords} | 
              Total Pages: {totalPages}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : consentedList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CRN
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Claimant
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hearing Number
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Decision Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action Officer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consentedList.map((hearing, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {hearing.DisplayIRN}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.THOClaimant}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.THOHearingNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.THOOrganizationType || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.THODOA}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hearing.THOActionOfficer || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleView(hearing.THOIRN, hearing.THOHearingNo)}
                          className="text-sm font-medium bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No Adjourned Hearings Found.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="px-3 py-1 border rounded text-sm"
                    >
                      First
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="px-3 py-1 border rounded text-sm"
                    >
                      Previous
                    </button>
                  </>
                )}
                
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                
                {currentPage < totalPages && (
                  <>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="px-3 py-1 border rounded text-sm"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="px-3 py-1 border rounded text-sm"
                    >
                      Last
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Modals */}
      {viewingIRN && viewingHearingNo && viewingFormType === '11' && viewingOrgType === 'Public' && (
        <ViewHearingForm11Public irn={viewingIRN} hearingNo={viewingHearingNo} onClose={() => setViewingIRN(null)} />
      )}
      {viewingIRN && viewingHearingNo && viewingFormType === '11' && viewingOrgType === 'Private' && (
        <ViewHearingForm11Private irn={viewingIRN} hearingNo={viewingHearingNo} onClose={() => setViewingIRN(null)} />
      )}
      {viewingIRN && viewingHearingNo && viewingFormType === '12' && viewingOrgType === 'Public' && (
        <ViewHearingForm12Public irn={viewingIRN} hearingNo={viewingHearingNo} onClose={() => setViewingIRN(null)} />
      )}
      {viewingIRN && viewingHearingNo && viewingFormType === '12' && viewingOrgType === 'Private' && (
        <ViewHearingForm12Private irn={viewingIRN} hearingNo={viewingHearingNo} onClose={() => setViewingIRN(null)} />
      )}
      {viewingIRN && viewingHearingNo && viewingFormType === '7' && viewingOrgType === 'Public' && (
        <ViewHearingForm7Public irn={viewingIRN} hearingNo={viewingHearingNo} onClose={() => setViewingIRN(null)} />
      )}
      {viewingIRN && viewingHearingNo && viewingFormType === '7' && viewingOrgType === 'Private' && (
        <ViewHearingForm7Private irn={viewingIRN} hearingNo={viewingHearingNo} onClose={() => setViewingIRN(null)} />
      )}
    </div>
  );
};

export default ListTribunalHearingAdjourned;

