import React, { useEffect, useState } from 'react';
import { X, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface DocumentStatusProps {
  irn: string;
  incidentType: string;
  onClose?: () => void;
}

type DocumentStatus = {
  required: string[];
  submitted: string[];
  missing: string[];
};

const DocumentStatus: React.FC<DocumentStatusProps> = ({ irn, incidentType, onClose }) => {
  const [status, setStatus] = useState<DocumentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch submitted documents from formattachments
        const { data: submittedRows, error: submittedError } = await supabase
          .from('formattachments')
          .select('AttachmentType')
          .eq('IRN', irn);

        if (submittedError) {
          console.error('Error fetching submitted documents:', submittedError);
          throw new Error('Failed to fetch submitted documents');
        }

        const submitted = submittedRows?.map(row => row.AttachmentType) || [];

        // 2. Determine required FormType (Form11 for Injury, Form12 otherwise)
        const requiredForm = incidentType === 'Injury' ? 'Form11' : 'Form12';

        // 3. Fetch required documents from attachmentmaster
        const { data: requiredRows, error: requiredError } = await supabase
          .from('attachmentmaster')
          .select('AttachmentType')
          .eq('FormType', requiredForm);

        if (requiredError) {
          console.error('Error fetching required documents:', requiredError);
          throw new Error('Failed to fetch required documents');
        }

        const required = requiredRows?.map(row => row.AttachmentType) || [];

        // 4. Compute missing
        const missing = required.filter(item => !submitted.includes(item));

        setStatus({ required, submitted, missing });
      } catch (err: any) {
        console.error('Error fetching document status:', err);
        setError(err.message || 'Failed to load document data');
      } finally {
        setLoading(false);
      }
    };

    if (irn) {
      fetchData();
    } else {
      setLoading(false);
      setError('IRN is required');
    }
  }, [irn, incidentType]);

  const getIcon = (type: string, isMissing: boolean) => {
    return isMissing ? (
      <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
    ) : (
      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-700">Loading document status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Document Status</h2>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="text-red-600 mb-4">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
          {onClose && (
            <div className="flex justify-end">
              <button onClick={onClose} className="btn btn-primary">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Document Status</h2>
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-red-600">Failed to load document data.</p>
          {onClose && (
            <div className="flex justify-end mt-4">
              <button onClick={onClose} className="btn btn-primary">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="h-6 w-6 mr-2 text-primary" />
            Document Status - IRN: {irn}
          </h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Required Documents Section */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-700 mb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Required Documents for {incidentType} Claim
            </h3>
            <p className="text-sm text-red-600 mb-3">
              The following attachments are <span className="font-semibold">REQUIRED</span> for this claim:
            </p>
            <ul className="space-y-2">
              {status.required.map((doc, i) => (
                <li key={i} className="flex items-center text-sm">
                  {getIcon(doc, !status.submitted.includes(doc))}
                  <span className="font-medium mr-2">{i + 1}.</span>
                  <span className={!status.submitted.includes(doc) ? 'text-yellow-700' : 'text-green-700'}>
                    {doc}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Submitted Documents Section */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-700 mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Submitted Documents
            </h3>
            <p className="text-sm text-green-600 mb-3">
              The following attachments are <span className="font-semibold">SUBMITTED</span> for this claim:
            </p>
            {status.submitted.length > 0 ? (
              <ul className="space-y-2">
                {status.submitted.map((doc, i) => (
                  <li key={i} className="flex items-center text-sm text-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <span className="font-medium mr-2">{i + 1}.</span>
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No documents have been submitted yet.</p>
            )}
          </div>

          {/* Missing Documents Section */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-700 mb-3 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Missing Documents
            </h3>
            <p className="text-sm text-yellow-600 mb-3">
              The following attachments are <span className="font-semibold">MISSING</span> for this claim:
            </p>
            {status.missing.length > 0 ? (
              <ul className="space-y-2">
                {status.missing.map((doc, i) => (
                  <li key={i} className="flex items-center text-sm text-yellow-700">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                    <span className="font-medium mr-2">{i + 1}.</span>
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center text-sm text-green-700">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                <span className="font-semibold">All required documents have been submitted!</span>
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{status.required.length}</div>
                <div className="text-gray-600">Required</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{status.submitted.length}</div>
                <div className="text-gray-600">Submitted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{status.missing.length}</div>
                <div className="text-gray-600">Missing</div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Completion Progress</span>
                <span className="text-sm text-gray-600">
                  {Math.round((status.submitted.length / status.required.length) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-green-500 rounded-full transition-all duration-300" 
                  style={{ width: `${(status.submitted.length / status.required.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {onClose && (
          <div className="border-t p-4 bg-gray-50 flex justify-end">
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentStatus;
