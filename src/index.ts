import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Environment } from './types';
import telegramRoutes from './routes/telegram';
import apiRoutes from './routes/api';
import testingRoutes from './routes/testing';
import { taskRoutes } from './routes/task-follower/task';
import { taskSheetRoutes } from './routes/task-follower/sheet';

const app = new Hono<{ Bindings: Environment }>();

// Enable CORS
app.use('*', cors());

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Telegram Membership Bot API with Task Management',
    version: '1.1.0',
    features: [
      'Telegram Bot Integration',
      'Membership Management from Member Google Sheets',
      'Task Management from Task Google Sheets',
      'Automated Task Notifications',
      'Sheet Registration and Management',
      'Scheduled Task Checking'
    ]
  });
});

// Mount routes ----------------
// V1 API routes - including Member Google Sheets routes
app.route('/telegram', telegramRoutes);
app.route('/api', apiRoutes);
app.route('/api/testing', testingRoutes);

// Member Google Sheets routes
app.route('/api/tasks', taskRoutes);
app.route('/api/task-sheets', taskSheetRoutes);

// 404 handler ----------------------
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

import scheduler from './services/task-follower/scheduler';

export default {
  fetch: app.fetch,
  scheduled: scheduler.scheduled
};
