const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header', code: 'AUTH_MISSING_HEADER' });
    }

    if (!supabase) {
      console.error('[authMiddleware] Supabase client is not configured');
      return res.status(503).json({ error: 'Authentication service temporarily unavailable', code: 'AUTH_SERVICE_UNAVAILABLE' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Invalid Authorization header format', code: 'AUTH_INVALID_TOKEN_FORMAT' });
    }

    const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'AUTH_INVALID_TOKEN' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[authMiddleware] Unexpected authentication error:', error);
    return res.status(500).json({ error: 'Internal authentication error', code: 'AUTH_INTERNAL_ERROR' });
  }
};

module.exports = authMiddleware;
