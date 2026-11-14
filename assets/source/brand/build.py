from pathlib import Path
import json, hashlib
root=Path('/tmp/nearfest-brand')
glyphs=json.loads((root/'glyphs.json').read_text())
ink='#292820'; cream='#f7f4e8'; coral='#fa8264'; lilac='#c6b5ef'; yellow='#f8df58'
def svg(w,h,body,title='NearFest'):
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none" role="img" aria-labelledby="title"><title id="title">{title}</title>{body}</svg>'
def word(color=ink):
 return ''.join(f'<path d="{g["d"]}" transform="translate({g["x"]:.3f} 0)" fill="{color}"/>' for g in glyphs)
# Two folded festival wristbands cross to form an N. The last edge is a ribbon notch.
def mark(mono=None):
 return f'''<path d="M12 85V12H36V85C36 94 31 99 24 99S12 94 12 85Z" fill="{mono or lilac}"/>
<path d="M12 12H36L92 99H68Z" fill="{mono or ink}"/>
<path d="M68 26C68 17 73 12 81 12H92V99L80 91L68 99Z" fill="{mono or coral}"/>'''
assets={
 'nearfest-logo.svg':svg(512,96,f'<g transform="translate(0 1) scale(.82)">{mark()}</g><g transform="translate(102 78) scale(.89)">{word()}</g>'),
 'nearfest-logo-dark.svg':svg(512,96,f'<g transform="translate(0 1) scale(.82)">{mark(ink)}</g><g transform="translate(102 78) scale(.89)">{word()}</g>'),
 'nearfest-logo-light.svg':svg(512,96,f'<g transform="translate(0 1) scale(.82)">{mark(cream)}</g><g transform="translate(102 78) scale(.89)">{word(cream)}</g>'),
 'nearfest-wordmark.svg':svg(446,88,f'<g transform="translate(0 76)">{word()}</g>'),
 'nearfest-mark.svg':svg(104,112,mark()),
 'nearfest-icon.svg':svg(128,128,f'<rect width="128" height="128" rx="30" fill="{yellow}"/><g transform="translate(12 8)">{mark()}</g>'),
 'favicon.svg':svg(64,64,f'<rect width="64" height="64" rx="16" fill="{yellow}"/><g transform="translate(6 4) scale(.5)">{mark(ink)}</g>'),
}
for name,body in assets.items(): (root/name).write_text(body)
preview=f'''<rect width="1440" height="1000" fill="{cream}"/>
<text x="80" y="80" fill="{ink}" font-family="Helvetica,Arial,sans-serif" font-size="16" letter-spacing="4">NEARFEST / BRAND IDENTITY</text>
<g transform="translate(205 202) scale(2)">{assets['nearfest-logo.svg'].split('</title>',1)[1].removesuffix('</svg>')}</g>
<text x="720" y="460" text-anchor="middle" fill="{ink}" font-family="Helvetica,Arial,sans-serif" font-size="24">Bring your people. Play your part.</text>
<line x1="80" y1="540" x2="1360" y2="540" stroke="{ink}" stroke-opacity=".15"/>
<rect x="80" y="600" width="430" height="270" rx="24" fill="{lilac}"/>
<g transform="translate(245 666)">{mark(ink)}</g>
<text x="112" y="840" fill="{ink}" font-family="Helvetica,Arial,sans-serif" font-size="13" letter-spacing="2">THE RALLY RIBBON</text>
<rect x="530" y="600" width="430" height="270" rx="24" fill="{ink}"/>
<g transform="translate(560 697) scale(.73)">{assets['nearfest-logo-light.svg'].split('</title>',1)[1].removesuffix('</svg>')}</g>
<text x="562" y="840" fill="{cream}" font-family="Helvetica,Arial,sans-serif" font-size="13" letter-spacing="2">ONE COLOUR. SAME ENERGY.</text>
<rect x="980" y="600" width="380" height="270" rx="24" fill="{yellow}"/>
<g transform="translate(1118 644)">{mark()}</g>
<g transform="translate(1101 766) scale(.31)">{word()}</g>
<text x="1012" y="840" fill="{ink}" font-family="Helvetica,Arial,sans-serif" font-size="13" letter-spacing="2">SMALL SCREEN. BIG PERSONALITY.</text>
<text x="80" y="946" fill="{ink}" font-family="Helvetica,Arial,sans-serif" font-size="14">Original ribbon monogram · Outlined lettering · SVG at every size</text>'''
(root/'nearfest-brand-preview.svg').write_text(svg(1440,1000,preview,'NearFest brand presentation'))
(root/'manifest.json').write_text(json.dumps({'name':'NearFest','symbol':'Rally ribbon: two folded festival wristbands cross into an N, representing players meeting in one festival of games.','palette':{'ink':ink,'cream':cream,'coral':coral,'lilac':lilac,'yellow':yellow},'assets':{n:{'sha256':hashlib.sha256(v.encode()).hexdigest()} for n,v in assets.items()},'lettering':{'family':'Caprasimo Regular','source':'https://github.com/google/fonts/tree/main/ofl/caprasimo','license':'SIL Open Font License 1.1','treatment':'Outlined to paths, optical tracking adjusted. No font dependency in public logos.'}},indent=2))
