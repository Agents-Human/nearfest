"""Original vector compositions for slotVend's action, party and puzzle catalogue.
No third-party images, fonts or game code. Run from the slotVend project root.
"""
from pathlib import Path
import math
ROOT=Path('public/art/action-games')
INK='#302b27'; CREAM='#fff0d3'; CORAL='#ef8f75'; LILAC='#baa0d9'; GOLD='#f4d765'; MINT='#aad4bd'; BLUE='#9dc5db'
def path(d,fill='none',stroke=INK,w=3,extra=''): return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def rect(x,y,w,h,fill=CREAM,rx=10,stroke=INK,sw=3,extra=''):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'
def circ(x,y,r,fill=CREAM,stroke=INK,w=3): return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"/>'
def ellipse(x,y,rx,ry,fill=CREAM,stroke=INK,w=3):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"/>'
def group(s,transform='',extra=''):return f'<g transform="{transform}" {extra}>{s}</g>'
def star(x,y,r,fill=GOLD,rot=0):
 pts=[]
 for i in range(10):
  a=(i*36-90+rot)*math.pi/180;rr=r if i%2==0 else r*.44;pts.append(f'{x+math.cos(a)*rr:.1f},{y+math.sin(a)*rr:.1f}')
 return f'<polygon points="{" ".join(pts)}" fill="{fill}"/>'
def accent(x,y,c=INK):return path(f'M{x-6} {y}h12M{x} {y-6}v12',stroke=c,w=3)
def arrow(x,y,dx,dy,c=INK,w=4):
 a=math.atan2(dy,dx);ex=x+dx;ey=y+dy
 return path(f'M{x} {y}l{dx} {dy}M{ex-math.cos(a-.7)*12:.1f} {ey-math.sin(a-.7)*12:.1f}L{ex} {ey}l{-math.cos(a+.7)*12:.1f} {-math.sin(a+.7)*12:.1f}',stroke=c,w=w)
def base(bg,body,decor=True):
 deco=(circ(523,82,115,CREAM,'none')+star(73,78,15,CREAM,-12)+circ(562,355,7,'none',INK,2.5)+accent(90,360,'#302b2755')) if decor else ''
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" fill="none">{rect(0,0,640,440,bg,0,"none",0)}{deco}{body}</svg>\n'
def slab(x,y,w,h,fill=CREAM,rx=20):return rect(x+4,y+8,w,h,INK,rx,'none')+rect(x,y,w,h,fill,rx)
GLYPHS={
 'A':'M2 30 12 2 22 30M6 21h12','B':'M3 30V2h10c12 0 12 14 0 14H3m10 0c12 0 12 14 0 14H3','C':'M22 5Q3-4 3 16t19 11',
 'D':'M3 2v28h7q14 0 14-14T10 2Z','E':'M22 2H3v28h19M3 16h15','F':'M22 2H3v28M3 16h15','G':'M22 5Q3-4 3 16t19 11V17h-9',
 'H':'M3 2v28M21 2v28M3 16h18','I':'M5 2h14M12 2v28M5 30h14','K':'M3 2v28M22 2 3 18l20 12','L':'M3 2v28h19',
 'M':'M2 30V2l10 16L22 2v28','N':'M3 30V2l18 28V2','O':'M12 2C0 2 0 30 12 30S24 2 12 2Z','P':'M3 30V2h11c13 0 13 16 0 16H3',
 'R':'M3 30V2h11c13 0 13 16 0 16H3m10 0 10 12','S':'M22 5C2-5-2 14 12 16s16 23-10 11','T':'M1 2h22M12 2v28',
 'U':'M3 2v19c0 14 18 14 18 0V2','V':'M2 2l10 28L22 2','W':'M1 2 5 30l7-17 7 17 4-28','X':'M2 2 22 30M22 2 2 30','Y':'M2 2 12 16 22 2M12 16v14',
 'Z':'M2 2h20L2 30h20','0':'M12 2C0 2 0 30 12 30S24 2 12 2ZM4 25 20 6','1':'m7 7 6-5v28M5 30h16',
 '2':'M3 8C3-4 26 0 21 12L3 30h20','3':'M3 4Q22-4 21 9q-1 7-10 7 11 0 11 8T3 28','4':'M18 30V2L2 22h21',
 '5':'M22 2H4l-1 13q20-6 19 8T3 28','6':'M21 3C-1-6-1 31 12 30s15-19 1-19Q3 12 3 19','7':'M2 2h21L9 30',
 '8':'M12 16C-2 16 0 2 12 2s14 14 0 14C-3 16-1 30 12 30s15-14 0-14Z','9':'M3 28C25 37 25 1 12 2S-3 21 11 21q10-1 10-8',
 '+':'M3 16h18M12 7v18','-':'M3 16h18','×':'M4 8l16 16M20 8 4 24','=':'M3 11h18M3 21h18','?':'M3 8C1-4 25 0 22 10s-11 8-10 13M12 29v1',
 '!':'M12 2v18M12 29v1'}
