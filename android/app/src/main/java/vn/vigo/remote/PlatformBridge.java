package vn.vigo.remote;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.CancellationSignal;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Cầu nối "VigoPlatform": đăng nhập Google, thanh toán Google Play (đăng ký), quảng cáo AdMob.
 * Chạy hoàn toàn ở phía native; WebView vẫn chỉ nạp nội dung cục bộ và bị chặn mạng.
 * Kết quả bất đồng bộ được đẩy về giao diện qua window.__vigoPlatform(jsonString).
 *
 * LƯU Ý TRUNG THỰC: chưa thể kiểm chứng trên máy thật trong môi trường dựng. Đăng nhập cần
 * google_web_client_id; thanh toán cần ứng dụng đã đưa lên Play Console với sản phẩm đăng ký tương ứng.
 * Quyền Pro hiện chỉ kiểm tra phía máy (không có máy chủ xác thực biên nhận).
 */
public class PlatformBridge {
    private final Activity activity;
    private final WebView web;
    private final ViewGroup adContainer;
    private AdView adView;
    private BillingClient billing;
    private List<ProductDetails> cachedDetails = new ArrayList<>();
    private boolean adsInit = false;

    public PlatformBridge(Activity activity, WebView web, ViewGroup adContainer) {
        this.activity = activity;
        this.web = web;
        this.adContainer = adContainer;
    }

    private String str(int id) { return activity.getString(id); }

