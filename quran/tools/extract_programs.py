#!/usr/bin/env python3
"""
Turn the two generated programme pages into one data file the web app can use.

    python3 extract_programs.py <dir-with-the-two-html-files>

Reads qiyam-40-nights.html and khatm-7-days.html and writes
../assets/data/programs.js -> window.QURAN_PROGRAMS.

Why parse the HTML rather than re-run the planners
--------------------------------------------------
build_plan.py allocates the forty nights by dynamic programming over ruku'
blocks and needs three data files that are not shipped with it. The generated
page already contains the finished allocation, and the allocation is the thing
worth preserving — so the page is the source of truth here, and the totals are
checked against 6236 at the end rather than trusted.

The Arabic strings are taken as-is; the English ones are used only to parse
ranges, because Latin surah names and Western digits are far less ambiguous to
match than the Arabic-Indic forms.
"""

import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, '..', 'assets', 'data'))

EN = ["Al-Fatihah","Al-Baqarah","Aal-'Imran","An-Nisa","Al-Ma'idah","Al-An'am","Al-A'raf","Al-Anfal",
"At-Tawbah","Yunus","Hud","Yusuf","Ar-Ra'd","Ibrahim","Al-Hijr","An-Nahl","Al-Isra","Al-Kahf","Maryam",
"Ta-Ha","Al-Anbiya","Al-Hajj","Al-Mu'minun","An-Nur","Al-Furqan","Ash-Shu'ara","An-Naml","Al-Qasas",
"Al-'Ankabut","Ar-Rum","Luqman","As-Sajdah","Al-Ahzab","Saba","Fatir","Ya-Sin","As-Saffat","Sad",
"Az-Zumar","Ghafir","Fussilat","Ash-Shura","Az-Zukhruf","Ad-Dukhan","Al-Jathiyah","Al-Ahqaf","Muhammad",
"Al-Fath","Al-Hujurat","Qaf","Adh-Dhariyat","At-Tur","An-Najm","Al-Qamar","Ar-Rahman","Al-Waqi'ah",
"Al-Hadid","Al-Mujadilah","Al-Hashr","Al-Mumtahanah","As-Saff","Al-Jumu'ah","Al-Munafiqun","At-Taghabun",
"At-Talaq","At-Tahrim","Al-Mulk","Al-Qalam","Al-Haqqah","Al-Ma'arij","Nuh","Al-Jinn","Al-Muzzammil",
"Al-Muddaththir","Al-Qiyamah","Al-Insan","Al-Mursalat","An-Naba","An-Nazi'at","'Abasa","At-Takwir",
"Al-Infitar","Al-Mutaffifin","Al-Inshiqaq","Al-Buruj","At-Tariq","Al-A'la","Al-Ghashiyah","Al-Fajr",
"Al-Balad","Ash-Shams","Al-Layl","Ad-Duha","Ash-Sharh","At-Tin","Al-'Alaq","Al-Qadr","Al-Bayyinah",
"Az-Zalzalah","Al-'Adiyat","Al-Qari'ah","At-Takathur","Al-'Asr","Al-Humazah","Al-Fil","Quraysh",
"Al-Ma'un","Al-Kawthar","Al-Kafirun","An-Nasr","Al-Masad","Al-Ikhlas","Al-Falaq","An-Nas"]


def norm(s):
    """Fold the apostrophe and dash variants the two pages disagree about."""
    return (s.replace('’', "'").replace('‘', "'")
             .replace('–', '-').replace('—', '-')
             .replace('&#x27;', "'").strip().lower())


EN_LOOKUP = {norm(n): i + 1 for i, n in enumerate(EN)}
# The pages occasionally use an alternate name for the same surah.
EN_LOOKUP.update({
    norm("Bani Isra'il"): 17, norm('Al-Israa'): 17, norm('Ta Ha'): 20,
    norm('Saba\''): 34, norm('Fussilat'): 41, norm('Ghafir'): 40,
})

INDEX = None      # loaded from assets/data/index.js


def load_index():
    global INDEX
    path = os.path.join(DATA, 'index.js')
    raw = open(path, encoding='utf-8').read()
    INDEX = json.loads(raw[raw.index('=') + 1:].rstrip().rstrip(';'))


def to_global(surah, ayah):
    return INDEX['surahStart'][surah] + ayah - 1


def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s)


def clean(s):
    return html.unescape(strip_tags(s)).replace('\xa0', ' ').strip()


RANGE_RE = re.compile(r"^\s*(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s*$")
SINGLE_RE = re.compile(r"^\s*(.+?)\s+(\d+)\s*$")


def parse_ranges(text):
    """'Hud 110-123 · Yusuf 1-20' -> [(11,110,123), (12,1,20)]"""
    out = []
    for part in re.split(r'[·•]', clean(text)):
        part = part.strip()
        if not part:
            continue
        m = RANGE_RE.match(part)
        if m:
            name, a, b = m.group(1), int(m.group(2)), int(m.group(3))
        else:
            m = SINGLE_RE.match(part)
            if not m:
                raise SystemExit('cannot parse range: %r' % part)
            name, a, b = m.group(1), int(m.group(2)), int(m.group(2))
        s = EN_LOOKUP.get(norm(name))
        if not s:
            raise SystemExit('unknown surah name: %r (in %r)' % (name, part))
        out.append((s, a, b))
    return out


