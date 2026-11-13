/* 运行：node --test tests/*.test.cjs。仅用Node内置模块，无需安装依赖。 */
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../js/core.js');
const context={window:{}};vm.createContext(context);
for(const name of ['history','review','questions'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../data/'+name+'.js'),'utf8'),context);
const H=JSON.parse(JSON.stringify(context.window.HISTORY));
const Q=JSON.parse(JSON.stringify(context.window.QUESTION_BANK.questions));
const fixture=()=>({id:'test-2020-1',year:2020,number:'1',source:'本地自动测试数据，非真题',rights:'仅测试',kind:'single',eventIds:['h001'],stem:'测试题干',options:['甲','乙','丙'],answer:[1],explanation:'测试解析',points:[]});
test('历史节点日期有序、ID唯一、阶段完整、详情字段齐全',()=>{
  assert.equal(new Set(H.events.map(x=>x.id)).size,H.events.length);
  assert.equal(H.phases.length,17);
  assert.deepEqual(H.events.map(x=>x.date),H.events.map(x=>x.date).sort());
  H.phases.forEach(p=>assert.ok(H.events.some(x=>x.phase===p.id),p.name));
  H.events.forEach(x=>{for(const key of ['background','process','meaning','choice','confusion','analysis'])assert.ok(x[key],x.id+key);assert.ok(x.stars>=1&&x.stars<=5);});
});
test('每个节点都有原创关联练习，题目答案和速记引用有效',()=>{
  assert.equal(new Set(Q.map(q=>q.id)).size,Q.length);
  H.events.forEach(x=>assert.ok(Q.some(q=>q.eventIds.includes(x.id)),x.title));
  Q.forEach(q=>{assert.equal(q.origin,'original');assert.equal(q.year,null);assert.ok(q.eventIds.every(id=>H.events.some(x=>x.id===id)));if(q.kind==='analysis')assert.ok(q.points.length);else assert.ok(q.answer.every(i=>i>=0&&i<q.options.length));});
  H.memory.forEach(m=>m.ids.forEach(id=>assert.ok(H.events.some(x=>x.id===id))));
});
test('选项轮换后原始正确答案仍对应正确知识',()=>{
  const q=Q.find(q=>q.stem==='中国近代史的起点是下列哪一事件？');assert.equal(q.options[q.answer[0]],'鸦片战争');
  const n=Q.find(q=>q.stem==='下列哪项属于《南京条约》的内容？');assert.equal(n.options[n.answer[0]],'割让香港岛');
  const m=Q.find(q=>q.kind==='multiple');assert.equal(m.answer.length,3);assert.ok(!m.answer.map(i=>m.options[i]).some(t=>t.includes('科学社会主义')));
});
test('多选题不依赖顺序，漏选、错选不算正确',()=>{
  assert.ok(C.same([2,0,1],[0,1,2]));assert.ok(!C.same([0,1],[0,1,2]));assert.ok(!C.same([0,1,3],[0,1,2]));
});
test('错题以最近一次作答判定，答对后移除，再错重新进入',()=>{
  const a=[{id:'a',correct:false},{id:'b',correct:false},{id:'a',correct:true}];assert.deepEqual(C.wrongIds(a),['b']);a.push({id:'a',correct:false});assert.deepEqual(C.wrongIds(a),['a','b']);
});
test('打卡支持跨月、跨年、闰年和昨日连续',()=>{
  assert.equal(C.streak(['2025-12-31','2026-01-01'],'2026-01-02'),2);
  assert.equal(C.streak(['2024-02-28','2024-02-29','2024-03-01'],'2024-03-01'),3);
  assert.equal(C.streak(['2026-01-01'],'2026-01-03'),0);
});
test('导入只接受有效年份、题号、来源、权限及关联节点',()=>{
  assert.equal(C.validateQuestions([fixture()],H.events)[0].origin,'imported');
  for(const patch of [{year:2009},{year:2026},{source:''},{rights:''},{number:''},{eventIds:['missing']},{id:'<script>'},{answer:[8]},{answer:[1,1]}])assert.throws(()=>C.validateQuestions([{...fixture(),...patch}],H.events));
});
test('重复题目ID与内置ID冲突时拒绝整批导入',()=>{
  assert.throws(()=>C.validateQuestions([fixture(),fixture()],H.events));assert.throws(()=>C.validateQuestions([fixture()],H.events,[fixture().id]));
});
test('分析题要求参考要点，客观题不接受空答案',()=>{
  const a={...fixture(),kind:'analysis',options:[],answer:[],points:['第一点']};assert.equal(C.validateQuestions([a],H.events)[0].points[0],'第一点');
  assert.throws(()=>C.validateQuestions([{...a,points:[]}],H.events));assert.throws(()=>C.validateQuestions([{...fixture(),answer:[]}],H.events));
});
test('备份往返保持笔记、掌握标记、练习与导入题库',()=>{
  const state=C.empty();state.marks.h001={favorite:true,mastered:true,note:'<b>纯文本</b>'};state.checkins=['2026-11-13'];state.imports=[fixture()];state.attempts=[{id:fixture().id,correct:false,at:'2026-11-13T03:00:00Z',self:false}];
  const restored=C.validateState(JSON.parse(JSON.stringify(state)),H.events,Q);assert.equal(restored.marks.h001.note,'<b>纯文本</b>');assert.equal(restored.marks.h001.mastered,true);assert.equal(restored.imports.length,1);assert.equal(C.wrongIds(restored.attempts).length,1);
});
test('损坏备份、非法日期、未知题目与超长笔记被拒绝',()=>{
  assert.throws(()=>C.validateState({version:3},H.events,Q));
  for(const patch of [{checkins:['2026-02-30']},{attempts:[{id:'missing',correct:false,at:'2026-01-01'}]},{marks:{h001:{note:'a'.repeat(10001)}}}])assert.throws(()=>C.validateState({...C.empty(),...patch},H.events,Q));
});
test('动态文本转义脚本标签、属性引号和HTML实体',()=>{
  assert.equal(C.escape('<img src=x onerror="x">'),'&lt;img src=x onerror=&quot;x&quot;&gt;');assert.equal(C.escape("&'"),'&amp;&#39;');
});
test('洗牌保持题目集合，空集合可安全处理',()=>{
  assert.deepEqual(C.shuffled([]),[]);const source=[1,2,3,4];assert.deepEqual(C.shuffled(source,()=>0).sort(),source);assert.deepEqual(source,[1,2,3,4]);
});
test('年份严格匹配，事件名优先于正文引用，筛选条件可叠加',()=>{
  const filters={query:'1935',phase:'all',type:'all',mark:'all'};
  assert.deepEqual(C.searchEvents(H.events,{},filters).map(x=>x.title),['遵义会议','瓦窑堡会议']);
  assert.equal(C.searchEvents(H.events,{}, {...filters,query:'遵义'})[0].title,'遵义会议');
  assert.equal(C.searchEvents(H.events,{h028:{favorite:true}},{...filters,mark:'favorite'}).length,1);
  assert.equal(C.searchEvents(H.events,{}, {...filters,phase:'opening'}).length,0);
  assert.equal(C.searchEvents(H.events,{}, {...filters,query:'不存在的关键词'}).length,0);
});
test('静态页面资源存在，核心脚本顺序正确，不依赖CDN',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(!/^https?:/.test(match[1]))assert.ok(fs.existsSync(path.join(root,match[1])),match[1]);}
  assert.ok(html.indexOf('data/history.js')<html.indexOf('data/questions.js'));assert.ok(html.indexOf('js/core.js')<html.indexOf('js/app.js'));assert.ok(!html.includes('https://'));
});
test('调整原始数据行顺序不改变已发布事件ID和笔记关联',()=>{
  const other={window:{}};vm.createContext(other);
  const source=fs.readFileSync(path.join(__dirname,'../data/history.js'),'utf8');
  vm.runInContext(source.replace('const events = rows.map','const events = [...rows].reverse().map'),other);
  const actual=JSON.parse(JSON.stringify(other.window.HISTORY.events.map(x=>({id:x.id,title:x.title}))));
  assert.deepEqual(actual,H.events.map(x=>({id:x.id,title:x.title})));
});
test('24组专题分析要点、三组对比的节点引用有效',()=>{
  assert.equal(H.events.filter(x=>x.analysisPoints.length).length,24);
  H.events.filter(x=>x.analysisPoints.length).forEach(x=>{assert.equal(x.analysisPoints.length,3);assert.equal(x.analysis,x.analysisPoints.join(' '));});
  assert.equal(H.comparisons.length,3);
  H.comparisons.forEach(item=>{assert.ok(item.eventIds.every(id=>H.events.some(x=>x.id===id)));item.rows.forEach(row=>assert.equal(row.length,item.headers.length));});
});
test('收录审计只统计导入题，不把原创题当成真题覆盖',()=>{
  const q={...fixture(),origin:'imported'};
  const report=C.auditBank([...Q,q],H.events);
  assert.equal(report.importedCount,1);assert.equal(report.originalCount,Q.length);assert.equal(report.coveredNodes.length,1);assert.equal(report.missingNodes.length,H.events.length-1);
  assert.equal(report.years.find(y=>y.year===2020).single,1);assert.ok(report.years.every(y=>y.status==='unverified'));assert.equal(report.duplicates.length,0);
});
test('审计提示相同年份题号的不同版本，不修改原题或报告完整性',()=>{
  const q={...fixture(),origin:'imported'},other={...q,id:'test-other',number:'第１题'};
  const input=[q,other];const before=JSON.stringify(input),report=C.auditBank(input,H.events);
  assert.equal(report.duplicates.length,1);assert.deepEqual(report.duplicates[0].ids,[q.id,other.id]);assert.equal(JSON.stringify(input),before);assert.equal(report.importedCount,2);
  assert.equal(report.years.find(y=>y.year===2021).total,0);
});
