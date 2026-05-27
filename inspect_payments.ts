import { createClient } from '@supabase/supabase-client';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('--- Approved View ---');
  const { data: viewData, error: viewErr } = await supabase
    .from('approved_awarded_claims_paymentsmanagerreview_view')
    .select('*')
    .limit(5);
  console.log(JSON.stringify(viewData, null, 2));

  if (viewData && viewData.length > 0) {
    const irn = viewData[0].IRN;
    console.log(`\n--- Deposits for IRN ${irn} ---`);
    const { data: depData, error: depErr } = await supabase
      .from('bankaccountdepositmaster')
      .select('*')
      .eq('IRN', irn);
    console.log(JSON.stringify(depData, null, 2));
  }
}

inspect();
