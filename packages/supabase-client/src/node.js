const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Creates a Supabase client for Node.js backend use
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} supabaseKey - Supabase service role key
 * @returns {Object} Supabase client
 */
function createNodeClient(supabaseUrl, supabaseKey) {
  const url = supabaseUrl || process.env.SUPABASE_URL;
  const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[createNodeClient] Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }

  return createClient(url, key);
}

module.exports = { createNodeClient };