def glyph(label,x,y,scale=1,c=INK):return group(path(GLYPHS[label],stroke=c,w=3.4),f'translate({x} {y}) scale({scale})')
def tile(x,y,label,color=CREAM,a=0,size=56):
 return group(rect(3,5,size,size,INK,9,'none')+rect(0,0,size,size,color,9)+glyph(label,(size-24)/2,(size-32)/2),f'translate({x} {y}) rotate({a} {size/2} {size/2})')
def clock(x,y,r=33,color=GOLD):
 return rect(x-12,y-r-14,24,10,INK,4,'none')+circ(x,y,r,color)+circ(x,y,r-8,CREAM,'none')+path(f'M{x} {y-r+15}v{r-15}l{r-14} 5',w=4)+circ(x,y,3,INK,'none')
def marble(x,y,r,color):return circ(x+3,y+6,r,'#302b2730','none')+circ(x,y,r,color)+path(f'M{x-r*.55} {y-r*.1}q0 {-r*.6} {r*.6} {-r*.6}',stroke=CREAM,w=max(3,r*.12))
def stick(x,y,scale=1,color=CORAL,pose='run'):
 torso=path('M0-43-8-5',stroke=INK,w=8)+circ(3,-62,17,color)
 if pose=='run': limbs=path('m-5-30-28 3-12-17m39 13 30 10 15-14M-8-5l-28 25-16-2M-8-5l22 17 10 21',stroke=INK,w=8)
 elif pose=='pull':limbs=path('m-3-32 33 15 20-5m-57-7 35 12 20-5M-8-5l-25 38h-17M-8-5l17 38h17',stroke=INK,w=8)
 else:limbs=path('m-5-30-25 10m25-10 25 10M-8-5l-16 36M-8-5l19 36',stroke=INK,w=8)
 return group(torso+limbs,f'translate({x} {y}) scale({scale})')
def ball(x,y,r=14):return circ(x+3,y+5,r,'#302b2733','none')+circ(x,y,r,CREAM)+path(f'm{x-r*.35} {y-r*.4} 7 2m-1 8 5 2',stroke='#bcae93',w=2)
def apple(x,y,s=1):return group(path('M0-18c-24-15-34 6-25 25 13 29 24 17 25 17s13 11 26-17C35-12 24-33 0-18Z',CORAL)+path('M0-18q-2-15 8-21',w=4)+path('M5-32q15-11 24 0-11 11-24 0',MINT)+path('M-20-5q-5 9 0 16',stroke=CREAM,w=4),f'translate({x} {y}) scale({s})')
def pawn(x,y,s=1,fill=CREAM):return group(circ(0,-62,18,fill)+path('M-15-43h30l-5 18 15 37h-50l15-37Z',fill)+rect(-32,11,64,16,fill,6),f'translate({x} {y}) scale({s})')
def king(x,y,s=1,fill=CREAM):return group(path('M0-114v22m-11-11h22',w=7)+path('M-25-85h50l-9 27H-16ZM-16-57h32L12-17 30 19h-60l18-36Z',fill)+rect(-37,19,74,18,fill,7)+path('M-18-36h36',w=3),f'translate({x} {y}) scale({s})')
def pencil(x,y,a=25,s=1):return group(path('M-9-75h18v123L0 70-9 48Z',GOLD)+rect(-9,-91,18,17,CORAL,5)+path('M-9 48h18L0 70Z',CREAM)+path('M-4 60h8L0 70Z',INK)+path('M0-74v120',stroke='#d0a52e',w=2),f'translate({x} {y}) rotate({a}) scale({s})')
def magnify(x,y,r=52):return path(f'M{x+r*.65} {y+r*.7}l48 46',stroke=INK,w=20)+path(f'M{x+r*.65} {y+r*.7}l48 46',stroke=CORAL,w=12)+circ(x,y,r,BLUE)+circ(x,y,r-10,'#fff0d3cc',INK,2)+path(f'M{x-r*.55} {y}q0 {-r*.55} {r*.55} {-r*.55}',stroke=CREAM,w=4)
def save(name,bg,body,decor=True): (ROOT/(name+'.svg')).write_text(base(bg,body,decor))

