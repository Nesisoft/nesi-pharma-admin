// Settings for the Adurofie PMS landing page (pharma.nesisoft.com)

export const PRODUCT_NAME = 'Adurofie PMS';
export const COMPANY = { name: 'Nesisoft', website: 'https://nesisoft.com' };

// The public GitHub repository holding the Windows installers (the desktop app's
// electron-builder publishes its releases there; the code itself stays private).
// The Download button always offers the newest published release.
export const RELEASES_REPO = 'Nesisoft/adurofie-pms-releases';

// How customers reach you to buy a licence key. With an email set, "Get a licence
// key" opens an email to it; otherwise it opens the website.
export const CONTACT = {
  email: '',
  website: COMPANY.website,
};

// The plan features the desktop app implements: keep in sync with APP_FEATURE_KEYS in
// ../nesi-pharma/src/config/features.js. The plans section lists only these (plus
// support features), not catalogue entries the app doesn't have yet.
export const APP_FEATURE_KEYS = new Set([
  'customers',
  'prescriptions',
  'suppliers',
  'barcodeScanning',
  'multiUser',
  'advancedReporting',
  'stockAdjustments',
  'auditLog',
  'notifications',
  'cartHolding',
  'cashReconciliation',
  'expiryAlerts',
  'lowStockAlerts',
  'purchaseOrders',
  'goodsReceiving',
  'supplierInvoicing',
  'dashboardAnalytics',
  'salesRefund',
  'fefoRecommendations',
  'inventoryReports',
  'periodComparison',
  'salesAnalytics',
  'backupRestore',
]);
