const CACHE_NAME = 'adarshini-v1'
const STATIC_ASSETS = ['/', '/orders', '/profile']

// ── Install: cache static pages ────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
})

// ── Activate: clean old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network first, fallback to cache ────────────────────────────────
self.addEventListener('fetch', event => {
  // Only cache GET requests, skip API calls
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// ── Push: show notification when app is closed ─────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let payload
  try { payload = event.data.json() }
  catch { payload = { title: 'Adarshini Farm', body: event.data.text() } }

  const options = {
    body:    payload.body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    tag:     payload.tag || 'adarshini-notif',
    data:    { url: payload.url || '/' },
    vibrate: [200, 100, 200],
    actions: payload.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Adarshini Farm', options)
  )
})

// ── Notification click: open/focus the app ─────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
