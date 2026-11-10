#!/usr/bin/env python3
"""Chuyển dữ liệu điều hòa SmartIR (giấy phép MIT) thành thư viện AC của app.

Dùng:  python3 -I tools/build-ac-library.py <thư mục smartir/codes/climate> <thư mục data/ac> [commit]

- Chỉ lấy tệp Broadlink/Base64 (định dạng này giải mã được ra xung hồng ngoại thật).
  Tệp Xiaomi/ESPHome/LOOKin ở dạng khác bị bỏ qua (ghi rõ trong báo cáo).
- Mỗi mã được giải mã và kiểm tra cấu trúc; mã hỏng/cụt bị loại, không vá, không đoán.
- Gộp các tệp có bộ lệnh giống hệt nhau thành một bộ (gộp danh sách model).
- Kết quả: <data/ac>/index.js (nhẹ, dùng để chọn hãng/model + dò) và <data/ac>/<id>.js (tải khi chọn).
"""
import base64, collections, glob, hashlib, json, os, re, sys

TICK_US = 269 / 8192 * 1000  # µs mỗi tick (≈32,84)
B64 = re.compile(r'^[A-Za-z0-9+/]+$')

BRAND_FIX = {'ggeneral electric': 'General Electric', 'elgin': 'Elgin', 'royal': 'Royal', 'aux': 'AUX',
             'tcl': 'TCL', 'lg': 'LG', 'ac': 'AC'}
# Hãng thường gặp ở Việt Nam xếp trước; còn lại theo bảng chữ cái.
VN_FIRST = ['Daikin', 'Panasonic', 'LG', 'Samsung', 'Toshiba', 'Mitsubishi Electric', 'Mitsubishi Heavy', 'Hitachi',
            'Midea', 'Gree', 'Casper', 'Carrier', 'Electrolux', 'Sharp', 'Hisense', 'TCL', 'Haier', 'Funiki']
MODE_ORDER = ['cool', 'heat', 'dry', 'fan_only', 'fan', 'heat_cool', 'auto']


def clean_b64(v):
    if not isinstance(v, str):
        return None
    s = re.sub(r'\s+', '', v).rstrip('=')
    if not s or not B64.match(s):
        return None
    s += '=' * (-len(s) % 4)
    try:
        raw = base64.b64decode(s, validate=True)
    except Exception:
        return None
    return s, raw


def decode_pattern(raw):
    """Giải mã khung Broadlink IR (0x26) -> danh sách µs, hoặc None nếu không hợp lệ."""
    if len(raw) < 8 or raw[0] != 0x26:
        return None
    n = raw[2] | (raw[3] << 8)
    if 4 + n > len(raw) or n < 6:
        return None
    data = raw[4:4 + n]
    if data[-2:] != b'\x0d\x05':  # mã cụt: không có đoạn kết thúc chuẩn
        return None
    out, i = [], 0
    while i < n - 2:  # bỏ 0x0d 0x05 cuối (đoạn nghỉ kết thúc)
        b = data[i]
        if b == 0:
            if i + 2 >= n:
                return None
            v = (data[i + 1] << 8) | data[i + 2]
            i += 3
        else:
            v = b
            i += 1
        out.append(round(v * TICK_US))
    if len(out) % 2 == 0:  # kết thúc bằng xung (mark) -> số phần tử lẻ
        pass
    if not (10 <= len(out) <= 2000) or any(x <= 0 or x > 500000 for x in out):
        return None
    return out


def load(path):
    s = open(path, encoding='utf-8', errors='replace').read()
    s = re.sub(r',\s*([}\]])', r'\1', s)  # nhiều tệp nguồn có dấu phẩy thừa
    return json.loads(s)


def clean_tree(node, depth, stats):
    """Giữ các lá hợp lệ. depth = số tầng khóa còn lại trước khi tới mã."""
    if depth == 0:
        r = clean_b64(node)
        if r and decode_pattern(r[1]):
            stats['ok'] += 1
            return r[0]
        stats['bad'] += 1
        return None
    if not isinstance(node, dict):
        stats['bad'] += 1
        return None
    out = {}
    for k, v in node.items():
        c = clean_tree(v, depth - 1, stats)
        if c:
            out[str(k)] = c
    return out or None


def tree_depth(x):
    return 0 if not isinstance(x, dict) else 1 + max((tree_depth(v) for v in x.values()), default=0)


def temp_key(k):
    try:
        f = float(k)
        return str(int(f)) if f == int(f) else str(f)
    except ValueError:
        return None


