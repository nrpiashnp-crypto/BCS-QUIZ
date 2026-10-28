import sys, csv, re
def load(p):
    rows=[]
    with open(p,encoding='utf-8') as f:
        r=csv.DictReader(f,delimiter='\t',quoting=csv.QUOTE_NONE)
        for d in r:
            if d['level']=='5' and d['text'] and d['text'].strip():
                for k in ('left','top','width','height','block_num','par_num','line_num'): d[k]=int(d[k])
                d['conf']=float(d['conf']); rows.append(d)
    return rows
BL=re.compile('[ঀ-৥ৰ-৿]')  # Bengali letters/signs, not digits
BD=re.compile('[০-৯]')
LAT=re.compile('[A-Za-z0-9]')
def ov(a,b):
    x=max(0,min(a['left']+a['width'],b['left']+b['width'])-max(a['left'],b['left']))
    y=max(0,min(a['top']+a['height'],b['top']+b['height'])-max(a['top'],b['top']))
    return x*y/ max(1,a['width']*a['height'])
mix=load(sys.argv[1]); ben=load(sys.argv[2])
for w in mix:
    t=w['text']
    if BL.search(t) or BD.search(t) or not LAT.search(t): continue
    cands=[b for b in ben if ov(w,b)>0.4]
    if not cands: continue
    bt=' '.join(c['text'] for c in sorted(cands,key=lambda c:c['left']))
    if BL.search(bt) or (re.fullmatch(r'[0-9.,:/%-]+',t) and BD.search(bt) and not LAT.search(bt)):
        w['text']=bt
out=[];prev=None
for w in mix:
    key=(w['block_num'],w['par_num'],w['line_num'])
    if prev is None: out.append(w['text'])
    elif key[:2]!=prev[:2]: out.append('\n\n'+w['text'])
    elif key!=prev: out.append('\n'+w['text'])
    else: out.append(' '+w['text'])
    prev=key
s=''.join(out)
s=s.replace('৷','।').replace('ৰ','র')
s=re.sub(r'\s+([।,])',r'\1',s)
s=re.sub(r'(?<=[ঀ-৿])\s*\|(?=\s|$)','।',s)
tr=str.maketrans('089','০৪৯')
s=re.sub(r'\S*[০-৯]\S*',lambda m:m.group(0).translate(tr) if not re.search('[A-Za-z]',m.group(0)) else m.group(0),s)
s=re.sub(r'^(?:[\[\(]?[0OM7\]]{1,2}\]?|ৰ)\s+(?=[\u0980-\u09FF])','■ ',s,flags=re.M)
print(s)
