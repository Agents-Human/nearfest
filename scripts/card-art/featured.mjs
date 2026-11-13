// Original editorial cover illustrations. Each scene uses a 640 × 440 canvas.
export const handledIDs = [
  'chogan-sudoku', 'aba-sum-ten', 'chogan-dots', 'chogan-mancala',
  'chogan-chess', 'chess', 'littlejs-astroblast', 'aba-draft-line',
  'hundred-game-20-boomerang', '2048', 'memory',
];

const coral = '#f47e70';
const mint = '#a8d6bc';
const yellow = '#f4d96e';
const blue = '#4966c8';
const lilac = '#c7b7e7';
const wood = '#dfaa6f';
const line = (x1, y1, x2, y2, extra = '') => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const number = (x, y, value, size, ink) => `<text x="${x}" y="${y}" fill="${ink}" stroke="none" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="800">${value}</text>`;

function tile(x, y, size, value, fill, p, angle = 0, fontSize) {
  return `<g transform="rotate(${angle} ${x + size / 2} ${y + size / 2})">
    ${rect(x + 5, y + 9, size, size, 18, p.ink)}
    ${rect(x, y, size, size, 18, fill)}
    <path d="M${x + 15} ${y + size - 15}H${x + size - 16}" opacity=".17" fill="none"/>
    ${number(x + size / 2, y + size / 2 - 2, value, fontSize || size * .5, p.ink)}
  </g>`;
}

function sudoku(p) {
  const x = 170, y = 62, size = 33;
  const digits = [
    [0, 0, 5], [1, 0, 3], [4, 0, 7], [0, 1, 6], [3, 1, 1], [5, 1, 5],
    [1, 2, 9], [2, 2, 8], [7, 2, 6], [0, 3, 8], [4, 3, 6], [8, 3, 3],
    [0, 4, 4], [3, 4, 8], [5, 4, 3], [8, 4, 1], [0, 5, 7], [4, 5, 2],
    [8, 5, 6], [1, 6, 6], [6, 6, 2], [7, 6, 8], [3, 7, 4], [5, 7, 9],
    [8, 7, 5], [4, 8, 8], [7, 8, 7], [8, 8, 9],
  ];
  const highlights = [[2, 1, yellow], [6, 3, mint], [4, 6, coral], [2, 7, lilac]];
  return `<ellipse cx="323" cy="378" rx="185" ry="16" fill="${p.ink}" opacity=".09" stroke="none"/>
    <g transform="rotate(-9 320 215)">
      ${rect(x - 13, y - 11, 327, 330, 19, p.ink)}
      ${rect(x - 19, y - 19, 327, 330, 19, p.primary)}
      ${rect(x, y, 297, 297, 3, p.light)}
      ${highlights.map(([cx, cy, fill]) => rect(x + cx * size + 2, y + cy * size + 2, 29, 29, 4, fill, 'stroke="none"')).join('')}
      ${Array.from({ length: 8 }, (_, i) => {
        const n = i + 1;
        return line(x + n * size, y, x + n * size, y + 297, `stroke-width="${n % 3 ? .9 : 2.5}" opacity="${n % 3 ? .3 : 1}"`) + line(x, y + n * size, x + 297, y + n * size, `stroke-width="${n % 3 ? .9 : 2.5}" opacity="${n % 3 ? .3 : 1}"`);
      }).join('')}
      ${digits.map(([cx, cy, n]) => number(x + cx * size + size / 2, y + cy * size + size / 2, n, 21, p.ink)).join('')}
      ${number(x + 2.5 * size, y + 1.5 * size, 2, 22, p.ink)}
      ${number(x + 6.5 * size, y + 3.5 * size, 4, 22, p.ink)}
      ${number(x + 4.5 * size, y + 6.5 * size, 3, 22, p.ink)}
    </g>
    <g transform="rotate(28 116 277)">
      <path d="M105 182H126V327L115 351L105 327Z" fill="${yellow}"/>
      <path d="M105 327L115 351L126 327Z" fill="${p.light}"/>
      <path d="M111 342L115 351L120 342Z" fill="${p.ink}" stroke="none"/>
      ${rect(105, 174, 21, 27, 6, coral)}
      <path d="M105 201H126M115 206V322" fill="none"/>
    </g>
    ${tile(468, 100, 63, 9, p.secondary, p, 13, 34)}`;
}

