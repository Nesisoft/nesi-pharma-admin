import app from './app';
import config from './config';

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
