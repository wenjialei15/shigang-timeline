/* 生成可分享的对应表；只输出项目编写的题意摘要、知识点和出处，不输出来源网页全文。 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..'),context={window:{}};
vm.createContext(context);
for(const file of ['history','exams'])vm.runInContext(fs.readFileSync(path.join(root,'data',file+'.js'),'utf8'),context);
const {HISTORY:H,EXAM_INDEX:R}=context.window;
const names=ids=>ids.map(id=>{const x=H.events.find(x=>x.id===id);if(!x)throw new Error('未知节点 '+id);return `${x.title}（${id}）`;}).join('、');
const markdown=value=>String(value).replace(/\|/g,'\\|').replace(/\n/g,' ');
const kindName={single:'单选',multiple:'多选',analysis:'分析'};
const lines=['# 2010—2025考研政治史纲真题—知识点对应表','',
  `共16个试卷年份、${R.records.length}道题号索引（含历史交叉考点），分析题按大题计数，两个小问分别对应。`,
  '',
  '**这是公开整理版的考点索引，不是原题全文、官方答案或官方逐题学科审定。** 年份按试卷招生考试年份，不按实际考试公历月份。未把引用历史材料的整张政治卷所有理论题都算作史纲。',
  '',
  '每行末尾列出出处。第一项是公开文字整理题目入口，第二项为PDF、文字整理或考情对照；考情点评只用于背景对照，不声称提供完整原题。PDF页码采用文件页码。来源材料的转录差异不自动转化为本项目的标准答案。',
  '',
  `整理日期：${R.reviewedAt}。对应JSON与CSV文件同目录提供。`,''];
const csv=[['年份','题号','题型','范围','考点摘要（非原题全文）','对应知识点及ID','小问对应','出处','来源状态','转录备注']];
for(const year of R.manifest){
  lines.push(`## ${year.year}年（${year.numbers.length}道）`,'','| 题号 | 题型 | 考点摘要 | 对应知识点 | 出处 |','| --- | --- | --- | --- | --- |');
  for(const ref of R.records.filter(q=>q.year===year.year)){
    const sourceLinks=ref.sources.map(s=>`[${markdown(s.name)}](${s.url}) · ${markdown(s.locator)}`).join('<br>');
    const partText=ref.parts.map(part=>`小问${part.number}：${part.topic} → ${names(part.eventIds)}`).join('；');
    lines.push(`| ${ref.number} | ${kindName[ref.kind]}${ref.scope==='cross'?' · 交叉':''} | ${markdown(ref.topic)}${ref.notes?'<br>注意：'+markdown(ref.notes):''} | ${markdown(names(ref.eventIds))}${partText?'<br>'+markdown(partText):''} | ${sourceLinks} |`);
    csv.push([ref.year,ref.number,kindName[ref.kind],ref.scope==='cross'?'历史交叉':'史纲主线',ref.topic,names(ref.eventIds),partText,ref.sources.map(s=>s.name+'：'+s.url+'（'+s.locator+'）').join('；'),'公开整理版，非官方原卷核验',ref.notes]);
  }
  lines.push('');
}
lines.push('## 使用边界','','- 来源链接用于核对原题；题目摘要不能替代原题材料、选项和设问。','- 不提供从公开整理页直接抄录的第三方解析或官方评分承诺。','- 新增或更正映射时，应同时核对原卷年份、题号、小问与节点，不得把考试后才发生的事件标成当年的考核史实。','- 原创练习与本索引分开；只有用户导入的完整题目进入历年真题刷题队列。','');
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs','EXAM_MAP_2010_2025.md'),lines.join('\n'));
fs.writeFileSync(path.join(root,'docs','exam-map-2010-2025.csv'),'\ufeff'+csv.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n'));
fs.writeFileSync(path.join(root,'docs','exam-map-2010-2025.json'),JSON.stringify(R,null,2));
console.log(`已导出${R.records.length}道索引、${H.events.length}个知识点的对应表（Markdown / CSV / JSON）。`);
