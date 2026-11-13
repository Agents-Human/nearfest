from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json
root=Path(__file__).resolve().parents[1];pub=root/'public';scripts=[];missing=[];external=[]
class Parser(HTMLParser):
 def __init__(self,path):super().__init__();self.path=path;self.inscript=False;self.code='';self.typ=''
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script':self.inscript=True;self.code='';self.typ=a.get('type','')
  if tag in ['script','link','img','audio','source']:
   url=a.get('src',a.get('href',''))
   if not url or url.startswith(('data:','blob:','#')):return
   if url.startswith(('https:','http:','//')):
    if tag=='script':external.append([str(self.path.relative_to(pub)),url])
    return
   q=unquote(urlsplit(url).path);f=pub/q.lstrip('/') if q.startswith('/') else self.path.parent/q
   if not f.exists() and a.get('rel')!='manifest':missing.append([str(self.path.relative_to(pub)),tag,url])
 def handle_data(self,s):
  if self.inscript:self.code+=s
 def handle_endtag(self,tag):
  if tag=='script' and self.inscript:
   if self.code.strip() and self.typ not in ['module','application/json','application/ld+json','x-shader/x-vertex','x-shader/x-fragment','importmap']:scripts.append({'path':str(self.path.relative_to(pub)),'code':self.code})
   self.inscript=False
for g in json.loads((root/'server/library-catalog.json').read_text()):
 p=pub/g['launch'].split('?')[0].lstrip('/');Parser(p).feed(p.read_text())
import subprocess
check=subprocess.run(['node','--input-type=module','-e',"import {Script} from 'node:vm';let input='';for await(const chunk of process.stdin)input+=chunk;const failures=[];for(const s of JSON.parse(input)){try{new Script(s.code,{filename:s.path});}catch(e){failures.push({path:s.path,error:e.message});}}console.log(JSON.stringify(failures));"],input=json.dumps(scripts),capture_output=True,text=True,check=True)
failures=json.loads(check.stdout)
report={'entrypoints':len(json.loads((root/'server/library-catalog.json').read_text())),'missing_assets':missing,'external_scripts':external,'inline_scripts_compiled':len(scripts),'syntax_errors':failures,'method':'Parse launch HTML, resolve static asset references, compile classic inline scripts without execution. Does not certify gameplay or dynamic dependencies.'}
(root/'evidence/library-static-audit.json').write_text(json.dumps(report,indent=2)+'\n')
if missing or external or failures:raise SystemExit(json.dumps(report,indent=2))
print(json.dumps({'entrypoints':len(json.loads((root/'server/library-catalog.json').read_text())),'missing':missing,'external_scripts':external,'inline_scripts_to_check':len(scripts)},indent=2))
