import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { ADMIN_BASE } from './lib/config';
import './index.css';

// One site, two apps: the Adurofie PMS landing page at / and the admin dashboard
// under /admin. Each loads only its own code.
const path = window.location.pathname;
const isAdmin = path === ADMIN_BASE || path.startsWith(`${ADMIN_BASE}/`);
const Page = isAdmin ? lazy(() => import('./AdminApp')) : lazy(() => import('./landing/LandingPage'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Page />
    </Suspense>
  </React.StrictMode>
);
