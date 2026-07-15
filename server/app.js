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
// Support CLIENT_URLS (comma-separated list) OR fallback to CLIENT_URL (single)
const rawOrigins = process.env.CLIENT_URLS || process.env.CLIENT_URL || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl / Postman / server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Handle preflight (OPTIONS) requests for all routes
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

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