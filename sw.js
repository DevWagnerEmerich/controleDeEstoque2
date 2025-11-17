// Define o nome do cache
const CACHE_NAME = 'stockcontrol-pro-cache-v1';

// Lista de arquivos a serem cacheados
const urlsToCache = [
  '/',
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/modal_styles.css',
  'js/main.js',
  'js/events.js',
  'js/ui.js',
  'js/database.js',
  'js/auth.js',
  'js/operations.js',
  'js/reports.js',
  'js/invoice.js',
  'js/packing_list.js',
  'js/import.js',
  'images/alibras-logo.png',
  'images/estoque.png',
  'images/loia-logo.png'
];

// Evento de instalação: abre o cache e adiciona os arquivos da lista
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de fetch: intercepta as requisições
self.addEventListener('fetch', event => {
  event.respondWith(
    // Tenta encontrar a requisição no cache
    caches.match(event.request)
      .then(response => {
        // Se encontrar no cache, retorna a resposta do cache
        if (response) {
          return response;
        }
        // Se não encontrar, faz a requisição à rede
        return fetch(event.request);
      })
  );
});

// Evento de ativação: limpa caches antigos
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
