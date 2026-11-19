"""বিষয়ভিত্তিক প্রস্তুতি: টপিক না দেখিয়ে শুধু সেট (PIASH, ১৪/১১/২০২৬)।

    python3 tools/subject_sets.py      (seo_build.py নিজেই চালায়)

টপিকের ভাগ আমাদের ট্যাগ-তালিকায় থাকে (subject/data/<বিষয়>.json-এর topics আর
subject/data/t/<টপিক>/, Lyanna_data-র archive/tools/build_subject.py বানায়); সাইটে দেখানো হয় না।
এই যন্ত্র প্রতিটি বিষয়ের সব টপিক-সেটের প্রশ্ন ধরন অনুযায়ী (বিসিএস / অন্য পরীক্ষা / সম্ভাব্য;
সাম্প্রতিকে বছর) এক তালিকায় আনে, স্থির এলোমেলো ক্রমে (পরপর সেটে আলাদা টপিক), নতুন নম্বর দিয়ে:
subject/data/sets/<বিষয়>.json = {id: "<কোড>-all", name, g: [{kind, label, s: [[টপিক (কোড- ছাড়া), সেট], …]}]};
সেটের নাম <ধরন><ক্রম> (যেমন b12, সাম্প্রতিকে y2026-3), ক্রম ১ থেকে। প্রশ্নের ফাইল নতুন করে লেখা হয় না
(Cloudflare Pages-এ ২০,০০০ ফাইলের সীমা); q/ পাতা টপিকের সেট-ফাইলই আনে।
বিষয়ের পাতা subject/<বিষয়>/index.html-এর তালিকা-অংশ (<!--sets-->…<!--/sets-->) আর স্ক্রিপ্টও এখানে বসে।
"""
import glob, hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'subject', 'data')
BN = str.maketrans('0123456789', '০১২৩৪৫৬৭৮৯')
GL = {'b': 'বিসিএসের প্রশ্ন', 'x': 'অন্য পরীক্ষার প্রশ্ন', 'l': 'সম্ভাব্য প্রশ্ন'}


def key(seed, qid):
    return hashlib.md5(f'{seed}:{qid}'.encode()).hexdigest()


