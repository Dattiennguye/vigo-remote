package vn.vigo.remote;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Display;
import android.view.HapticFeedbackConstants;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity implements IrBridge.Host {
    private static final String START_URL = "file:///android_asset/web/index.html";
    private static final String ASSET_PREFIX = "file:///android_asset/";
    private static final int REQ_FILE = 1001;
    private static final int BG = Color.parseColor("#0B0D12");

    private WebView web;
    private PlatformBridge platform;
    private ValueCallback<Uri[]> filePathCallback;
    private volatile boolean volumeKeys = false;

    @Override
    @SuppressWarnings("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(BG);
        window.setNavigationBarColor(BG);

        preferHighRefreshRate(window);

        // Bố cục: [khung quảng cáo (ẩn mặc định)] + [WebView]
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        FrameLayout adBox = new FrameLayout(this);
        adBox.setBackgroundColor(BG);
        adBox.setVisibility(android.view.View.GONE);
        root.addView(adBox, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage: lưu thiết bị sau khi thoát app
        s.setAllowFileAccess(true);            // đọc assets của chính app
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setBlockNetworkLoads(true);          // WebView không bao giờ tải nội dung từ Internet

        // Giao diện nhận biết Native Bridge qua window.VigoNative.
        web.addJavascriptInterface(new IrBridge(this, this), "VigoNative");
        platform = new PlatformBridge(this, web, adBox);
        web.addJavascriptInterface(platform, "VigoPlatform");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Chỉ cho điều hướng trong assets của app; chặn mọi địa chỉ ngoài.
                return !request.getUrl().toString().startsWith(ASSET_PREFIX);
            }
        });

        // Cho phép <input type="file"> (import tệp Flipper .ir).
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Chọn tệp mã IR"), REQ_FILE);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null) {
            web.loadUrl(START_URL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    /** Chọn chế độ màn hình có tần số quét cao nhất (cùng độ phân giải), ví dụ 120 Hz. */
    @SuppressWarnings("deprecation")
    private void preferHighRefreshRate(Window window) {
        try {
            Display d = getWindowManager().getDefaultDisplay();
            Display.Mode cur = d.getMode(), best = cur;
            for (Display.Mode m : d.getSupportedModes()) {
                if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight()
                        && m.getRefreshRate() > best.getRefreshRate()) best = m;
            }
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.preferredDisplayModeId = best.getModeId();
            lp.preferredRefreshRate = best.getRefreshRate();
            window.setAttributes(lp);
        } catch (Exception ignored) {
            // không bắt buộc
        }
    }

    @Override
    public void systemHaptic(String kind, Runnable fallback) {
        runOnUiThread(() -> {
            if (web == null) { if (fallback != null) fallback.run(); return; }
            int c = "tick".equals(kind) ? HapticFeedbackConstants.CLOCK_TICK
                    : "heavy".equals(kind) ? HapticFeedbackConstants.LONG_PRESS
                    : "error".equals(kind) ? (android.os.Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS)
                    : HapticFeedbackConstants.VIRTUAL_KEY;
            boolean ok = web.performHapticFeedback(c, HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING);
            if (!ok && fallback != null) fallback.run();
        });
    }

    @Override
    public void setVolumeKeys(boolean enabled) {
        volumeKeys = enabled;
    }

    @Override
    public void setKeepScreenOn(boolean enabled) {
        runOnUiThread(() -> {
            if (enabled) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (volumeKeys && web != null
                && (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            String key = keyCode == KeyEvent.KEYCODE_VOLUME_UP ? "vol_up" : "vol_down";
            web.evaluateJavascript("window.__vigoKey && window.__vigoKey('" + key + "')", null);
            return true; // không đổi âm lượng của điện thoại
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (volumeKeys && (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (filePathCallback != null) {
                Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Cho giao diện xử lý nút Back trước (đóng hộp thoại / về Trang chủ).
        web.evaluateJavascript("(window.__vigoBack && window.__vigoBack()) === true", value -> {
            if (!"true".equals(value)) {
                finish();
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
        if (platform != null) platform.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (platform != null) platform.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("VigoNative");
            web.removeJavascriptInterface("VigoPlatform");
            if (platform != null) platform.onDestroy();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
