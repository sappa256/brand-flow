const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse environment variables
const envStr = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const url = envStr.match(/VITE_SUPABASE_URL=\"([^\"]+)\"/)[1];
const key = envStr.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"([^\"]+)\"/)[1];
const supabase = createClient(url, key);

async function run() {
  console.log('Signing up admin@montazmedias.com on:', url);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'admin@montazmedias.com',
    password: 'M0ntaz_Crm_Secure_99!',
    options: {
      data: { full_name: 'Super Admin' }
    }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('User is already registered in auth.users.');
    } else {
      console.error('SignUp Error:', authError.message);
      process.exit(1);
    }
  }

  // Retrieve user (either newly created or existing)
  let user = authData.user;
  if (!user) {
    // Attempt sign in to get the user ID if already signed up
    console.log('Attempting login to retrieve existing user...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'admin@montazmedias.com',
      password: 'M0ntaz_Crm_Secure_99!'
    });
    if (loginError) {
      console.error('Failed to authenticate or fetch user:', loginError.message);
      process.exit(1);
    }
    user = loginData.user;
  }

  console.log('User ID resolved:', user.id);

  console.log('Checking if organization exists...');
  const { data: existingOrgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'montaz-medias')
    .maybeSingle();

  let orgId;
  if (existingOrgs) {
    orgId = existingOrgs.id;
    console.log('Organization already exists with ID:', orgId);
  } else {
    console.log('Creating organization...');
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Montaz Medias',
        slug: 'montaz-medias',
        owner_id: user.id,
        branding: { theme: 'dark', logoUrl: null },
        timezone: 'Asia/Kolkata',
        billing_settings: { plan: 'free', status: 'trial', stripeCustomerId: null },
        ai_settings: { provider: 'gemini', model: 'gemini-1.5-flash', customUrl: null }
      })
      .select()
      .single();

    if (orgError) {
      console.error('Organization Error:', orgError.message);
      process.exit(1);
    }
    orgId = orgData.id;
    console.log('Organization created with ID:', orgId);
  }

  console.log('Checking if organization membership exists...');
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMember) {
    console.log('Membership already exists.');
  } else {
    console.log('Adding user as admin member...');
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: user.id,
        role: 'admin'
      });

    if (memberError) {
      console.error('Membership Error:', memberError.message);
      process.exit(1);
    }
    console.log('Membership added successfully!');
  }

  console.log('================================================');
  console.log('SUCCESS: Admin account is fully configured!');
  console.log('================================================');
  process.exit(0);
}

run();