def build(slug):
    S = json.load(open(os.path.join(D, slug + '.json'), encoding='utf-8'))
    if not S.get('topics'):
        return None
    code = S['topics'][0]['id'].split('-')[0]
    kinds = S.get('kinds') or [k for k in ('b', 'x', 'l') if any(x['kind'] == k for t in S['topics'] for x in t['sets'])]
    groups, n = [], 0
    for k in kinds:
        pool = [(t['id'], x) for t in S['topics'] for x in t['sets'] if x['kind'] == k]
        if not pool: continue
        pool.sort(key=lambda tx: key(code + k, tx[0] + '/' + tx[1]['id']))
        groups.append({'kind': k, 'label': GL.get(k) or pool[0][1].get('label') or k,
                       's': [[tid[len(code) + 1:], x['id']] for tid, x in pool]})
        n += len(pool)
    os.makedirs(os.path.join(D, 'sets'), exist_ok=True)
    json.dump({'id': code + '-all', 'name': S['name'], 'g': groups},
              open(os.path.join(D, 'sets', slug + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return code, S['name'], n


BODY = '''<!--sets--><h1>{name}</h1>
<p class="sub">{ns}টি সেট · উত্তর দিলেই ব্যাখ্যা</p>
<div class="meter" aria-hidden="true"><i id="bar" style="width:0"></i></div>
<p class="pr" id="pr"></p>
<a class="mine" id="wrong" hidden></a>
<div id="list"><p class="sub">লোড হচ্ছে…</p></div>
</div>
<script>
/* বিষয়ের সব সেট (tools/subject_sets.py, টপিক দেখানো হয় না)। অগ্রগতি এই ফোনে 'subj:v1'.t['{code}-all'].s = {{<সেট>:[সঠিক,মোট,সময়]}};
   ভুল প্রশ্ন 'subj:w' (q/ পাতা লেখে)। */
const bn=n=>String(n).replace(/\\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const get=(k,d)=>{{try{{return JSON.parse(localStorage.getItem(k))||d}}catch(e){{return d}}}};
const P=get('subj:v1',{{}}),s=((P.t||{{}})['{code}-all']||{{}}).s||{{}},W=get('subj:w',{{}});
const SHOW=30;
fetch('/subject/data/sets/{slug}.json').then(r=>r.json()).then(A=>{{
  const list=document.getElementById('list');let h='',done=0,all=0;
  A.g.forEach(g=>{{const pre=/^[a-z]$/.test(g.kind)?g.kind:'y'+g.kind+'-',ss=g.s.map((x,i)=>pre+(i+1));all+=ss.length;
    const sh=Math.max(SHOW,ss.reduce((m,x,i)=>s[x]?i+2:m,0)),more=ss.length-sh;
    h+=`<div class="step"><h3>${{g.label}} · ${{bn(ss.length)}}টি সেট</h3><div class="pills">`+ss.map((x,i)=>{{if(s[x])done++;
      return `<a class="pill${{s[x]?' ok':''}}" href="/subject/q/?t={code}-all&s=${{x}}"${{i>=sh&&more>0?' hidden':''}}>সেট ${{bn(i+1)}}</a>`}}).join('')
      +(more>0?`<button type="button" class="pill more" onclick="const h=[...this.parentNode.querySelectorAll('[hidden]')];h.slice(0,60).forEach(e=>e.hidden=false);if(h.length<=60)this.remove();else this.textContent='আরও '+bn(h.length-60)+'টি সেট'">আরও ${{bn(more)}}টি সেট</button>`:'')+'</div></div>'}});
  list.innerHTML=h;
  document.getElementById('bar').style.width=(done/all*100)+'%';
  document.getElementById('pr').textContent=done?`${{bn(done)}}/${{bn(all)}} সেট শেষ`:'যেকোনো সেট দিয়ে শুরু করুন';
  const nw=Object.values(W).filter(q=>q.tp&&q.tp.startsWith('{code}-')).length,w=document.getElementById('wrong');
  if(nw){{w.href='/subject/q/?w={code}';w.innerHTML=`ভুলের খাতা: <b>${{bn(nw)}}টি</b> প্রশ্ন আবার অনুশীলন করুন →`;w.hidden=false}}
}}).catch(()=>{{document.getElementById('list').innerHTML='<p class="sub">তালিকা আনা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।</p>'}});
</script><!--/sets-->'''


def page(slug, code, name, sets):  # sets = মোট সেটের সংখ্যা
    p = os.path.join(ROOT, 'subject', slug, 'index.html')
    if not os.path.exists(p): return
    s = open(p, encoding='utf-8').read()
    body = BODY.format(name=name, ns=str(sets).translate(BN), code=code, slug=slug)
    if '<!--sets-->' in s:
        s = re.sub(r'<!--sets-->.*?<!--/sets-->', lambda m: body, s, count=1, flags=re.S)
    else:  # প্রথমবার (বা build_subject.py বিজ্ঞানের ছাঁচ থেকে নতুন করে লিখলে): h1 থেকে প্রথম </script> পর্যন্ত বদল
        s = re.sub(r'<h1>.*?</script>', lambda m: body, s, count=1, flags=re.S)
    d = f'{name}: {str(sets).translate(BN)}টি সেটে বিসিএস ও চাকরির প্রশ্নে অনুশীলন, প্রতিটি প্রশ্নের ব্যাখ্যা।'
    s = re.sub(r'(<meta (?:name="description"|property="og:description") content=")[^"]*"', lambda m: m.group(1) + d + '"', s)
    open(p, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    for f in sorted(glob.glob(os.path.join(D, '*.json'))):
        slug = os.path.basename(f)[:-5]
        r = build(slug)
        if r:
            page(slug, *r)
            print(f'{slug}: {r[2]} সেট')
