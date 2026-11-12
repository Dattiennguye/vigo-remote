package vn.vigo.remote;

import android.content.Context;
import android.hardware.ConsumerIrManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Cầu nối Native cho phần giao diện HTML. Được đăng ký trong WebView với tên "VigoNative".
 *
 * Mọi phương thức trả về chuỗi JSON để phía JS (js/ir-bridge.js) parse:
 *   hasIrEmitter()            -> {"ok":true,"available":true|false} | {"ok":false,"error":"..."}
 *   getCarrierFrequencies()   -> {"ok":true,"ranges":[[min,max],...]} | {"ok":false,"error":"..."}
 *   transmit(freqHz, json)    -> {"ok":true} | {"ok":false,"error":"..."}
 *   haptic(kind, mode)        -> (không trả về) rung hệ thống: kind tick|click|heavy|error; mode bị bỏ qua
 *   hapticTest()              -> JSON chẩn đoán + rung thử (rung hệ thống)
 *   setVolumeKeys(bool)       -> {"ok":true}  dùng phím âm lượng vật lý để gửi vol_up/vol_down
 *   keepScreenOn(bool)        -> {"ok":true}  giữ màn hình sáng
 *
 * LƯU Ý TRUNG THỰC: ConsumerIrManager.transmit() không có giá trị trả về xác nhận thiết bị đích
 * đã nhận lệnh. "ok":true nghĩa là hệ điều hành chấp nhận lệnh phát mà không ném ngoại lệ.
 */
public class IrBridge {
    private static final int MIN_FREQ = 15000;
    private static final int MAX_FREQ = 60000;
    private static final int MAX_LEN = 2000;
    private static final int MAX_PULSE_US = 500000;

    /** Các thao tác cần Activity (chạy trên luồng giao diện). */
    public interface Host {
        void setVolumeKeys(boolean enabled);
        void setKeepScreenOn(boolean enabled);
        /** Rung cảm ứng hệ thống; nếu hệ thống không xử lý thì chạy fallback (có thể null). */
        void systemHaptic(String kind, Runnable fallback);
    }

    private final Context context;
    private final ConsumerIrManager ir;
    private final Host host;

    public IrBridge(Context ctx, Host host) {
        this.host = host;
        this.context = ctx.getApplicationContext();
        ConsumerIrManager m = null;
        try {
            m = (ConsumerIrManager) this.context.getSystemService(Context.CONSUMER_IR_SERVICE);
        } catch (Exception ignored) {
            // m giữ null: coi như không có phần cứng
        }
        this.ir = m;
    }

    @JavascriptInterface
    public String hasIrEmitter() {
        try {
            boolean has = ir != null && ir.hasIrEmitter();
            return ok().put("available", has).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String getCarrierFrequencies() {
        try {
            if (ir == null || !ir.hasIrEmitter()) {
                return errorText("Thiết bị không có mắt phát hồng ngoại.");
            }
            ConsumerIrManager.CarrierFrequencyRange[] ranges = ir.getCarrierFrequencies();
            JSONArray arr = new JSONArray();
            if (ranges != null) {
                for (ConsumerIrManager.CarrierFrequencyRange r : ranges) {
                    JSONArray one = new JSONArray();
                    one.put(r.getMinFrequency());
                    one.put(r.getMaxFrequency());
                    arr.put(one);
                }
            }
            return ok().put("ranges", arr).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String transmit(int carrierHz, String patternJson) {
        try {
            if (ir == null || !ir.hasIrEmitter()) {
                return errorText("Thiết bị không có mắt phát hồng ngoại.");
            }
            if (carrierHz < MIN_FREQ || carrierHz > MAX_FREQ) {
                return errorText("Tần số sóng mang không hợp lệ: " + carrierHz + " Hz.");
            }
            JSONArray arr = new JSONArray(patternJson);
            if (arr.length() < 2 || arr.length() > MAX_LEN) {
                return errorText("Độ dài mẫu xung không hợp lệ: " + arr.length() + ".");
            }
            int[] pattern = new int[arr.length()];
            for (int i = 0; i < pattern.length; i++) {
                int v = arr.getInt(i);
                if (v <= 0 || v > MAX_PULSE_US) {
                    return errorText("Phần tử xung #" + (i + 1) + " không hợp lệ: " + v + ".");
                }
                pattern[i] = v;
            }
            ir.transmit(carrierHz, pattern);
            return ok().toString();
        } catch (SecurityException e) {
            return errorText("Thiếu quyền TRANSMIT_IR: " + e.getMessage());
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    @SuppressWarnings("deprecation")
    public void vibrate(int ms) {
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                int d = Math.max(1, Math.min(ms, 100));
                v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
            }
        } catch (Exception ignored) {
            // rung chỉ là phụ trợ
        }
    }

    /**
     * Rung phản hồi. kind: tick | click | heavy | error. Chỉ dùng rung cảm ứng của hệ thống (giống rung bàn phím);
     * tham số mode giữ lại cho tương thích, bị bỏ qua.
     */
    @JavascriptInterface
    public void haptic(String kind, String mode) {
        if (host != null) host.systemHaptic(kind == null ? "click" : kind, null);
    }

    /** Chẩn đoán rung: rung thử bằng rung hệ thống rồi báo thông tin thiết bị. */
    @JavascriptInterface
    @SuppressWarnings("deprecation")
    public String hapticTest() {
        try {
            JSONObject o = new JSONObject();
            o.put("ok", true);
            o.put("sdk", android.os.Build.VERSION.SDK_INT);
            o.put("system", host != null);
            if (host != null) host.systemHaptic("heavy", null);
            return o.toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    /** Bật/tắt việc dùng phím âm lượng vật lý để điều khiển TV (do giao diện quyết định). */
    @JavascriptInterface
    public String setVolumeKeys(boolean enabled) {
        try {
            if (host != null) host.setVolumeKeys(enabled);
            return ok().toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    /** Giữ màn hình sáng khi đang ở màn hình điều khiển. */
    @JavascriptInterface
    public String keepScreenOn(boolean enabled) {
        try {
            if (host != null) host.setKeepScreenOn(enabled);
            return ok().toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    private static JSONObject ok() throws Exception {
        return new JSONObject().put("ok", true);
    }

    private static String errorText(String msg) {
        try {
            return new JSONObject().put("ok", false).put("error", msg).toString();
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"Lỗi không xác định\"}";
        }
    }

    private static String error(Exception e) {
        String m = e.getMessage();
        return errorText(e.getClass().getSimpleName() + (m == null ? "" : ": " + m));
    }
}
