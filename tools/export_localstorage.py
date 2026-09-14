# -*- coding: utf-8 -*-
"""从 Edge/WebView2 的 localStorage leveldb（含 .ldb 表与 .log 增量）导出星屿平台键值。

用法: python export_localstorage.py <输出json> <leveldb目录 ...>
多个目录按顺序合并（应从旧到新传入）；日志增量最后统一叠加。
"""
import glob, json, os, re, struct, sys

FOOTER_MAGIC = 0xDB4775248B80FB57
ORIGIN_RE = re.compile(r"^https?://127\.0\.0\.1:86[23]\d$")

# ---------- leveldb 基础 ----------
def varint(buf, pos):
    result = 0; shift = 0
    while True:
        b = buf[pos]; pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            return result, pos
        shift += 7

def read_handle(buf, pos):
    off, pos = varint(buf, pos)
    size, pos = varint(buf, pos)
    return (off, size), pos

def decompress_block(raw):
    comp, data = raw[-5], raw[:-5]
    if comp == 0: return data
    if comp == 1:
        import cramjam
        return bytes(cramjam.snappy.decompress_raw(data))
    raise ValueError("unknown compression %d" % comp)

def parse_block(data):
    n = struct.unpack("<I", data[-4:])[0]
    restarts_start = len(data) - 4 - 4 * n
    pos = 0; last_key = b""; items = []
    while pos < restarts_start:
        shared, pos = varint(data, pos)
        non_shared, pos = varint(data, pos)
        vlen, pos = varint(data, pos)
        key = last_key[:shared] + data[pos:pos + non_shared]; pos += non_shared
        val = data[pos:pos + vlen]; pos += vlen
        if len(key) < shared: break
        items.append((key, val)); last_key = key
    return items

def parse_table(path):
    raw = open(path, "rb").read()
    if len(raw) < 53: return []
    footer = raw[-48:]
    if struct.unpack("<Q", footer[-8:])[0] != FOOTER_MAGIC: return []
    _, pos = read_handle(footer, 0)
    (off, size), _ = read_handle(footer, pos)
    out = []
    for _, v in parse_block(decompress_block(raw[off:off + size + 5])):
        (doff, dsize), _ = read_handle(v, 0)
        out.extend(parse_block(decompress_block(raw[doff:doff + dsize + 5])))
    return out

def parse_log(path):
    """解析 leveldb journal（最近未压缩到 .ldb 的写入）。"""
    data = open(path, "rb").read()
    entries = []
    for foffset in range(0, len(data), 32768):
        pos = foffset
        end = min(foffset + 32768, len(data))
        while pos + 7 <= end:
            _, ln, typ = struct.unpack("<IHB", data[pos:pos + 7]); pos += 7
            if ln == 0: break
            payload = data[pos:pos + ln]; pos += ln
            if typ not in (1, 2, 3) or len(payload) < 12: continue
            p = 12
            count = struct.unpack("<I", payload[8:12])[0]
            for _ in range(count):
                try:
                    if payload[p] != 1: break  # 只处理 PUT
                    p += 1
                    klen, p = varint(payload, p); k = payload[p:p + klen]; p += klen
                    vlen, p = varint(payload, p); v = payload[p:p + vlen]; p += vlen
                    entries.append((k, v))
                except Exception:
                    break
    return entries

# ---------- localStorage 条目解析 ----------
def split_key(k):
    """返回 (origin, user_key, tail)；tail 用于同库内取最新版本。"""
    if not k.startswith(b"_"): return None
    i = k.find(b"\x00")
    if i < 0: return None
    origin = k[1:i].decode("utf-8", "replace")
    if k[i + 1:i + 2] == b"\x01":           # 新格式: origin \x00\x01 key \x01 tail
        rest = k[i + 2:]
        j = rest.find(b"\x01")
        user_raw, tail = (rest[:j], rest[j:]) if j >= 0 else (rest, b"")
        try: key = user_raw.decode("utf-8")
        except Exception: key = user_raw.decode("utf-8", "replace")
    elif k[i + 1:i + 2] == b"\x00":          # 旧格式: origin \x00\x00 utf16le(key) [tail]
        user_raw = k[i + 2:]
        j = user_raw.find(b"\x01")
        tail = user_raw[j:] if j >= 0 else b""
        if j >= 0: user_raw = user_raw[:j]
        try: key = user_raw.decode("utf-16-le")
        except Exception: return None
    else:
        return None
    # 去掉混入键名的版本尾巴/损坏字节
    for cut in ("\x00", "\ufffd"):
        key = key.split(cut)[0]
    return origin, key, tail

def decode_value(v):
    if not v: return ""
    if v[0] == 0 and len(v) % 2 == 1:
        try: return v[1:].decode("utf-16-le", "replace")
        except Exception: pass
    if v[0] == 1:
        return v[1:].decode("latin-1", "replace")
    return v.decode("utf-8", "replace")

def export_dir(ldb_dir):
    """返回 {key: value}，同键取版本号(tail)最大的记录。"""
    best = {}
    for f in sorted(glob.glob(os.path.join(ldb_dir, "*.ldb"))):
        for k, v in parse_table(f):
            parts = split_key(k)
            if not parts: continue
            origin, key, tail = parts
            if not ORIGIN_RE.match(origin) or key.startswith("META"): continue
            old = best.get(key)
            if old is None or tail >= old[0]:
                best[key] = (tail, decode_value(v))
    return {k: v for k, (_, v) in best.items()}

def export_log_overlay(ldb_dir):
    out = {}
    for f in sorted(glob.glob(os.path.join(ldb_dir, "*.log"))):
        for k, v in parse_log(f):
            parts = split_key(k)
            if not parts: continue
            origin, key, _tail = parts
            if not ORIGIN_RE.match(origin) or key.startswith("META"): continue
            out[key] = decode_value(v)
    return out

if __name__ == "__main__":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    out_path, dirs = sys.argv[1], sys.argv[2:]
    merged = {}
    for d in dirs:                      # 先合并所有 ldb 表（旧 -> 新）
        merged.update(export_dir(d))
    for d in dirs:                      # 再叠加所有日志增量（含最新写入）
        merged.update(export_log_overlay(d))
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)
    print("merged keys:", len(merged))
    for k in sorted(merged):
        v = merged[k]
        print(" ", k, "=", (v[:70] + "...") if len(v) > 70 else v)
