"""Import reviewed, licensed source snapshots. Never runs upstream build scripts.

Usage: python3 scripts/import-library.py /tmp/slotvend-library
Source snapshots and fetched notices are inputs; manifest hashes pin actual shipped bytes.
"""
from pathlib import Path
import sys,json,re,hashlib,shutil,html,tarfile,subprocess

cache=Path(sys.argv[1]); root=Path(__file__).resolve().parents[1]
out=root/'public/library'; out.mkdir(exist_ok=True)
for old in out.iterdir():
 if old.name=='runtime.js':continue
 if old.is_dir():shutil.rmtree(old)
 else:old.unlink()
catalog=[]; rejected=[]; titles={'2048','memory','lightsout','slidingpuzzle','codebreaker'}; hashes=set()
def digest(b):return hashlib.sha256(b).hexdigest()
def normalized(s):return re.sub(r'[^a-z0-9]','',re.sub(r'(?i)^littlejs\s*[-—:]?\s*','',s).lower())
def slug(s):return re.sub('[^a-z0-9]+','-',s.lower()).strip('-')
def revision(p):
 if (p/'SOURCE-REVISION').exists():return (p/'SOURCE-REVISION').read_text().strip()
 archive=p.with_suffix('.tar.gz')
 if archive.exists():
  with tarfile.open(archive) as t:return t.next().name.split('/')[0]
 return 'see-file-hashes'
def reject(id,reason):rejected.append({'id':id,'reason':reason})
blocked=re.compile(r'(?i)\b(?:porn|sexual|cocaine|heroin|cannabis|marijuana|orgasm|penis|vagina|sex|drugs|blood|gore|naked|nude|drug)\b')
def eligible(id,title,code):
 if normalized(title) in titles:return reject(id,'Duplicate normalized title')
 if digest(code.encode()) in hashes:return reject(id,'Duplicate game code')
 if blocked.search(title+' '+code):return reject(id,'Excluded by content screen; requires review')
 if re.search(r'new\s+WebSocket|socket\.io|\bio\(',code):return reject(id,'Requires a separate network service')
 titles.add(normalized(title));hashes.add(digest(code.encode()));return True
def copy_tree(src,dst):
 for f in src.rglob('*'):
  if not f.is_file() or f.is_symlink() or f.suffix.lower() in ['.zip','.map','.md','.ts','.zip_'] or f.name.startswith('___'):continue
  if any(p in ['node_modules','.git','review','tests'] for p in f.relative_to(src).parts):continue
  target=dst/f.relative_to(src);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
def notice(name,text):
 p=out/'credits'/f'{name}.txt';p.parent.mkdir(exist_ok=True);p.write_text(text);return '/library/credits/'+p.name
def entry(id,title,path,author,source,rev,license_url,license='MIT',thumbnail=None,controls='Follow the controls on the game screen.',description=None,genre='Arcade',local_players=1):
 category='Gaming'
 if genre=='Maths':category='Maths'
 if genre=='Science':category='Science'
 catalog.append(dict(id=id,title=title,engine='imported',standalone=True,kind='puzzle' if genre in ['Puzzles','Board games','Words','Maths'] else 'game',category=category,label=genre,genre=genre,description=description or 'A complete independent browser game. Jump in and learn as you play.',rounds=0,seconds=0,multiplayer=False,group_challenge=True,local_players=local_players,controls=controls,author=author,source=source,revision=rev,license=license,license_url=license_url,thumbnail=thumbnail,launch='/library/'+path,collection=source.split('/')[-1]))
def genre_for(title):
 t=title.lower()
 if re.search(r'sum|math|abacus|number',t):return 'Maths'
 if re.search(r'word|anagram|antonym|cipher',t):return 'Words'
 if re.search(r'chess|checkers|reversi|mancala|ludo|backgammon|connect.?4|dots and|tic.?tac|gomoku',t):return 'Board games'
 if re.search(r'puzzle|sudoku|sokoban|mine.?sweep|nonogram|tangram|match|maze|light.?out|logic',t):return 'Puzzles'
 if re.search(r'pinball|golf|tennis|soccer|basketball|bowling|pool|billiard',t):return 'Sports games'
 if re.search(r'rac|drift|drive|slalom',t):return 'Racing'
 return 'Arcade'

