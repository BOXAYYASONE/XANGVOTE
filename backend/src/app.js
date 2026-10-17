import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import adminRoutes from './routes/admin.js';
import singersRoutes from './routes/singers.js';
import settingsRoutes from './routes/settings.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { frontendCors } from './middlewares/frontendCors.js';

const uploadsDirectory = fileURLToPath(new URL('../uploads/', import.meta.url));

export function createApp(
  pool,
  frontendOrigin = process.env.FRONTEND_ORIGIN,
  adminOptions = {}
) {
  const app = express();

  app.use(helmet());
  app.use(frontendCors(frontendOrigin));
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    '/uploads',
    express.static(adminOptions.uploadsDirectory || uploadsDirectory, {
      dotfiles: 'deny',
      index: false,
      fallthrough: false
    })
  );
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api/singers', singersRoutes(pool));
  app.use('/api/settings', settingsRoutes(pool));
  app.use('/api/admin', adminRoutes(pool, adminOptions));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