def main():
    root, outdir = sys.argv[1], sys.argv[2]
    commit = sys.argv[3] if len(sys.argv) > 3 else ''
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.js'):
            os.remove(os.path.join(outdir, f))
    skipped = collections.Counter()
    groups = collections.OrderedDict()
    st = {'ok': 0, 'bad': 0}
    for path in sorted(glob.glob(os.path.join(root, '*.json')), key=lambda p: int(re.sub(r'\D', '', os.path.basename(p)) or 0)):
        fid = os.path.splitext(os.path.basename(path))[0]
        try:
            d = load(path)
        except Exception:
            skipped['không đọc được'] += 1
            continue
        if d.get('supportedController') != 'Broadlink' or d.get('commandsEncoding') != 'Base64':
            skipped['%s/%s' % (d.get('supportedController'), d.get('commandsEncoding'))] += 1
            continue
        cm = d.get('commands') or {}
        swings = [s for s in (d.get('swingModes') or []) if isinstance(s, str)]
        has_swing = tree_depth({k: v for k, v in cm.items() if k not in ('off', 'on')}) == 4
        depth = 3 + (1 if has_swing else 0)
        off = clean_b64(cm.get('off'))
        off = off[0] if off and decode_pattern(off[1]) else None
        on = clean_b64(cm.get('on'))
        on = on[0] if on and decode_pattern(on[1]) else None
        states = {}
        for mode, sub in cm.items():
            if mode in ('off', 'on'):
                continue
            t = clean_tree(sub, depth - 1 + 0, st) if True else None
            if t:
                states[str(mode)] = t
        # chuẩn hóa khóa nhiệt độ (tầng cuối)
        def fix_temps(node, lvl):
            if lvl == 1:
                out = {}
                for k, v in node.items():
                    tk = temp_key(k)
                    if tk is not None:
                        out[tk] = v
                return out
            return {k: fix_temps(v, lvl - 1) for k, v in node.items()}
        states = {m: fix_temps(t, depth - 1) for m, t in states.items()}
        states = {m: t for m, t in states.items() if t}
        # loại các nhánh rỗng sau khi chuẩn hóa
        def prune(node, lvl):
            if lvl == 0:
                return node
            out = {}
            for k, v in node.items():
                p = prune(v, lvl - 1) if lvl > 1 else v
                if p:
                    out[k] = p
            return out
        states = {m: prune(t, depth - 1) for m, t in states.items()}
        states = {m: t for m, t in states.items() if t}
        n_codes = sum(1 for _ in json.dumps(states).split('"')[1::2]) // 1
        if not off or not states:
            skipped['thiếu mã tắt/trạng thái hợp lệ'] += 1
            continue
        temps = sorted({float(t) for m in states.values() for sub in [m] for t in _leaf_keys(sub, depth - 1)})
        brand = (d.get('manufacturer') or '').strip()
        brand = BRAND_FIX.get(brand.lower(), brand) or 'Khác'
        modes = [m for m in MODE_ORDER if m in states] + [m for m in states if m not in MODE_ORDER]
        fans = []
        for m in modes:
            for f in states[m]:
                if f not in fans:
                    fans.append(f)
        entry = {
            'brand': brand, 'models': [str(x) for x in d.get('supportedModels', [])] or ['Chung'],
            'modes': modes, 'fans': fans, 'swings': swings if has_swing else [],
            'tmin': temps[0], 'tmax': temps[-1],
            'step': float(d.get('precision') or 1.0),
            'commands': dict(([('off', off)] if off else []) + ([('on', on)] if on else []) + list(states.items())),
        }
        sig = hashlib.sha1(json.dumps([brand, entry['commands']], sort_keys=True).encode()).hexdigest()
        g = groups.get(sig)
        if g:
            g['entry']['models'] = list(dict.fromkeys(g['entry']['models'] + entry['models']))
            g['ids'].append(fid)
        else:
            groups[sig] = {'entry': entry, 'ids': [fid]}

    brands = collections.OrderedDict()
    for g in groups.values():
        e = g['entry']
        e['id'] = g['ids'][0]
        e['source'] = {'name': 'SmartIR', 'license': 'MIT',
                       'url': 'https://github.com/smartHomeHub/SmartIR/blob/master/codes/climate/' + g['ids'][0] + '.json',
                       'files': [i + '.json' for i in g['ids']]}
        brands.setdefault(e['brand'], []).append(e)

    def brand_key(b):
        return (0, VN_FIRST.index(b)) if b in VN_FIRST else (1, b.lower())

    header = ('/* VIGO — thư viện mã IR điều hòa, tạo tự động bằng tools/build-ac-library.py từ SmartIR (MIT).\n'
              ' * KHÔNG sửa tay. Mã dạng Broadlink Base64, giải mã sang xung IR khi gửi. */\n')
    index = {'version': 1, 'source': {'name': 'SmartIR', 'url': 'https://github.com/smartHomeHub/SmartIR',
                                       'license': 'MIT', 'commit': commit}, 'brands': []}
    total_sets = 0
    for b in sorted(brands, key=brand_key):
        sets = brands[b]
        sets.sort(key=lambda e: (-sum(len(x) for x in [e['modes']]), -len(e['models']), int(e['id'])))
        isets = []
        for e in sets:
            with open(os.path.join(outdir, e['id'] + '.js'), 'w', encoding='utf-8') as fh:
                fh.write(header + 'VigoLib.registerAc(' + json.dumps(e['id']) + ',' + json.dumps(e, ensure_ascii=False, separators=(',', ':')) + ');\n')
            isets.append({'id': e['id'], 'models': e['models'], 'modes': e['modes'], 'fans': e['fans'],
                          'swings': e['swings'], 'tmin': e['tmin'], 'tmax': e['tmax'], 'step': e['step'],
                          'off': e['commands']['off'], 'source': e['source']})
        index['brands'].append({'name': b, 'sets': isets})
        total_sets += len(sets)
    with open(os.path.join(outdir, 'index.js'), 'w', encoding='utf-8') as fh:
        fh.write(header + 'VigoLib.registerAcIndex(' + json.dumps(index, ensure_ascii=False, separators=(',', ':')) + ');\n')
    size = sum(os.path.getsize(os.path.join(outdir, f)) for f in os.listdir(outdir)) // 1024
    print('Hãng: %d | bộ mã: %d | dung lượng: %d KB' % (len(brands), total_sets, size))
    print('Mã hợp lệ: %d, mã bị loại: %d' % (st['ok'], st['bad']))
    print('Tệp bỏ qua:', dict(skipped))


def _leaf_keys(node, lvl):
    if lvl == 1:
        yield from node.keys()
    else:
        for v in node.values():
            yield from _leaf_keys(v, lvl - 1)


if __name__ == '__main__':
    main()
