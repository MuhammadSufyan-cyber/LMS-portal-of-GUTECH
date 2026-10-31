import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { adminUsersRouter } from './routes/admin-users.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { coursesRouter } from './routes/courses.routes.js';
import { resourcesRouter } from './routes/resources.routes.js';
import { assessmentsRouter } from './routes/assessments.routes.js';
import { communicationRouter } from './routes/communication.routes.js';
import { complaintsRouter } from './routes/complaints.routes.js';
import { marksRouter } from './routes/marks.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { attendanceRouter } from './routes/attendance.routes.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
const allowedClientOrigins = new Set([env.CLIENT_ORIGIN]);
if (env.NODE_ENV !== 'production') {
  for (const port of [5173, 5174]) {
    allowedClientOrigins.add(`http://localhost:${port}`);
    allowedClientOrigins.add(`http://127.0.0.1:${port}`);
  }
}
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedClientOrigins.has(origin)),
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/csv', limit: '1mb' }));
app.use(
  pinoHttp({
    enabled: env.NODE_ENV !== 'test',
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
  }),
);
app.use(
  rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }),
);
app.get('/api/health', (_request, response) => response.json({ data: { status: 'ok' } }));
app.use('/api/auth', authRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api', coursesRouter);
app.use('/api', resourcesRouter);
app.use('/api', assessmentsRouter);
app.use('/api', communicationRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api', marksRouter);
app.use('/api', attendanceRouter);
app.use('/api', auditRouter);
app.use((_request, response) =>
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
);
app.use(errorHandler);
