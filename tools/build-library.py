#!/usr/bin/env python3
"""Chuyển các tệp .ir của Flipper-IRDB (giấy phép CC0) thành web/data/ir-library.js.

Dùng:  python3 -I tools/build-library.py <thư mục Flipper-IRDB> <tệp ra> [commit]

- Chỉ lấy loại TV của các hãng trong BRANDS.
- Chỉ giữ giao thức app mã hóa được (NEC, NECext, Samsung32, SIRC*, Kaseikyo) và raw hợp lệ.
- Gộp các tệp có bộ mã giống hệt nhau; ghi lại tên các remote đã gộp.
- Không tự tạo mã: mọi mã đều lấy nguyên từ tệp nguồn.
"""
import json, os, re, sys, collections

BRANDS = ['Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Xiaomi', 'Panasonic', 'Sharp', 'Toshiba',
          'Philips', 'Sanyo', 'Hitachi', 'Haier', 'JVC', 'Daewoo', 'Akai', 'Android']
PROTO = {'NEC': 'nec', 'NECext': 'necext', 'Samsung32': 'samsung32', 'SIRC': 'sirc12',
         'SIRC15': 'sirc15', 'SIRC20': 'sirc20', 'Kaseikyo': 'kaseikyo'}
ADDR_MAX = {'nec': 0xFF, 'necext': 0xFFFF, 'samsung32': 0xFF, 'sirc12': 0x1F, 'sirc15': 0xFF,
            'sirc20': 0x1FFF, 'kaseikyo': 0x3FFFFFF}
CMD_MAX = {'nec': 0xFF, 'necext': 0xFFFF, 'samsung32': 0xFF, 'sirc12': 0x7F, 'sirc15': 0x7F,
           'sirc20': 0x7F, 'kaseikyo': 0x3FF}

KEYMAP = {
    'power': 'power', 'vol_up': 'vol_up', 'vol_dn': 'vol_down', 'vol_down': 'vol_down', 'mute': 'mute',
    'ch_next': 'ch_up', 'ch_prev': 'ch_down', 'up': 'up', 'down': 'down', 'left': 'left', 'right': 'right',
    'ok': 'ok', 'enter': 'ok', 'select': 'ok', 'back': 'back', 'return': 'back', 'home': 'home',
    'menu': 'menu', 'source': 'source', 'input': 'source', 'tv': 'src_tv', 'hdmi': 'src_hdmi', 'av': 'src_av',
}
for i in range(10):
    KEYMAP[str(i)] = str(i)
LABELS = {'exit': 'Thoát', 'info': 'Thông tin', 'guide': 'Hướng dẫn', 'settings': 'Cài đặt', 'play': 'Phát',
          'pause': 'Tạm dừng', 'stop': 'Dừng', 'rewind': 'Tua lại', 'forward': 'Tua tới',
          'fast_forward': 'Tua tới', 'red': 'Đỏ', 'green': 'Xanh lá', 'yellow': 'Vàng', 'blue': 'Xanh dương',
          'sleep': 'Hẹn giờ tắt', 'tools': 'Công cụ', 'list': 'Danh sách', 'ch_list': 'Danh sách kênh',
          'text': 'Teletext', 'search': 'Tìm kiếm', 'apps': 'Ứng dụng', 'smart_hub': 'Smart Hub',
          'subtitle': 'Phụ đề', 'record': 'Ghi', 'rec': 'Ghi', 'netflix': 'Netflix', 'youtube': 'YouTube',
          'prime_video': 'Prime Video', 'picture': 'Hình ảnh', 'audio': 'Âm thanh', 'display': 'Hiển thị',
          'fav': 'Yêu thích', 'help': 'Trợ giúp', 'option': 'Tùy chọn', 'options': 'Tùy chọn'}
MAX_RAW = 400


def le_int(s):
    b = [int(x, 16) for x in s.split()]
    v = 0
    for x in reversed(b):
        v = v * 256 + x
    return v


def norm(name):
    s = name.lower().replace('+', '_plus').replace('-', '_minus')
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s or 'khac'


def parse_file(text):
    blocks, cur = [], None
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or ':' not in line:
            continue
        k, v = line.split(':', 1)
        k, v = k.strip().lower(), v.strip()
        if k == 'name':
            cur = {'name': v}
            blocks.append(cur)
        elif cur is not None:
            cur[k] = v
    return blocks


def to_spec(b):
    if b.get('type') == 'raw':
        freq = int(float(b['frequency']))
        pat = [int(x) for x in b['data'].split()]
        if not (15000 <= freq <= 60000) or not (2 <= len(pat) <= MAX_RAW) or any(x <= 0 or x > 500000 for x in pat):
            return None
        return {'protocol': 'raw', 'freq': freq, 'pattern': pat}
    if b.get('type') == 'parsed':
        p = PROTO.get(b.get('protocol'))
        if not p:
            return None
        a, c = le_int(b['address']), le_int(b['command'])
        if a > ADDR_MAX[p] or c > CMD_MAX[p]:
            return None
        return {'protocol': p, 'address': a, 'command': c}
    return None