def as_global(triples):
    return [[to_global(s, a), to_global(s, b)] for s, a, b in triples]


def merge(ranges):
    if not ranges:
        return []
    xs = sorted(ranges)
    out = [list(xs[0])]
    for r in xs[1:]:
        if r[0] <= out[-1][1] + 1:
            out[-1][1] = max(out[-1][1], r[1])
        else:
            out.append(list(r))
    return out


def measure(ranges):
    return sum(b - a + 1 for a, b in ranges)


# ----------------------------------------------------------------- 40 nights

def extract_nights(path):
    src = open(path, encoding='utf-8').read()
    cards = re.split(r'<article class="card"', src)[1:]
    nights = []

    for card in cards:
        n = int(re.search(r'data-n="(\d+)"', card).group(1))

        def grab(pattern, default=''):
            m = re.search(pattern, card, re.S)
            return clean(m.group(1)) if m else default

        title = grab(r'<h3 class="ar"[^>]*>(.*?)</h3>')
        sub = grab(r'<p class="ar"[^>]*>(.*?)</p>')
        ayat = int(grab(r'title="ayat"><b>(\d+)</b>') or 0)
        pages = float(grab(r'title="pages"><b>([\d.]+)</b>') or 0)
        minutes = int(grab(r'title="recitation"><b>~(\d+)</b>') or 0)
        juz = grab(r'<span class="juz">(.*?)</span>').replace('Juz', '').strip()
        themed = 'badge theme' in card

        rakaat = []
        # Split on the opening marker rather than trying to match a balanced
        # closing pair: these blocks nest, and a non-greedy `</div></div>`
        # swallows the closing tag of the field it is meant to contain.
        for rk in card.split('<div class="rak')[1:]:
            en = re.search(r'<div class="ren">(.*?)</div>', rk, re.S)
            ar_ = re.search(r'<div class="rar"[^>]*>(.*?)</div>', rk, re.S)
            meta = re.findall(r'<div class="rmeta"><span[^>]*>(.*?)</span><span[^>]*>(.*?)</span>', rk, re.S)
            meta = list(meta[0]) if meta else []
            if not en:
                continue
            triples = parse_ranges(en.group(1))
            rakaat.append({
                'ar': clean(ar_.group(1)) if ar_ else '',
                'r': as_global(triples),
                'ayat': int(clean(meta[0])) if meta else measure(as_global(triples)),
                'min': int(re.sub(r'\D', '', clean(meta[1]))) if len(meta) > 1 else 0,
            })

        if len(rakaat) != 4:
            raise SystemExit('night %d has %d rakaat, expected 4' % (n, len(rakaat)))

        night = {
            'n': n, 'title': title, 'sub': sub,
            'ayat': ayat, 'pages': pages, 'min': minutes, 'juz': juz,
            'themed': themed,
            'rakaat': rakaat,
            'r': merge([tuple(x) for rk in rakaat for x in rk['r']]),
        }

        closer = re.search(r'<div class="xar ar"[^>]*><b>الخاتمة[^<]*</b>(.*?)<div class="crat ar">(.*?)</div>', card, re.S)
        if closer:
            night['closer'] = clean(closer.group(1))
            night['closerWhy'] = clean(closer.group(2))

        pull = re.search(r'<div class="xar ar"[^>]*><b>يُقدَّم[^<]*</b>(.*?)</div>', card, re.S)
        if pull:
            night['pull'] = clean(pull.group(1))

        nights.append(night)

    nights.sort(key=lambda x: x['n'])
    return nights


# ----------------------------------------------------------------- 7 manazil

