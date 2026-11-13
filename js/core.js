/* 可独立测试的工具层。所有外部JSON先验证，再交给页面；不执行导入代码。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudyCore = factory();
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const empty = () => ({version:1,marks:{},attempts:[],checkins:[],imports:[],theme:'light',font:16});
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function httpUrl(value) {
    if(typeof value!=='string'||value.length>2000)return '';
    try {const url=new URL(value);return /^https?:$/.test(url.protocol)&&!url.username&&!url.password?url.href:'';}catch(error){return '';}
  }
  const same = (a,b) => a.length === b.length && [...a].sort().every((n,i)=>n===[...b].sort()[i]);
  function localDay(date = new Date()) {
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function streak(days,today = localDay()) {
    const set = new Set(days);
    const date = new Date(today+'T12:00:00');
    if (!set.has(localDay(date))) date.setDate(date.getDate()-1);
    let count = 0;
    while(set.has(localDay(date))) {count++;date.setDate(date.getDate()-1);}
    return count;
  }
  function validateQuestions(items,events,reserved = []) {
    if (!Array.isArray(items) || items.length>3000) throw new Error('题库必须是最多3000道题目的数组。');
    const ids = new Set(reserved), eventIds = new Set(events.map(e=>e.id));
    const str = (value,max) => typeof value==='string' && value.trim().length>0 && value.length<=max;
    return items.map((q,i) => {
      const fail = message => {throw new Error('第'+(i+1)+'题：'+message);};
      if (!q || !str(q.id,80) || !/^[a-zA-Z0-9_-]+$/.test(q.id) || ids.has(q.id)) fail('ID为空、格式不合法或与已有题目重复。');
      ids.add(q.id);
      if (!['single','multiple','analysis'].includes(q.kind)) fail('题型须为single、multiple或analysis。');
      if (!Number.isInteger(q.year) || q.year<2010 || q.year>2025) fail('真题年份须为2010—2025。');
      if (!str(q.number,40) || !str(q.source,2000) || !str(q.rights,2000)) fail('须填写题号、来源和使用权限说明。');
      if(q.sourceUrl && !httpUrl(q.sourceUrl))fail('出处链接必须是有效的HTTP(S)网址，且不能包含登录凭据。');
      if (!str(q.stem,20000) || !str(q.explanation,20000)) fail('缺少题干或解析，或超过字数上限。');
      if (!Array.isArray(q.eventIds) || !q.eventIds.length || q.eventIds.length>20 || !q.eventIds.every(id=>eventIds.has(id))) fail('关联节点ID无效。');
      if (!Array.isArray(q.options) || q.options.length>8 || !q.options.every(o=>str(o,5000))) fail('选项格式错误。');
      if (!Array.isArray(q.answer) || !q.answer.every(n=>Number.isInteger(n)&&n>=0&&n<q.options.length) || new Set(q.answer).size!==q.answer.length) fail('正确答案索引无效或重复。');
      if (q.kind==='single' && (q.options.length<2||q.answer.length!==1)) fail('单选须至少2个选项且恰有1个答案。');
      if (q.kind==='multiple' && (q.options.length<2||q.answer.length<2)) fail('多选须至少2个正确答案。');
      if (q.kind==='analysis' && (q.options.length||q.answer.length||!Array.isArray(q.points)||!q.points.length)) fail('分析题须有参考得分点且不设客观选项。');
      if (q.points!==undefined && (!Array.isArray(q.points)||q.points.length>30||!q.points.every(p=>str(p,5000)))) fail('参考得分点格式错误。');
      if (q.optionNotes!==undefined && (!Array.isArray(q.optionNotes)||q.optionNotes.length>8||!q.optionNotes.every(p=>str(p,5000)))) fail('选项辨析格式错误。');
      // 只复制允许字段，防止原型污染和无关属性进入持久化状态。
      return {id:q.id,kind:q.kind,year:q.year,number:q.number,source:q.source,sourceUrl:httpUrl(q.sourceUrl),rights:q.rights,origin:'imported',stem:q.stem,options:[...q.options],answer:[...q.answer],explanation:q.explanation,eventIds:[...new Set(q.eventIds)],points:q.points||[],optionNotes:q.optionNotes||[]};
    });
  }
  function validateState(raw,events,originals) {
    if (!raw || raw.version!==1) throw new Error('不支持的备份版本。');
    const state = empty();
    state.imports = validateQuestions(raw.imports||[],events,originals.map(q=>q.id));
    const eventSet = new Set(events.map(e=>e.id)),questionSet = new Set([...originals,...state.imports].map(q=>q.id));
    if (!raw.marks || typeof raw.marks!=='object' || Array.isArray(raw.marks)) throw new Error('考点记录格式无效。');
    Object.entries(raw.marks).forEach(([id,m]) => {
      if (!eventSet.has(id)) return;
      if (!m || typeof m!=='object' || (m.note!==undefined && (typeof m.note!=='string'||m.note.length>10000))) throw new Error('笔记格式无效或超长。');
      state.marks[id]={favorite:m.favorite===true,difficult:m.difficult===true,mastered:m.mastered===true,note:m.note||''};
    });
    if (!Array.isArray(raw.attempts)||raw.attempts.length>50000) throw new Error('答题记录无效或超过50000条。');
    state.attempts = raw.attempts.map(a=>{
      if (!a || !questionSet.has(a.id)||typeof a.correct!=='boolean'||!Number.isFinite(Date.parse(a.at))) throw new Error('答题记录存在无效题号或时间。');
      return {id:a.id,correct:a.correct,at:a.at,self:a.self===true};
    });
    if (!Array.isArray(raw.checkins)||raw.checkins.length>10000||!raw.checkins.every(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&localDay(new Date(d+'T12:00:00'))===d)) throw new Error('打卡日期格式无效。');
    state.checkins=[...new Set(raw.checkins)].sort();
    state.theme=raw.theme==='dark'?'dark':'light';
    state.font=[16,18,20].includes(raw.font)?raw.font:16;
    return state;
  }
  function wrongIds(attempts) {
    const latest = new Map();
    attempts.forEach(a=>latest.set(a.id,a.correct));
    return [...latest].filter(([,correct])=>!correct).map(([id])=>id);
  }
  function shuffled(items,random = Math.random) {
    const result=[...items];
    for(let i=result.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function searchEvents(events,marks,filters) {
    const query=filters.query.toLowerCase().trim();
    const result=events.filter(x=>{
      const m=marks[x.id]||{};
      const text=filters.type==='choice'?x.choice:filters.type==='analysis'?x.analysis:[x.title,x.date,x.background,x.process,x.meaning,x.choice,x.confusion,x.analysis].join(' ');
      const matches=!query||(/^\d{4}$/.test(query)?x.year===Number(query):[x.title,x.date,text].join(' ').toLowerCase().includes(query));
      return matches&&(filters.phase==='all'||x.phase===filters.phase)&&(filters.mark==='all'||(filters.mark==='unmastered'?!m.mastered:m[filters.mark]));
    });
    // 搜索事件名时优先显示标题匹配，正文提及该事件的相关考点排在后面。
    if(query&&!/^\d{4}$/.test(query)) {
      const rank=x=>x.title.toLowerCase()===query?2:x.title.toLowerCase().includes(query)?1:0;
      result.sort((a,b)=>rank(b)-rank(a));
    }
    return result;
  }
  function auditBank(questions,events) {
    const imported=questions.filter(q=>q.origin==='imported'),covered=new Set(imported.flatMap(q=>q.eventIds));
    const identities=new Map();
    imported.forEach(q=>{
      // 仅提示疑似重复，不自动删除不同版本的题目，也不修改学习记录。
      const number=q.number.normalize('NFKC').trim().replace(/^第/,'').replace(/题$/,'').replace(/\s+/g,'');
      const key=q.year+':'+number;
      if(!identities.has(key))identities.set(key,[]);
      identities.get(key).push(q.id);
    });
    return {version:1,note:'本报告仅统计本机导入数据，不证明原卷完整性、题目真实性或官方核验状态。',
      originalCount:questions.filter(q=>q.origin==='original').length,importedCount:imported.length,
      coveredNodes:events.filter(x=>covered.has(x.id)).map(x=>({id:x.id,title:x.title})),
      missingNodes:events.filter(x=>!covered.has(x.id)).map(x=>({id:x.id,title:x.title})),
      years:Array.from({length:16},(_,i)=>{const year=2010+i,list=imported.filter(q=>q.year===year);return {year,total:list.length,single:list.filter(q=>q.kind==='single').length,multiple:list.filter(q=>q.kind==='multiple').length,analysis:list.filter(q=>q.kind==='analysis').length,status:'unverified'};}),
      duplicates:[...identities].filter(([,ids])=>ids.length>1).map(([identity,ids])=>({identity,ids}))};
  }
  function filterExamRefs(records,events,filters) {
    const byId=new Map(events.map(event=>[event.id,event])),query=(filters.query||'').trim().toLowerCase();
    return records.filter(ref=>{
      if(filters.year!=='all'&&ref.year!==Number(filters.year))return false;
      if(filters.kind!=='all'&&ref.kind!==filters.kind)return false;
      if(filters.scope!=='all'&&ref.scope!==filters.scope)return false;
      if(filters.event!=='all'&&!ref.eventIds.includes(filters.event))return false;
      if(filters.phase!=='all'&&!ref.eventIds.some(id=>byId.get(id)?.phase===filters.phase))return false;
      if(!query)return true;
      if(/^\d{4}$/.test(query))return ref.year===Number(query);
      const text=[ref.topic,ref.id,ref.year+'-'+ref.number,ref.year+' '+ref.number,...ref.parts.map(p=>p.topic),...ref.eventIds.map(id=>{const event=byId.get(id);return event?[event.title,event.choice,event.process].join(' '):'';})].join(' ').toLowerCase();
      return text.includes(query);
    });
  }
  return {empty,escape,same,localDay,streak,validateQuestions,validateState,wrongIds,shuffled,searchEvents,auditBank,httpUrl,filterExamRefs};
}));
