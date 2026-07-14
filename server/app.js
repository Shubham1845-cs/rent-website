require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const listingsRouter = require('./routes/listings');
const profileRouter = require('./routes/profile');
const interestRouter = require('./routes/interest');
const chatRouter = require('./routes/chat');
const adminRouter = require('./routes/admin');

const app = express();

// CORS must be first so all REST routes and the Socket.io upgrade are covered
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/interest', interestRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', details: {} });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    details: err.details || {},
  });
});

module.exports = app;
