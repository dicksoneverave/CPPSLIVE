import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('--- fetching from approved_awarded_claims_paymentsmanagerreview_view ---');
  const { data: approved, error: e1 } = await supabase
    .from('approved_awarded_claims_paymentsmanagerreview_view')
    .select('IRN, DisplayIRN');
  
  if (e1) {
    console.error('Error fetching view:', e1);
  } else {
    console.log(`Found ${approved?.length || 0} claims in view.`);
    if (approved && approved.length > 0) {
      const irns = approved.map(r => r.IRN);
      console.log('View IRNs:', irns);

      console.log('\n--- fetching from bankaccountdepositmaster ---');
      const { data: deps, error: e2 } = await supabase
        .from('bankaccountdepositmaster')
        .select('BADMID, IRN, PaymentManagerReviewStatus')
        .in('IRN', irns);

      if (e2) {
        console.error('Error fetching deposits:', e2);
      } else {
        console.log(`Found ${deps?.length || 0} deposits for these IRNs.`);
        deps.forEach(d => {
          console.log(`BADMID: ${d.BADMID}, IRN: ${d.IRN}, Status: ${d.PaymentManagerReviewStatus}`);
        });
      }
    }
  }
}

debug();
