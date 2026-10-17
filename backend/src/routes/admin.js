import { Router } from 'express';
import { requireAdmin } from '../middlewares/adminAuth.js';
import { singerImageUpload } from '../middlewares/upload.js';
import * as adminController from '../controllers/adminController.js';
import { defaultUploadsDirectory } from '../services/adminService.js';

export default function adminRoutes(pool, options = {}) {
  const router = Router();
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET;
  const uploadsDirectory = options.uploadsDirectory ?? defaultUploadsDirectory;

  router.post('/login', adminController.login(pool, jwtSecret));
  router.use(requireAdmin(jwtSecret));

  router.post(
    '/singers',
    singerImageUpload.single('image'),
    adminController.createSinger(pool, uploadsDirectory)
  );
  router.put(
    '/singers/:id',
    singerImageUpload.single('image'),
    adminController.updateSinger(pool, uploadsDirectory)
  );
  router.delete('/singers/:id', adminController.deleteSinger(pool, uploadsDirectory));
  router.get('/results', adminController.getResults(pool));
  router.patch('/voting', adminController.updateVoting(pool));
  router.post('/logout', adminController.logout);

  return router;
}
