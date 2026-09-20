import io, os, sys

Q = chr(34)
LQ = chr(0x201C)
RQ = chr(0x201D)

def is_cjk(ch):
    o = ord(ch)
    return 0x4e00 <= o <= 0x9fff

def is_cjkpunct(ch):
    return ch in u'、，。；：？！（）《》—…'


def fix(path):
    t = io.open(path, encoding='utf-8').read()
    out = []
    n = len(t)
    i = 0
    count = 0
    changed = 0
    while i < n:
        ch = t[i]
        if ch != Q:
            out.append(ch)
            i += 1
            continue
        if ch == chr(10):
            count = 0
        prev = t[i - 1] if i > 0 else ''
        nxt = t[i + 1] if i + 1 < n else ''
        nxt2 = t[i + 2] if i + 2 < n else ''
        nxtok = is_cjk(nxt) or is_cjkpunct(nxt) or (nxt == Q and nxt2 in (',', chr(10), '', ']', '}'))
        if (is_cjk(prev) or is_cjkpunct(prev)) and nxtok:
            changed += 1
            if nxt == Q:
                out.append(RQ)
            else:
                count += 1
                out.append(LQ if count % 2 == 1 else RQ)
            i += 1
            continue
        out.append(ch)
        i += 1
    if changed:
        io.open(path, 'w', encoding='utf-8').write(''.join(out))
    return changed


for name in sys.argv[1:]:
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
    print(name, 'fixed', fix(p))
