import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Form113View from './Form113View';
import Form124View from './Form124View';
import ListClaimDecisions from './ListClaimDecisions';
import CompensationBreakupDetailsView from './CompensationBreakupDetailsView';
import { downloadConsentOfAwardInjury } from '../../utils/ConsentOfAward-Injury';

const CREST =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/logocrest.png';
const REG_SIGN =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/registrarsign.png';
const REG_STAMP =
  'https://ennhknwwfdlaudephyly.supabase.co/storage/v1/object/public/cpps/Registrar.png';

interface Props {
  IRN?: string;
  irn?: string;
  TBCRRID?: string;
  formType?: 'Injury' | 'Death';
  onCloseAll?: () => void;
  onClose?: () => void;
}

type EmployerRow = {
  OrganizationName: string;
  InsuranceProviderIPACode: string | null;
};

type InsuranceRow = {
  IPACODE: string;
  InsuranceCompanyOrganizationName: string;
};

type OwcBankRow = {
  OBANBankName: string;
  OBANBankAccountNumber: string;
};

const BANK_OPTIONS = [
  'BSP',
  'Kina',
  'Westpac',
  'Credit Bank',
  'NBC',
  'TISA',
  'Womens Microbank',
  'NDB',
] as const;

const BSP_BRANCHES = [
  { code: '088-332', name: 'Aitape' },
  { code: '088-300', name: 'Bulolo' },
  { code: '088-337', name: 'Eriku' },
  { code: '088-303', name: 'Lae Top Town' },
  { code: '088-958', name: 'Lae Commercial Centre' },
  { code: '088-324', name: 'Lae Market' },
  { code: '088-938', name: 'Lae SME (BB Plaza)' },
  { code: '088-960', name: 'Madang' },
  { code: '088-319', name: 'Vanimo' },
  { code: '088-306', name: 'Wewak' },
  { code: '088-943', name: 'Boroko Banking Centre' },
  { code: '088-340', name: 'BSP First Habour City' },
  { code: '088-951', name: 'Gordons Premium' },
  { code: '088-954', name: 'Gordons BSP First' },
  { code: '088-951', name: 'Gordons Commercial Centre' },
  { code: '088-950', name: 'BSP Haus' },
  { code: '088-344', name: 'Motukea' },
  { code: '088-294', name: 'Port Moresby' },
  { code: '088-294', name: 'Port Moresby Premium' },
  { code: '088-346', name: 'Port Moresby BSP First' },
  { code: '088-342', name: 'BSP Premium Waterfront' },
  { code: '088-202', name: 'Waigani Banking Centre' },
  { code: '088-968', name: 'Waigani Drive' },
  { code: '088-907', name: 'Vision City (SME)' },
  { code: '088-941', name: 'Arawa' },
  { code: '088-331', name: 'Bialla' },
  { code: '088-336', name: 'Buka' },
  { code: '088-302', name: 'Kavieng' },
  { code: '088-311', name: 'Kimbe' },
  { code: '088-964', name: 'Kokopo' },
  { code: '088-974', name: 'Lihir' },
  { code: '088-334', name: 'Lorengau' },
  { code: '088-965', name: 'Rabaul' },
  { code: '088-317', name: 'Alotau' },
  { code: '088-335', name: 'Daru' },
  { code: '088-328', name: 'Kiunga' },
  { code: '088-316', name: 'Moro' },
  { code: '088-318', name: 'Tabubil' },
  { code: '088-314', name: 'Tari' },
  { code: '088-312', name: 'Popondetta' },
];

interface Recipient {
  type: 'worker' | 'spouse' | 'dependent' | 'employer' | 'insurance';
  id: string | number;
  name: string;
  bankName: string;
  bsb: string;
  accountNumber: string;
  amount: number;
}

