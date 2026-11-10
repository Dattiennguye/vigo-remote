#!/usr/bin/env python3
"""Chuyển các tệp .ir của Flipper-IRDB (giấy phép CC0) thành thư viện TV của app.

Dùng:  python3 -I tools/build-library.py <thư mục Flipper-IRDB> <thư mục data/tv> [commit]

Kết quả: <data/tv>/index.js và <data/tv>/<hãng>.js (tải theo hãng khi cần).
- Chỉ lấy loại TV của các hãng trong BRANDS.
- Chỉ giữ giao thức app mã hóa được (NEC, NECext, Samsung32, SIRC*, Kaseikyo) và raw hợp lệ.
- Chuẩn hóa tên nút về các khóa chuẩn (power, vol_up, ok, back, exit...).
- Gộp các tệp có bộ mã giống hệt nhau; xếp bộ phổ biến + đủ phím chính lên đầu.
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
CORE = ['power', 'mute', 'vol_up', 'vol_down', 'up', 'down', 'left', 'right', 'ok', 'back', 'home', 'exit']

KEYMAP = {
    'power': 'power', 'vol_up': 'vol_up', 'vol_dn': 'vol_down', 'vol_down': 'vol_down', 'mute': 'mute',
    'ch_next': 'ch_up', 'ch_prev': 'ch_down', 'up': 'up', 'down': 'down', 'left': 'left', 'right': 'right',
    'ok': 'ok', 'back': 'back', 'home': 'home', 'menu': 'menu', 'exit': 'exit',
    'source': 'source', 'input': 'source', 'tv': 'src_tv', 'hdmi': 'src_hdmi', 'av': 'src_av',
    'info': 'info', 'information': 'info',
}
ALIASES = {
    'ok': ['enter_ok', 'nav_ok', 'menu_enter', 'enter_middle', 'center', 'select', 'enter', 'okay', 'ok_enter', 'middle', 'select_tcl'],
    'up': ['up_arrow', 'arrow_up', 'arw_up', 'nav_up', 'menu_up', 'up_tcl'],
    'down': ['down_arrow', 'arrow_down', 'arw_down', 'nav_dn', 'nav_down', 'menu_down', 'down_tcl'],
    'left': ['left_arrow', 'arrow_left', 'arw_left', 'nav_lft', 'nav_left', 'menu_left', 'left_tcl'],
    'right': ['right_arrow', 'arrow_right', 'arw_right', 'nav_rgt', 'nav_right', 'menu_right', 'right_tcl'],
    'back': ['return', 'return_back', 'back_return', 'nav_back', 'menu_back', 'back_tcl', 'prev', 'last'],
    'home': ['menu_home', 'home_tcl', 'smart_hub', 'smarthub', 'hub'],
    'exit': ['nav_exit', 'exit_cancel', 'exit_application', 'close', 'cancel'],
    'menu': ['nav_menu', 'menu_setup', 'setup'],
    'vol_up': ['vol_plus', 'volume_up', 'volume_plus', 'vol', 'volup', 'right_vol_plus', 'v_up'],
    'vol_down': ['vol_minus', 'vol_dwn', 'v_down', 'volume_down', 'volume_minus', 'voldown', 'left_vol_minus', 'vol_minusn', 'vol_dn'],
    'ch_up': ['chan_up', 'channel_up', 'ch_plus', 'chn_up', 'chann_up', 'chanel_up', 'p_up', 'pr_up', 'prog_plus', 'chup', 'up_ch_plus', 'program_up'],
    'ch_down': ['chan_down', 'channel_down', 'ch_minus', 'ch_dn', 'ch_dwn', 'chn_down', 'chann_down', 'chanel_down', 'p_down', 'pr_down', 'prog_minus', 'channnel_minus', 'chdown', 'down_ch_minus', 'program_down'],
    'power': ['on_off', 'tv_on_off', 'powa', 'lg_on_off', 'power_tcl', 'pwr', 'poweroff'],
}
for std, names in ALIASES.items():
    for n in names:
        KEYMAP.setdefault(n, std)
for i in range(10):
    KEYMAP[str(i)] = str(i)
    KEYMAP['num_%d' % i] = str(i)
    KEYMAP['n%d' % i] = str(i)
LABELS = {'exit': 'Thoát', 'info': 'Thông tin', 'guide': 'Hướng dẫn', 'settings': 'Cài đặt', 'play': 'Phát',
          'pause': 'Tạm dừng', 'stop': 'Dừng', 'rewind': 'Tua lại', 'forward': 'Tua tới',
          'fast_forward': 'Tua tới', 'red': 'Đỏ', 'green': 'Xanh lá', 'yellow': 'Vàng', 'blue': 'Xanh dương',
          'sleep': 'Hẹn giờ tắt', 'tools': 'Công cụ', 'list': 'Danh sách', 'ch_list': 'Danh sách kênh',
          'text': 'Teletext', 'search': 'Tìm kiếm', 'apps': 'Ứng dụng', 'subtitle': 'Phụ đề',
          'record': 'Ghi', 'rec': 'Ghi', 'netflix': 'Netflix', 'youtube': 'YouTube',
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
    if re.match(r'^0[a-z]', s):  # lỗi gõ trong vài tệp nguồn: "0Power", "0Back"
        s = s[1:]
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


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def main():
    root, outdir = sys.argv[1], sys.argv[2]
    commit = sys.argv[3] if len(sys.argv) > 3 else ''
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.js'):
            os.remove(os.path.join(outdir, f))
    entries, stats = [], {}
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
                cand = collections.OrderedDict()  # khóa chuẩn -> [(chính xác?, entry)]
                for b in parse_file(text):
                    spec = to_spec(b)
                    if spec is None:
                        st['buttons_skipped'] += 1
                        st['skipped_protocols'][b.get('protocol', b.get('type', '?'))] += 1
                        continue
                    n = norm(b['name'])
                    key = KEYMAP.get(n)
                    entry = {'spec': spec}
                    exact = (key == n)
                    if key is None:
                        key = n
                        entry['label'] = LABELS.get(key, b['name'].replace('_', ' '))
                        exact = True
                    cand.setdefault(key, []).append((exact, entry))
                codes = {}
                for key, lst in cand.items():
                    pick = next((e for ex, e in lst if ex), lst[0][1])  # tên đúng chuẩn ưu tiên hơn tên gần đúng
                    codes[key] = pick
                if len(codes) < 4:
                    continue
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
                'core': sum(1 for k in CORE if k in g['codes']),
                'source': {'name': 'Flipper-IRDB', 'license': 'CC0-1.0',
                           'url': 'https://github.com/logickworkshop/Flipper-IRDB/blob/main/TVs/' + g['files'][0],
                           'files': g['files']},
                'codes': g['codes'],
            })
        st['skipped_protocols'] = dict(st['skipped_protocols'])
        stats[brand] = st

    # Xếp bộ phổ biến (nhiều remote cùng mã Nguồn) lên đầu, rồi bộ đủ phím chính, rồi bộ nhiều nút.
    weight = collections.Counter()
    for e in entries:
        if 'power' in e['codes']:
            weight[(e['brand'], json.dumps(e['codes']['power']['spec'], sort_keys=True))] += len(e['models'])

    def pop(e):
        return weight.get((e['brand'], json.dumps(e['codes']['power']['spec'], sort_keys=True)), 0) if 'power' in e['codes'] else 0
    entries.sort(key=lambda e: (e['brand'], -pop(e), -e['core'], -len(e['codes']), e['model']))

    header = ('/* VIGO — thư viện mã IR TV, tạo tự động bằng tools/build-library.py từ Flipper-IRDB (CC0-1.0).\n'
              ' * KHÔNG sửa tay. Mọi mã lấy nguyên từ tệp nguồn (xem entries[].source); app không tự tạo mã. */\n')
    index = {'version': 3, 'source': {'name': 'Flipper-IRDB', 'url': 'https://github.com/logickworkshop/Flipper-IRDB',
                                       'license': 'CC0-1.0', 'commit': commit}, 'brands': []}
    total = 0
    for brand in BRANDS:
        lst = [e for e in entries if e['brand'] == brand]
        if not lst:
            continue
        fn = slug(brand) + '.js'
        with open(os.path.join(outdir, fn), 'w', encoding='utf-8') as fh:
            fh.write(header + 'VigoLib.registerTv(' + json.dumps(brand) + ',' + json.dumps(lst, ensure_ascii=False, separators=(',', ':')) + ');\n')
        index['brands'].append({'name': brand, 'n': len(lst), 'file': 'tv/' + fn,
                                'withPower': sum(1 for e in lst if 'power' in e['codes'])})
        total += len(lst)
    with open(os.path.join(outdir, 'index.js'), 'w', encoding='utf-8') as fh:
        fh.write(header + 'VigoLib.registerTvIndex(' + json.dumps(index, ensure_ascii=False, separators=(',', ':')) + ');\n')
    for b, s in stats.items():
        print('%-10s tệp %3d dùng %3d | bỏ qua %4d nút %s' % (b, s['files'], s['files_used'], s['buttons_skipped'], s['skipped_protocols']))
    size = sum(os.path.getsize(os.path.join(outdir, f)) for f in os.listdir(outdir)) // 1024
    full = sum(1 for e in entries if e['core'] == len(CORE))
    print('Tổng:', total, 'bộ mã,', size, 'KB;', full, 'bộ đủ %d phím chính' % len(CORE))


if __name__ == '__main__':
    main()
