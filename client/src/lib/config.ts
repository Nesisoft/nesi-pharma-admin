// The API's base URL. On the website it is /api on the same site: Vercel forwards
// pharma.nesisoft.com/api/* to the server on Render (client/vercel.json), and the
// Vite dev server proxies it to localhost:5000. VITE_API_URL overrides it.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// The admin app lives under /admin; the landing page is at /
export const ADMIN_BASE = '/admin';
