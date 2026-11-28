package app.agus.companion;

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
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;
import java.io.IOException;
import java.net.URI;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final long REFRESH_INTERVAL_MS = 10_000;
    private static final long GOOGLE_ATTEMPT_MS = 10 * 60_000;

    enum Screen {
        WELCOME, AUTH, ENROLLMENT, HOME, MY_DEVICE, ACTIVITY, JOB_DETAILS,
        ACTIVE_SESSION, COMPLETED_SESSION, EARNINGS, PROFILE, INBOX;

        boolean isMainTab() {
            return this == HOME || this == ACTIVITY || this == EARNINGS;
        }
    }

    enum AuthMethod { CHOICE, EMAIL, PASSWORD }

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
    private URI pendingInvitationOrigin;
    AuthMethod authMethod = AuthMethod.CHOICE;
    String authEmail = "";
    boolean emailCodeSent;
    long resendAt;
    int activitySection;
    int earningsDays = 7;
    private Screen mainTab = Screen.HOME;
    private ProviderScreens screens;
    private LinearLayout content;
    private ScrollView scroll;
    private TextView statusView;
    private Session session;
    private AuthStorage authStorage;
    private boolean loading;
    private boolean mutating;
    private int mutationVersion;
    private int googleGeneration;
    private String statusMessage = "";
    private boolean statusIsError;

    @Override public void onCreate(Bundle savedState) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedState);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        ui = new CompanionViews(this);
        screens = new ProviderScreens(this);
        authStorage = new AuthStorage(this);
        Retained retained = (Retained) getLastNonConfigurationInstance();
        if (retained != null) {
            session = retained.session;
            screen = retained.screen;
            mainTab = retained.mainTab;
            selectedId = retained.selectedId;
            selectedDevice = retained.selectedDevice;
            pendingInvitationCode = retained.pendingInvitationCode;
            pendingInvitationOrigin = retained.pendingInvitationOrigin;
            selectedInvitation = retained.selectedInvitation;
            selectedOffer = retained.selectedOffer;
            selectedOfferDeviceId = retained.selectedOfferDeviceId;
            snapshot = retained.snapshot;
            authMethod = retained.authMethod;
            authEmail = retained.authEmail;
            emailCodeSent = retained.emailCodeSent;
            resendAt = retained.resendAt;
            activitySection = retained.activitySection;
            earningsDays = retained.earningsDays;
        } else {
            JSONObject saved = authStorage.read("session");
            if (saved != null) {
                try {
                    Session restored = new Session(ApiOrigin.parse(saved.getString("origin"), BuildConfig.DEBUG),
                        saved.getJSONObject("response"));
                    if (restored.expiresAt <= System.currentTimeMillis()) throw new JSONException("Expired session");
                    session = restored;
                    screen = Screen.HOME;
                } catch (IllegalArgumentException | JSONException invalid) {
                    authStorage.clear("session");
                }
            }
            JSONObject invite = authStorage.read("invitation");
            if (invite != null) {
                pendingInvitationCode = invite.optString("code", null);
                if (invite.optBoolean("production")) pendingInvitationOrigin = GoogleSignIn.ORIGIN;
            }
            if (session == null && (googlePending() != null || pendingInvitationCode != null)) screen = Screen.AUTH;
        }
        render(false);
        handleLink(getIntent());
        refresh(false);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleLink(intent);
    }

    private void handleLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getDataString() == null) return;
        String code = InvitationCode.appLink(intent.getDataString());
        if (code == null) {
            handleGoogleReturn(intent);
            return;
        }
        intent.setData(null);
        if (session != null && !GoogleSignIn.ORIGIN.equals(session.origin)) {
            statusError("This link belongs to agusai.grindcity.app. Sign out of the test server and reopen the invitation.");
            return;
        }
        saveInvitation(code, GoogleSignIn.ORIGIN);
        reviewCode(code);
    }

    @Override public Object onRetainNonConfigurationInstance() {
        return new Retained(this);
    }

    @Override protected void onResume() {
        super.onResume();
        handler.removeCallbacks(poll);
        handler.postDelayed(poll, REFRESH_INTERVAL_MS);
        if (session != null && pendingInvitationCode != null && !mutating) reviewCode(pendingInvitationCode);
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
        if (screen == Screen.AUTH && authMethod != AuthMethod.CHOICE) {
            if (!mutating) changeAuth(AuthMethod.CHOICE);
        } else if (screen == Screen.AUTH) {
            googleGeneration++;
            authStorage.clear("google");
            navigate(Screen.WELCOME, null);
        } else if (screen == Screen.ENROLLMENT || screen == Screen.MY_DEVICE || screen == Screen.PROFILE || screen == Screen.INBOX) {
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
        if (selectedSession() != null || snapshot == null || next.isMainTab() || next == Screen.INBOX) {
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
        int gutter = getResources().getConfiguration().screenWidthDp <= 340 ? 16 : 22;
        if (screen != Screen.WELCOME) drawHeader(root, gutter);
        scroll = new ScrollView(this);
        scroll.setClipToPadding(false);
        scroll.setFillViewport(true);
        content = ui.column();
        content.setPadding(ui.dp(gutter), ui.dp(12), ui.dp(gutter), ui.dp(24));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);

        statusView = ui.text("", 14, MUTED, false);
        statusView.setId(R.id.feedback);
        statusView.setAccessibilityLiveRegion(TextView.ACCESSIBILITY_LIVE_REGION_POLITE);
        statusView.setVisibility(android.view.View.GONE);
        ui.add(content, statusView, 6);
        status(statusMessage, statusIsError);
        screens.show(screen, content);
        if (screen == Screen.ACTIVE_SESSION) screens.stopBar(root, gutter);
        if (screen.isMainTab()) {
            ui.rule(root, 0);
            LinearLayout tabs = ui.row();
            tabs.setPadding(ui.dp(gutter), ui.dp(6), ui.dp(gutter), ui.dp(6));
            addTab(tabs, Screen.HOME, "Home", R.drawable.ic_home, R.id.tab_home, 8);
            addTab(tabs, Screen.ACTIVITY, "Activity", R.drawable.ic_activity, R.id.tab_activity, 8);
            addTab(tabs, Screen.EARNINGS, "Earnings", R.drawable.ic_earnings, R.id.tab_earnings, 0);
            ui.add(root, tabs, 0);
        }
        if (oldScroll > 0) {
            ScrollView view = scroll;
            view.post(() -> view.scrollTo(0, oldScroll));
        }
    }

    private void drawHeader(LinearLayout root, int gutter) {
        LinearLayout bar = ui.row();
        bar.setPadding(ui.dp(gutter), ui.dp(5), ui.dp(gutter), ui.dp(5));
        bar.setMinimumHeight(ui.dp(57));
        if (!screen.isMainTab()) {
            bar.addView(ui.iconButton("Back", R.drawable.ic_back, view -> onBackPressed()));
            Space gap = new Space(this);
            bar.addView(gap, new LinearLayout.LayoutParams(ui.dp(13), 0));
        }
        bar.addView(ui.brandImage(R.drawable.brand_lockup_dark, false),
            new LinearLayout.LayoutParams(ui.dp(128), ui.dp(29)));
        bar.addView(new Space(this), new LinearLayout.LayoutParams(0, 0, 1));
        if (screen.isMainTab()) {
            if (screen == Screen.HOME) {
                bar.addView(ui.iconButton("Inbox", R.drawable.ic_bell, view -> navigate(Screen.INBOX, null)));
                bar.addView(new Space(this), new LinearLayout.LayoutParams(ui.dp(7), 0));
                bar.addView(ui.iconButton("Profile", R.drawable.ic_profile, view -> navigate(Screen.PROFILE, null)));
            } else {
                bar.addView(ui.iconButton("Refresh", R.drawable.ic_refresh, view -> refresh(true)));
            }
        }
        ui.add(root, bar, 0);
    }

    private void addTab(LinearLayout tabs, Screen target, String label, int icon, int id, int padding) {
        var button = ui.tab(label, icon, screen == target, view -> navigate(target, null));
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

    boolean canUseTestServer() {
        return BuildConfig.DEBUG && pendingInvitationOrigin == null;
    }

    void changeAuth(AuthMethod method) {
        if (mutating) return;
        authMethod = method;
        statusMessage = "";
        render(false);
    }

    boolean waitingForGoogle() {
        return googlePending() != null;
    }

    void authenticate(boolean register, EditText originField, EditText emailField, EditText passwordField) {
        String password = passwordField.getText().toString();
        if (password.length() < 12) {
            statusError("Use a password with at least 12 characters.");
            return;
        }
        getSystemService(InputMethodManager.class).hideSoftInputFromWindow(passwordField.getWindowToken(), 0);
        authRequest(register ? "/auth/register" : "/auth/login", originField, emailField.getText().toString(),
            "password", password, register ? "Creating account…" : "Signing in…", true);
    }

    void editAuthEmail() {
        if (!mutating) {
            emailCodeSent = false;
            statusMessage = "";
            render(false);
        }
    }

    void emailCode(EditText emailField, EditText codeField) {
        boolean verify = codeField != null;
        String code = verify ? codeField.getText().toString().trim() : "";
        if (verify && !code.matches("[0-9]{6}")) {
            statusError("Enter the six-digit email code.");
            return;
        }
        authRequest(verify ? "/auth/email/verify" : "/auth/email/start", null,
            emailField == null ? authEmail : emailField.getText().toString(),
            verify ? "code" : null, code, verify ? "Checking code…" : "Requesting code…", verify);
    }

    void retryCode(android.widget.Button button) {
        long remaining = Math.max(0, resendAt - android.os.SystemClock.elapsedRealtime());
        if (remaining > 0) {
            button.setEnabled(false);
            button.setText(getString(R.string.auth_resend_countdown, (remaining + 999) / 1000));
            handler.postDelayed(() -> {
                if (button.isAttachedToWindow()) retryCode(button);
            }, Math.min(remaining, 1000));
        } else {
            button.setEnabled(true);
            button.setText(R.string.auth_resend);
        }
    }

    private JSONObject googlePending() {
        JSONObject pending = authStorage.read("google");
        if (pending != null && pending.optLong("expiresAt") > System.currentTimeMillis()) return pending;
        if (pending != null) authStorage.clear("google");
        return null;
    }

    void cancelGoogle() {
        googleGeneration++;
        authStorage.clear("google");
        render(false);
        status("Google sign-in cancelled. You can try again.", false);
    }

    void startGoogle() {
        if (mutating) return;
        try {
            if (!GoogleSignIn.ORIGIN.equals(authOrigin(null, false))) {
                statusError("Continue with Google is available at agusai.grindcity.app.");
                return;
            }
        } catch (IllegalArgumentException invalid) {
            statusError(invalid.getMessage());
            return;
        }
        String verifier = GoogleSignIn.verifier();
        int generation = ++googleGeneration;
        mutating = true;
        status("Opening Google sign-in…", false);
        network.execute(() -> {
            try {
                JSONObject body = new JSONObject().put("client", "android").put("challenge", GoogleSignIn.challenge(verifier));
                JSONObject reply = new ApiClient(GoogleSignIn.ORIGIN, null).post("/auth/google/start", body);
                URI browser = URI.create(reply.getString("url"));
                if (!GoogleSignIn.browserUrl(browser)) throw new IOException("Unexpected Google sign-in URL");
                runOnUiThread(() -> {
                    mutating = false;
                    if (isDestroyed() || screen != Screen.AUTH || generation != googleGeneration) return;
                    try {
                        authStorage.write("google", new JSONObject().put("verifier", verifier)
                            .put("expiresAt", System.currentTimeMillis() + GOOGLE_ATTEMPT_MS));
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(browser.toString())).addCategory(Intent.CATEGORY_BROWSABLE));
                        render(false);
                        status("Finish in your browser or cancel here and try again.", false);
                    } catch (ActivityNotFoundException | GeneralSecurityException | JSONException unavailable) {
                        authStorage.clear("google");
                        statusError("Could not open secure Google sign-in. Check that a browser is available and try again.");
                    }
                });
            } catch (IOException | JSONException | IllegalArgumentException failure) {
                runOnUiThread(() -> {
                    if (generation == googleGeneration) authFailed(failure);
                    else mutating = false;
                });
            }
        });
    }

    private void handleGoogleReturn(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) return;
        if (mutating || session != null) return;
        JSONObject pending = googlePending();
        if (pending == null) return;
        String verifier = pending.optString("verifier");
        java.util.regex.Matcher callback;
        try {
            callback = GoogleSignIn.callback(URI.create(intent.getDataString()), verifier);
        } catch (IllegalArgumentException invalid) {
            return;
        }
        if (callback == null || !authStorage.clear("google")) return;
        intent.setData(null);
        navigate(Screen.AUTH, null);
        if (callback.group(2) != null) {
            String message = switch (callback.group(2)) {
                case "google_declined" -> "Google sign-in was cancelled. You can try again.";
                case "registration_required" -> "This server is not accepting new accounts. You can still sign in with an existing account.";
                default -> "Google sign-in is unavailable. Try again or use another method.";
            };
            statusError(message);
            return;
        }
        String code = callback.group(1).substring("authCode=".length());
        int generation = ++googleGeneration;
        mutating = true;
        status("Finishing Google sign-in…", false);
        network.execute(() -> {
            try {
                JSONObject reply = new ApiClient(GoogleSignIn.ORIGIN, null).post("/auth/google/exchange",
                    new JSONObject().put("code", code).put("verifier", verifier));
                Session next = new Session(GoogleSignIn.ORIGIN, reply);
                runOnUiThread(() -> {
                    if (generation == googleGeneration) acceptSession(next);
                    else {
                        mutating = false;
                        if (!isDestroyed()) revoke(next);
                    }
                });
            } catch (IOException | JSONException failure) {
                runOnUiThread(() -> {
                    if (generation == googleGeneration) authFailed(failure);
                    else mutating = false;
                });
            }
        });
    }

    private void authFailed(Exception failure) {
        mutating = false;
        if (!isDestroyed() && screen == Screen.AUTH) statusError(errorMessage(failure));
    }

    private URI authOrigin(EditText field, boolean debug) {
        if (pendingInvitationOrigin != null) return pendingInvitationOrigin;
        String entered = field == null ? preference("control_plane_origin") : field.getText().toString().trim();
        return entered.isEmpty() ? GoogleSignIn.ORIGIN : ApiOrigin.parse(entered, debug);
    }

    private void acceptSession(Session next) {
        mutating = false;
        if (isDestroyed()) return;
        if (screen != Screen.AUTH || !saveSession(next)) {
            revoke(next);
            return;
        }
        authStorage.clear("google");
        session = next;
        remember("control_plane_origin", next.origin.toString());
        navigate(Screen.HOME, null);
        if (pendingInvitationCode != null) reviewCode(pendingInvitationCode);
        authEmail = "";
        emailCodeSent = false;
        authMethod = AuthMethod.CHOICE;
    }

    private boolean saveSession(Session next) {
        try {
            authStorage.write("session", new JSONObject().put("origin", next.origin.toString()).put("response", next.response));
            return true;
        } catch (GeneralSecurityException | JSONException unavailable) {
            authStorage.clear("session");
            statusError("Secure session storage is unavailable. Unlock Android and sign in again.");
            return false;
        }
    }

    private void authRequest(String path, EditText originField, String submittedEmail, String key, String value,
        String progress, boolean createsSession) {
        if (mutating) {
            return;
        }
        URI origin;
        try {
            origin = authOrigin(originField, BuildConfig.DEBUG);
        } catch (IllegalArgumentException invalid) {
            status(invalid.getMessage(), true);
            return;
        }
        String email = submittedEmail.trim();
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            status("Enter a valid email address.", true);
            return;
        }
        if (getCurrentFocus() != null) {
            getSystemService(InputMethodManager.class).hideSoftInputFromWindow(getCurrentFocus().getWindowToken(), 0);
            getCurrentFocus().clearFocus();
        }
        authEmail = email;
        mutating = true;
        status(progress, false);
        network.execute(() -> {
            try {
                JSONObject input = new JSONObject().put("email", email);
                if (key != null) {
                    input.put(key, value);
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
                        emailCodeSent = true;
                        resendAt = android.os.SystemClock.elapsedRealtime() + 1000L * Math.max(1, result.optInt("retryAfterSeconds", 60));
                        statusMessage = "";
                        render(false);
                        status("Check your inbox for a six-digit code.", false);
                        return;
                    }
                    acceptSession(newSession);
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
        boolean inbox = requestedScreen == Screen.INBOX;
        int payoutDays = requestedScreen == Screen.EARNINGS ? earningsDays : requestedScreen == Screen.HOME ? 30 : 0;
        int version = mutationVersion;
        if (userInitiated || snapshot == null) {
            status("Refreshing workspace…", false);
        }
        reads.execute(() -> {
            try {
                ProviderApi.Snapshot next = current.api.load(runId, device, marketplace, payoutDays, inbox);
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
                        || requestedScreen != screen && (screen.isMainTab() || screen == Screen.INBOX)
                        || screen == Screen.EARNINGS && payoutDays != earningsDays) {
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
                Session rotated = new Session(current.origin, result);
                if (!saveSession(rotated)) {
                    signOut(false);
                    revoke(rotated);
                    statusError("Secure session storage is unavailable. Sign in again.");
                    return;
                }
                session = rotated;
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
        authStorage.clear("session");
        authStorage.clear("google");
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
            clearInvitation(pendingInvitationCode);
            authMethod = AuthMethod.CHOICE;
            authEmail = "";
            emailCodeSent = false;
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
        return configured.isEmpty() ? GoogleSignIn.ORIGIN : ApiOrigin.parse(configured, BuildConfig.DEBUG);
    }

    void openPortal(boolean configure) {
        URI portal = portal();
        if (portal != null && !configure) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(portal.resolve("/console.html").toString())));
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

    private void saveInvitation(String code, URI origin) {
        pendingInvitationCode = code;
        pendingInvitationOrigin = origin;
        try {
            authStorage.write("invitation", new JSONObject().put("code", code).put("production", origin != null));
        } catch (GeneralSecurityException | JSONException unavailable) {
            // The current activity can still resume the link after sign-in.
        }
    }

    void reviewCode(String code) {
        if (!code.equals(pendingInvitationCode)) saveInvitation(code, null);
        if (session == null) {
            navigate(Screen.AUTH, null);
            return;
        }
        if (pendingInvitationOrigin != null && !pendingInvitationOrigin.equals(session.origin)) {
            clearInvitation(code);
            statusError("Sign in to agusai.grindcity.app and reopen the invitation.");
            return;
        }
        if (mutating) return;
        perform("Reviewing invitation…", api -> api.post(INVITATIONS + "/review", new JSONObject().put("token", code)),
            result -> {
                clearInvitation(code);
                openInvitation(result.optJSONObject("invitation"));
            }, error -> {
                clearInvitation(code);
                statusError(error);
            }, true);
    }

    private void clearInvitation(String code) {
        if (Objects.equals(pendingInvitationCode, code)) {
            pendingInvitationCode = null;
            pendingInvitationOrigin = null;
            authStorage.clear("invitation");
        }
    }

    void openPublicPage(String path) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(GoogleSignIn.ORIGIN.resolve(path).toString())));
        } catch (ActivityNotFoundException unavailable) {
            statusError("A browser is required to open this page.");
        }
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

    void chooseEarningsPeriod(int days) {
        if (earningsDays == days) return;
        earningsDays = days;
        refresh(true);
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

    void openWorkRuntime() {
        Intent launch = getPackageManager().getLaunchIntentForPackage("app.agus.runtime.preview");
        if (launch != null) startActivity(launch);
        else statusError("Install the Work Runtime preview on a disposable test device to use phone-native testing.");
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
        final JSONObject response;
        final ProviderApi api;
        final String email;
        final long expiresAt;
        long lastRefreshAttempt;

        Session(URI origin, JSONObject response) throws JSONException {
            this.origin = origin;
            this.response = response;
            this.api = new ProviderApi(new ApiClient(origin, response.getString("token")));
            this.email = response.getJSONObject("user").getString("email");
            long expiry;
            try {
                expiry = Instant.parse(response.optString("expiresAt")).toEpochMilli();
            } catch (DateTimeParseException invalid) {
                throw new JSONException("Invalid session expiration");
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
        final URI pendingInvitationOrigin;
        final JSONObject selectedInvitation;
        final JSONObject selectedOffer;
        final String selectedOfferDeviceId;
        final ProviderApi.Snapshot snapshot;
        final AuthMethod authMethod;
        final String authEmail;
        final boolean emailCodeSent;
        final long resendAt;
        final int activitySection;
        final int earningsDays;

        Retained(MainActivity activity) {
            session = activity.session;
            screen = activity.screen;
            mainTab = activity.mainTab;
            selectedId = activity.selectedId;
            selectedDevice = activity.selectedDevice;
            pendingInvitationCode = activity.pendingInvitationCode;
            pendingInvitationOrigin = activity.pendingInvitationOrigin;
            selectedInvitation = activity.selectedInvitation;
            selectedOffer = activity.selectedOffer;
            selectedOfferDeviceId = activity.selectedOfferDeviceId;
            snapshot = activity.snapshot;
            authMethod = activity.authMethod;
            authEmail = activity.authEmail;
            emailCodeSent = activity.emailCodeSent;
            resendAt = activity.resendAt;
            activitySection = activity.activitySection;
            earningsDays = activity.earningsDays;
        }
    }
}
