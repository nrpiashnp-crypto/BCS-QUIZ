# usage: clean.py in.csv out.json  (report to stderr)
import csv,sys,re,json
csv.field_size_limit(10**9)
R=list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig')))
BN='০১২৩৪৫৬৭৮৯'
def toi(s):
    try: return int(''.join(str(BN.index(c)) if c in BN else c for c in s))
    except: return None
def bn(n): return ''.join(BN[int(c)] for c in str(n))
QRE=re.compile(r'(করুন|দিন|লিখুন|করো|লেখো|কর|\?|বিসিএস\s*[\]\)!]|বিসিএস লিখিত\))\s*[।.]?\s*$|\[\s*[০-৯]+তম|[০-৯]+তম[^\]]*বিসিএস\]')
EXAM=re.compile(r'([০-৯]{1,2})তম')
log=lambda *a: print(*a,file=sys.stderr)
for r in R:
    r['tags']=[t for t in r['tags'].split('; ') if t]
    r['chapter']=int(r['chapter'])
    r['section_title']=re.sub(r'^\)\s*','',r['section_title']).strip()
# 1) OCR-wrong section numbers in a run: X.(k-1), Y.k?, X.(k+1) -> X.k
for i in range(1,len(R)-1):
    a,b,c=R[i-1]['section_no'],R[i]['section_no'],R[i+1]['section_no']
    if R[i-1]['chapter']==R[i+1]['chapter']==R[i]['chapter'] and a.count('.')==1 and c.count('.')==1 and b.count('.')==1:
        (am,ak),(bm,bk),(cm,ck)=[tuple(map(toi,x.split('.'))) for x in (a,b,c)]
        junk=len(re.sub(r'[\s০-৯.,%]','',R[i]['section_title']))<len(R[i]['section_title'])*0.3
        if not junk and am==cm and ck==ak+2 and (bm,bk)!=(am,ak+1):
            nb=bn(am)+'.'+bn(ak+1); log('renum',R[i]['id'],b,'->',nb); R[i]['section_no']=nb
# 2) headings that are really body text: out-of-run number + long non-question title -> merge into previous
out=[]
for i,r in enumerate(R):
    t=r['section_title']; isq=bool(QRE.search(t))
    if isq and r['kind']=='section': r['kind']='question'
    prev=out[-1] if out else None
    def major(x): return x['section_no'].split('.')[0] if x and x['section_no'] else None
    nxt=R[i+1] if i+1<len(R) else None
    junk=len(re.sub(r'[\s০-৯.,%]','',t))<len(t)*0.3
    body=not isq and (junk or bool(re.search(r'\bWo\b|কিমি থেকে|\bSeen\b',t)))
    if body and prev and prev['chapter']==r['chapter']:
        log('merge',r['id'],'->',prev['id'],'|',t[:70])
        prev['text']+='\n\n'+r['section_no']+' '+t+'\n'+r['text']
        p0=prev['pages'].split('-')[0]; p1=r['pages'].split('-')[-1]
        prev['pages']=p0 if p0==p1 else p0+'-'+p1
        prev['merged_ids']=prev.get('merged_ids',[])+[r['id']]
        continue
    # 3) "Base — <body sentence>" split titles
    if ' — ' in t:
        base,sub=t.split(' — ',1)
        if len(sub)>45 or '।' in sub or 'পৃ.' in sub:
            n=sum(1 for x in out if x['section_title'].startswith(base))+1
            r['section_title']=f'{base} (অংশ {bn(n)})'; log('retitle',r['id'],'|',r['section_title'])
    r['section_title']=re.sub(r'\s*[|]\s*$','',r['section_title'])
    out.append(r)
# 4) exam tags + split oversized
fin=[]
for r in out:
    ex=sorted({m+'তম বিসিএস' for m in EXAM.findall(r['section_title'])},key=lambda s:toi(s[:-8]) or 0)
    r['tags']=list(dict.fromkeys(r['tags']+ex+(['বিগত প্রশ্ন'] if r['kind'] in('question','past_questions') else [])))
    if r['kind']=='question' and r['section_title'] not in r['tags']: pass
    txt=r['text']
    if len(txt)<=12000: fin.append(r); continue
    n=-(-len(txt)//9000); paras=txt.split('\n\n'); parts=[[]]; size=0; tgt=len(txt)/n
    for p in paras:
        if size>=tgt*len(parts) and len(parts)<n: parts.append([])
        parts[-1].append(p); size+=len(p)+2
    for k,pp in enumerate(parts):
        c=dict(r,text='\n\n'.join(pp),id=r['id'] if k==0 else f"{r['id']}-{k+1}",
               section_title=f"{r['section_title']} ({bn(k+1)}/{bn(len(parts))})")
        fin.append(c)
    log('split',r['id'],len(txt),'->',[len('\n\n'.join(p)) for p in parts])
for x in fin: x['source_id']='lw-bda'
json.dump(fin,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False)
from collections import Counter
log('total',len(fin),Counter(x['kind'] for x in fin),'max',max(len(x['text']) for x in fin))
