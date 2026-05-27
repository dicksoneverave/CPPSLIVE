import React, { useMemo, useState } from 'react';
import { X, Search, FileText, CheckCircle, AlertTriangle, Printer, Download } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface SearchAttachmentsProps {
  onClose: () => void;
  searchType: 'Injury' | 'Death';
}

interface SearchResult {
  IRN: string;
  WorkerID: string;
  DisplayIRN: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  IncidentType: string;
}

interface AttachmentMaster {
  AttachmentID: string;
  // DB column aliases for clarity:
  // - AttachmentName <= attachmentmaster.FormType (e.g., "Death Certificate")
  // - FormCode      <= attachmentmaster.AttachmentType ("Form11" | "Form12")
  AttachmentName: string;
  FormCode: string;
  Mandatory: number | string | boolean;
  FolderName: string;
}

interface FormAttachment {
  FormAttachmentID: string;
  IRN: string;
  AttachmentType: string;
  FileName: string;
  PublicUrl?: string;
}

interface AttachmentStatus {
  attachmentType: string;
  mandatory: boolean;
  folderName: string;
  submitted: boolean;
  files: FormAttachment[];
  required: boolean; // true if defined in attachmentmaster for this form type
}

type StagedItem = {
  file: File;
  previewUrl: string;
  newName: string;
  folder: string;
  fullPath: string;
  // reference to update/insert decision
  existingFormAttachmentId?: string;
  attachmentType: string; // human-readable
};

