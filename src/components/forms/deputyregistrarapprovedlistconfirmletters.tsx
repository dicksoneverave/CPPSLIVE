import React, { useState, useEffect } from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, PDFViewer, Image, Font } from '@react-pdf/renderer';
import { Table, TableHeader, TableRow, TableCell, TableBody } from 'antd/lib/table';
import { Button, Card, Row, Col, Checkbox, Spin, message } from 'antd';
import { DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Define types for type safety
interface Applicant {
  id: string;
  irn: string;
  workerName: string;
  submissionDate: string;
  awardType: 'Injury' | 'Death';
  status: 'Approved' | 'Pending' | 'On Hold';
  documents: DocumentStatus[];
}

interface DocumentStatus {
  document_name: string;
  is_required: boolean;
  status: 'Submitted' | 'Pending';
  remarks?: string;
}

interface CertificateData {
  irn: string;
  workerName: string;
  submissionDate: string;
  awardType: 'Injury' | 'Death';
  documents: DocumentStatus[];
  calculation: CalculationSummary;
}

interface CalculationSummary {
  base_amount: number;
  injury_factor: number;
  doctor_percentage: number;
  total_compensation: number;
  medical_expenses: number;
  misc_expenses: number;
  deductions: number;
}

// Register custom font for Times New Roman
Font.register({
  family: 'Times New Roman',
  fonts: [
    { src: '/fonts/times-new-roman/times-new-roman-normal.ttf' },
    { src: '/fonts/times-new-roman/times-new-roman-bold.ttf', fontWeight: 700 }
  ]
});

// PDF Styles
const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'Times New Roman',
    fontSize: 12,
    padding: 40,
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '1px solid #000000',
    paddingBottom: 10
  },
  logo: {
    width: 80,
    height: 80
  },
  headerText: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 10
  },
  addressSection: {
    marginBottom: 20
  },
  addressRow: {
    flexDirection: 'row',
    marginBottom: 5
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: 700,
    width: 120
  },
  addressValue: {
    fontSize: 12,
    flex: 1
  },
  bodySection: {
    marginBottom: 20
  },
  bodyText: {
    fontSize: 12,
    marginBottom: 10
  },
  listSection: {
    marginBottom: 20
  },
  listTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10
  },
  listRow: {
    flexDirection: 'row',
    marginBottom: 5
  },
  listNumber: {
    width: 20,
    fontSize: 10
  },
  listContent: {
    flex: 1,
    fontSize: 10
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  signatureLine: {
    width: 200,
    height: 1,
    backgroundColor: '#000000'
  },
  signatureText: {
    fontSize: 10,
    textAlign: 'center'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10
  }
});

// PDF Document Component
const PDFDocument = ({ data }: { data: CertificateData }) => {
  // Format date for PDF
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  // Format document list for PDF
  const formatDocumentList = () => {
    return data.documents.map((doc, index) => (
      <View key={index} style={pdfStyles.listRow}>
        <Text style={pdfStyles.listNumber}>{index + 1}.</Text>
        <Text style={pdfStyles.listContent}>
          {doc.document_name} - {doc.status}
          {doc.remarks && ` (${doc.remarks})`}
        </Text>
      </View>
    ));
  };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header with logo */}
        <View style={pdfStyles.header}>
          <Image style={pdfStyles.logo} src="/logo.jpg" />
          <View>
            <Text style={pdfStyles.headerText}>OFFICE OF THE WORKERS' COMPENSATION</Text>
            <Text style={pdfStyles.headerText}>DEPUTY REGISTRAR'S CONFIRMATION LETTER</Text>
          </View>
        </View>

        {/* Address Section */}
        <View style={pdfStyles.addressSection}>
          <View style={pdfStyles.addressRow}>
            <Text style={pdfStyles.addressLabel}>IRN:</Text>
            <Text style={pdfStyles.addressValue}>{data.irn}</Text>
          </View>
          <View style={pdfStyles.addressRow}>
            <Text style={pdfStyles.addressLabel}>WORKER'S NAME:</Text>
            <Text style={pdfStyles.addressValue}>{data.workerName}</Text>
          </View>
          <View style={pdfStyles.addressRow}>
            <Text style={pdfStyles.addressLabel}>DATE SUBMITTED:</Text>
            <Text style={pdfStyles.addressValue}>{formatDate(data.submissionDate)}</Text>
          </View>
          <View style={pdfStyles.addressRow}>
            <Text style={pdfStyles.addressLabel}>AWARD TYPE:</Text>
            <Text style={pdfStyles.addressValue}>{data.awardType}</Text>
          </View>
        </View>

        {/* Body Section */}
        <View style={pdfStyles.bodySection}>
          <Text style={pdfStyles.bodyText}>
            I hereby confirm that the documents listed below have been reviewed and approved for the {data.awardType} case.
          </Text>
          <Text style={pdfStyles.bodyText}>
            This confirmation is made in accordance with the Workers' Compensation Act and serves as official documentation
            that the case has been processed and is ready for final award certification.
          </Text>
        </View>

        {/* Document List */}
        <View style={pdfStyles.listSection}>
          <Text style={pdfStyles.listTitle}>DOCUMENTS SUBMITTED:</Text>
          {formatDocumentList()}
        </View>

        {/* Signature */}
        <View style={pdfStyles.signatureSection}>
          <View>
            <Text style={pdfStyles.signatureText}>Deputy Registrar</Text>
            <View style={pdfStyles.signatureLine} />
          </View>
          <View>
            <Text style={pdfStyles.signatureText}>Date: {formatDate(data.submissionDate)}</Text>
            <View style={pdfStyles.signatureLine} />
          </View>
        </View>

        {/* Footer */}
        <Text style={pdfStyles.footer} render={({ pageNumber, totalPages }) => 
          `${pageNumber} / ${totalPages}`
        } />
      </Page>
    </Document>
  );
};

