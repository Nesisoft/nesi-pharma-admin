import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// Security middleware - configure for serverless
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration for public license endpoints (allow any origin)
// These endpoints are called by pharmacy client applications from various domains
const publicCorsOptions: cors.CorsOptions = {
  origin: '*', // Allow any origin for public endpoints
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-License-Key', 'X-Device-Id'],
};

// CORS configuration for admin routes (restricted to admin frontend origin)
const adminCorsOptions: cors.CorsOptions = {
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Handle preflight requests explicitly for all routes
app.options('*', (req, res, next) => {
  if (req.path.startsWith('/api/public')) {
    return cors(publicCorsOptions)(req, res, next);
  }
  return cors(adminCorsOptions)(req, res, next);
});

// Apply CORS based on route - public routes get permissive CORS, admin routes get restricted
app.use((req, res, next) => {
  if (req.path.startsWith('/api/public')) {
    return cors(publicCorsOptions)(req, res, next);
  }
  return cors(adminCorsOptions)(req, res, next);
});

// Rate limiting - skip in serverless as Vercel handles this
if (!process.env.VERCEL) {
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      error: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', limiter);

  const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: {
      success: false,
      error: 'Too many verification requests, please try again later.',
    },
  });

  app.use('/api/public', publicLimiter);
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging - skip in production serverless
if (config.nodeEnv !== 'test' && !process.env.VERCEL) {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// Trust proxy (for rate limiting behind reverse proxy): TRUST_PROXY hops
app.set('trust proxy', config.trustProxy);

// Health check endpoint. `ip` is the caller's address as the server sees it:
// if it isn't your own public IP, TRUST_PROXY doesn't match the proxies in front.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), ip: req.ip });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
