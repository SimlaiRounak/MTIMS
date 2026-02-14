const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config');
const setupSocket = require('./socket');

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Create HTTP server
  const server = http.createServer(app);

  // Setup Socket.io
  const allowedOrigins = config.clientUrl
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setupSocket(io);

  // Make io accessible in routes
  app.set('io', io);

  // Start listening
  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    console.log(`Client URL: ${config.clientUrl}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down...');
    server.close(() => process.exit(0));
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
