import React, { useState, useEffect } from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, PDFViewer, Image, Font } from '@react-pdf/renderer';
import { Form, Input, Button, DatePicker, Select, Card, Row, Col, Spin, message } from 'antd';
import { UserOutlined, CalendarOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Define types for type safety
interface CertificateData {
  irn: string;
  workerName: string;
  dateOfAward: string;
  employer: string;
  insurer: string;
  awardType: 'Injury' | 'Death';
  awardNumber: string;
  awardDate: string;
  awardAmount: string;
  medicalExpenses: string;
  funeralExpenses: string;
  otherExpenses: string;
  totalAmount: string;
  paymentMethod: 'Cheque' | 'Bank Transfer' | 'Cash';
  paymentReference: string;
  paymentDate: string;
  remarks: string;
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
    width: 150
  },
  value: {
    fontSize: 12,
    flex: 1
  },
  certificationSection: {
    marginTop: 20,
    marginBottom: 20
  },
  certificationText: {
    fontSize: 12,
    marginBottom: 10
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

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header with logo */}
        <View style={pdfStyles.header}>
          <Image style={pdfStyles.logo} src="/logo.jpg" />
          <View>
            <Text style={pdfStyles.headerText}>OFFICE OF THE WORKERS' COMPENSATION</Text>
            <Text style={pdfStyles.headerText}>CERTIFICATE OF AWARD</Text>
          </View>
        </View>

        {/* Award Information */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>AWARD INFORMATION</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>IRN:</Text>
            <Text style={pdfStyles.value}>{data.irn}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>WORKER'S NAME:</Text>
            <Text style={pdfStyles.value}>{data.workerName}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>DATE OF AWARD:</Text>
            <Text style={pdfStyles.value}>{formatDate(data.dateOfAward)}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>EMPLOYER:</Text>
            <Text style={pdfStyles.value}>{data.employer}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>INSURER:</Text>
            <Text style={pdfStyles.value}>{data.insurer}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>AWARD TYPE:</Text>
            <Text style={pdfStyles.value}>{data.awardType}</Text>
          </View>
        </View>

        {/* Award Details */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>AWARD DETAILS</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>AWARD NUMBER:</Text>
            <Text style={pdfStyles.value}>{data.awardNumber}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>AWARD DATE:</Text>
            <Text style={pdfStyles.value}>{formatDate(data.awardDate)}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>AWARD AMOUNT:</Text>
            <Text style={pdfStyles.value}>{data.awardAmount}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>MEDICAL EXPENSES:</Text>
            <Text style={pdfStyles.value}>{data.medicalExpenses}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>FUNERAL EXPENSES:</Text>
            <Text style={pdfStyles.value}>{data.funeralExpenses}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>OTHER EXPENSES:</Text>
            <Text style={pdfStyles.value}>{data.otherExpenses}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>TOTAL AMOUNT:</Text>
            <Text style={pdfStyles.value}>{data.totalAmount}</Text>
          </View>
        </View>

        {/* Payment Details */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>PAYMENT DETAILS</Text>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>PAYMENT METHOD:</Text>
            <Text style={pdfStyles.value}>{data.paymentMethod}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>PAYMENT REFERENCE:</Text>
            <Text style={pdfStyles.value}>{data.paymentReference}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>PAYMENT DATE:</Text>
            <Text style={pdfStyles.value}>{formatDate(data.paymentDate)}</Text>
          </View>
        </View>

        {/* Certification */}
        <View style={pdfStyles.certificationSection}>
          <Text style={pdfStyles.certificationText}>
            I hereby certify that the above award has been made in accordance with the Workers' Compensation Act.
          </Text>
          <Text style={pdfStyles.certificationText}>
            This certificate shall be conclusive evidence of the award made and shall be admissible in evidence without further proof.
          </Text>
        </View>

        {/* Signature */}
        <View style={pdfStyles.signatureSection}>
          <View>
            <Text style={pdfStyles.signatureText}>Registrar</Text>
            <View style={pdfStyles.signatureLine} />
          </View>
          <View>
            <Text style={pdfStyles.signatureText}>Date: {formatDate(data.awardDate)}</Text>
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
const RegistrarCertificateOfAward: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [formData, setFormData] = useState<CertificateData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);

  // Load existing data from localStorage if available
  useEffect(() => {
    const storedData = localStorage.getItem('registrar_certificate_data');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        setFormData(parsedData);
        form.setFieldsValue(parsedData);
      } catch (err) {
        message.error('Error parsing stored data');
      }
    }
  }, []);

  // Handle form validation
  const handleFormChange = () => {
    form.validateFields()
      .then(() => setIsFormValid(true))
      .catch(() => setIsFormValid(false));
  };

  // Handle form submission
  const handleFinish = (values: any) => {
    if (!isFormValid) {
      message.error('Please complete all required fields');
      return;
    }

    const certificateData = {
      ...values,
      dateOfAward: values.dateOfAward.format('YYYY-MM-DD'),
      awardDate: values.awardDate.format('YYYY-MM-DD'),
      paymentDate: values.paymentDate.format('YYYY-MM-DD')
    };
    
    setFormData(certificateData);
    localStorage.setItem('registrar_certificate_data', JSON.stringify(certificateData));
  };

  // Generate PDF
  const handleGeneratePDF = () => {
    if (!formData) {
      message.error('Please complete the form before generating PDF');
      return;
    }
    
    setIsGenerating(true);
    
    // In a real implementation, this would call an API
    // const response = await fetch(`/api/certificate/${formData.irn}/generate`);
    // const pdfData = await response.json();
    
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  // Generate filename
  const getFileName = () => {
    if (!formData) return 'certificate-of-award.pdf';
    
    const names = formData.workerName.split(' ');
    const firstName = names[0] || '';
    const lastName = names[names.length - 1] || '';
    const irn = formData.irn.replace(/\s+/g, '_');
    return `${firstName}_${lastName}_${irn}.pdf`;
  };

  if (loading) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Registrar Certificate of Award</h1>
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
      <h1 className="text-3xl font-bold mb-6 text-primary">Registrar Certificate of Award</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-md flex items-start">
          <span className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="font-medium">{error}</p>
            <p className="text-sm mt-2">
              Please ensure all required fields are completed before generating the certificate.
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        onValuesChange={handleFormChange}
        className="bg-surface-dark p-6 rounded-md mb-8"
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Form.Item
              label="IRN"
              name="irn"
              rules={[{ required: true, message: 'Please enter IRN' }]}
            >
              <Input
                placeholder="Enter IRN"
                prefix={<UserOutlined className="text-gray-400" />}
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Worker's Full Name"
              name="workerName"
              rules={[{ required: true, message: 'Please enter worker name' }]}
            >
              <Input
                placeholder="Enter full name"
                prefix={<UserOutlined className="text-gray-400" />}
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Date of Award"
              name="dateOfAward"
              rules={[{ required: true, message: 'Please select date' }]}
            >
              <DatePicker
                className="w-full bg-surface text-white border-gray-600 focus:border-primary"
                suffixIcon={<CalendarOutlined className="text-gray-400" />}
                format="DD/MM/YYYY"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Employer"
              name="employer"
              rules={[{ required: true, message: 'Please enter employer' }]}
            >
              <Input
                placeholder="Enter employer"
                prefix={<UserOutlined className="text-gray-400" />}
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Insurer"
              name="insurer"
              rules={[{ required: true, message: 'Please enter insurer' }]}
            >
              <Input
                placeholder="Enter insurer"
                prefix={<UserOutlined className="text-gray-400" />}
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Award Type"
              name="awardType"
              rules={[{ required: true, message: 'Please select award type' }]}
            >
              <Select
                options={[
                  { value: 'Injury', label: 'Injury' },
                  { value: 'Death', label: 'Death' }
                ]}
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Award Number"
              name="awardNumber"
              rules={[{ required: true, message: 'Please enter award number' }]}
            >
              <Input
                placeholder="Enter award number"
                prefix={<UserOutlined className="text-gray-400" />}
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Award Date"
              name="awardDate"
              rules={[{ required: true, message: 'Please select award date' }]}
            >
              <DatePicker
                className="w-full bg-surface text-white border-gray-600 focus:border-primary"
                suffixIcon={<CalendarOutlined className="text-gray-400" />}
                format="DD/MM/YYYY"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Award Amount"
              name="awardAmount"
              rules={[{ required: true, message: 'Please enter award amount' }]}
            >
              <Input
                placeholder="Enter amount"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Medical Expenses"
              name="medicalExpenses"
              rules={[{ required: true, message: 'Please enter medical expenses' }]}
            >
              <Input
                placeholder="Enter medical expenses"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Funeral Expenses"
              name="funeralExpenses"
              rules={[{ required: true, message: 'Please enter funeral expenses' }]}
            >
              <Input
                placeholder="Enter funeral expenses"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Other Expenses"
              name="otherExpenses"
              rules={[{ required: true, message: 'Please enter other expenses' }]}
            >
              <Input
                placeholder="Enter other expenses"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Total Amount"
              name="totalAmount"
              rules={[{ required: true, message: 'Please enter total amount' }]}
            >
              <Input
                placeholder="Enter total amount"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Payment Method"
              name="paymentMethod"
              rules={[{ required: true, message: 'Please select payment method' }]}
            >
              <Select
                options={[
                  { value: 'Cheque', label: 'Cheque' },
                  { value: 'Bank Transfer', label: 'Bank Transfer' },
                  { value: 'Cash', label: 'Cash' }
                ]}
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Payment Reference"
              name="paymentReference"
              rules={[{ required: true, message: 'Please enter payment reference' }]}
            >
              <Input
                placeholder="Enter payment reference"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Payment Date"
              name="paymentDate"
              rules={[{ required: true, message: 'Please select payment date' }]}
            >
              <DatePicker
                className="w-full bg-surface text-white border-gray-600 focus:border-primary"
                suffixIcon={<CalendarOutlined className="text-gray-400" />}
                format="DD/MM/YYYY"
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              label="Remarks"
              name="remarks"
            >
              <Input.TextArea
                rows={4}
                placeholder="Enter any remarks"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex justify-end mt-6">
          <Button
            type="primary"
            htmlType="submit"
            className="bg-primary hover:bg-primaryDark text-white py-2 px-6 rounded-md transition-colors duration-200"
          >
            Save Certificate
          </Button>
        </div>
      </Form>

      {/* PDF Preview */}
      {formData && (
        <div className="bg-surface-dark p-6 rounded-md mb-8">
          <h2 className="text-xl font-semibold mb-4 text-textSecondary">PDF Preview</h2>
          <div className="h-96 w-full bg-white border border-gray-300 rounded-md overflow-hidden">
            <PDFViewer width="100%" height="100%">
              <PDFDocument data={formData} />
            </PDFViewer>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          onClick={handleGeneratePDF}
          disabled={isGenerating || !formData}
          className="bg-primary text-white py-3 px-6 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 flex items-center"
        >
          {isGenerating ? (
            <span className="flex items-center">
              <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
              Generating PDF...
            </span>
          ) : (
            <>
              <span className="mr-2">📄</span>
              Generate Certificate
            </>
          )}
        </Button>
      </div>

      {/* PDF Download Link */}
      {formData && (
        <div className="mt-6 text-center">
          <PDFDownloadLink 
            document={<PDFDocument data={formData} />} 
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

export default RegistrarCertificateOfAward;
