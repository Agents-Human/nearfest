// Original slotVend editorial illustrations. Every scene fits a 640 × 440 cover.
export function sceneFor(game,p,seed){
 const {primary:a,secondary:b,light:w,ink:k}=p;
 const path=(d,fill=a,extra='')=>`<path d="${d}" fill="${fill}" stroke="${k}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
 const rect=(x,y,width,height,fill=a,r=16,extra='')=>`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}" fill="${fill}" stroke="${k}" stroke-width="3" ${extra}/>`;
 const circle=(x,y,r,fill=a)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${k}" stroke-width="3"/>`;
 const text=(x,y,t,size=42,fill=k)=>`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Georgia,serif" font-weight="bold" font-size="${size}" fill="${fill}">${t}</text>`;
 const group=(content,transform)=>`<g transform="${transform}">${content}</g>`;
 const shadow=`<ellipse cx="325" cy="357" rx="170" ry="19" fill="${k}" opacity=".1"/>`;
 const tile=(x,y,t,fill=a,angle=0)=>group(rect(x+5,y+8,100,100,k,17)+rect(x,y,100,100,fill,17)+text(x+50,y+50,t),`rotate(${angle} ${x+50} ${y+50})`);
 const id=game.art||game.id;
 const title=`${game.title} ${game.label} ${game.genre||''}`.toLowerCase();
 let s='';
 if(id==='trivia'||/quiz|trivia|riddle/.test(title)){
  s=group(rect(153,107,230,230,k,28)+rect(143,97,230,230,a,28)+text(258,204,'?',166), 'rotate(-11 260 220)')+group(rect(369,225,111,93,w,20)+text(425,270,'!',67),'rotate(13 420 270)');
 }else if(/math|number|abacus|fraction|times table|sequence/.test(title)||['maths','times','fractions','sequence'].includes(id)){
  s=tile(135,185,id==='fractions'?'½':'3',w,-12)+tile(275,100,id==='times'?'×':'+',a,8)+tile(394,235,id==='sequence'?'?':'7',b,13)+path('M170 124h60m-30-30v60','none')+path('m343 340 15-12m-7 27 15-12','none');
 }else if(/science|lab|alchemy|chem|potion/.test(title)||id==='science'){
  s=path('M260 99h112v33h-23v80l72 111q17 31-18 31H233q-34 0-16-31l72-111v-80h-29Z',w)+path('m252 279 37-58q34 25 66 4l48 81q23 35-12 35H246q-29 0-14-25Z',a)+circle(315,277,14,b)+circle(353,307,8,w)+circle(330,180,11,b)+circle(302,149,5,a)+circle(390,116,20,b)+group(rect(150,156,35,142,w,12)+path('M152 226h31v57q-16 25-31 0Z',b),'rotate(19 170 220)');
 }else if(/space|astro|orbit|planet|moon|cosmic|solar/.test(title)||id==='space'){
  s=group(circle(320,215,104,a)+path('M228 189q78-30 180 18M237 266q95-15 167 9','none')+`<ellipse cx="320" cy="228" rx="193" ry="43" fill="none" stroke="${k}" stroke-width="26"/><ellipse cx="320" cy="224" rx="193" ry="43" fill="none" stroke="${b}" stroke-width="21"/>`,'rotate(-23 320 220)')+circle(490,100,21,w)+circle(158,300,8,b)+circle(151,115,5,w);
 }else if(/word|anagram|antonym|spell|letter/.test(title)||id==='words'){
  s=tile(144,186,'A',w,-14)+tile(286,110,'B',a,7)+tile(397,227,'C',b,14)+path('M188 120q-15-34 15-41m280 80q30 7 20 30','none');
 }else if(/music|record|rhythm|piano|audio|beat/.test(title)||id==='music'){
  s=group(rect(172,103,300,230,k,24)+rect(162,93,300,230,a,24)+circle(302,207,91,k)+circle(302,207,54,b)+circle(302,207,17,w)+path('M426 120v107l-43 32','none')+circle(423,122,9,w),'rotate(-9 320 210)')+path('M505 197v-70l41-9v65','none')+circle(493,200,12,b)+circle(534,187,12,b);
 }else if(/geograph|earth|world|map/.test(title)||id==='geography'){
  s=path('M259 347h142l-15-18h-43v-36h-25v36h-44Z',b)+path('M252 89a135 135 0 1 1-16 231','none')+circle(319,207,104,w)+path('m256 129 38 18 9 38-32 11-12 35-29-19-11-30Zm101-18 19 45-33 28 22 26 46-4 9 39-32 27-30-18-10-35-29-18 12-42Z',a)+path('M232 257q84 47 174 0','none');
 }else if(/sport|soccer|football|basket|volley|ball/.test(title)||id==='sports'){
  s=circle(308,224,118,a)+path('M201 180q116-8 198 112M292 107q-41 114 76 219M199 275q102-96 212-94M218 146q87 121 174 157','none')+circle(471,124,26,w)+path('m135 229-32 12m46 20-42 19m70 9-27 20','none');
 }else if(/food|fruit|cake|pizza|cook|taste/.test(title)||id==='food'){
  s=group(path('M184 168h256v150H184Z',w)+path('M184 168 310 85l130 83Z',a)+path('M184 255h256v32H184Z',b)+path('M184 168h256v23q-19 25-37 0-18 37-36 0-18 25-36 0-18 37-36 0-18 25-36 0-18 37-36 0-18 25-39 0Z',b)+circle(310,100,22,b)+path('M312 79q0-29 24-31','none'),'rotate(-8 320 220)');
 }else if(/cinema|film|movie/.test(title)||id==='cinema'){
  s=group(rect(176,167,295,176,k,14)+path('M176 167h295v54H176Z',w)+Array.from({length:5},(_,i)=>path(`m${190+i*57} 167-14 54h28l14-54Z`,b)).join('')+group(rect(176,109,295,51,w,4)+Array.from({length:5},(_,i)=>path(`m${190+i*57} 109-14 51h28l14-51Z`,a)).join(''),'rotate(-17 176 160)')+path('m286 248 0 65 56-32Z',w),'rotate(5 320 220)');
 }else if(/tech|computer|binary|code|hack|xx142/.test(title)||['tech','crypto'].includes(id)){
  s=group(rect(175,83,277,239,k,22)+rect(165,73,277,239,a,22)+rect(187,95,232,164,k,12)+path('m256 145-29 29 29 29m94-58 29 29-29 29m-39-70-24 83','none',`style="stroke:${w};stroke-width:9"`)+path('M165 313h277l42 45H128Z',b)+path('M240 341h116','none'),'rotate(-7 320 220)');
 }else if(/history|castle|kingdom|tower|chess/.test(title)||id==='history'){
  s=path('M162 334V157h-16v-50h37v26h28v-26h35v50h-15v177Zm243 0V157h-16v-50h37v26h28v-26h35v50h-15v177Z',b)+rect(231,211,174,123,a,0)+path('M291 334v-55a27 27 0 0 1 54 0v55Z',k)+path('M245 210 319 123l75 87Z',w)+path('M319 122V67l68 20-68 21Z',a);
 }else if(/cat|animal|wild|pet/.test(title)||id==='animals'){
  s=path('M216 174 204 86l88 43q45-8 75 0l77-45-6 96q37 47 14 115-27 67-127 67-98 0-126-67-21-67 17-121Z',a)+path('m215 116 13 55 37-27Zm197 0-32 29 31 27Z',b)+path('m300 249 21 20 23-20Z',k)+circle(267,214,8,k)+circle(376,214,8,k)+path('M321 270v20m0 0q-18 18-33-1m33 1q18 18 33-1m-101-43-65-13m68 36-68 6m204-29 65-13m-68 36 68 6','none');
 }else if(/fish|ocean|water|sea|swim|dive/.test(title)){
  s=path('M0 319q80-43 160 0t160 0 160 0 160 0v121H0Z',b)+path('M176 221q107-141 229-14l76-70v156l-77-70q-123 125-228-2Z',a)+circle(229,210,8,k)+path('M274 145q-28 79 0 154m32-124q39 41 0 82','none')+circle(493,113,17,w)+circle(520,71,8,w);
 }else if(/race|racing|car|drive|road|traffic/.test(title)){
  s=path('M221 0h209l85 440H139Z',k)+path('M317 0v65m0 30v65m0 30v65m0 30v65m0 30v65','none',`style="stroke:${w};stroke-width:6"`)+group(rect(230,144,34,63,k,8)+rect(374,144,34,63,k,8)+rect(230,277,34,63,k,8)+rect(374,277,34,63,k,8)+rect(250,111,138,238,a,40)+path('m271 155-6 57h109l-6-57Z',w)+rect(271,274,96,42,b,8),'rotate(-9 320 220)');
 }else if(/light/.test(title)||id==='lights'){
  s=Array.from({length:9},(_,i)=>rect(193+(i%3)*85,96+Math.floor(i/3)*85,74,74,(seed+i)%3?a:w,15)).join('')+path('m469 117 25-19m-22 49 38-3m-55-60 9-27','none');
 }else if(/slide|tile|block|stack|tetris|puzzle/.test(title)||id==='slide'){
  s=group(rect(182,74,280,280,k,22)+rect(173,65,280,280,w,22)+Array.from({length:8},(_,i)=>rect(185+(i%3)*85,77+Math.floor(i/3)*85,75,75,i%3?a:b,11)+text(222+(i%3)*85,115+Math.floor(i/3)*85,i+1,34)).join(''),'rotate(-9 320 220)');
 }else if(/card|poker|solitaire|blackjack|bid/.test(title)){
  s=group(rect(176,99,165,242,k,16)+rect(169,91,165,242,a,16)+text(250,205,'♣',100),'rotate(-19 250 220)')+group(rect(310,87,165,242,k,16)+rect(303,79,165,242,w,16)+text(385,197,'♥',100,b)+text(326,105,'A',24,b),'rotate(13 390 210)');
 }else if(/bow|archer|target|dart/.test(title)){
  s=circle(320,222,123,w)+circle(320,222,92,a)+circle(320,222,61,w)+circle(320,222,29,b)+path('m316 225 161-142m-35-12 35 12 9 35m-28-27 37 6 5 32','none',`style="stroke-width:9"`);
 }else if(game.thumbnail&&!game.thumbnail.includes('/covers/')){return null;}
 else{
  // Abstract arcade cover for games whose original collection has no artwork.
  const variation=seed%3;
  if(variation===0)s=path('M138 303h94v-73h95v-73h94V84h80v269H138Z',a)+circle(183,221,39,w)+path('m169 149 17-25m-46 34-24-12','none')+circle(374,112,17,b);
  else if(variation===1)s=path('M160 260C160 85 480 85 480 260c0 103-210 105-210-9 0-63 110-64 110-4','none',`style="stroke-width:44;stroke:${k}"`)+path('M160 260C160 85 480 85 480 260c0 103-210 105-210-9 0-63 110-64 110-4','none',`style="stroke-width:38;stroke:${a}"`)+circle(160,260,29,w)+circle(380,247,27,b);
  else s=group(rect(163,94,307,220,w,27)+Array.from({length:6},(_,i)=>rect(185+(i%3)*89,115+Math.floor(i/3)*53,76,41,i%2?a:b,7)).join('')+circle(350,258,20,b)+rect(244,282,100,15,k,7),'rotate(-9 320 220)');
 }
 return shadow+s;
}