# Chogan has explicit controls, icons and local multiplayer metadata; prefer it for duplicates.
p=cache/'research/choganhq-chogan';rev=revision(p);lic=notice('chogan',(p/'LICENSE').read_text())
for part in ['lib','fonts']:copy_tree(p/'www'/part,out/'chogan'/part)
shutil.copyfile(p/'www/version.js',out/'chogan/version.js')
for g in json.loads((p/'www/games.json').read_text())['games']:
 src=p/'www'/g['path'];code=src.read_text();title=g['name']['en'];id='chogan-'+g['id']
 if not eligible(id,title,code):continue
 copy_tree(src.parent,out/'chogan'/Path(g['path']).parent)
 entry(id,title,'chogan/'+g['path'],'Chogan','https://github.com/choganhq/chogan',rev,lic,thumbnail='/library/chogan/'+g['icon'],description=g['summary']['en'],genre='Puzzles' if g['cat']=='puzzle' else genre_for(title),controls='Touch or mouse. Instructions are inside the game.',local_players=g['people'])

# ABAGames: one source game per title, excluding templates and alternate revisions.
deps=out/'deps';deps.mkdir(exist_ok=True)
for p in (cache/'deps').iterdir():
 copy_tree(p,deps/p.name)
 if not list(p.glob('*[Ll][Ii][Cc][Ee][Nn][Ss][Ee]*')):raise Exception('Missing dependency licence: '+p.name)
for folder in ['crisp-game-lib-games','crisp-game-lib-11-games','crisp-game-lib-12-games','claude-one-button-game-creation']:
 p=cache/('abagames-'+folder); docs=p/'docs';rev=revision(p);lic=notice(folder,(p/'LICENSE.txt').read_text());dest=out/'aba'/folder
 dest.mkdir(parents=True,exist_ok=True)
 launcher=re.sub(r'<!--.*?-->','',(docs/'index.html').read_text(),flags=re.S)
 launcher=launcher.replace('https://unpkg.com/','/library/deps/')
 # Each engine's own loader selects a distinct main.js using the slug in the query.
 (dest/'index.html').write_text(launcher)
 for f in docs.glob('*.js'):shutil.copyfile(f,dest/f.name)
 for d in sorted(docs.iterdir()):
  if not d.is_dir() or d.name.startswith(('_','-','ref_','sample')) or not (d/'main.js').exists():continue
  code=(d/'main.js').read_text();m=re.search(r'\btitle\s*=\s*["\x27`]([^"\x27`]+)',code)
  if not m:continue
  title=m[1].replace('\\n',' ').strip();id='aba-'+slug(title)
  if not eligible(id,title,code):continue
  copy_tree(d,dest/d.name)
  game_html=launcher.replace('src="bundle.js"','src="../bundle.js?v=slotvend-local-audio"')
  game_html=re.sub(r'<script>\s*addGameScript\(\);','<script src="main.js"></script><script>',game_html)
  game_html=game_html.replace('<title>crisp-game-lib</title>','<title>'+html.escape(title)+'</title>')
  (dest/d.name/'index.html').write_text(game_html)
  shot=next(iter(d.glob('screenshot.*')),None)
  if not shot:shot=next(iter(d.glob('*.gif')),None)
  entry(id,title,'aba/'+folder+'/'+d.name+'/index.html','ABA Games','https://github.com/abagames/'+folder,rev,lic,thumbnail='/library/aba/'+folder+'/'+d.name+'/'+shot.name if shot else None,controls='Tap, click or hold. The title screen explains this game’s move.',genre=genre_for(title))

# Standalone ABAGames with their own launchers.
p=cache/'abagames-agentic-gamedev-games';lic=notice('aba-agentic',(p/'LICENSE').read_text())
for d in sorted((p/'docs').iterdir()):
 if not d.is_dir() or not (d/'index.html').exists():continue
 h=(d/'index.html').read_text();m=re.search(r'<title>(.*?)</title>',h,re.S|re.I)
 if not m:continue
 title=html.unescape(m[1]).strip();code='\n'.join(f.read_text() for f in d.glob('*.js'));id='aba-'+slug(title)
 if not eligible(id,title,code):continue
 copy_tree(d,out/'aba/agentic'/d.name)
 shot=next(iter(d.glob('screenshot.*')),None)
 entry(id,title,'aba/agentic/'+d.name+'/index.html','ABA Games','https://github.com/abagames/agentic-gamedev-games',revision(p),lic,thumbnail='/library/aba/agentic/'+d.name+'/'+shot.name if shot else None,genre=genre_for(title))

