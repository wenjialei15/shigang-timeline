/* 检查已声明索引范围的完整性；不把程序断言冒充对外部原卷的官方审校。 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../js/core.js');
const context={window:{}};vm.createContext(context);
for(const name of ['history','questions','exams'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../data/'+name+'.js'),'utf8'),context);
const H=JSON.parse(JSON.stringify(context.window.HISTORY)),R=JSON.parse(JSON.stringify(context.window.EXAM_INDEX));
const defaults={year:'all',kind:'all',phase:'all',scope:'all',event:'all',query:''};
test('16年声明范围内124题无重号、漏号，题型符合原卷题号',()=>{
  assert.equal(R.records.length,124);assert.equal(R.manifest.length,16);
  assert.equal(new Set(R.records.map(x=>x.id)).size,124);
  for(let year=2010;year<=2025;year++){
    const expected=year<=2012?[9,10,26,27,28,29,36]:year===2013?[9,10,27,28,29,30,36]:year<=2023?[9,10,11,12,27,28,29,36]:[10,11,12,13,27,28,29,36];
    assert.deepEqual(R.records.filter(q=>q.year===year).map(q=>q.number),expected,String(year));
  }
  R.records.forEach(q=>assert.equal(q.kind,q.number<=16?'single':q.number<=33?'multiple':'analysis'));
});
test('每题和每小问均对应有效节点，不把考试后事件当作当年考点',()=>{
  const events=new Map(H.events.map(x=>[x.id,x]));
  R.records.forEach(q=>{
    assert.ok(q.eventIds.length,q.id);
    for(const id of q.eventIds){assert.ok(events.has(id),q.id+id);assert.ok(events.get(id).year<=q.year,q.id+'关联未来事件'+id);}
    q.parts.forEach(part=>{assert.ok(part.eventIds.length);assert.ok(part.eventIds.every(id=>q.eventIds.includes(id)));});
  });
  assert.equal(R.records.filter(q=>q.kind==='analysis').length,16);
  assert.ok(R.records.filter(q=>q.kind==='analysis').every(q=>q.parts.length===2));
});
test('每题都有可点击出处、定位信息和整理版状态，不伪装原题全文',()=>{
  R.records.forEach(q=>{
    assert.equal(q.hasFullText,false);assert.equal(q.status,'public-transcript');assert.ok(q.sources.length>=2);
    q.sources.forEach(source=>{assert.ok(C.httpUrl(source.url),source.url);assert.ok(source.name);assert.ok(source.locator);});
    assert.ok(q.sources[0].url.endsWith(q.kind==='analysis'?q.year+'-'+q.number:q.year+'/'+q.number));
  });
});
test('年份、题型、阶段、节点和关键词筛选可叠加',()=>{
  assert.equal(C.filterExamRefs(R.records,H.events,{...defaults,year:'2025'}).length,8);
  assert.equal(C.filterExamRefs(R.records,H.events,{...defaults,year:'2025',kind:'analysis'}).length,1);
  assert.equal(C.filterExamRefs(R.records,H.events,{...defaults,query:'2025-28'})[0].eventIds[0],'h078');
  const list=C.filterExamRefs(R.records,H.events,{...defaults,event:'h087'});assert.ok(list.length>=3);assert.ok(list.every(q=>q.eventIds.includes('h087')));
  assert.equal(C.filterExamRefs(R.records,H.events,{...defaults,query:'安源'})[0].year,2019);
  assert.equal(C.filterExamRefs(R.records,H.events,{...defaults,year:'2010',phase:'newera'}).length,0);
});
test('出处链接拒绝脚本、数据协议、凭据和无效网址',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,hi','https://user:password@example.com/','file:///C:/x','not a url',null])assert.equal(C.httpUrl(value),'');
  assert.ok(C.httpUrl('https://example.com/paper#page=7'));
});
test('旧题ID保持不变，真题索引不混入原创题和判分题库',()=>{
  const Q=context.window.QUESTION_BANK.questions;
  assert.equal(Q.length,98);assert.equal(Q.find(q=>q.id==='p001').eventIds[0],'h001');assert.ok(Q.find(q=>q.id==='p071').stem.includes('新时代'));
  assert.ok(Q.every(q=>q.origin==='original'));assert.ok(!Q.some(q=>/^r\d/.test(q.id)));
});
test('旧存档兼容，可选出处网址导入后保留且不接受危险协议',()=>{
  const q={id:'import-url-test',year:2025,number:'10',kind:'single',eventIds:['h001'],stem:'测试',options:['甲','乙'],answer:[0],explanation:'测试',source:'测试来源',rights:'测试权限',sourceUrl:'https://example.com/paper'};
  assert.equal(C.validateQuestions([q],H.events)[0].sourceUrl,'https://example.com/paper');
  assert.throws(()=>C.validateQuestions([{...q,sourceUrl:'javascript:alert(1)'}],H.events));
  assert.equal(C.validateQuestions([{...q,sourceUrl:undefined}],H.events)[0].sourceUrl,'');
});
test('生成的对应表JSON与应用索引一致，没有伪造题干或答案字段',()=>{
  const exported=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/exam-map-2010-2025.json'),'utf8'));
  assert.deepEqual(exported,R);
  exported.records.forEach(ref=>{assert.ok(!('stem' in ref));assert.ok(!('answer' in ref));assert.ok(!('options' in ref));});
  const csv=fs.readFileSync(path.join(__dirname,'../docs/exam-map-2010-2025.csv'),'utf8');assert.equal(csv.split('\r\n').length,125);
});