# CHESS: a full match, represented by opposing kings and a pawn on a gridded board.
s=slab(105,133,430,220,'#d6b78d',14)
for row in range(4):
 for col in range(8):s+=rect(120+col*50,145+row*49,50,49,LILAC if (row+col)%2 else CREAM,0,'none',0)
s=group(s,'rotate(-6 320 240)')+ellipse(247,300,60,17,'#302b2722','none')+king(247,278,1.26,CREAM)+king(415,210,.97,CORAL)+pawn(364,322,.72,LILAC)+star(129,112,18,GOLD)+path('m492 115 11 13m-5-26 15 5',w=3)
save('chess-online','#d8c8e8',s)

# PADDLE: unmistakable vertical paddles and a ricochet on an outlined court.
s=slab(72,100,496,252,'#52756d',22)+rect(89,117,462,218,'#a4cdb9',13,CREAM,2)+path('M320 119v216',stroke=CREAM,w=3,extra='stroke-dasharray="10 12"')+circ(320,226,51,'none',CREAM,2)
s+=rect(119,166,21,95,'#302b27',9,'none')+rect(115,160,21,95,CORAL,9)+rect(505,228,21,95,'#302b27',9,'none')+rect(501,222,21,95,LILAC,9)
s+=path('M148 209 262 141 440 254',stroke=CREAM,w=4,extra='stroke-dasharray="7 11"')+ball(438,253,16)+path('m404 228 16 10m-28-5 15 9',stroke=CREAM,w=4)+star(157,205,15,GOLD)
save('paddle-duel','#cbdfe3',group(s,'rotate(-5 320 220)'))

# AIR HOCKEY: table, goals, two mallets and a black puck.
s=slab(95,71,450,307,'#6f98ae',28)+rect(111,87,418,275,CREAM,19)+path('M320 89v271',stroke=CORAL,w=3)+circ(320,224,53,'none',CORAL,3)+rect(102,172,13,102,INK,4,'none')+rect(525,172,13,102,INK,4,'none')
for x,y,c in [(199,174,CORAL),(446,278,LILAC)]:s+=ellipse(x,y+10,43,19,INK,'none')+ellipse(x,y+4,43,19,c)+ellipse(x,y-1,34,13,c)+rect(x-15,y-29,30,29,c,11)+ellipse(x,y-28,15,7,CREAM)
s+=ellipse(329,252,17,8,INK)+path('m288 239 18 7m-8-20 19 9',stroke=BLUE,w=4)
save('air-hockey','#d4e3ce',group(s,'rotate(-6 320 220)'))

# SNAKE ARENA: two distinct grid-aligned snakes, food and readable square arena.
s=slab(105,64,430,310,'#cbe0bd',19)
for x in range(129,520,39):s+=path(f'M{x} 79v280',stroke='#9db68e',w=1)
for y in range(91,365,39):s+=path(f'M120 {y}h400',stroke='#9db68e',w=1)
s+=path('M165 316V238h78V121h78',stroke=INK,w=31)+path('M165 316V238h78V121h78',stroke=CORAL,w=25)+path('M477 121v78h-78v117h-78',stroke=INK,w=31)+path('M477 121v78h-78v117h-78',stroke=LILAC,w=25)
s+=circ(323,115,3,INK,'none')+circ(323,126,3,INK,'none')+circ(319,311,3,INK,'none')+circ(319,322,3,INK,'none')+apple(321,219,.52)+apple(165,130,.43)
save('snake-arena','#f0d4b3',group(s,'rotate(-4 320 220)'))