# The js13k archive is NOT blanket MIT. Only independently fetched game notices qualify.
p=cache/'js13kGames-games';rev=revision(p)
for g in json.loads((cache/'licensed-js13k.json').read_text()):
 id='js13k-'+g['slug'];src=p/'games'/g['slug'];h=(src/'index.html').read_text(errors='replace')
 if not g.get('license_text'):reject(id,'No full licence notice found');continue
 if len(g['license_text'])<150 or 'copyright' not in g['license_text'].lower() and g['spdx'] not in ['Unlicense','CC0-1.0','WTFPL']:reject(id,'Licence requires manual review');continue
 title=(g.get('description') or g['slug']).split(' — ')[0]
 m=re.search(r'<title>(.*?)</title>',h,re.I|re.S)
 if m:title=html.unescape(re.split(r'\s*[-|–]\s*js13k|\s*[-|–]\s*JS13K',m[1])[0]).strip()
 if not title or len(title)>100:title=g['slug'].replace('-',' ').title()
 code='\n'.join(f.read_text(errors='replace') for f in src.rglob('*') if f.suffix in ['.html','.js'] and not f.name.startswith('___'))
 if re.search(r'<script[^>]+src\s*=\s*["\x27]?(?:https?:)?//',code,re.I):reject(id,'External script dependency needs a separate review');continue
 if re.search(r'<script[^>]+src=[\"\']/(?:20[0-9]{2}/webxr|socket)',code):reject(id,'Requires an unbundled WebXR or network engine');continue
 if not eligible(id,title,code):continue
 dest=out/'js13k'/g['slug'];copy_tree(src,dest)
 author_match=re.search(r'by\s+(@[^ .]+)',g.get('description') or '')
 author=author_match[1] if author_match else 'js13k contributor'
 l=notice(id,g['license_text']+'\n\nUpstream: '+g['repository']+'\nNotice source: '+g['license_url']+'\n'+g.get('notice_text',''))
 shot=next(iter(src.glob('.t.*')),None)
 if shot:shutil.copyfile(shot,dest/('cover'+shot.suffix))
 entry(id,title,'js13k/'+g['slug']+'/index.html',author,g['repository'],rev,l,g['spdx'],thumbnail='/library/js13k/'+g['slug']+'/cover'+shot.suffix if shot else None,genre=genre_for(title))

# Original single-file titles; no difficulty/seed variants counted.
p=cache/'research/Srikanth-AD-100games';lic=notice('srikanth-100games',(p/'LICENSE').read_text())
for g in json.loads((cache/'research/100games-entrypoints.json').read_text()):
 src=p/g['path'];title=g['title'];id='hundred-'+src.parent.name;code=src.read_text()
 if not eligible(id,title,code):continue
 copy_tree(src.parent,out/'hundred'/src.parent.name)
 entry(id,title,'hundred/'+g['path'],'Srikanth-AD','https://github.com/Srikanth-AD/100games',revision(p),lic,genre=genre_for(title),controls='Use the touch, mouse or keyboard controls shown on the title screen.')

p=cache/'research/KilledByAPixel-LittleJSArcade';lic=notice('littlejs-arcade',(p/'LICENSE').read_text())
for part in ['templates','dist']:copy_tree(p/part,out/'littlejs'/part)
for f in (p/'games').iterdir():
 if f.is_file() and f.suffix!='.html':
  (out/'littlejs/games').mkdir(parents=True,exist_ok=True);shutil.copyfile(f,out/'littlejs/games'/f.name)
