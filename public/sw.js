const CACHE_NAME = 'cache-v97';
const UPLOAD_PERMANENT_CACHE_NAME = 'upload-cache';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME && cacheName !== UPLOAD_PERMANENT_CACHE_NAME)
                    .map(cacheName => {
                        return caches.open(cacheName).then(cache => {
                            return cache.keys().then(keys => {
                                return Promise.all(
                                    keys.map(request => {
                                        if ((request.url.includes('/api/post') || request.url.includes('/api/question') || request.url.includes('/api/print')) && request.method === 'GET') {
                                            return caches.open(CACHE_NAME).then(async newCache => {
                                                return newCache.put(request, (await cache.match(request)).clone()).then(() => {
                                                    return cache.delete(request);
                                                });
                                            });
                                        } else return cache.delete(request);
                                    })
                                ).finally(() => {
                                    return caches.delete(cacheName)
                                });
                            });
                        });
                    })
            );
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            cache.addAll([
                '/',
                '/login/id',
                '/login/password',
                '/register',
                '/register/password',
                '/register/passkey',
                '/write',
                '/question',
                '/question/write',
                '/print',
                '/print/write',
                '/account',
                '/account/edit',
                '/file.svg',
                '/close.svg',
                '/folder.svg',
                '/account.svg',
                '/back.svg',
                '/github.svg',
                '/offline.svg',
                '/login.svg',
                '/copy.svg',
                '/check.svg',
                '/icon1.png',
                '/icon2.png',
                '/icon3.png',
                '/icon4.png',
                '/icon5.png',
                '/apple-icon1.png',
                '/apple-icon2.png',
                '/favicon.ico',
                '/pushicon.png',
                '/PretendardVariable.woff2'
            ]);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        ((event.request.url.includes('/upload/') || event.request.url.includes('/image/')) && event.request.method === 'GET')
            ? caches.open(UPLOAD_PERMANENT_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    return (
                        response ||
                        fetch(event.request).then(response => {
                            if (response.ok) cache.put(event.request, response.clone());
                            return response;
                        })
                    );
                });
            }) : (
                (event.request.url.includes('/api')) ?
                    (
                        ((event.request.url.includes('/api/post') || event.request.url.includes('/api/question') || event.request.url.includes('/api/print')) && event.request.method === 'GET') ? (
                            fetch(event.request)
                                .then(response => {
                                    if (!response.ok) return response;
                                    return caches.open(CACHE_NAME).then(cache => {
                                        cache.put(event.request, response.clone());
                                        return response;
                                    });
                                })
                                .catch(() => {
                                    return caches.open(CACHE_NAME).then(cache => {
                                        return cache.match(event.request).then(response => {
                                            const newHeaders = new Headers(response.headers);
                                            newHeaders.append('X-Is-Cache', 'true');
                                            return new Response(response.body, {
                                                status: response.status,
                                                statusText: response.statusText,
                                                headers: newHeaders
                                            });
                                        }).catch(() => {
                                            return fetch(event.request);
                                        })
                                    });
                                })
                        ) : fetch(event.request)
                    ) : (event.request.url.includes('/unlock') ? fetch(event.request)
                        : caches.open(CACHE_NAME).then(async cache => {
                            const cacheResponse = await cache.match(event.request);
                            return (
                                cacheResponse ||
                                fetch(event.request).then(response => {
                                    if (response.ok) cache.put(event.request, response.clone());
                                    return response;
                                })
                            );
                        }))
            )
    );
});

self.addEventListener('push', event => {
    if (!(self.Notification && self.Notification.permission === "granted")) {
        return;
    }
    const body = event.data.json();
    body.forEach(data => {
        self.registration.showNotification(data.title, {
            body: data.body,
            tag: data.url,
            icon: '/icon3.png',
            badge: '/pushicon.png'
        });
    });
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    const urlToOpen = `${self.location.origin}/${event.notification.tag}`;
    event.waitUntil(
        self.clients.matchAll({
            type: "window"
        }).then(clientList => {
            if (clientList.length > 0) {
                return clientList[0].focus().then(client => client.navigate(urlToOpen));
            }
            return self.clients.openWindow(urlToOpen);
        })
    );
});
