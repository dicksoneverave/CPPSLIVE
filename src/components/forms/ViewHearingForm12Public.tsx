import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Download, Paperclip, FileText, Eye, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { generateSingleConsentLetter, generateSingleROP, generateSingleForm18 } from '../../utils/tribunalPDFUtils';

interface ViewHearingFormProps {
  irn: string;
  hearingNo: string;
  onClose: () => void;
}

interface TribunalAttachment {
  DocattachmentID: number;
  IRN: number;
  AttachmentType: string;
  FileName: string;
}

const ViewHearingForm12Public: React.FC<ViewHearingFormProps> = ({ irn, hearingNo, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [hearingDetails, setHearingDetails] = useState<any>(null);

  // Tribunal Attachments states
  const [existingAttachments, setExistingAttachments] = useState<TribunalAttachment[]>([]);
  const [fetchingAttachments, setFetchingAttachments] = useState(false);

  const loadExistingAttachments = async () => {
    const irnNum = parseInt(irn, 10);
    if (isNaN(irnNum)) return;
    try {
      setFetchingAttachments(true);
      const { data, error: dbErr } = await supabase
        .from('tribunalattachments')
        .select('*')
        .eq('IRN', irnNum);
      if (dbErr) throw dbErr;
      setExistingAttachments(data || []);
    } catch (err) {
      console.error('Error loading tribunal attachments:', err);
    } finally {
      setFetchingAttachments(false);
    }
  };

  useEffect(() => {
    loadExistingAttachments();
  }, [irn]);

  const getTribunalAttachmentUrl = (dbFileName: string) => {
    if (!dbFileName) return null;
    const path = dbFileName.replace(/\\/g, '/').replace(/^\/+/, '');
    const { data } = supabase.storage.from('cpps').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Claim Basic Info & Worker Name
        const { data: form1112Data, error: form1112Error } = await supabase
          .from('form1112master')
          .select('DisplayIRN, WorkerID')
          .eq('IRN', parseInt(irn, 10))
          .maybeSingle();

        if (form1112Error) throw form1112Error;
        if (!form1112Data) throw new Error('Form 1112 data not found');

        const { data: workerData } = await supabase
          .from('workerpersonaldetails')
          .select('WorkerFirstName, WorkerLastName')
          .eq('WorkerID', form1112Data.WorkerID)
          .maybeSingle();

        // 2. Fetch Hearing Decision
        const { data: thoData } = await supabase
          .from('tribunalhearingoutcome')
          .select('THODecision, THOClaimant')
          .eq('THOIRN', irn)
          .maybeSingle();

        // 3. Fetch Hearing Set Info (CORAM etc)
        const { data: shData, error: shError } = await supabase
          .from('tribunalhearingsethearing')
          .select('*')
          .eq('THSHHearingNo', hearingNo)
          .maybeSingle();

        if (shError) throw shError;

        setFormData({ 
          DisplayIRN: form1112Data.DisplayIRN,
          THODecision: thoData?.THODecision,
          ClaimantName: thoData?.THOClaimant || `${workerData?.WorkerFirstName || ''} ${workerData?.WorkerLastName || ''}`.trim()
        });
        setHearingDetails(shData);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [irn, hearingNo]);

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
            <button onClick={onClose} className="btn bg-primary text-white hover:bg-primary-dark">Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-700">Loading details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">View Tribunal Hearing Record</h2>
            <p className="text-sm text-gray-500">
              Claimant: <span className="font-medium">{formData.ClaimantName}</span> | IRN: <span className="font-medium">{formData.DisplayIRN}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-8">
          {/* Hearing Details Section */}
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="p-4 border-b bg-gray-50/50">
              <h3 className="text-lg font-semibold text-primary">Tribunal Hearing Details</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hearing No</label>
                    <p className="bg-gray-50 p-2 rounded border font-medium">{hearingDetails?.THSHHearingNo || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                    <p className={`p-2 rounded border font-medium ${hearingDetails?.THSHStatus === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                      {hearingDetails?.THSHStatus || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Venue</label>
                    <p className="bg-gray-50 p-2 rounded border">{hearingDetails?.THSHVenue || 'N/A'}</p>
                  </div>
                   <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location</label>
                    <p className="bg-gray-50 p-2 rounded border">{hearingDetails?.THSHLocation || 'N/A'}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From Date</label>
                    <p className="bg-gray-50 p-2 rounded border">{hearingDetails?.THSHFromDate ? new Date(hearingDetails.THSHFromDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To Date</label>
                    <p className="bg-gray-50 p-2 rounded border">{hearingDetails?.THSHToDate ? new Date(hearingDetails.THSHToDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>

                <div className="md:col-span-3 border-t pt-4 mt-2">
                  <h4 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Tribunal CORAM</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tribunal Chair</label>
                        <p className="bg-blue-50/30 p-2 rounded border border-blue-100 font-semibold">{hearingDetails?.THSHTribunalChair || 'N/A'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Claimant Representative 1</label>
                          <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHClaimantRep1 || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Claimant Representative 2</label>
                          <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHClaimantRep2 || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">State Representative 1</label>
                        <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHStateRep1 || 'N/A'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">State Representative 2</label>
                          <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHStateRep2 || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">State Representative 3</label>
                          <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHStateRep3 || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3 border-t pt-4">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tribunal Member 1</label>
                        <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHTribunal1 || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tribunal Member 2</label>
                        <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHTribunal2 || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tribunal Member 3</label>
                        <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHTribunal3 || 'N/A'}</p>
                      </div>
                   </div>
                </div>

                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                   <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Observer 1</label>
                      <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHObserver1 || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Observer 2</label>
                      <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHObserver2 || 'N/A'}</p>
                    </div>
                </div>

                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 pb-2">
                   <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Officer Assisting Tribunal 1</label>
                      <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHOfficerAssistTribunal1 || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Officer Assisting Tribunal 2</label>
                      <p className="bg-gray-50 p-2 rounded border text-sm">{hearingDetails?.THSHOfficerAssistTribunal2 || 'N/A'}</p>
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hearing Decision Documents Section */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4 text-blue-900 flex items-center">
              <Download className="mr-2 h-5 w-5" />
              Hearing Decision Documents (Individual Record)
            </h3>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => generateSingleConsentLetter(supabase, irn, hearingNo, formData.THODecision || 'Consented')}
                className="btn bg-primary text-white hover:bg-primary-dark shadow-md flex items-center px-6 py-2"
              >
                <Download className="h-4 w-4 mr-2" />
                Print Consent Cover Letter
              </button>
              <button 
                onClick={() => generateSingleROP(supabase, irn, hearingNo)}
                className="btn bg-green-600 text-white hover:bg-green-700 shadow-md flex items-center px-6 py-2"
              >
                <Download className="h-4 w-4 mr-2" />
                Print ROP PDF
              </button>
              <button 
                onClick={() => generateSingleForm18(supabase, irn, hearingNo)}
                className="btn bg-orange-600 text-white hover:bg-orange-700 shadow-md flex items-center px-6 py-2"
              >
                <Download className="h-4 w-4 mr-2" />
                Print Form 18
              </button>
            </div>
            <p className="text-xs text-blue-700 mt-4 italic font-medium">
              * Documents will be generated for the individual claimant listed in the header.
            </p>
          </div>

          {/* Tribunal Attachments */}
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <Paperclip className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-primary">Tribunal Attachments</h3>
            </div>
            
            <p className="text-textSecondary mb-6 text-sm">
              View uploaded documents related to this tribunal hearing.
            </p>

            {fetchingAttachments ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
              </div>
            ) : existingAttachments.length === 0 ? (
              <p className="text-textSecondary text-sm py-4 text-center">No attachments found for this claim.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {existingAttachments.map(att => {
                  const url = getTribunalAttachmentUrl(att.FileName);
                  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(att.FileName);
                  return (
                    <div key={att.DocattachmentID} className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-2 overflow-hidden w-4/5">
                        {isImage && url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
                            <img
                              src={url}
                              alt={att.AttachmentType || "Attachment"}
                              className="w-10 h-10 object-cover rounded border hover:opacity-80"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </a>
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <div className="text-xs font-semibold text-gray-900 truncate">
                            {att.AttachmentType || "Other"}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate font-mono" title={att.FileName}>
                            {att.FileName.split('\\').pop() || att.FileName.split('/').pop()}
                          </div>
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end bg-gray-50 sticky bottom-0 z-10">
          <button onClick={onClose} className="btn bg-gray-200 text-gray-800 hover:bg-gray-300 px-8">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ViewHearingForm12Public;
