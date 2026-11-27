package app.agus.companion;

import static app.agus.companion.CompanionViews.ACCENT;
import static app.agus.companion.CompanionViews.BACKGROUND;
import static app.agus.companion.CompanionViews.ERROR;
import static app.agus.companion.CompanionViews.MUTED;
import static app.agus.companion.ProviderApi.INVITATIONS;
import static app.agus.companion.ProviderApi.string;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowInsets;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final long REFRESH_INTERVAL_MS = 10_000;

    enum Screen {
        WELCOME, AUTH, ENROLLMENT, HOME, MY_DEVICE, ACTIVITY, JOB_DETAILS,
        ACTIVE_SESSION, COMPLETED_SESSION, EARNINGS, PROFILE;

        boolean isMainTab() {
            return this == HOME || this == ACTIVITY || this == EARNINGS;
        }
    }

    interface Operation {
        JSONObject request(ApiClient api) throws IOException, JSONException;
    }

    interface Result {
        void received(JSONObject result);
    }

    interface Rejection {
        void show(String message);
    }

    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final ExecutorService reads = Executors.newSingleThreadExecutor();
    private final ExecutorService walletExecutor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable poll = new Runnable() {
        @Override public void run() {
            refresh(false);
            handler.postDelayed(this, REFRESH_INTERVAL_MS);
        }
    };

    CompanionViews ui;
    ProviderApi.Snapshot snapshot;
    Screen screen = Screen.WELCOME;
    String selectedId;
    JSONObject selectedInvitation;
    JSONObject selectedOffer;
    String selectedOfferDeviceId;
    JSONObject selectedRunOverride;
    String selectedDevice;
    JSONObject pairing;
    String walletAddress;
    String walletVerifiedAt;
    private String walletDisplayedRoute;
    String walletStatus;
    boolean walletInFlight;
    String pendingInvitationCode;
    private Screen mainTab = Screen.HOME;
    private ProviderScreens screens;
    private LinearLayout content;
    private ScrollView scroll;
    private TextView statusView;
    private Session session;
    private boolean loading;
    private boolean mutating;
    private int mutationVersion;
    private String statusMessage = "";
    private boolean statusIsError;

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        ui = new CompanionViews(this);
        screens = new ProviderScreens(this);
        Retained retained = (Retained) getLastNonConfigurationInstance();
        if (retained != null) {
            session = retained.session;
            screen = retained.screen;
            mainTab = retained.mainTab;
            selectedId = retained.selectedId;
            selectedDevice = retained.selectedDevice;
            pendingInvitationCode = retained.pendingInvitationCode;
            selectedInvitation = retained.selectedInvitation;
            selectedOffer = retained.selectedOffer;
            selectedOfferDeviceId = retained.selectedOfferDeviceId;
            snapshot = retained.snapshot;
        }
        render(false);
        refresh(false);
    }

    @Override public Object onRetainNonConfigurationInstance() {
        return new Retained(this);
    }

    @Override protected void onResume() {
        super.onResume();
        handler.removeCallbacks(poll);
        handler.postDelayed(poll, REFRESH_INTERVAL_MS);
    }

    @Override protected void onPause() {
        handler.removeCallbacks(poll);
        super.onPause();
    }

    @Override protected void onDestroy() {
        network.shutdown();
        reads.shutdownNow();
        walletExecutor.shutdownNow();
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (screen == Screen.AUTH) {
            navigate(Screen.WELCOME, null);
        } else if (screen == Screen.ENROLLMENT || screen == Screen.MY_DEVICE || screen == Screen.PROFILE) {
            navigate(mainTab, null);
        } else if (screen == Screen.JOB_DETAILS || screen == Screen.ACTIVE_SESSION || screen == Screen.COMPLETED_SESSION) {
            navigate(Screen.ACTIVITY, null);
        } else if (session != null && screen != Screen.HOME) {
            navigate(Screen.HOME, null);
        } else {
            super.onBackPressed();
        }
    }

    void navigate(Screen next, String id) {
        screen = next;
        selectedId = id;
        if (next.isMainTab()) {
            mainTab = next;
        }
        statusMessage = "";
        render(false);
        if (selectedSession() != null || snapshot == null || next.isMainTab()) {
            refresh(false);
        }
    }

    private String selectedSession() {
        return screen == Screen.ACTIVE_SESSION || screen == Screen.COMPLETED_SESSION ? selectedId : null;
    }

    void render(boolean preserveScroll) {
        int oldScroll = preserveScroll && scroll != null ? scroll.getScrollY() : 0;
        LinearLayout root = ui.column();
        root.setTag("screen_" + screen.name().toLowerCase(java.util.Locale.ROOT));
        root.setBackgroundColor(BACKGROUND);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
            }
            return insets;
        });
        if (Build.VERSION.SDK_INT < 30) {
            root.setFitsSystemWindows(true);
        }
        scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        content = ui.column();
        content.setPadding(ui.dp(20), ui.dp(23), ui.dp(20), ui.dp(24));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);

        LinearLayout brand = ui.row();
        TextView label = ui.text("AGUS AI", 15, ACCENT, true);
        ui.weighted(brand, label, 8);
        if (session != null && screen != Screen.PROFILE) {
            brand.addView(ui.button("Profile", false, view -> navigate(Screen.PROFILE, null)));
        }
        ui.add(content, brand, 0);
        statusView = ui.text("", 14, MUTED, false);
        statusView.setId(R.id.feedback);
        statusView.setAccessibilityLiveRegion(TextView.ACCESSIBILITY_LIVE_REGION_POLITE);
        statusView.setVisibility(android.view.View.GONE);
        ui.add(content, statusView, 6);
        status(statusMessage, statusIsError);
        screens.show(screen, content);
        if (screen.isMainTab()) {
            ui.add(content, ui.button("Refresh", false, view -> refresh(true)), 24);
            LinearLayout tabs = ui.row();
            tabs.setPadding(ui.dp(20), ui.dp(6), ui.dp(20), ui.dp(10));
            addTab(tabs, Screen.HOME, "Home", R.id.tab_home, 8);
            addTab(tabs, Screen.ACTIVITY, "Activity", R.id.tab_activity, 8);
            addTab(tabs, Screen.EARNINGS, "Earnings", R.id.tab_earnings, 0);
            ui.add(root, tabs, 0);
        }
        if (oldScroll > 0) {
            ScrollView view = scroll;
            view.post(() -> view.scrollTo(0, oldScroll));
        }
    }

    private void addTab(LinearLayout tabs, Screen target, String label, int id, int padding) {
        var button = ui.button(label, screen == target, view -> navigate(target, null));
        button.setId(id);
        button.setSelected(screen == target);
        ui.weighted(tabs, button, padding);
    }

    String preference(String key) {
        return getPreferences(MODE_PRIVATE).getString(key, "");
    }

    private void remember(String key, String value) {
        getPreferences(MODE_PRIVATE).edit().putString(key, value).apply();
    }

    void authenticate(boolean register, EditText originField, EditText emailField, EditText passwordField, EditText registrationField) {
        String password = passwordField.getText().toString();
        if (password.isEmpty()) {
            statusError("Enter your password.");
            return;
        }
        getSystemService(InputMethodManager.class).hideSoftInputFromWindow(passwordField.getWindowToken(), 0);
        authRequest(register ? "/auth/register" : "/auth/login", originField, emailField, "password", password,
            register ? registrationField.getText().toString().trim() : "", register ? "Creating account…" : "Signing in…", true);
    }

    void emailCode(boolean verify, EditText originField, EditText emailField, EditText codeField, EditText registrationField) {
        String code = codeField.getText().toString().trim();
        if (verify && !code.matches("[0-9]{6}")) {
            statusError("Enter the six-digit email code.");
            return;
        }
        authRequest(verify ? "/auth/email/verify" : "/auth/email/start", originField, emailField,
            verify ? "code" : null, code, verify ? "" : registrationField.getText().toString().trim(),
            verify ? "Checking sign-in code…" : "Requesting email code…", verify);
    }

    private void authRequest(String path, EditText originField, EditText emailField, String key, String value,
        String registrationToken, String progress, boolean createsSession) {
        if (mutating) {
            return;
        }
        URI origin;
        try {
            origin = ApiOrigin.parse(originField.getText().toString(), BuildConfig.DEBUG);
        } catch (IllegalArgumentException invalid) {
            status(invalid.getMessage(), true);
            return;
        }
        String email = emailField.getText().toString().trim();
        if (email.isEmpty()) {
            status("Enter your email.", true);
            return;
        }
        mutating = true;
        status(progress, false);
        network.execute(() -> {
            try {
                JSONObject input = new JSONObject().put("email", email);
                if (key != null) {
                    input.put(key, value);
                }
                if (!registrationToken.isEmpty()) {
                    input.put("registrationToken", registrationToken);
                }
                JSONObject result = new ApiClient(origin, null).post(path, input);
                Session newSession = createsSession ? new Session(origin, result) : null;
                runOnUiThread(() -> {
                    if (isDestroyed()) {
                        return;
                    }
                    mutating = false;
                    if (screen != Screen.AUTH) {
                        if (newSession != null) {
                            revoke(newSession);
                        }
                        return;
                    }
                    if (newSession == null) {
                        status("If email sign-in is enabled for this address, check your inbox for a code.", false);
                        return;
                    }
                    session = newSession;
                    remember("control_plane_origin", origin.toString());
                    navigate(Screen.HOME, null);
                    if (pendingInvitationCode != null) {
                        reviewCode(pendingInvitationCode);
                    }
                });
            } catch (IOException | JSONException failure) {
                runOnUiThread(() -> {
                    mutating = false;
                    if (!isDestroyed() && screen == Screen.AUTH) {
                        status(errorMessage(failure), true);
                    }
                });
            }
        });
    }

    void refresh(boolean userInitiated) {
        Session current = session;
        if (current == null || loading || mutating) {
            return;
        }
        if (current.shouldRefresh()) {
            refreshSession(current);
            return;
        }
        loading = true;
        String runId = selectedSession();
        Screen requestedScreen = screen;
        String device = selectedDevice;
        boolean marketplace = requestedScreen == Screen.ACTIVITY;
        boolean inbox = requestedScreen == Screen.ACTIVITY;
        boolean payouts = requestedScreen == Screen.EARNINGS || requestedScreen == Screen.HOME;
        int version = mutationVersion;
        if (userInitiated || snapshot == null) {
            status("Refreshing workspace…", false);
        }
        reads.execute(() -> {
            try {
                ProviderApi.Snapshot next = current.api.load(runId, device, marketplace, payouts, inbox);
                runOnUiThread(() -> {
                    if (isDestroyed() || session != current) {
                        return;
                    }
                    loading = false;
                    if (version != mutationVersion) {
                        refresh(false);
                        return;
                    }
                    boolean changed = snapshot == null || !snapshot.sameAs(next);
                    snapshot = next;
                    if (!Objects.equals(runId, selectedSession()) || !Objects.equals(device, selectedDevice)
                        || requestedScreen != screen && screen.isMainTab()) {
                        refresh(false);
                        return;
                    }
                    selectedRunOverride = null;
                    if (screen == Screen.ACTIVE_SESSION && ProviderApi.terminal(next.run)) {
                        navigate(Screen.COMPLETED_SESSION, runId);
                        return;
                    }
                    if (changed) {
                        render(true);
                    }
                    status(userInitiated ? "Workspace refreshed." : "", false);
                });
            } catch (IOException | JSONException failure) {
                runOnUiThread(() -> {
                    if (!isDestroyed() && session == current) {
                        loading = false;
                        if (version == mutationVersion) {
                            showFailure(failure, this::statusError);
                        } else {
                            refresh(false);
                        }
                    }
                });
            }
        });
    }

    private void refreshSession(Session current) {
        current.lastRefreshAttempt = System.currentTimeMillis();
        perform("Refreshing session…", api -> api.post("/auth/refresh", new JSONObject()), result -> {
            try {
                session = new Session(current.origin, result);
                refresh(false);
            } catch (JSONException invalid) {
                signOut(false);
                statusError("Please sign in again to restore your session.");
            }
        }, this::statusError, false);
    }

    void perform(String progress, Operation operation, Result complete, Rejection failed, boolean refetch) {
        Session current = session;
        if (current == null || mutating) {
            failed.show("Wait for the current request, then try again.");
            return;
        }
        mutating = true;
        mutationVersion++;
        status(progress, false);
        network.execute(() -> {
            try {
                JSONObject result = operation.request(current.api.client);
                runOnUiThread(() -> {
                    if (isDestroyed() || session != current) {
                        return;
                    }
                    mutating = false;
                    status("", false);
                    complete.received(result);
                    if (refetch) {
                        refresh(false);
                    }
                });
            } catch (IOException | JSONException failure) {
                runOnUiThread(() -> {
                    if (!isDestroyed() && session == current) {
                        mutating = false;
                        showFailure(failure, failed);
                    }
                });
            }
        });
    }

    private void showFailure(Exception failure, Rejection rejected) {
        if (failure instanceof ApiClient.ApiError && ((ApiClient.ApiError) failure).status == 401) {
            signOut(false);
            statusError("Your session expired. Sign in to continue.");
        } else {
            status("", false);
            rejected.show(errorMessage(failure));
        }
    }

    private static String errorMessage(Exception failure) {
        if (failure instanceof ApiClient.ApiError) {
            return failure.getMessage();
        }
        if (failure instanceof JSONException) {
            return "The server returned an unexpected response. Check the control-plane origin.";
        }
        return "Could not reach the control plane. Check the connection and try again.";
    }

    void statusError(String message) {
        status(message, true);
    }

    private void status(String message, boolean error) {
        statusMessage = message;
        statusIsError = error;
        statusView.setVisibility(message.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        statusView.setTextColor(error ? ERROR : MUTED);
        statusView.setText(message);
    }

    void signOut(boolean revoke) {
        Session old = session;
        session = null;
        snapshot = null;
        loading = false;
        mutating = false;
        walletAddress = null;
        walletVerifiedAt = null;
        walletDisplayedRoute = null;
        walletStatus = null;
        walletInFlight = false;
        pairing = null;
        selectedInvitation = null;
        selectedOffer = null;
        selectedOfferDeviceId = null;
        selectedRunOverride = null;
        selectedDevice = null;
        mainTab = Screen.HOME;
        navigate(Screen.WELCOME, null);
        if (revoke && old != null) {
            pendingInvitationCode = null;
            revoke(old);
        }
    }

    private void revoke(Session old) {
        network.execute(() -> {
            try {
                old.api.client.post("/auth/logout", new JSONObject());
            } catch (IOException | JSONException failure) {
                runOnUiThread(() -> {
                    if (!isDestroyed() && session == null && !mutating) {
                        statusError("Signed out on this device. Session revocation could not be confirmed.");
                    }
                });
            }
        });
    }

    String email() {
        return session == null ? "" : session.email;
    }

    URI portal() {
        String configured = preference("developer_portal");
        return configured.isEmpty() ? null : ApiOrigin.parse(configured, BuildConfig.DEBUG);
    }

    void openPortal(boolean configure) {
        URI portal = portal();
        if (portal != null && !configure) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(portal.toString())));
            } catch (ActivityNotFoundException missing) {
                statusError("A browser is required to open the developer portal.");
            }
            return;
        }
        ProviderForms.portal(this, value -> {
            remember("developer_portal", value.toString());
            openPortal(false);
        });
    }

    void copy(String label, String value) {
        getSystemService(ClipboardManager.class).setPrimaryClip(ClipData.newPlainText(label, value));
        Toast.makeText(this, "Copied " + label, Toast.LENGTH_SHORT).show();
    }

    void reviewCode(String code) {
        pendingInvitationCode = code;
        if (session == null) {
            navigate(Screen.AUTH, null);
            return;
        }
        perform("Reviewing invitation…", api -> api.post(INVITATIONS + "/review", new JSONObject().put("token", code)),
            result -> {
                pendingInvitationCode = null;
                openInvitation(result.optJSONObject("invitation"));
            }, error -> {
                pendingInvitationCode = null;
                statusError(error);
            }, true);
    }

    void openInvitation(JSONObject invitation) {
        if (invitation != null) {
            selectedInvitation = invitation;
            selectedOffer = null;
            selectedOfferDeviceId = null;
            navigate(Screen.JOB_DETAILS, string(invitation, "id"));
        }
    }

    void openOffer(JSONObject offer) {
        selectedOffer = offer;
        selectedOfferDeviceId = snapshot == null ? "" : snapshot.deviceScope;
        selectedInvitation = null;
        navigate(Screen.JOB_DETAILS, string(offer, "id"));
    }

    void openRun(JSONObject run) {
        if (run != null) {
            selectedRunOverride = run;
            navigate(ProviderApi.terminal(run) ? Screen.COMPLETED_SESSION : Screen.ACTIVE_SESSION, string(run, "id"));
        }
    }

    void chooseDevice(String id) {
        selectedDevice = id;
        refresh(true);
    }

    void openDevnetExplorer(String signature) {
        if (signature.matches("[1-9A-HJ-NP-Za-km-z]{64,90}")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://explorer.solana.com/tx/" + signature + "?cluster=devnet")));
            } catch (ActivityNotFoundException missing) {
                statusError("A browser is required to open Solana Explorer.");
            }
        }
    }

    void confirm(String title, String message, String action, Runnable accepted) {
        new AlertDialog.Builder(this).setTitle(title).setMessage(message)
            .setNegativeButton("Back", null).setPositiveButton(action, (dialog, button) -> accepted.run()).show();
    }

    private String walletRoute() {
        String device = snapshot == null ? "" : snapshot.deviceScope;
        return device.isEmpty() ? "/me/payout-wallet" : ProviderApi.item(ProviderApi.MY_DEVICES, device) + "/payout-wallet";
    }

    boolean hasCurrentWallet() {
        return walletVerifiedAt != null && Objects.equals(walletDisplayedRoute, walletRoute());
    }

    void openPhonePreview() {
        Intent launch = getPackageManager().getLaunchIntentForPackage("app.agus.runtime.preview");
        if (launch != null) startActivity(launch);
        else statusError("Phone-native testing requires the separate local preview on a disposable test device.");
    }

    void notificationPreferences() {
        perform("Loading inbox preferences…", api -> api.get("/me/notifications/preferences"), result -> {
            JSONObject existing = result.optJSONObject("preferences");
            boolean[] checked = { existing.optBoolean("completedRuns"), existing.optBoolean("campaignUpdates") };
            new AlertDialog.Builder(this).setTitle("In-app notifications")
                .setMultiChoiceItems(new String[]{"Completed runs", "Campaign updates"}, checked, (dialog, which, value) -> checked[which] = value)
                .setNegativeButton("Back", null).setPositiveButton("Save", (dialog, which) ->
                    perform("Saving inbox preferences…", api -> api.patch("/me/notifications/preferences",
                        new JSONObject().put("completedRuns", checked[0]).put("campaignUpdates", checked[1])),
                        value -> status("Inbox preferences saved.", false), this::statusError, false)).show();
        }, this::statusError, false);
    }

    private void updateWallet(JSONObject wallet, String error) {
        walletDisplayedRoute = walletRoute();
        walletAddress = wallet == null ? null : wallet.optString("address", null);
        walletVerifiedAt = wallet == null ? null : wallet.optString("verifiedAt", null);
        walletStatus = error;
        render(true);
    }

    void loadWallet() {
        String route = walletRoute();
        if (route == null || walletInFlight) return;
        perform("Loading verified wallet…", api -> api.get(route), result -> {
            if (Objects.equals(route, walletRoute())) updateWallet(result.optJSONObject("payoutWallet"), null);
        }, this::statusError, false);
    }

    void disconnectWallet() {
        String route = walletRoute();
        if (route == null || walletInFlight) return;
        confirm("Disconnect payout wallet?", "Future offers will require a new verified wallet. Accepted jobs keep their original terms.",
            "Disconnect", () -> perform("Disconnecting wallet…", api -> api.delete(route),
                result -> updateWallet(null, "Payout wallet disconnected."), this::statusError, false));
    }

    void connectWallet() {
        Session current = session;
        String route = walletRoute();
        if (current == null || route == null || walletInFlight || mutating) return;
        walletStatus = null;
        walletInFlight = true;
        render(true);
        DevnetWallet.prove(this, walletExecutor, current.api.client, current.origin, route, (wallet, error) -> {
            if (isDestroyed() || session != current) return;
            walletInFlight = false;
            if (!Objects.equals(route, walletRoute())) {
                updateWallet(null, "Device selection changed. Refresh its payout wallet.");
            } else if (wallet != null) {
                updateWallet(wallet, "Payout wallet ownership verified for future Devnet offers.");
            } else {
                walletStatus = error;
                render(true);
            }
        });
    }

    private static final class Session {
        final URI origin;
        final ProviderApi api;
        final String email;
        final long expiresAt;
        long lastRefreshAttempt;

        Session(URI origin, JSONObject response) throws JSONException {
            this.origin = origin;
            this.api = new ProviderApi(new ApiClient(origin, response.getString("token")));
            this.email = response.getJSONObject("user").getString("email");
            long expiry;
            try {
                expiry = Instant.parse(response.optString("expiresAt")).toEpochMilli();
            } catch (DateTimeParseException invalid) {
                expiry = Long.MAX_VALUE;
            }
            this.expiresAt = expiry;
        }

        boolean shouldRefresh() {
            long now = System.currentTimeMillis();
            return expiresAt - now <= 300_000 && now - lastRefreshAttempt > 60_000;
        }
    }

    private static final class Retained {
        final Session session;
        final Screen screen;
        final Screen mainTab;
        final String selectedId;
        final String selectedDevice;
        final String pendingInvitationCode;
        final JSONObject selectedInvitation;
        final JSONObject selectedOffer;
        final String selectedOfferDeviceId;
        final ProviderApi.Snapshot snapshot;

        Retained(MainActivity activity) {
            session = activity.session;
            screen = activity.screen;
            mainTab = activity.mainTab;
            selectedId = activity.selectedId;
            selectedDevice = activity.selectedDevice;
            pendingInvitationCode = activity.pendingInvitationCode;
            selectedInvitation = activity.selectedInvitation;
            selectedOffer = activity.selectedOffer;
            selectedOfferDeviceId = activity.selectedOfferDeviceId;
            snapshot = activity.snapshot;
        }
    }
}