function sumTen(p) {
  return `<ellipse cx="326" cy="370" rx="197" ry="17" fill="${p.ink}" opacity=".08" stroke="none"/>
    <path d="M111 238C93 152 177 88 263 92M379 100C457 90 523 153 518 227" fill="none" stroke-dasharray="7 10" opacity=".35"/>
    ${tile(133, 136, 128, 2, p.primary, p, -12, 78)}
    ${tile(335, 66, 126, 8, yellow, p, 11, 75)}
    ${tile(330, 257, 139, 10, p.secondary, p, -7, 65)}
    <g transform="rotate(-12 298 192)" fill="${p.ink}" stroke="none">
      ${rect(281, 187, 35, 10, 5, p.ink)}${rect(294, 175, 10, 35, 5, p.ink)}
    </g>
    <g transform="rotate(24 439 223)">${rect(418, 211, 39, 8, 4, p.ink, 'stroke="none"')}${rect(418, 228, 39, 8, 4, p.ink, 'stroke="none"')}</g>
    ${tile(154, 298, 66, 4, mint, p, 13, 36)}
    ${tile(479, 159, 58, 6, lilac, p, 15, 32)}
    <path d="M255 326C271 343 293 349 307 344M99 119L112 105M99 143L81 140" fill="none" stroke-width="3"/>
    ${circle(496, 305, 10, p.light)}`;
}

function dots(p) {
  const x = 180, y = 107, step = 55;
  const cells = [[0, 1, coral], [1, 1, coral], [1, 2, yellow], [3, 0, mint], [3, 1, mint], [4, 2, lilac]];
  const edges = [[0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 2, 1], [0, 1, 0, 2], [0, 2, 2, 2], [1, 1, 1, 3], [2, 1, 2, 3], [1, 3, 2, 3], [3, 0, 4, 0], [3, 0, 3, 2], [4, 0, 4, 2], [3, 1, 4, 1], [3, 2, 5, 2], [4, 2, 4, 3], [5, 2, 5, 3], [4, 3, 5, 3], [3, 3, 3, 4], [2, 4, 3, 4]];
  return `<ellipse cx="323" cy="374" rx="185" ry="17" fill="${p.ink}" opacity=".09" stroke="none"/>
    <g transform="rotate(-8 320 220)">
      ${rect(150, 78, 340, 289, 24, p.ink)}
      ${rect(143, 67, 340, 289, 24, p.light)}
      ${cells.map(([cx, cy, fill]) => rect(x + cx * step + 5, y + cy * step + 5, 45, 45, 8, fill, 'stroke="none"')).join('')}
      ${Array.from({ length: 5 }, (_, row) => Array.from({ length: 6 }, (_, col) => circle(x + col * step, y + row * step, 4.5, p.ink, 'stroke="none"')).join('')).join('')}
      ${edges.map(([x1, y1, x2, y2]) => line(x + x1 * step, y + y1 * step, x + x2 * step, y + y2 * step, 'stroke-width="4.5"')).join('')}
      ${[[.5, 1.5], [1.5, 1.5], [3.5, .5], [3.5, 1.5]].map(([cx, cy]) => circle(x + cx * step, y + cy * step, 8, p.light, 'stroke-width="1.7"')).join('')}
    </g>
    <g transform="rotate(29 505 260)">
      ${rect(493, 174, 24, 162, 9, p.primary)}
      <path d="M493 319H517L505 346Z" fill="${p.light}"/>
      <path d="M501 337L505 346L509 337Z" fill="${p.ink}"/>
      <path d="M501 192V311" fill="none" opacity=".35"/>
    </g>
    ${circle(113, 130, 19, p.secondary)}${circle(109, 124, 5, p.light, 'stroke="none"')}`;
}

