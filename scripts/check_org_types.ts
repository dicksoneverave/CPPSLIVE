import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('tribunalhearingoutcome')
    .select('THOOrganizationType')
    .limit(10);
  
  if (error) {
    console.error(error);
  } else {
    console.log('Sample Data:', JSON.stringify(data));
  }
}

check();
