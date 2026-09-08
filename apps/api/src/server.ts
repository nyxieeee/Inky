import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import documentsRouter from './routes/documents.js';
import inboxRouter from './routes/inbox.js';
import deliveryRouter from './routes/delivery.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file uploads directory
const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'E-Sign API Server', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/documents', documentsRouter);
app.use('/api/inbox', inboxRouter);
app.use('/api', deliveryRouter);

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 E-Sign API Server running on port ${PORT}`);
  console.log(`=================================`);
});

export default app;
