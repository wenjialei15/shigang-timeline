/* 页面与交互层：不使用框架、不请求网络数据，兼容 file:// 直接打开。
 * 页面内所有动态文本均经 escape 转义；个人笔记只按文本展示。 */
(function () {
  'use strict';
  const H=window.HISTORY, B=window.QUESTION_BANK, R=window.EXAM_INDEX, C=window.StudyCore, e=C.escape;
  const $=selector=>document.querySelector(selector);
  const KEY='shixu.study.v1';
  let state=C.empty(),saveWarning='',noticeTimer,session=null,scrollToDetail=false;
  const filters={query:'',phase:'all',type:'all',mark:'all',zoom:1,selected:H.events.find(x=>x.title==='五四运动').id};
  const practice={mode:'chapter',phase:'all',source:'all',kind:'all',year:2025,count:'10'};
  const examFilters={year:'all',kind:'all',phase:'all',scope:'all',event:'all',query:''};
  const titles={timeline:'历史时间轴',practice:'练习中心',exams:'真题考点对应',mistakes:'错题复盘',memory:'高频速记',progress:'我的学习',about:'使用与数据说明'};
  function load() {
    try {
      const raw=localStorage.getItem(KEY);
      if(raw) state=C.validateState(JSON.parse(raw),H.events,B.questions);
    } catch(error) {
      saveWarning='本地记录无法读取：'+error.message+'。当前使用临时记录，请先在“我的学习”导出原始存档再尝试恢复；本次不覆盖原存档。';
    }
  }
  let protectedStore=false;
  load(); protectedStore=!!saveWarning;
  function save() {
    if(protectedStore) {showNotice('原存档受保护；本次更改仅保留在内存，请导出备份。');return false;}
    try {localStorage.setItem(KEY,JSON.stringify(state));saveWarning='';syncSaveWarning();return true;}
    catch(error) {saveWarning='浏览器未能保存学习记录（可能是隐私模式、存储被禁用或空间不足）。当前更改仅在本次页面有效，请及时导出备份。';syncSaveWarning();showNotice('保存失败，请导出学习备份。');return false;}
  }
  function syncSaveWarning() {
    let box=$('#save-warning');
    if(saveWarning&&!box) {box=document.createElement('div');box.id='save-warning';box.className='save-warning';$('#main').prepend(box);}
    if(box) {box.textContent=saveWarning;box.hidden=!saveWarning;}
  }
  function showNotice(text) {clearTimeout(noticeTimer);$('#notice').textContent=text;$('#notice').hidden=false;noticeTimer=setTimeout(()=>$('#notice').hidden=true,4500);}
  const bank=()=>[...B.questions,...state.imports];
  const mark=id=>state.marks[id]||{favorite:false,difficult:false,mastered:false,note:''};
  const phaseName=id=>H.phases.find(p=>p.id===id)?.name||'';
  const eventById=id=>H.events.find(x=>x.id===id);
  const kindName=kind=>({single:'单选题',multiple:'多选题',analysis:'分析题'}[kind]);
  function statCards() {
    const mastered=H.events.filter(x=>mark(x.id).mastered).length;
    return `<div class="stats"><div class="stat"><span>历史坐标</span><strong>${H.events.length}<small> 个考点</small></strong><small>1840年至新时代 · ${H.phases.length}个阶段</small><b class="stat-icon">◷</b></div><div class="stat"><span>已掌握考点</span><strong>${mastered}<small> / ${H.events.length}</small></strong><small>每一次理解，都是进步</small><b class="stat-icon">✓</b></div><div class="stat"><span>待复盘错题</span><strong>${C.wrongIds(state.attempts).length}<small> 道</small></strong><small>回到历史现场，查漏补缺</small><b class="stat-icon">↺</b></div><div class="stat"><span>连续记忆打卡</span><strong>${C.streak(state.checkins)}<small> 天</small></strong><small>累计学习 ${state.checkins.length} 天</small><b class="stat-icon">✧</b></div></div>`;
  }
  function pageHead(eyebrow,title,subtitle,aside='') {return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${aside}</div>`;}
  function currentPage() {const page=location.hash.slice(1);return titles[page]?page:'timeline';}
  function navigate(page) {if(currentPage()===page) render();else location.hash=page;}
  function applySettings() {
    document.documentElement.dataset.theme=state.theme;
    document.documentElement.style.setProperty('--font',state.font+'px');
    $('#theme-toggle').textContent=state.theme==='dark'?'☀ 浅色':'☾ 深色';
    $('#theme-toggle').setAttribute('aria-label',state.theme==='dark'?'切换浅色主题':'切换深色主题');
    $('#font-toggle').textContent='字号 '+state.font;
  }
  function render() {
    const page=currentPage();
    document.title=titles[page]+' · 史序';
    $('#breadcrumb').textContent='学习空间 / '+titles[page];
    document.querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('#wrong-count').textContent=C.wrongIds(state.attempts).length;
    $('#main').innerHTML=({timeline:renderTimeline,practice:renderPractice,exams:renderExams,mistakes:renderMistakes,memory:renderMemory,progress:renderProgress,about:renderAbout}[page])();
    syncSaveWarning(); applySettings();
    if(page==='timeline') {updateTimeline(true);bindTimeline();}
    if(page==='exams')updateExamResults();
  }
  function visibleEvents() {
    return C.searchEvents(H.events,state.marks,filters);
  }
  function renderTimeline() {
    return pageHead('CONNECT THE DOTS · 以时间为线索','读懂历史的来路','把零散考点串成脉络，让每一次复习都有迹可循。','<div class="head-note"><strong>1840 — 至今</strong>从民族觉醒，到民族复兴</div>')+statCards()+`
      <section class="panel" aria-label="时间轴检索"><div class="panel-head"><h2>探索历史时间轴</h2><span class="tag">阶段可重叠 · 节点按时间排序</span></div>
      <div class="toolbar"><input id="search" type="search" aria-label="搜索年份、事件或考点" placeholder="搜索年份、事件或考点，例如：1935、遵义、土地" value="${e(filters.query)}"><select id="type-filter" aria-label="考点类型"><option value="all">全部考点类型</option><option value="choice" ${filters.type==='choice'?'selected':''}>选择题考点</option><option value="analysis" ${filters.type==='analysis'?'selected':''}>分析题思路</option></select><select id="mark-filter" aria-label="学习状态">${[['all','全部学习状态'],['favorite','我的收藏'],['difficult','重难点'],['mastered','已掌握'],['unmastered','未掌握']].map(([id,name])=>`<option value="${id}" ${filters.mark===id?'selected':''}>${name}</option>`).join('')}</select></div>
      <div class="chip-row" aria-label="历史阶段筛选"><button class="chip ${filters.phase==='all'?'active':''}" data-phase="all" aria-pressed="${filters.phase==='all'}">全部阶段</button>${H.phases.map(p=>`<button class="chip ${filters.phase===p.id?'active':''}" data-phase="${p.id}" aria-pressed="${filters.phase===p.id}" title="${p.range}">${p.name}</button>`).join('')}</div>
      <div class="timeline-tools"><span id="result-count"></span><div class="zoom-controls"><button data-action="pan-left" aria-label="向更早年份滑动">←</button><button data-action="pan-right" aria-label="向更晚年份滑动">→</button><button data-action="zoom-out" aria-label="缩小时间轴">−</button><span id="zoom-value">100%</span><button data-action="zoom-in" aria-label="放大时间轴">＋</button></div><label>跳转 <select id="jump" aria-label="跳转到历史节点">${H.events.map(x=>`<option value="${x.id}" ${filters.selected===x.id?'selected':''}>${x.date} ${x.title}</option>`).join('')}</select></label></div>
      <div id="timeline-scroll" class="timeline-scroll" tabindex="0" aria-label="可左右滚动的事件时间轴，使用左右方向键滚动"><div id="timeline-track" class="timeline-track"></div></div><div class="timeline-hint"><span>← 左右滑动 / 鼠标拖动 · 双指缩放 / Ctrl + 滚轮</span><span>★ 为建议复习星级，非官方评级</span></div></section>
      <div class="two-col"><section id="detail" class="panel detail" aria-label="考点详情"></section><aside class="study-side"><section class="panel side-card"><h3>今日复习，不妨从这里开始</h3><p>先理脉络，再做练习。掌握一个考点，就向目标靠近一步。</p><div class="big">${Math.round(H.events.filter(x=>mark(x.id).mastered).length/H.events.length*100)}<small>% 已掌握</small></div><div class="progress-bar"><span style="width:${H.events.filter(x=>mark(x.id).mastered).length/H.events.length*100}%"></span></div><button class="primary" data-action="checkin">${state.checkins.includes(C.localDay())?'今日已打卡 ✓':'完成今日记忆打卡'}</button><a class="text-link" href="#progress">查看我的学习 →</a></section><div class="side-tip"><h3>复习方法 / 01</h3><p>每个事件问自己三个问题：<br>为什么发生？解决了什么？<br>与前后事件有什么联系？</p><a class="text-link" href="#memory">打开高频速记 →</a></div></aside></div>`;
  }
  function updateTimeline(center=false) {
    // 学习标记变化后同步概览数字，避免只更新详情而留下旧进度。
    if($('.stats')) $('.stats').outerHTML=statCards();
    const ratio=H.events.filter(x=>mark(x.id).mastered).length/H.events.length*100;
    if($('.study-side .big')) $('.study-side .big').innerHTML=Math.round(ratio)+'<small>% 已掌握</small>';
    if($('.study-side .progress-bar span')) $('.study-side .progress-bar span').style.width=ratio+'%';
    const items=visibleEvents();
    if(!items.some(x=>x.id===filters.selected)) filters.selected=items[0]?.id||null;
    $('#result-count').textContent=`${items.length} 个节点 · 当前按事件间等距展示（非等比例年份刻度）`;
    $('#timeline-track').style.setProperty('--node-width',Math.round(185*filters.zoom)+'px');
    $('#zoom-value').textContent=Math.round(filters.zoom*100)+'%';
    $('#timeline-track').innerHTML=items.length?items.map(x=>`<button class="node ${x.id===filters.selected?'active':''}" data-node="${x.id}" aria-pressed="${x.id===filters.selected}" aria-label="${e(x.date+' '+x.title+'，建议'+x.stars+'星')}"><span class="year">${x.year}</span><span class="node-card"><span class="stars" aria-hidden="true">${'★'.repeat(x.stars)}</span><span class="node-title">${e(x.title)} ${mark(x.id).mastered?'✓':''}</span><span class="node-summary">${e(x.choice.slice(0,39))}${x.choice.length>39?'…':''}</span></span></button>`).join(''):'<div class="empty">没有匹配的考点。试试其他关键词，或清除阶段与状态筛选。</div>';
    $('#detail').innerHTML=filters.selected?renderDetail(eventById(filters.selected)):'<div class="empty">暂无可显示的考点。<button data-action="reset-filters">清除筛选</button></div>';
    if(filters.selected) $('#jump').value=filters.selected;
    document.querySelectorAll('[data-phase]').forEach(b=>{b.classList.toggle('active',b.dataset.phase===filters.phase);b.setAttribute('aria-pressed',b.dataset.phase===filters.phase);});
    if(center&&filters.selected) {
      const node=$(`[data-node="${filters.selected}"]`),scroll=$('#timeline-scroll');
      scroll.scrollLeft=node.offsetLeft-scroll.clientWidth/2+node.clientWidth/2;
    }
  }
  function renderDetail(x) {
    const m=mark(x.id),associated=bank().filter(q=>q.eventIds.includes(x.id)),truth=associated.filter(q=>q.origin==='imported'),references=R.records.filter(ref=>ref.eventIds.includes(x.id));
    return `<div class="panel-head"><span class="tag">${phaseName(x.phase)}</span><span class="stars" aria-label="建议复习${x.stars}星">${'★'.repeat(x.stars)}</span></div><div class="detail-date">${e(x.date)}</div><h2>${e(x.title)}</h2><p class="subtitle">${e(x.meaning)}</p><div class="detail-actions">${[['favorite','☆ 收藏'],['difficult','⚑ 重难点'],['mastered','✓ 已掌握']].map(([key,label])=>`<button class="${m[key]?'selected':''}" data-mark="${key}" aria-pressed="${m[key]}">${label}</button>`).join('')}<button class="primary" data-practice-event="${x.id}">关联练习 ${associated.length} 道 →</button><button data-exam-event="${x.id}">历年真题索引 ${references.length} 道 ↗</button></div>
      <div class="detail-block"><h3>01 / 事件背景</h3><p>${e(x.background)}</p></div><div class="detail-block"><h3>02 / 核心经过</h3><p>${e(x.process)}</p></div><div class="detail-block"><h3>03 / 历史意义</h3><p>${e(x.meaning)}</p></div><div class="highlight"><span class="tag">选择题考点</span><p>${e(x.choice)}</p></div>${x.examFocus.length?`<div class="detail-block"><h3>关联真题所需知识</h3><ul class="analysis-points">${x.examFocus.map(point=>`<li>${e(point)}</li>`).join('')}</ul></div>`:''}<div class="detail-block"><h3><span class="tag">分析题思路</span></h3>${x.analysisPoints.length?`<ol class="analysis-points">${x.analysisPoints.map(point=>`<li>${e(point)}</li>`).join('')}</ol>`:`<p>${e(x.analysis)}</p>`}</div>${H.comparisons.filter(item=>item.eventIds.includes(x.id)).map(item=>renderComparison(item,true)).join('')}<div class="warning"><strong>易混易错</strong>${e(x.confusion)}</div>
      <div class="detail-block"><h3>我的笔记</h3><textarea id="event-note" maxlength="10000" aria-label="${e(x.title)}的个人笔记" placeholder="用自己的话记下理解、易错点或复习口诀……">${e(m.note)}</textarea><div class="note-status" id="note-status">输入后自动保存 · 最多10000字</div></div>
      <div class="detail-block"><h3>相邻历史坐标</h3><div class="related-list">${H.events.slice(Math.max(0,H.events.indexOf(x)-1),H.events.indexOf(x)+2).filter(t=>t.id!==x.id).map(t=>`<button data-event="${t.id}">${t.date} · ${t.title} →</button>`).join('')}</div></div>
      <details><summary>关联题目与史实参考</summary><p class="metric-note">原创 ${associated.length-truth.length} 题 · 用户导入真题 ${truth.length} 题。导入内容未由项目核验。${truth.length?'':'暂无该节点已导入真题。'}</p>${associated.map(q=>`<p class="metric-note">${e(q.origin==='original'?'原创练习':q.year+'年 第'+q.number+'题（用户导入）')} · ${kindName(q.kind)}</p>`).join('')}<ul class="source-list">${x.sourceIds.map(id=>H.sources.find(s=>s.id===id)).map(s=>`<li><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} ↗</a><p>${e(s.note)}</p></li>`).join('')}</ul><small>节点ID：${x.id} · 更新时间 ${H.reviewedAt}</small></details>`;
  }
  function renderComparison(item,compact=false) {
    const level=compact?3:2;
    return `<section class="${compact?'detail-block':'panel comparison'}"><h${level}>${e(item.title)}</h${level}><div class="table-wrap"><table><thead><tr>${item.headers.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${item.rows.map(row=>`<tr>${row.map(cell=>`<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }
  // 出处紧跟题目显示。只允许HTTP(S)链接；导入的普通来源描述仍按文本展示。
  function renderQuestionSource(q) {
    const sourceUrl=C.httpUrl(q.sourceUrl)||C.httpUrl(q.source);
    const label=q.origin==='original'?`项目原创练习 ${q.id}（非历年真题）`:`${q.year}年全国硕士研究生招生考试 · 思想政治理论（101） · 第${q.number}题（用户导入，未核验）`;
    return `<p class="question-source">出处：${e(label)}<br>${sourceUrl?`<a href="${e(sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(q.source)} ↗</a>`:e(q.source)}</p>`;
  }
  function renderExamCard(ref) {
    return `<article class="panel exam-card" id="${ref.id}"><div class="quiz-meta"><div class="badges"><span class="tag">${ref.year}年 · 第${ref.number}题</span><span class="tag">${kindName(ref.kind)}</span>${ref.scope==='cross'?'<span class="tag amber">交叉考点</span>':''}</div><small>考点摘要 · 非原题全文</small></div><h2>${e(ref.topic)}</h2>${ref.parts.length?`<ol class="exam-parts">${ref.parts.map(part=>`<li>小问${part.number}：${e(part.topic)}<div class="chip-row">${part.eventIds.map(id=>`<button class="chip" data-event="${id}">${e(eventById(id).title)} ↗</button>`).join('')}</div></li>`).join('')}</ol>`:''}<div class="chip-row" aria-label="对应知识点">${ref.eventIds.map(id=>`<button class="chip" data-event="${id}">${e(eventById(id).title)} ↗</button>`).join('')}</div><div class="question-source"><strong>出处：${ref.year}年全国硕士研究生招生考试 · 思想政治理论（101） · 第${ref.number}题 · ${kindName(ref.kind)}</strong>${ref.sources.map(source=>`<p><a href="${e(C.httpUrl(source.url))}" target="_blank" rel="noopener noreferrer">${e(source.name)} ↗</a><small> · ${e(source.locator)}</small></p>`).join('')}<small>来源状态：公开整理版，非官方原卷核验；对应关系为项目整理。</small></div>${ref.notes?`<p class="warning">${e(ref.notes)}</p>`:''}</article>`;
  }
  function renderExams() {
    return pageHead('REAL EXAM · KNOWLEDGE MAP','真题与知识点，一一对应','2010—2025共16个考试年份 · 支持按题号、事件和阶段检索。')+`<section class="panel"><div class="panel-head"><h2>历年题号与考点索引</h2><button data-action="export-exam-index">导出完整对应表 JSON</button></div><div class="warning"><strong>索引 ${R.records.length} 道，含史纲与历史交叉考点</strong>这里提供题号、项目编写的考点摘要、知识点对应和逐题出处，不是原题全文或答案库。公开整理版可能存在转录差异；点击出处核对题目，导入有权使用的完整题库后可在练习中心作答。年份覆盖不等于官方逐题审定。</div><div class="toolbar"><input type="search" id="exam-search" aria-label="搜索真题考点对应" placeholder="搜索考点、事件或年份题号，例如：2025-28、安源、土地" value="${e(examFilters.query)}"></div><div class="form-grid exam-filters"><label>考试年份<select data-exam-filter="year"><option value="all">全部年份</option>${Array.from({length:16},(_,i)=>2025-i).map(year=>`<option ${Number(examFilters.year)===year?'selected':''}>${year}</option>`).join('')}</select></label><label>题型<select data-exam-filter="kind">${[['all','全部题型'],['single','单选题'],['multiple','多选题'],['analysis','分析题']].map(([id,label])=>`<option value="${id}" ${examFilters.kind===id?'selected':''}>${label}</option>`).join('')}</select></label><label>历史阶段<select data-exam-filter="phase"><option value="all">全部阶段</option>${H.phases.map(p=>`<option value="${p.id}" ${examFilters.phase===p.id?'selected':''}>${p.name}</option>`).join('')}</select></label><label>范围<select data-exam-filter="scope">${[['all','史纲及历史交叉'],['history','史纲主线'],['cross','历史交叉考点']].map(([id,label])=>`<option value="${id}" ${examFilters.scope===id?'selected':''}>${label}</option>`).join('')}</select></label><label>知识点<select data-exam-filter="event"><option value="all">全部知识点</option>${H.events.map(x=>`<option value="${x.id}" ${examFilters.event===x.id?'selected':''}>${e(x.title)}</option>`).join('')}</select></label></div><div class="practice-actions"><button data-action="clear-exam-filters">清除筛选</button><a class="text-link" href="#practice">进入完整题目练习 →</a></div><p class="metric-note" id="exam-count" role="status"></p><details><summary>各年题号范围与核验说明</summary><p class="metric-note">按公开整理材料中的史纲主线与历史交叉题建立编辑范围，未声称这是官方逐题学科划分。分析题按原卷题号36收录，两小问分别对应。年份采用试卷招生考试年份，可能与实际考试月份的公历年份不同。</p>${R.manifest.map(item=>`<p class="metric-note">${item.year}年：${item.numbers.join('、')}（${item.numbers.length}道）</p>`).join('')}</details></section><div id="exam-results"></div>`;
  }
  function updateExamResults() {
    const records=C.filterExamRefs(R.records,H.events,examFilters);
    $('#exam-count').textContent=`匹配 ${records.length} / ${R.records.length} 道索引 · 本页内容与出处均可离线查看，外部原文链接需要联网`;
    $('#exam-results').innerHTML=records.length?records.map(renderExamCard).join(''):'<div class="panel empty">没有匹配项。请清除筛选或更换关键词。</div>';
  }
  function resizeTimeline(next,anchor=0.5) {
    const scroll=$('#timeline-scroll'),old=filters.zoom;
    filters.zoom=Math.max(.7,Math.min(2,Math.round(next*10)/10));
    const pos=scroll.scrollLeft+scroll.clientWidth*anchor;
    $('#timeline-track').style.setProperty('--node-width',Math.round(185*filters.zoom)+'px');
    $('#zoom-value').textContent=Math.round(filters.zoom*100)+'%';
    scroll.scrollLeft=pos*filters.zoom/old-scroll.clientWidth*anchor;
  }
  function bindTimeline() {
    const scroll=$('#timeline-scroll'); let drag=null,suppress=false,pinch=null;
    scroll.addEventListener('pointerdown',ev=>{if(ev.pointerType==='mouse'&&ev.button===0) drag={x:ev.clientX,left:scroll.scrollLeft,moved:false};});
    scroll.addEventListener('pointermove',ev=>{if(!drag||!(ev.buttons&1)) return;const diff=ev.clientX-drag.x;if(Math.abs(diff)>5) {drag.moved=true;scroll.classList.add('dragging');scroll.scrollLeft=drag.left-diff;}});
    const stop=()=>{if(drag?.moved){suppress=true;setTimeout(()=>suppress=false,0);}drag=null;scroll.classList.remove('dragging');};
    scroll.addEventListener('pointerup',stop);scroll.addEventListener('pointerleave',stop);
    scroll.addEventListener('click',ev=>{if(suppress){ev.stopPropagation();ev.preventDefault();suppress=false;}},true);
    scroll.addEventListener('wheel',ev=>{
      if(ev.ctrlKey){ev.preventDefault();resizeTimeline(filters.zoom+(ev.deltaY<0?.1:-.1));}
      else if(Math.abs(ev.deltaY)>Math.abs(ev.deltaX)&&scroll.scrollWidth>scroll.clientWidth) {
        const can=(ev.deltaY>0&&scroll.scrollLeft<scroll.scrollWidth-scroll.clientWidth-1)||(ev.deltaY<0&&scroll.scrollLeft>0);
        if(can){ev.preventDefault();scroll.scrollLeft+=ev.deltaY;}
      }
    },{passive:false});
    scroll.addEventListener('keydown',ev=>{if(ev.target!==scroll)return;if(['ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();scroll.scrollLeft+=ev.key==='ArrowLeft'?-220:220;}});
    const distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    scroll.addEventListener('touchstart',ev=>{if(ev.touches.length===2){ev.preventDefault();pinch={distance:distance(ev.touches),zoom:filters.zoom};}},{passive:false});
    scroll.addEventListener('touchmove',ev=>{if(ev.touches.length===2&&pinch){ev.preventDefault();resizeTimeline(pinch.zoom*distance(ev.touches)/pinch.distance);}},{passive:false});
    scroll.addEventListener('touchend',()=>pinch=null);
  }
  function openEvent(id) {
    if(!eventById(id)) return;
    Object.assign(filters,{query:'',phase:'all',type:'all',mark:'all',selected:id});
    if(currentPage()==='timeline') {render();$('#detail').scrollIntoView({block:'start'});}
    else {scrollToDetail=true;location.hash='timeline';}
  }
  function renderPractice() {
    if(session)return renderSession();
    return pageHead('PRACTICE & UNDERSTAND · 以练促学','每一次作答，都回到理解','章节巩固、随机练习、年份套卷；错题自动进入复盘。')+`
      <section class="panel"><div class="panel-head"><h2>安排一组练习</h2><span class="tag">本地题库 ${bank().length} 题</span></div><div class="warning"><strong>题库范围说明</strong>内置 ${B.questions.length} 道原创练习，不冒充真题。另有 ${R.records.length} 道历年题号—考点索引（见“真题考点对应”），尚未内置完整真题原文；年份套卷仅使用你导入的题目，不保证组成完整试卷。分析题采用自主对照参考要点评价。</div>
      <div class="form-grid"><label>练习方式<select data-practice-filter="mode">${[['chapter','章节专项'],['random','随机练习'],['year','真题年份套卷（已导入）']].map(([id,name])=>`<option value="${id}" ${practice.mode===id?'selected':''}>${name}</option>`).join('')}</select></label><label>历史阶段<select data-practice-filter="phase"><option value="all">全部阶段</option>${H.phases.map(p=>`<option value="${p.id}" ${practice.phase===p.id?'selected':''}>${p.name}</option>`).join('')}</select></label><label>题目来源<select data-practice-filter="source">${[['all','全部题目'],['original','项目原创练习'],['imported','用户导入真题（未核验）']].map(([id,name])=>`<option value="${id}" ${practice.source===id?'selected':''}>${name}</option>`).join('')}</select></label><label>题型<select data-practice-filter="kind">${[['all','全部题型'],['single','单选题'],['multiple','多选题'],['analysis','分析题']].map(([id,name])=>`<option value="${id}" ${practice.kind===id?'selected':''}>${name}</option>`).join('')}</select></label><label>真题年份<select data-practice-filter="year">${Array.from({length:16},(_,i)=>2025-i).map(y=>`<option ${Number(practice.year)===y?'selected':''}>${y}</option>`).join('')}</select></label><label>本组题量<select data-practice-filter="count">${[['10','10题'],['20','20题'],['all','全部匹配题目']].map(([id,name])=>`<option value="${id}" ${practice.count===id?'selected':''}>${name}</option>`).join('')}</select></label></div><p class="metric-note">随机模式保留所选筛选条件；年份模式只取导入真题。多选题按全对判定，不设部分得分。</p><div class="practice-actions"><button class="primary" data-action="start-practice">开始练习 →</button><a href="#progress" class="text-link">导入题库 / 备份数据</a></div><p id="practice-message" class="inline-msg" role="status"></p></section>
      <section class="panel"><h2>2010—2025 完整题目导入看板</h2><p class="metric-note">另已内置 ${R.records.length} 道题号—知识点索引，可在 <a href="#exams">真题考点对应</a> 中按年份查看逐题出处；索引不计入可判分题库。</p><p class="metric-note">数字为本机导入题量，未对照原卷核验；“0题”表示尚无导入，不能据此推断当年未考史纲。</p><div class="coverage">${Array.from({length:16},(_,i)=>2010+i).map(y=>`<div><strong>${y}</strong>${state.imports.filter(q=>q.year===y).length} 题 / 未核验</div>`).join('')}</div></section>`+renderAudit();
  }
  function startSession(questions,label) {
    if(!questions.length){const msg=$('#practice-message');if(msg)msg.textContent='没有匹配题目。请调整筛选，或在“我的学习”中导入有权使用的真题。';else showNotice('该范围暂无题目，请选择其他节点或导入题库。');return;}
    session={questions:[...questions],index:0,selected:[],submitted:false,results:[],label,draft:''};
    if(currentPage()==='practice')render();else location.hash='practice';
  }
  function renderAudit() {
    const report=C.auditBank(bank(),H.events);
    return `<section class="panel" aria-label="题库收录审计"><div class="panel-head"><h2>题库收录审计</h2><button data-action="export-audit">导出收录报告</button></div><p class="metric-note">已导入 ${report.importedCount} 题，关联 ${report.coveredNodes.length} / ${H.events.length} 个节点。关联量不代表历年真题收录完整，也不能说明每个节点都曾被考查。</p><div class="table-wrap"><table><thead><tr><th scope="col">年份</th><th scope="col">单选</th><th scope="col">多选</th><th scope="col">分析</th><th scope="col">核验状态</th></tr></thead><tbody>${report.years.map(y=>`<tr><td>${y.year}</td><td>${y.single}</td><td>${y.multiple}</td><td>${y.analysis}</td><td>用户导入 · 未核验</td></tr>`).join('')}</tbody></table></div>${report.duplicates.length?`<div class="warning"><strong>发现 ${report.duplicates.length} 组疑似重复年份与题号</strong>${report.duplicates.map(d=>`<p>${e(d.identity)}：${e(d.ids.join('、'))}</p>`).join('')}请对照来源确认版本；系统不会自动删除题目。</div>`:''}<details><summary>暂无导入真题关联的节点（${report.missingNodes.length}）</summary><p class="metric-note">这里只检查已导入题库的关联；所有节点仍有内置原创练习可用。</p><div class="chip-row">${report.missingNodes.map(x=>`<button class="chip" data-event="${x.id}">${e(x.title)}</button>`).join('')}</div></details></section>`;
  }
  function startConfigured() {
    let questions=bank().filter(q=>(practice.source==='all'||q.origin===practice.source)&&(practice.kind==='all'||q.kind===practice.kind)&&(practice.phase==='all'||q.eventIds.some(id=>eventById(id)?.phase===practice.phase)));
    if(practice.mode==='year')questions=questions.filter(q=>q.origin==='imported'&&q.year===Number(practice.year));
    if(practice.mode==='random')questions=C.shuffled(questions);
    if(practice.mode==='year')questions.sort((a,b)=>a.number.localeCompare(b.number,'zh-CN',{numeric:true}));
    if(practice.count!=='all')questions=questions.slice(0,Number(practice.count));
    startSession(questions,practice.mode==='year'?practice.year+'年已导入题目':practice.mode==='random'?'随机练习':'章节专项');
  }
  function renderSession() {
    if(session.index>=session.questions.length) {
      const correct=session.results.filter(r=>r.correct).length;
      return pageHead('ONE STEP FORWARD · 学有所获','这一组，完成了','错题已自动记录。分析题成绩来自自评，仅作复习参考。')+`<section class="panel"><span class="tag">${e(session.label)}</span><h2 style="margin-top:15px">${correct} / ${session.questions.length} 题判定正确（含自评）</h2><div class="progress-bar"><span style="width:${correct/session.questions.length*100}%"></span></div><div class="practice-actions"><button class="primary" data-action="end-session">重新安排练习</button><button data-action="retry-session">只重做本组错题</button><a class="text-link" href="#mistakes">进入错题复盘 →</a></div>${session.results.map(r=>{const q=session.questions.find(t=>t.id===r.id);return `<div class="list-row"><div><span class="tag ${r.correct?'':'red'}">${r.correct?'已答对':'需复盘'}${q.kind==='analysis'?' · 自评':''}</span><p>${e(q.stem)}</p></div><button data-practice-one="${q.id}">再做一遍</button></div>`;}).join('')}</section>`;
    }
    const q=session.questions[session.index];
    return pageHead('PRACTICE & UNDERSTAND · 以练促学',e(session.label),'理解为什么选，也理解为什么不选。')+`<section class="panel" id="quiz"><div class="quiz-meta"><div class="badges"><span class="tag">${kindName(q.kind)}</span><span class="tag amber">${q.origin==='original'?'原创练习':e(q.year+'年 · 第'+q.number+'题 · 用户导入')}</span></div><small>${session.index+1} / ${session.questions.length}</small></div><div class="progress-bar"><span style="width:${session.index/session.questions.length*100}%"></span></div><h2 class="quiz-stem">${e(q.stem)}</h2>${renderQuestionSource(q)}
      ${q.kind==='analysis'?`<label for="analysis-draft" class="muted">先用自己的话作答，再查看参考要点（本次草稿不存入长期记录）</label><textarea id="analysis-draft" maxlength="20000" ${session.submitted?'readonly':''}>${e(session.draft)}</textarea>`:`<fieldset class="options" style="border:0;padding:0;margin:0"><legend class="muted" style="font-size:12px;margin-bottom:12px">${q.kind==='multiple'?'请选择所有正确选项，多选、漏选均判错':'请选择一个正确选项'}</legend>${q.options.map((option,i)=>`<label class="option ${session.submitted?(q.answer.includes(i)?'right':session.selected.includes(i)?'wrong':''):''}"><input type="${q.kind==='multiple'?'checkbox':'radio'}" name="answer" value="${i}" ${session.selected.includes(i)?'checked':''} ${session.submitted?'disabled':''}><span>${String.fromCharCode(65+i)}. ${e(option)}</span>${session.submitted&&q.answer.includes(i)?'<small>正确选项</small>':''}</label>`).join('')}</fieldset>`}
      <p id="quiz-message" class="inline-msg" role="status"></p><div class="practice-actions">${!session.submitted?`<button class="primary" data-action="submit-answer">${q.kind==='analysis'?'查看参考要点':'提交答案并查看解析'}</button>`:q.kind!=='analysis'||session.results.length>session.index?`<button class="primary" data-action="next-question">${session.index+1===session.questions.length?'完成本组练习':'下一题 →'}</button>`:''}<button data-action="end-session">返回练习设置</button></div>
      ${session.submitted?renderFeedback(q):''}<div class="detail-block"><h3>回到对应历史坐标</h3><div class="chip-row">${q.eventIds.map(id=>`<button class="chip" data-event="${id}">${e(eventById(id).title)} ↗</button>`).join('')}</div></div><details><summary>题目来源</summary><p class="metric-note">${e(q.source)}</p>${q.origin==='imported'?`<p class="metric-note">使用说明：${e(q.rights)}。导入内容由用户提供，项目不保证其真实性、完整性和答案准确性。</p>`:'<p class="metric-note">本题不是历年真题；解析和要点仅供练习。</p>'}</details></section>`;
  }
  function renderFeedback(q) {
    const result=session.results[session.index];
    return `<section class="feedback" aria-label="答案解析"><h3>${q.kind==='analysis'?'参考要点（非官方评分细则）':result.correct?'✓ 回答正确':'本题需要再巩固'}</h3>${q.kind!=='analysis'?`<p><strong>参考答案：${q.answer.map(i=>String.fromCharCode(65+i)).join('、')}</strong>　你的答案：${session.selected.map(i=>String.fromCharCode(65+i)).join('、')}</p>`:''}<p>${e(q.explanation)}</p>${q.points.length?`<ol>${q.points.map(p=>`<li>${e(p)}</li>`).join('')}</ol>`:''}${q.optionNotes?.length?`<h3>选项辨析</h3><ul>${q.optionNotes.map((p,i)=>`<li>${String.fromCharCode(65+i)}：${e(p)}</li>`).join('')}</ul>`:''}${q.kind==='analysis'&&!result?'<p class="metric-note">对照以上要点自评；这里只记录掌握情况，不自动估算卷面得分。</p><div class="practice-actions"><button class="primary" data-self="yes">已覆盖主要要点</button><button data-self="no">还需复习，加入错题</button></div>':''}</section>`;
  }
  function recordAnswer(correct,self=false) {
    const q=session.questions[session.index];
    if(session.results.length>session.index)return;
    const result={id:q.id,correct,at:new Date().toISOString(),self};
    session.results.push(result);state.attempts.push(result);
    if(state.attempts.length>50000)state.attempts.splice(0,state.attempts.length-50000);
    save();
  }
  function submitAnswer() {
    if(!session||session.submitted)return;
    const q=session.questions[session.index];
    if(q.kind==='analysis') {session.draft=$('#analysis-draft').value;session.submitted=true;render();return;}
    session.selected=[...document.querySelectorAll('[name=answer]:checked')].map(input=>Number(input.value));
    if(!session.selected.length){$('#quiz-message').textContent='请先选择答案。';return;}
    session.submitted=true;recordAnswer(C.same(session.selected,q.answer));render();
  }
  function renderMistakes() {
    const ids=C.wrongIds(state.attempts),questions=bank().filter(q=>ids.includes(q.id));
    return pageHead('REVIEW & RETAIN · 查漏补缺','把错题，变成下一次的把握','最新一次答对即移出待复盘列表；历史作答记录仍然保留。')+`<section class="panel"><div class="panel-head"><h2>待复盘 ${questions.length} 题</h2><button class="primary" data-action="review-wrong" ${questions.length?'':'disabled'}>逐题复盘 →</button></div><div class="toolbar"><label>按历史阶段分类 <select id="wrong-phase"><option value="all">全部阶段</option>${H.phases.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></label></div><div id="wrong-list">${mistakeRows(questions)}</div></section>`;
  }
  function mistakeRows(questions) {
    return questions.length?questions.map(q=>`<div class="list-row"><div><div class="badges"><span class="tag">${kindName(q.kind)}</span><span class="tag amber">${q.origin==='original'?'原创':q.year+'年 · 用户导入'}</span><span class="tag red">累计答错 ${state.attempts.filter(a=>a.id===q.id&&!a.correct).length} 次</span></div><h3 style="margin:8px 0">${e(q.stem)}</h3><p>${q.eventIds.map(id=>`<a href="#timeline" data-event="${id}">${e(eventById(id).title)}</a>`).join(' / ')}</p></div><button data-practice-one="${q.id}">重新作答 →</button></div>`).join(''):'<div class="empty">这里还没有待复盘错题。先去练习中心检验一下吧。<br><a href="#practice">开始一组练习 →</a></div>';
  }
  function renderMemory() {
    return pageHead('LESS TO MEMORIZE · MORE TO CONNECT','记住关键，也记住联系','口诀辅助记忆，完整表述用于答题。以下是复习整理，不是押题预测。')+`<div class="grid-cards">${H.memory.map(m=>`<section class="panel memory-card"><h3>${e(m.title)}</h3><p>${e(m.body)}</p><div class="chip-row">${m.ids.filter(eventById).map(id=>`<a href="#timeline" data-event="${id}">${e(eventById(id).title)} ↗</a>`).join('')}</div></section>`).join('')}</div>${H.comparisons.map(item=>renderComparison(item)).join('')}`;
  }
  function renderProgress() {
    const mastered=H.events.filter(x=>mark(x.id).mastered).length,objective=state.attempts.filter(a=>!a.self),correct=objective.filter(a=>a.correct).length;
    const today=C.localDay(),days=Array.from({length:28},(_,i)=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-27+i);return C.localDay(d);});
    return pageHead('YOUR OWN PACE · 日积月累','每一步，都算数','学习记录属于你，保存在当前浏览器中。请定期导出备份。')+statCards()+`<div class="two-col"><div><section class="panel"><div class="panel-head"><h2>阶段掌握情况</h2><span class="tag">自评掌握 ${mastered} / ${H.events.length}</span></div>${H.phases.map(p=>{const all=H.events.filter(x=>x.phase===p.id),n=all.filter(x=>mark(x.id).mastered).length;return `<div class="list-row"><div style="flex:1"><h3>${p.name} <small>${n} / ${all.length}</small></h3><div class="progress-bar"><span style="width:${n/all.length*100}%"></span></div></div><button data-phase-jump="${p.id}">复习 →</button></div>`;}).join('')}</section><section class="panel"><h2>我的收藏与笔记</h2>${H.events.filter(x=>mark(x.id).favorite||mark(x.id).difficult||mark(x.id).note).map(x=>`<div class="list-row"><div><h3>${e(x.title)} ${mark(x.id).favorite?'☆':''} ${mark(x.id).difficult?'⚑':''}</h3><p>${e(mark(x.id).note.slice(0,90))||'已标记，等待补充笔记'}</p></div><button data-event="${x.id}">查看</button></div>`).join('')||'<div class="empty">在时间轴中收藏考点、标记重难点或写下第一条笔记。</div>'}</section></div><aside><section class="panel side-card"><h3>记忆打卡</h3><p>最近28天 · 按设备本地日期记录</p><div class="checkin-days">${days.map(d=>`<span class="day ${state.checkins.includes(d)?'done':''}" title="${d}${state.checkins.includes(d)?' 已打卡':' 未打卡'}">${d.slice(-2)}</span>`).join('')}</div><button class="primary" style="margin-top:18px" data-action="checkin">${state.checkins.includes(today)?'今日已打卡 ✓':'完成今日打卡'}</button><p class="metric-note">昨日已打卡时，今日未打卡仍显示截至昨日的连续天数。</p></section><section class="panel side-card"><h3>练习统计</h3><div class="big">${objective.length?Math.round(correct/objective.length*100)+'%':'—'}</div><p>客观题累计正确率<br>客观作答 ${objective.length} 次 · 正确 ${correct} 次<br>分析题自评 ${state.attempts.filter(a=>a.self).length} 次</p><p class="metric-note">重复作答计入次数，正确率不代表已掌握考点比例。</p></section></aside></div>
      <section class="panel" id="data-tools"><h2>数据备份与题库导入</h2><p class="metric-note">备份含笔记、收藏、错题记录和导入题库，分享前请检查个人信息。导入操作先完整校验，失败不会修改已有记录。</p><div class="practice-actions"><button class="primary" data-action="export-backup">导出学习备份</button><button data-action="export-raw">导出浏览器原始存档</button><button data-action="export-events">导出节点ID清单</button></div><div class="form-grid" style="margin-top:15px"><label class="upload">恢复学习备份（将覆盖本机全部记录）<input id="restore-file" type="file" accept=".json,application/json"></label><label class="upload">追加导入真题（带来源与使用说明）<input id="questions-file" type="file" accept=".json,application/json"></label></div><p id="data-message" class="inline-msg" role="status"></p><details><summary>导入格式与限制</summary><p>题库文件为 { "version":1, "questions":[...] }。每题需有 id、year、number、source、rights、eventIds、kind、stem、options、answer、explanation；分析题另需 points。详见项目 docs/DATA.md。最多3000道导入题、文件最大10MB；重复ID会拒绝整批导入。用户导入不等于官方核验。</p></details></section>`;
  }
  function renderAbout() {
    return pageHead('OPEN & LOCAL · 自由学习','关于史序','以时间为线，以理解为本。一个可离线使用的公益开源复习工具。')+`<section class="panel prose"><h2>先读这份内容说明</h2><p>本项目是中国近现代史纲要的辅助复习工具，覆盖所列历史阶段，并补充社会主义建设探索阶段。历史阶段存在交叉，单个事件归入一个便于复习的主题，不意味着阶段之间互不重叠。</p><p>内置 ${H.events.length} 个事件节点、${B.questions.length} 道原创练习和 ${H.memory.length} 组速记。建议星级由项目编写者设置，并非官方“必考”承诺。分析题思路与参考要点均为学习材料，不是官方评分细则。</p><div class="warning"><strong>尚未完成的内容目标</strong>已建立2010—2025年${R.records.length}道公开整理版题号—考点索引，每题附出处，但没有内置完整原题与官方答案，也没有完成官方原卷级核验、逐条大纲对应与超纲审校。官方大纲是出版材料，本次仅核验出版信息。请使用报考年度官方大纲和正版教材检查范围；导入题库的真实性与使用权限由用户自行确认。</div><h3>快速上手</h3><ul><li>筛选历史阶段，拖动或滑动时间轴，点击节点查看考点。</li><li>使用星级安排精力，通过收藏、重难点、掌握标记和笔记构建自己的复习路线。</li><li>练习中心支持章节、随机和导入真题年份套卷。答错题自动收录，再次答对移出待复盘列表。</li><li>在我的学习中打卡、查看进度和备份；分析题需要先作答，再对照要点自主评价。</li><li>时间轴支持滚轮、鼠标拖动、左右方向键、触屏滑动、双指缩放和缩放按钮；年份跳转会清除筛选。</li></ul><h3>数据保存在什么地方？</h3><p>知识点和原创题库随项目文件分发；收藏、笔记、打卡、作答记录和导入题库保存在浏览器 LocalStorage 中，不上传服务器。离线文件直接可用；HTTP(S)部署可由 Service Worker 缓存后再次离线访问。浏览器隐私设置可能阻止持久化，保存失败时会显示提示。</p><p>不同浏览器、设备、部署域名和 file:// 地址可能使用不同存储空间，请通过备份迁移。清理浏览器数据会删除记录；无痕窗口关闭后通常不会保留。首次离线访问部署网址前，须在联网时打开并让缓存完成。</p><h3>扩展与开源</h3><p>代码和本项目原创内容采用 MIT 协议。外部参考材料与用户导入题库保留原权利状态，不因导入而变成 MIT 内容。可在 data/history.js 的 modules 注册毛中特、马原和思法扩展模块；当前仅实现史纲，不展示未实现的课程入口。</p></section><section class="panel"><h2>参考与核验入口</h2><p class="metric-note">这些链接提供核对入口，并不表示每条笔记已经通过专家审定。最后整理时间：${H.reviewedAt}。</p><ul class="source-list">${H.sources.map(s=>`<li><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} ↗</a><p>${e(s.note)}</p></li>`).join('')}</ul></section>`;
  }
  function download(name,data,type='application/json') {
    const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}));
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importFile(input,backup) {
    const file=input.files[0];if(!file)return;
    const msg=$('#data-message');
    try {
      if(file.size>10*1024*1024)throw new Error('文件超过10MB限制。');
      const raw=JSON.parse(await file.text());
      if(backup) {const restored=C.validateState(raw,H.events,B.questions);state=restored;session=null;protectedStore=false;saveWarning='';save();applySettings();render();showNotice('备份已恢复；请核对收藏、笔记与练习记录。');}
      else {
        if(raw.version!==1)throw new Error('题库version须为1。');
        const items=C.validateQuestions(raw.questions,H.events,bank().map(q=>q.id));
        if(state.imports.length+items.length>3000)throw new Error('导入题库总量不能超过3000题。');
        state.imports.push(...items);save();msg.textContent='成功追加 '+items.length+' 题（用户导入，未由项目核验）。';
      }
    } catch(error) {msg.textContent='导入失败，原有记录未更改：'+error.message;}
    input.value='';
  }
  // 使用事件委托集中管理动态页面，避免重复绑定监听器或保留已销毁页面引用。
  document.addEventListener('click',ev=>{
    if(ev.target.closest('.skip')) {ev.preventDefault();$('#main').focus();$('#main').scrollIntoView({block:'start'});return;}
    const button=ev.target.closest('button,a');if(!button)return;
    if(button.dataset.event){ev.preventDefault();openEvent(button.dataset.event);return;}
    if(button.dataset.node){filters.selected=button.dataset.node;updateTimeline();return;}
    if(button.dataset.phase){filters.phase=button.dataset.phase;updateTimeline(true);return;}
    if(button.dataset.phaseJump){filters.phase=button.dataset.phaseJump;filters.query='';filters.mark='all';filters.type='all';navigate('timeline');return;}
    if(button.dataset.mark){const m={...mark(filters.selected)};m[button.dataset.mark]=!m[button.dataset.mark];state.marks[filters.selected]=m;const saved=save();updateTimeline();if(saved)showNotice('学习标记已保存');return;}
    if(button.dataset.practiceEvent){const id=button.dataset.practiceEvent;startSession(bank().filter(q=>q.eventIds.includes(id)),eventById(id).title+' · 关联练习');return;}
    if(button.dataset.practiceOne){const q=bank().find(t=>t.id===button.dataset.practiceOne);if(q)startSession([q],'单题复盘');return;}
    if(button.dataset.examEvent){Object.assign(examFilters,{year:'all',kind:'all',phase:'all',scope:'all',query:'',event:button.dataset.examEvent});navigate('exams');return;}
    if(button.dataset.self){if(session?.submitted&&session.questions[session.index]?.kind==='analysis'){recordAnswer(button.dataset.self==='yes',true);render();}return;}
    const action=button.dataset.action;
    if(action==='zoom-in'||action==='zoom-out')resizeTimeline(filters.zoom+(action==='zoom-in'?.1:-.1));
    if(action==='pan-left'||action==='pan-right')$('#timeline-scroll').scrollLeft+=action==='pan-left'?-420:420;
    if(action==='reset-filters'){Object.assign(filters,{phase:'all',query:'',type:'all',mark:'all'});render();}
    if(action==='checkin'){const today=C.localDay();if(!state.checkins.includes(today)){state.checkins.push(today);save();render();showNotice('今日记忆打卡完成。');}else showNotice('今天已经打卡，继续保持。');}
    if(action==='start-practice')startConfigured();
    if(action==='submit-answer')submitAnswer();
    if(action==='next-question'&&session&&session.results.length>session.index){session.index++;session.selected=[];session.submitted=false;session.draft='';render();$('#main').scrollIntoView({block:'start'});}
    if(action==='end-session'){session=null;render();}
    if(action==='retry-session'){const wrong=new Set(session.results.filter(r=>!r.correct).map(r=>r.id));startSession(session.questions.filter(q=>wrong.has(q.id)),'本组错题重做');}
    if(action==='review-wrong'){const ids=C.wrongIds(state.attempts),phase=$('#wrong-phase')?.value||'all';startSession(bank().filter(q=>ids.includes(q.id)&&(phase==='all'||q.eventIds.some(id=>eventById(id).phase===phase))),'错题复盘');}
    if(action==='export-backup')download('shixu-backup-'+C.localDay()+'.json',state);
    if(action==='export-events')download('shixu-event-ids.json',H.events.map(x=>({id:x.id,date:x.date,title:x.title,phase:x.phase})));
    if(action==='export-audit')download('shixu-bank-audit-'+C.localDay()+'.json',C.auditBank(bank(),H.events));
    if(action==='export-exam-index')download('shixu-exam-knowledge-map-2010-2025.json',R);
    if(action==='clear-exam-filters'){Object.assign(examFilters,{year:'all',kind:'all',phase:'all',scope:'all',event:'all',query:''});render();}
    if(action==='export-raw'){try{download('shixu-raw-storage.json',localStorage.getItem(KEY)||'null');}catch(error){showNotice('无法读取原存档：'+error.message);}}
  });
  document.addEventListener('input',ev=>{
    if(ev.target.id==='search'){filters.query=ev.target.value;filters.selected=null;updateTimeline(true);}
    if(ev.target.id==='exam-search'){examFilters.query=ev.target.value;updateExamResults();}
    if(ev.target.id==='event-note') {state.marks[filters.selected]={...mark(filters.selected),note:ev.target.value};$('#note-status').textContent=save()?'已自动保存 · '+ev.target.value.length+' / 10000字':'未能持久保存，请导出备份。';}
    if(ev.target.id==='analysis-draft'&&session)session.draft=ev.target.value;
    if(ev.target.name==='answer'&&session)session.selected=[...document.querySelectorAll('[name=answer]:checked')].map(x=>Number(x.value));
  });
  document.addEventListener('change',ev=>{
    const input=ev.target;
    if(input.id==='type-filter'){filters.type=input.value;updateTimeline(true);}
    if(input.id==='mark-filter'){filters.mark=input.value;updateTimeline(true);}
    if(input.id==='jump')openEvent(input.value);
    if(input.dataset.practiceFilter)practice[input.dataset.practiceFilter]=input.value;
    if(input.dataset.examFilter){examFilters[input.dataset.examFilter]=input.value;updateExamResults();}
    if(input.id==='wrong-phase'){const ids=C.wrongIds(state.attempts);$('#wrong-list').innerHTML=mistakeRows(bank().filter(q=>ids.includes(q.id)&&(input.value==='all'||q.eventIds.some(id=>eventById(id).phase===input.value))));}
    if(input.id==='questions-file')importFile(input,false);
    if(input.id==='restore-file')importFile(input,true);
  });
  $('#theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';save();applySettings();});
  $('#font-toggle').addEventListener('click',()=>{state.font={16:18,18:20,20:16}[state.font];save();applySettings();});
  window.addEventListener('hashchange',()=>{render();if(scrollToDetail&&currentPage()==='timeline'){$('#detail').scrollIntoView({block:'start'});scrollToDetail=false;}else window.scrollTo(0,0);});
  // 多标签写入冲突不静默覆盖：检测到其他页面修改后，当前页进入只读存档保护。
  window.addEventListener('storage',ev=>{if(ev.key===KEY){protectedStore=true;saveWarning='另一标签页已更改学习记录。本页临时更改不会覆盖存档；请导出本页备份后刷新，以加载最新记录。';syncSaveWarning();}});
  render();
  if(!protectedStore) {try{localStorage.setItem(KEY,JSON.stringify(state));}catch(error){saveWarning='浏览器阻止本地保存；当前为临时学习模式，请导出备份。';syncSaveWarning();}}
  const offlineStatus=text=>$('#offline-status').textContent=text;
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)) {
    offlineStatus('正在准备离线缓存');
    const refreshOfflineStatus=()=>offlineStatus(navigator.serviceWorker.controller?'离线缓存已接管':'缓存已准备，刷新后启用');
    navigator.serviceWorker.addEventListener('controllerchange',refreshOfflineStatus);
    navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(refreshOfflineStatus).catch(()=>{
      offlineStatus('离线缓存未启用');showNotice('离线缓存未启用；可下载全部源码后直接打开index.html。');
    });
  } else offlineStatus(location.protocol==='file:'?'本地文件 · 可离线使用':'浏览器未提供离线缓存');
}());