# FOAM MAZE: chunky tile obstacles, a foam charge and graphic cross burst.
s=slab(116,58,408,325,'#cad9c1',20)
for row in range(5):
 for col in range(6):
  x=133+col*64;y=75+row*58;s+=rect(x,y,57,51,'#dce8d4',5,'#b4c7a6',1)
  if (row,col) in [(0,2),(0,4),(1,0),(1,2),(1,4),(2,4),(3,0),(3,2),(3,4),(4,2)]:s+=slab(x,y,57,46,'#b7a0cc',5)
s+=path('M280 201h49v-52h48v52h51v48h-51v54h-48v-54h-49Z',GOLD,INK,3)+star(352,226,38,CREAM)
s+=circ(196,309,26,CORAL)+rect(184,278,23,11,INK,3,'none')+path('M196 280q-7-25 13-22',stroke=INK,w=4)+star(215,259,10,GOLD)
s+=circ(464,110,16,BLUE)+path('m459 104 3 2m7-2 3 2',w=2)
save('bomb-maze','#d7c8e7',group(s,'rotate(4 320 220)'))

# MINI GOLF: a shaped green with a bank, dotted aim line, flag and ball.
s=path('M118 334V171q0-55 55-55h224q40 0 40 40v47h62q34 0 34 34v82q0 40-40 40H146q-28 0-28-25Z','#608d6b',INK,4)
s+=path('M136 328V174q0-40 40-40h216q27 0 27 28v57h76q20 0 20 22v75q0 25-25 25H149q-13 0-13-13Z','#add28d',CREAM,3)
s+=path('M180 300h158q27 0 27-35v-84',stroke=CREAM,w=3,extra='stroke-dasharray="6 10"')+ellipse(365,175,20,9,INK,'none')+path('M365 174V65',w=4)+path('M367 67h75l-19 22 19 22h-75Z',CORAL)
s+=ball(181,301,15)+path('M239 353 277 268l-31-13',stroke=INK,w=9)+path('m267 263-21-8',stroke=LILAC,w=13)+path('M258 154v79h47',stroke='#6da778',w=16)
save('mini-golf','#d7e6e4',s)

# MARBLE KNOCKOUT: raised circular stage and colliding glassy spheres.
s=ellipse(320,276,230,110,INK,'none')+ellipse(320,266,230,110,LILAC)+ellipse(320,242,230,110,CREAM)+ellipse(320,242,206,92,'#e9dfba',INK,2)+ellipse(320,242,180,77,'none','#baa77d',2)
s+=marble(245,224,44,CORAL)+marble(348,240,42,BLUE)+marble(431,183,30,LILAC)+marble(137,337,25,MINT)+star(299,228,22,GOLD)
s+=path('m196 197-26-16m25 31-34-9m226 57 32 12',stroke=INK,w=3)+arrow(456,291,56,23,'#8b739f',4)
save('marble-knockout','#f0d4b3',s)

# KITCHEN RUSH: ingredient board, a pan and plates on a shared countertop.
s=slab(77,136,486,223,'#d7b187',19)+rect(97,156,200,181,'#f2d6a8',15)+circ(445,241,71,CREAM)+circ(445,241,54,'none','#d6c49f',2)
s+=ellipse(327,221,55,29,INK)+ellipse(327,214,55,28,'#536663')+path('M373 203 444 176',stroke=INK,w=16)+path('M377 202 441 178',stroke=CORAL,w=9)
s+=path('M304 208q9-19 23 2 17-19 27 2',stroke=GOLD,w=8)+path('M309 165q-13-12 0-25t0-25m27 48q-13-12 0-25t0-25',stroke=CREAM,w=4)
s+=group(path('M0 0 74 23 4 41Z',CORAL)+path('M73 23q21-22 34-11M73 23q27-1 31 18',stroke='#5a9c73',w=6), 'translate(130 226) rotate(-21)')
s+=path('M137 183h82l-9 28h-62Z',CREAM)+path('M200 276 238 311',stroke=INK,w=9)+path('m193 269 17-17 44 39-16 20Z',BLUE)
s+=apple(445,239,.9)+clock(499,98,29,GOLD)
save('kitchen-rush','#cee2cf',s)