const SearchAttachments: React.FC<SearchAttachmentsProps> = ({ onClose, searchType }) => {
  const [crn, setCrn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedIRN, setSelectedIRN] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<SearchResult | null>(null);
  const [attachmentStatus, setAttachmentStatus] = useState<AttachmentStatus[]>([]);
  const [showNotFound, setShowNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [includeExtras, setIncludeExtras] = useState(false);
// near other state hooks
const [successNote, setSuccessNote] = useState<string | null>(null);
	const [showSuccessPopup, setShowSuccessPopup] = useState(false);

																										

  // ==== NEW: staging + confirm modal ====
  const [staged, setStaged] = useState<Record<string, StagedItem>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);

	


  // === Folder mappings copied from EditForm11.tsx and EditForm12.tsx (single file per attachment) ===
  // Injury (Form 11)
  const injuryFolderMap: Record<string, string> = useMemo(() => ({
    'Interim medical report': 'attachments/formattachments/IMR/',
    'Final medical report': 'attachments/formattachments/FMR/',
    'Section 43 application form': 'attachments/formattachments/SEC43/',
    'Supervisor statement': 'attachments/formattachments/Supervisorstatement/',
    'Witness statement': 'attachments/formattachments/Witnessstatement/',
    "Injured workers statement": 'attachments/formattachments/Injuredworkerstatement/',
    'Payslip at the time of accident': 'attachments/formattachments/Payslipattimeofaccident/',
    'Treatment records': 'attachments/formattachments/Treatmentrecords/',
    'Police accident report': 'attachments/formattachments/Policeaccidentreport/',
    'Form 18 Scan': 'attachments/formattachments/Form18Scan/',
    'MedicalExpenses': 'attachments/formattachments/MedicalExpenses/',
    'MiscExpenses': 'attachments/formattachments/MiscExpenses/',
    'Deductions': 'attachments/formattachments/Deductions/',
    // Main scan in EditForm11 is ImageName -> attachments/form11scan/ (not listed in table usually)
  }), [],);

  // Death (Form 12)
  const deathFolderMap: Record<string, string> = useMemo(() => ({
    'Death Certificate': 'attachments/formattachments/Deathcertificate/',
    'Post Mortem report': 'attachments/formattachments/Postmortemreport/',
    'Police incident report': 'attachments/formattachments/Policeincidentreport/',
    'Witness statement': 'attachments/formattachments/Witnessstatement/',
    'Section 43 application form': 'attachments/formattachments/SEC43/',
    'Supervisor statement': 'attachments/formattachments/Supervisorstatement/',
    'Dependency declaration': 'attachments/formattachments/Dependencedeclaration/',
    'Payslip at the time of accident': 'attachments/formattachments/Payslipattimeofaccident/',
    'Funeral expenses receipts': 'attachments/formattachments/Funeralexpensereceipts/',
    'Form 18 Scan': 'attachments/formattachments/Form18scan/',
    'MedicalExpenses': 'attachments/formattachments/MedicalExpenses/',
    'MiscExpenses': 'attachments/formattachments/MiscExpenses/',
    'Deductions': 'attachments/formattachments/Deductions/',
    // Main scan in EditForm12 is ImageName -> attachments/form12scan/
  }), [],);

  const folderForAttachment = (attachmentType: string) => {
    const map = searchType === 'Injury' ? injuryFolderMap : deathFolderMap;
    // fallback to attachmentmaster.FolderName if provided, else keep empty
    return map[attachmentType] || '';
  };

  const isImageName = (name?: string) => /\.(png|jpe?g|gif|webp)$/i.test(name || '');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowNotFound(false);
    setSearchResults([]);
    setSelectedIRN(null);
    setSelectedWorker(null);
    setAttachmentStatus([]);
    setCurrentPage(1);
    setStaged({});
    setShowConfirm(false);

    if (!crn && !firstName && !lastName) {
      setError('Please enter at least one search criteria');
      return;
    }

    try {
      setLoading(true);
      let results: SearchResult[] = [];

      if (crn) {
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('IRN, WorkerID, DisplayIRN, IncidentType')
          .eq('DisplayIRN', crn)
          .eq('IncidentType', searchType);

        if (form1112Error) throw form1112Error;

        if (form1112Data && form1112Data.length > 0) {
          const workerIds = form1112Data.map(item => item.WorkerID);
          const { data: workerData, error: workerError } = await supabase
            .from('workerpersonaldetails')
            .select('WorkerID, WorkerFirstName, WorkerLastName')
            .in('WorkerID', workerIds);

          if (workerError) throw workerError;

          results = form1112Data.map(item => {
            const worker = workerData?.find(w => w.WorkerID === item.WorkerID);
            return {
              IRN: item.IRN,
              WorkerID: item.WorkerID,
              DisplayIRN: item.DisplayIRN,
              WorkerFirstName: worker?.WorkerFirstName || 'N/A',
              WorkerLastName: worker?.WorkerLastName || 'N/A',
              IncidentType: item.IncidentType
            };
          });
        }
      } else if (firstName || lastName) {
        let workerQuery = supabase
          .from('workerpersonaldetails')
          .select('WorkerID, WorkerFirstName, WorkerLastName');

        if (firstName && lastName) {
          workerQuery = workerQuery
            .ilike('WorkerFirstName', `%${firstName}%`)
            .ilike('WorkerLastName', `%${lastName}%`);
        } else if (firstName) {
          workerQuery = workerQuery.ilike('WorkerFirstName', `%${firstName}%`);
        } else if (lastName) {
          workerQuery = workerQuery.ilike('WorkerLastName', `%${lastName}%`);
        }

        const { data: workerData, error: workerError } = await workerQuery;
        if (workerError) throw workerError;

        if (workerData && workerData.length > 0) {
          const workerIds = workerData.map(w => w.WorkerID);
          const { data: workerIrnData, error: workerIrnError } = await supabase
            .from('workerirn')
            .select('IRN, WorkerID, DisplayIRN, INCIDENTTYPE')
            .in('WorkerID', workerIds)
            .eq('INCIDENTTYPE', searchType);

          if (workerIrnError) throw workerIrnError;

          if (workerIrnData && workerIrnData.length > 0) {
            results = workerIrnData.map(item => {
              const worker = workerData.find(w => w.WorkerID === item.WorkerID);
              return {
                IRN: item.IRN,
                WorkerID: item.WorkerID,
                DisplayIRN: item.DisplayIRN,
                WorkerFirstName: worker?.WorkerFirstName || 'N/A',
                WorkerLastName: worker?.WorkerLastName || 'N/A',
                IncidentType: item.INCIDENTTYPE
              };
            });
          }
        }
      }

      if (results.length === 0) {
        setShowNotFound(true);
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Error searching for workers:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorker = async (worker: SearchResult) => {
    setSelectedWorker(worker);
    setSelectedIRN(worker.IRN);
    setStaged({});
    setShowConfirm(false);
    await loadAttachmentStatus(worker.IRN);
  };

  const normalizeStoragePath = (p?: string) => {
    if (!p) return '';
    let s = String(p).replace(/\\/g, '/');
    s = s.replace(/^\/+/, '');
    s = s.replace(/^(?:cpps\/+)+/i, '');
    return s;
  };

  const loadAttachmentStatus = async (irn: string) => {
    try {
      setLoadingAttachments(true);
      setError(null);

      const formType = searchType === 'Injury' ? 'Form11' : 'Form12';
      const norm = (s?: string) => (s ?? '').trim().toLowerCase();

      // Required attachments for this form type
      const { data: attachmentMasterData, error: attachmentMasterError } = await supabase
        .from('attachmentmaster')
        .select('AttachmentID, AttachmentName:FormType, FormCode:AttachmentType, Mandatory, FolderName')
        .eq('AttachmentType', formType)
        .order('Mandatory', { ascending: false });

      if (attachmentMasterError) throw attachmentMasterError;

      // Submitted files for this IRN
      const { data: formAttachmentsData, error: formAttachmentsError } = await supabase
        .from('formattachments')
        .select('FormAttachmentID, IRN, AttachmentType, FileName, PublicUrl')
        .eq('IRN', irn);

      if (formAttachmentsError) throw formAttachmentsError;

      const files = formAttachmentsData ?? [];

      // Group submitted files by normalized type
      const filesByType: Record<string, FormAttachment[]> = {};
      for (const f of files) {
        const key = norm(f.AttachmentType);
        if (!filesByType[key]) filesByType[key] = [];
        filesByType[key].push(f);
      }

      const master = (attachmentMasterData as AttachmentMaster[]) ?? [];
      const masterKeys = new Set(master.map(m => norm(m.AttachmentName)));

      const statusFromMaster: AttachmentStatus[] = master.map(m => {
        const key = norm(m.AttachmentName);
        const submittedFiles = (filesByType[key] ?? []).slice(0, 1); // single-file policy
        return {
          attachmentType: m.AttachmentName,
          mandatory: Boolean(Number(m.Mandatory)),
          folderName: m.FolderName || '', // not used for saving; we use our verified maps
          submitted: submittedFiles.length > 0,
          files: submittedFiles,
          required: true,
        };
      });

      // "Extra" uploaded types (exist in formattachments but not in master)
      const extras: AttachmentStatus[] = Object.entries(filesByType)
        .filter(([k]) => !masterKeys.has(k))
        .map(([k, submittedFiles]) => ({
          attachmentType: submittedFiles[0]?.AttachmentType ?? k,
          mandatory: false,
          folderName: '',
          submitted: true,
          files: submittedFiles.slice(0, 1),
          required: false,
        }));

      setAttachmentStatus([...statusFromMaster, ...extras]);
    } catch (err) {
      console.error('Error loading attachment status:', err);
      setError('Failed to load attachment information. Please try again.');
    } finally {
      setLoadingAttachments(false);
    }
  };

  const clearSearch = () => {
    setCrn('');
    setFirstName('');
    setLastName('');
    setSearchResults([]);
    setSelectedIRN(null);
    setSelectedWorker(null);
    setAttachmentStatus([]);
    setShowNotFound(false);
    setError(null);
    setCurrentPage(1);
    setStaged({});
    setShowConfirm(false);
  };

  const handlePrint = () => window.print();

  // === Export helpers (unchanged) ===
  const downloadBlob = (data: BlobPart | Blob, filename: string, mime: string) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCSVSummary = () => {
    if (!selectedWorker) return;
    const source = includeExtras ? attachmentStatus : attachmentStatus.filter(s => s.required);
    const quoted = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const rows: string[] = [];
    rows.push(['CRN','WorkerID','WorkerName','IncidentType','AttachmentType','Mandatory','FolderPath','Submitted','FileCount','Files'].join(','));
    source.forEach(s => {
      const fileNames = s.files.map(f => f.FileName.replace(/"/g,'""')).join('|');
      rows.push([
        quoted(selectedWorker.DisplayIRN),
        quoted(selectedWorker.WorkerID),
        quoted(`${selectedWorker.WorkerFirstName} ${selectedWorker.WorkerLastName}`),
        quoted(selectedWorker.IncidentType),
        quoted(s.attachmentType),
        quoted(s.mandatory ? 'Yes' : 'No'),
        quoted(s.folderName || ''),
        quoted(s.submitted ? 'Yes' : 'No'),
        quoted(s.files.length),
        quoted(fileNames),
      ].join(','));
    });
    const csv = rows.join('');
    downloadBlob(csv, `attachments_${selectedWorker.DisplayIRN}_summary${includeExtras ? '_with-extras' : ''}.csv`, 'text/csv;charset=utf-8;');
  };

  const getImageUrl = (folderName: string, fileName: string) => {
    const raw = String(fileName ?? '');
    if (/^\/?attachments\//i.test(raw)) {
      const path = raw.replace(/^\//, '');
      const { data } = supabase.storage.from('cpps').getPublicUrl(path);
      return data?.publicUrl || null;
    }
    const left = String(folderName ?? '').replace(/^\/+|\/+$/g, '');
    const right = raw.replace(/^\/+/, '');
    const fullPath = left ? `${left}/${right}` : right;
    const { data } = supabase.storage.from('cpps').getPublicUrl(fullPath);
    return data?.publicUrl || null;
  };

  const exportCSVPerFile = () => {
    if (!selectedWorker) return;
    const source = includeExtras ? attachmentStatus : attachmentStatus.filter(s => s.required);
    const quoted = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const rows: string[] = [];
    rows.push(['CRN','WorkerID','WorkerName','IncidentType','AttachmentType','Mandatory','FolderPath','Submitted','FileName','PublicUrl'].join(','));
    source.forEach(s => {
      if (s.files.length === 0) {
        rows.push([
          quoted(selectedWorker.DisplayIRN),
          quoted(selectedWorker.WorkerID),
          quoted(`${selectedWorker.WorkerFirstName} ${selectedWorker.WorkerLastName}`),
          quoted(selectedWorker.IncidentType),
          quoted(s.attachmentType),
          quoted(s.mandatory ? 'Yes' : 'No'),
          quoted(s.folderName || ''),
          quoted('No'),
          quoted(''),
          quoted(''),
        ].join(','));
      } else {
        s.files.forEach(f => {
          const url = f.PublicUrl ?? getImageUrl(s.folderName, f.FileName) ?? '';
          rows.push([
            quoted(selectedWorker.DisplayIRN),
            quoted(selectedWorker.WorkerID),
            quoted(`${selectedWorker.WorkerFirstName} ${selectedWorker.WorkerLastName}`),
            quoted(selectedWorker.IncidentType),
            quoted(s.attachmentType),
            quoted(s.mandatory ? 'Yes' : 'No'),
            quoted(s.folderName || ''),
            quoted('Yes'),
            quoted(f.FileName),
            quoted(url),
          ].join(','));
        });
      }
    });
    const csv = rows.join('');
    downloadBlob(csv, `attachments_${selectedWorker.DisplayIRN}_per-file${includeExtras ? '_with-extras' : ''}.csv`, 'text/csv;charset=utf-8;');
  };

  const exportPDF = async () => {
    if (!selectedWorker) return;
    const el = document.getElementById('attachment-report');
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const pdfWidth = pageWidth - margin * 2;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      pdf.save(`attachments_report_${selectedWorker.DisplayIRN}.pdf`);
    } catch (e) {
      console.error('PDF export failed', e);
      alert('PDF export failed. Please ensure html2canvas and jspdf are installed (npm i html2canvas jspdf).');
    }
  };

  // Pagination
  const totalPages = Math.ceil(searchResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResults = searchResults.slice(startIndex, endIndex);

  // Summary statistics (required-only)
  const requiredOnly = attachmentStatus.filter(s => s.required);
  const totalRequired = requiredOnly.length;
  const mandatoryRequired = requiredOnly.filter(s => s.mandatory).length;
  const totalSubmitted = requiredOnly.filter(s => s.submitted).length;
  const mandatorySubmitted = requiredOnly.filter(s => s.mandatory && s.submitted).length;
  const totalMissing = totalRequired - totalSubmitted;
  const mandatoryMissing = mandatoryRequired - mandatorySubmitted;

  // ====== NEW: file selection + staging ======
  const generateTimestampedName = (original: string) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const datePrefix = `${dd}${mm}${yyyy}`;
    const timeStamp = `${hh}${mi}${ss}`;
    const lastDot = original.lastIndexOf('.');
    const base = lastDot !== -1 ? original.slice(0, lastDot) : original;
    const ext = (lastDot !== -1 ? original.slice(lastDot + 1) : 'dat').toLowerCase();
    const safeBase = base.replace(/[^\w.-]+/g, '_');
    return `${datePrefix}_${timeStamp}_${safeBase}.${ext}`;
  };

  const onPickFile = (att: AttachmentStatus) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // remove staging for this attachmentType if user cleared selection
      setStaged(prev => {
        const copy = { ...prev };
        delete copy[att.attachmentType];
        return copy;
      });
      return;
    }
    const newName = generateTimestampedName(file.name);
    const folder = folderForAttachment(att.attachmentType);
    const fullPath = `${folder}${newName}`.replace(/^\/+/, ''); // bucket-relative
    const previewUrl = isImageName(file.name) ? URL.createObjectURL(file) : '';
    const existingId = att.files[0]?.FormAttachmentID;
    setStaged(prev => ({
      ...prev,
      [att.attachmentType]: {
        file,
        previewUrl,
        newName,
        folder,
        fullPath,
        existingFormAttachmentId: existingId,
        attachmentType: att.attachmentType,
      }
    }));
  };

const openConfirmIfHasStaged = () => {
  if (!Object.keys(staged).length) {
    alert('Please choose a file to upload first.');
    return;
  }
  setSuccessNote(null); // <— clear previous success
  setShowConfirm(true);
};

const handleUploadBack = () => {
  setShowConfirm(false);
  setSuccessNote(null); // <— clear on close
};


  const handleUploadProceed = async () => {
    if (!selectedIRN) return;
    setUploading(true);
    try {
      // 1) upload to Supabase Storage (same bucket/paths used in edit screens)
      for (const key of Object.keys(staged)) {
        const item = staged[key];
        if (!item.folder) {
          throw new Error(`No configured folder for "${key}" in ${searchType} cases.`);
        }
        const { error: upErr } = await supabase.storage.from('cpps').upload(item.fullPath, item.file);
        if (upErr) throw upErr;
      }

      // 2) upsert into formattachments (single-file per type)
      for (const key of Object.keys(staged)) {
        const item = staged[key];
        const fileName = normalizeStoragePath(item.fullPath);

        if (item.existingFormAttachmentId) {
          // update existing row
          const { error: updErr } = await supabase
            .from('formattachments')
            .update({ FileName: fileName })
            .eq('FormAttachmentID', item.existingFormAttachmentId);
          if (updErr) throw updErr;
        } else {
          // insert new row
          const { error: insErr } = await supabase
            .from('formattachments')
            .insert([{ IRN: selectedIRN, AttachmentType: item.attachmentType, FileName: fileName }]);
          if (insErr) throw insErr;
        }
      }

// 3) refresh table
await loadAttachmentStatus(selectedIRN);

// 4) cleanup staged, keep modal open, show success in-modal
Object.values(staged).forEach(s => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
setStaged({});
setShowConfirm(false);      // close confirm summary modal
setShowSuccessPopup(true);  // open success popup

    } catch (err: any) {
      console.error('Upload failed', err);
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  };

 

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Search Attachments - {searchType} Cases</h2>
          <div className="flex items-center space-x-2">
            {selectedWorker && (
              <>
                <label className="hidden sm:flex items-center text-xs text-gray-600 mr-2">
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={includeExtras}
                    onChange={(e) => setIncludeExtras(e.target.checked)}
                  />
                  Include extras
                </label>
                <button
                  onClick={exportCSVSummary}
                  className="text-gray-500 hover:text-gray-700 p-1"
                  title="Export CSV (summary)"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  onClick={exportCSVPerFile}
                  className="text-gray-500 hover:text-gray-700 p-1"
                  title="Export CSV (per-file)"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  onClick={exportPDF}
                  className="text-gray-500 hover:text-gray-700 p-1"
                  title="Export PDF"
                >
                  <FileText className="h-5 w-5" />
                </button>
                <button onClick={handlePrint} className="text-gray-500 hover:text-gray-700 p-1" title="Print">
                  <Printer className="h-5 w-5" />
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Search Form (unchanged) */}
          <form onSubmit={handleSearch} className="space-y-4 mb-6">
            {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="crn" className="block text-sm font-medium text-gray-700 mb-1">CRN (Display IRN)</label>
                <input type="text" id="crn" value={crn} onChange={(e) => setCrn(e.target.value)} className="input" placeholder="Enter CRN" />
              </div>
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="Enter first name" />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Enter last name" />
              </div>
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={clearSearch} className="btn btn-secondary">Clear</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Search Results (unchanged) */}
          {searchResults.length > 0 && !selectedWorker && (
            <div className="mb-6">
              <div className="mb-4 text-sm text-gray-600">Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#8B2500]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">CRN</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Worker ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">First Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Last Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Incident Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentResults.map((result, index) => (
                        <tr key={`${result.IRN}-${index}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.DisplayIRN}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.WorkerID}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.WorkerFirstName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.WorkerLastName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.IncidentType}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button onClick={() => handleSelectWorker(result)} className="font-medium text-sm text-primary hover:text-primary-dark">View Attachments</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-700">Showing {startIndex + 1} to {Math.min(endIndex, searchResults.length)} of {searchResults.length} results</div>
                  <div className="flex space-x-2">
                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                    <span className="px-3 py-1 text-sm">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showNotFound && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No {searchType.toLowerCase()} cases found matching your search criteria.</p>
              <p className="text-sm text-gray-500">Try adjusting your search terms or check if the worker has a {searchType.toLowerCase()} incident registered.</p>
            </div>
          )}

{showSuccessPopup && (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
      <h3 className="text-lg font-semibold text-green-700 mb-3">
        Upload(s) saved successfully
      </h3>
      <p className="text-gray-600 mb-5">Your files have been uploaded.</p>
      <button
        onClick={() => setShowSuccessPopup(false)}
        className="btn btn-primary w-full"
      >
        OK
      </button>
    </div>
  </div>
)}

					
          {/* Attachment Status Report */}
          {selectedWorker && (
            <div id="attachment-report" className="print:p-0">
              <div className="mb-6 print:mb-4">
                <button onClick={() => { setSelectedWorker(null); setSelectedIRN(null); setAttachmentStatus([]); setStaged({}); setShowConfirm(false); }} className="btn btn-secondary mb-4 print:hidden">← Back to Search Results</button>

                <div className="bg-gray-50 p-4 rounded-lg print:bg-white print:border print:border-gray-300">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Attachment Report - {searchType} Case</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="font-medium">CRN:</span> {selectedWorker.DisplayIRN}</div>
                    <div><span className="font-medium">Worker:</span> {selectedWorker.WorkerFirstName} {selectedWorker.WorkerLastName}</div>
                    <div><span className="font-medium">Worker ID:</span> {selectedWorker.WorkerID}</div>
                    <div><span className="font-medium">Incident Type:</span> {selectedWorker.IncidentType}</div>
                  </div>
                </div>
              </div>

              {loadingAttachments ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Summary Statistics (unchanged) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">{totalRequired}</div>
                      <div className="text-sm text-blue-600">Total Required</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">{totalSubmitted}</div>
                      <div className="text-sm text-green-600">Total Submitted</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-600">{mandatoryMissing}</div>
                      <div className="text-sm text-red-600">Mandatory Missing</div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-amber-600">{totalMissing}</div>
                      <div className="text-sm text-amber-600">Total Missing</div>
                    </div>
                  </div>

                  {/* Progress Bar (unchanged) */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Completion Progress</span>
                      <span className="text-sm text-gray-600">{totalRequired ? Math.round((totalSubmitted / totalRequired) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-green-500 rounded-full transition-all duration-300" style={{ width: `${totalRequired ? (totalSubmitted / totalRequired) * 100 : 0}%` }}></div>
                    </div>
                  </div>

                  {/* Attachment Status Table WITH upload/change UI */}
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b">
                      <h4 className="text-lg font-semibold text-gray-900">Attachment Status for {searchType} Case</h4>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#8B2500]">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Attachment Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Mandatory</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Folder Path</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Files Submitted</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider print:hidden">Preview</th>
                            {/* NEW column */}
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider print:hidden">Upload / Change</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {attachmentStatus.map((status, index) => {
                            const stagedItem = staged[status.attachmentType];
                            const folderOverride = folderForAttachment(status.attachmentType);
                            const displayFolder = folderOverride || status.folderName || 'N/A';
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {status.submitted ? (
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <AlertTriangle className={`h-5 w-5 ${status.mandatory ? 'text-red-600' : 'text-yellow-600'}`} />
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {status.attachmentType}
                                  {!status.required && (
                                    <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-600 align-middle">extra</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.mandatory ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {status.mandatory ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                                  {displayFolder}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {status.files.length > 0 ? (
                                    <div className="space-y-1">
                                      {status.files.map((file, fileIndex) => (
                                        <div key={fileIndex} className="text-xs">{file.FileName}</div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 italic">Not submitted</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap print:hidden">
                                  {status.files.length > 0 ? (
                                    <div className="space-y-2">
                                      {status.files.map((file, fileIndex) => {
                                        const imageUrl = file.PublicUrl ?? getImageUrl(displayFolder, file.FileName);
                                        return (
                                          <div key={fileIndex}>
                                            {imageUrl ? (
                                              <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                                                <img
                                                  src={imageUrl}
                                                  alt={`${status.attachmentType} - ${file.FileName}`}
                                                  className="w-16 h-16 object-cover border rounded cursor-pointer hover:opacity-80"
                                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                              </a>
                                            ) : (
                                              <div className="w-16 h-16 bg-gray-200 border rounded flex items-center justify-center">
                                                <FileText className="h-6 w-6 text-gray-400" />
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 bg-gray-100 border rounded flex items-center justify-center">
                                      <span className="text-xs text-gray-400">No file</span>
                                    </div>
                                  )}
                                </td>

                                {/* NEW Upload / Change */}
                                <td className="px-6 py-4 whitespace-nowrap print:hidden">
                                  <div className="flex items-center space-x-2">
                                    <label className="inline-flex items-center px-3 py-1 text-sm border rounded cursor-pointer bg-white hover:bg-gray-50">
                                      <input
                                        type="file"
                                        className="hidden"
                                        onChange={onPickFile(status)}
                                      />
                                      {status.submitted ? 'Change' : 'Upload'}
                                    </label>
                                    {stagedItem && (
                                      <>
                                        {stagedItem.previewUrl ? (
                                          <img
                                            src={stagedItem.previewUrl}
                                            className="w-10 h-10 object-cover rounded border"
                                            alt="preview"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          />
                                        ) : (
                                          <span className="text-xs text-gray-500">Ready: {stagedItem.newName}</span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Confirm Bar */}
                    <div className="px-6 py-4 border-t flex items-center justify-between print:hidden">
                      <div className="text-sm text-gray-600">
                        {Object.keys(staged).length
                          ? `${Object.keys(staged).length} file${Object.keys(staged).length === 1 ? '' : 's'} selected for upload`
                          : 'No files selected'}
                      </div>
                      <div className="space-x-2">
                        <button
                          className="btn btn-secondary"
                          onClick={() => setStaged({})}
                          disabled={!Object.keys(staged).length}
                        >
                          Clear Selection
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={openConfirmIfHasStaged}
                          disabled={!Object.keys(staged).length}
                        >
                          Review & Upload
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Missing Documents Summary (unchanged) */}
                  {totalMissing > 0 && (
                    <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-800 mb-3 flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Missing Documents Summary
                      </h4>
                      <div className="space-y-2">
                        {attachmentStatus
                          .filter(status => status.required && !status.submitted)
                          .map((status, index) => (
                            <div key={index} className="flex items-center text-sm">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 ${status.mandatory ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {status.mandatory ? 'MANDATORY' : 'Optional'}
                              </span>
                              <span className="text-gray-700">{status.attachmentType}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Submitted Documents with Images (unchanged) */}
                  {totalSubmitted > 0 && (
                    <div className="mt-6 print:break-before-page">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Submitted Documents</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {attachmentStatus
                          .filter(status => status.required && status.submitted)
                          .map((status, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                                {status.attachmentType}
                                {status.mandatory && (
                                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">MANDATORY</span>
                                )}
                              </h5>
                              <div className="space-y-3">
                                {status.files.map((file, fileIndex) => {
                                  const folder = folderForAttachment(status.attachmentType) || status.folderName;
                                  const imageUrl = file.PublicUrl ?? getImageUrl(folder, file.FileName);
                                  return (
                                    <div key={fileIndex} className="border rounded p-2">
                                      <p className="text-xs text-gray-600 mb-2">{file.FileName}</p>
                                      {imageUrl ? (
                                        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block print:hidden">
                                          <img
                                            src={imageUrl}
                                            alt={`${status.attachmentType} - ${file.FileName}`}
                                            className="w-full h-32 object-cover border rounded cursor-pointer hover:opacity-80"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          />
                                        </a>
                                      ) : (
                                        <div className="w-full h-32 bg-gray-200 border rounded flex items-center justify-center">
                                          <FileText className="h-8 w-8 text-gray-400" />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Summary Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="px-4 py-3 border-b">
              <h4 className="text-lg font-semibold">Confirm Upload</h4>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {Object.keys(staged).length === 0 ? (
                <div className="text-sm text-gray-500">No files selected.</div>
              ) : (
                <div className="space-y-3">
                  {Object.keys(staged).map((k) => {
                    const s = staged[k];
                    return (
                      <div key={k} className="border rounded p-3">
                        <div className="text-sm font-medium text-gray-900">{k}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          <div><span className="font-semibold">Folder:</span> {s.folder}</div>
                          <div><span className="font-semibold">File name:</span> {s.newName}</div>
                          <div><span className="font-semibold">Action:</span> {s.existingFormAttachmentId ? 'Update existing' : 'Insert new'}</div>
                        </div>
                        {s.previewUrl ? (
                          <img src={s.previewUrl} alt="preview" className="mt-2 w-32 h-32 object-cover border rounded" />
                        ) : (
                          <div className="mt-2 text-xs text-gray-500">No image preview</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end space-x-2">
							
              <button className="btn btn-secondary" onClick={handleUploadBack} disabled={uploading}>Back</button>
              <button className="btn btn-primary" onClick={handleUploadProceed} disabled={uploading || Object.keys(staged).length === 0}>
                {uploading ? 'Uploading...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles (unchanged) */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:mb-4 { margin-bottom: 1rem !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:border { border: 1px solid #d1d5db !important; }
          .print\\:border-gray-300 { border-color: #d1d5db !important; }
          .print\\:break-before-page { break-before: page !important; }
        }
      `}</style>
    </div>
  );
};

export default SearchAttachments;
