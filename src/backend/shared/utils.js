const crypto = require('crypto');

/**
 * Calculates live occupancy for a given tenant within the auto-checkout window.
 * @param {Object} supabaseClient - Configured Supabase client
 * @param {string} tenantId - Tenant UUID
 * @param {number} [autoCheckoutMinutes=120] - Time window in minutes
 * @returns {Promise<number>} - Active occupancy count
 */
async function getLiveOccupancy(supabaseClient, tenantId, autoCheckoutMinutes = 120) {
  if (!supabaseClient || !tenantId) return 0;
  try {
    const windowStart = new Date(Date.now() - autoCheckoutMinutes * 60 * 1000).toISOString();
    const { count, error } = await supabaseClient
      .from('check_ins')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'warning'])
      .is('checkout_at', null)
      .gte('created_at', windowStart);

    if (error) {
      console.error('[getLiveOccupancy] error:', error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.error('[getLiveOccupancy] exception:', err);
    return 0;
  }
}

/**
 * Validates whether a user belongs to a tenant and optionally possesses allowed roles.
 * @param {Object} supabaseClient - Configured Supabase client
 * @param {string} userId - User profile UUID (req.user.id)
 * @param {string} tenantId - Target tenant UUID
 * @param {string[]} [allowedRoles] - Optional list of allowed roles (e.g. ['admin', 'manager', 'staff'])
 * @returns {Promise<{authorized: boolean, profile?: Object, error?: string, status?: number}>}
 */
async function validateTenantAccess(supabaseClient, userId, tenantId, allowedRoles = null) {
  if (!supabaseClient) {
    return { authorized: false, error: 'Supabase client not configured', status: 500 };
  }
  if (!userId) {
    return { authorized: false, error: 'Unauthenticated user', status: 401 };
  }
  if (!tenantId) {
    return { authorized: false, error: 'Missing tenant_id parameter', status: 400 };
  }

  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('id, tenant_id, role, first_name, last_name')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return { authorized: false, error: 'User profile not found', status: 404 };
    }

    if (profile.tenant_id !== tenantId && profile.role !== 'admin' && profile.role !== 'super_admin') {
      return { authorized: false, error: 'Unauthorized access to tenant', status: 403 };
    }

    if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!allowedRoles.includes(profile.role) && profile.role !== 'admin' && profile.role !== 'super_admin') {
        return {
          authorized: false,
          error: `Forbidden: requires one of roles [${allowedRoles.join(', ')}]`,
          status: 403
        };
      }
    }

    return { authorized: true, profile, role: profile.role };
  } catch (err) {
    console.error('[validateTenantAccess] error:', err);
    return { authorized: false, error: 'Internal tenant authorization error', status: 500 };
  }
}

/**
 * Verifies cryptographic HMAC signature for incoming webhooks.
 * @param {string|Object} body - Request body (string or parsed object)
 * @param {string} secret - Shared webhook secret
 * @param {string} signatureHeader - Received signature header
 * @param {string} [algorithm='sha256'] - Hash algorithm
 * @returns {boolean} - True if signature matches
 */
function verifyHmacSignature(body, secret, signatureHeader, algorithm = 'sha256') {
  if (!signatureHeader || !secret) return false;
  try {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    const cleanHeader = String(signatureHeader).replace(/^sha256=/, '').trim();

    const sigBuf = Buffer.from(cleanHeader, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (err) {
    console.error('[verifyHmacSignature] error:', err);
    return false;
  }
}

/**
 * Formats amount in Rwandan Francs (RWF).
 * @param {number|string} amount
 * @returns {string}
 */
function formatRWF(amount) {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('rw-RW', {
    style: 'currency',
    currency: 'RWF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Calculates distance in meters between two GPS coordinates using Haversine formula.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  getLiveOccupancy,
  validateTenantAccess,
  verifyHmacSignature,
  formatRWF,
  getDistanceFromLatLonInM,
};
