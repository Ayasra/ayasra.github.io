#!/usr/bin/env python3
"""
Build static per-surah data files for the Qur'an reader.

Usage:
    python3 build_surah.py 31            # one surah
    python3 build_surah.py 1 2 3         # several
    python3 build_surah.py all           # all 114
    python3 build_surah.py meta          # regenerate surahs.json only

Sources (fetched once, then baked into static files so the site works offline):
  * quran.com API v4 — Uthmani text, Saheeh International translation,
    per-word transliteration + gloss, tafsirs
Outputs, relative to Quran/assets/data/:
  surahs.json        metadata for all 114
  NNN.json           verses + words for surah NNN
  tafsir/NNN.json    tafsir text for surah NNN (loaded lazily)
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

API = 'https://api.quran.com/api/v4'
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'assets', 'data'))
TAFSIR_DIR = os.path.join(DATA, 'tafsir')

TRANSLATION_ID = 20          # Saheeh International
TAFSIRS = [
    ('muyassar', 16,  'التفسير الميسر',        'ar'),
    ('saadi',    91,  'تفسير السعدي',          'ar'),
    ('kathir',   169, 'Ibn Kathir (Abridged)', 'en'),
]

UA = 'Mozilla/5.0 (compatible; static-quran-builder/1.0)'


def get(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8'))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


TAG = re.compile(r'<[^>]+>')
WS = re.compile(r'[ \t ]+')


def clean(html):
    """Turn tafsir HTML into plain text, keeping paragraph breaks."""
    if not html:
        return ''
    s = html.replace('\r', '')
    s = re.sub(r'(?i)<br\s*/?>', '\n', s)
    s = re.sub(r'(?i)</p\s*>', '\n\n', s)
    s = re.sub(r'(?i)</div\s*>', '\n', s)
    s = re.sub(r'(?i)</h[1-6]\s*>', '\n\n', s)
    s = TAG.sub('', s)
    s = (s.replace('&nbsp;', ' ').replace('&amp;', '&')
           .replace('&lt;', '<').replace('&gt;', '>')
           .replace('&quot;', '"').replace('&#39;', "'"))
    s = WS.sub(' ', s)
    s = re.sub(r'\n\s*\n\s*\n+', '\n\n', s)
    return s.strip()


FOOTNOTE = re.compile(r'<sup[^>]*foot_note[^>]*>.*?</sup>', re.S | re.I)


def clean_translation(html):
    """Saheeh International text carries footnote superscripts — drop them."""
    return clean(FOOTNOTE.sub('', html or ''))


def fetch_meta():
    ch = get(API + '/chapters?language=en')['chapters']
    out = []
    for c in ch:
        out.append({
            'id': c['id'],
            'nameAr': c['name_arabic'],
            'nameEn': c['name_simple'],
            'nameTr': c['name_complex'],
            'meaning': c['translated_name']['name'],
            'place': c['revelation_place'],
            'order': c['revelation_order'],
            'verses': c['verses_count'],
            'pages': c['pages'],
            'bismillah': c['bismillah_pre'],
        })
    return out


def fetch_verses(sid, total):
    """All verses of a surah, with words, translation and Uthmani text."""
    verses, page, per = [], 1, 50
    while True:
        url = (f'{API}/verses/by_chapter/{sid}'
               f'?words=true&word_fields=text_uthmani,transliteration,location'
               f'&fields=text_uthmani&translations={TRANSLATION_ID}'
               f'&per_page={per}&page={page}')
        d = get(url)
        verses.extend(d['verses'])
        pg = d.get('pagination') or {}
        if not pg.get('next_page'):
            break
        page = pg['next_page']
        time.sleep(0.15)
    if len(verses) != total:
        raise SystemExit(f'surah {sid}: expected {total} verses, got {len(verses)}')
    return verses


def fetch_tafsir(sid, tid):
    """Tafsir for a whole surah, keyed by verse number."""
    out, page = {}, 1
    while True:
        d = get(f'{API}/tafsirs/{tid}/by_chapter/{sid}?per_page=50&page={page}')
        for t in d.get('tafsirs', []):
            key = t.get('verse_key') or ''
            if ':' in key:
                out[int(key.split(':')[1])] = clean(t.get('text'))
        pg = d.get('pagination') or {}
        if not pg.get('next_page'):
            break
        page = pg['next_page']
        time.sleep(0.15)
    return out


def build(sid, meta_by_id):
    m = meta_by_id[sid]
    print(f'  surah {sid:>3} {m["nameEn"]:<16} ({m["verses"]} verses) …', end='', flush=True)

    raw = fetch_verses(sid, m['verses'])
    verses = []
    for v in raw:
        n = int(v['verse_key'].split(':')[1])
        words = []
        for w in v.get('words', []):
            if w.get('char_type_name') != 'word':
                continue          # skip the end-of-ayah glyph
            words.append({
                'a': w.get('text_uthmani') or '',
                't': ((w.get('transliteration') or {}).get('text') or ''),
                'm': ((w.get('translation') or {}).get('text') or ''),
            })
        tr = ' '.join(w['t'] for w in words if w['t']).strip()
        en = ''
        if v.get('translations'):
            en = clean_translation(v['translations'][0].get('text'))
        verses.append({
            'n': n,
            'ar': v.get('text_uthmani') or '',
            'tr': tr,
            'en': en,
            'page': v.get('page_number'),
            'juz': v.get('juz_number'),
            'sajda': bool(v.get('sajdah_number')),
            'w': words,
        })

    surah = {
        'id': sid, 'nameAr': m['nameAr'], 'nameEn': m['nameEn'], 'nameTr': m['nameTr'],
        'meaning': m['meaning'], 'place': m['place'], 'order': m['order'],
        'versesCount': m['verses'], 'pages': m['pages'], 'bismillah': m['bismillah'],
        'translation': 'Saheeh International',
        'verses': verses,
    }
    os.makedirs(DATA, exist_ok=True)
    fn = os.path.join(DATA, f'{sid:03d}.json')
    with open(fn, 'w', encoding='utf-8') as f:
        json.dump(surah, f, ensure_ascii=False, separators=(',', ':'))

    taf = {'sources': [{'key': k, 'name': name, 'lang': lang} for k, _, name, lang in TAFSIRS],
           'verses': {}}
    for key, tid, _, _ in TAFSIRS:
        got = fetch_tafsir(sid, tid)
        for n, text in got.items():
            taf['verses'].setdefault(str(n), {})[key] = text
    os.makedirs(TAFSIR_DIR, exist_ok=True)
    tf = os.path.join(TAFSIR_DIR, f'{sid:03d}.json')
    with open(tf, 'w', encoding='utf-8') as f:
        json.dump(taf, f, ensure_ascii=False, separators=(',', ':'))

    print(f' verses {os.path.getsize(fn)//1024}KB · tafsir {os.path.getsize(tf)//1024}KB')


def main(argv):
    if not argv:
        print(__doc__)
        return 1

    os.makedirs(DATA, exist_ok=True)
    meta_path = os.path.join(DATA, 'surahs.json')
    if argv[0] == 'meta' or not os.path.exists(meta_path):
        print('fetching chapter metadata …')
        meta = fetch_meta()
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, separators=(',', ':'))
        print(f'  wrote surahs.json ({len(meta)} surahs)')
        if argv[0] == 'meta':
            return 0
    else:
        meta = json.load(open(meta_path, encoding='utf-8'))

    meta_by_id = {m['id']: m for m in meta}
    ids = list(range(1, 115)) if argv[0] == 'all' else [int(a) for a in argv]

    print(f'building {len(ids)} surah(s):')
    for sid in ids:
        build(sid, meta_by_id)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