# PAINT TAG: bright splats, arena obstacles and two moving characters.
s=slab(80,115,480,250,'#fff0d3',24)+rect(113,146,86,79,BLUE,10)+rect(442,253,82,75,LILAC,10)+rect(306,194,56,74,MINT,10)
for x,y,c in [(244,154,CORAL),(414,304,LILAC),(362,132,CORAL)]:
 s+=group(path('M-9-15q-16-20-17-5l8 16q-29 1-19 12l26 1q-12 25 3 22l10-19q20 27 26 11L15 7q31-5 17-16L9-7q4-28-7-19Z',c,'none',0),f'translate({x} {y})')
s+=stick(225,285,1.05,CORAL,'run')+group(stick(0,0,.9,LILAC,'run'),'translate(416 215) scale(-1 1)')+circ(291,236,8,CORAL)+circ(361,211,6,LILAC)+path('M274 242 284 239m91-34 9-3',stroke=INK,w=3)
save('paint-tag','#e9cece',s)

# PLATFORM RELAY: shared jump course, hand-off baton and destination flag.
s=path('M0 394q130-50 232 5t202-5 220-4v60H0Z','#b0caba','none',0)
for x,y,w in [(72,326,134),(257,255,114),(437,180,126)]:s+=slab(x,y,w,30,'#bd91ce',8)+path(f'M{x+8} {y+8}h{w-16}',stroke=CREAM,w=3)
s+=stick(162,290,1.0,CORAL,'run')+stick(331,187,1.0,LILAC,'run')+group(rect(-7,-34,14,68,GOLD,6),'translate(261 200) rotate(29)')
s+=path('M207 246q20-49 66-39m90-61q40-41 81-12',stroke=INK,w=3,extra='stroke-dasharray="4 10"')+path('M505 178V83',w=4)+path('M506 85h58l-16 18 16 18h-58Z',CORAL)+star(99,154,17,GOLD)
save('platform-relay','#c7dde8',s)

# DRAW & GUESS: drawing paper, a sketched cat and a question bubble.
s=group(slab(115,73,324,288,CREAM,14),'rotate(-7 277 215)')
s+=path('M184 213v-61l44 28q28-14 54 0l45-28v62q0 55-71 55t-72-56Z','none',INK,4)+path('m206 213 4 1m86-1 4 1m-53 11 10 6 10-6m-10 6v14m-14 2q14 9 28 0M184 233l-25-5m25 18-26 6m170-20 26-6m-27 19 27 7',w=3)
s+=pencil(394,281,34,1.1)+path('M422 81h108q26 0 26 26v62q0 26-26 26h-37l-36 24 9-24h-44q-26 0-26-26v-62q0-26 26-26Z',LILAC)+glyph('?',459,107,2.1)+star(141,324,15,GOLD)
save('draw-guess','#f0d3b8',s)