    private void emit(JSONObject o) {
        final String js = "window.__vigoPlatform && window.__vigoPlatform(" + JSONObject.quote(o.toString()) + ")";
        activity.runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    private JSONObject ev(String type, boolean ok) {
        JSONObject o = new JSONObject();
        try { o.put("type", type); o.put("ok", ok); } catch (Exception ignored) { }
        return o;
    }

    private void fail(String type, String msg) {
        JSONObject o = ev(type, false);
        try { o.put("error", msg); } catch (Exception ignored) { }
        emit(o);
    }

    @JavascriptInterface
    public String getConfig() {
        try {
            JSONObject o = new JSONObject();
            o.put("ok", true);
            o.put("signIn", !str(R.string.google_web_client_id).trim().isEmpty());
            o.put("ads", activity.getResources().getBoolean(R.bool.vigo_ads_enabled));
            o.put("billing", true);
            o.put("plan6m", str(R.string.pro_plan_6m));
            o.put("plan1y", str(R.string.pro_plan_1y));
            return o.toString();
        } catch (Exception e) {
            return "{\"ok\":false}";
        }
    }

    /* ---------------- Đăng nhập Google ---------------- */
    @JavascriptInterface
    public void signIn() {
        final String clientId = str(R.string.google_web_client_id).trim();
        if (clientId.isEmpty()) { fail("auth", "Chưa cấu hình Google Web Client ID (xem docs/ONLINE-SERVICES.md)"); return; }
        activity.runOnUiThread(() -> {
            try {
                CredentialManager cm = CredentialManager.create(activity);
                GetCredentialRequest req = new GetCredentialRequest.Builder()
                        .addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build())
                        .build();
                cm.getCredentialAsync(activity, req, new CancellationSignal(), ContextCompat.getMainExecutor(activity),
                        new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                            @Override
                            public void onResult(GetCredentialResponse result) {
                                try {
                                    Credential c = result.getCredential();
                                    if (c instanceof CustomCredential
                                            && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                                        GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                                        JSONObject o = ev("auth", true);
                                        o.put("email", g.getId());
                                        o.put("name", g.getDisplayName() == null ? "" : g.getDisplayName());
                                        emit(o);
                                    } else {
                                        fail("auth", "Loại thông tin đăng nhập không được hỗ trợ");
                                    }
                                } catch (Exception e) {
                                    fail("auth", "Không đọc được kết quả đăng nhập: " + e.getMessage());
                                }
                            }

                            @Override
                            public void onError(GetCredentialException e) {
                                fail("auth", e.getClass().getSimpleName().contains("Cancellation")
                                        ? "Đã hủy đăng nhập" : "Đăng nhập thất bại: " + e.getMessage());
                            }
                        });
            } catch (Exception e) {
                fail("auth", "Không mở được đăng nhập Google: " + e.getMessage());
            }
        });
    }

    @JavascriptInterface
    public void signOut() {
        activity.runOnUiThread(() -> {
            try {
                CredentialManager cm = CredentialManager.create(activity);
                cm.clearCredentialStateAsync(new ClearCredentialStateRequest(), new CancellationSignal(),
                        ContextCompat.getMainExecutor(activity), new CredentialManagerCallback<Void, ClearCredentialException>() {
                            @Override public void onResult(Void r) {
                                JSONObject o = ev("auth", true);
                                try { o.put("signedOut", true); } catch (Exception ignored) { }
                                emit(o);
                            }
                            @Override public void onError(ClearCredentialException e) { fail("auth", "Đăng xuất thất bại: " + e.getMessage()); }
                        });
            } catch (Exception e) {
                fail("auth", "Đăng xuất thất bại: " + e.getMessage());
            }
        });
    }

    /* ---------------- Thanh toán Google Play ---------------- */
    private interface Ready { void run(); }

    private void withBilling(final String type, final Ready r) {
        activity.runOnUiThread(() -> {
            if (billing != null && billing.isReady()) { r.run(); return; }
            if (billing == null) {
                billing = BillingClient.newBuilder(activity)
                        .setListener((result, purchases) -> onPurchases(result, purchases))
                        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                        .build();
            }
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult br) {
                    if (br.getResponseCode() == BillingClient.BillingResponseCode.OK) r.run();
                    else fail(type, "Google Play Billing không khả dụng (" + br.getDebugMessage() + ")");
                }
                @Override public void onBillingServiceDisconnected() { }
            });
        });
    }

    @JavascriptInterface
    public void loadPlans() {
        withBilling("plans", () -> {
            QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(str(R.string.pro_product_id)).setProductType(BillingClient.ProductType.SUBS).build()))
                    .build();
            billing.queryProductDetailsAsync(p, (br, list) -> {
                try {
                    if (br.getResponseCode() != BillingClient.BillingResponseCode.OK || list == null || list.isEmpty()) {
                        fail("plans", "Chưa có gói “" + str(R.string.pro_product_id) + "” trên Google Play (cần đưa app lên Play Console và tạo gói đăng ký)");
                        return;
                    }
                    cachedDetails = list;
                    JSONArray arr = new JSONArray();
                    for (ProductDetails d : list) {
                        List<ProductDetails.SubscriptionOfferDetails> offers = d.getSubscriptionOfferDetails();
                        if (offers == null) continue;
                        for (ProductDetails.SubscriptionOfferDetails of : offers) {
                            if (of.getOfferId() != null) continue; // chỉ gói cơ sở, không ưu đãi
                            List<ProductDetails.PricingPhase> ph = of.getPricingPhases().getPricingPhaseList();
                            if (ph.isEmpty()) continue;
                            ProductDetails.PricingPhase last = ph.get(ph.size() - 1);
                            JSONObject o = new JSONObject();
                            o.put("id", of.getBasePlanId());
                            o.put("title", d.getName());
                            o.put("price", last.getFormattedPrice());
                            o.put("period", last.getBillingPeriod());
                            arr.put(o);
                        }
                    }
                    JSONObject o = ev("plans", true);
                    o.put("plans", arr);
                    emit(o);
                } catch (Exception e) {
                    fail("plans", e.getMessage());
                }
            });
        });
    }

    @JavascriptInterface
    public void buy(final String basePlanId) {
        withBilling("purchase", () -> {
            for (ProductDetails d : cachedDetails) {
                List<ProductDetails.SubscriptionOfferDetails> offers = d.getSubscriptionOfferDetails();
                if (offers == null) continue;
                for (ProductDetails.SubscriptionOfferDetails of : offers) {
                    if (of.getOfferId() == null && of.getBasePlanId().equals(basePlanId)) {
                        BillingFlowParams.ProductDetailsParams pdp = BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(d).setOfferToken(of.getOfferToken()).build();
                        BillingResult br = billing.launchBillingFlow(activity, BillingFlowParams.newBuilder()
                                .setProductDetailsParamsList(Collections.singletonList(pdp)).build());
                        if (br.getResponseCode() != BillingClient.BillingResponseCode.OK) fail("purchase", "Không mở được thanh toán: " + br.getDebugMessage());
                        return;
                    }
                }
            }
            fail("purchase", "Chưa tải được thông tin gói. Hãy thử lại sau.");
        });
    }

    private void onPurchases(BillingResult br, List<Purchase> purchases) {
        int code = br.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSONObject o = ev("purchase", false);
            try { o.put("state", "cancelled"); o.put("error", "Đã hủy thanh toán"); } catch (Exception ignored) { }
            emit(o);
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) { fail("purchase", "Thanh toán thất bại: " + br.getDebugMessage()); return; }
        emitEntitlement(purchases, "purchase");
    }

    private void emitEntitlement(List<Purchase> purchases, String type) {
        boolean active = false, pending = false, renewing = false;
        for (Purchase p : purchases) {
            if (!p.getProducts().contains(str(R.string.pro_product_id))) continue;
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                active = true; renewing = p.isAutoRenewing();
                if (!p.isAcknowledged()) {
                    billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
                }
            } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
        }
        JSONObject o = ev(type, true);
        try { o.put("active", active); o.put("pending", pending); o.put("renewing", renewing); } catch (Exception ignored) { }
        emit(o);
        if (!type.equals("entitlement")) {
            JSONObject e = ev("entitlement", true);
            try { e.put("active", active); e.put("pending", pending); e.put("renewing", renewing); } catch (Exception ignored) { }
            emit(e);
        }
    }

    /** Kiểm tra quyền Pro hiện có (khi mở app hoặc bấm Khôi phục). */
    @JavascriptInterface
    public void checkEntitlement() {
        withBilling("entitlement", () -> billing.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (br, list) -> {
                    if (br.getResponseCode() == BillingClient.BillingResponseCode.OK) emitEntitlement(list, "entitlement");
                    else fail("entitlement", "Không kiểm tra được gói: " + br.getDebugMessage());
                }));
    }

    @JavascriptInterface
    public void manageSubscription() {
        try {
            Uri u = Uri.parse("https://play.google.com/store/account/subscriptions?sku=" + str(R.string.pro_product_id)
                    + "&package=" + activity.getPackageName());
            activity.startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception e) {
            fail("manage", "Không mở được trang quản lý gói");
        }
    }

    /* ---------------- Quảng cáo AdMob (banner phía trên) ---------------- */
    @JavascriptInterface
    public void setAdsEnabled(final boolean enabled) {
        activity.runOnUiThread(() -> {
            try {
                boolean allowed = enabled && activity.getResources().getBoolean(R.bool.vigo_ads_enabled);
                if (!allowed) {
                    adContainer.setVisibility(View.GONE);
                    if (adView != null) adView.pause();
                    return;
                }
                if (!adsInit) { MobileAds.initialize(activity, s -> { }); adsInit = true; }
                if (adView == null) {
                    adView = new AdView(activity);
                    adView.setAdSize(AdSize.BANNER);
                    adView.setAdUnitId(str(R.string.admob_banner_unit));
                    adContainer.addView(adView, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                    adView.loadAd(new AdRequest.Builder().build());
                } else {
                    adView.resume();
                }
                adContainer.setVisibility(View.VISIBLE);
            } catch (Exception ignored) {
                adContainer.setVisibility(View.GONE);
            }
        });
    }

    public void onPause() { if (adView != null) adView.pause(); }
    public void onResume() { if (adView != null && adContainer.getVisibility() == View.VISIBLE) adView.resume(); }
    public void onDestroy() { if (adView != null) adView.destroy(); if (billing != null) billing.endConnection(); }
}
