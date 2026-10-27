// サービスワーカー（＝電波がなくてもアプリを開けるよう、画面のファイルを iPhone に取っておく仕組み）。
// 取っておいた版をすぐ表示し、裏で最新版を取りに行く。更新は「次に開いたとき」に反映される。
// 同じ住所（qorigame256.github.io）にはほかのアプリも同居し、取っておく場所を共有している。
// 消すのも横取りするのも、名前が yoteicho- で始まるもの・/yoteicho/ の下だけに限る（ほかのアプリの圏外用を消さないため）。
const PREFIX = "yoteicho-";
const CACHE = PREFIX + "v5";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "cal.js",
  "store.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.registration.scope)) return;
  const cache = caches.open(CACHE);
  const fresh = cache.then((c) => fetch(e.request).then(async (res) => {
    if (res.ok) await c.put(e.request, res.clone());
    return res;
  }));
  // 取っておいた版を先に返したあとも、最新版を取り終えて取っておくまで止めないでもらう
  // （待たせないと、裏の取り込みの途中で止められ、次に開いたときも古い版のままになることがある）
  e.waitUntil(fresh.catch(() => {}));
  e.respondWith(cache.then((c) => c.match(e.request, { ignoreSearch: true })).then((cached) => cached || fresh));
});