def main():
    root, out = sys.argv[1], sys.argv[2]
    commit = sys.argv[3] if len(sys.argv) > 3 else ''
    stats = {}
    entries = []
    for brand in BRANDS:
        bdir = os.path.join(root, 'TVs', brand)
        if not os.path.isdir(bdir):
            continue
        groups = collections.OrderedDict()
        st = {'files': 0, 'files_used': 0, 'buttons_skipped': 0, 'skipped_protocols': collections.Counter()}
        for dp, _, fs in sorted(os.walk(bdir)):
            for f in sorted(fs):
                if not f.endswith('.ir'):
                    continue
                st['files'] += 1
                rel = os.path.relpath(os.path.join(dp, f), os.path.join(root, 'TVs'))
                text = open(os.path.join(dp, f), encoding='utf-8', errors='replace').read()
                codes = {}
                for b in parse_file(text):
                    spec = to_spec(b)
                    if spec is None:
                        st['buttons_skipped'] += 1
                        st['skipped_protocols'][b.get('protocol', b.get('type', '?'))] += 1
                        continue
                    raw_name = b['name']
                    key = KEYMAP.get(norm(raw_name))
                    entry = {'spec': spec}
                    if key is None:
                        key = norm(raw_name)
                        entry['label'] = LABELS.get(key, raw_name.replace('_', ' '))
                    if key not in codes:
                        codes[key] = entry
                if len(codes) < 4:
                    continue  # còn quá ít nút (phần lớn là giao thức chưa hỗ trợ)
                st['files_used'] += 1
                sig = json.dumps(codes, sort_keys=True)
                name = os.path.splitext(f)[0]
                name = re.sub(r'^' + re.escape(brand) + r'[_ -]?', '', name, flags=re.I) or 'Chung'
                g = groups.setdefault(sig, {'codes': codes, 'files': [], 'names': []})
                g['files'].append(rel.replace(os.sep, '/'))
                g['names'].append(name)
        for g in groups.values():
            names = g['names']
            shown = ', '.join(names[:3]) + (' (+%d bộ tương tự)' % (len(names) - 3) if len(names) > 3 else '')
            entries.append({
                'brand': brand, 'model': shown, 'models': names, 'type': 'tv',
                'source': {'name': 'Flipper-IRDB', 'license': 'CC0-1.0',
                           'url': 'https://github.com/logickworkshop/Flipper-IRDB/blob/main/TVs/' + g['files'][0],
                           'files': g['files']},
                'codes': g['codes'],
            })
        st['skipped_protocols'] = dict(st['skipped_protocols'])
        st['entries'] = sum(1 for e in entries if e['brand'] == brand)
        stats[brand] = st
    # Xếp bộ phổ biến lên đầu: nhiều remote cùng một mã Nguồn → nhiều khả năng khớp TV hơn; sau đó ưu tiên bộ nhiều nút.
    weight = collections.Counter()
    for e in entries:
        if 'power' in e['codes']:
            weight[(e['brand'], json.dumps(e['codes']['power']['spec'], sort_keys=True))] += len(e['models'])
    def pop(e):
        return weight.get((e['brand'], json.dumps(e['codes']['power']['spec'], sort_keys=True)), 0) if 'power' in e['codes'] else 0
    entries.sort(key=lambda e: (e['brand'], -pop(e), -len(e['codes']), e['model']))
    lib = {
        'version': 2,
        'source': {'name': 'Flipper-IRDB', 'url': 'https://github.com/logickworkshop/Flipper-IRDB',
                   'license': 'CC0-1.0', 'commit': commit},
        'brands': sorted({e['brand'] for e in entries}),
        'entries': entries,
    }
    header = ('/* VIGO — thư viện mã IR TV, tạo tự động bằng tools/build-library.py từ Flipper-IRDB (CC0-1.0).\n'
              ' * KHÔNG sửa tay. Mọi mã lấy nguyên từ tệp nguồn (xem entries[].source); app không tự tạo mã.\n'
              ' * Mã cộng đồng có thể sai model: luôn thử từng nút (IR Setup) hoặc dùng "Dò tự động".\n'
              ' * Thêm mã riêng: import trong IR Setup, hoặc thêm mục vào entries theo đúng cấu trúc này. */\n')
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(header + 'window.VIGO_LIBRARY = ' + json.dumps(lib, ensure_ascii=False, separators=(',', ':')) + ';\n')
    for b, s in stats.items():
        print('%-10s tệp %3d dùng %3d → %3d bộ mã | bỏ qua %4d nút %s' % (b, s['files'], s['files_used'], s['entries'], s['buttons_skipped'], s['skipped_protocols']))
    print('Tổng:', len(entries), 'bộ mã,', os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    main()