function mancala(p) {
  const colors = [coral, mint, yellow, lilac, p.light];
  const pit = (cx, cy, n) => `<ellipse cx="${cx}" cy="${cy}" rx="23" ry="30" fill="#a86f49"/><path d="M${cx - 18} ${cy + 11}Q${cx} ${cy + 31} ${cx + 18} ${cy + 11}" fill="none" stroke="#edbd81" stroke-width="3"/>${Array.from({ length: n }, (_, k) => { const dx = [-7, 7, 0, -8][k]; const dy = [3, 0, -11, -14][k]; return circle(cx + dx, cy + dy, 7, colors[(k + n) % colors.length], 'stroke-width="1.5"') + circle(cx + dx - 2, cy + dy - 2, 1.6, p.light, 'stroke="none"'); }).join('')}`;
  return `<ellipse cx="324" cy="340" rx="225" ry="29" fill="${p.ink}" opacity=".09" stroke="none"/>
    <g transform="rotate(-10 320 220)">
      ${rect(79, 133, 483, 207, 65, '#ae764e')}
      ${rect(73, 119, 483, 207, 65, wood)}
      ${rect(85, 130, 459, 183, 56, '#f0c690', 'stroke-width="1.6"')}
      ${rect(100, 151, 45, 140, 23, '#a86f49')}
      ${rect(486, 151, 45, 140, 23, '#a86f49')}
      <path d="M108 262Q122 291 136 262M494 262Q508 291 522 262" fill="none" stroke="#edbd81" stroke-width="3"/>
      ${Array.from({ length: 6 }, (_, i) => pit(175 + i * 54, 176, (i % 3) + 2) + pit(175 + i * 54, 263, ((i + 1) % 3) + 2)).join('')}
      ${[0, 1, 2, 3, 4].map((i) => circle(117 + (i % 2) * 12, 199 + i * 14, 8, colors[i], 'stroke-width="1.5"') + circle(503 + (i % 2) * 12, 182 + i * 16, 8, colors[(i + 2) % 5], 'stroke-width="1.5"')).join('')}
      <path d="M167 218H467" fill="none" stroke="#be8758" stroke-width="1.5"/>
    </g>
    ${circle(144, 351, 13, coral)}${circle(141, 347, 3.5, p.light, 'stroke="none"')}
    ${circle(469, 99, 11, mint)}${circle(466, 96, 3, p.light, 'stroke="none"')}`;
}

function chessScene(p) {
  const point = (u, v) => [107 + 37 * u + 38 * v, 277 - 18 * u + 19 * v];
  const square = (u, v) => [point(u, v), point(u + 1, v), point(u + 1, v + 1), point(u, v + 1)].map(a => a.join(',')).join(' ');
  return `<path d="M107 277L329 169L557 283V301L335 413L107 295Z" fill="${p.ink}"/>
    <path d="M107 277L329 169L557 283L335 395Z" fill="${p.light}"/>
    ${Array.from({ length: 6 }, (_, v) => Array.from({ length: 6 }, (_, u) => `<polygon points="${square(u, v)}" fill="${(u + v) % 2 ? p.secondary : p.light}" stroke-width="1"/>`).join('')).join('')}
    <ellipse cx="286" cy="306" rx="66" ry="23" fill="${p.ink}" opacity=".12" stroke="none"/>
    <ellipse cx="434" cy="267" rx="42" ry="15" fill="${p.ink}" opacity=".12" stroke="none"/>
    <g transform="translate(0 -9)">
      <path d="M394 269Q397 256 408 251L414 219Q401 211 405 196Q410 181 425 180Q442 180 448 194Q454 209 439 219L447 251Q458 257 460 269Z" fill="${yellow}"/>
      <ellipse cx="427" cy="270" rx="34" ry="11" fill="${yellow}"/>
      <path d="M416 220H438M410 252H445" fill="none"/>
      <path d="M418 188Q410 190 410 198" fill="none" stroke="${p.light}" stroke-width="4"/>
    </g>
    <g>
      <ellipse cx="281" cy="306" rx="61" ry="17" fill="${p.primary}"/>
      <path d="M223 302L232 281H329L340 302Q282 323 223 302Z" fill="${p.primary}"/>
      <path d="M238 280L250 248Q271 212 256 191L236 203L216 195L205 165L227 142L238 117L260 110L266 79L284 99L299 92Q339 130 332 168Q326 199 307 224L321 281Z" fill="${p.primary}"/>
      <path d="M299 92Q340 111 346 152L337 150L342 173L332 174L334 192L321 193L322 207L309 212" fill="${p.ink}"/>
      <path d="M266 111L275 129L247 141M248 174L236 181M272 175Q294 206 278 244M243 265H313" fill="none"/>
      ${circle(251, 152, 4, p.ink, 'stroke="none"')}
      <path d="M285 112Q310 127 314 147M246 290H316" fill="none" stroke="${p.light}" stroke-width="5" opacity=".7"/>
    </g>`;
}

