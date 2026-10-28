"""Shared helpers for the central question archive."""
import hashlib, json, os, re, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ARCH = os.path.join(ROOT, 'archive')
CHAPTER_DATA = os.environ.get('CHAPTER_DATA', '/mnt/project-files/website/অধ্যায়-কুইজ/data')

# Fields that describe the question itself. Everything else (qn, x, t, s, p, v ...)
# is per-paper context and lives on the paper's item, not on the archive record.
CORE = ('q', 'o', 'a', 'e')

# Real HTML tags (<b>, </sub>, <br/>) and entities only: "ΔH<0" or "a > b" is text.
_tags = re.compile(r'</?[a-z][a-z0-9]*(?:\s[^<>]*)?/?>|&[a-z]+;')
# Operators that change the meaning of a formula; everything else that is not a
# letter, digit or Bengali vowel sign / hasanta (category Mn/Mc) is punctuation.
_ops = set('+×÷=<>^√')

def norm(text):
    """Letters, digits, combining marks and formula operators, nothing else.
    "কি"/"কী" differ; "কাল"/"কল" differ; "a + 1/a"/"a - 1/a" differ; "হয়-"/"হয় —"
    do not. A minus is kept only when it starts a number (x^{-3}, -1)."""
    text = unicodedata.normalize('NFC', str(text)).lower()
    text = _tags.sub('', text).replace('\u2212', '-')
    text = re.sub(r'-(?=\d)', '\u2212', text)       # keep the sign of a number
    return ''.join(c for c in text if c.isalnum() or c == '\u2212' or c in _ops
                   or unicodedata.category(c) in ('Mn', 'Mc'))

def key(item):
    """Same question = same normalised stem + same set of options."""
    return norm(item['q']) + '|' + '|'.join(sorted(norm(o) for o in item['o']))

def qid(k):
    return 'q' + hashlib.sha1(k.encode('utf-8')).hexdigest()[:10]

def shard(i):
    return i[1:3]

def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def dump(obj, path, pretty=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')

def dump_lines(obj, path):
    """One record (or paper item) per line: small git diffs, compact files."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    j = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    with open(path, 'w', encoding='utf-8') as f:
        if 'items' in obj:
            head = {k: v for k, v in obj.items() if k != 'items'}
            f.write(j(head)[:-1] + ',"items":[\n')
            f.write(',\n'.join(j(r) for r in obj['items']))
            f.write('\n]}\n')
        else:
            f.write('{\n' + ',\n'.join(j(k) + ':' + j(v) for k, v in obj.items()) + '\n}\n')

def find_inline(html, name='Q'):
    """Return (start, end) of the JSON array in `const Q=[...];`."""
    i = html.find('const %s=' % name)
    if i < 0:
        return None
    start = i + len('const %s=' % name)
    dec = json.JSONDecoder()
    _, end = dec.raw_decode(html, start)
    return start, end

# Every place on the site (or feeding the site) that holds questions.
# Order = priority when the same question appears in several places: the first
# copy seen becomes the archive record, later copies keep only their differences.
SOURCES = [
    ('bcs',         'file',   'bcs/data/e/*.json'),
    ('chapter',     'file',   CHAPTER_DATA + '/*.json'),
    ('page',        'inline', 'sound/index.html'),
    ('page',        'inline', 'light/index.html'),
    ('jobs',        'file',   'jobs/data/e/*.json'),
    ('job-science', 'inline', 'job-science/index.html'),
    ('bcs-subject', 'file',   'bcs/data/s/*.json'),
    ('running',     'file',   'running/*/data/x/*.json'),
]

def source_files():
    import glob
    for coll, kind, pat in SOURCES:
        full = pat if pat.startswith('/') else os.path.join(ROOT, pat)
        for path in sorted(glob.glob(full)):
            yield coll, kind, path

def rel(path):
    if path.startswith(CHAPTER_DATA):
        return 'project-files:website/অধ্যায়-কুইজ/data/' + os.path.basename(path)
    return os.path.relpath(path, ROOT)

def abspath(r):
    if r.startswith('project-files:'):
        return os.path.join(CHAPTER_DATA, os.path.basename(r))
    return os.path.join(ROOT, r)

def paper_path(coll, path):
    base = os.path.splitext(os.path.basename(path))[0]
    if base == 'index':                      # inline pages: sound/index.html -> sound
        base = os.path.basename(os.path.dirname(path))
    if coll == 'running':                    # running/<series>/data/x/<id>.json
        base = path.split(os.sep)[-4] + '--' + base
    return os.path.join(ARCH, 'papers', coll, base + '.json')

def read_items(kind, path):
    if kind == 'file':
        return load(path)
    html = open(path, encoding='utf-8').read()
    s, e = find_inline(html)
    return json.loads(html[s:e])
