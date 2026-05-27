import React, { useState, useEffect } from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, PDFViewer, Image, Font } from '@react-pdf/renderer';
import { Form, Input, Button, DatePicker, Select, Card, Row, Col, Spin } from 'antd';
import { UserOutlined, CalendarOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Define types for type safety
interface ConsentCertificateData {
  irn: string;
  workerName: string;
  workerAddress: string;
  employer: string;
  employerAddress: string;
  insurer: string;
  insurerAddress: string;
  tribunalDate: string;
  tribunalLocation: string;
  awardType: 'Injury' | 'Death';
  awardAmount: string;
  medicalExpenses: string;
  funeralExpenses: string;
  otherExpenses: string;
  totalAmount: string;
  paymentMethod: 'Cheque' | 'Bank Transfer' | 'Cash';
  paymentReference: string;
  paymentDate: string;
  commissionerName: string;
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
    marginBottom: 20,
    borderBottom: '1px solid #000000',
    paddingBottom: 10
  },
  countryName: {
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'underline',
    textAlign: 'center',
    marginBottom: 10
  },
  certificateTitle: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 20
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
  partiesSection: {
    marginBottom: 20
  },
  partyRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  partyLabel: {
    fontSize: 12,
    fontWeight: 700,
    width: 100
  },
  partyValue: {
    fontSize: 12,
    flex: 1
  },
  tribunalSection: {
    marginBottom: 20
  },
  tribunalRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  tribunalLabel: {
    fontSize: 12,
    fontWeight: 700,
    width: 120
  },
  tribunalValue: {
    fontSize: 12,
    flex: 1
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
const PDFDocument = ({ data }: { data: ConsentCertificateData }) => {
  // Format date for PDF
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* Header with country name */}
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.countryName}>THE REPUBLIC OF INDIA</Text>
          <Text style={pdfStyles.certificateTitle}>CONSENT AWARD CERTIFICATE</Text>
        </View>

        {/* Parties Information */}
        <View style={pdfStyles.partiesSection}>
          <Text style={pdfStyles.sectionTitle}>PARTIES TO THE CLAIM</Text>
          
          <View style={pdfStyles.partyRow}>
            <Text style={pdfStyles.partyLabel}>WORKER:</Text>
            <Text style={pdfStyles.partyValue}>{data.workerName}</Text>
          </View>
          
          <View style={pdfStyles.partyRow}>
            <Text style={pdfStyles.partyLabel}>ADDRESS:</Text>
            <Text style={pdfStyles.partyValue}>{data.workerAddress}</Text>
          </View>
          
          <View style={pdfStyles.partyRow}>
            <Text style={pdfStyles.partyLabel}>EMPLOYER:</Text>
            <Text style={pdfStyles.partyValue}>{data.employer}</Text>
          </View>
          
          <View style={pdfStyles.partyRow}>
            <Text style={pdfStyles.partyLabel}>ADDRESS:</Text>
            <Text style={pdfStyles.partyValue}>{data.employerAddress}</Text>
          </View>
          
          <View style={pdfStyles.partyRow}>
            <Text style={pdfStyles.partyLabel}>INSURER:</Text>
            <Text style={pdfStyles.partyValue}>{data.insurer}</Text>
          </View>
          
          <View style={pdfStyles.partyRow}>
            <Text style={pdfStyles.partyLabel}>ADDRESS:</Text>
            <Text style={pdfStyles.partyValue}>{data.insurerAddress}</Text>
          </View>
        </View>

        {/* Tribunal Information */}
        <View style={pdfStyles.tribunalSection}>
          <Text style={pdfStyles.sectionTitle}>TRIBUNAL INFORMATION</Text>
          
          <View style={pdfStyles.tribunalRow}>
            <Text style={pdfStyles.tribunalLabel}>DATE OF AWARD:</Text>
            <Text style={pdfStyles.tribunalValue}>{formatDate(data.tribunalDate)}</Text>
          </View>
          
          <View style={pdfStyles.tribunalRow}>
            <Text style={pdfStyles.tribunalLabel}>LOCATION:</Text>
            <Text style={pdfStyles.tribunalValue}>{data.tribunalLocation}</Text>
          </View>
        </View>

        {/* Award Details */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>AWARD DETAILS</Text>
          
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>AWARD TYPE:</Text>
            <Text style={pdfStyles.value}>{data.awardType}</Text>
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
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>CERTIFICATION</Text>
          
          <Text style={{ marginBottom: 20 }}>
            I hereby certify that the above award has been made in accordance with the Workers' Compensation Act.
          </Text>
          
          <Text>
            This certificate shall be conclusive evidence of the award made and shall be admissible in evidence without further proof.
          </Text>
        </View>

        {/* Signatures */}
        <View style={pdfStyles.signatureSection}>
          <View>
            <Text style={pdfStyles.signatureText}>Registrar</Text>
            <View style={pdfStyles.signatureLine} />
          </View>
          
          <View>
            <Text style={pdfStyles.signatureText}>Date: {formatDate(data.tribunalDate)}</Text>
            <View style={pdfStyles.signatureLine} />
          </View>
        </View>

        {/* Commissioner Signature */}
        <View style={{ marginTop: 40, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Commissioner's Signature</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Image style={{ width: 120, height: 60 }} src="/commissioner-signature.png" />
          </View>
        </View>

        {/* Footer */}
        <Text style={pdfStyles.footer} render={({ pageNumber, totalPages }) => 
          `Page ${pageNumber} / ${totalPages}`
        } />
      </Page>
    </Document>
  );
};

// Main Component
const RegistrarConsentAwardCertificate: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [formData, setFormData] = useState<ConsentCertificateData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);

  // Load existing data from localStorage if available
  useEffect(() => {
    const storedData = localStorage.getItem('registrar_consent_award_data');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        setFormData(parsedData);
        form.setFieldsValue(parsedData);
      } catch (err) {
        console.error('Error parsing stored data:', err);
        setError('Error loading stored data');
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
      setError('Please complete all required fields');
      return;
    }

    const certificateData = {
      ...values,
      tribunalDate: values.tribunalDate.format('YYYY-MM-DD'),
      paymentDate: values.paymentDate.format('YYYY-MM-DD')
    };
    
    setFormData(certificateData);
    localStorage.setItem('registrar_consent_award_data', JSON.stringify(certificateData));
    setError(null);
  };

  // Generate PDF
  const handleGeneratePDF = () => {
    if (!formData) {
      setError('Please complete the form before generating PDF');
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
    if (!formData) return 'consent-award-certificate.pdf';
    
    const names = formData.workerName.split(' ');
    const firstName = names[0] || '';
    const lastName = names[names.length - 1] || '';
    const irn = formData.irn.replace(/\s+/g, '_');
    return `${firstName}_${lastName}_${irn}_consent_award.pdf`;
  };

  if (loading) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-md max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Registrar Consent Award Certificate</h1>
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
      <h1 className="text-3xl font-bold mb-6 text-primary">Registrar Consent Award Certificate</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-yellow-500/10 text-yellow-500 rounded-md flex items-start">
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
        {/* IRN and Tribunal Date */}
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
              label="Tribunal Date"
              name="tribunalDate"
              rules={[{ required: true, message: 'Please select tribunal date' }]}
            >
              <DatePicker
                className="w-full bg-surface text-white border-gray-600 focus:border-primary"
                suffixIcon={<CalendarOutlined className="text-gray-400" />}
                format="DD/MM/YYYY"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Worker Information */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary">Worker Information</h2>
          
          <Row gutter={[16, 16]}>
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
                label="Worker's Address"
                name="workerAddress"
                rules={[{ required: true, message: 'Please enter worker address' }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Enter address"
                  className="bg-surface text-white border-gray-600 focus:border-primary"
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Employer Information */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary">Employer Information</h2>
          
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Employer Name"
                name="employer"
                rules={[{ required: true, message: 'Please enter employer name' }]}
              >
                <Input
                  placeholder="Enter employer name"
                  prefix={<UserOutlined className="text-gray-400" />}
                  className="bg-surface text-white border-gray-600 focus:border-primary"
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label="Employer Address"
                name="employerAddress"
                rules={[{ required: true, message: 'Please enter employer address' }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Enter address"
                  className="bg-surface text-white border-gray-600 focus:border-primary"
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Insurer Information */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary">Insurer Information</h2>
          
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Insurer Name"
                name="insurer"
                rules={[{ required: true, message: 'Please enter insurer name' }]}
              >
                <Input
                  placeholder="Enter insurer name"
                  prefix={<UserOutlined className="text-gray-400" />}
                  className="bg-surface text-white border-gray-600 focus:border-primary"
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label="Insurer Address"
                name="insurerAddress"
                rules={[{ required: true, message: 'Please enter insurer address' }]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Enter address"
                  className="bg-surface text-white border-gray-600 focus:border-primary"
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Tribunal Location */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Form.Item
              label="Tribunal Location"
              name="tribunalLocation"
              rules={[{ required: true, message: 'Please enter tribunal location' }]}
            >
              <Input
                placeholder="Enter tribunal location"
                className="bg-surface text-white border-gray-600 focus:border-primary"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Award Details */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary">Award Details</h2>
          
          <Row gutter={[16, 16]}>
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
          </Row>
        </div>

        {/* Payment Details */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary">Payment Details</h2>
          
          <Row gutter={[16, 16]}>
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

            <Col span={12}>
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

            <Col span={12}>
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
          </Row>
        </div>

        {/* Commissioner Information */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary">Commissioner Information</h2>
          
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Commissioner's Name"
                name="commissionerName"
                rules={[{ required: true, message: 'Please enter commissioner name' }]}
              >
                <Input
                  placeholder="Enter commissioner's name"
                  className="bg-surface text-white border-gray-600 focus:border-primary"
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Remarks */}
        <div className="bg-surface-dark p-4 rounded-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-textSecondary">Remarks</h2>
          
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="Additional Remarks"
                name="remarks"
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Enter any additional remarks"
                  className="bg-surface text-white border-gray-600 focus:border-primary"
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Form Actions */}
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
        <div className="bg-surface-dark p-6 rounded-md mb-8 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-textSecondary">PDF Preview</h2>
          <div className="h-96 w-full bg-white border border-gray-300 rounded-md overflow-hidden">
            <PDFViewer width="100%" height="100%">
              <PDFDocument data={formData} />
            </PDFViewer>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end mt-6">
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

export default RegistrarConsentAwardCertificate;
