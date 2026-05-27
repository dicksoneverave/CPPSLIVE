// src/components/forms/CompensationCalculation.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Info, AlertCircle, Save, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import './compensation-calculation.css';

interface CompensationCalculationProps {
  irn?: string;
  readOnly?: boolean; // ← ADD
  onClose: () => void;
  onCloseAll?: () => void;
}

interface WorkerDetails {
  WorkerID: string;
  WorkerFirstName: string;
  WorkerLastName: string;
  WorkerAliasName?: string;
  WorkerDOB: string;
  WorkerGender: string;
  WorkerMarried: string;
  WorkerHanded: string;
  SpouseFirstName?: string;
  SpouseLastName?: string;
  SpouseDOB?: string;
}

interface InjuryDetails {
  IRN: string;
  DisplayIRN: string;
  IncidentDate: string;
  IncidentType: 'Injury' | 'Death' | string;
  NatureExtentInjury: string;
  InjuryCause: string;
  HandInjury: boolean;
}

interface EmploymentDetails {
  Occupation?: string;
  AverageWeeklyWage: number;
  PlaceOfEmployment?: string;
  NatureOfEmployment?: string;
}

interface InjuryCriteria {
  ID: number;
  DKey: string;
  DValue: string;
}

interface DependantDetails {
  DependantID: string;
  DependantFirstName: string;
  DependantLastName: string;
  DependantDOB: string;
  DependantType: 'Child' | 'Parent' | 'Sibling' | string;
  DependantGender: string;
  DependanceDegree: number;
}

interface CalculationData {
  IRN: string;
  WorkerID: string;
  IncidentType: string;
  ClaimType: string;
  InjuryCriteria: string;
  InjuryFactor: number;
  DoctorPercentage: number;
  CompensationAmount: number;
  AnnualEarningsAtDeath?: number;
  LockedByCPOID?: string | null;
}

type ChecklistRow = {
  id: number;
  criteria: string;
  factor: number;
  checked: boolean;
  doctorPercentage: number;
  calculation: string;
  compensation: number;
};

const CompensationCalculation: React.FC<CompensationCalculationProps> = ({ irn, readOnly = false, onClose, onCloseAll }) => {
  const [searchIRN, setSearchIRN] = useState(irn || '');
  const [workerDetails, setWorkerDetails] = useState<WorkerDetails | null>(null);
  const [injuryDetails, setInjuryDetails] = useState<InjuryDetails | null>(null);
  const [dependants, setDependants] = useState<DependantDetails[]>([]);
  const [employmentDetails, setEmploymentDetails] = useState<EmploymentDetails | null>(null);
  const [localReadOnly, setLocalReadOnly] = useState<boolean>(readOnly);
  const [showLockPrompt, setShowLockPrompt] = useState<boolean>(false);
  const [calculationData, setCalculationData] = useState<CalculationData>({
    IRN: '',
    WorkerID: '',
    IncidentType: '',
    ClaimType: '',
    InjuryCriteria: '',
    InjuryFactor: 0,
    DoctorPercentage: 0,
    CompensationAmount: 0,
    AnnualEarningsAtDeath: 0,
    LockedByCPOID: null,
  });

  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLocked] = useState(false);
  const [lockedByName] = useState<string | null>(null);

  const [criteriaList, setCriteriaList] = useState<InjuryCriteria[]>([]);
  const [systemParams, setSystemParams] = useState<{ [key: string]: string }>({});

  const [medicalExpenses, setMedicalExpenses] = useState<number>(0);
  const [miscExpenses, setMiscExpenses] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [deductionNotes, setDeductionNotes] = useState<string>('');

  const [findings, setFindings] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string>('');

  const [injuryChecklist, setInjuryChecklist] = useState<ChecklistRow[]>([]);
  const [baseAnnualWage, setBaseAnnualWage] = useState<number>(3125);

  const [deathCaseData, setDeathCaseData] = useState<{
    annualEarnings: number;
    calculatedAmount: number;
    spousePercentage: number;
    childrenPercentage: number;
    weeklyBenefitForChildren: {
      name: string;
      dob: string;
      age: number;
      daysUntil16: number;
      weeksUntil16: number;
      benefit: number;
    }[];
  }>({
    annualEarnings: 0,
    calculatedAmount: 0,
    spousePercentage: 50,
    childrenPercentage: 50,
    weeklyBenefitForChildren: [],
  });

  const [weeklyBenefitRate, setWeeklyBenefitRate] = useState<number>(10);

  const [mandatoryDocuments, setMandatoryDocuments] = useState<{ required: string[]; available: string[] }>({
    required: [],
    available: [],
  });
  const [missingDocuments, setMissingDocuments] = useState<string[]>([]);
  const [mandatoryForAccept, setMandatoryForAccept] = useState<string[]>([]);
  const [missingMandatoryForAccept, setMissingMandatoryForAccept] = useState<string[]>([]);

  const [userStaffID, setUserStaffID] = useState<string | null>(null);

  const [draftSuccess, setDraftSuccess] = useState<string | null>(null);

  const [showSummary, setShowSummary] = useState(false);
  const [summarySuccess, setSummarySuccess] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);


const checkLockAndMaybePrompt = useCallback(async () => {
  if (!irn || !userStaffID) return;

  try {
    const { data, error } = await supabase
      .from('approvedclaimscporeview')
      .select('LockedByCPOID')
      .eq('IRN', irn)
      .maybeSingle();
    if (error) throw error;

    const lockedBy = data?.LockedByCPOID ?? 0;

    if (!lockedBy) {
      // Unlocked: ask user whether to lock or continue in read-only
      setShowLockPrompt(true);
      setLocalReadOnly(true); // default to read-only until they choose
    } else if (String(lockedBy) === String(userStaffID)) {
      // Already locked by me: allow editing
      setLocalReadOnly(false);
    } else {
      // Locked by someone else: your existing "Record Locked" UI path will handle it
    }
  } catch (e) {
    console.error('Lock check failed:', e);
  }
}, [irn, userStaffID]);


// Add this helper
const getInjuryChecklistTotal = () =>
  injuryChecklist.reduce((sum, r) => sum + (r.checked ? (r.compensation || 0) : 0), 0);



  /** NEW: helper to also close the parent container */
  const handleCloseAll = useCallback(() => {
    if (onCloseAll) {
      onCloseAll();
    } else {
      // Fallback: broadcast a custom event the parent can listen for
      window.dispatchEvent(new CustomEvent('owc:closeAllForms'));
    }
  }, [onCloseAll]);

  useEffect(() => {
    if (irn) fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irn]);


useEffect(() => {
  if (!readOnly && irn && userStaffID) {
    checkLockAndMaybePrompt();
  }
}, [readOnly, irn, userStaffID, checkLockAndMaybePrompt]);


const lockNow = async () => {
  try {
    // ensure row exists, then update
    const { data: existing, error: selErr } = await supabase
      .from('approvedclaimscporeview')
      .select('IRN')
      .eq('IRN', irn)
      .maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') throw selErr;

    if (existing) {
      const { error } = await supabase
        .from('approvedclaimscporeview')
        .update({ LockedByCPOID: userStaffID })
        .eq('IRN', irn as string);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('approvedclaimscporeview').insert({
        IRN: irn,
        LockedByCPOID: userStaffID,
        CPORStatus: 'Pending',
        IncidentType: injuryDetails?.IncidentType || 'Injury',
      });
      if (error) throw error;
    }

    setLocalReadOnly(false);
    setShowLockPrompt(false);
  } catch (e) {
    console.error('Lock failed:', e);
  }
};

