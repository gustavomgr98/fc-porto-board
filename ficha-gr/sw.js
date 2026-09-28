// Service Worker — cache-first, para a Ficha de Observação GR funcionar 100% offline
// depois de aberta uma primeira vez.
var CACHE_NAME = "ficha-gr-fcportow-20260928230900";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // "reload" ignora a cache HTTP do browser, para garantir que os ficheiros
      // guardados nesta nova versão são mesmo os mais recentes do servidor.
      return Promise.all(ASSETS.map(function(url){
        return fetch(url, { cache: "reload" }).then(function(resp){
          return cache.put(url, resp);
        });
      }));
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function(cached){
      if(cached) return cached;
      return fetch(event.request).then(function(resp){
        var respClone = resp.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, respClone); });
        return resp;
      }).catch(function(){
        return caches.match("./index.html");
      });
    })
  );
});