local={'chess','checkers','connect4','reversi','go','captureGo','gemFighter'}
for g in json.loads((cache/'research/littlejs-entrypoints.json').read_text()):
 src=p/g['path'];title=re.sub(r'^LittleJS\s*[-—:]?\s*','',g['title']);id='littlejs-'+src.stem;code=src.read_text()
 if src.stem=='musicSequencer':continue
 if not eligible(id,title,code):continue
 shutil.copyfile(src,out/'littlejs'/g['path'])
 entry(id,title,'littlejs/'+g['path'],'Frank Force','https://github.com/KilledByAPixel/LittleJSArcade',revision(p),lic,genre=genre_for(title),local_players=2 if src.stem in local else 1)

# Add an isolated runtime before upstream scripts. Optional remote fonts and navigation do not
# participate in gameplay; the server CSP blocks remote network and parent access entirely.
for f in out.rglob('*.html'):
 text=f.read_text(errors='replace')
 text=re.sub(r'<link\b[^>]*href=["\x27](?:https?:)?//[^>]*>','',text,flags=re.I)
 bootstrap='<script src="/library/runtime.js"></script>'
 text=re.sub(r'^(<!doctype[^>]*>)?',lambda m:(m[0] or '')+bootstrap,text,count=1,flags=re.I)
 f.write_text(text)

# Bundle the audio worklets; the game iframe does not contact remote hosts.
for f in (out/'aba').rglob('bundle.js'):
 f.write_text(f.read_text().replace('https://abagames.github.io/algo-chip/worklets/','/library/deps/algo-chip@1.0.2/packages/core/worklets/'))

# Code-native cover cards for upstream titles which do not supply artwork.
palette=['#ffcb6b','#b9d5ff','#ffc0c8','#cfbafa','#a9ddc3']
for g in catalog:
 if g['thumbnail']:continue
 color=palette[int(digest(g['id'].encode())[:6],16)%len(palette)]
 title=html.escape(g['title'][:24]);mark=html.escape(g['genre'].upper());p=out/'covers'/(g['id']+'.svg');p.parent.mkdir(exist_ok=True)
 p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="{color}"/><circle cx="530" cy="60" r="130" fill="#fff" opacity=".35"/><g transform="translate(230 45) rotate(-8 90 90)" fill="#fff8e9" stroke="#242321" stroke-width="7"><rect x="0" y="5" width="180" height="150" rx="32"/><path d="M42 78h45m-23-23v46" fill="none" stroke-linecap="round"/><circle cx="133" cy="66" r="8"/><circle cx="150" cy="92" r="8"/></g><text x="320" y="268" text-anchor="middle" font-family="Georgia,serif" font-size="35" font-weight="bold" fill="#242321">{title}</text><text x="320" y="312" text-anchor="middle" font-family="sans-serif" font-size="15" letter-spacing="3" fill="#242321">{mark}</text><path d="m60 65 10 22 24 4-18 16 4 24-20-12-20 12 4-24-18-16 24-4z" fill="#242321"/></svg>')
 g['thumbnail']='/library/covers/'+p.name

for g in catalog:
 if g['thumbnail'].endswith('.gif'):
  original=root/'public'/g['thumbnail'].lstrip('/');small=original.with_suffix('.png')
  subprocess.run(['sips','-s','format','png','-Z','480',str(original),'--out',str(small)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  g['thumbnail']=g['thumbnail'][:-4]+'.png';original.unlink()
# Upstream videos and duplicate GIF captures are development recordings, not game dependencies.
for f in (out/'aba').rglob('*'):
 if f.is_file() and f.suffix in ['.mp4','.webm','.gif']:f.unlink()

overrides=json.loads((root/'server/library-overrides.json').read_text())
for g in catalog:g.update(overrides.get(g['id'],{}))
catalog.sort(key=lambda g:(g['collection'],g['title']))
for g in catalog:
 file=out/g['launch'].removeprefix('/library/').split('?')[0]
 g['entry_sha256']=digest(file.read_bytes())
(root/'server/library-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
report={'distinct_imported_titles':len(catalog),'native_online_multiplayer':0,'local_multiplayer_titles':sum(g['local_players']>1 for g in catalog),'rejected':rejected,'sources':list({g['source']:g['revision'] for g in catalog}.items()),'scope':'Static dependency and licence screening. Browser smoke tests sample each engine; not every game has been manually played.'}
(root/'evidence/library-import.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'imported':len(catalog),'local_multiplayer':report['local_multiplayer_titles'],'rejected':len(rejected)},indent=2))
