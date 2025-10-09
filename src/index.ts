import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Environment } from './types';
import telegramRoutes from './routes/telegram';
import apiRoutes from './routes/api';

const app = new Hono<{ Bindings: Environment }>();

// Enable CORS
app.use('*', cors());

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Telegram Membership Bot API',
    version: '1.0.0'
  });
});

// Mount routes
app.route('/telegram', telegramRoutes);
app.route('/api', apiRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