const PendingClaimsAwardedForPaymentSectionReview: React.FC<Props> = ({
  IRN,
  irn,
  formType = 'Injury',
  onCloseAll,
  onClose,
}) => {
  const { profile } = useAuth();
  const resolvedIRN = useMemo(() => (IRN ?? irn ?? '').toString(), [IRN, irn]);
  const [open, setOpen] = useState(true); // fallback to self-close

  // who am I?
  const [myStaffId, setMyStaffId] = useState<number | null>(null);
  const isInjury = formType === 'Injury';

  // ---------- Payment Received section state ----------
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);

  const [insuranceList, setInsuranceList] = useState<InsuranceRow[]>([]);
  const [insuranceProviderName, setInsuranceProviderName] = useState(''); // auto or overridden
  const [insuranceOverrideOpen, setInsuranceOverrideOpen] = useState(false);
  const [insuranceManuallyOverridden, setInsuranceManuallyOverridden] = useState(false);

  const [bankName, setBankName] = useState<string>('');
  const [drawerAccountNo, setDrawerAccountNo] = useState('');
  const [paymentTypeMethod, setPaymentTypeMethod] = useState('');
  const [reference, setReference] = useState('');

  const [owcAccounts, setOwcAccounts] = useState<OwcBankRow[]>([]);
  const [selectedOwcAccount, setSelectedOwcAccount] = useState<string>(''); // "Bank|Account"

  const [awardedAmount, setAwardedAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [finalPaymentAmount, setFinalPaymentAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [owcInvestmentAccountNumber, setOwcInvestmentAccountNumber] = useState('1000489310');
  const [paidDate, setPaidDate] = useState<string>('');
  const [paymentDetails, setPaymentDetails] = useState('');

  // NEW: Multi-recipient state
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Validation error modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');

  // Track which recipients are in "manual BSB" mode
  const [bsbOtherModes, setBsbOtherModes] = useState<Record<number, boolean>>({});

  // ---------- Effects ----------
  useEffect(() => {
    (async () => {
      if (!profile?.id) return;
      const { data, error } = await supabase
        .from('owcstaffmaster')
        .select('OSMStaffID')
        .eq('cppsid', profile.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      const sid = data?.OSMStaffID ? Number(data.OSMStaffID) : null;
      setMyStaffId(sid);
    })();
  }, [profile?.id]);

  // Load insurance companies (for override picker)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('insurancecompanymaster')
        .select('*')
        .order('InsuranceCompanyOrganizationName', { ascending: true });
      if (error) {
        console.error('insurancecompanymaster load error:', error);
        setInsuranceList([]);
        return;
      }
      setInsuranceList(Array.isArray(data) ? (data as InsuranceRow[]) : []);
    })();
  }, []);

  // Load OWC accounts
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('owcbankaccountmaster')
        .select('OBANBankName, OBANBankAccountNumber')
        .order('OBANBankName', { ascending: true });
      if (error) {
        console.error('owcbankaccountmaster load error:', error);
        setOwcAccounts([]);
        return;
      }
      const accounts = (data as OwcBankRow[]) || [];
      setOwcAccounts(accounts);

      // Default selection: Drawing Account 1000489411
      const defaultAcct = accounts.find(a => String(a.OBANBankAccountNumber) === '1000489411');
      if (defaultAcct) {
        setSelectedOwcAccount(`${defaultAcct.OBANBankName}|${defaultAcct.OBANBankAccountNumber}`);
      }
    })();
  }, []);

  // Auto-calc Awarded Amount by IRN
  useEffect(() => {
    (async () => {
      if (!resolvedIRN) {
        setAwardedAmount(0);
        return;
      }
      const { data, error } = await supabase
        .from('claimcompensationworkerdetails')
        .select('CCWDCompensationAmount, CCWDMedicalExpenses, CCWDMiscExpenses, CCWDDeductions')
        .eq('IRN', /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN);
      if (error) {
        console.error('award amount load error:', error);
        setAwardedAmount(0);
        return;
      }
      const total = (data || []).reduce((sum, row: any) => {
        const comp = Number(row.CCWDCompensationAmount || 0);
        const med = Number(row.CCWDMedicalExpenses || 0);
        const misc = Number(row.CCWDMiscExpenses || 0);
        const ded = Number(row.CCWDDeductions || 0);
        return sum + (comp + med + misc - ded);
      }, 0);
      setAwardedAmount(Number.isFinite(total) ? total : 0);
    })();
  }, [resolvedIRN]);

  // When IRN changes → reset manual override so new claim follows its employer default
  useEffect(() => {
    setInsuranceManuallyOverridden(false);
    setInsuranceOverrideOpen(false);
  }, [resolvedIRN]);

  // Resolve Employer & Insurance
  useEffect(() => {
    (async () => {
      try {
        if (!resolvedIRN) {
          setSelectedEmployer(null);
          if (!insuranceManuallyOverridden) setInsuranceProviderName('');
          return;
        }

        const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;

        // 1) workerirn: get WorkerID by IRN
        const { data: workerRow, error: wErr } = await supabase
          .from('workerirn')
          .select('WorkerID')
          .eq('IRN', irnValue)
          .maybeSingle();
        if (wErr) throw wErr;
        const workerId = workerRow?.WorkerID;
        if (!workerId) {
          setSelectedEmployer(null);
          if (!insuranceManuallyOverridden) setInsuranceProviderName('');
          return;
        }

        // 2) currentemploymentdetails: EmployerCPPSID by WorkerID
        const { data: empDet, error: cedErr } = await supabase
          .from('currentemploymentdetails')
          .select('EmployerCPPSID')
          .eq('WorkerID', workerId)
          .maybeSingle();
        if (cedErr) throw cedErr;
        const employerCppsid = empDet?.EmployerCPPSID;
        if (!employerCppsid) {
          setSelectedEmployer(null);
          if (!insuranceManuallyOverridden) setInsuranceProviderName('');
          return;
        }

        // 3) employermaster
        const { data: emp, error: emErr } = await supabase
          .from('employermaster')
          .select('OrganizationName, InsuranceProviderIPACode')
          .eq('CPPSID', employerCppsid)
          .maybeSingle();
        if (emErr) throw emErr;

        const employer: EmployerRow | null = emp
          ? {
            OrganizationName: emp.OrganizationName,
            InsuranceProviderIPACode: emp.InsuranceProviderIPACode ?? null,
          }
          : null;

        setSelectedEmployer(employer ?? null);

        // 4) auto insurance name (unless manually overridden)
        if (employer?.InsuranceProviderIPACode && !insuranceManuallyOverridden) {
          const { data: ins, error: insErr } = await supabase
            .from('insurancecompanymaster')
            .select('InsuranceCompanyOrganizationName')
            .eq('IPACODE', employer.InsuranceProviderIPACode)
            .maybeSingle();
          if (insErr) throw insErr;
          setInsuranceProviderName(ins?.InsuranceCompanyOrganizationName ?? '');
        } else if (!insuranceManuallyOverridden) {
          setInsuranceProviderName('');
        }

        // 5) Fetch Worker Name (and Spouse) and Dependents to initialize recipients
        const { data: workerDetails, error: wdErr } = await supabase
          .from('workerpersonaldetails')
          .select('WorkerFirstName, WorkerLastName, SpouseFirstName, SpouseLastName')
          .eq('WorkerID', workerId)
          .maybeSingle();
        if (wdErr) throw wdErr;

        const workerName = `${workerDetails?.WorkerFirstName ?? ''} ${workerDetails?.WorkerLastName ?? ''}`.trim() || 'Worker';

        const { data: deps, error: depErr } = await supabase
          .from('dependantpersonaldetails')
          .select('DependantID, DependantFirstName, DependantLastName')
          .eq('WorkerID', workerId);
        if (depErr) throw depErr;

        const initialRecipients: Recipient[] = [
          {
            type: 'worker',
            id: workerId,
            name: workerName,
            bankName: '',
            bsb: '',
            accountNumber: '',
            amount: 0,
          },
        ];

        const spouseName = `${workerDetails?.SpouseFirstName ?? ''} ${workerDetails?.SpouseLastName ?? ''}`.trim();
        if (spouseName) {
          initialRecipients.push({
            type: 'spouse',
            id: `spouse-${workerId}`,
            name: spouseName,
            bankName: '',
            bsb: '',
            accountNumber: '',
            amount: 0,
          });
        }

        (deps || []).forEach(d => {
          initialRecipients.push({
            type: 'dependent',
            id: d.DependantID,
            name: `${d.DependantFirstName ?? ''} ${d.DependantLastName ?? ''}`.trim() || 'Dependent',
            bankName: '',
            bsb: '',
            accountNumber: '',
            amount: 0,
          });
        });

        // 6) Add Employer and Insurance Provider as potential recipients
        if (employer?.OrganizationName) {
          initialRecipients.push({
            type: 'employer',
            id: `employer-${workerId}`,
            name: employer.OrganizationName,
            bankName: '',
            bsb: '',
            accountNumber: '',
            amount: 0,
          });
        }

        const currentInsurance = employer?.InsuranceProviderIPACode && !insuranceManuallyOverridden
          ? (await supabase
            .from('insurancecompanymaster')
            .select('InsuranceCompanyOrganizationName')
            .eq('IPACODE', employer.InsuranceProviderIPACode)
            .maybeSingle()).data?.InsuranceCompanyOrganizationName
          : insuranceProviderName;

        if (currentInsurance) {
          initialRecipients.push({
            type: 'insurance',
            id: `insurance-${workerId}`,
            name: currentInsurance,
            bankName: '',
            bsb: '',
            accountNumber: '',
            amount: 0,
          });
        }

        if (initialRecipients.length > 0) {
          initialRecipients[0].amount = Number(finalPaymentAmount || 0);
        }

        setRecipients(initialRecipients);

      } catch (e) {
        console.error('Auto employer resolve failed:', e);
        setSelectedEmployer(null);
        if (!insuranceManuallyOverridden) setInsuranceProviderName('');
      }
    })();
  }, [resolvedIRN, insuranceManuallyOverridden]);

  // Helper for recipients
  const updateRecipient = (index: number, updates: Partial<Recipient>) => {
    setRecipients(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const totalSplitAmount = recipients.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // ---------- Auto resolving effects ----------

  // Handle amountPaid syncing to worker record if no splitting occurred
  useEffect(() => {
    if (recipients.length > 0 && totalSplitAmount === 0 && Number(amountPaid) > 0) {
      setRecipients(prev => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        next[0] = { ...next[0], amount: Number(amountPaid) };
        return next;
      });
    }
  }, [amountPaid, totalSplitAmount]);

  // Keep Final Payment Amount = Awarded + Interest (still editable)
  useEffect(() => {
    const total = Number(awardedAmount || 0) + Number(interestAmount || 0);
    setFinalPaymentAmount(Number.isFinite(total) ? Number(total.toFixed(2)) : 0);
  }, [awardedAmount, interestAmount]);

  // ---------- Close handlers ----------
  const handleClose = () => {
    if (onCloseAll) return onCloseAll();
    if (onClose) return onClose();
    setOpen(false);
  };

  // ---------- Document actions (preview-only) ----------
  const handleDownloadConsent = async () => {
    if (!resolvedIRN) return;
    if (isInjury) {
      await downloadConsentOfAwardInjury(resolvedIRN, {
        crestUrl: CREST,
        includeSignature: false,
      });
    } else {
      const mod = await import('../../utils/ConsentOfAward-Death');
      const fn = (mod as any).downloadConsentOfAwardDeath || (mod as any).default;
      if (!fn) return;
      await fn(resolvedIRN, { crestUrl: CREST, includeSignature: false });
    }
  };

  const handlePrintCertificateOfAward = async () => {
    if (!resolvedIRN) return;
    try {
      const mod = await import('../../utils/CertificateOfAward_jspdf');
      const fn =
        (mod as any).generateCertificateOfAward ||
        (mod as any).generateCertificateOfAwardPDF ||
        (mod as any).default;
      if (!fn) return;
      await fn(resolvedIRN);
    } catch (e) {
      console.error(e);
      setErrorModalMessage('Could not generate Certificate Of Award. Please try again.');
      setShowErrorModal(true);
    }
  };

  const handlePrintCertificateOfClaimAward = async () => {
    if (!resolvedIRN) return;
    try {
      let staffId = myStaffId;
      if (staffId == null && profile?.id) {
        const { data, error } = await supabase
          .from('owcstaffmaster')
          .select('OSMStaffID')
          .eq('cppsid', profile.id)
          .maybeSingle();
        if (error) throw error;
        staffId = data?.OSMStaffID ? Number(data.OSMStaffID) : null;
        setMyStaffId(staffId ?? null);
      }
      if (staffId == null) {
        setErrorModalMessage('Your staff id could not be determined. Please reopen this page or contact an admin.');
        setShowErrorModal(true);
        return;
      }
      const mod = await import('../../utils/CertificateOfClaimAward_jspdf');
      const fn =
        (mod as any).generateCertificateOfClaimAward ||
        (mod as any).generateCertificateOfClaimAwardPDF ||
        (mod as any).default;
      if (!fn) return;
      await fn(resolvedIRN, staffId, { showStamps: false });
    } catch (e) {
      console.error(e);
      setErrorModalMessage('Could not generate Certificate Of Claim Award. Please try again.');
      setShowErrorModal(true);
    }
  };

  const handlePrintPaymentChecklist = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/ChecklistForPayment_jspdf');
    const fn =
      (mod as any).printChecklistForPayment ||
      (mod as any).generateChecklistForPayment ||
      (mod as any).default;
    if (!fn) return;
    await fn(resolvedIRN);
  };

  const handlePrintBankConfirmation = async () => {
    if (!resolvedIRN) return;
    const mod = await import('../../utils/BankConfirmationLetter_jspdf');
    const fn =
      (mod as any).printBankConfirmationLetter ||
      (mod as any).generateBankConfirmationLetter ||
      (mod as any).default;
    if (!fn) return;
    await fn(resolvedIRN);
  };

  // ---------- Helpers ----------
  const dateOnly = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const selectedOwcObj = useMemo(() => {
    if (!selectedOwcAccount) return null;
    const [bank, acct] = selectedOwcAccount.split('|');
    return { bank, acct };
  }, [selectedOwcAccount]);

  // ---------- Submit (confirm) ----------
  const openConfirm = () => {
    if (!resolvedIRN) {
      setErrorModalMessage('No valid IRN found for this claim.');
      setShowErrorModal(true);
      return;
    }
    if (!selectedEmployer) {
      setErrorModalMessage('Employer details are required. Please ensure the worker has current employment details.');
      setShowErrorModal(true);
      return;
    }
    if (!insuranceProviderName) {
      setErrorModalMessage('Insurance Provider (Drawer) is required.');
      setShowErrorModal(true);
      return;
    }
    if (!bankName) {
      setErrorModalMessage('Please select a Drawer Bank Name.');
      setShowErrorModal(true);
      return;
    }
    if (!selectedOwcAccount) {
      setErrorModalMessage('Please select an OWC Account.');
      setShowErrorModal(true);
      return;
    }
    if (!paidDate) {
      setErrorModalMessage('Paid Date is required.');
      setShowErrorModal(true);
      return;
    }

    // Split validation
    if (Math.abs(totalSplitAmount - Number(amountPaid)) > 0.01) {
      setErrorModalMessage(`Total allocated amount (K${totalSplitAmount.toLocaleString()}) must exactly equal the Amount Paid by Insurer/Employer (K${Number(amountPaid).toLocaleString()}).`);
      setShowErrorModal(true);
      return;
    }

    // Check bank details for any recipient with an amount
    const invalidRecs = recipients.filter(r => (Number(r.amount) || 0) > 0 && (!r.bankName.trim() || !r.bsb.trim() || !r.accountNumber.trim()));
    if (invalidRecs.length > 0) {
      setErrorModalMessage(`Please provide complete bank details for all recipients with an allocated amount (Missing info for: ${invalidRecs.map(r => r.name).join(', ')}).`);
      setShowErrorModal(true);
      return;
    }

    setConfirmOpen(true);
  };

  // IMPORTANT: make sure this handler prevents browser default and shows "Saving..."
  const handleProceedSave = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault(); // <-- stops any implicit form submit
    if (!resolvedIRN) return;
    setSaving(true);
    try {
      const irnValue = /^\d+$/.test(resolvedIRN) ? Number(resolvedIRN) : resolvedIRN;
      const today = dateOnly(new Date());

      // Validate splits
      if (Math.abs(totalSplitAmount - Number(amountPaid)) > 0.01) {
        setErrorModalMessage(`Total split amount (K${totalSplitAmount.toLocaleString()}) must exactly equal Amount Paid by Insurer/Employer (K${Number(amountPaid).toLocaleString()})`);
        setShowErrorModal(true);
        setSaving(false);
        return;
      }

      // Check for zero-amount recipients? Or just filter them
      const validRecipients = recipients.filter(r => (Number(r.amount) || 0) > 0);
      if (validRecipients.length === 0) {
        setErrorModalMessage('Please allocate the payment amount to at least one recipient.');
        setShowErrorModal(true);
        setSaving(false);
        return;
      }

      // 1) update claimsawardedpaymentsectionreview status
      const { error: upErr } = await supabase
        .from('claimsawardedpaymentsectionreview')
        .update({
          CAPSRReviewStatus: 'PendingManagerReview',
          CAPSRReviewDate: today,
          CAPSRNotes: 'Submitted to PaymentManager for Review',
        })
        .eq('IRN', irnValue);
      if (upErr) throw upErr;

      // 2) Insert split records into bankaccountdepositmaster
      const rowsToInsert = validRecipients.map(r => ({
        IRN: irnValue,
        AwardedAmount: awardedAmount,
        InterestAmount: interestAmount,
        FinalPaymentAmount: amountPaid, // ✅ Use the actual amount being paid
        EbankAmountPaid: r.amount,
        EbankIssuedDate: today,
        WorkerBankName: r.bankName,
        WorkerBSBBranchNo: r.bsb,
        WorkerAccountNumber: r.accountNumber,
        PaymentDetails: `${r.name} | ${paymentDetails || ''}`,
        BankName: bankName,
        DrawerAccountNumber: drawerAccountNo,
        PaymentTypeMethod: paymentTypeMethod,
        EbankReferenceNo: reference,
        Drawer: insuranceProviderName,
        OWCAccountNumber: selectedOwcObj?.acct,
        Employer: selectedEmployer?.OrganizationName,
        PaymentManagerReviewStatus: 'Pending',
        BatchNo: '0',
        Recipients: r.name, // ✅ Only the recipient name
        OWCInvestmentAccountNumber: owcInvestmentAccountNumber
      }));

      const { error: insErr } = await supabase
        .from('bankaccountdepositmaster')
        .insert(rowsToInsert);

      if (insErr) throw insErr;

      setConfirmOpen(false);   // close summary modal
      handleClose();           // close whole modal if desired
    } catch (e) {
      console.error('Save failed:', e);
      // keep UI inline; no browser alert
    } finally {
      setSaving(false);
    }
  };

  return !open ? null : (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Payments Officer Review (Pending) — {formType}
              </h2>
              {resolvedIRN && <span className="text-sm text-gray-600">IRN: {resolvedIRN}</span>}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
              title="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-8 overflow-y-auto">
            {/* Section 1: Embedded Form (inline) */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">
                {formType === 'Death'
                  ? 'Form 124 — Death Claim Detail'
                  : 'Form 113 — Injury Claim Detail'}
              </h3>

              {resolvedIRN ? (
                formType === 'Death' ? (
                  <Form124View irn={resolvedIRN} variant="embedded" className="w-full" />
                ) : (
                  <Form113View irn={resolvedIRN} variant="embedded" className="w-full" />
                )
              ) : (
                <p className="text-gray-500">Claim details cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Section 2: Claim Decisions */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Claim Decisions</h3>
              {resolvedIRN ? (
                <ListClaimDecisions irn={Number(resolvedIRN)} />
              ) : (
                <p className="text-gray-500">Claim decisions cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Section 3: Compensation Breakup */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Compensation Breakup</h3>
              {resolvedIRN ? (
                <CompensationBreakupDetailsView IRN={resolvedIRN} IncidentType={formType} />
              ) : (
                <p className="text-gray-500">Compensation data cannot be loaded without a valid IRN.</p>
              )}
            </section>

            {/* Section 4: Actions (preview only) */}
            <section className="border rounded-lg p-4 bg-amber-50">
              {isInjury && (
                <p className="text-sm text-amber-800 mb-3">
                  <strong>Note:</strong> You can generate a preview of the Consent Of Award and
                  Certificate Of Award without the Commissioner&apos;s Signature. The final version will
                  be generated only after approval.
                </p>
              )}

              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span>Actions:</span>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handleDownloadConsent}
                  disabled={!resolvedIRN}
                >
                  Print Consent of Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintCertificateOfAward}
                  disabled={!resolvedIRN}
                >
                  Print Certificate of Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={async () => {
                    const mod = await import('../../utils/form6CPO_jspdf');
                    const fn =
                      (mod as any).printForm6 ||
                      (mod as any).generateForm6Pdf ||
                      (mod as any).default ||
                      (mod as any).print;
                    if (fn) await fn(resolvedIRN);
                  }}
                  disabled={!resolvedIRN}
                >
                  Print Form 6
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={async () => {
                    const mod = await import('../../utils/form18CPO_jspdf');
                    const fn =
                      (mod as any).printForm18 ||
                      (mod as any).generateForm18Pdf ||
                      (mod as any).default ||
                      (mod as any).print;
                    if (fn) await fn(resolvedIRN);
                  }}
                  disabled={!resolvedIRN}
                >
                  Print Form 18
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintCertificateOfClaimAward}
                  disabled={!resolvedIRN}
                >
                  Print Certificate Of Claim Award
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintPaymentChecklist}
                  disabled={!resolvedIRN}
                >
                  Print Payment Checklist
                </button>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
                  onClick={handlePrintBankConfirmation}
                  disabled={!resolvedIRN}
                >
                  Print Bank Confirmation Letter
                </button>
              </div>
            </section>

            {/* ---------------- Details of Payment Received ---------------- */}
            <section className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-primary">Details of Payment Received</h3>

              {/* Employer (auto-selected, read-only) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50"
                  value={selectedEmployer?.OrganizationName || ''}
                  placeholder="Employer will be auto-resolved from IRN"
                  disabled
                />
                {!selectedEmployer && (
                  <p className="text-xs text-red-600 mt-1">
                    Employer could not be resolved from the selected IRN.
                  </p>
                )}
              </div>

              {/* Insurance Provider (auto from employer, with sticky override) */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Provider
                  </label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      const next = !insuranceOverrideOpen;
                      setInsuranceOverrideOpen(next);
                    }}
                  >
                    {insuranceOverrideOpen ? 'Cancel Override' : 'Select Insurance Provider'}
                  </button>
                </div>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={insuranceProviderName ?? ''}
                  onChange={(e) => {
                    setInsuranceProviderName(e.target.value);
                    if (insuranceOverrideOpen) setInsuranceManuallyOverridden(true);
                  }}
                  disabled={!insuranceOverrideOpen}
                  placeholder="Insurance provider will appear here"
                />
                {insuranceOverrideOpen && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                    {insuranceList.length > 0 ? (
                      insuranceList.slice(0, 100).map((i: any) => (
                        <button
                          key={String(i.IPACODE ?? i.ipacode ?? i.id ?? Math.random())}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            const name =
                              i.InsuranceCompanyOrganizationName ??
                              i.insurancecompanyorganizationName ??
                              '';
                            setInsuranceProviderName(name);
                            setInsuranceManuallyOverridden(true);
                            setInsuranceOverrideOpen(false);
                          }}
                        >
                          {i.InsuranceCompanyOrganizationName ??
                            i.insurancecompanyorganizationName ??
                            '(no name)'}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No insurance providers found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bank + Drawer account */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Bank Name</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drawer Account No</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={drawerAccountNo}
                    onChange={(e) => setDrawerAccountNo(e.target.value)}
                    placeholder="e.g., 1234567890"
                  />
                </div>
              </div>

              {/* Payment method, reference */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type/Method</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paymentTypeMethod}
                    onChange={(e) => setPaymentTypeMethod(e.target.value)}
                    placeholder="e.g., EFT, Cheque, Cash"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g., Ebank Ref No"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid to OWC Account (Investment Account)</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50"
                  value={owcInvestmentAccountNumber}
                  placeholder="1000489310"
                  disabled
                />
              </div>

              {/* OWC Account */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">OWC Account No (Drawing Account)</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={selectedOwcAccount}
                  onChange={(e) => setSelectedOwcAccount(e.target.value)}
                >
                  <option value="">-- Select OWC Account --</option>
                  {owcAccounts.map((o, idx) => (
                    <option
                      key={`${o.OBANBankName}-${o.OBANBankAccountNumber}-${idx}`}
                      value={`${o.OBANBankName}|${o.OBANBankAccountNumber}`}
                    >
                      {o.OBANBankName} — {o.OBANBankAccountNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amounts */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Awarded Amount</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={awardedAmount}
                    onChange={(e) => setAwardedAmount(Number(e.target.value || 0))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-summed from claimcompensationworkerdetails for this IRN; you can adjust if needed.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Amount</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(Number(e.target.value || 0))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Final Payment Amount (Interest)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={finalPaymentAmount}
                    onChange={(e) => setFinalPaymentAmount(Number(e.target.value || 0))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid by Insurer/Employer</label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value || 0))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paid Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Details</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    placeholder="Additional info"
                  />
                </div>
              </div>

              {/* --- Divider before status & batch --- */}
              <hr className="my-6" />

              {/* NEW: Worker & Dependent Bank Details (Dynamic Split) */}
              <div className="mt-8 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-semibold text-gray-900">Payment Recipients & Bank Details</h4>
                  <div className={`text-sm font-medium ${Math.abs(totalSplitAmount - Number(amountPaid)) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    Total Allocated: K{totalSplitAmount.toLocaleString()} / K{Number(amountPaid).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-6">
                  {recipients.map((r, idx) => (
                    <div key={`${r.type}-${r.id}-${idx}`} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-primary uppercase">
                          {r.type === 'worker' ? 'Main Worker' : r.type === 'spouse' ? 'Spouse' : r.type === 'dependent' ? 'Dependent' : r.type === 'employer' ? 'Employer' : 'Insurance Provider'}
                        </span>
                        <input
                          className="text-sm font-medium text-gray-700 border-none bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary rounded px-2 py-1 transition-colors"
                          value={r.name}
                          onChange={(e) => updateRecipient(idx, { name: e.target.value })}
                        />
                      </div>

                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name</label>
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                            value={r.bankName}
                            onChange={(e) => updateRecipient(idx, { bankName: e.target.value })}
                          >
                            <option value="">-- Select --</option>
                            {BANK_OPTIONS.map((b) => (
                              <option key={`bank-${idx}-${b}`} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">BSB / Branch</label>
                          {bsbOtherModes[idx] || (r.bsb && !BSP_BRANCHES.some(b => b.code === r.bsb)) ? (
                            <div className="flex gap-1">
                              <input
                                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                                value={r.bsb}
                                onChange={(e) => updateRecipient(idx, { bsb: e.target.value })}
                                placeholder="Enter BSB Code"
                                autoFocus
                              />
                              <button
                                type="button"
                                className="text-xs text-primary hover:underline px-1"
                                onClick={() => {
                                  setBsbOtherModes(prev => ({ ...prev, [idx]: false }));
                                  updateRecipient(idx, { bsb: '' });
                                }}
                              >
                                List
                              </button>
                            </div>
                          ) : (
                            <select
                              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                              value={r.bsb}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'Other') {
                                  setBsbOtherModes(prev => ({ ...prev, [idx]: true }));
                                  updateRecipient(idx, { bsb: '' });
                                } else {
                                  updateRecipient(idx, { bsb: val });
                                }
                              }}
                            >
                              <option value="">-- Select Branch --</option>
                              {BSP_BRANCHES.map((b, bidx) => (
                                <option key={`bsb-${idx}-${b.code}-${bidx}`} value={b.code}>
                                  {b.code} {b.name}
                                </option>
                              ))}
                              <option value="Other">Other (Type BSB Code)</option>
                            </select>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Account Number</label>
                          <input
                            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                            value={r.accountNumber}
                            onChange={(e) => updateRecipient(idx, { accountNumber: e.target.value })}
                            placeholder="1234567890"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Split Amount (Kina)</label>
                          <input
                            type="number"
                            className="w-full border rounded-md px-3 py-2 text-sm bg-white font-semibold"
                            value={r.amount}
                            onChange={(e) => updateRecipient(idx, { amount: Number(e.target.value || 0) })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {Math.abs(totalSplitAmount - Number(amountPaid)) > 0.01 && (
                  <p className="mt-2 text-xs text-red-500 italic">
                    * The total allocated amount must equal the Amount Paid before submitting.
                  </p>
                )}
              </div>

              {/* Hidden defaults & Submit */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  PaymentReviewStatus: <span className="font-medium">Pending</span> &nbsp;|&nbsp; Batch No:{' '}
                  <span className="font-medium">0</span>
                </div>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-md text-sm text-white ${Math.abs(totalSplitAmount - Number(amountPaid)) > 0.01 || !paidDate || !bankName
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary-dark'
                    }`}
                  onClick={openConfirm}
                >
                  Submit
                </button>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Confirm Payment Details</h3>

              <div className="space-y-2 text-sm">
                <div><span className="font-medium">IRN:</span> {resolvedIRN}</div>
                <div><span className="font-medium">Employer:</span> {selectedEmployer?.OrganizationName || '-'}</div>
                <div><span className="font-medium">Insurance Provider:</span> {insuranceProviderName || '-'}</div>
                <div><span className="font-medium">Bank:</span> {bankName || '-'}</div>
                <div><span className="font-medium">Drawer Account No:</span> {drawerAccountNo || '-'}</div>
                <div><span className="font-medium">Payment Type/Method:</span> {paymentTypeMethod || '-'}</div>
                <div><span className="font-medium">Reference:</span> {reference || '-'}</div>
                <div><span className="font-medium">Paid to OWC Account (Investment Account):</span> {owcInvestmentAccountNumber}</div>
                <div>
                  <span className="font-medium">OWC Account No (Drawing Account):</span>{' '}
                  {selectedOwcObj ? `${selectedOwcObj.bank} — ${selectedOwcObj.acct}` : '-'}
                </div>
                <div><span className="font-medium">Awarded Amount:</span> {awardedAmount.toLocaleString()}</div>
                <div><span className="font-medium">Interest Amount:</span> {Number(interestAmount || 0).toLocaleString()}</div>
                <div><span className="font-medium">Final Payment Amount:</span> {Number(finalPaymentAmount || 0).toLocaleString()}</div>
                <div><span className="font-medium">Amount Paid by Insurer/Employer:</span> {Number(amountPaid || 0).toLocaleString()}</div>
                <div><span className="font-medium">Paid Date:</span> {paidDate || '-'}</div>
                <div><span className="font-medium">Payment Details:</span> {paymentDetails || '-'}</div>

                {/* NEW: dynamic recipients in confirm */}
                <hr className="my-3" />
                <div className="font-medium text-gray-900 mb-2">Payment Breakdown</div>
                <div className="space-y-1">
                  {recipients.filter(r => r.amount > 0).map((r, i) => (
                    <div key={i} className="text-xs border-b pb-1">
                      <div className="flex justify-between font-medium">
                        <span>{r.name} ({r.type})</span>
                        <span>K{r.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-gray-500">
                        {r.bankName} | BSB: {r.bsb} | Acct: {r.accountNumber}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-sm pt-1">
                    <span>Total Allocated</span>
                    <span>K{totalSplitAmount.toLocaleString()}</span>
                  </div>
                </div>

                <hr className="my-3" />
                <div><span className="font-medium">Payment Review Status:</span> Pending</div>
                <div><span className="font-medium">Batch No:</span> 0</div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                  onClick={() => setConfirmOpen(false)}
                  disabled={saving}
                >
                  Back
                </button>
                <button
                  type="button"                                                // <-- keeps this from submitting any parent form
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md text-sm disabled:opacity-50"
                  onClick={handleProceedSave}                                   // <-- shows Saving… while async runs
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-xl font-bold italic">Validation Error</h3>
              </div>
              <p className="text-gray-700 mb-6 font-medium">{errorModalMessage}</p>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-bold uppercase tracking-wide transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingClaimsAwardedForPaymentSectionReview;
