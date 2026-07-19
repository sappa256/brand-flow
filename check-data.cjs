const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually
const envPath = path.join(__dirname, '.env');
let supabaseUrl = 'https://ywwvdfudibmxlcsvcqih.supabase.co';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const matchUrl = envContent.match(/VITE_SUPABASE_URL=["']?([^"'\s]+)["']?/);
  const matchKey = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\s]+)["']?/);
  if (matchUrl) supabaseUrl = matchUrl[1];
  if (matchKey) supabaseKey = matchKey[1];
} catch (e) {
  console.warn("Could not read .env file:", e.message);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseData() {
  try {
    console.log("Fetching proposals...");
    const { data: proposals, error: propErr } = await supabase
      .from('proposals')
      .select('*, lead:leads(*)');
      
    if (propErr) {
      console.error("Error fetching proposals:", propErr);
    } else {
      console.log(`Found ${proposals.length} proposals:`);
      proposals.forEach(p => {
        console.log(`- ID: ${p.id}, Client: "${p.client_name}", Status: "${p.status}", Plan: "${p.plan_type}", Fee: ${p.monthly_fee}, Duration: ${p.contract_duration_months}`);
        console.log(`  Sent Date: ${p.sent_date}, Accepted Date: ${p.accepted_date}`);
      });
    }

    console.log("\nFetching contracts...");
    const { data: contracts, error: contrErr } = await supabase
      .from('contracts')
      .select('*, client:clients(*)');
      
    if (contrErr) {
      console.error("Error fetching contracts:", contrErr);
    } else {
      console.log(`Found ${contracts.length} contracts:`);
      contracts.forEach(c => {
        console.log(`- ID: ${c.id}, Client: "${c.client?.client_name}", Retainer: ${c.monthly_retainer}, Duration: ${c.duration_months}`);
        console.log(`  Start Date: ${c.start_date}, End Date: ${c.end_date}`);
      });
    }
  } catch (err) {
    console.error("Database query failed:", err);
  }
}

checkDatabaseData();