const proceedReadOnly = () => {
  setLocalReadOnly(true);
  setShowLockPrompt(false);
};


  // ===== Helpers =====
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const fmtK = (n: number | string | null | undefined) => {
    const v = typeof n === 'string' ? Number(n) : n;
    const safe = Number.isFinite(v as number) ? (v as number) : 0;
    return `K ${(Math.round(safe * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };
  const parseNumeric = (val?: string | number | null) => {
    if (val === null || val === undefined) return 0;
    const cleaned = String(val).replace(/[^\d.-]/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  };
  const isChildType = (t?: string) => {
    const s = (t ?? '').trim().toLowerCase();
    return /(child|children|son|daughter|step.?child|dependent\s*child|grandchild)/.test(s);
  };
  const formatDate = (date: Date): string => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };
  const calculateAge = (dob: Date, referenceDate: Date): number => {
    let age = referenceDate.getFullYear() - dob.getFullYear();
    const m = referenceDate.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && referenceDate.getDate() < dob.getDate())) age--;
    return age;
  };

  const upsertByIRN = async (table: string, payload: any) => {
    const { data: existing, error: selErr } = await supabase
      .from(table)
      .select('IRN')
      .eq('IRN', payload.IRN)
      .maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') throw selErr;

    if (existing) {
      const { error } = await supabase.from(table).update(payload).eq('IRN', payload.IRN);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    }
  };

  const buildChildrenBenefits = (incidentDateStr: string, deps: DependantDetails[]) => {
    if (!incidentDateStr) return [];
    const weeklyBenefitPerChild = parseNumeric(systemParams['WeeklyCompensationPerChildDeath']);
    const incidentDate = new Date(incidentDateStr);

    return deps
      .filter((d) => isChildType(d.DependantType))
      .map((child) => {
        const dob = new Date(child.DependantDOB);
        const validDob = !Number.isNaN(dob.getTime()) ? dob : new Date(0);
        const age = calculateAge(validDob, incidentDate);

        const age16 = new Date(validDob);
        age16.setFullYear(age16.getFullYear() + 16);

        const days = Math.max(0, Math.round((age16.getTime() - incidentDate.getTime()) / 86400000));
        const weeks = Math.max(0, Number((days / 7).toFixed(3)));
        const raw = weeklyBenefitPerChild * weeks;
        const benefit = Number.isFinite(raw) ? round2(raw) : 0;

        return {
          name: `${child.DependantFirstName} ${child.DependantLastName}`,
          dob: Number.isNaN(validDob.getTime()) ? 'N/A' : formatDate(validDob),
          age,
          daysUntil16: days,
          weeksUntil16: weeks,
          benefit,
        };
      });
  };

const getChildrenWeeklyLumpTotal = () => {
  return deathCaseData.weeklyBenefitForChildren.reduce(
    (sum, r) => sum + (Number.isFinite(r.benefit as number) ? (r.benefit as number) : 0),
    0
  );
};



  useEffect(() => {
    if (injuryDetails?.IncidentDate) {
      const rows = buildChildrenBenefits(injuryDetails.IncidentDate, dependants);
      setDeathCaseData((prev) => ({ ...prev, weeklyBenefitForChildren: rows }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injuryDetails?.IncidentDate, dependants, systemParams]);

  // ===== Data fetch / init =====
  const fetchInitialData = async () => {
    try {
      setLoading(true);

      try {
        const { data: criteriaData, error: criteriaError } = await supabase
          .from('dictionary')
          .select('ID, DKey, DValue')
          .eq('DType', 'InjuryPercent')
          .order('DKey');
        if (criteriaError) throw criteriaError;
        setCriteriaList(criteriaData || []);

        const { data: sysParams, error: sysErr } = await supabase
          .from('dictionary')
          .select('DKey, DValue')
          .eq('DType', 'SystemParameter');
        if (sysErr) throw sysErr;

        const paramsObj: Record<string, string> = {};
        sysParams?.forEach((p) => (paramsObj[p.DKey] = p.DValue));
        setSystemParams(paramsObj);
        setWeeklyBenefitRate(parseNumeric(paramsObj['WeeklyCompensationPerChildDeath']));

        const sessionRaw = localStorage.getItem('session');
        if (sessionRaw) {
          const { user } = JSON.parse(sessionRaw);
          const { data: staff, error: staffErr } = await supabase
            .from('owcstaffmaster')
            .select('OSMStaffID')
            .eq('cppsid', user.id)
            .maybeSingle();
          if (staffErr) throw staffErr;
          if (staff?.OSMStaffID) setUserStaffID(String(staff.OSMStaffID));
        }
      } catch (e) {
        console.error('Error fetching reference data:', e);
        setError('Failed to load reference data');
      }

      if (irn) await handleSearch();
    } catch (err) {
      console.error('Error initializing data:', err);
      setError('Failed to initialize data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchIRN) {
      setError('Please enter an IRN to search');
      return;
    }
    try {
      setSearchLoading(true);
      setError(null);

      const { data: form1112Data, error: form1112Error } = await supabase
        .from('form1112master')
        .select(
          `
          IRN,
          DisplayIRN,
          WorkerID,
          IncidentDate,
          IncidentType,
          NatureExtentInjury,
          InjuryCause,
          HandInjury
        `
        )
        .eq('IRN', searchIRN)
        .single();
      if (form1112Error) {
        if (form1112Error.code === 'PGRST116') throw new Error('No claim found with this IRN');
        throw form1112Error;
      }

      const { data: injuryChecklistData, error: injuryChecklistError } = await supabase
        .from('dictionary')
        .select('ID, DKey, DValue')
        .eq('DType', 'InjuryPercent')
        .order('DKey');
      if (injuryChecklistError) throw injuryChecklistError;

      const formattedInjuryChecklist: ChecklistRow[] =
        injuryChecklistData?.map((item) => ({
          id: item.ID,
          criteria: item.DKey,
          factor: parseNumeric(item.DValue),
          checked: false,
          doctorPercentage: 0,
          calculation: '--',
          compensation: 0,
        })) || [];
      setInjuryChecklist(formattedInjuryChecklist);

      const { data: workerData, error: workerError } = await supabase
        .from('workerpersonaldetails')
        .select('*')
        .eq('WorkerID', form1112Data.WorkerID)
        .single();
      if (workerError) throw workerError;

      const { data: dependantRows, error: dependantError } = await supabase
        .from('dependantpersonaldetails')
        .select('*')
        .eq('WorkerID', form1112Data.WorkerID);
      if (dependantError) throw dependantError;
      setDependants(dependantRows || []);

      const { data: employ, error: empErr } = await supabase
        .from('currentemploymentdetails')
        .select('AverageWeeklyWage')
        .eq('WorkerID', form1112Data.WorkerID)
        .maybeSingle();
      if (empErr && empErr.code !== 'PGRST116') throw empErr;

      const REQUIRED_INJURY = [
        'Interim medical report',
        'Final medical report',
        'Section 43 application form',
        'Supervisor statement',
        'Witness statement',
        "Injured workers statement",
        'Payslip at the time of accident',
        'Treatment records',
        'Police accident report',
        'Form 18 Scan',
        'MedicalExpenses',
        'MiscExpenses',
        'Deductions',
      ] as const;

      const REQUIRED_DEATH = [
        'Death Certificate',
        'Post Mortem report',
        'Section 43 application form',
        'Supervisor statement',
        'Witness statement',
        'Dependency declaration',
        'Payslip at the time of accident',
        'Police incident report',
        'Funeral expenses receipts',
        'MedicalExpenses',
        'MiscExpenses',
        'Deductions',
        'Form 18 Scan',
      ] as const;

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('formattachments')
        .select('AttachmentType')
        .eq('IRN', searchIRN);
      if (attachmentError) throw attachmentError;

      const allSubmitted = (attachmentData || []).map((r) => r.AttachmentType as string);
      const normalize = (s: string) => (s || '').trim().toLowerCase();
      const submittedSet = new Set(allSubmitted.map(normalize));

      const isInjury = form1112Data.IncidentType === 'Injury';
      const fullRequired = isInjury ? [...REQUIRED_INJURY] : [...REQUIRED_DEATH];
      const submittedRequired = fullRequired.filter((a) => submittedSet.has(normalize(a)));
      const fullMissing = fullRequired.filter((req) => !submittedSet.has(normalize(req)));

      const hardMandatory = isInjury
        ? ['Supervisor statement', 'Final medical report']
        : ['Supervisor statement', 'Death Certificate'];
      const missingHard = hardMandatory.filter((d) => !submittedSet.has(normalize(d)));

      setMandatoryDocuments({ required: fullRequired, available: submittedRequired });
      setMissingDocuments(fullMissing);
      setMandatoryForAccept(hardMandatory);
      setMissingMandatoryForAccept(missingHard);

      setWorkerDetails({
        WorkerID: workerData.WorkerID,
        WorkerFirstName: workerData.WorkerFirstName,
        WorkerLastName: workerData.WorkerLastName,
        WorkerAliasName: workerData.WorkerAliasName,
        WorkerDOB: workerData.WorkerDOB,
        WorkerGender: workerData.WorkerGender,
        WorkerMarried: workerData.WorkerMarried,
        WorkerHanded: workerData.WorkerHanded,
        SpouseFirstName: workerData.SpouseFirstName,
        SpouseLastName: workerData.SpouseLastName,
        SpouseDOB: workerData.SpouseDOB,
      });

      setInjuryDetails({
        IRN: form1112Data.IRN,
        DisplayIRN: form1112Data.DisplayIRN,
        IncidentDate: form1112Data.IncidentDate,
        IncidentType: form1112Data.IncidentType,
        NatureExtentInjury: form1112Data.NatureExtentInjury,
        InjuryCause: form1112Data.InjuryCause,
        HandInjury: form1112Data.HandInjury === '1' || (form1112Data.HandInjury as any) === true,
      });

      setEmploymentDetails({
        AverageWeeklyWage: employ?.AverageWeeklyWage || 0,
      });

      setCalculationData((prev) => ({
        ...prev,
        IRN: searchIRN,
        WorkerID: form1112Data.WorkerID,
        IncidentType: form1112Data.IncidentType,
        ClaimType: form1112Data.IncidentType,
      }));

      const workerAnnual = (employ?.AverageWeeklyWage || 0) * 52;
	   // setBaseAnnualWage(workerAnnual);
			const MinCompensationAmountDeath = 3125;
	    setBaseAnnualWage(MinCompensationAmountDeath);

      const { data: existingRows, error: rowErr } = await supabase
        .from('injurycasechecklist')
        .select('ICCLCriteria, ICCLFactor, ICCLDoctorPercentage, ICCLCompensationAmount')
        .eq('IRN', searchIRN);
      if (rowErr && rowErr.code !== 'PGRST116') throw rowErr;

      if (existingRows && existingRows.length > 0) {
        const updatedChecklist = formattedInjuryChecklist.map((item) => {
          const m = existingRows.find((r: any) => r.ICCLCriteria === item.criteria);
          if (m) {
            const doctorPercentage = parseNumeric(m.ICCLDoctorPercentage);
            const compensation = parseNumeric(m.ICCLCompensationAmount);
            const factor = parseNumeric(m.ICCLFactor) || item.factor;
            const calcStr =
              doctorPercentage > 0 || compensation > 0
                ? `((${3125}*8*${doctorPercentage}*${factor})/100)/100` //  ? `((${workerAnnual}*8*${doctorPercentage}*${factor})/100)/100`
                : '--';
            return {
              ...item,
              factor,
              checked: doctorPercentage > 0 || compensation > 0,
              doctorPercentage,
              calculation: calcStr,
              compensation,
            };
          }
          return item;
        });
        setInjuryChecklist(updatedChecklist);
      }

      const { data: ccwd, error: ccwdErr } = await supabase
        .from('claimcompensationworkerdetails')
        .select(
          'CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions, CCWDDeductionsNotes, CCWDFindings, CCWDRecommendations, CCWDCompensationAmount'
        )
        .eq('IRN', searchIRN)
        .maybeSingle();
      if (ccwdErr && ccwdErr.code !== 'PGRST116') throw ccwdErr;

      if (ccwd) {
        setMedicalExpenses(parseNumeric(ccwd.CCWDMedicalExpenses));
        setMiscExpenses(parseNumeric(ccwd.CCWDMiscExpenses));
        setDeductions(parseNumeric(ccwd.CCWDDeductions));
        setDeductionNotes(ccwd.CCWDDeductionsNotes || '');
        setFindings(ccwd.CCWDFindings || '');
        setRecommendations(ccwd.CCWDRecommendations || '');
        if (Number.isFinite(parseNumeric(ccwd.CCWDCompensationAmount))) {
          setCalculationData((prev) => ({
            ...prev,
            CompensationAmount: parseNumeric(ccwd.CCWDCompensationAmount),
          }));
        }
      }

      if (form1112Data.IncidentType === 'Death') {
        calculateDeathCaseData(form1112Data, employ, dependantRows || []);
      }
    } catch (err: any) {
      console.error('Error searching for IRN:', err);
      setError(err.message || 'Failed to find claim with this IRN');
      setWorkerDetails(null);
      setInjuryDetails(null);
      setEmploymentDetails(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const calculateDeathCaseData = (
    form1112Data: any,
    employmentData: { AverageWeeklyWage?: number } | null,
    _dependantsList: DependantDetails[]
  ) => {
    const weeklyWage = employmentData?.AverageWeeklyWage || 0;
   const annualEarnings = 25000; //const annualEarnings = weeklyWage * 52;
    const minCompensationAmount = parseNumeric(systemParams['MinCompensationAmountDeath']);
    const maxCompensationAmount = parseNumeric(systemParams['MaxCompensationAmountDeath']);

    let calculatedAmount = 0;
		{/*if (annualEarnings < minCompensationAmount) calculatedAmount = 8 * annualEarnings;
    else calculatedAmount = maxCompensationAmount; // Modified below because OWC has made base K25,000. Can be changed later.*/}
		if (annualEarnings < minCompensationAmount) calculatedAmount = 25000;
    else calculatedAmount = 25000;
		
    setDeathCaseData((prev) => ({
      ...prev,
      annualEarnings,
      calculatedAmount,
      spousePercentage: 50,
      childrenPercentage: 50,
    }));

    setCalculationData((prev) => ({
      ...prev,
      AnnualEarningsAtDeath: annualEarnings,
    }));
  };

  // ===== Death splits =====
  type DeathSplit = { type: 'spouse' | 'child' | 'additional'; id?: string; amount: number };

  const computeDeathSplits = (baseAmount: number) => {
    const spousePresent = Boolean(workerDetails?.SpouseFirstName);
    const children = dependants.filter((d) => isChildType(d.DependantType));
    const additional = dependants.filter((d) => !isChildType(d.DependantType));

    const splits: DeathSplit[] = [];
    const splitEqual = (portion: number, list: DependantDetails[], label: 'child' | 'additional') => {
      if (!list.length || portion <= 0) return;
      const each = round2((baseAmount * portion) / list.length);
      list.forEach((d) => splits.push({ type: label, id: d.DependantID, amount: each }));
    };

    if (!spousePresent && children.length === 0 && additional.length === 0) return splits;

    if (spousePresent && children.length > 0 && additional.length === 0) {
      splits.push({ type: 'spouse', amount: round2(baseAmount * 0.5) });
      splitEqual(0.5, children, 'child');
      return splits;
    }

    if (spousePresent && children.length > 0 && additional.length > 0) {
      splits.push({ type: 'spouse', amount: round2(baseAmount * 0.5) });
      splitEqual(0.25, children, 'child');
      splitEqual(0.25, additional, 'additional');
      return splits;
    }

    if (!spousePresent && children.length > 0 && additional.length === 0) {
      splitEqual(1.0, children, 'child');
      return splits;
    }

    if (!spousePresent && children.length > 0 && additional.length > 0) {
      splitEqual(0.5, children, 'child');
      splitEqual(0.5, additional, 'additional');
      return splits;
    }

    if (spousePresent && children.length === 0 && additional.length === 0) {
      splits.push({ type: 'spouse', amount: round2(baseAmount) });
      return splits;
    }

    if (spousePresent && children.length === 0 && additional.length > 0) {
      splits.push({ type: 'spouse', amount: round2(baseAmount * 0.5) });
      splitEqual(0.5, additional, 'additional');
      return splits;
    }

    return splits;
  };

  // ===== Inputs / recalculation =====
  const handleCompensationManualChange = (index: number, raw: number) => {
    const amt = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    setInjuryChecklist((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], compensation: amt, checked: true };
      return next;
    });
  };

  const handleInjuryChecklistChange = (
    index: number,
    field: 'checked' | 'doctorPercentage',
    value: boolean | number
  ) => {
    const updated = [...injuryChecklist];
    if (field === 'checked') {
      updated[index].checked = value as boolean;
      if (!value) {
        updated[index].doctorPercentage = 0;
        updated[index].calculation = '--';
        updated[index].compensation = 0;
      }
    } else {
      const pct = Number(value) || 0;
      if (pct >= 0 && pct <= 100) {
        updated[index].doctorPercentage = pct;
        if (pct > 0) updated[index].checked = true;
        if (updated[index].checked) {
          const factor = updated[index].factor;
          updated[index].calculation = `((${3125}*8*${pct}*${factor})/100)/100`; //updated[index].calculation = `((${baseAnnualWage}*8*${pct}*${factor})/100)/100`;
          updated[index].compensation = Math.ceil(((3125 * 8 *pct * factor) / 100) / 100);         //  updated[index].compensation = Math.ceil(((baseAnnualWage * 8 * pct * factor) / 100) / 100);
        }
      }
    }
    setInjuryChecklist(updated);
  };

  const handleExpenseChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    type: 'medical' | 'misc' | 'deductions' | 'deductionNotes'
  ) => {
    if (type === 'deductionNotes') {
      setDeductionNotes(e.currentTarget.value);
      return;
    }
    const value = parseFloat((e as React.ChangeEvent<HTMLInputElement>).target.value) || 0;
    if (type === 'medical') setMedicalExpenses(value);
    else if (type === 'misc') setMiscExpenses(value);
    else setDeductions(value);
    calculateCompensation();
  };

const calculateCompensation = () => {
  // Base = amount that should be stored in CCWDCompensationAmount
  let base = 0;

  if (injuryDetails?.IncidentType === 'Injury') {
    base = getInjuryChecklistTotal(); // ✅ ONLY checklist total for Injury
  } else if (injuryDetails?.IncidentType === 'Death') {
    const childrenTotal = getChildrenWeeklyLumpTotal();
    base = (deathCaseData.calculatedAmount || 0) + childrenTotal; // unchanged logic
  }

  // Display amount for UI = base + expenses - deductions
  let display = base + medicalExpenses + miscExpenses - deductions;
  display = Math.round(display * 100) / 100;

  // Keep using calculationData.CompensationAmount for the UI number
  setCalculationData((prev) => ({
    ...prev,
    CompensationAmount: Math.max(0, display),
  }));
};



  useEffect(() => {
    calculateCompensation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injuryChecklist, medicalExpenses, miscExpenses, deductions, deathCaseData]);

  // ===== Persist helpers =====
// Idempotent save: update if exists (by IRN+Criteria), insert if missing,
// and optionally delete rows that are no longer selected.
const saveInjuryChecklistRows = async (irnToSave: string) => {
  // Build current rows from UI
  const rows = injuryChecklist
    .filter((r) => r.checked || r.doctorPercentage > 0 || r.compensation > 0)
    .map((r) => ({
      IRN: irnToSave,
      ICCLCriteria: r.criteria,
      ICCLFactor: r.factor,
      ICCLDoctorPercentage: r.doctorPercentage,
      ICCLCompensationAmount: r.compensation,
    }));

  // Fetch existing criteria for this IRN
  const { data: existing, error: selErr } = await supabase
    .from('injurycasechecklist')
    .select('ICCLCriteria')
    .eq('IRN', irnToSave);
  if (selErr) throw selErr;

  const existingSet = new Set((existing || []).map((e: any) => e.ICCLCriteria));
  const keepSet = new Set(rows.map((r) => r.ICCLCriteria));

  // 1) Upsert-like behavior without ON CONFLICT:
  //    - Try UPDATE by (IRN, ICCLCriteria)
  //    - If nothing updated, INSERT
  for (const row of rows) {
    const { data: upd, error: updErr } = await supabase
      .from('injurycasechecklist')
      .update({
        ICCLFactor: row.ICCLFactor,
        ICCLDoctorPercentage: row.ICCLDoctorPercentage,
        ICCLCompensationAmount: row.ICCLCompensationAmount,
      })
      .eq('IRN', row.IRN)
      .eq('ICCLCriteria', row.ICCLCriteria)
      .select('IRN'); // to know if any row matched
    if (updErr) throw updErr;

    const updatedCount = (upd?.length ?? 0);
    if (updatedCount === 0) {
      const { error: insErr } = await supabase.from('injurycasechecklist').insert(row);
      if (insErr) throw insErr;
    }
  }

  // 2) Delete rows that exist in DB but are no longer present/selected in UI
  const toDelete = [...existingSet].filter((crit) => !keepSet.has(crit));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('injurycasechecklist')
      .delete()
      .eq('IRN', irnToSave)
      .in('ICCLCriteria', toDelete);
    if (delErr) throw delErr;
  }
};




  const persistInjuryWorkerAndDependants = async (totalComp: number) => {
    if (!workerDetails || !injuryDetails) return;

    const waw = (employmentDetails?.AverageWeeklyWage || 0) * 52;
    const maxChildAge = parseNumeric(systemParams['MaxChildAge']) || 16;
    const weeklyRate = parseNumeric(systemParams['WeeklyCompensationPerChildDeath']);

    await upsertByIRN('claimcompensationworkerdetails', {
      IRN: calculationData.IRN,
      CCWDWorkerFirstName: workerDetails.WorkerFirstName,
      CCWDWorkerLastName: workerDetails.WorkerLastName,
      CCWDWorkerDOB: workerDetails.WorkerDOB,
      CCWDAnnualWage: waw,
      CCWDCompensationAmount: totalComp,
      CCWDMedicalExpenses: String(medicalExpenses || 0),
      CCWDMiscExpenses: String(miscExpenses || 0),
      CCWDDeductions: String(deductions || 0),
      CCWDDeductionsNotes: deductionNotes,
      CCWDFindings: findings,
      CCWDRecommendations: recommendations,
    });

    await supabase.from('claimcompensationpersonaldetails').delete().eq('IRN', calculationData.IRN);

    if (workerDetails.SpouseFirstName) {
      await supabase.from('claimcompensationpersonaldetails').insert({
        IRN: calculationData.IRN,
        CCPDPersonFirstName: workerDetails.SpouseFirstName,
        CCPDPersonLastName: workerDetails.SpouseLastName,
        CCPDPersonDOB: workerDetails.SpouseDOB,
        CCPDRelationToWorker: 'Spouse',
        CCPDDegreeOfDependance: 100,
        CCPDCompensationAmount: 0,
        CCPDWeeklyCompensationAmount: 0,
      });
    }

    for (const d of dependants) {
      const age = calculateAge(new Date(d.DependantDOB), new Date());
      const isChild = isChildType(d.DependantType);
      const weekly = isChild && age < maxChildAge ? weeklyRate : 0;

      await supabase.from('claimcompensationpersonaldetails').insert({
        IRN: calculationData.IRN,
        CCPDPersonFirstName: d.DependantFirstName,
        CCPDPersonLastName: d.DependantLastName,
        CCPDPersonDOB: d.DependantDOB,
        CCPDRelationToWorker: d.DependantType,
        CCPDDegreeOfDependance: d.DependanceDegree,
        CCPDCompensationAmount: 0,
        CCPDWeeklyCompensationAmount: weekly,
      });
    }
  };

  const persistDeathWorkerAndDependants = async (totalComp: number, baseAmount: number) => {
    if (!workerDetails || !injuryDetails) return;

    const waw = calculationData.AnnualEarningsAtDeath || (employmentDetails?.AverageWeeklyWage || 0) * 52;
    const maxChildAge = parseNumeric(systemParams['MaxChildAge']) || 16;
    const weeklyRate = parseNumeric(systemParams['WeeklyCompensationPerChildDeath']);

    await upsertByIRN('claimcompensationworkerdetails', {
      IRN: calculationData.IRN,
      CCWDWorkerFirstName: workerDetails.WorkerFirstName,
      CCWDWorkerLastName: workerDetails.WorkerLastName,
      CCWDWorkerDOB: workerDetails.WorkerDOB,
      CCWDAnnualWage: waw,
      CCWDCompensationAmount: totalComp,
      CCWDMedicalExpenses: String(medicalExpenses || 0),
      CCWDMiscExpenses: String(miscExpenses || 0),
      CCWDDeductions: String(deductions || 0),
      CCWDDeductionsNotes: deductionNotes,
      CCWDFindings: findings,
      CCWDRecommendations: recommendations,
    });

    await supabase.from('claimcompensationpersonaldetails').delete().eq('IRN', calculationData.IRN);

    const splits = computeDeathSplits(baseAmount);

    if (workerDetails.SpouseFirstName) {
      const spouseShare = splits.find((s) => s.type === 'spouse')?.amount || 0;
      await supabase.from('claimcompensationpersonaldetails').insert({
        IRN: calculationData.IRN,
        CCPDPersonFirstName: workerDetails.SpouseFirstName,
        CCPDPersonLastName: workerDetails.SpouseLastName,
        CCPDPersonDOB: workerDetails.SpouseDOB,
        CCPDRelationToWorker: 'Spouse',
        CCPDDegreeOfDependance: 100,
        CCPDCompensationAmount: spouseShare,
        CCPDWeeklyCompensationAmount: 0,
      });
    }

    for (const d of dependants) {
      const isChild = isChildType(d.DependantType);
      const share =
        splits.find((s) => (s.type === 'child' || s.type === 'additional') && s.id === d.DependantID)?.amount || 0;
      const age = calculateAge(new Date(d.DependantDOB), new Date());
      const weekly = isChild && age < maxChildAge ? weeklyRate : 0;

      await supabase.from('claimcompensationpersonaldetails').insert({
        IRN: calculationData.IRN,
        CCPDPersonFirstName: d.DependantFirstName,
        CCPDPersonLastName: d.DependantLastName,
        CCPDPersonDOB: d.DependantDOB,
        CCPDRelationToWorker: d.DependantType,
        CCPDDegreeOfDependance: d.DependanceDegree,
        CCPDCompensationAmount: share,
        CCPDWeeklyCompensationAmount: weekly,
      });
    }
  };

// ===== Persist helpers =====

// Reliable save without ON CONFLICT (no schema change required)
const saveCCWD = async (row: any) => {
  // 1) Try UPDATE by IRN
  const { data: updatedRows, error: updErr } = await supabase
    .from('claimcompensationworkerdetails')
    .update(row)
    .eq('IRN', row.IRN)
    .select('IRN'); // ensures we get row count

  if (updErr) throw updErr;

  // 2) If nothing updated, INSERT
  if (!updatedRows || updatedRows.length === 0) {
    const { error: insErr } = await supabase
      .from('claimcompensationworkerdetails')
      .insert(row);
    if (insErr) throw insErr;
  }
};


// ===== Actions =====
const handleSaveDraft = async () => {
  if (!calculationData.IRN) {
    setError('No IRN context to save.');
    return;
  }

  try {
    setSavingDraft(true);
    setError(null);
    setSuccess(null);
    setDraftSuccess(null);

    // Compute base (to persist) and display (for UI only)
    let baseToPersist = 0;
    if (injuryDetails?.IncidentType === 'Injury') {
      baseToPersist = getInjuryChecklistTotal(); // ✅ only checklist total
    } else {
      const childrenTotal = getChildrenWeeklyLumpTotal();
      baseToPersist = (deathCaseData.calculatedAmount || 0) + childrenTotal;
    }

    // Save checklist rows if Injury case
    if (injuryDetails?.IncidentType === 'Injury') {
      await saveInjuryChecklistRows(calculationData.IRN);
    }

// Build the row once
const row = {
  IRN: calculationData.IRN,
  CCWDWorkerFirstName: workerDetails?.WorkerFirstName ?? null,
  CCWDWorkerLastName:  workerDetails?.WorkerLastName  ?? null,
  CCWDWorkerDOB:       workerDetails?.WorkerDOB       ?? null,
  CCWDAnnualWage:
    (injuryDetails?.IncidentType === 'Death'
      ? calculationData.AnnualEarningsAtDeath
      : (employmentDetails?.AverageWeeklyWage || 0) * 52) || 0,

  // Persist BASE only (Injury)
  CCWDCompensationAmount: round2(baseToPersist),

  // Numbers for numeric columns
  CCWDMedicalExpenses: Number.isFinite(medicalExpenses) ? medicalExpenses : 0,
  CCWDMiscExpenses:    Number.isFinite(miscExpenses)    ? miscExpenses    : 0,
  CCWDDeductions:      Number.isFinite(deductions)      ? deductions      : 0,

  // Text fields
  CCWDDeductionsNotes: deductionNotes ?? '',
  CCWDFindings:        findings ?? '',
  CCWDRecommendations: recommendations ?? '',
};

// Optional: debug log
console.debug('Saving draft row:', row);

// Save (update-then-insert helper)
await saveCCWD(row);


    setDraftSuccess('Draft Saved');
  } catch (err: any) {
    console.error('Error saving draft:', err);
    setError(err.message || 'Failed to save draft.');
  } finally {
    setSavingDraft(false);
  }
};



  const handleAcceptPreview = () => {
    setDraftSuccess(null);
    setSummarySuccess(null);

    if (!calculationData.IRN) {
      setError('Please search and load a claim (IRN) first.');
      return;
    }
    if (!findings || !recommendations) {
      setError('Please fill in both Findings and Recommendations before accepting.');
      return;
    }
    if (missingMandatoryForAccept.length > 0) {
      setError(`Mandatory documents missing: ${missingMandatoryForAccept.join(', ')}`);
      return;
    }
    if (injuryDetails?.IncidentType === 'Injury') {
      const anySelected = injuryChecklist.some((r) => r.checked && r.compensation > 0);
      if (!anySelected) {
        setError('Please select at least one injury criteria (with a non-zero value) before accepting.');
        return;
      }
    }
    setError(null);
    setShowSummary(true);
  };

const handleAcceptFinalize = async () => {
  try {
    setAccepting(true);
    setError(null);
    setSuccess(null);

    let baseForDeath = 0;       // used for splits in Death
    let baseToPersist = 0;      // what to write to CCWDCompensationAmount

    if (injuryDetails?.IncidentType === 'Injury') {
      baseToPersist = getInjuryChecklistTotal(); // ✅ only checklist total
      await saveInjuryChecklistRows(calculationData.IRN);
      await persistInjuryWorkerAndDependants(baseToPersist); // pass base only
    } else {
      const childrenTotal = getChildrenWeeklyLumpTotal();
      baseForDeath = deathCaseData.calculatedAmount || 0;
      baseToPersist = baseForDeath + childrenTotal;          // unchanged for Death
      await persistDeathWorkerAndDependants(baseToPersist, baseForDeath);
    }

      


await supabase
  .from('approvedclaimscporeview')
  .update({
    CPORStatus: 'CompensationCalculated',
    CPORApprovedDate: new Date().toISOString(), // NEW
  })
  .eq('IRN', calculationData.IRN);


      {
        const payload = {
          IRN: calculationData.IRN,
          CPMRStatus: 'Pending',
          CPMRSubmissionDate: new Date().toISOString(),
          IncidentType: calculationData.IncidentType,
        };
        const { data: existing, error: selErr } = await supabase
          .from('compensationcalculationcpmreview')
          .select('IRN')
          .eq('IRN', calculationData.IRN)
          .maybeSingle();
        if (selErr && selErr.code !== 'PGRST116') throw selErr;

        if (existing) {
          const { error } = await supabase
            .from('compensationcalculationcpmreview')
            .update(payload)
            .eq('IRN', calculationData.IRN);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('compensationcalculationcpmreview').insert(payload);
          if (error) throw error;
        }
      }



      // Show success INSIDE the summary and keep the modal open briefly
      setSummarySuccess('Calculation saved and has been forwarded to Claims Manager for Review');

      // After a few seconds, close EVERYTHING (summary + this form + parent)
      setTimeout(() => {
        setShowSummary(false);     // close summary modal
        handleClose();             // close this embedded form
        handleCloseAll();          // notify/close parent container (110cpoclaimreviewform)
      }, 4000);
    } catch (err: any) {
      console.error('Error accepting calculation:', err);
      setError(err.message || 'Failed to accept calculation.');
    } finally {
      setAccepting(false);
    }
  };

  // ===== UI =====
  if (isLocked && lockedByName) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6 w-full">
        <div className="flex items-center text-red-600 mb-4">
          <AlertCircle className="h-6 w-6 mr-2" />
          <h3 className="text-lg font-semibold">Record Locked</h3>
        </div>
        <p className="text-gray-700 mb-4">This record is currently being processed by {lockedByName}. Please try again later.</p>
        <div className="flex justify-end">
          <button onClick={onClose} className="btn btn-primary">Close</button>
        </div>
      </div>
    );
  }

  const normalizedSubmitted = new Set(mandatoryDocuments.available.map((d) => (d || '').trim().toLowerCase()));
  const selectedInjuryRows = injuryChecklist.filter((r) => r.checked && (r.compensation > 0 || r.doctorPercentage > 0));
  
  
  // Derived amounts used only for UI display
const baseAmount =
  injuryDetails?.IncidentType === 'Injury'
    ? getInjuryChecklistTotal()
    : (deathCaseData.calculatedAmount || 0) + getChildrenWeeklyLumpTotal();

const finalDisplayAmount = round2(baseAmount + medicalExpenses + miscExpenses - deductions);

  

  return (
    <div className="bg-white rounded-lg shadow-xl w-full comp-calc">
      <div className="p-6">
        {/* Search */}
        {!irn && (
          <div className="mb-6">
            <div className="flex space-x-2">
              <div className="flex-1">
                <label htmlFor="searchIRN" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by IRN
                </label>
                <input
                  type="text"
                  id="searchIRN"
                  value={searchIRN}
                  onChange={(e) => setSearchIRN(e.target.value)}
                  className="input"
                  placeholder="Enter IRN"
                />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={handleSearch} className="btn btn-primary h-[42px]" disabled={searchLoading}>
                  {searchLoading ? (
                    <span className="flex items-center">
                      <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
                      Searching...
                    </span>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md flex items-start">
            <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {workerDetails && injuryDetails && (
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
		   {/* Everything inside this fieldset becomes non-interactive when readOnly is true */}
            <fieldset disabled={readOnly || localReadOnly}>


		  
		  
            {/* Claim details */}
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <h3 className="text-lg font-semibold mb-4 text-primary">Claim Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Display IRN</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">{injuryDetails.DisplayIRN}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Incident Type</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">{injuryDetails.IncidentType}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Worker Name</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {workerDetails.WorkerFirstName} {workerDetails.WorkerLastName}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Incident Date</label>
                  <p className="mt-1 p-2 border rounded-md bg-white">
                    {injuryDetails.IncidentDate ? new Date(injuryDetails.IncidentDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nature & Extent of Injury</label>
                <p className="mt-1 p-2 border rounded-md bg-white">{injuryDetails.NatureExtentInjury || 'N/A'}</p>
              </div>
            </div>

            {/* Compensation Calculation */}
            <div className="card bg-white p-6 border border-gray-200 rounded-lg mb-6">
              <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Calculation</h3>

              {injuryDetails?.IncidentType === 'Injury' ? (
                <div>
                  <div className="bg-[#fffcf6] p-4 rounded-lg border border-gray-200 mb-4">
                    <h4 className="text-[#ba372a] font-semibold mb-3">Compensation Calculation Follows</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p><span className="font-medium">Worker weekly wage:</span> {fmtK(employmentDetails?.AverageWeeklyWage || 0)}</p>
                      </div>
                      <div>
                        <p><span className="font-medium">Final worker weekly wage:</span> {fmtK(employmentDetails?.AverageWeeklyWage || 0)}</p>
                      </div>
                    </div>
                    <div>
                      <p><span className="font-medium">Final worker annual wage (FAWA):</span> {fmtK(baseAnnualWage)}</p>
                    </div>
                  </div>

                  <h4 className="text-[#ba372a] font-semibold mb-3">Compensation For Specified Injuries</h4>
                  <div className="overflow-x-auto mb-6">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-[#ba372a] text-yellow-300">
                        <tr>
                          <th className="px-4 py-2 text-left w-1/2">Criteria</th>
                          <th className="px-4 py-2 text-center w-12">Factor</th>
                          <th className="px-4 py-2 text-center w-12">Apply</th>
                          <th className="px-4 py-2 text-center w-20">Doctor %</th>
                          <th className="px-4 py-2 text-left w-1/4">Calculation</th>
                          <th className="px-4 py-2 text-right w-24">Compensation</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#fffcf6]">
                        {injuryChecklist.map((item, index) => (
                          <tr key={index} className="border-b border-gray-200 hover:bg-[#fef9e7]">
                            <td className="px-4 py-2">{item.criteria}</td>
                            <td className="px-4 py-2 text-center">{item.factor}</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={(e) => handleInjuryChecklistChange(index, 'checked', e.target.checked)}
                                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                value={item.doctorPercentage}
                                onChange={(e) => handleInjuryChecklistChange(index, 'doctorPercentage', parseInt(e.target.value) || 0)}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                                min="0"
                                max="100"
                              />
                            </td>
                            <td className="px-4 py-2">{item.calculation}</td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="number"
                                value={item.compensation}
                                onChange={(e) => handleCompensationManualChange(index, parseFloat(e.target.value))}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                                min={0}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-[#fffcf6] p-4 rounded-lg border border-gray-200 mb-4">
                    <h4 className="text-[#ba372a] font-semibold mb-3">Compensation Calculation Follows</h4>
                    <div className="mb-3">
                      <p><span className="font-medium">Annual earnings at death:</span> {fmtK(calculationData.AnnualEarningsAtDeath || 0)}</p>
                    </div>
                    <div className="mb-3">
                      <p>
                        <span className="font-medium">Is annual wage &lt. min {systemParams['MinCompensationAmountDeath'] || '3125'}K:</span>{' '}
                        {(calculationData.AnnualEarningsAtDeath || 0) < parseNumeric(systemParams['MinCompensationAmountDeath']) ? 'YES' : 'NO'}
                      </p>
                    </div>
                    <div>
                      <p><span className="font-medium">Calculated compensation amount is:</span> {fmtK(deathCaseData.calculatedAmount)}</p>
                    </div>
                  </div>

                  <h4 className="text-[#ba372a] font-semibold mb-3">Compensation Amount Breakup Follows</h4>
                  <div className="overflow-x-auto mb-6">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-[#ba372a] text-yellow-300">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-center">Age</th>
                          <th className="px-4 py-2 text-center">Age at Incident Date</th>
                          <th className="px-4 py-2 text-left">Relation</th>
                          <th className="px-4 py-2 text-right">Amt</th>
                          <th className="px-4 py-2 text-center">Percentage</th>
                          <th className="px-4 py-2 text-right">Org Amt</th>
                          <th className="px-4 py-2 text-center">Org Percentage</th>
                          <th className="px-4 py-2 text-center">Weekly Compensation Benefit</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#fffcf6]">
                        {(() => {
                          const baseAmount = deathCaseData.calculatedAmount || 0;
                          const finalTotal = calculationData.CompensationAmount || 0;
                          const splits = computeDeathSplits(baseAmount);

                          const pct = (amount: number) => (baseAmount > 0 ? Math.round((amount / baseAmount) * 100) : 0);
                          const finalShare = (amount: number) => (baseAmount > 0 ? Math.round((finalTotal * (amount / baseAmount)) * 100) / 100 : 0);
                          const orgShare = (amount: number) => Math.round(amount * 100) / 100;

                          const incidentDate = injuryDetails?.IncidentDate ? new Date(injuryDetails.IncidentDate) : null;
                          const ageNow = (dob?: string) => (dob ? calculateAge(new Date(dob), new Date()) : ('N/A' as any));
                          const ageAtIncident = (dob?: string) => (dob && incidentDate ? calculateAge(new Date(dob), incidentDate) : ('N/A' as any));

                          const children = dependants.filter((d) => isChildType(d.DependantType));
                          const additional = dependants.filter((d) => !isChildType(d.DependantType));

                          const rows: React.ReactNode[] = [];

                          if (workerDetails?.SpouseFirstName) {
                            const spouseSplit = splits.find((s) => s.type === 'spouse');
                            const b = spouseSplit?.amount || 0;
                            rows.push(
                              <tr key="spouse" className="border-b border-gray-200 hover:bg-[#fef9e7]">
                                <td className="px-4 py-2">{workerDetails.SpouseFirstName} {workerDetails.SpouseLastName}</td>
                                <td className="px-4 py-2 text-center">{ageNow(workerDetails.SpouseDOB)}</td>
                                <td className="px-4 py-2 text-center">{ageAtIncident(workerDetails.SpouseDOB)}</td>
                                <td className="px-4 py-2">Spouse</td>
                                <td className="px-4 py-2 text-right">{finalShare(b)}</td>
                                <td className="px-4 py-2 text-center">{pct(b)}%</td>
                                <td className="px-4 py-2 text-right">{orgShare(b)}</td>
                                <td className="px-4 py-2 text-center">{pct(b)}%</td>
                                <td className="px-4 py-2 text-center">No</td>
                              </tr>
                            );
                          }

                          for (const child of children) {
                            const split = splits.find((s) => s.type === 'child' && s.id === child.DependantID);
                            const b = split?.amount || 0;
                            rows.push(
                              <tr key={`child-${child.DependantID}`} className="border-b border-gray-200 hover:bg-[#fef9e7]">
                                <td className="px-4 py-2">{child.DependantFirstName} {child.DependantLastName}</td>
                                <td className="px-4 py-2 text-center">{ageNow(child.DependantDOB)}</td>
                                <td className="px-4 py-2 text-center">{ageAtIncident(child.DependantDOB)}</td>
                                <td className="px-4 py-2">Child</td>
                                <td className="px-4 py-2 text-right">{finalShare(b)}</td>
                                <td className="px-4 py-2 text-center">{pct(b)}%</td>
                                <td className="px-4 py-2 text-right">{orgShare(b)}</td>
                                <td className="px-4 py-2 text-center">{pct(b)}%</td>
                                <td className="px-4 py-2 text-center">
                                  {ageNow(child.DependantDOB) !== 'N/A' && (ageNow(child.DependantDOB) as number) < 16 ? fmtK(weeklyBenefitRate) : 'No'}
                                </td>
                              </tr>
                            );
                          }

                          for (const dep of additional) {
                            const split = splits.find((s) => s.type === 'additional' && s.id === dep.DependantID);
                            const b = split?.amount || 0;
                            rows.push(
                              <tr key={`addl-${dep.DependantID}`} className="border-b border-gray-200 hover:bg-[#fef9e7]">
                                <td className="px-4 py-2">{dep.DependantFirstName} {dep.DependantLastName}</td>
                                <td className="px-4 py-2 text-center">{ageNow(dep.DependantDOB)}</td>
                                <td className="px-4 py-2 text-center">{ageAtIncident(dep.DependantDOB)}</td>
                                <td className="px-4 py-2">{dep.DependantType}</td>
                                <td className="px-4 py-2 text-right">{fmtK(orgShare(b))}</td>
                                <td className="px-4 py-2 text-center">{pct(b)}%</td>
                                <td className="px-4 py-2 text-right">{fmtK(orgShare(b))}</td>
                                <td className="px-4 py-2 text-center">{pct(b)}%</td>
                                <td className="px-4 py-2 text-center">No</td>
                              </tr>
                            );
                          }

                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Weekly Benefit Lumpsum For Children */}
              <div className="mb-6">
                <h4 className="text-[#ba372a] font-semibold mb-3">Weekly Benefit Lumpsum For Children</h4>
                {deathCaseData.weeklyBenefitForChildren.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-[#ba372a] text-yellow-300">
                        <tr>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">DOB</th>
                          <th className="px-4 py-2 text-center">Age at Incident Date</th>
                          <th className="px-4 py-2 text-center">No. of Days until Age 16</th>
                          <th className="px-4 py-2 text-center">No. of Weeks until Age 16</th>
                          <th className="px-4 py-2 text-right">Weekly Benefit Lumpsum for Children</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#fffcf6]">
                        {deathCaseData.weeklyBenefitForChildren.map((c, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-[#fef9e7]">
                            <td className="px-4 py-2">{c.name}</td>
                            <td className="px-4 py-2">{c.dob}</td>
                            <td className="px-4 py-2 text-center">{c.age}</td>
                            <td className="px-4 py-2 text-center">{c.daysUntil16}</td>
                            <td className="px-4 py-2 text-center">{c.weeksUntil16}</td>
                            <td className="px-4 py-2 text-right">{fmtK(c.benefit)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#fffcf6] font-semibold">
                          <td colSpan={5} className="px-4 py-2">Total</td>
                          <td className="px-4 py-2 text-right">
                            {fmtK(
                              deathCaseData.weeklyBenefitForChildren.reduce(
                                (s, r) => s + (Number.isFinite(r.benefit as number) ? (r.benefit as number) : 0),
                                0
                              )
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-3 bg-[#fffcf6]">
                    No eligible children (under 16 at incident date) to display.
                  </div>
                )}
              </div>

              {/* Additional Expenses */}
              <h4 className="font-medium text-primary mb-3 mt-6">Additional Expenses</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
				
                  <label htmlFor="CCWDMedicalExpenses" className="block text-sm font-medium text-gray-700 mb-1">Medical Expenses (+)</label>
                  <input type="number" id="CCWDMedicalExpenses" value={medicalExpenses} onChange={(e) => handleExpenseChange(e, 'medical')} className="input" min="0" />
                </div>
                <div>
                  <label htmlFor="CCWDMiscExpenses" className="block text-sm font-medium text-gray-700 mb-1">Misc Expenses (+)</label>
                  <input type="number" id="CCWDMiscExpenses" value={miscExpenses} onChange={(e) => handleExpenseChange(e, 'misc')} className="input" min="0" />
                </div>
                <div>
                  <label htmlFor="CCWDDeductions" className="block text-sm font-medium text-gray-700 mb-1">Deductions (-)</label>
                  <input type="number" id="CCWDDeductions" value={deductions} onChange={(e) => handleExpenseChange(e, 'deductions')} className="input" min="0" />
                  <label htmlFor="CCWDDeductionsNotes" className="block text-sm font-medium text-gray-700 mb-1 mt-2">Deduction Notes</label>
                  <textarea id="CCWDDeductionsNotes" value={deductionNotes} onChange={(e) => handleExpenseChange(e, 'deductionNotes')} className="input min-h-[70px]" placeholder="Explain deductions (optional for draft, required context for Accept)" />
                </div>
              </div>

              {/* Findings & Recommendations */}
              {/* Findings & Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <label htmlFor="CCWDFindings" className="block text-sm font-medium text-gray-700 mb-1">Findings</label>
                  <textarea id="CCWDFindings" value={findings} onChange={(e) => setFindings(e.target.value)} className="input min-h-[90px]" placeholder="Enter your findings" />
                </div>
                <div>
                  <label htmlFor="CCWDRecommendations" className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
                  <textarea id="CCWDRecommendations" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} className="input min-h-[90px]" placeholder="Enter your recommendations" />
                </div>
              </div>

              <div className="mb-4 mt-4">
                <div className="bg-[#fffcf6] p-4 rounded-lg border border-gray-200">
                  <h4 className="text-[#ba372a] font-semibold mb-3">
  Final Compensation Amount (Base + Medical + Misc − Deductions)
</h4>

                  <div id="fca" className="text-2xl font-bold">{fmtK(finalDisplayAmount)}</div>

                </div>
              </div>

              {/* Document Status */}
              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <h4 className="font-medium text-primary mb-3">Document Status</h4>

                {/* Mandatory for Accept */}
                <p className="text-sm font-medium mb-2">Mandatory for Accept:</p>
                <div className="border-t border-b border-dashed border-gray-300 py-2 mb-4">
                  {mandatoryForAccept.map((doc, idx) => {
                    const submitted = normalizedSubmitted.has((doc || '').trim().toLowerCase());
                    return (
                      <div key={`must-${doc}`} className="flex items-center mb-1">
                        {submitted ? <Check className="h-5 w-5 text-green-500 mr-2" /> : <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />}
                        <span className={submitted ? 'text-green-700' : 'text-yellow-700'}>
                          {idx + 1}. {doc}
                        </span>
                      </div>
                    );
                  })}
                  {missingMandatoryForAccept.length > 0 && (
                    <div className="text-xs text-red-600 mt-1">Missing: {missingMandatoryForAccept.join(', ')}</div>
                  )}
                </div>

                {/* Full checklist (status only) */}
                <p className="text-sm font-medium mb-2">Full Document Checklist (status only):</p>
                <div className="border-t border-b border-dashed border-gray-300 py-2 mb-2">
                  {mandatoryDocuments.required.map((doc, index) => {
                    const submitted = normalizedSubmitted.has((doc || '').trim().toLowerCase());
                    return (
                      <div key={`req-${doc}`} className="flex items-center mb-1">
                        {submitted ? <Check className="h-5 w-5 text-green-500 mr-2" /> : <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />}
                        <span className={submitted ? 'text-green-700' : 'text-yellow-700'}>
                          {index + 1}. {doc}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-sm font-medium mb-2">Submitted Attachments:</p>
                <div className="border-t border-b border-dashed border-gray-300 py-2 mb-2">
                  {mandatoryDocuments.available.map((doc, index) => (
                    <div key={`sub-${doc}`} className="flex items-center mb-1">
                      <Check className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-green-700">{index + 1}. {doc}</span>
                    </div>
                  ))}
                  {mandatoryDocuments.available.length === 0 && (
                    <div className="text-sm text-gray-600">No required attachments submitted yet.</div>
                  )}
                </div>

                {missingDocuments.length > 0 && (
                  <>
                    <p className="text-sm font-medium mb-2">Other Missing (does not block Accept):</p>
                    <div className="border-t border-b border-dashed border-gray-300 py-2">
                      {missingDocuments.map((doc, index) => (
                        <div key={`miss-${doc}`} className="flex items-center">
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                          <span className="text-yellow-700">{index + 1}. {doc}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>{/* <-- closes the .card container */}
            {/* Close the fieldset AFTER all interactive inputs */}
            </fieldset>

            {/* Actions (stay outside the fieldset so they remain clickable even in readOnly) */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-end md:space-x-3 gap-2">
              <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>

              {!readOnly && (
                <>
                  <div className="flex flex-col items-start">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="btn btn-outline flex items-center"
                      disabled={savingDraft}
                      title="Save current progress without submitting for review"
                    >
                      {savingDraft ? (
                        <span className="flex items-center">
                          <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-current rounded-full"></span>
                          Saving draft...
                        </span>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Draft
                        </>
                      )}
                    </button>
                    {draftSuccess && (
                      <div className="mt-2 text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 flex items-center">
                        <Check className="h-4 w-4 mr-1" />
                        {draftSuccess}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary flex items-center"
                    onClick={handleAcceptPreview}
                    disabled={
                      (injuryDetails?.IncidentType === 'Injury' && !injuryChecklist.some((r) => r.checked && r.compensation > 0)) ||
                      missingMandatoryForAccept.length > 0 ||
                      !findings ||
                      !recommendations
                    }
                    title="Review and finalize"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Accept
                  </button>
                </>
              )}
            </div>

            <div className="text-xs text-yellow-600 mt-1">
              {injuryDetails?.IncidentType === 'Injury' && !injuryChecklist.some((r) => r.checked && r.compensation > 0) && (
                <p>Select at least one injury criterion with a non-zero amount to Accept.</p>
              )}
              {missingMandatoryForAccept.length > 0 && (
                <p>Mandatory documents required to Accept: {missingMandatoryForAccept.join(', ')}.</p>
              )}
              {(!findings || !recommendations) && <p>Findings and Recommendations are required to Accept.</p>}
            </div>
          </form>
        )}
      </div>


{showLockPrompt && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40"></div>
    <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-[95%] p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Lock this claim?</h3>
      <p className="text-sm text-gray-700 mb-4">
        Locking prevents others from editing this claim while you work. Do you want to lock it for editing, or continue in read-only mode?
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={proceedReadOnly} className="btn btn-secondary">No, Read-only</button>
        <button onClick={lockNow} className="btn btn-primary">Yes, Lock</button>
      </div>
    </div>
  </div>
)}



      {/* ===== Summary Modal ===== */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-[95%] p-6">
            <h3 className="text-xl font-semibold text-primary mb-4">Accept Summary</h3>

            {/* Top summary grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm"><span className="font-medium">Processed by (Staff ID):</span> {userStaffID || 'N/A'}</p>
                <p className="text-sm"><span className="font-medium">CRN (Display IRN):</span> {injuryDetails?.DisplayIRN || 'N/A'}</p>
                <p className="text-sm"><span className="font-medium">IRN:</span> {injuryDetails?.IRN || calculationData.IRN || 'N/A'}</p>
                <p className="text-sm">
                  <span className="font-medium">Worker Name:</span> {workerDetails?.WorkerFirstName} {workerDetails?.WorkerLastName}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm"><span className="font-medium">Incident Type:</span> {injuryDetails?.IncidentType}</p>
              </div>
            </div>

            {/* Selected injury rows */}
            <div className="mb-4">
              <h4 className="font-medium text-primary mb-2">Injury Checklist (Selected)</h4>
              {injuryDetails?.IncidentType === 'Death' ? (
                <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-3 bg-[#fffcf6]">
                  N/A for Death case.
                </div>
              ) : selectedInjuryRows.length === 0 ? (
                <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-3 bg-[#fffcf6]">
                  No selected rows.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-[#ba372a] text-yellow-300">
                      <tr>
                        <th className="px-4 py-2 text-left">Criteria</th>
                        <th className="px-4 py-2 text-center">Factor</th>
                        <th className="px-4 py-2 text-center">Doctor %</th>
                        <th className="px-4 py-2 text-right">Compensation</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#fffcf6]">
                      {selectedInjuryRows.map((r, idx) => (
                        <tr key={idx} className="border-b border-gray-200">
                          <td className="px-4 py-2">{r.criteria}</td>
                          <td className="px-4 py-2 text-center">{r.factor}</td>
                          <td className="px-4 py-2 text-center">{r.doctorPercentage}</td>
                          <td className="px-4 py-2 text-right">{fmtK(r.compensation)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#fffcf6] font-semibold">
                        <td colSpan={3} className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right">
                          {fmtK(selectedInjuryRows.reduce((s, r) => s + (r.compensation || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Expenses + Total */}
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <h4 className="font-medium text-primary mb-2">Expenses Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="text-sm"><span className="font-medium">Medical Expenses:</span> {fmtK(medicalExpenses)}</div>
                <div className="text-sm"><span className="font-medium">Misc. Expenses:</span> {fmtK(miscExpenses)}</div>
                <div className="text-sm"><span className="font-medium">Deductions:</span> {fmtK(deductions)}</div>
              </div>
            </div>

            <div className="mb-2 p-3 bg-[#fffcf6] rounded border border-gray-200">
              <p className="text-sm">
                <span className="font-medium">Total Compensation Amount:</span> {fmtK(finalDisplayAmount)}

              </p>
            </div>

            {/* Modal buttons */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSummary(false)}
                disabled={accepting || Boolean(summarySuccess)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary flex items-center"
                onClick={handleAcceptFinalize}
                disabled={accepting || Boolean(summarySuccess)}
                title="Finalize and submit for review"
              >
                {accepting ? (
                  <span className="flex items-center">
                    <span className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></span>
                    Proceeding...
                  </span>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Proceed
                  </>
                )}
              </button>
            </div>

            {/* Success message at the VERY BOTTOM of the summary form */}
            {summarySuccess && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md flex items-start">
                <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{summarySuccess}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompensationCalculation;
