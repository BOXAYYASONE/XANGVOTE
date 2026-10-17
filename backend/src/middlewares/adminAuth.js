import jwt from 'jsonwebtoken';
import { ApiError } from './errors.js';

export const adminCookieName = 'admin_token';
const isProduction = process.env.NODE_ENV === 'production';
export const adminCookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  path: '/api/admin'
};

export function requireAdmin(jwtSecret = process.env.JWT_SECRET) {
  return (request, _response, next) => {
    const token = request.cookies?.[adminCookieName];
    if (!token || !jwtSecret) {
      next(new ApiError(401, 'Authentication required'));
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string') {
        throw new Error('Invalid admin token payload');
      }
      request.admin = { id: payload.sub, username: payload.username };
      next();
    } catch {
      next(new ApiError(401, 'Authentication required'));
    }
  };
}
