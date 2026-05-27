import React, { useState, useEffect } from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, PDFViewer, Image, Font } from '@react-pdf/renderer';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Define types for type safety
interface DeputyData {
  irn: string;
  form_type: string;
  submission_date: string;
  worker_name: string;
  is_injury_case: boolean;
  is_death_case: boolean;
}

interface DocumentStatus {
  document_name: string;
  is_required: boolean;
  status: 'Submitted' | 'Pending';
  remarks?: string;
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
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 10,
    textDecoration: 'underline'
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    width: 120
  },
  value: {
    fontSize: 12,
    flex: 1
  },
  documentList: {
    marginBottom: 20
  },
  documentItem: {
    flexDirection: 'row',
    marginBottom: 5
  },
  documentNumber: {
    width: 20,
    fontSize: 10
  },
  documentName: {
    flex: 1,
    fontSize: 10
  },
  calculationSection: {
    marginTop: 20,
    marginBottom: 20
  },
  calculationRow: {
    flexDirection: 'row',
    marginBottom: 5
  },
  calculationLabel: {
    width: 150,
    fontSize: 12,
    fontWeight: 700
  },
  calculationValue: {
    flex: 1,
    fontSize: 12
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
const PDFDocument = ({ deputyData, documents, calculation }: { 
  deputyData: DeputyData, 
  documents: DocumentStatus[],
  calculation: CalculationSummary
}) => {
  // Format date for PDF
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  // Calculate total compensation
  const calculateTotal = () => {
    const base = calculation.base_amount;
    const factor = calculation.injury_factor;
    const doctor = calculation.doctor_percentage;
    
    return Math.round((base * factor * (doctor / 100)) / 100);
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

        {/* Case Information */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>CASE INFORMATION</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>IRN:</Text>
            <Text style={pdfStyles.value}>{deputyData.irn}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>FORM TYPE:</Text>
            <Text style={pdfStyles.value}>{deputyData.form_type}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>SUBMISSION DATE:</Text>
            <Text style={pdfStyles.value}>{formatDate(deputyData.submission_date)}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>CASE TYPE:</Text>
            <Text style={pdfStyles.value}>
              {deputyData.is_injury_case ? 'Injury (Form3/Form11)' : 'Death (Form4/Form12)'}
            </Text>
          </View>
        </View>

        {/* Document Status */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>DOCUMENT STATUS</Text>
          <View style={pdfStyles.documentList}>
            {documents.map((doc, index) => (
              <View key={index} style={pdfStyles.documentItem}>
                <Text style={pdfStyles.documentNumber}>{index + 1}.</Text>
                <Text style={pdfStyles.documentName}>
                  {doc.document_name} - {doc.status}
                  {doc.remarks && ` (${doc.remarks})`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Compensation Calculation */}
        <View style={pdfStyles.calculationSection}>
          <Text style={pdfStyles.sectionTitle}>COMPENSATION CALCULATION</Text>
          <View style={pdfStyles.calculationRow}>
            <Text style={pdfStyles.calculationLabel}>Base Compensation Amount:</Text>
            <Text style={pdfStyles.calculationValue}>{calculation.base_amount} K</Text>
          </View>
          <View style={pdfStyles.calculationRow}>
            <Text style={pdfStyles.calculationLabel}>Injury Factor:</Text>
            <Text style={pdfStyles.calculationValue}>{calculation.injury_factor}</Text>
          </View>
          <View style={pdfStyles.calculationRow}>
            <Text style={pdfStyles.calculationLabel}>Doctor Percentage:</Text>
            <Text style={pdfStyles.calculationValue}>{calculation.doctor_percentage}%</Text>
          </View>
          <View style={pdfStyles.calculationRow}>
            <Text style={pdfStyles.calculationLabel}>Total Compensation:</Text>
            <Text style={pdfStyles.calculationValue}>{calculateTotal()} K</Text>
          </View>
        </View>

        {/* Signature */}
        <View style={pdfStyles.signatureSection}>
          <View>
            <Text style={pdfStyles.signatureText}>Deputy Registrar</Text>
            <View style={pdfStyles.signatureLine} />
          </View>
          <View>
            <Text style={pdfStyles.signatureText}>Date: {formatDate(new Date().toISOString())}</Text>
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
const DeputyRegistrarConfirmationLetter: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [deputyData, setDeputyData] = useState<DeputyData | null>(null);
  const [documents, setDocuments] = useState<DocumentStatus[]>([]);
  const [calculation, setCalculation] = useState<CalculationSummary>({
    base_amount: 10000,
    injury_factor: 1,
    doctor_percentage: 0,
    total_compensation: 0,
    medical_expenses: 0,
    misc_expenses: 0,
    deductions: 0
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data from session storage
  useEffect(() => {
    const storedData = localStorage.getItem('deputy_confirmation_data');
    const storedDocs = localStorage.getItem('deputy_confirmation_documents');
    
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        setDeputyData(parsedData);
        
        if (storedDocs) {
          setDocuments(JSON.parse(storedDocs));
        } else {
          // Initialize with default documents if none exist
          const defaultDocs = parsedData.form_type === 'Form11' 
            ? [
                { document_name: 'Form11 - Injury Report', is_required: true, status: 'Pending' },
                { document_name: 'Medical Certificate', is_required: true, status: 'Pending' },
                { document_name: 'Employer Statement', is_required: true, status: 'Pending' },
                { document_name: 'Witness Statement', is_required: false, status: 'Pending' }
              ]
            : [
                { document_name: 'Form12 - Death Report', is_required: true, status: 'Pending' },
                { document_name: 'Death Certificate', is_required: true, status: 'Pending' },
                { document_name: 'Employer Statement', is_required: true, status: 'Pending' },
                { document_name: 'Medical Examiner Report', is_required: true, status: 'Pending' }
              ];
          setDocuments(defaultDocs);
        }
      } catch (err) {
        setError('Error parsing stored data');
        toast.error('Error parsing stored data');
      }
    } else {
      setError('No case data found. Please complete the case review first.');
      toast.error('No case data found. Please complete the case review first.');
    }
  }, []);

  // Validate documents before generating PDF
  const validateDocuments = () => {
    if (!deputyData) return false;
    
    const requiredDocs = documents.filter(doc => doc.is_required);
    const missingDocs = requiredDocs.filter(doc => doc.status === 'Pending');
    
    if (missingDocs.length > 0) {
      setError(`Please submit all required documents for ${deputyData.form_type}`);
      toast.error(`Please submit all required documents for ${deputyData.form_type}`);
      return false;
    }
    
    setError(null);
    return true;
  };

  // Generate PDF filename
  const getFileName = () => {
    if (!deputyData) return 'confirmation-letter.pdf';
    
    const name = deputyData.worker_name.replace(/\s+/g, '_');
    const irn = deputyData.irn.replace(/\s+/g, '_');
    return `${name}_${irn}.pdf`;
  };

  // Handle PDF generation
  const handleGeneratePDF = () => {
    if (!validateDocuments()) return;
    
    setIsGenerating(true);
    
    // In a real implementation, this would fetch from API
    // const response = await fetch(`/api/case/${deputyData.irn}/calculation`);
    // const calculationData = await response.json();
    // setCalculation(calculationData);
    
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  // Strip HTML tags from document names
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]+>/g, '');
  };

  if (loading) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Deputy Registrar Confirmation Letter</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!deputyData) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Deputy Registrar Confirmation Letter</h1>
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md flex items-start">
          <Text className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5">⚠</Text>
          <div>
            <p className="font-medium">No case data available</p>
            <p className="text-sm mt-2">
              Please complete a case review before generating a confirmation letter.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-primary text-white py-2 px-4 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-8 rounded-lg shadow-md max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-primary">Deputy Registrar Confirmation Letter</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-md flex items-start">
          <Text className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5">⚠</Text>
          <div>
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-2">
              Please ensure all required documents are submitted before generating the letter.
            </p>
          </div>
        </div>
      )}

      {/* Case Information */}
      <div className="bg-surface-dark p-6 rounded-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-textSecondary">Case Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-textSecondary mb-2">IRN:</p>
            <p className="text-white font-medium">{deputyData.irn}</p>
          </div>
          <div>
            <p className="text-textSecondary mb-2">Form Type:</p>
            <p className="text-white font-medium">{deputyData.form_type}</p>
          </div>
          <div>
            <p className="text-textSecondary mb-2">Submission Date:</p>
            <p className="text-white font-medium">
              {new Date(deputyData.submission_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </p>
          </div>
          <div>
            <p className="text-textSecondary mb-2">Case Type:</p>
            <p className="text-white font-medium">
              {deputyData.is_injury_case ? 'Injury (Form3/Form11)' : 'Death (Form4/Form12)'}
            </p>
          </div>
        </div>
      </div>

      {/* Document Status */}
      <div className="bg-surface-dark p-6 rounded-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-textSecondary">Document Status</h2>
        <table className="min-w-full divide-y divide-gray-700">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Document Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {documents.map((doc, index) => (
              <tr key={index} className="hover:bg-gray-800 transition-colors duration-200">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-textSecondary">{stripHtml(doc.document_name)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <select
                    value={doc.status}
                    onChange={(e) => {
                      const updatedDocs = [...documents];
                      updatedDocs[index] = { ...updatedDocs[index], status: e.target.value as 'Submitted' | 'Pending' };
                      setDocuments(updatedDocs);
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Submitted">Submitted</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-textSecondary">
                  {doc.remarks || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PDF Preview */}
      <div className="bg-surface-dark p-6 rounded-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-textSecondary">PDF Preview</h2>
        <div className="h-96 w-full bg-white border border-gray-300 rounded-md overflow-hidden">
          <PDFViewer width="100%" height="100%">
            <PDFDocument 
              deputyData={deputyData} 
              documents={documents} 
              calculation={calculation} 
            />
          </PDFViewer>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleGeneratePDF}
          disabled={isGenerating}
          className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200"
        >
          {isGenerating ? (
            <span className="flex items-center">
              <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
              Generating PDF...
            </span>
          ) : (
            <>
              <span className="mr-2">📄</span>
              Generate Confirmation Letter
            </>
          )}
        </button>
      </div>

      {/* PDF Download Link */}
      {deputyData && (
        <div className="mt-6 text-center">
          <PDFDownloadLink 
            document={<PDFDocument deputyData={deputyData} documents={documents} calculation={calculation} />} 
            fileName={getFileName()}
            className="hidden"
          >
            {({ blob, url, loading, error }) => {
              if (loading) return 'Loading document...';
              if (error) return 'Error generating document';
              return null;
            }}
          </PDFDownloadLink>
        </div>
      )}
    </div>
  );
};

export default DeputyRegistrarConfirmationLetter;
