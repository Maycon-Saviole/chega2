// Service Worker para PWA
const CACHE_NAME = 'chega-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/emergency.html',
  '/trip.html',
  '/contacts.html',
  '/community.html',
  '/about.html',
  '/settings.html',
  '/history.html',
  '/css/styles.css',
  '/css/emergency.css',
  '/js/app.js',
  '/js/emergency.js',
  '/js/trip.js',
  '/icons/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});