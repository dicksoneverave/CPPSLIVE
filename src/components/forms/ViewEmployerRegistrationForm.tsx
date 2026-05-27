import React, { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface ViewEmployerRegistrationFormProps {
  employerId: string;
  onClose: () => void;
}

interface EmployerData {
  EMID: string;
  CPPSID: string;
  OrganizationName: string;
  IncorporationDate: string;
  Address1: string;
  Address2: string;
  City: string;
  Province: string;
  POBox: string;
  Website: string;
  MobilePhone: string;
  LandLine: string;
  Email: string;
  OrganizationType: string;
  ValidationCode: string;
  InsuranceProviderIPACode: string;
  IsLevyPaid: string;
  LevyReferenceNumber: string;
  IsAgent: string;
  IsLawyer: string;
  IsInsuranceCompany: string;
}

interface InsuranceProvider {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
}

const ViewEmployerRegistrationForm: React.FC<ViewEmployerRegistrationFormProps> = ({ employerId, onClose }) => {
  const [data, setData] = useState<EmployerData | null>(null);
  const [insurers, setInsurers] = useState<InsuranceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: employer, error: employerErr } = await supabase
          .from('employermaster')
          .select('*')
          .eq('EMID', employerId)
          .single();
        if (employerErr) throw employerErr;
        setData(employer);

        const { data: insuranceData, error: insErr } = await supabase
          .from('insurancecompanymaster')
          .select('IPACODE, InsuranceCompanyOrganizationName')
          .order('InsuranceCompanyOrganizationName');
        if (insErr) throw insErr;
        setInsurers(insuranceData || []);
      } catch (e) {
        console.error(e);
        setError('Failed to load employer data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [employerId]);

  const yn = (v?: string) => (v === '1' || v === 'Yes' ? 'Yes' : 'No');
  const fmtDate = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toISOString().split('T')[0];
  };
  const insuranceName =
    insurers.find(p => p.IPACODE === data?.InsuranceProviderIPACode)?.InsuranceCompanyOrganizationName
    || data?.InsuranceProviderIPACode
    || '';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-3 text-lg">Loading summary...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <X className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-4">{error ?? 'No data found.'}</p>
            <button onClick={onClose} className="btn btn-primary">Close</button>
          </div>
        </div>
      </div>
    );
  }

  // Reusable row renderer
  const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <div className="grid grid-cols-12 gap-3 py-2">
      <div className="col-span-12 md:col-span-4 text-sm font-medium text-gray-600">{label}</div>
      <div className="col-span-12 md:col-span-8 text-sm text-gray-900 break-words">{value || <span className="text-gray-400 italic">—</span>}</div>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 print:shadow-none print:ring-0">
      <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );

  return (
    <div className="fixed inset-0 bg-black/50 print:bg-transparent flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] overflow-y-auto relative print:max-h-none print:shadow-none print:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10 print:static print:border-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Employer Summary — {data.OrganizationName}
            </h2>
            <p className="text-sm text-gray-500 mt-1">EMID: {data.EMID} • CPPS ID: {data.CPPSID}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-secondary hidden print:hidden md:inline-flex"
              title="Print"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Organization */}
          <Section title="Organization Details">
            <Row label="Organization Name" value={data.OrganizationName} />
            <Row label="Incorporation Date" value={fmtDate(data.IncorporationDate)} />
            <Row label="Organization Type" value={data.OrganizationType} />
            <Row label="Validation Code" value={data.ValidationCode} />
            <Row label="Website" value={data.Website} />
          </Section>

          {/* Address */}
          <Section title="Address">
            <Row label="Address Line 1" value={data.Address1} />
            <Row label="Address Line 2" value={data.Address2} />
            <Row label="City" value={data.City} />
            <Row label="Province" value={data.Province} />
            <Row label="P.O. Box" value={data.POBox} />
          </Section>

          {/* Contact */}
          <Section title="Contact Information">
            <Row label="Mobile Phone" value={data.MobilePhone} />
            <Row label="Landline" value={data.LandLine} />
            <Row label="Email" value={data.Email} />
          </Section>

          {/* Status / roles */}
          <Section title="Status & Roles">
            <Row label="Is Levy Paid" value={yn(data.IsLevyPaid)} />
            {yn(data.IsLevyPaid) === 'Yes' && (
              <Row label="Levy Reference Number" value={data.LevyReferenceNumber} />
            )}
            <Row label="Is Agent" value={yn(data.IsAgent)} />
            <Row label="Is Lawyer" value={yn(data.IsLawyer)} />
            <Row label="Is Insurance Company" value={yn(data.IsInsuranceCompany)} />
          </Section>

          {/* Insurance */}
          <Section title="Insurance Provider">
            <Row label="Insurance Provider" value={insuranceName} />
          </Section>

          {/* Footer buttons */}
          <div className="flex justify-between mt-6 pt-6 border-t print:hidden">
            <div />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>

          {/* Print styles */}
          <style>{`
            @media print {
              @page { size: A4; margin: 16mm; }
              .btn { display: none !important; }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
};

export default ViewEmployerRegistrationForm;
