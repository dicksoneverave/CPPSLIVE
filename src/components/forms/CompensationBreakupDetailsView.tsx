// changes: make DisplayIRN prop optional, add local state + fetch from workerirn when missing
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface WorkerDetails {
  CCWDWorkerFirstName: string;
  CCWDWorkerLastName: string;
  CCWDWorkerDOB?: string | null;
  CCWDAnnualWage: string;
  CCWDCompensationAmount: string;
  CCWDMedicalExpenses: string;
  CCWDMiscExpenses: string;
  CCWDDeductions: string;
  CCWDDeductionsNotes: string;
}
interface InjuryCheckList {
  ICCLCriteria: string;
  ICCLFactor: string;
  ICCLDoctorPercentage: string;
  ICCLCompensationAmount: string;
}
interface PersonalDetails {
  CCPDPersonFirstName: string;
  CCPDPersonLastName: string;
  CCPDPersonDOB: string | null;
  CCPDRelationToWorker: string;
  CCPDDegreeOfDependance: string;
  CCPDCompensationAmount: string;
}
interface CompensationBreakupDetailsViewProps {
  IRN: string;
  DisplayIRN?: string;
  IncidentType: string;
}

// money + date helpers
const money = (n: number) => `K${(n || 0).toLocaleString()}`;
const pretty = (d?: string | Date | null) => {
  if (!d) return '--';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d as string;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// children benefits helpers
const round2 = (n: number) => Math.round(n * 100) / 100;
const formatDMY = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const calculateAgeAt = (dob: Date, at: Date) => {
  let age = at.getFullYear() - dob.getFullYear();
  const m = at.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) age--;
  return age < 0 ? 0 : age;
};
const isChildType = (t?: string) => (t || '').toLowerCase() === 'child';

type WeeklyChildRow = {
  name: string;
  dob: string;
  age: number;
  daysUntil16: number;
  weeksUntil16: number;
  benefit: number;
};

