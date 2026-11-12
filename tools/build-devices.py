#!/usr/bin/env python3
"""Chuyển các tệp .ir của Flipper-IRDB (giấy phép CC0) thành thư viện mã cho các loại thiết bị ngoài TV/điều hòa.

Dùng:  python3 -I tools/build-devices.py <thư mục Flipper-IRDB> <thư mục web/data> [commit]

Mỗi loại (đầu thu, TV box, đầu đĩa, loa/amply, quạt, sưởi/lọc khí, đèn, máy chiếu, khác) ra:
  <data>/<loại>/index.js        (nhẹ: danh sách hãng + phím chính + phím để thử)
  <data>/<loại>/<hãng>.js       (tải khi chọn hãng)
và <data>/keys.js (nhãn tiếng Việt cho mọi khóa phím chuẩn — dùng chung với giao diện).

Quy tắc trung thực: mọi mã lấy nguyên từ tệp nguồn, không tự tạo. Chỉ giữ giao thức app mã hóa được
(NEC, NECext, NEC42, Samsung32, SIRC*, Kaseikyo, RC5/RC5X, RC6, Pioneer) và raw hợp lệ; còn lại bỏ và báo trong thống kê.
"""
import collections, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('build_library', os.path.join(HERE, 'build-library.py'))
BL = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BL)

BL.PROTO.update({'RC5': 'rc5', 'RC5X': 'rc5x', 'RC6': 'rc6', 'NEC42': 'nec42', 'Pioneer': 'pioneer'})
BL.ADDR_MAX.update({'rc5': 0x1F, 'rc5x': 0x1F, 'rc6': 0xFF, 'nec42': 0x1FFF, 'pioneer': 0xFF})
BL.CMD_MAX.update({'rc5': 0x3F, 'rc5x': 0x3F, 'rc6': 0xFF, 'nec42': 0xFF, 'pioneer': 0xFF})
BL.MAX_RAW = 600

