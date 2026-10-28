import re,glob,json,difflib,sys
D='/tmp/claude-0/ocrwork/out/BD_Affairs_Written_OCR'
NUM=r'([০-৯]{1,2}(?:\.[০-৯]{1,2}){0,3})'
def norm(s): return re.sub(r'[^ঀ-৿A-Za-z ]','',s).strip()
def sim(a,b): return difflib.SequenceMatcher(None,a,b).ratio()
out=[]
for f in sorted(glob.glob(D+'/[01]*_Chapter_*.md')):
    ch=int(f.split('/')[-1][:2]); txt=open(f,encoding='utf-8').read()
    title=txt.split('\n',1)[0].split(': ',1)[1]
    pg=re.split(r'<!-- পৃষ্ঠা (\d+) -->',txt)
    P=[(int(pg[i]),pg[i+1]) for i in range(1,len(pg),2)]
    toc=[]
    for pn,t in P[:4]:
        for l in t.split('\n'):
            m=re.match(r'^(?:■ )?(?:অধ্যায়\S*\s*)?'+NUM+r'[।.,:]?\s*[-–]?\s*(.+?)\s*…',l)
            if m: toc.append(norm(m.group(2)))
    tocpages=max([pn for pn,t in P[:4] if '…' in t] or [0])
    # build sections
    secs=[]; cur={'num':'','title':title,'kind':'section','lines':[]}
    for pn,t in P:
        if pn<=tocpages: continue
        for l in t.split('\n'):
            ls=l.strip()
            m=re.match(r'^(?:■ )?'+NUM+r'[।.,:]?\s*[-–]?\s*(.{2,140})$',ls)
            ok=False
            if m:
                h=m.group(2)
                ok=(toc and max(sim(x,norm(h)) for x in toc)>0.55) or ('.' in m.group(1) and len(h)<75 and '।' not in h and re.match(r'[ঀ-৿A-Z]',h))
            if ok:
                secs.append(cur); cur={'num':m.group(1),'title':m.group(2).strip().rstrip(':;'),'kind':'section','lines':[]}
            else: cur['lines'].append((pn,l))
    secs.append(cur)
    # split oversized sections at ■ subheads or numbered questions
    sp=[]
    for s in secs:
        if sum(len(l) for _,l in s['lines'])<8000: sp.append(s); continue
        part=dict(s,lines=[]); base=s
        for pn,l in s['lines']:
            q=re.match(r'^(?:প্রশ্ন\s*)?[০-৯]{1,2}\)\s*(\S.*)',l.strip())
            sub=l.startswith('■ ') and len(l)<90
            if (q or sub) and sum(len(x) for _,x in part['lines'])>1500:
                sp.append(part)
                if q: part={'num':base['num'],'title':q.group(1).strip()[:160],'kind':'question','parent':'','lines':[(pn,l)]}
                else: part={'num':base['num'],'title':base['title']+' — '+l[2:].strip().rstrip(':'),'kind':'section','parent':base['title'],'lines':[(pn,l)]}
            else: part['lines'].append((pn,l))
        sp.append(part)
    tops={}
    k=0
    for s in sp:
        body=re.sub(r'\n{3,}','\n\n','\n'.join(l for _,l in s['lines'])).strip()
        if len(body)<40 or not s['lines']: continue
        if s['num'] and '.' not in s['num']: tops[s['num']]=s['title']
        par=s.get('parent') or (tops.get(s['num'].split('.')[0],'') if '.' in s['num'] else '')
        subs=[re.sub(r'[:;।]+$','',x[2:]).strip() for _,x in s['lines'] if x.startswith('■ ') and len(x)<90]
        if s['kind']=='section' and re.search(r'বিগত বিসিএস|প্রশ্নসমূহ',s['title']): s['kind']='past_questions'
        k+=1; p0=s['lines'][0][0]; p1=s['lines'][-1][0]
        out.append({'id':f'bda-{ch:02d}-{k:03d}','subject':'বাংলাদেশ বিষয়াবলি','exam':'বিসিএস লিখিত',
          'chapter':ch,'chapter_title':title,'section_no':s['num'],'section_title':s['title'],'parent_section':par,
          'kind':s['kind'],'subtopics':subs[:15],
          'tags':[t for t in dict.fromkeys([title,par,s['title'].split(' — ')[0]]+subs[:15]) if t],
          'pages':f'{p0}-{p1}' if p1!=p0 else str(p0),'source':f'Live Written (CrackTech), অধ্যায় {ch}','text':body})
    print(ch,k,file=sys.stderr)
json.dump(out,open('/tmp/claude-0/topics/chunks.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(out))