// Main Component
const DeputyRegistrarApprovedListConfirmLetters: React.FC = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Mock data for approved applicants
  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        // In a real implementation, this would be an API call
        // const { data, error } = await supabase.from('approved_applicants').select('*');
        // if (error) throw error;
        
        // Simulated data
        const mockApplicants: Applicant[] = [
          {
            id: '1',
            irn: 'IRN2023-001',
            workerName: 'John Smith',
            submissionDate: '2023-05-15',
            awardType: 'Injury',
            status: 'Approved',
            documents: [
              { document_name: 'Form 11 - Injury Report', is_required: true, status: 'Submitted' },
              { document_name: 'Medical Certificate', is_required: true, status: 'Submitted' },
              { document_name: 'Employer Statement', is_required: true, status: 'Submitted' },
              { document_name: 'Witness Statement', is_required: false, status: 'Submitted' }
            ]
          },
          {
            id: '2',
            irn: 'IRN2023-002',
            workerName: 'Mary Johnson',
            submissionDate: '2023-05-14',
            awardType: 'Death',
            status: 'Approved',
            documents: [
              { document_name: 'Form 12 - Death Report', is_required: true, status: 'Submitted' },
              { document_name: 'Death Certificate', is_required: true, status: 'Submitted' },
              { document_name: 'Employer Statement', is_required: true, status: 'Submitted' },
              { document_name: 'Medical Examiner Report', is_required: true, status: 'Submitted' }
            ]
          },
          {
            id: '3',
            irn: 'IRN2023-003',
            workerName: 'Peter Wilson',
            submissionDate: '2023-05-13',
            awardType: 'Injury',
            status: 'Approved',
            documents: [
              { document_name: 'Form 3 - Injury Claim', is_required: true, status: 'Submitted' },
              { document_name: 'Medical Certificate', is_required: true, status: 'Submitted' },
              { document_name: 'Employer Statement', is_required: true, status: 'Submitted' },
              { document_name: 'Witness Statement', is_required: false, status: 'Submitted' }
            ]
          }
        ];
        
        setApplicants(mockApplicants);
      } catch (err) {
        setError('Failed to load approved applicants');
        message.error('Failed to load approved applicants');
      }
    };
    
    fetchApplicants();
  }, []);

  // Handle row selection
  const onSelectChange = (selectedKeys: React.Key[]) => {
    setSelectedRowKeys(selectedKeys);
  };

  // Handle individual PDF download
  const handleIndividualDownload = (applicant: Applicant) => {
    const certificateData: CertificateData = {
      irn: applicant.irn,
      workerName: applicant.workerName,
      submissionDate: applicant.submissionDate,
      awardType: applicant.awardType,
      documents: applicant.documents,
      calculation: {
        base_amount: 10000,
        injury_factor: applicant.awardType === 'Injury' ? 1 : 0.5,
        doctor_percentage: 50,
        total_compensation: 0,
        medical_expenses: 0,
        misc_expenses: 0,
        deductions: 0
      }
    };
    
    localStorage.setItem('deputy_confirmation_data', JSON.stringify(certificateData));
  };

  // Handle batch PDF download
  const handleBatchDownload = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one applicant for batch processing');
      return;
    }
    
    setIsBatchProcessing(true);
    
    // In a real implementation, this would call an API to generate a zip file
    // const response = await fetch('/api/certificate/batch', {
    //   method: 'POST',
    //   body: JSON.stringify({ applicants: selectedRowKeys })
    // });
    // const blob = await response.blob();
    
    setTimeout(() => {
      setIsBatchProcessing(false);
      message.success('Batch processing completed (mock)');
    }, 2000);
  };

  // Table columns
  const columns = [
    {
      title: 'IRN',
      dataIndex: 'irn',
      key: 'irn',
      render: (irn: string) => <span className="font-medium">{irn}</span>
    },
    {
      title: 'Worker Name',
      dataIndex: 'workerName',
      key: 'workerName'
    },
    {
      title: 'Submission Date',
      dataIndex: 'submissionDate',
      key: 'submissionDate',
      render: (date: string) => new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    },
    {
      title: 'Award Type',
      dataIndex: 'awardType',
      key: 'awardType',
      render: (type: 'Injury' | 'Death') => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${type === 'Injury' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
          {type}
        </span>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'Approved' | 'Pending' | 'On Hold') => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${status === 'Approved' ? 'bg-green-100 text-green-800' : 
            status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
          {status}
        </span>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Applicant) => (
        <Button 
          onClick={() => handleIndividualDownload(record)}
          className="text-primary hover:text-primary-dark"
          icon={<DownloadOutlined />}
        >
          Download
        </Button>
      )
    }
  ];

  // Generate filename for individual PDF
  const getIndividualFileName = (applicant: Applicant) => {
    const name = applicant.workerName.replace(/\s+/g, '_');
    return `${name}_${applicant.irn}.pdf`;
  };

  // Generate filename for batch PDF
  const getBatchFileName = () => {
    const date = new Date().toISOString().split('T')[0];
    return `batch_certificates_${date}.zip`;
  };

  if (loading) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Approved Applicants Confirmation Letters</h1>
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
    <div className="bg-surface p-8 rounded-lg shadow-md max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-primary">Approved Applicants Confirmation Letters</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-md flex items-start">
          <span className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-2">
              Please ensure all required documents are submitted before generating certificates.
            </p>
          </div>
        </div>
      )}

      {/* Table with selection */}
      <div className="mb-8">
        <Table
          dataSource={applicants}
          columns={columns}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedRowKeys,
            onChange: onSelectChange
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false
          }}
          className="bg-surface-dark rounded-md overflow-hidden"
          loading={isGenerating}
          locale={{
            emptyText: (
              <div className="py-8 text-center">
                <FilePdfOutlined className="text-4xl text-gray-400 mb-2" />
                <p className="text-gray-500">No approved applicants found</p>
              </div>
            )
          }}
        />
      </div>

      {/* Batch Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {selectedRowKeys.length} applicants selected
        </div>
        <Button
          onClick={handleBatchDownload}
          disabled={selectedRowKeys.length === 0}
          loading={isBatchProcessing}
          className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primary-dark transition-colors flex items-center"
          icon={<FilePdfOutlined />}
        >
          Batch Download
        </Button>
      </div>

      {/* PDF Preview for first selected applicant */}
      {selectedRowKeys.length > 0 && (
        <div className="bg-surface-dark p-6 rounded-md mt-8">
          <h2 className="text-xl font-semibold mb-4 text-textSecondary">PDF Preview</h2>
          <div className="h-96 w-full bg-white border border-gray-300 rounded-md overflow-hidden">
            <PDFViewer width="100%" height="100%">
              <PDFDocument data={applicants.find(a => a.id === selectedRowKeys[0]) as CertificateData} />
            </PDFViewer>
          </div>
        </div>
      )}

      {/* Hidden PDF Download Links */}
      {applicants.map(applicant => (
        <div key={applicant.id} className="hidden">
          <PDFDownloadLink 
            document={<PDFDocument data={applicant as CertificateData} />} 
            fileName={getIndividualFileName(applicant)}
            className="hidden"
          >
            {({ blob, url, loading, error }) => {
              if (loading) return 'Loading document...';
              if (error) return 'Error generating document';
              return null;
            }}
          </PDFDownloadLink>
        </div>
      ))}
    </div>
  );
};

export default DeputyRegistrarApprovedListConfirmLetters;
