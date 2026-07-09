import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Upload, FileText, CheckCircle, AlertTriangle, Paperclip, Trash2, Eye, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import Form113View from './Form113View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import ViewForm7 from './ViewForm7';
import DocumentStatus from './DocumentStatus';

interface Form253Props {
  irn: string;
  onClose: () => void;
}

interface TribunalAttachment {
  DocattachmentID: number;
  IRN: number;
  AttachmentType: string;
  FileName: string;
}

const Form253HearingPendingForm7Submission: React.FC<Form253Props> = ({ irn, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [validIRN, setValidIRN] = useState<number | null>(null);
  const [showDocumentStatus, setShowDocumentStatus] = useState(false);
  const [settingHearing, setSettingHearing] = useState(false);
  const [hearingMessage, setHearingMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submissionType, setSubmissionType] = useState<string>('NewCase');

  // Tribunal Attachments states
  const [existingAttachments, setExistingAttachments] = useState<TribunalAttachment[]>([]);
  const [fetchingAttachments, setFetchingAttachments] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ docattachmentID: number; fileName: string } | null>(null);

  const loadExistingAttachments = async () => {
    if (!validIRN) return;
    try {
      setFetchingAttachments(true);
      const { data, error: dbErr } = await supabase
        .from('tribunalattachments')
        .select('*')
        .eq('IRN', validIRN);
      if (dbErr) throw dbErr;
      setExistingAttachments(data || []);
    } catch (err) {
      console.error('Error loading tribunal attachments:', err);
    } finally {
      setFetchingAttachments(false);
    }
  };

  useEffect(() => {
    if (validIRN) {
      loadExistingAttachments();
    }
  }, [validIRN]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(previews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const getActiveCategoryIds = (subType: string) => {
    if (subType === 'NewCase') {
      return ['fulldoc', 'misc'];
    } else if (subType === 'AdjournedCase') {
      return ['fulldoc', 'adjourned', 'rop', 'misc'];
    } else if (subType === 'AppealedCase') {
      return ['fulldoc', 'appealed', 'rop', 'misc'];
    }
    return [];
  };

  const getExistingForCategory = (catId: string) => {
    return existingAttachments.filter(att => {
      const normalizedPath = (att.FileName || '').replace(/\\/g, '/');
      if (catId === 'fulldoc') {
        return att.AttachmentType === 'Full Claim FIle';
      }
      if (catId === 'adjourned') {
        return att.AttachmentType === 'Adjourned';
      }
      if (catId === 'appealed') {
        return att.AttachmentType === 'Appealed';
      }
      if (catId === 'rop') {
        return (att.AttachmentType === 'ROP' || att.AttachmentType === 'Other') && normalizedPath.includes('/rop/');
      }
      if (catId === 'misc') {
        return att.AttachmentType === 'Other' && normalizedPath.includes('/misc/');
      }
      return false;
    });
  };

  const getTribunalAttachmentUrl = (dbFileName: string) => {
    if (!dbFileName) return null;
    const path = dbFileName.replace(/\\/g, '/').replace(/^\/+/, '');
    const { data } = supabase.storage.from('cpps').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const onPickFile = (categoryId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStagedFiles(prev => ({
      ...prev,
      [categoryId]: file
    }));

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviews(prev => {
        if (prev[categoryId]) {
          URL.revokeObjectURL(prev[categoryId]);
        }
        return {
          ...prev,
          [categoryId]: url
        };
      });
    } else {
      setPreviews(prev => {
        if (prev[categoryId]) {
          URL.revokeObjectURL(prev[categoryId]);
        }
        const copy = { ...prev };
        delete copy[categoryId];
        return copy;
      });
    }

    // Reset the input value so selecting the same file again triggers onChange
    e.target.value = '';
  };

  const clearStagedFile = (categoryId: string) => {
    setStagedFiles(prev => {
      const copy = { ...prev };
      delete copy[categoryId];
      return copy;
    });
    if (previews[categoryId]) {
      URL.revokeObjectURL(previews[categoryId]);
      setPreviews(prev => {
        const copy = { ...prev };
        delete copy[categoryId];
        return copy;
      });
    }
  };

  const handleUploadAttachments = async () => {
    if (!validIRN) return;
    setUploading(true);
    setUploadMessage(null);
    setUploadSuccess(false);

    try {
      const categories = [
        { id: 'fulldoc', label: 'Full Claim File Scan', folder: 'fulldoc', dbType: 'Full Claim FIle' },
        { id: 'adjourned', label: 'Adjourned File', folder: 'adjourned', dbType: 'Adjourned' },
        { id: 'appealed', label: 'Dismissed/Appealed File', folder: 'appealed', dbType: 'Appealed' },
        { id: 'rop', label: 'ROP File', folder: 'rop', dbType: 'ROP' },
        { id: 'misc', label: 'Other/Miscellaneous File', folder: 'misc', dbType: 'Other' }
      ];

      const activeCategoryIds = getActiveCategoryIds(submissionType);
      
      for (const catId of Object.keys(stagedFiles)) {
        if (!activeCategoryIds.includes(catId)) continue;
        const file = stagedFiles[catId];
        const cat = categories.find(c => c.id === catId);
        if (!cat) continue;

        const timestamp = Date.now();
        const originalName = file.name;
        const lastDot = originalName.lastIndexOf('.');
        const base = lastDot !== -1 ? originalName.slice(0, lastDot) : originalName;
        const ext = lastDot !== -1 ? originalName.slice(lastDot) : '';
        const safeBase = base.replace(/[^\w.-]+/g, '_');
        
        const storagePath = `attachments/tribunal/${cat.folder}/${safeBase}${timestamp}${ext}`;
        const dbPath = `\\attachments\\tribunal\\${cat.folder}\\${safeBase}${timestamp}${ext}`;

        const { error: storageErr } = await supabase.storage
          .from('cpps')
          .upload(storagePath, file);
        if (storageErr) throw storageErr;

        const { error: dbErr } = await supabase
          .from('tribunalattachments')
          .insert({
            IRN: validIRN,
            AttachmentType: cat.dbType,
            FileName: dbPath
          });
        if (dbErr) throw dbErr;
      }

      setStagedFiles({});
      Object.values(previews).forEach(URL.revokeObjectURL);
      setPreviews({});
      await loadExistingAttachments();
      
      setUploadSuccess(true);
      setUploadMessage('Tribunal attachments uploaded successfully.');
    } catch (err: any) {
      console.error('Error uploading attachments:', err);
      setUploadMessage(`Upload failed: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  };

  const confirmDeleteAttachment = async () => {
    if (!deleteTarget) return;
    const { docattachmentID, fileName } = deleteTarget;
    setDeleteTarget(null);
    try {
      // 1. Attempt to delete from storage first (non-blocking)
      const storagePath = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
      try {
        const { error: storageErr } = await supabase.storage
          .from('cpps')
          .remove([storagePath]);
        if (storageErr) {
          console.warn('Storage deletion warning/failure:', storageErr.message);
        }
      } catch (storageEx) {
        console.warn('Exception during storage deletion:', storageEx);
      }

      // 2. Delete from database second
      const { error: dbErr } = await supabase
        .from('tribunalattachments')
        .delete()
        .eq('DocattachmentID', docattachmentID);
      if (dbErr) throw dbErr;

      await loadExistingAttachments();
    } catch (err: any) {
      console.error('Error deleting attachment:', err);
      alert(`Failed to delete attachment: ${err.message}`);
    }
  };

  useEffect(() => {
    const validateIRN = () => {
      const irnNumber = parseInt(irn, 10);
      if (isNaN(irnNumber)) {
        setError('Invalid IRN: must be a number');
        setLoading(false);
        return;
      }
      setValidIRN(irnNumber);
    };

    validateIRN();
  }, [irn]);

  useEffect(() => {
    if (validIRN === null) return;

    const fetchFormData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch form1112master data to get worker details
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('*')
          .eq('IRN', validIRN)
          .single();

        if (form1112Error) {
          throw form1112Error;
        }

        // Fetch worker personal details
        const { data: workerData, error: workerError } = await supabase
          .from('workerpersonaldetails')
          .select('*')
          .eq('WorkerID', form1112Data.WorkerID)
          .single();

        if (workerError) {
          throw workerError;
        }

console.log('WorkerID:',form1112Data.WorkerID);
        console.log('Injury Extent:',form1112Data.NatureExtentInjury);
        console.log('Region:',form1112Data.IncidentRegion);

        // Fetch worker currentemployment details
        const { data: currentEmploymentData, error: currentEmploymentError } = await supabase
          .from('currentemploymentdetails')
          .select('*')
          .eq('WorkerID', form1112Data.WorkerID)
          .single();

        if (currentEmploymentError) {
          throw currentEmploymentError;
        }


 // Fetch worker employer details
        const { data: workerEmployerData, error: workerEmployerError } = await supabase
          .from('employermaster')
          .select('*')
          .eq('CPPSID', currentEmploymentData.EmployerCPPSID)
          .single();

        if (workerEmployerError) {
          throw workerEmployerError;
        }
        console.log('CPPSID:',currentEmploymentData.EmployerCPPSID);
        console.log('Employer:',workerEmployerData.OrganizationName);
        
        // Fetch form7master data
        const { data: form7Data, error: form7Error } = await supabase
          .from('form7master')
          .select('*')
          .eq('IRN', validIRN)
          .single();

        if (form7Error) {
          throw form7Error;
        }

        setFormData({
          ...form1112Data,
          ...workerData,
          ...currentEmploymentData,
          ...workerEmployerData,
          ...form7Data
        });
      } catch (err: any) {
        console.error('Error fetching form data:', err);
        setError(err.message || 'Failed to load form data');
      } finally {
        setLoading(false);
      }
    };

    fetchFormData();
  }, [validIRN]);

  const handleSetHearing = () => {
    if (!validIRN) return;
    setShowConfirmModal(true);
  };

  const confirmSetHearing = async () => {
    if (!validIRN) return;

    try {
      setSettingHearing(true);
      setHearingMessage(null);
      setShowConfirmModal(false);

      // 1. Update tribunalhearingschedule table
      const { error: updateError } = await supabase
        .from('tribunalhearingschedule')
        .update({
          THSSetForHearing: 'Scheduled',
          THSHearingStatus: 'HearingSet',
          THSSubmissionType: submissionType
        })
        .eq('IRN', validIRN);

      if (updateError) {
        throw updateError;
      }

      // 2. Insert into tribunalhearingoutcome table
      const { error: insertError } = await supabase
        .from('tribunalhearingoutcome')
        .insert({
          THOIRN: validIRN,
          THORegion: formData.IncidentRegion,
          THONatureOfAccident: formData.NatureExtentInjury,
          THOEmployer: formData.OrganizationName
        });

      if (insertError) {
        throw insertError;
      }

      setHearingMessage('Hearing has been successfully set for this claim. This form will close in 5 seconds.');
      setIsSuccess(true);
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        onClose();
      }, 5000);
    } catch (err: any) {
      console.error('Error setting hearing:', err);
      setHearingMessage(`Failed to set hearing: ${err.message}`);
    } finally {
      setSettingHearing(false);
    }
  };
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
          <div className="flex items-center text-red-600 mb-4">
            <AlertCircle className="h-6 w-6 mr-2" />
            <h3 className="text-lg font-semibold">Error</h3>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="flex justify-end">
            <button onClick={onClose} className="btn bg-primary text-white hover:bg-primary-dark">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-700">Loading hearing details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            253 - Tribunal Hearing Pending Employer Rejected Form 7 Submission
            {formData.DisplayIRN && (
              <span className="ml-2 text-sm font-normal text-gray-600">
                {formData.DisplayIRN}
              </span>
            )}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1: Form 7 - Notice to Registrar */}
          <div className="border rounded-lg p-4" id="form7-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 7 - Notice to Registrar</h3>
            <ViewForm7 irn={validIRN?.toString() || ''} incidentType={formData.IncidentType} onClose={onClose} />
          </div>

          {/* Section 2: Form 113 - Injury Claim Details */}
          <div className="border rounded-lg p-4" id="injuryclaims-section">
            <h3 className="text-lg font-semibold mb-4 text-primary">Form 113 - Injury Claim Details</h3>
            {validIRN ? (
              <Form113View irn={validIRN.toString()} onClose={onClose} />
            ) : (
              <p className="text-textSecondary">Injury claim details cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 3: Claim Decisions */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
            {validIRN ? (
              <ListClaimDecisions irn={validIRN} />
            ) : (
              <p className="text-textSecondary">Claim decisions cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 4: Compensation Breakup */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
            {validIRN ? (
              <CompensationBreakupDetailsView 
                IRN={validIRN.toString()} 
                DisplayIRN={formData.DisplayIRN} 
                IncidentType={formData.IncidentType || 'Injury'} 
              />
            ) : (
              <p className="text-textSecondary">Compensation data cannot be loaded without a valid IRN.</p>
            )}
          </div>

          {/* Section 5: Document Status */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Document Status</h3>
              <button
                onClick={() => setShowDocumentStatus(true)}
                className="btn bg-primary text-white hover:bg-primary-dark text-sm"
              >
                View Document Status
              </button>
            </div>
            <p className="text-textSecondary">Click the button above to view required and submitted documents for this claim.</p>
          </div>

          {/* Set Submission Type */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">Set Submission Type</h3>
            <div className="flex flex-col sm:flex-row gap-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="submissionType"
                  value="NewCase"
                  checked={submissionType === 'NewCase'}
                  onChange={(e) => setSubmissionType(e.target.value)}
                  className="form-radio h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                />
                <span className="text-gray-900 font-medium">New Case</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="submissionType"
                  value="AdjournedCase"
                  checked={submissionType === 'AdjournedCase'}
                  onChange={(e) => setSubmissionType(e.target.value)}
                  className="form-radio h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                />
                <span className="text-gray-900 font-medium">Adjourned Case</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="submissionType"
                  value="AppealedCase"
                  checked={submissionType === 'AppealedCase'}
                  onChange={(e) => setSubmissionType(e.target.value)}
                  className="form-radio h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                />
                <span className="text-gray-900 font-medium">Appealed Case</span>
              </label>
            </div>
            <p className="text-textSecondary mt-2">Select the type of hearing submission before setting the hearing.</p>
          </div>

          {/* Tribunal Attachments Section */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <Paperclip className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-primary">Tribunal Attachments</h3>
            </div>
            
            <p className="text-textSecondary mb-6 text-sm">
              Upload scanned documents related to this tribunal hearing. Select files from your computer or use your mobile device's camera to capture photos.
            </p>

            {fetchingAttachments ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { id: 'fulldoc', label: 'Full Claim File Scan', folder: 'fulldoc', dbType: 'Full Claim FIle' },
                  { id: 'adjourned', label: 'Adjourned File', folder: 'adjourned', dbType: 'Adjourned' },
                  { id: 'appealed', label: 'Dismissed/Appealed File', folder: 'appealed', dbType: 'Appealed' },
                  { id: 'rop', label: 'ROP File', folder: 'rop', dbType: 'ROP' },
                  { id: 'misc', label: 'Other/Miscellaneous File', folder: 'misc', dbType: 'Other' }
                ]
                  .filter(cat => getActiveCategoryIds(submissionType).includes(cat.id))
                  .map(cat => {
                    const existing = getExistingForCategory(cat.id);
                    const stagedFile = stagedFiles[cat.id];
                    const preview = previews[cat.id];

                    return (
                      <div key={cat.id} className="border rounded-lg p-4 bg-gray-50 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-gray-900 text-sm">{cat.label}</span>
                            <span className="text-xs text-gray-500 font-mono">/{cat.folder}</span>
                          </div>
                          
                          {/* Existing Attachments */}
                          {existing.length > 0 && (
                            <div className="space-y-2 mb-3">
                              <span className="text-xs font-semibold text-green-700 block">Uploaded Files:</span>
                              {existing.map(att => {
                                const url = getTribunalAttachmentUrl(att.FileName);
                                const isImage = /\.(png|jpe?g|gif|webp)$/i.test(att.FileName);
                                return (
                                  <div key={att.DocattachmentID} className="flex items-center justify-between p-2 bg-white rounded border border-green-200">
                                    <div className="flex items-center space-x-2 overflow-hidden w-4/5">
                                      {isImage && url ? (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
                                          <img
                                            src={url}
                                            alt={cat.label}
                                            className="w-10 h-10 object-cover rounded border hover:opacity-80"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          />
                                        </a>
                                      ) : (
                                        <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center flex-shrink-0">
                                          <FileText className="h-5 w-5 text-gray-400" />
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-700 truncate font-mono" title={att.FileName}>
                                        {att.FileName.split('\\').pop() || att.FileName.split('/').pop()}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      {url && (
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                          title="View Attachment"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </a>
                                      )}
                                      <button
                                        onClick={() => setDeleteTarget({ docattachmentID: att.DocattachmentID, fileName: att.FileName })}
                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                        title="Delete Attachment"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Staged File */}
                          {stagedFile && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3 flex items-center justify-between">
                              <div className="flex items-center space-x-3 overflow-hidden">
                                {preview ? (
                                  <img
                                    src={preview}
                                    alt="staged preview"
                                    className="w-12 h-12 object-cover rounded border"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-gray-400" />
                                  </div>
                                )}
                                <div className="overflow-hidden">
                                  <div className="text-xs font-semibold text-gray-900 truncate max-w-[150px]">{stagedFile.name}</div>
                                  <div className="text-[10px] text-gray-500">{(stagedFile.size / 1024).toFixed(1)} KB</div>
                                </div>
                              </div>
                              <button
                                onClick={() => clearStagedFile(cat.id)}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                title="Clear Selection"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* File Input */}
                        <div className="mt-2">
                          <label className="flex items-center justify-center px-4 py-2 border border-gray-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm text-gray-600 font-medium w-full">
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,application/pdf"
                              onChange={onPickFile(cat.id)}
                            />
                            <Upload className="h-4 w-4 mr-2 text-gray-400" />
                            {existing.length > 0 || stagedFile ? 'Change File' : 'Choose File / Camera'}
                          </label>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Action Bar when files are staged */}
            {Object.keys(stagedFiles).length > 0 && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-sm font-medium text-primary">
                  {Object.keys(stagedFiles).length} file{Object.keys(stagedFiles).length > 1 ? 's' : ''} selected to upload.
                </span>
                <div className="flex space-x-3 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setStagedFiles({});
                      Object.values(previews).forEach(URL.revokeObjectURL);
                      setPreviews({});
                    }}
                    disabled={uploading}
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleUploadAttachments}
                    disabled={uploading}
                    className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Upload & Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {uploadMessage && (
              <div className={`mt-4 p-3 rounded-lg text-sm flex items-center space-x-2 ${
                uploadSuccess 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {uploadSuccess ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <span>{uploadMessage}</span>
              </div>
            )}
          </div>
        </div>
          {/* Section 6: Set Hearing */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Set Hearing</h3>
              <button
                onClick={handleSetHearing}
                disabled={settingHearing || isSuccess}
                className="btn bg-primary text-white hover:bg-primary-dark text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingHearing ? 'Setting...' : isSuccess ? 'Scheduled' : 'Set for Hearing'}
              </button>
            </div>
            <p className="text-textSecondary">Click the button above to schedule this claim for tribunal hearing.</p>
            {hearingMessage && (
              <div className={`mt-4 p-3 rounded-md text-sm ${
                hearingMessage.includes('Failed') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {hearingMessage}
              </div>
            )}
          </div>
      </div>

      {/* Document Status Modal */}
      {showDocumentStatus && validIRN && (
        <DocumentStatus
          irn={validIRN.toString()}
          incidentType={formData.IncidentType || 'Injury'}
          onClose={() => setShowDocumentStatus(false)}
        />
      )}
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full mb-4">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Confirm Scheduling
              </h3>
              <p className="text-sm text-gray-600 mb-8">
                This claim will be set for Hearing.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={confirmSetHearing}
                  className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary-dark transition-colors"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Confirm Delete
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete this attachment? This action cannot be undone.
              </p>
              <div className="p-3 bg-gray-50 rounded-lg border text-xs text-gray-500 font-mono truncate mb-8 text-center" title={deleteTarget.fileName}>
                {deleteTarget.fileName.split('\\').pop() || deleteTarget.fileName.split('/').pop()}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAttachment}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-750 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Form253HearingPendingForm7Submission;