# WORD HUNT: individual letter tiles and a highlighted adjacent-cell path.
s=slab(155,55,324,324,'#ac90bc',18)
letters='AKRPEONTHDUSIMLG'
for i,letter in enumerate(letters):
 x=172+(i%4)*74;y=72+(i//4)*74;s+=tile(x,y,letter,CREAM,0,63)
s+=path('M203 103h74l74 74v74',stroke=CORAL,w=37,extra='opacity=".5"')
for x,y,l in [(203,103,'A'),(277,103,'K'),(351,177,'N'),(351,251,'U')]:s+=glyph(l,x-12,y-16)
s+=magnify(464,327,47)
save('word-hunt','#c8dfd2',s)

# WORD RELAY: passing a letter between chat turns.
s=path('M150 159q170-122 335 5m0 123q-169 114-335-3',stroke=INK,w=4,extra='stroke-dasharray="8 12"')+arrow(468,150,27,24,CORAL)+arrow(168,300,-28,-18,LILAC)
s+=tile(94,146,'R',CORAL,-12,95)+tile(271,81,'A',CREAM,7,86)+tile(452,171,'Y',LILAC,12,95)+tile(265,281,'T',GOLD,-6,83)
s+=path('M178 230q24 27 54 7m176-58q-23-31-48-18',w=4)+clock(320,220,37,MINT)
save('word-relay','#dfd0e7',s)

# CATEGORY SPRINT: category objects, a central letter, and a stopwatch.
s=tile(260,160,'B',CREAM,-5,116)+clock(467,293,48,CORAL)
s+=apple(164,138,1.05)+circ(463,124,39,BLUE)+ellipse(463,124,56,15,'none',INK,3)+path('M437 107q15-15 31-13',stroke=CREAM,w=4)
s+=circ(161,305,39,GOLD)+path('m161 276 19 14-7 23h-24l-7-23ZM142 291l-17-5m24 27-8 21m31-21 9 21m-1-43 17-5',w=2.5)
s+=path('M219 134 251 160m135-7 29-13m-201 136 35-14',stroke=INK,w=3,extra='stroke-dasharray="4 7"')
save('category-sprint','#cde0d3',s)

# CLUE CREW: private clue card and two connected speech bubbles.
s=group(slab(239,93,162,243,CREAM,15),'rotate(-8 320 215)')+path('M275 156h85m-89 31h72m-74 31h53',stroke='#aa9e87',w=5)
s+=path('M88 133h121q22 0 22 22v55q0 22-22 22h-33l-24 24 3-24H88q-22 0-22-22v-55q0-22 22-22Z',CORAL)+circ(115,182,5,INK,'none')+circ(148,182,5,INK,'none')+circ(181,182,5,INK,'none')
s+=path('M421 217h121q22 0 22 22v55q0 22-22 22h-33l-24 24 3-24h-67q-22 0-22-22v-55q0-22 22-22Z',LILAC)+path('m448 265 20 18 36-40',w=7)
s+=circ(331,283,25,MINT)+path('m317 284 9 9 18-20',w=4)+star(499,109,24,GOLD)
save('clue-crew','#d3e2e6',s)

# TRIVIA SHOWDOWN: two answering buzzers and a question card.
s=group(slab(243,65,150,194,CREAM,17)+glyph('?',281,109,3),'rotate(6 320 162)')
for x,y,c in [(178,307,CORAL),(455,307,LILAC)]:
 s+=ellipse(x,y+22,77,30,INK)+ellipse(x,y+14,77,30,CREAM)+path(f'M{x-60} {y+7}v-18q0-42 60-42t60 42v18Z',c)+ellipse(x,y-12,60,30,c)+path(f'M{x-33} {y-24}q15-13 35-12',stroke=CREAM,w=5)
s+=path('m195 221 15-25m-46 20-2-28m288 33-15-25m46 20 2-28',w=4)+star(323,291,26,GOLD)
save('trivia-showdown','#d8c8e8',s)

# BLUFF CLUB: hidden claims on distinct cards with a revealing checkmark.
s=''
for x,y,a,c in [(132,130,-15,CORAL),(258,92,3,CREAM),(390,133,15,LILAC)]:
 body=slab(0,0,121,193,c,13)+path('M26 42h67M26 62h52',stroke=INK,w=4)+circ(60,122,31,CREAM)
 body+=glyph('?',48,106) if c!=CREAM else path('m43 123 12 12 25-28',w=5)
 s+=group(body,f'translate({x} {y}) rotate({a} 60 96)')
s+=path('M239 368q83 27 166-2',stroke=INK,w=3,extra='stroke-dasharray="5 10"')+star(94,269,18,GOLD)+circ(515,93,10,MINT)
save('bluff-club','#c7ded0',s)

# DEDUCTION: evidence pinboard, paths and a masked profile under inspection.
s=slab(104,79,423,280,'#d9b68b',16)
for x,y,a in [(132,111,-8),(312,111,7),(221,231,-4)]:
 body=rect(0,0,112,100,CREAM,7)+circ(56,36,17,LILAC)+path('M27 82q0-30 29-30t29 30',MINT)+circ(56,6,5,CORAL)
 s+=group(body,f'translate({x} {y}) rotate({a} 56 50)')
s+=path('M190 125 365 129 279 240 190 125',stroke=CORAL,w=3)+magnify(443,286,61)
s+=path('M413 275q15-11 30 0 15-11 30 0l-8 23q-12 10-22-3-11 13-23 3Z',INK,'none',0)+ellipse(430,286,7,4,CREAM,'none')+ellipse(456,286,7,4,CREAM,'none')
save('deduction-club','#d4dce9',s)

# MATHS TUG: a tied central rope pulled by opposing players, with number tokens.
s=path('M65 364h511',stroke='#a8a18b',w=3)+path('M138 267q92 26 182 0t183 0',stroke=INK,w=12)+path('M138 264q92 26 182 0t183 0',stroke='#dab071',w=7)+path('M313 264l-11 38 18-9 18 11-11-40Z',CORAL)
s+=stick(141,294,1.3,CORAL,'pull')+group(stick(0,0,1.3,LILAC,'pull'),'translate(498 294) scale(-1 1)')
s+=tile(204,103,'7',CREAM,-9,68)+tile(304,75,'+',GOLD,8,62)+tile(400,111,'3',CREAM,11,68)+path('M320 331v40',stroke=INK,w=3,extra='stroke-dasharray="5 6"')
save('maths-tug','#e7d9b7',s)

# EQUATION FORGE: number/operator tiles, a target and a small tool.
s=slab(110,187,421,164,'#b29bc5',17)
s+=tile(131,223,'6',CREAM,-5,68)+tile(216,223,'×',GOLD,0,62)+tile(297,223,'4',CREAM,4,68)+tile(384,223,'=',MINT,0,62)
s+=circ(471,149,61,CORAL)+circ(471,149,43,CREAM)+circ(471,149,25,CORAL)+circ(471,149,8,INK,'none')+arrow(396,92,67,53,INK,5)
s+=tile(166,112,'2',CREAM,-16,53)+tile(267,93,'8',CREAM,10,53)+group(rect(-8,-25,16,95,'#d4aa75',5)+rect(-36,-48,72,30,BLUE,8),'translate(113 151) rotate(-28)')+star(332,165,17,GOLD)
save('equation-forge','#d1e1d2',s)

# CIRCUIT CREW: board traces, connector terminals, a switch and a lit bulb.
s=slab(108,81,425,282,'#7aa28c',20)
s+=path('M151 310V157h90v92h94V157h137',stroke='#355c4b',w=18)+path('M151 310V157h90v92h94V157h137',stroke=GOLD,w=8)+path('M472 157v153H335',stroke='#355c4b',w=18)+path('M472 157v153H335',stroke=GOLD,w=8)
for x,y in [(151,310),(241,157),(241,249),(335,249),(472,310)]:s+=circ(x,y,12,CREAM)+circ(x,y,4,INK,'none')
s+=rect(130,204,43,64,CORAL,7)+path('M141 228h21m-10-11v22m-9 14h19',stroke=CREAM,w=3)
s+=rect(313,296,67,28,CREAM,6)+path('m327 310 32-25',stroke=INK,w=6)
s+=path('M435 132c-30-42 8-80 37-80s65 38 36 80l-12 22h-48Z',GOLD)+rect(449,154,47,21,CREAM,4)+path('M458 164h29m-16-12v-39l-14-14m14 14 14-14',w=3)+path('M471 31V15m-49 38-13-12m110 12 13-12',stroke=GOLD,w=5)
save('circuit-crew','#d9e1c7',s)

# ORBIT RESCUE: original capsule, probe and dashed rendezvous orbit.
s=ellipse(319,238,224,111,'none','#8d80a8',3)+group(ellipse(319,238,224,111,'none','#fff0d3',2),'rotate(-21 319 238)')+circ(310,245,87,'#efbb80')+path('M268 203q41-34 83 10m-68 72q37 16 59-7',stroke='#d8955b',w=7)
s+=group(path('M-25 26V-22Q-23-63 0-79 23-63 25-22v48Z',CREAM)+path('M-25-2-43 16v31l21-17m47-32 18 18v31L22 30',CORAL)+circ(0,-25,15,BLUE)+path('M-13 31 0 65 13 31Z',GOLD),'translate(174 158) rotate(-34)')
s+=group(rect(-24,-20,48,40,GOLD,8)+rect(-70,-18,36,36,BLUE,2)+rect(34,-18,36,36,BLUE,2)+path('M-34 0h10M24 0h10M0-20v-16l14-10',w=3)+circ(17,-49,6,CREAM),'translate(473 298) rotate(19)')
s+=path('M199 118q124-68 236 22',stroke=CREAM,w=3,extra='stroke-dasharray="5 10"')+star(420,112,14,GOLD)+star(99,291,8,CREAM)+circ(505,195,4,CREAM,'none')
save('orbit-rescue','#c5b6d9',s,False)

# BRIDGE BUILDERS: original truss across a river with a tiny test vehicle.
s=path('M0 342q139-40 233 6t190-9 217 0v101H0Z','#aad0e0','none',0)+path('M0 264h157v176H0m483-176h157v176H483Z','#b1c68b','none',0)
s+=path('M112 276h415',stroke=INK,w=17)+path('M112 272h415',stroke='#d5ae7c',w=10)+path('M142 265 212 142 282 265 352 142 422 265 492 142v123M142 265V142h350M212 142v123m140-123v123',stroke=INK,w=9)+path('M142 265 212 142 282 265 352 142 422 265 492 142v123M142 265V142h350M212 142v123m140-123v123',stroke=CORAL,w=5)
for x,y in [(142,265),(142,142),(212,142),(282,265),(352,142),(422,265),(492,142),(492,265)]:s+=circ(x,y,6,CREAM,INK,2)
s+=path('M277 240v-27h12l14-24h42l13 24h14v27Z',LILAC)+path('m308 196-9 17h47l-8-17Z',BLUE)+circ(298,243,12,INK)+circ(351,243,12,INK)+circ(298,243,4,CREAM,'none')+circ(351,243,4,CREAM,'none')
s+=path('M262 371q39-13 79 0m-88 22q39-13 79 0',stroke=CREAM,w=3)+group(rect(-8,-25,16,95,'#d4aa75',5)+rect(-36,-48,72,30,BLUE,8),'translate(536 272) rotate(24)')
save('bridge-builders','#d2e4dd',s)

# MOLECULE MATCH: a connected molecular graph with a ghost destination.
s=path('M183 271 284 181 403 246 482 145M284 181l-14-81M403 246l12 105',stroke=INK,w=19)+path('M183 271 284 181 403 246 482 145M284 181l-14-81M403 246l12 105',stroke=CREAM,w=11)
for x,y,r,c in [(183,271,44,CORAL),(284,181,52,BLUE),(403,246,42,GOLD),(482,145,33,LILAC),(270,100,27,CREAM)]:s+=marble(x,y,r,c)
s+=circ(415,351,28,'none',INK,3)+circ(415,351,20,'none','#b69b78',2)+marble(114,125,27,CREAM)+path('M140 118q42-23 72-17',stroke=INK,w=3,extra='stroke-dasharray="5 8"')+arrow(205,98,24,4,INK,3)
save('molecule-match','#e7d8bb',s)

# SUDOKU RACE: nine-square puzzle tiles and a ticking clock.
s=slab(135,62,300,300,CREAM,16)
for i in range(1,3):s+=path(f'M{135+i*100} 65v294M138 {62+i*100}h294',stroke=INK,w=2.5)
for col,row,n,c in [(0,0,'2',None),(2,0,'6',None),(1,1,'4',GOLD),(0,2,'1',None),(2,2,'8',None)]:
 if c:s+=rect(139+col*100,66+row*100,92,92,c,9,'none')
 s+=glyph(n,172+col*100,87+row*100,1.5)
s+=clock(459,290,60,CORAL)+pencil(489,133,-25,.8)+path('m490 334 16 10m-6-25 18 3',stroke=INK,w=3)
save('sudoku-race','#cfdfd0',group(s,'rotate(-4 320 220)'))

# CODEBREAKERS: four-symbol combination board, objective clues and a lock.
s=slab(133,76,355,300,'#dcc49b',20)
for row in range(3):
 s+=rect(151,99+row*76,317,61,CREAM,10)
 for col,c in enumerate([CORAL,LILAC,MINT,GOLD]):s+=circ(181+col*61,129+row*76,18,c if row<2 else '#d4c8b1')
 for col in range(2):
  for r in range(2):s+=circ(424+col*14,122+row*76+r*14,4,INK if (col+r+row)%2 else '#c7b99d','none')
s+=path('M467 311v-27q0-31 29-31t29 31v27',stroke=INK,w=11)+rect(457,302,78,66,GOLD,12)+circ(496,328,8,INK,'none')+path('M492 334h8l4 15h-16Z',INK,'none',0)+star(104,194,20,GOLD)
save('codebreakers','#cddde8',group(s,'rotate(5 320 220)'))

print('Wrote 26 original catalogue covers.')
