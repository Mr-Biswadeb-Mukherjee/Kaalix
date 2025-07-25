// server.js

import express from 'express';
import cors from 'cors';
import sessionManager from './Utils/Session.js';
import statsRoutes from './Modules/stats.js';

const app = express();
const PORT = process.env.PORT || 6000;

app.use(cors());
app.use(express.json());

// 🔐 Middleware to inject dynamic session key
app.use((req, res, next) => {
  const key = sessionManager.getSessionKey();
  req.sessionKey = key;
  app.locals.sessionKey = key;
  next();
});

// Routes
app.use(statsRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
