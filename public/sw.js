// Minimal service worker — exists ONLY to satisfy "installable PWA" criteria
// (the "Add to Home Screen" / install prompt that most mobile browsers gate
// behind having a registered service worker). It deliberately does NOT
// intercept network requests — there's no "fetch" listener below — so it can
// never serve stale data or a stale JS bundle after a new deploy. Every
// request still goes straight to the network exactly as if this file didn't
// exist. Real offline support (caching the app shell, etc.) would be a
// deliberate follow-up, not something to add quietly here where it could
// bite a live CRM whose data changes constantly.
self.addEventListener("install", () => {
    self.skipWaiting();
  });
  
  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });