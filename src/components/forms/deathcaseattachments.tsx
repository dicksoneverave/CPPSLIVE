import React, { useState, useEffect } from 'react';
import { Form, Upload, Button, Card, Row, Col, Spin, message } from 'antd';
import { UploadOutlined, FilePdfOutlined, FileImageOutlined, EyeOutlined } from '@ant-design/icons';
import { PDFViewer, Document, Page } from '@react-pdf/renderer';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

// Define types for type safety
interface DocumentSection {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  isRequired: boolean;
  uploaded: boolean;
  file?: File;
}

interface DeathCaseAttachmentsData {
  deathCertificate: DocumentSection;
  form4: DocumentSection | null;
  form12: DocumentSection | null;
  otherDocuments: DocumentSection[];
}

// Main Component
const DeathCaseAttachments: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { irn } = useParams();
  const [form] = Form.useForm();
  const [documents, setDocuments] = useState<DeathCaseAttachmentsData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);

  // Load existing documents from database
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        // Fetch death case documents
        const { data: deathCaseData, error: deathCaseError } = await supabase
          .from('death_case_documents')
          .select('*')
          .eq('irn', irn)
          .single();

        if (deathCaseError) {
          throw deathCaseError;
        }

        // Structure documents
        const structuredDocuments: DeathCaseAttachmentsData = {
          deathCertificate: {
            id: 'death_certificate',
            title: 'Death Certificate',
            fileName: deathCaseData.death_certificate_file || 'No file uploaded',
            fileUrl: deathCaseData.death_certificate_url || '',
            isRequired: true,
            uploaded: !!deathCaseData.death_certificate_file
          },
          form4: deathCaseData.form4_file ? {
            id: 'form4',
            title: 'Form 4',
            fileName: deathCaseData.form4_file,
            fileUrl: deathCaseData.form4_url,
            isRequired: false,
            uploaded: true
          } : null,
          form12: deathCaseData.form12_file ? {
            id: 'form12',
            title: 'Form 12',
            fileName: deathCaseData.form12_file,
            fileUrl: deathCaseData.form12_url,
            isRequired: false,
            uploaded: true
          } : null,
          otherDocuments: deathCaseData.other_documents || []
        };

        setDocuments(structuredDocuments);
        form.setFieldsValue({
          deathCertificate: deathCaseData.death_certificate_file,
          form4: deathCaseData.form4_file,
          form12: deathCaseData.form12_file,
          otherDocuments: deathCaseData.other_documents
        });
      } catch (error: any) {
        setError('Error loading documents');
        message.error('Failed to load document data');
        console.error('Document fetch error:', error.message);
      }
    };

    if (irn) {
      fetchDocuments();
    }
  }, [irn]);

  // Handle form validation
  const handleFormChange = () => {
    form.validateFields()
      .then(() => setIsFormValid(true))
      .catch(() => setIsFormValid(false));
  };

  // Handle file upload
  const handleFileUpload = async (file: File, documentId: string) => {
    // Validate file type and size
    const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!isValidType) {
      message.error('Please upload a PDF or image file');
      return false;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      message.error('File must be smaller than 5MB');
      return false;
    }

    // Simulate upload
    setIsSaving(true);
    try {
      // In a real implementation, this would upload to storage
      // const { data, error } = await supabase.storage
      //   .from('death-case-documents')
      //   .upload(`${irn}/${file.name}`, file);
      
      // if (error) throw error;

      // Update document state
      setDocuments(prev => {
        if (!prev) return prev;
        
        if (documentId === 'deathCertificate') {
          return {
            ...prev,
            deathCertificate: {
              ...prev.deathCertificate,
              file: file,
              fileName: file.name,
              uploaded: true
            }
          };
        } else if (documentId === 'form4') {
          return {
            ...prev,
            form4: prev.form4 ? {
              ...prev.form4,
              file: file,
              fileName: file.name,
              uploaded: true
            } : {
              id: 'form4',
              title: 'Form 4',
              fileName: file.name,
              fileUrl: URL.createObjectURL(file),
              isRequired: false,
              uploaded: true
            }
          };
        } else if (documentId === 'form12') {
          return {
            ...prev,
            form12: prev.form12 ? {
              ...prev.form12,
              file: file,
              fileName: file.name,
              uploaded: true
            } : {
              id: 'form12',
              title: 'Form 12',
              fileName: file.name,
              fileUrl: URL.createObjectURL(file),
              isRequired: false,
              uploaded: true
            }
          };
        } else if (documentId === 'otherDocuments') {
          const newDocument: DocumentSection = {
            id: `other_${Date.now()}`,
            title: 'Other Document',
            fileName: file.name,
            fileUrl: URL.createObjectURL(file),
            isRequired: false,
            uploaded: true
          };
          
          return {
            ...prev,
            otherDocuments: [...(prev?.otherDocuments || []), newDocument]
          };
        }
        
        return prev;
      });
      
      message.success(`${file.name} uploaded successfully`);
    } catch (error: any) {
      message.error(`Failed to upload ${file.name}`);
      console.error('Upload error:', error.message);
    } finally {
      setIsSaving(false);
    }
    
    return false; // Prevent default upload behavior
  };

  // Save document references
  const handleSave = async () => {
    if (!documents) return;
    
    try {
      setIsSaving(true);
      
      // In a real implementation, this would update the database
      // const { error } = await supabase
      //   .from('death_case_documents')
      //   .update({
      //     death_certificate_file: documents.deathCertificate.fileName,
      //     death_certificate_url: documents.deathCertificate.fileUrl,
      //     form4_file: documents.form4?.fileName || null,
      //     form4_url: documents.form4?.fileUrl || null,
      //     form12_file: documents.form12?.fileName || null,
      //     form12_url: documents.form12?.fileUrl || null,
      //     other_documents: documents.otherDocuments,
      //     updated_at: new Date().toISOString()
      //   })
      //   .eq('irn', irn);
      
      // if (error) throw error;
      
      message.success('Documents saved successfully');
      navigate('/dashboard');
    } catch (error: any) {
      setError('Error saving documents');
      message.error('Failed to save document references');
      console.error('Save error:', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if all required documents are uploaded
  const checkRequiredDocuments = () => {
    if (!documents?.deathCertificate.uploaded) {
      setError('Please upload the Death Certificate');
      return false;
    }
    
    setError(null);
    return true;
  };

  // Render document preview
  const renderDocumentPreview = (document: DocumentSection) => {
    if (!document.fileUrl) return null;
    
    if (document.fileUrl.endsWith('.pdf')) {
      return (
        <div className="h-64 w-full bg-white rounded-md overflow-hidden">
          <Document file={document.fileUrl}>
            <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        </div>
      );
    }
    
    return (
      <div className="h-64 w-full bg-white rounded-md overflow-hidden">
        <img 
          src={document.fileUrl} 
          alt={document.title} 
          className="w-full h-full object-contain"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Death Case Attachments</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-8 rounded-lg shadow-md max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-primary">Death Case Attachments</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-yellow-500/10 text-yellow-500 rounded-md flex items-start">
          <span className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-2">
              Please ensure all required documents are uploaded before saving.
            </p>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onValuesChange={handleFormChange}
        className="bg-surface-dark p-6 rounded-md mb-8"
      >
        {/* Death Certificate Section */}
        <div className="bg-surface-dark p-4 rounded-md mb-6 border-l-4 border-[#ba372a]">
          <h2 className="text-xl font-bold mb-4 text-textSecondary flex items-center">
            <span className="mr-2">📄</span>
            Death Certificate
            <span className="ml-2 text-[#ba372a] font-bold">*Required</span>
          </h2>
          
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Upload Death Certificate"
                name="deathCertificate"
                rules={[{ required: true, message: 'Please upload the death certificate' }]}
              >
                <Upload
                  name="deathCertificate"
                  listType="picture"
                  className="death-certificate-uploader"
                  showUploadList={false}
                  beforeUpload={(file) => handleFileUpload(file, 'deathCertificate')}
                  accept=".pdf,.jpg,.jpeg,.png"
                >
                  <Button
                    icon={<UploadOutlined />}
                    className="bg-[#ba372a] hover:bg-[#9f271a] text-white py-2 px-4 rounded-md transition-colors duration-200"
                  >
                    Upload Document
                  </Button>
                </Upload>
              </Form.Item>
            </Col>
            
            {documents?.deathCertificate.uploaded && (
              <Col span={24}>
                <div className="bg-surface p-4 rounded-md">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="mr-2">
                        {documents.deathCertificate.fileName.endsWith('.pdf') ? (
                          <FilePdfOutlined className="text-xl" />
                        ) : (
                          <FileImageOutlined className="text-xl" />
                        )}
                      </span>
                      <span className="text-textSecondary">{documents.deathCertificate.fileName}</span>
                    </div>
                    <Button
                      icon={<EyeOutlined />}
                      className="bg-gray-700 hover:bg-gray-600 text-white py-1 px-3 rounded-md"
                      onClick={() => window.open(documents.deathCertificate.fileUrl, '_blank')}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              </Col>
            )}
          </Row>
        </div>

        {/* Form 4 Section */}
        {documents?.form4 && (
          <div className="bg-surface-dark p-4 rounded-md mb-6 border-l-4 border-[#ba372a]">
            <h2 className="text-xl font-bold mb-4 text-textSecondary flex items-center">
              <span className="mr-2">📄</span>
              Form 4
            </h2>
            
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Upload Form 4"
                  name="form4"
                >
                  <Upload
                    name="form4"
                    listType="picture"
                    className="form4-uploader"
                    showUploadList={false}
                    beforeUpload={(file) => handleFileUpload(file, 'form4')}
                    accept=".pdf,.jpg,.jpeg,.png"
                  >
                    <Button
                      icon={<UploadOutlined />}
                      className="bg-[#ba372a] hover:bg-[#9f271a] text-white py-2 px-4 rounded-md transition-colors duration-200"
                    >
                      Upload Document
                    </Button>
                  </Upload>
                </Form.Item>
              </Col>
              
              {documents.form4.uploaded && (
                <Col span={24}>
                  <div className="bg-surface p-4 rounded-md">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="mr-2">
                          {documents.form4.fileName.endsWith('.pdf') ? (
                            <FilePdfOutlined className="text-xl" />
                          ) : (
                            <FileImageOutlined className="text-xl" />
                          )}
                        </span>
                        <span className="text-textSecondary">{documents.form4.fileName}</span>
                      </div>
                      <Button
                        icon={<EyeOutlined />}
                        className="bg-gray-700 hover:bg-gray-600 text-white py-1 px-3 rounded-md"
                        onClick={() => window.open(documents.form4.fileUrl, '_blank')}
                      >
                        Preview
                      </Button>
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}

        {/* Form 12 Section */}
        {documents?.form12 && (
          <div className="bg-surface-dark p-4 rounded-md mb-6 border-l-4 border-[#ba372a]">
            <h2 className="text-xl font-bold mb-4 text-textSecondary flex items-center">
              <span className="mr-2">📄</span>
              Form 12
            </h2>
            
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  label="Upload Form 12"
                  name="form12"
                >
                  <Upload
                    name="form12"
                    listType="picture"
                    className="form12-uploader"
                    showUploadList={false}
                    beforeUpload={(file) => handleFileUpload(file, 'form12')}
                    accept=".pdf,.jpg,.jpeg,.png"
                  >
                    <Button
                      icon={<UploadOutlined />}
                      className="bg-[#ba372a] hover:bg-[#9f271a] text-white py-2 px-4 rounded-md transition-colors duration-200"
                    >
                      Upload Document
                    </Button>
                  </Upload>
                </Form.Item>
              </Col>
              
              {documents.form12.uploaded && (
                <Col span={24}>
                  <div className="bg-surface p-4 rounded-md">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="mr-2">
                          {documents.form12.fileName.endsWith('.pdf') ? (
                            <FilePdfOutlined className="text-xl" />
                          ) : (
                            <FileImageOutlined className="text-xl" />
                          )}
                        </span>
                        <span className="text-textSecondary">{documents.form12.fileName}</span>
                      </div>
                      <Button
                        icon={<EyeOutlined />}
                        className="bg-gray-700 hover:bg-gray-600 text-white py-1 px-3 rounded-md"
                        onClick={() => window.open(documents.form12.fileUrl, '_blank')}
                      >
                        Preview
                      </Button>
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}

        {/* Other Documents Section */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary flex items-center">
            <span className="mr-2">📁</span>
            Other Documents
          </h2>
          
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Upload Additional Documents"
                name="otherDocuments"
              >
                <Upload
                  name="otherDocuments"
                  listType="picture"
                  className="other-documents-uploader"
                  showUploadList={false}
                  beforeUpload={(file) => handleFileUpload(file, 'otherDocuments')}
                  accept=".pdf,.jpg,.jpeg,.png"
                >
                  <Button
                    icon={<UploadOutlined />}
                    className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition-colors duration-200"
                  >
                    Upload Document
                  </Button>
                </Upload>
              </Form.Item>
            </Col>
            
            {documents?.otherDocuments.map((doc, index) => (
              <Col span={24} key={index}>
                <div className="bg-surface p-4 rounded-md">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="mr-2">
                        {doc.fileName.endsWith('.pdf') ? (
                          <FilePdfOutlined className="text-xl" />
                        ) : (
                          <FileImageOutlined className="text-xl" />
                        )}
                      </span>
                      <span className="text-textSecondary">{doc.fileName}</span>
                    </div>
                    <Button
                      icon={<EyeOutlined />}
                      className="bg-gray-700 hover:bg-gray-600 text-white py-1 px-3 rounded-md"
                      onClick={() => window.open(doc.fileUrl, '_blank')}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        {/* Hidden fields for document references */}
        <Form.Item name="deathCertificateRef" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="form4Ref" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="form12Ref" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="otherDocumentsRef" hidden>
          <Input />
        </Form.Item>

        {/* Form Actions */}
        <div className="flex justify-end mt-6">
          <Button
            type="primary"
            htmlType="submit"
            disabled={isSaving}
            className="bg-[#ba372a] hover:bg-[#9f271a] text-white py-3 px-6 rounded-md transition-colors duration-200 flex items-center"
          >
            {isSaving ? (
              <span className="flex items-center">
                <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
                Saving...
              </span>
            ) : (
              <>
                <span className="mr-2">💾</span>
                Save Attachments
              </>
            )}
          </Button>
        </div>
      </Form>

      {/* Document Preview Section */}
      {documents && (
        <div className="bg-surface-dark p-6 rounded-md mb-8 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-textSecondary">Document Preview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documents.deathCertificate.uploaded && (
              <div className="bg-surface p-4 rounded-md">
                <h3 className="font-medium mb-3 text-textSecondary">Death Certificate</h3>
                {renderDocumentPreview(documents.deathCertificate)}
              </div>
            )}
            
            {documents.form4?.uploaded && (
              <div className="bg-surface p-4 rounded-md">
                <h3 className="font-medium mb-3 text-textSecondary">Form 4</h3>
                {renderDocumentPreview(documents.form4)}
              </div>
            )}
            
            {documents.form12?.uploaded && (
              <div className="bg-surface p-4 rounded-md">
                <h3 className="font-medium mb-3 text-textSecondary">Form 12</h3>
                {renderDocumentPreview(documents.form12)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeathCaseAttachments;
