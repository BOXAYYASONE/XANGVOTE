import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as publicController from '../controllers/publicController.js';

export default function singersRoutes(pool) {
  const router = Router();

  router.get('/', publicController.getSingers(pool));
  router.post(
    '/:id/vote',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many vote attempts. Please try again later.' }
    }),
    publicController.voteForSinger(pool)
  );

  return router;
}