function asteroid(cx, cy, scale, fill, angle = 0) {
  return `<g transform="translate(${cx} ${cy}) rotate(${angle}) scale(${scale})"><path d="M-43-25L-19-45L13-42L40-21L47 9L25 38L-9 45L-37 28L-49 3Z" fill="${fill}"/><ellipse cx="-15" cy="-13" rx="12" ry="9" fill="none" opacity=".45"/><ellipse cx="18" cy="15" rx="10" ry="13" fill="none" opacity=".45"/><path d="M-32 15L-21 24M15-28L26-19" fill="none" opacity=".45"/></g>`;
}

function astroblast(p) {
  return `<path d="M88 314Q227 380 433 304M148 93Q298 34 496 139" fill="none" opacity=".19" stroke-dasharray="5 13"/>
    ${asteroid(127, 145, 1.02, lilac, -12)}
    ${asteroid(496, 309, 1.05, p.secondary, 25)}
    ${asteroid(465, 91, .44, yellow, 10)}
    ${asteroid(171, 346, .36, mint, 12)}
    <g transform="translate(322 226) rotate(38)">
      <path d="M-24 69Q-35 125 0 170Q35 125 24 69Z" fill="${coral}"/>
      <path d="M-12 79Q-18 113 0 143Q18 113 12 79Z" fill="${yellow}" stroke="none"/>
      <path d="M-42-8L-86 57L-81 94L-33 62M42-8L86 57L81 94L33 62" fill="${p.primary}"/>
      <path d="M-37 49L-32 77Q0 90 32 77L37 49Z" fill="${p.ink}"/>
      <path d="M0-136Q-55-89-41 47Q0 69 41 47Q55-89 0-136Z" fill="${p.light}"/>
      <path d="M0-136Q-21-117-31-87Q0-72 31-87Q21-117 0-136Z" fill="${p.primary}"/>
      <ellipse cx="0" cy="-37" rx="24" ry="33" fill="${blue}"/>
      <path d="M-14-49Q-11-62 1-62" fill="none" stroke="${p.light}" stroke-width="5"/>
      <path d="M-25 25Q0 37 25 25" fill="none"/>
      <path d="M0 20V85" fill="none" stroke-width="8"/>
    </g>
    <path d="M447 145L463 129M468 168L493 148M437 120L444 113M93 258H111M102 249V267M535 204H547M541 198V210" fill="none" stroke-width="3"/>
    ${circle(218, 81, 4, p.ink, 'stroke="none"')}${circle(553, 111, 4, p.ink, 'stroke="none"')}`;
}