def extract_manazil(path):
    src = open(path, encoding='utf-8').read()
    cards = re.split(r'<article class="card" id="d\d+">', src)[1:]
    days = []

    for i, card in enumerate(cards, start=1):
        def grab(pattern, default=''):
            m = re.search(pattern, card, re.S)
            return clean(m.group(1)) if m else default

        title = grab(r'<h3 class="ar"[^>]*>(.*?)</h3>')
        sub = grab(r'<p class="ar"[^>]*>(.*?)</p>')
        letter = grab(r'<div class="mnbig ar">(.*?)</div>')
        span_ar = grab(r'<div class="spar ar"[^>]*>(.*?)<em>')
        stats = re.findall(r'<span><b>(.*?)</b>(.*?)</span>', card, re.S)

        sittings = []
        for sit in card.split('<div class="sit">')[1:]:
            en = re.search(r'<div class="sen">(.*?)</div>', sit, re.S)
            ar_ = re.search(r'<div class="sar ar"[^>]*>(.*?)</div>', sit, re.S)
            name = re.search(r'<div class="snar ar"[^>]*><b>(.*?)</b>\s*<span>(.*?)</span>', sit, re.S)
            mins = re.search(r'<div class="sm"><b>~(\d+)</b>', sit)
            if not en:
                continue
            triples = parse_ranges(en.group(1))
            sittings.append({
                'name': clean(name.group(1)) if name else '',
                'when': clean(name.group(2)) if name else '',
                'ar': clean(ar_.group(1)) if ar_ else '',
                'r': as_global(triples),
                'min': int(mins.group(1)) if mins else 0,
            })

        # The Arabic reference sits in a <span class="ar"> inside .kref, and the
        # Arabic note is the second <p> of .kbody.
        keys = []
        for k in card.split('<div class="key">')[1:]:
            ref = re.search(r'<div class="kref">.*?<span class="ar"[^>]*>(.*?)</span>', k, re.S)
            note = re.search(r'<p class="ar"[^>]*>(.*?)</p>', k, re.S)
            if ref or note:
                keys.append({'ref': clean(ref.group(1)) if ref else '',
                             'note': clean(note.group(1)) if note else ''})

        days.append({
            'n': i, 'letter': letter, 'title': title, 'sub': sub,
            'span': span_ar,
            'ayat': int(re.sub(r'\D', '', stats[1][0])) if len(stats) > 1 else 0,
            'r': merge([tuple(x) for s in sittings for x in s['r']]),
            'sittings': sittings,
            'keys': keys,
        })

    return days


# --------------------------------------------------------------------- checks

def check(name, ranges_per_step, expect_total=6236):
    """A khatm must cover every ayah exactly once — no gap, no repeat."""
    flat = []
    for rs in ranges_per_step:
        flat.extend(tuple(r) for r in rs)
    merged = merge(flat)
    total = measure(merged)
    overlap = sum(measure([list(r)]) for r in flat) - total

    problems = []
    if merged != [[1, expect_total]]:
        problems.append('does not tile 1..%d — merged to %r' % (expect_total, merged[:6]))
    if total != expect_total:
        problems.append('covers %d ayat, expected %d' % (total, expect_total))
    if overlap:
        problems.append('%d ayat counted more than once' % overlap)

    if problems:
        print('  %s: %s' % (name, '; '.join(problems)))
        return False
    print('  %s: tiles all %d ayat exactly once' % (name, expect_total))
    return True


def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    load_index()

    qiyam = os.path.join(src_dir, 'qiyam-40-nights.html')
    khatm = os.path.join(src_dir, 'khatm-7-days.html')
    for p in (qiyam, khatm):
        if not os.path.exists(p):
            raise SystemExit('missing %s' % p)

    nights = extract_nights(qiyam)
    days = extract_manazil(khatm)

    print('extracted %d nights, %d manazil' % (len(nights), len(days)))
    print('coverage:')
    ok1 = check('qiyam-40', [n['r'] for n in nights])
    ok2 = check('manzil-7', [d['r'] for d in days])

    # the rak'ah of a night must reconstruct that night exactly
    for n in nights:
        rk = merge([tuple(x) for r in n['rakaat'] for x in r['r']])
        if rk != n['r']:
            print('  night %d: rakaat do not reconstruct the portion' % n['n'])
            ok1 = False

    out = {
        'qiyam40': {
            'id': 'qiyam40',
            'name': 'ختمة القيام في أربعين ليلة',
            'short': 'أربعون ليلة',
            'unit': 'night',
            'steps': nights,
            'note': 'القرآن كاملًا في أربعين ليلة، أربع ركعات كل ليلة، بحدٍّ أدنى مئة آية، '
                    'موزَّعةً على مقدار التلاوة لا على عدد الآيات، ولا يقع الفصل إلا عند '
                    'رأس ركوع أو خاتمة سورة. وفي ثماني ليالٍ تُقدَّم سورة من آخر المصحف '
                    'إلى الركعة الرابعة لتُقرأ مع ما يناسبها، وتُحذف من موضعها المتأخر '
                    'فيبقى مجموع الختمة ٦٢٣٦ آية لا يزيد ولا ينقص.',
        },
        'manzil7': {
            'id': 'manzil7',
            'name': 'ختمة الصحابة في سبعة أيام',
            'short': 'سبعة أيام',
            'unit': 'day',
            'steps': days,
            'mnemonic': 'فَمِي بِشَوْقٍ',
            'note': 'القرآن كاملًا في أسبوع، على تقسيم الصحابة رضي الله عنهم: ثلاث سور، '
                    'ثم خمس، فسبع، فتسع، فإحدى عشرة، فثلاث عشرة، ثم المفصَّل وحده. '
                    'وكل يوم يبدأ من رأس سورة. وحروف «فَمِي بِشَوْقٍ» هي أوائل السور '
                    'التي تُفتتح بها الأيام السبعة.',
        },
    }

    path = os.path.join(DATA, 'programs.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* generated by tools/extract_programs.py — do not edit by hand */\n')
        f.write('window.QURAN_PROGRAMS = ')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    print('wrote %s (%.1f KB)' % (path, os.path.getsize(path) / 1024.0))
    return 0 if (ok1 and ok2) else 1


if __name__ == '__main__':
    sys.exit(main())