const CompensationBreakupDetailsView: React.FC<CompensationBreakupDetailsViewProps> = ({
  IRN,
  DisplayIRN,
  IncidentType,
}) => {
  // ---------------- hooks (ALWAYS top-level, fixed order) ----------------
  const [workerDetails, setWorkerDetails] = useState<WorkerDetails | null>(null);
  const [injuryCheckList, setInjuryCheckList] = useState<InjuryCheckList[]>([]);
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // display IRN (prop or fetched)
  const [displayIRNLocal, setDisplayIRNLocal] = useState<string>(DisplayIRN ?? '');

  // for children weekly benefit table
  const [incidentDate, setIncidentDate] = useState<string>(''); // from form1112master
  const [weeklyPerChild, setWeeklyPerChild] = useState<number>(0); // from dictionary SystemParameter
  const [childrenWeeklyRows, setChildrenWeeklyRows] = useState<WeeklyChildRow[]>([]);

  // ---------------- effects ----------------

  // resolve DisplayIRN if not provided
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      if (DisplayIRN) {
        if (!isCancelled) setDisplayIRNLocal(DisplayIRN);
        return;
      }
      if (!IRN) return;
      const { data, error } = await supabase
        .from('workerirn')
        .select('DisplayIRN')
        .eq('IRN', IRN)
        .maybeSingle();
      if (!isCancelled && !error && data?.DisplayIRN) {
        setDisplayIRNLocal(String(data.DisplayIRN));
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [IRN, DisplayIRN]);

  // fetch all base data
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        if (!IRN) return;
        setLoadingData(true);
        setError(null);

        const irnNumber = parseInt(IRN, 10);
        if (isNaN(irnNumber)) throw new Error('Invalid IRN: must be a number');

        // worker details
        const { data: workerRow, error: workerError } = await supabase
          .from('claimcompensationworkerdetails')
          .select('*')
          .eq('IRN', irnNumber)
          .maybeSingle();
        if (workerError) throw workerError;

        // dependents/applicants
        const { data: personalRows, error: personalError } = await supabase
          .from('claimcompensationpersonaldetails')
          .select('*')
          .eq('IRN', irnNumber);
        if (personalError) throw personalError;

        // injury checklist only for Injury (this doesn’t change hook order; just sets state)
        let injuryRows: InjuryCheckList[] = [];
        if (IncidentType === 'Injury') {
          const { data, error } = await supabase
            .from('injurycasechecklist')
            .select('*')
            .eq('IRN', irnNumber);
          if (error) throw error;
          injuryRows = data || [];
        }

        // incident date
        const { data: f1112, error: f1112Err } = await supabase
          .from('form1112master')
          .select('IncidentDate')
          .eq('IRN', irnNumber)
          .maybeSingle();
        if (f1112Err) throw f1112Err;

        // weekly rate
        const { data: sysParams, error: sysErr } = await supabase
          .from('dictionary')
          .select('DKey, DValue')
          .eq('DType', 'SystemParameter');
        if (sysErr) throw sysErr;
        const weekly = Number(
          sysParams?.find((p: any) => p.DKey === 'WeeklyCompensationPerChildDeath')?.DValue
        ) || 0;

        if (isCancelled) return;

        setWorkerDetails((workerRow as unknown as WorkerDetails) ?? null);
        setPersonalDetails(personalRows || []);
        setInjuryCheckList(injuryRows);
        setIncidentDate(f1112?.IncidentDate || '');
        setWeeklyPerChild(weekly);
        setLoadingData(false);
      } catch (err: any) {
        if (isCancelled) return;
        setError(`Error loading compensation details: ${err.message}`);
        setLoadingData(false);
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [IRN, IncidentType]);

  // build children rows (pure)
  useEffect(() => {
    if (IncidentType !== 'Death') {
      setChildrenWeeklyRows([]);
      return;
    }
    if (!incidentDate) {
      setChildrenWeeklyRows([]);
      return;
    }
    const at = new Date(incidentDate);
    if (Number.isNaN(at.getTime())) {
      setChildrenWeeklyRows([]);
      return;
    }

    const rows: WeeklyChildRow[] = (personalDetails || [])
      .filter((p) => isChildType(p.CCPDRelationToWorker))
      .map((p) => {
        const dob = p.CCPDPersonDOB ? new Date(p.CCPDPersonDOB) : new Date('Invalid');
        const validDob = Number.isNaN(dob.getTime()) ? new Date(0) : dob;

        const age = calculateAgeAt(validDob, at);
        const age16 = new Date(validDob);
        age16.setFullYear(age16.getFullYear() + 16);

        const days = Math.max(0, Math.round((age16.getTime() - at.getTime()) / 86400000));
        const weeks = Math.max(0, Number((days / 7).toFixed(3)));
        const benefit = round2(weeklyPerChild * weeks);

        return {
          name: `${p.CCPDPersonFirstName} ${p.CCPDPersonLastName}`.trim(),
          dob: Number.isNaN(validDob.getTime()) ? 'N/A' : formatDMY(validDob),
          age,
          daysUntil16: days,
          weeksUntil16: weeks,
          benefit,
        };
      });

    setChildrenWeeklyRows(rows);
  }, [IncidentType, incidentDate, weeklyPerChild, personalDetails]);

  // ---------------- render (no hooks below this line) ----------------

  if (error) {
    return (
      <div className="bg-surface p-5 rounded-lg shadow-md w-full">
        <h1 className="text-xl font-semibold mb-4 text-primary">Compensation Breakup Details</h1>
        <div className="bg-error/10 border border-error text-error p-3 rounded-md text-sm">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="bg-surface p-5 rounded-lg shadow-md w-full">
        <h1 className="text-xl font-semibold mb-4 text-primary">Compensation Breakup Details</h1>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!workerDetails) {
    return (
      <div className="bg-surface p-5 rounded-lg shadow-md w-full">
        <h1 className="text-xl font-semibold mb-4 text-primary">Compensation Breakup Details</h1>
        <div className="bg-warning/10 border border-warning text-warning p-3 rounded-md text-sm">
          <p>No worker details found for this claim.</p>
        </div>
      </div>
    );
  }

  const workerDOBRaw = workerDetails.CCWDWorkerDOB ?? (workerDetails as any).WorkerDOB ?? null;

  const view = {
    display_irn: displayIRNLocal,
    worker_first_name: workerDetails.CCWDWorkerFirstName,
    worker_last_name: workerDetails.CCWDWorkerLastName,
    worker_date_of_birth: pretty(workerDOBRaw),
    annual_wage: parseFloat(workerDetails.CCWDAnnualWage) || 0,
    total_compensation: parseFloat(workerDetails.CCWDCompensationAmount) || 0,
    medical_expenses: parseFloat(workerDetails.CCWDMedicalExpenses) || 0,
    miscellaneous_expenses: parseFloat(workerDetails.CCWDMiscExpenses) || 0,
    deductions: parseFloat(workerDetails.CCWDDeductions) || 0,
    deduction_notes: workerDetails.CCWDDeductionsNotes || '',
    is_injury_case: IncidentType === 'Injury',
    dependents: personalDetails.map((detail) => ({
      name: `${detail.CCPDPersonFirstName} ${detail.CCPDPersonLastName}`.trim(),
      relationship: detail.CCPDRelationToWorker,
      date_of_birth: pretty(detail.CCPDPersonDOB),
      degree_of_dependence: detail.CCPDDegreeOfDependance,
      compensation_amount: parseFloat(detail.CCPDCompensationAmount) || 0,
    })),
  };

  const totalChildrenBenefit =
    childrenWeeklyRows.reduce((s, r) => s + (Number.isFinite(r.benefit) ? r.benefit : 0), 0) || 0;

  return (
    <div className="bg-surface p-5 rounded-lg shadow-md w-full">
      <h1 className="text-xl font-semibold mb-4 text-primary">Compensation Breakup Details</h1>

      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3 text-textSecondary">Claim Reference</h2>
        <div className="bg-surface-dark p-3 rounded-md text-sm">
          <p className="text-textSecondary">
            <span className="font-medium">Display IRN (CRN): </span>
            {view.display_irn || '--'}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3 text-textSecondary">Worker Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-dark p-3 rounded-md">
            <h3 className="text-sm font-medium mb-2 text-textSecondary">Personal Details</h3>
            <p className="text-textSecondary text-sm">
              <span className="font-medium">Name: </span>
              {view.worker_first_name} {view.worker_last_name}
            </p>
            <p className="text-textSecondary text-sm mt-2">
              <span className="font-medium">Date of Birth: </span>
              {view.worker_date_of_birth || '--'}
            </p>
          </div>

          <div className="bg-surface-dark p-3 rounded-md">
            <h3 className="text-sm font-medium mb-2 text-textSecondary">Financial Details</h3>
            <p className="text-textSecondary text-sm">
              <span className="font-medium">Annual Wage: </span>
              {money(view.annual_wage)}
            </p>
          </div>
        </div>
      </div>

<div className="mb-6">
  <h2 className="text-base font-semibold mb-3 text-textSecondary">Compensation Breakup</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <div className="bg-surface-dark p-3 rounded-md">
      <p className="text-textSecondary text-xs">Total Base Compensation</p>
      <p className="text-primary font-semibold text-lg mt-0.5">{money(view.total_compensation)}</p>
    </div>

    <div className="bg-surface-dark p-3 rounded-md">
      <p className="text-textSecondary text-xs">Medical Expenses</p>
      <p className="text-success font-semibold text-lg mt-0.5">{money(view.medical_expenses)}</p>
    </div>

    <div className="bg-surface-dark p-3 rounded-md">
      <p className="text-textSecondary text-xs">Miscellaneous Expenses</p>
      <p className="text-accent font-semibold text-lg mt-0.5">{money(view.miscellaneous_expenses)}</p>
    </div>

    <div className="bg-surface-dark p-3 rounded-md">
      <p className="text-textSecondary text-xs">Deductions</p>
      <p className="text-error font-semibold text-lg mt-0.5">{money(view.deductions)}</p>
    </div>
  </div>

  {/* NEW: Computed Total Compensation */}
  <div className="mt-4 bg-surface-dark p-3 rounded-md border border-gray-700">
    <p className="text-textSecondary text-xs">Total Compensation</p>
    <p className="text-primary font-semibold text-lg mt-0.5">
      {money(
        view.total_compensation +
          view.medical_expenses +
          view.miscellaneous_expenses -
          view.deductions
      )}
    </p>
  </div>

  {view.deduction_notes && (
    <div className="mt-3 bg-surface-dark p-3 rounded-md border border-gray-700">
      <p className="text-textSecondary text-xs">Deduction Notes:</p>
      <p className="text-textSecondary text-sm mt-1">{view.deduction_notes}</p>
    </div>
  )}
</div>


      {view.is_injury_case && injuryCheckList.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-textSecondary">Injury Checklist</h2>
          <div className="bg-surface-dark rounded-md overflow-hidden w-full">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Criteria
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Factor
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Doctor&apos;s Percentage
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Compensation Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-gray-700">
                {injuryCheckList.map((item, index) => (
                  <tr key={index} className="hover:bg-surface-dark transition-colors duration-150">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{item.ICCLCriteria}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{item.ICCLFactor}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-accent font-medium">
                      {item.ICCLDoctorPercentage}%
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-success font-medium">
                      {money(parseFloat(item.ICCLCompensationAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-2">
        <h2 className="text-base font-semibold mb-3 text-textSecondary">Dependent/Applicant Details</h2>
        {view.dependents.length > 0 ? (
          <div className="bg-surface-dark rounded-md overflow-hidden w-full">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Relationship
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Date Of Birth
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Dependence Degree
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                    Compensation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-gray-700">
                {view.dependents.map((d, index) => (
                  <tr key={index} className="hover:bg-surface-dark transition-colors duration-150">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{d.name}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{d.relationship}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{d.date_of_birth}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{d.degree_of_dependence}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-success font-medium">
                      {money(d.compensation_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-surface-dark p-3 rounded-md text-sm">
            <p className="text-textSecondary">No dependents/applicants found for this claim.</p>
          </div>
        )}
      </div>

      {/* Weekly Benefit Lumpsum For Children (Death cases) */}
      {IncidentType === 'Death' && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-textSecondary">Weekly Benefit Lumpsum For Children</h2>
          {childrenWeeklyRows.length > 0 ? (
            <div className="bg-surface-dark rounded-md overflow-hidden w-full">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-textSecondary uppercase tracking-wider">
                      DOB
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-textSecondary uppercase tracking-wider">
                      Age at Incident Date
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-textSecondary uppercase tracking-wider">
                      No. of Days until Age 16
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-textSecondary uppercase tracking-wider">
                      No. of Weeks until Age 16
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-textSecondary uppercase tracking-wider">
                      Weekly Benefit Lumpsum for Children
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-gray-700">
                  {childrenWeeklyRows.map((c, idx) => (
                    <tr key={idx} className="hover:bg-surface-dark transition-colors duration-150">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{c.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary">{c.dob}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary text-center">{c.age}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary text-center">{c.daysUntil16}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-textSecondary text-center">{c.weeksUntil16}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-success font-medium text-right">
                        {money(c.benefit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface">
                    <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-textSecondary">
                      Total
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-success">
                      {money(totalChildrenBenefit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="bg-surface-dark p-3 rounded-md text-sm">
              <p className="text-textSecondary">No eligible children (under 16 at incident date) to display.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompensationBreakupDetailsView;
