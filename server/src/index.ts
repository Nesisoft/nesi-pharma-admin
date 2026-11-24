import app from './app';
import config from './config';
import { signingKey } from './utils/licenceToken';

// A LICENSE_SIGNING_KEY that is set but can't be read: refuse to start rather
// than answer every licence check without a signed licence
try {
  const key = signingKey();
  if (key) console.log(`Licence signing key ${key.kid} loaded`);
} catch (error) {
  console.error('LICENSE_SIGNING_KEY is not a usable Ed25519 private key:', (error as Error).message);
  process.exit(1);
}

// Start server (for local development only - not used in Vercel serverless)
const server = app.listen(config.port, () => {
  console.log(`
🚀 NesiPharma Admin API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: ${config.nodeEnv}
🌐 Server running on port ${config.port}
📝 API docs: http://localhost:${config.port}/api
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

export default app;