function racing(p) {
  return `<circle cx="478" cy="104" r="43" fill="${yellow}" stroke="none"/>
    <path d="M76 180L139 122L190 173L240 114L293 168L357 124L431 181L507 139L568 185V218H76Z" fill="${p.secondary}" stroke-width="2"/>
    <path d="M289 144C315 197 199 243 101 400H529C361 281 363 223 348 144Z" fill="${p.ink}"/>
    <path d="M300 145C327 211 229 268 145 400H491C342 272 355 215 337 145Z" fill="#717e76"/>
    <path d="M309 146C336 211 245 276 168 400M329 145C346 214 329 285 468 400" fill="none" stroke="${p.light}" stroke-width="3"/>
    <path d="M318 156L320 172M316 191L308 211M292 233L277 258M258 290L234 326M218 355L191 398" fill="none" stroke="${yellow}" stroke-width="5"/>
    <path d="M296 183L306 190M285 210L296 218M266 238L277 247M242 269L253 279M212 307L224 316M179 350L191 360" fill="none" stroke="${coral}" stroke-width="8"/>
    <g transform="translate(356 296) rotate(-15)">
      <ellipse cx="3" cy="45" rx="88" ry="24" fill="${p.ink}" opacity=".2" stroke="none"/>
      ${rect(-78, -3, 22, 55, 8, p.ink)}${rect(56, -3, 22, 55, 8, p.ink)}
      <path d="M-62-35L-42-72H39L62-35L73 36Q0 58-73 36Z" fill="${p.primary}"/>
      <path d="M-42-66H38L51-31H-53Z" fill="${blue}"/>
      <path d="M-34-59H-19L-29-37H-44Z" fill="${p.light}" stroke="none" opacity=".65"/>
      <path d="M-63-22Q0-8 63-22L67 16Q0 36-67 16Z" fill="${p.primary}"/>
      <path d="M-14-23V26H12V-23" fill="${p.light}"/>
      <path d="M-67 17Q0 37 67 17" fill="none"/>
      ${rect(-57, 4, 24, 12, 4, yellow)}${rect(33, 4, 24, 12, 4, yellow)}
      <path d="M-39 36H39" fill="none" stroke-width="5"/>
      <path d="M-77-27H-59M58-27H76" fill="none" stroke-width="7"/>
    </g>
    <path d="M111 280L90 308M136 288L110 326M489 237L508 258M482 254L514 288" fill="none" stroke-width="3"/>`;
}

function boomerang(p) {
  return `<ellipse cx="324" cy="358" rx="160" ry="17" fill="${p.ink}" opacity=".08" stroke="none"/>
    <path d="M113 245C57 160 168 67 326 70C473 73 558 145 528 228C510 280 435 309 371 309" fill="none" stroke-width="3" stroke-dasharray="9 11" opacity=".42"/>
    <path d="M399 293L369 310L399 322" fill="none" stroke-width="3"/>
    <g transform="rotate(-12 320 220)">
      <path d="M191 103Q177 98 173 113Q170 121 176 134L257 303Q267 326 291 316L480 225Q494 219 488 204L477 183Q470 169 458 175L299 250L215 119Q204 102 191 103Z" fill="#b56d44"/>
      <path d="M185 94Q171 89 167 104Q164 112 170 125L251 294Q261 317 285 307L474 216Q488 210 482 195L471 174Q464 160 452 166L293 241L209 110Q198 93 185 94Z" fill="${wood}"/>
      <path d="M190 102L281 258L466 179" fill="none" stroke="#f4d2a0" stroke-width="5"/>
      <path d="M183 153L215 134L235 165L199 186Z" fill="${p.primary}"/>
      <path d="M205 200L245 181L258 202L216 222Z" fill="${p.light}"/>
      <path d="M403 189L422 241L444 230L426 178Z" fill="${p.primary}"/>
      <path d="M371 205L387 258L365 269L350 216Z" fill="${p.light}"/>
      <path d="M251 257L263 280L289 270" fill="none" stroke="${p.ink}" stroke-width="3"/>
      ${circle(273, 291, 3, p.ink, 'stroke="none"')}
    </g>
    <path d="M94 261L115 281M119 250L144 270M143 241L169 260M469 107L487 116M457 122L480 135" fill="none" stroke-width="3"/>
    <path d="M99 335Q132 306 165 333Q134 349 99 335Z" fill="${mint}"/>
    <path d="M101 335L151 331" fill="none" stroke-width="1.5"/>
    ${circle(523, 284, 7, p.secondary)}`;
}

function tiles2048(p) {
  return `<ellipse cx="323" cy="383" rx="198" ry="17" fill="${p.ink}" opacity=".08" stroke="none"/>
    ${tile(165, 83, 112, 8, mint, p, -9, 60)}
    ${tile(346, 59, 113, 32, lilac, p, 10, 51)}
    ${tile(240, 139, 143, 128, p.light, p, -4, 53)}
    ${tile(104, 244, 123, 16, p.secondary, p, 9, 55)}
    ${tile(368, 224, 153, 2048, p.primary, p, 8, 47)}
    <path d="M295 88L310 78L325 89M313 57V77M278 356L304 356M291 343V369M502 133L510 121M514 149L529 144" fill="none" stroke-width="3"/>
    ${circle(112, 191, 7, yellow)}`;
}

