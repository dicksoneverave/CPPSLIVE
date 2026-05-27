// src/utils/pdfGenerator.tsx
import html2pdf from 'html2pdf.js';

const generatePDF = async (elementId: string, filename: string) => {
  try {
    await html2pdf().set({
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(document.getElementById(elementId)).save();
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};

export default generatePDF;
