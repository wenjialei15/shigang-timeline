"""开发研究工具：读取公开文字整理页，仅保存在.gitignore忽略的.research。
不把来源网页、题目全文和第三方解析打包进开源发行版。
运行此脚本不代表已核验原卷；它只为逐题人工核对提供输入。
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from html.parser import HTMLParser
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / '.research'
TARGET.mkdir(exist_ok=True)

class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
        if tag in ('p','div','h1','h2','h3','h4','li','br','article','section'): self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script','style'): self.skip = max(0,self.skip-1)
        if tag in ('p','div','h1','h2','h3','h4','li','article','section'): self.parts.append('\n')

    def handle_data(self, data):
        if not self.skip:self.parts.append(data)

def collect(year):
    url = 'https://zhenti.zalize.com/zhenti/' + str(year)
    with urllib.request.urlopen(url,timeout=35) as response:
        page = response.read().decode('utf-8')
    (TARGET / (str(year)+'.html')).write_text(page,encoding='utf-8')
    parser=TextParser();parser.feed(page)
    text=re.sub(r'\n\s*\n+', '\n', ''.join(parser.parts))
    (TARGET / (str(year)+'.txt')).write_text(text,encoding='utf-8')
    return {'year':year,'url':url,'size':len(page)}

if __name__=='__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(collect,range(2010,2026)))
    (TARGET/'sources.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=True))
