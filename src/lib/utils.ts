export function getBaseUrl(request?: Request): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (request) {
    const host = request.headers.get('host');
    if (host) {
      // Remove port number if present
      const cleanHost = host.split(':')[0];
      return `http://${cleanHost}`;
    }
  }

  return 'http://localhost:3000';
} 