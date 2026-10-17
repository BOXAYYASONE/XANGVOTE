export function frontendCors(frontendOrigin) {
  return (request, response, next) => {
    const requestOrigin = request.get('Origin');
    const isAllowedOrigin = Boolean(frontendOrigin && requestOrigin === frontendOrigin);

    if (isAllowedOrigin) {
      response.setHeader('Access-Control-Allow-Origin', frontendOrigin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
    }

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin) {
        response.status(403).json({ error: 'Origin not allowed' });
        return;
      }

      response.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.sendStatus(204);
      return;
    }

    next();
  };
}
