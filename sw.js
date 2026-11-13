/* 静态离线缓存：版本变更时修改CACHE；仅缓存本站应用资源，不缓存外链内容。 */
const CACHE='shixu-static-v1.2.0-r3';
const FILES=['./','./index.html','./css/style.css','./js/core.js','./js/app.js','./data/history.js','./data/review.js','./data/questions.js','./data/exams.js','./assets/favicon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('shixu-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const requestUrl=new URL(event.request.url);
  requestUrl.hash='';
  if(!FILES.some(path=>new URL(path,self.registration.scope).href===requestUrl.href))return;
  // 同一版本的静态资源优先使用完整安装缓存，避免逐文件网络更新混用不同数据结构。
  // 每次发布必须升级CACHE名称；新worker完整安装后接管，下一次刷新加载新版本。
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(requestUrl.href).then(cached=>cached||fetch(event.request))));
});
