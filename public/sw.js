const CACHE_NAME = "minima-0.9.2-beta.1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles/main.css",
  "./src/main.js",
  "./src/config/constants.js",
  "./src/core/deck.js",
  "./src/core/rules.js",
  "./src/game/bot.js",
  "./src/game/match.js",
  "./src/game/persistence.js",
  "./src/rendering/cardArt.js",
  "./src/rendering/tableRenderer.js",
  "./src/ui/domUi.js",
  "./src/ui/feedback.js",
  "./src/ui/tutorial.js",
  "./assets/app-icon.svg",
  "./assets/app-icon-180.png",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./assets/cards/back.webp",
  "./assets/cards/faces.webp",
  "./assets/cards/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
