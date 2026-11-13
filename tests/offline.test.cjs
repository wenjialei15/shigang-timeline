/* 对Service Worker请求路由做独立回归，不依赖浏览器内部接口。 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function worker() {
  const handlers={},lookups=[];
  const context={URL,Promise,Error,self:{location:{origin:'http://localhost:4173'},registration:{scope:'http://localhost:4173/'},addEventListener:(name,handler)=>handlers[name]=handler},
    caches:{open:async()=>({match:async request=>{lookups.push(typeof request==='string'?request:request.url);return {cached:true};}})},fetch:async()=>{throw new Error('模拟断网');}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
  return {handlers,lookups};
}
test('带页面锚点的导航仍由离线缓存处理',async()=>{
  const w=worker();let response;
  w.handlers.fetch({request:{method:'GET',url:'http://localhost:4173/#timeline'},respondWith:p=>response=p});
  assert.ok(response,'页面锚点不应绕过缓存');assert.equal((await response).cached,true);assert.equal(w.lookups[0],'http://localhost:4173/');
});
test('专题复习脚本可离线加载，外链与写请求不被接管',async()=>{
  const w=worker();let response;
  w.handlers.fetch({request:{method:'GET',url:'http://localhost:4173/data/review.js'},respondWith:p=>response=p});
  assert.equal((await response).cached,true);
  for(const request of [{method:'GET',url:'https://example.com/'},{method:'POST',url:'http://localhost:4173/'}])w.handlers.fetch({request,respondWith:()=>assert.fail('不应接管外链或写请求')});
});
test('真题对应页面锚点和新索引脚本都在离线范围内',async()=>{
  const w=worker();
  for(const url of ['http://localhost:4173/#exams','http://localhost:4173/data/exams.js']){
    let response;w.handlers.fetch({request:{method:'GET',url},respondWith:p=>response=p});assert.ok(response);assert.equal((await response).cached,true);
  }
});
