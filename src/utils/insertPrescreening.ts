// src/utils/insertPrescreening.ts
import { supabase } from '../services/supabase';

export type PRForm = 'Form11' | 'Form12' | 'Form3' | 'Form4';

export async function recordPrescreening(
  irn: number,
  form: PRForm,
  status: 'Approved' | 'Pending'
) {
  const now = new Date().toISOString();
  const payload = {
    IRN: irn,
    PRFormType: form,
    PRStatus: status,
    PRSubmissionDate: now,
    PRDecisionDate: status === 'Approved' ? now : null,
    PRDecisionReason: status === 'Approved' ? 'Automatically Approved' : '',
  };

  const { data: exists } = await supabase
    .from('prescreeningreview')
    .select('PRID')
    .eq('IRN', irn)
    .eq('PRFormType', form)
    .limit(1);

  if (!exists?.length) {
    const { error } = await supabase.from('prescreeningreview').insert([payload]);
    if (error) throw error;
  }
}
