const jwt = require('jsonwebtoken');
const config = require('../config');

const setupSocket = (io) => {
  // Socket.io authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.userId;
      socket.tenantId = decoded.tenantId;
      socket.role = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (tenant: ${socket.tenantId})`);

    // Join tenant-specific room for data isolation
    socket.join(`tenant:${socket.tenantId}`);

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });

    // Allow clients to subscribe to specific variant updates
    socket.on('watch:variant', (variantId) => {
      socket.join(`variant:${variantId}`);
    });

    socket.on('unwatch:variant', (variantId) => {
      socket.leave(`variant:${variantId}`);
    });
  });

  return io;
};

module.exports = setupSocket;
