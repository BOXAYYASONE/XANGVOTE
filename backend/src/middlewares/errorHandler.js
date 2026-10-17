import { ApiError } from './errors.js';

export function notFoundHandler(_request, response) {
  response.status(404).json({ error: 'Resource not found' });
}

export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) {
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: 'Uploaded image must not exceed 5 MB' });
    return;
  }

  if (error.code?.startsWith('LIMIT_')) {
    response.status(400).json({ error: 'Invalid file upload' });
    return;
  }

  if (error.status === 400 && error.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'Invalid JSON request body' });
    return;
  }

  response.status(500).json({ error: 'Internal server error' });
}
