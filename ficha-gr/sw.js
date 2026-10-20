// Service Worker — cache-first, para a Ficha de Observação GR funcionar 100% offline
// depois de aberta uma primeira vez.
var CACHE_NAME = "ficha-gr-fcportow-20261020130000";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-512.png",
  "./jszip.min.js",
  "./docx-export.js",
  "./modelo.docx",
  "./atletas/atletas.json",
  "./estadios/estadios.json",
  "./estadios/ad-marco-09.jpg",
  "./estadios/albino-d-pinheiro.jpg",
  "./estadios/amarante-fc.jpg",
  "./estadios/at-rio-tinto.jpg",
  "./estadios/beira-mar.jpg",
  "./estadios/campo-sao-claudio-famalicao.jpg",
  "./estadios/campo-sintetico-do-viso.jpg",
  "./estadios/cd-campanha.jpg",
  "./estadios/cd-feirense.jpg",
  "./estadios/cd-sc-braga.jpg",
  "./estadios/cdup.jpg",
  "./estadios/cr-ataense.jpg",
  "./estadios/crestuma.jpg",
  "./estadios/e-fanzeres.jpg",
  "./estadios/estoril-praia.jpg",
  "./estadios/fc-foz.jpg",
  "./estadios/folgosa.jpg",
  "./estadios/freamunde.jpg",
  "./estadios/gandra.jpg",
  "./estadios/gatoes.jpg",
  "./estadios/gens-sc.jpg",
  "./estadios/gondomar.jpg",
  "./estadios/l-valboenses.jpg",
  "./estadios/leixoes-sc.jpg",
  "./estadios/leca-fc.jpg",
  "./estadios/new-balance-park.jpg",
  "./estadios/olival.jpg",
  "./estadios/oliveira-douro.jpg",
  "./estadios/outeiro.jpg",
  "./estadios/parque-da-cidade.jpg",
  "./estadios/pasteleira.jpg",
  "./estadios/pacos-ferreira.jpg",
  "./estadios/pedroso.jpg",
  "./estadios/ramaldense.jpg",
  "./estadios/retorta-rio-ave.jpg",
  "./estadios/rio-ave-ct.jpg",
  "./estadios/romariz.jpg",
  "./estadios/sc-rio-tinto.jpg",
  "./estadios/sousense.jpg",
  "./estadios/sao-romao.jpg",
  "./estadios/umaia.jpg",
  "./estadios/valadares.jpg",
  "./estadios/vila-mea.jpg",
  "./estadios/aguas-santas.jpg",
  "./atletas/atleta-1.jpg",
  "./atletas/atleta-2.jpg",
  "./atletas/atleta-3.jpg",
  "./atletas/atleta-4.jpg",
  "./atletas/atleta-5.jpg",
  "./atletas/atleta-6.jpg",
  "./atletas/atleta-7.jpg",
  "./atletas/atleta-8.jpg"
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