# loại -> (thư mục nguồn, nhãn "kiểu" hiện cạnh tên model)
TYPES = collections.OrderedDict([
    ('stb', {'dirs': [('Cable_Boxes', 'Cáp/vệ tinh'), ('DVB-T', 'DVB-T'), ('TV_Tuner', 'TV tuner')],
             'core': ['power', 'mute', 'vol_up', 'vol_down', 'ch_up', 'ch_down', 'up', 'down', 'left', 'right', 'ok', 'back', 'menu', 'info', 'exit', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
             'test': ['power', 'mute', 'vol_up', 'menu', 'ok']}),
    ('box', {'dirs': [('Streaming_Devices', 'Streaming'), ('Multimedia', 'Multimedia')],
             'core': ['power', 'up', 'down', 'left', 'right', 'ok', 'back', 'home', 'menu', 'play_pause', 'vol_up', 'vol_down', 'mute'],
             'test': ['home', 'ok', 'power', 'menu', 'back']}),
    ('disc', {'dirs': [('DVD_Players', 'DVD'), ('Blu-Ray', 'Blu-ray'), ('CD_Players', 'CD'), ('VCR', 'VCR'), ('Laserdisc', 'Laserdisc'), ('MiniDisc', 'MiniDisc')],
              'core': ['power', 'eject', 'play', 'pause', 'stop', 'prev', 'next', 'rewind', 'fast_forward', 'up', 'down', 'left', 'right', 'ok', 'menu', 'back'],
              'test': ['eject', 'power', 'play', 'menu', 'stop']}),
    ('audio', {'dirs': [('SoundBars', 'Soundbar'), ('Speakers', 'Loa'), ('Audio_and_Video_Receivers', 'Amply')],
               'core': ['power', 'vol_up', 'vol_down', 'mute', 'source', 'bluetooth', 'play_pause', 'next', 'prev', 'bass_up', 'bass_down'],
               'test': ['vol_up', 'mute', 'power', 'vol_down']}),
    ('fan', {'dirs': [('Fans', 'Quạt')],
             'core': ['power', 'speed', 'speed_up', 'speed_down', 'swing', 'timer', 'mode', 'night', 'auto'],
             'test': ['power', 'speed', 'speed_up', 'on', 'off']}),
    ('air', {'dirs': [('Heaters', 'Máy sưởi'), ('Air_Purifiers', 'Lọc khí'), ('Humidifiers', 'Tạo ẩm'), ('Fireplaces', 'Lò sưởi'), ('Dust_Collectors', 'Hút bụi')],
             'core': ['power', 'timer', 'mode', 'temp_up', 'temp_down', 'speed', 'speed_up', 'speed_down', 'swing', 'auto', 'night'],
             'test': ['power', 'on', 'off', 'mode']}),
    ('light', {'dirs': [('LED_Lighting', 'Đèn LED')],
               'core': ['on', 'off', 'power', 'bright_up', 'bright_down', 'red', 'green', 'blue', 'white', 'flash', 'fade', 'smooth', 'strobe', 'auto'],
               'test': ['on', 'power', 'white', 'off', 'bright_up']}),
    ('proj', {'dirs': [('Projectors', 'Máy chiếu')],
              'core': ['power', 'on', 'off', 'source', 'menu', 'up', 'down', 'left', 'right', 'ok', 'back', 'vol_up', 'vol_down', 'mute', 'freeze', 'keystone_up', 'keystone_down', 'zoom_in', 'zoom_out'],
              'test': ['power', 'on', 'menu', 'source', 'ok']}),
    ('other', {'dirs': [('Miscellaneous', 'Khác'), ('Consoles', 'Máy chơi game'), ('Monitors', 'Màn hình'), ('Picture_Frames', 'Khung ảnh'), ('Digital_Signs', 'Bảng quảng cáo'),
                        ('Vacuum_Cleaners', 'Robot hút bụi'), ('Converters', 'Bộ chuyển đổi'), ('Cameras', 'Máy ảnh'), ('Bidet', 'Bồn cầu thông minh'), ('Clocks', 'Đồng hồ'),
                        ('Head_Units', 'Đầu ô tô'), ('Car_Multimedia', 'Đa phương tiện ô tô'), ('Whiteboards', 'Bảng tương tác'), ('Videoconferencing', 'Họp trực tuyến'),
                        ('Touchscreen_Displays', 'Màn hình cảm ứng'), ('Window_cleaners', 'Lau kính'), ('CCTV', 'Camera giám sát')],
               'core': ['power', 'on', 'off', 'up', 'down', 'left', 'right', 'ok', 'menu', 'back', 'vol_up', 'vol_down', 'mute'],
               'test': ['power', 'on', 'ok', 'menu']}),
])

# khóa chuẩn -> nhãn tiếng Việt (dùng chung: sinh ra data/keys.js)
LABELS = {
    'power': 'Nguồn', 'on': 'Bật', 'off': 'Tắt', 'mute': 'Tắt tiếng', 'vol_up': 'Âm lượng +', 'vol_down': 'Âm lượng −',
    'ch_up': 'Kênh +', 'ch_down': 'Kênh −', 'up': 'Lên', 'down': 'Xuống', 'left': 'Trái', 'right': 'Phải', 'ok': 'OK',
    'back': 'Quay lại', 'home': 'Trang chủ', 'exit': 'Thoát', 'menu': 'Menu', 'source': 'Nguồn tín hiệu', 'info': 'Thông tin',
    'src_tv': 'TV', 'src_hdmi': 'HDMI', 'src_av': 'AV', 'guide': 'Hướng dẫn', 'epg': 'Lịch phát sóng', 'settings': 'Cài đặt',
    'play': 'Phát', 'pause': 'Tạm dừng', 'stop': 'Dừng', 'play_pause': 'Phát/Dừng', 'next': 'Bài/Chương sau', 'prev': 'Bài/Chương trước',
    'rewind': 'Tua lại', 'fast_forward': 'Tua tới', 'record': 'Ghi', 'eject': 'Mở/Đóng khay', 'top_menu': 'Menu chính của đĩa',
    'popup_menu': 'Menu nổi', 'setup': 'Thiết lập', 'display': 'Hiển thị', 'subtitle': 'Phụ đề', 'audio': 'Âm thanh/Ngôn ngữ', 'angle': 'Góc quay',
    'zoom': 'Thu phóng', 'zoom_in': 'Phóng to', 'zoom_out': 'Thu nhỏ', 'repeat': 'Lặp lại', 'shuffle': 'Ngẫu nhiên', 'program': 'Chương trình',
    'title': 'Tiêu đề', 'clear': 'Xóa', 'search': 'Tìm kiếm', 'slow': 'Chậm', 'step': 'Từng khung', 'a_b': 'Lặp A-B', 'resume': 'Tiếp tục',
    'red': 'Đỏ', 'green': 'Xanh lá', 'yellow': 'Vàng', 'blue': 'Xanh dương', 'white': 'Trắng', 'orange': 'Cam', 'pink': 'Hồng', 'purple': 'Tím',
    'cyan': 'Lục lam', 'warm': 'Ấm', 'cool': 'Lạnh', 'fav': 'Yêu thích', 'list': 'Danh sách', 'last': 'Kênh trước', 'sleep': 'Hẹn giờ ngủ',
    'timer': 'Hẹn giờ', 'mode': 'Chế độ', 'auto': 'Tự động', 'night': 'Chế độ đêm', 'speed': 'Tốc độ', 'speed_up': 'Tốc độ +', 'speed_down': 'Tốc độ −',
    'swing': 'Đảo chiều', 'breeze': 'Gió tự nhiên', 'light': 'Đèn', 'ion': 'Ion', 'temp': 'Nhiệt độ', 'temp_up': 'Nhiệt độ +', 'temp_down': 'Nhiệt độ −',
    'bright_up': 'Sáng hơn', 'bright_down': 'Tối hơn', 'flash': 'Nhấp nháy', 'strobe': 'Chớp', 'fade': 'Chuyển mờ', 'smooth': 'Chuyển mượt',
    'bluetooth': 'Bluetooth', 'aux': 'AUX', 'usb': 'USB', 'optical': 'Quang (Optical)', 'coax': 'Đồng trục', 'arc': 'HDMI ARC', 'tuner': 'Radio/Tuner', 'cd': 'CD',
    'bass_up': 'Bass +', 'bass_down': 'Bass −', 'bass': 'Bass', 'treble_up': 'Treble +', 'treble_down': 'Treble −', 'eq': 'EQ', 'surround': 'Âm thanh vòm',
    'movie': 'Phim', 'music': 'Nhạc', 'game': 'Game', 'news': 'Tin tức', 'sound_mode': 'Chế độ âm thanh', 'dimmer': 'Độ sáng màn hình',
    'freeze': 'Đóng băng hình', 'blank': 'Tắt hình tạm', 'keystone_up': 'Chỉnh hình thang +', 'keystone_down': 'Chỉnh hình thang −', 'keystone': 'Chỉnh hình thang',
    'aspect': 'Tỷ lệ khung hình', 'focus': 'Lấy nét', 'src_video': 'Video', 'src_pc': 'Máy tính', 'src_hdmi1': 'HDMI 1', 'src_hdmi2': 'HDMI 2', 'format': 'Định dạng',
    'netflix': 'Netflix', 'youtube': 'YouTube', 'prime_video': 'Prime Video', 'disney': 'Disney+', 'hulu': 'Hulu', 'star': 'Tùy chọn (*)', 'options': 'Tùy chọn',
    'instant_replay': 'Xem lại 10 giây', 'reboot': 'Khởi động lại', 'apps': 'Ứng dụng', 'tools': 'Công cụ', 'text': 'Teletext', 'help': 'Trợ giúp', 'picture': 'Hình ảnh',
    'vol': 'Âm lượng', 'ch': 'Kênh', 'volume': 'Âm lượng', 'pip': 'PIP', 'freeze_hold': 'Giữ hình', 'a': 'A', 'b': 'B', 'x': 'X', 'y': 'Y', 'select': 'Chọn', 'start': 'Bắt đầu',
}
for _d in range(10):
    LABELS[str(_d)] = str(_d)
for _h in (1, 2, 4, 8, 12):
    LABELS['timer_%dh' % _h] = 'Hẹn %d giờ' % _h

KEYMAP = {}


def alias(canon, names):
    KEYMAP.setdefault(canon, canon)
    for n in names:
        KEYMAP.setdefault(n, canon)


alias('power', ['pwr', 'on_off', 'power_on_off', 'power_toggle', 'standby', 'stand_by', 'power_tcl', 'powa', 'lg_on_off', 'poweroff_on', 'power_switch', 'switch', 'tv_on_off', 'power_button', 'onoff', 'standby_on'])
alias('on', ['power_on', 'turn_on', 'switch_on', 'poweron', 'on_button', 'lights_on', 'light_on', 'all_on', 'on_1', 'on1'])
alias('off', ['power_off', 'turn_off', 'switch_off', 'poweroff', 'off_button', 'lights_off', 'light_off', 'all_off', 'off_1', 'off1'])
alias('mute', ['volumemute', 'muting', 'mute_toggle', 'sound_off'])
alias('vol_up', ['vol_plus', 'volume_up', 'volume_plus', 'volup', 'right_vol_plus', 'v_up', 'vol_inc', 'volume_inc', 'volume_increase', 'vol_increase', 'vol_', 'volume_', 'louder', 'plus_vol', 'vol_up_plus', 'volumeup'])
alias('vol_down', ['vol_dn', 'vol_minus', 'vol_dwn', 'v_down', 'volume_down', 'volume_minus', 'voldown', 'left_vol_minus', 'vol_dec', 'volume_dec', 'volume_decrease', 'vol_decrease', 'quieter', 'volume_dn', 'volumedown', 'minus_vol'])
alias('ch_up', ['chan_next', 'ch_next', 'chan_up', 'channel_up', 'ch_plus', 'chn_up', 'chann_up', 'chanel_up', 'p_up', 'pr_up', 'prog_plus', 'chup', 'up_ch_plus', 'program_up', 'channel_plus', 'chan_plus', 'channel_next', 'next_channel', 'p_plus', 'pg_up', 'page_up', 'prog_up'])
alias('ch_down', ['chan_prev', 'ch_prev', 'chan_down', 'channel_down', 'ch_minus', 'ch_dn', 'ch_dwn', 'chn_down', 'chann_down', 'chanel_down', 'p_down', 'pr_down', 'prog_minus', 'chdown', 'down_ch_minus', 'program_down', 'channel_minus', 'chan_minus', 'channel_prev', 'prev_channel', 'previous_channel', 'p_minus', 'pg_down', 'page_down', 'prog_down'])
alias('up', ['up_arrow', 'arrow_up', 'arw_up', 'nav_up', 'menu_up', 'up_tcl', 'cursor_up', 'dpad_up', 'navigate_up', 'north'])
alias('down', ['down_arrow', 'arrow_down', 'arw_down', 'nav_dn', 'nav_down', 'menu_down', 'down_tcl', 'cursor_down', 'dpad_down', 'navigate_down', 'south'])
alias('left', ['left_arrow', 'arrow_left', 'arw_left', 'nav_lft', 'nav_left', 'menu_left', 'left_tcl', 'cursor_left', 'dpad_left', 'navigate_left', 'west'])
alias('right', ['right_arrow', 'arrow_right', 'arw_right', 'nav_rgt', 'nav_right', 'menu_right', 'right_tcl', 'cursor_right', 'dpad_right', 'navigate_right', 'east'])
alias('ok', ['enter_ok', 'nav_ok', 'menu_enter', 'enter_middle', 'center', 'select_ok', 'enter', 'okay', 'ok_enter', 'middle', 'select_tcl', 'confirm', 'enter_select', 'ok_select', 'centre', 'sel', 'play_ok'])
alias('back', ['return', 'return_back', 'back_return', 'nav_back', 'menu_back', 'back_tcl', 'esc', 'escape', 'previous_menu', 'goback', 'go_back'])
alias('home', ['menu_home', 'home_tcl', 'smart_hub', 'smarthub', 'hub', 'home_menu', 'main_menu', 'main'])
alias('exit', ['nav_exit', 'exit_cancel', 'exit_application', 'close_menu', 'cancel', 'quit'])
alias('menu', ['nav_menu', 'menu_setup', 'osd', 'menu_button', 'system_menu'])
alias('settings', ['setting', 'config', 'configuration', 'options_setup'])
alias('setup', ['set_up', 'system_setup'])
alias('source', ['sources', 'input', 'input_select', 'inputs', 'select_input', 'src', 'sel_input', 'input_source', 'source_select', 'input_sel', 'source_input', 'mode_source', 'signal'])
alias('src_tv', ['tv', 'tv_input', 'input_tv'])
alias('src_hdmi', ['hdmi'])
alias('src_av', ['av', 'av_input'])
alias('src_video', ['video', 'video_input', 'composite'])
alias('src_pc', ['pc', 'computer', 'rgb', 'vga', 'computer_1', 'pc_input'])
alias('src_hdmi1', ['hdmi1', 'hdmi_1'])
alias('src_hdmi2', ['hdmi2', 'hdmi_2'])
alias('info', ['information', 'info_button', 'status', 'show_info'])
alias('display', ['disp', 'display_button', 'on_screen_display'])
alias('guide', ['tv_guide', 'program_guide', 'guide_button'])
alias('epg', ['e_p_g'])
alias('play', ['play_button', 'playback'])
alias('pause', ['pause_button', 'still', 'pause_still'])
alias('stop', ['stop_button', 'stop_eject'])
alias('play_pause', ['pause_play', 'start_stop', 'start_pause', 'play_pa', 'playpause', 'play_pause_button', 'play_stop', 'pp', 'play_pause_toggle', 'playpause_button'])
alias('next', ['next_track', 'skip_next', 'skip_forward', 'chapter_next', 'track_next', 'next_chapter', 'skip_fwd', 'forward_skip', 'next_song', 'right_skip', 'skip_right', 'next_title', 'nexttrack'])
alias('prev', ['foward_', 'previous', 'prev_track', 'skip_prev', 'skip_previous', 'skip_back', 'chapter_prev', 'track_prev', 'prev_chapter', 'previous_track', 'skip_rev', 'rev_skip', 'prev_song', 'previous_song', 'left_skip', 'skip_left', 'prev_title', 'prevtrack', 'back_skip'])
alias('rewind', ['rew', 'fast_backward', 'fast_ba', 'fast_back', 'backward', 'scan_backward', 'rwd', 'rev', 'reverse', 'fast_rewind', 'fr', 'rewind_button', 'scan_back', 'search_back', 'search_reverse', 'seek_back', 'fb', 'frev'])
alias('fast_forward', ['foward', 'ff', 'fastforward', 'forward', 'fast_fo', 'fwd', 'scan_forward', 'fast_fwd', 'fast_forwar', 'ffwd', 'fforward', 'forward_button', 'scan_fwd', 'search_forward', 'seek_forward', 'ffw', 'scan_fo'])
alias('record', ['rec', 'record_button', 'recording'])
alias('eject', ['open_close', 'open', 'close', 'tray', 'open_close_tray', 'eject_button', 'disc_eject', 'openclose', 'open_eject'])
alias('top_menu', ['topmenu', 'disc_menu', 'dvd_menu', 'title_menu', 'top'])
alias('popup_menu', ['pop_up_menu', 'popup', 'pop_up'])
alias('subtitle', ['subtitles', 'sub', 'sub_title', 'sub_t', 'subtitle_button', 'caption', 'cc'])
alias('audio', ['language', 'lang', 'audio_language', 'audio_button', 'audio_lang', 'mts', 'sap'])
alias('angle', ['camera_angle', 'angle_button'])
alias('zoom', ['zoom_button'])
alias('zoom_in', ['zoom_plus', 'zoom_up', 'zoomin', 'magnify', 'zoom_p'])
alias('zoom_out', ['zoom_minus', 'zoom_down', 'zoomout', 'zoom_m'])
alias('repeat', ['repeat_button', 'rpt', 'repeat_all', 'repeat_one', 'loop'])
alias('shuffle', ['random', 'rand', 'shuf'])
alias('program', ['prog', 'memory', 'mem'])
alias('title', ['titles', 'title_button'])
alias('clear', ['clr', 'cancel_clear', 'delete', 'del'])
alias('search', ['find', 'search_button'])
alias('slow', ['slow_motion', 'slow_fwd', 'slow_forward'])
alias('step', ['frame_advance', 'step_fwd', 'frame_step'])
alias('a_b', ['ab', 'a_b_repeat', 'repeat_a_b', 'a_b_button'])
alias('resume', ['continue'])
alias('fav', ['favorite', 'favorites', 'favourite', 'fav_button', 'fav_ch', 'favs'])
alias('list', ['ch_list', 'channel_list', 'channel_guide', 'list_button', 'ch_list_button', 'programme_list', 'tv_list', 'radio_list'])
alias('last', ['recall', 'prev_ch', 'last_channel', 'ch_last', 'flashback', 'jump', 'ch_return', 'back_ch'])
alias('sleep', ['sleep_timer', 'sleeptimer', 'sleep_button'])
alias('timer', ['timer_button', 'time', 'set_timer', 'timer_set', 'clock_timer'])
alias('mode', ['mode_button', 'mode_select', 'select_mode', 'modes', 'mode_sel', 'mode_cycle'])
alias('auto', ['auto_mode', 'automatic', 'auto_button', 'auto_on', 'fan_auto', 'auto_run'])
alias('night', ['night_mode', 'sleep_mode', 'nightmode', 'night_light', 'quiet', 'silent', 'sleep_fan'])
alias('speed', ['fan', 'fan_speed', 'fanspeed', 'speed_button', 'wind', 'wind_speed', 'airflow', 'fan_mode', 'fan_button', 'speed_select', 'speed_cycle', 'fan_power', 'fanpower'])
alias('speed_up', ['fan_up', 'faster', 'speed_plus', 'fan_plus', 'speed_inc', 'speed_increase', 'fan_increase', 'fan_speed_up', 'increase', 'wind_up', 'higher', 'fan_speed_plus', 'fan_faster', 'spd_up', 'speedup', 'fanup'])
alias('speed_down', ['fan_dn', 'fan_down', 'slower', 'speed_minus', 'fan_minus', 'speed_dec', 'speed_decrease', 'fan_decrease', 'fan_speed_down', 'decrease', 'wind_down', 'lower', 'fan_speed_minus', 'fan_slower', 'spd_down', 'speeddown', 'fandown'])
alias('swing', ['oscilate', 'spin', 'turn', 'osc_horiz', 'oscx', 'osc_vert', 'oscy', 'horizontal', 'vertical', 'osc', 'oscillation', 'oscillate', 'oscillating', 'rotate', 'rotation', 'swivel', 'osc_button', 'oscillate_button', 'swing_button', 'sweep', 'rotary', 'direction', 'pan', 'swing_toggle', 'oscillation_toggle', 'tilt'])
alias('breeze', ['natural', 'natural_wind', 'nature', 'natural_breeze', 'breeze_mode', 'natural_mode'])
alias('light', ['light_button', 'lamp', 'led', 'led_light', 'display_light', 'mood_light', 'lighting', 'light_toggle', 'light_mode', 'backlight'])
alias('ion', ['ionizer', 'ion_generator', 'negative_ion', 'ionic', 'ion_button'])
alias('temp', ['temperature', 'temp_button', 'set_temp'])
alias('temp_up', ['heat_up', 'temp_plus', 'temperature_up', 'temp_inc', 'warmer', 'temperature_plus', 'temp_increase', 'heat_plus', 'tempup', 'heater_up'])
alias('temp_down', ['heat_down', 'temp_minus', 'temp_dn', 'temperature_down', 'temp_dec', 'cooler', 'temperature_minus', 'temp_decrease', 'heat_minus', 'tempdown', 'heater_down'])
alias('bright_up', ['brighter', 'brightness_up', 'bright_plus', 'brightness_plus', 'brightness_inc', 'bright', 'light_up', 'bright_inc', 'brighten', 'brightness', 'b_up', 'bright_increase', 'dim_up', 'intensity_up', 'lighter'])
alias('bright_down', ['brightness_dn', 'dim_plus_', 'dim', 'dimmer', 'brightness_down', 'bright_minus', 'brightness_minus', 'brightness_dec', 'darker', 'light_down', 'bright_dec', 'dim_down', 'b_down', 'bright_decrease', 'intensity_down', 'dim_minus', 'dimming'])
alias('flash', ['flash_mode', 'flashing', 'flash_button'])
alias('strobe', ['strobe_mode', 'strobing'])
alias('fade', ['fade_mode', 'fading', 'fade_button', 'fade_7', 'fade_3'])
alias('smooth', ['smooth_mode', 'smooth_button', 'jump3', 'jump7'])
alias('white', ['white_light', 'w', 'white_button', 'daylight', 'day_light', 'cool_white'])
alias('warm', ['warm_white', 'warm_light', 'warmwhite'])
alias('red', ['r', 'red_button'])
alias('green', ['g', 'green_button'])
alias('blue', ['b', 'blue_button'])
alias('yellow', ['y_color', 'yellow_button'])
alias('orange', ['orange_button'])
alias('pink', ['pink_button', 'magenta'])
alias('purple', ['violet', 'purple_button', 'indigo'])
alias('cyan', ['aqua', 'turquoise', 'light_blue', 'sky_blue', 'cyan_button', 'teal'])
alias('bluetooth', ['bt', 'blue_tooth', 'bluetooth_button', 'bt_pair', 'pair', 'bluetooth_pair', 'bluetooth_mode'])
alias('aux', ['inputaux', 'aux_in', 'aux1', 'aux_1', 'line_in', 'line', 'aux_input', 'aux_button', 'auxiliary', 'analog'])
alias('usb', ['usb_button', 'usb_input', 'usb_mode', 'usb_sd', 'sd'])
alias('optical', ['opt', 'optical_in', 'toslink', 'opt_in', 'optical_input', 'digital', 'digital_in', 'optic', 'spdif', 'optical1', 'optical_1'])
alias('coax', ['coaxial', 'coax_in', 'coax_input'])
alias('arc', ['hdmi_arc', 'earc'])
alias('tuner', ['radio', 'fm', 'am', 'fm_am', 'fm_radio', 'tuner_button', 'band'])
alias('cd', ['cd_button', 'cd_player'])
alias('bass_up', ['bass_plus', 'bass_increase', 'bassup', 'bass_inc', 'subwoofer_up', 'sub_up', 'sub_plus', 'woofer_up', 'bass_boost_up', 'bass_level_up'])
alias('bass_down', ['bass_dn', 'bass_minus', 'bass_decrease', 'bassdown', 'bass_dec', 'subwoofer_down', 'sub_down', 'sub_minus', 'woofer_down', 'bass_level_down'])
alias('bass', ['bass_boost', 'bass_button', 'bassboost', 'bass_mode', 'subwoofer'])
alias('treble_up', ['treble_plus', 'treble_increase', 'trebleup', 'treble_inc'])
alias('treble_down', ['treble_dn', 'treble_minus', 'treble_decrease', 'trebledown', 'treble_dec'])
alias('eq', ['equalizer', 'eq_button', 'equaliser', 'eq_mode', 'sound_eq', 'preset', 'preset_eq'])
alias('surround', ['surround_sound', '3d_sound', 'virtual_surround', 'surr', 'surround_mode', 'dolby', 'dsp', 'stereo', 'dsp_mode'])
alias('movie', ['movie_mode', 'cinema', 'film', 'theater', 'theatre'])
alias('music', ['music_mode', 'music_button', 'song'])
alias('game', ['game_mode', 'gaming', 'games'])
alias('news', ['news_mode', 'voice', 'dialog', 'clear_voice', 'dialogue', 'speech'])
alias('sound_mode', ['sound', 'sound_effect', 'sound_select', 'soundmode', 'sound_button', 'effect', 'effects', 'sound_field'])
alias('dimmer', ['display_dimmer', 'dim_display', 'display_dim'])
alias('freeze', ['freeze_button', 'hold', 'still_image', 'freeze_hold'])
alias('blank', ['av_mute', 'blank_screen', 'picture_mute', 'shutter', 'blank_button', 'av_muting', 'screen_blank', 'img_mute', 'image_mute', 'blackout', 'black'])
alias('keystone_up', ['keystone_plus', 'keystone_p', 'ks_up', 'keystone_v_up', 'v_keystone_up'])
alias('keystone_down', ['keystone_minus', 'keystone_m', 'ks_down', 'keystone_v_down', 'v_keystone_down'])
alias('keystone', ['keystone_button', 'ks', 'trapezoid', 'keystone_correction'])
alias('aspect', ['aspect_ratio', 'ratio', 'aspect_button', 'screen_size', 'wide', 'format_aspect', 'screen_mode'])
alias('focus', ['focus_button', 'focus_plus', 'focus_up', 'focus_in'])
alias('format', ['picture_format', 'format_button'])
alias('apps', ['app', 'applications', 'smart', 'my_apps', 'apps_button'])
alias('tools', ['tool', 'tools_button', 'quick_menu', 'quick'])
alias('text', ['teletext', 'txt', 'ttx', 'text_button'])
alias('help', ['help_button', 'support'])
alias('picture', ['picture_mode', 'pic_mode', 'p_mode', 'picture_button', 'image', 'pic', 'picture_settings', 'p_mode_picture', 'color_mode', 'image_mode', 'pict'])
alias('options', ['option', 'options_button', 'opt_button', 'extras', 'more'])
alias('netflix', ['netflix_button', 'netflix_key'])
alias('youtube', ['youtube_button', 'you_tube', 'youtube_key'])
alias('prime_video', ['prime', 'amazon', 'primevideo', 'amazon_prime', 'prime_video_button', 'amazon_video'])
alias('disney', ['disney_plus', 'disney_button'])
alias('hulu', ['hulu_button'])
alias('star', ['star_button', 'asterisk'])
alias('instant_replay', ['replay', 'instant_replay_button'])
alias('reboot', ['restart', 'reset_device', 'reboot_button'])
alias('pip', ['picture_in_picture', 'pip_button', 'pap'])
alias('select', ['select_button', 'sel_button'])
alias('start', ['start_button'])
for _i in range(10):
    KEYMAP.setdefault(str(_i), str(_i))
    for _p in ('num_%d', 'n%d', 'num%d', 'number_%d', 'digit_%d', 'key_%d', 'button_%d', 'key%d', 'ch_%d', 'btn_%d', 'btn%d', 'remote_%d', 'number%d', '%d_key', '%d_button', 'ir_%d', 'channel_%d', 'num_pad_%d', 'numpad_%d', 'numpad%d', 'digit%d', 'no_%d', 'no%d', '_%d', '0%d'):
        KEYMAP.setdefault(_p % _i, str(_i))
for _h in (1, 2, 4, 8, 12):
    alias('timer_%dh' % _h, ['%dh' % _h, '%d_hour' % _h, '%d_hours' % _h, 'timer_%d_hour' % _h, 'timer_%d_hours' % _h, 'timer_%dhr' % _h, '%dhr' % _h, '%d_hr' % _h, '%dhrs' % _h, 'timer%dh' % _h, '%d_h' % _h])

# nhãn cho khóa không chuẩn thường gặp (tên gốc -> nhãn)
NAME_LABELS = {'vol': 'Âm lượng', 'ch': 'Kênh', 'volume': 'Âm lượng', 'channel': 'Kênh', 'turbo': 'Turbo', 'hi': 'Mạnh', 'lo': 'Nhẹ', 'low': 'Thấp', 'high': 'Cao', 'medium': 'Vừa',
               'hum': 'Tạo ẩm', 'mist': 'Phun sương', 'humidity': 'Độ ẩm', 'heat': 'Sưởi', 'cool': 'Làm mát', 'dry': 'Hút ẩm', 'eco': 'Tiết kiệm', 'boost': 'Tăng cường',
               'purify': 'Lọc khí', 'diffuse': 'Khuếch tán', 'fan_only': 'Chỉ quạt', 'reset': 'Đặt lại', 'save': 'Lưu', 'color': 'Màu', 'colour': 'Màu', 'scene': 'Cảnh', 'music_mode': 'Theo nhạc',
               'sun': 'Mặt trời', 'moon': 'Mặt trăng', 'speed_1': 'Tốc độ 1', 'speed_2': 'Tốc độ 2', 'speed_3': 'Tốc độ 3', 'level_1': 'Mức 1', 'level_2': 'Mức 2', 'level_3': 'Mức 3'}
NAME_LABELS.update({
    'tv_radio': 'TV/Radio', 'tv_r': 'TV/Radio', 'pvr': 'PVR', 'ppv': 'PPV', 'vod': 'VOD', 'swap': 'Đổi PIP', 'day_up': 'Ngày +', 'day_down': 'Ngày −', 'pip_on_off': 'PIP bật/tắt', 'pip_swap': 'PIP đổi',
    'pip_move': 'PIP dời', 'pip_ch_up': 'PIP kênh +', 'pip_ch_down': 'PIP kênh −', 'page_dn': 'Trang sau', 'pound': '#', 'active': 'Active', 'a_v': 'A/V', 'skip': 'Bỏ qua', 'nav': 'Điều hướng', 'www': 'WWW',
    'goto': 'Đi tới', 'live_tv': 'TV trực tiếp', 'tv_power': 'Nguồn TV', 'tv_vol_up': 'Âm lượng TV +', 'tv_vcr': 'TV/VCR', 'vcr_tv': 'VCR/TV', 'xfinity': 'Xfinity', 'hbo_max': 'HBO Max',
    'roku_channel': 'Roku Channel', 'paramount_plus': 'Paramount+', 'espn': 'ESPN', 'sling': 'Sling', 'spotify': 'Spotify', 'pandora': 'Pandora', 'appletv': 'Apple TV', 'livetv': 'TV trực tiếp',
    'store': 'Cửa hàng', 'unpair': 'Hủy ghép đôi', 'groups': 'Nhóm', '2dots': '2 chấm', '3dots': '3 chấm', '4dots': '4 chấm', 'chan_next': 'Kênh +', 'chan_prev': 'Kênh −',
    '10_plus': '10+', 'plus10': '10+', '10': '10', 'a_minusb': 'Lặp A-B', 'scroll': 'Cuộn', 'play_mode': 'Chế độ phát', 'clock': 'Đồng hồ', 'pbc': 'PBC', 'marker': 'Đánh dấu', 'dvd': 'DVD',
    'advance': 'Tiến', 'function': 'Chức năng', 'popupmenu': 'Menu nổi', 'counter_reset': 'Đặt lại bộ đếm', 'resolution': 'Độ phân giải', 'search_mode': 'Chế độ tìm', 'minus': '−', 'plus': '+',
    'scan': 'Quét', 'tape': 'Băng', 'yes': 'Có', 'phono': 'Phono', 'standard': 'Tiêu chuẩn', 'bd_dvd': 'BD/DVD', 'tuner_band': 'Băng tần', 'cbl_sat': 'Cáp/Vệ tinh', 'auto_power': 'Tự động tắt',
    'ipod': 'iPod', 'line1': 'Line 1', 'line2': 'Line 2', 'balance_left': 'Cân bằng trái', 'balance_right': 'Cân bằng phải', 'center_plus': 'Loa giữa +', 'center_minus': 'Loa giữa −',
    'tuning_plus': 'Dò đài +', 'tuning_minus': 'Dò đài −', 'on_speed': 'Bật + tốc độ', 'off_timer': 'Hẹn giờ tắt', 'on_timer': 'Hẹn giờ bật', 'timer_plus': 'Hẹn giờ +', 'timer_minus': 'Hẹn giờ −',
    'timerup': 'Hẹn giờ +', 'time_up': 'Hẹn giờ +', 'time_down': 'Hẹn giờ −', 'narrow': 'Hẹp', 'strength': 'Cường độ', 'cold': 'Mát', 'speed_low': 'Tốc độ thấp', 'wind_type': 'Kiểu gió',
    'decrescendo': 'Giảm dần', 'timer_1': 'Hẹn 1', 'timer_2': 'Hẹn 2', 'flame': 'Lửa', 'lock': 'Khóa', '1000w': '1000W', '1500w': '1500W', '500w': '500W', 'heat_level': 'Mức sưởi', 'c_f': '°C/°F',
    'far_cel': '°F/°C', 'fire_on': 'Bật lửa', 'fire': 'Lửa', 'fire_up': 'Lửa +', 'fire_down': 'Lửa −', 'eco_mode': 'Tiết kiệm', 'child_lock': 'Khóa trẻ em', 'smart_heating': 'Sưởi thông minh',
    'body_sensor': 'Cảm biến người', 'mode_key': 'Chế độ', 'mode_off': 'Tắt chế độ', 'lo_high': 'Thấp/Cao', 'lo_hi': 'Thấp/Cao', 'hi_lo': 'Cao/Thấp', 'motionsense': 'Cảm biến chuyển động',
    'units_toggle': 'Đổi đơn vị', 'light_green': 'Xanh lá nhạt', 'light_red': 'Đỏ nhạt', 'light_orange': 'Cam nhạt', 'timer_off': 'Hẹn tắt', 'candle': 'Nến', 'ocean': 'Đại dương', 'max': 'Tối đa',
    '6h': 'Hẹn 6 giờ', '3h': 'Hẹn 3 giờ', '3d': '3D', 'contrast': 'Độ tương phản', 'user': 'Người dùng', 'user1': 'Người dùng 1', 'user2': 'Người dùng 2', 'pointer': 'Con trỏ', 'hide': 'Ẩn',
    'resync': 'Đồng bộ lại', 'eco_blank': 'Eco/Tắt hình', 'pattern': 'Mẫu thử', 'position': 'Vị trí', 'lens_shift': 'Dịch ống kính', 'apa': 'Tự chỉnh', 'sharp': 'Độ nét', 'color_temp': 'Nhiệt độ màu',
    'default': 'Mặc định', 'page_plus': 'Trang +', 'page_minus': 'Trang −', 'eco': 'Tiết kiệm', 'split': 'Chia màn hình', 'network': 'Mạng', 'lan': 'LAN', 'plus_d_zoom': 'Zoom số +', 'minus_d_zoom': 'Zoom số −',
    'mouse': 'Chuột', 'comp': 'Component', 'menu_exit': 'Menu/Thoát', 'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4', 'spot_clean': 'Dọn điểm', 'edge_clean': 'Dọn cạnh', 'spot': 'Điểm', 'clean': 'Dọn dẹp',
    'size': 'Kích cỡ', 'edit': 'Sửa', 'focus_far': 'Lấy nét xa', 'focus_near': 'Lấy nét gần', 'screenshot': 'Chụp màn hình', 'photo': 'Chụp ảnh', 'zoom_plus_slow': 'Zoom chậm +', 'on_off_timer': 'Hẹn giờ',
})


def pretty(name):
    s = re.sub(r'\bminus\b', '−', re.sub(r'\bplus\b', '+', name.replace('_', ' '))).strip()
    return (s[:1].upper() + s[1:]) if s else 'Phím'


def canon(name):
    n = BL.norm(name)
    if n in KEYMAP:
        return KEYMAP[n], True, None
    return n, True, NAME_LABELS.get(n) or LABELS.get(n) or pretty(n)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-') or 'khac'


UNKNOWN_BRANDS = re.compile(r'^(unknown|brand[_ ]?unknown|unknown[_ ]?brand|generic[_ ]?unknown[_ ]?brand|generic|no[_ ]?brand|unbranded|none|nobrand)$', re.I)


def brand_name(raw):
    if UNKNOWN_BRANDS.match(raw):
        return 'Không rõ hãng'
    return raw.replace('_', ' ').strip()


def to_spec(b):
    spec = BL.to_spec(b)
    if spec and spec['protocol'] in ('rc5', 'rc5x'):
        # bộ phát chỉ giữ 5 bit địa chỉ/6 bit lệnh: bỏ mã vượt dải thay vì cắt ngầm
        if spec['address'] > 0x1F or spec['command'] > 0x3F:
            return None
    return spec


def main():
    root, outroot = sys.argv[1], sys.argv[2]
    commit = sys.argv[3] if len(sys.argv) > 3 else ''
    header = ('/* VIGO — thư viện mã IR (loại: %s), tạo tự động bằng tools/build-devices.py từ Flipper-IRDB (CC0-1.0).\n'
              ' * KHÔNG sửa tay. Mọi mã lấy nguyên từ tệp nguồn (xem entries[].source); app không tự tạo mã. */\n')
    unmapped = collections.defaultdict(collections.Counter)
    grand = {}
    for tid, t in TYPES.items():
        outdir = os.path.join(outroot, tid)
        os.makedirs(outdir, exist_ok=True)
        for f in os.listdir(outdir):
            if f.endswith('.js'):
                os.remove(os.path.join(outdir, f))
        core = t['core']
        brands = collections.OrderedDict()   # tên hãng -> {sig: group}
        st = {'files': 0, 'used': 0, 'btn_skipped': 0, 'protos': collections.Counter()}
        for d, kind in t['dirs']:
            base = os.path.join(root, d)
            if not os.path.isdir(base):
                continue
            for dp, _, fs in sorted(os.walk(base)):
                for f in sorted(fs):
                    if not f.endswith('.ir'):
                        continue
                    st['files'] += 1
                    full = os.path.join(dp, f)
                    rel = os.path.relpath(full, base).split(os.sep)
                    bname = brand_name(rel[0]) if len(rel) > 1 else 'Không rõ hãng'
                    text = open(full, encoding='utf-8', errors='replace').read()
                    cand = collections.OrderedDict()
                    for b in BL.parse_file(text):
                        spec = to_spec(b)
                        if spec is None:
                            st['btn_skipped'] += 1
                            st['protos'][b.get('protocol', b.get('type', '?'))] += 1
                            continue
                        if not BL.re.sub(r'[^a-z0-9]', '', b['name'].lower()):
                            continue
                        key, exact, label = canon(b['name'])
                        if label:
                            unmapped[tid][key] += 1
                        entry = {'spec': spec}
                        if label:
                            entry['label'] = label
                        cand.setdefault(key, []).append((key == BL.norm(b['name']), entry))
                    codes = {}
                    for key, lst in cand.items():
                        codes[key] = next((e for ex, e in lst if ex), lst[0][1])
                    if len(codes) < 2:
                        continue
                    st['used'] += 1
                    name = os.path.splitext(f)[0]
                    name = re.sub(r'^' + re.escape(rel[0]) + r'[_ -]?', '', name, flags=re.I).replace('_', ' ').strip() or 'Chung'
                    sig = json.dumps(codes, sort_keys=True)
                    g = brands.setdefault(bname, collections.OrderedDict()).setdefault(sig, {'codes': codes, 'files': [], 'names': [], 'kinds': []})
                    g['files'].append(d + '/' + '/'.join(rel))
                    g['names'].append(name)
                    g['kinds'].append(kind)
        entries_by_brand = {}
        total = 0
        for bname, groups in brands.items():
            lst = []
            for g in groups.values():
                names = g['names']
                kind = g['kinds'][0]
                shown = ', '.join(names[:3]) + (' (+%d bộ tương tự)' % (len(names) - 3) if len(names) > 3 else '')
                lst.append({
                    'brand': bname, 'model': kind + ' · ' + shown, 'models': names, 'type': tid, 'kind': kind,
                    'core': sum(1 for k in core if k in g['codes']),
                    'source': {'name': 'Flipper-IRDB', 'license': 'CC0-1.0',
                               'url': 'https://github.com/logickworkshop/Flipper-IRDB/blob/main/' + g['files'][0], 'files': g['files']},
                    'codes': g['codes'],
                })
            main_key = 'power' if tid not in ('light',) else 'on'
            weight = collections.Counter()
            for e in lst:
                k = next((x for x in (main_key, 'power', 'on') if x in e['codes']), None)
                if k:
                    weight[json.dumps(e['codes'][k]['spec'], sort_keys=True)] += len(e['models'])

            def pop(e):
                k = next((x for x in (main_key, 'power', 'on') if x in e['codes']), None)
                return weight.get(json.dumps(e['codes'][k]['spec'], sort_keys=True), 0) if k else 0
            lst.sort(key=lambda e: (-e['core'], -pop(e), -len(e['codes']), e['model']))
            entries_by_brand[bname] = lst
            total += len(lst)

        def bkey(b):
            return (1, b.lower()) if b == 'Không rõ hãng' else (0, b.lower())
        index = {'version': 1, 'type': tid, 'core': core, 'test': t['test'],
                 'source': {'name': 'Flipper-IRDB', 'url': 'https://github.com/logickworkshop/Flipper-IRDB', 'license': 'CC0-1.0', 'commit': commit},
                 'brands': []}
        used_slugs = set()
        for b in sorted(entries_by_brand, key=bkey):
            lst = entries_by_brand[b]
            s = slug(b); base_s = s; i = 2
            while s in used_slugs:
                s = '%s-%d' % (base_s, i); i += 1
            used_slugs.add(s)
            fn = s + '.js'
            with open(os.path.join(outdir, fn), 'w', encoding='utf-8') as fh:
                fh.write(header % tid + 'VigoLib.registerDev(%s,%s,%s);\n' % (json.dumps(tid), json.dumps(b, ensure_ascii=False), json.dumps(lst, ensure_ascii=False, separators=(',', ':'))))
            index['brands'].append({'name': b, 'n': len(lst), 'file': tid + '/' + fn,
                                    'withPower': sum(1 for e in lst if 'power' in e['codes'] or 'on' in e['codes'])})
        with open(os.path.join(outdir, 'index.js'), 'w', encoding='utf-8') as fh:
            fh.write(header % tid + 'VigoLib.registerDevIndex(%s,%s);\n' % (json.dumps(tid), json.dumps(index, ensure_ascii=False, separators=(',', ':'))))
        size = sum(os.path.getsize(os.path.join(outdir, f)) for f in os.listdir(outdir)) // 1024
        grand[tid] = (len(entries_by_brand), total, size)
        print('%-6s tệp %3d dùng %3d | hãng %3d | bộ mã %3d | %5d KB | nút bỏ qua %5d %s' % (
            tid, st['files'], st['used'], len(entries_by_brand), total, size, st['btn_skipped'], dict(st['protos'].most_common(6))))

    # nhãn dùng chung cho giao diện
    with open(os.path.join(outroot, 'keys.js'), 'w', encoding='utf-8') as fh:
        fh.write('/* VIGO — nhãn tiếng Việt cho khóa phím chuẩn. Tạo tự động bằng tools/build-devices.py. */\n'
                 'VigoLib.registerKeyLabels(' + json.dumps(LABELS, ensure_ascii=False, separators=(',', ':')) + ');\n')
    if os.environ.get('SHOW_UNMAPPED'):
        for tid, c in unmapped.items():
            print('--', tid, c.most_common(40))


if __name__ == '__main__':
    main()
