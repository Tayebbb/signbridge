"""Export the five-slide Markdown source to a landscape PDF; no content is duplicated here."""
from pathlib import Path
import re, json, html, argparse
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'submission/deck.md'
OUT=ROOT/'submission/deck.pdf'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--evidence-dir',default='docs/evidence/final')
evidence=(ROOT/parser.parse_args().evidence_dir).resolve()
assert evidence.is_relative_to((ROOT/'docs/evidence/final').resolve()), 'Evidence must stay under docs/evidence/final'
evidence.mkdir(parents=True,exist_ok=True)
W,H=960,540
INK=HexColor('#17352E'); PAPER=HexColor('#F7F8F3'); MUTED=HexColor('#496459'); LINE=HexColor('#CCD7CF'); ACCENT=HexColor('#C55F25')
text=SOURCE.read_text(encoding='utf-8')
slides=re.split(r'\n---\s*\n',text)
assert len(slides)==5, 'Exactly five Markdown slides required'
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('SignBridge - experimental signing companion')
c.setAuthor('SignBridge solo build')
style=ParagraphStyle('body',fontName='Helvetica',fontSize=16,leading=22,textColor=INK,spaceAfter=14)
small=ParagraphStyle('small',parent=style,fontSize=10.5,leading=14,textColor=MUTED)

def markup(s):
    s=html.escape(s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'\[(.+?)\]\((https?://[^)]+)\)',r'<a href="\2" color="#17352E"><u>\1</u></a>',s)
    s=s.replace('`','')
    return s

def para(s,x,y,width=872,font=16,leading=22,color=INK):
    p=Paragraph(markup(s),ParagraphStyle('p',parent=style,fontSize=font,leading=leading,textColor=color))
    _,height=p.wrap(width,500)
    assert y-height>=48, f'Text overflow on slide {page}: {s[:45]}'
    p.drawOn(c,x,y-height)
    return y-height-13

def image(path,x,y,width,height):
    r=ImageReader(str((SOURCE.parent/path).resolve())); iw,ih=r.getSize(); scale=min(width/iw,height/ih)
    dw,dh=iw*scale,ih*scale
    c.setFillColor(white); c.setStrokeColor(LINE); c.rect(x-1,y-height-1,width+2,height+2,fill=1,stroke=1)
    c.drawImage(r,x+(width-dw)/2,y-(height+dh)/2,width=dw,height=dh,mask='auto')

for page,raw in enumerate(slides,1):
    raw=re.sub(r'<!--.*?-->','',raw,flags=re.S).strip()
    lines=raw.splitlines(); title=lines[0].removeprefix('# ')
    source=next(line[8:] for line in lines if line.startswith('Source: '))
    content='\n'.join(line for line in lines[1:] if not line.startswith('Source: ')).strip()
    c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(INK);c.rect(0,H-8,W,8,fill=1,stroke=0)
    title_style=ParagraphStyle('title',fontName='Helvetica-Bold',fontSize=32 if page>1 else 44,leading=36 if page>1 else 48,textColor=INK)
    title_p=Paragraph(html.escape(title),title_style);_,th=title_p.wrap(872,100);title_p.drawOn(c,44,H-43-th)
    y=H-65-th
    if page==2:
        images=re.findall(r'!\[([^]]+)\]\(([^)]+)\)',content)
        image(images[0][1],44,y,426,240);image(images[1][1],490,y,426,240)
        caption_y=y-250
        para(images[0][0],44,caption_y,426,12,16);para(images[1][0],490,caption_y,426,12,16)
        paragraphs=[p.strip() for p in re.sub(r'!\[[^]]+\]\([^)]+\)','',content).split('\n\n') if p.strip()]
        y=caption_y-46
        for p in paragraphs:y=para(p,44,y,872,14,18)
    elif page==3:
        diagram=re.search(r'```text\n(.*?)\n```',content,re.S).group(1).splitlines()
        nodes=diagram[0].split(' -> ');boxw=196;boxh=50
        for i,node in enumerate(nodes):
            x=44+i*225;c.setFillColor(white);c.setStrokeColor(LINE);c.rect(x,y-boxh,boxw,boxh,fill=1,stroke=1)
            para(node,x+12,y-13,boxw-24,15,18)
            if i<3:c.setStrokeColor(ACCENT);c.line(x+boxw+5,y-25,x+boxw+23,y-25);c.line(x+boxw+18,y-20,x+boxw+23,y-25);c.line(x+boxw+18,y-30,x+boxw+23,y-25)
        y-=72
        for line in diagram[1:]:y=para(line,44,y,872,14,19,MUTED)
        y-=8
        for p in re.sub(r'```text\n.*?\n```','',content,flags=re.S).split('\n\n'):
            for line in p.splitlines():
                if line.startswith('- '):y=para('- '+line[2:],44,y,872,15,21)
    elif page==4:
        table_lines=[line for line in content.splitlines() if line.startswith('|') and not re.match(r'^\|[-| ]+\|$',line)]
        data=[[Paragraph(markup(cell.strip()),ParagraphStyle('cell',parent=style,fontSize=14,leading=18)) for cell in line.strip('|').split('|')] for line in table_lines]
        table=Table(data,colWidths=[205,667]);table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#E4EBE3')),('LINEBELOW',(0,0),(-1,-1),0.6,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
        _,height=table.wrap(872,500);table.drawOn(c,44,y-height);y-=height+17
        for p in content.split('\n\n'):
            if p.strip() and not p.lstrip().startswith('|'):y=para(p,44,y,872,14,19)
    else:
        for p in content.split('\n\n'):
            if not p.strip():continue
            for line in p.splitlines():
                if line.startswith('- '):y=para('- '+line[2:],44,y,872,17,24)
                else:y=para(line,44,y,872,25 if page==1 else 17,32 if page==1 else 24)
    foot=Paragraph(markup(source),small);_,fh=foot.wrap(830,100)
    assert fh<=31,'Source note too long'
    foot.drawOn(c,44,15)
    c.setFont('Helvetica',10);c.setFillColor(MUTED);c.drawRightString(W-35,18,f'{page}/5')
    c.showPage()
c.save()
pdf=PdfReader(OUT);assert len(pdf.pages)==5
extracted='\n'.join(p.extract_text() for p in pdf.pages)
for phrase in ['Technical renderability','Linguistic correctness','User comprehension','20/20','12/12','194','51','official']:
    assert phrase.lower() in extracted.lower(),f'Missing PDF content: {phrase}'
(evidence/'deck-validation.json').write_text(json.dumps({'source':'submission/deck.md','output':'submission/deck.pdf','pages':len(pdf.pages),'format':'960 x 540 pt landscape','markdownSlides':len(slides),'requiredTextPresent':True,'visualReview':'PENDING'},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'pdf':str(OUT),'pages':len(pdf.pages),'requiredTextPresent':True}))
