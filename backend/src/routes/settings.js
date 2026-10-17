import { Router } from 'express';
import * as publicController from '../controllers/publicController.js';

export default function settingsRoutes(pool) {
  const router = Router();
  router.get('/voting', publicController.getVotingStatus(pool));
  return router;
}
