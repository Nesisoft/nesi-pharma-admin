import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Parse CORS origins (supports comma-separated list)
const parseCorsOrigins = (origins: string | undefined): string | string[] => {
  if (!origins) return 'http://localhost:3300';

  // If it contains commas, split into array
  if (origins.includes(',')) {
    return origins.split(',').map(origin => origin.trim());
  }

  return origins;
};

export const config = {
  // Server
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // License
  license: {
    secretKey: process.env.LICENSE_SECRET_KEY || 'default-license-secret',
  },

  // CORS - supports single origin or comma-separated list
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // How many proxies sit in front of the server, so req.ip (rate limits, audit
  // logs) is the visitor's address: 1 on Render, 2 when Vercel forwards
  // pharma.nesisoft.com/api to Render. GET /api/health shows the result.
  trustProxy: Math.max(0, parseInt(process.env.TRUST_PROXY || '1', 10) || 0),
};

// Never run production on the placeholder JWT secrets above: anyone who has
// seen this code could sign their own admin tokens. (Changing them only signs
// admins out.)
if (config.isProduction) {
  const missing = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Refusing to start: set ${missing.join(' and ')} in the production environment`);
  }
  // Not fatal: changing this secret invalidates every licence key already
  // issued (activation checks the key checksum against it)
  if (!process.env.LICENSE_SECRET_KEY) {
    console.warn('WARNING: LICENSE_SECRET_KEY is not set; licence key checksums use the default secret');
  }
}

export default config;