function cherries(cx, cy, p) {
  return `<path d="M${cx - 21} ${cy + 30}Q${cx - 16} ${cy - 19} ${cx + 10} ${cy - 53}Q${cx + 35} ${cy - 22} ${cx + 35} ${cy + 22}" fill="none" stroke="${p.ink}" stroke-width="4"/>
    <path d="M${cx + 10} ${cy - 53}Q${cx - 29} ${cy - 78} ${cx - 45} ${cy - 48}Q${cx - 15} ${cy - 29} ${cx + 10} ${cy - 53}Z" fill="${mint}"/>
    <path d="M${cx - 36} ${cy - 49}L${cx + 8} ${cy - 53}" fill="none" stroke-width="1.5"/>
    ${circle(cx - 24, cy + 34, 29, coral)}${circle(cx + 33, cy + 29, 28, coral)}
    <path d="M${cx - 42} ${cy + 25}Q${cx - 39} ${cy + 16} ${cx - 30} ${cy + 15}M${cx + 17} ${cy + 18}Q${cx + 20} ${cy + 11} ${cx + 28} ${cy + 10}" fill="none" stroke="${p.light}" stroke-width="5"/>`;
}

function memory(p) {
  return `<ellipse cx="324" cy="374" rx="202" ry="17" fill="${p.ink}" opacity=".08" stroke="none"/>
    <g transform="rotate(-17 188 232)">
      ${rect(103, 112, 170, 245, 18, p.ink)}
      ${rect(98, 105, 170, 245, 18, p.secondary)}
      ${rect(111, 118, 144, 219, 11, p.secondary)}
      ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 3 }, (_, c) => `<path d="M${134 + c * 42} ${143 + r * 39}l9 13-9 13-9-13Z" fill="${p.light}" stroke-width="1.5"/>`).join('')).join('')}
    </g>
    <g transform="rotate(-7 270 208)">
      ${rect(185, 78, 182, 259, 18, p.ink)}
      ${rect(180, 69, 182, 259, 18, p.light)}
      ${rect(193, 82, 156, 233, 10, p.light, 'stroke-width="1.2" opacity=".5"')}
      ${cherries(269, 195, p)}
      ${circle(205, 95, 5, coral, 'stroke="none"')}${circle(337, 302, 5, coral, 'stroke="none"')}
    </g>
    <g transform="rotate(12 422 244)">
      ${rect(337, 120, 182, 259, 18, p.ink)}
      ${rect(331, 111, 182, 259, 18, p.light)}
      ${rect(344, 124, 156, 233, 10, p.light, 'stroke-width="1.2" opacity=".5"')}
      ${cherries(421, 237, p)}
      ${circle(356, 137, 5, coral, 'stroke="none"')}${circle(488, 344, 5, coral, 'stroke="none"')}
    </g>
    <path d="M509 84L521 70M526 105L545 101" fill="none" stroke-width="3"/>`;
}

/** Return scene contents only; the caller supplies the SVG wrapper/background. */
export function featuredScene(game, palette, seed = 0) {
  const id = typeof game === 'string' ? game : game?.id;
  const p = { bg: '#efe9de', ink: '#242820', primary: coral, secondary: mint, light: '#fff9e9', ...palette };
  const scenes = {
    'chogan-sudoku': sudoku,
    'aba-sum-ten': sumTen,
    'chogan-dots': dots,
    'chogan-mancala': mancala,
    'chogan-chess': chessScene,
    chess: chessScene,
    'littlejs-astroblast': astroblast,
    'aba-draft-line': racing,
    'hundred-game-20-boomerang': boomerang,
    '2048': tiles2048,
    memory,
  };
  const draw = scenes[id];
  if (!draw) return null;
  return `<g stroke="${p.ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${draw(p, seed)}</g>`;
}
