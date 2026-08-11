const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    if (tenant) {
        const { data: products } = await supabase.from('products').select('*').eq('tenant_id', tenant.id);
        console.log("Products:", products);
    }
}
test();
