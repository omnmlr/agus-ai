package app.agus.runtime.preview;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.UserManager;
import android.provider.Settings;
import android.text.InputType;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.TextView;
import android.view.WindowManager;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class RuntimeActivity extends Activity {
    private static final int PROVISION = 10;
    private static final int FIXTURE = 11;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LinearLayout layout;
    private LinearLayout screenRoot;
    private TextView message;
    private String person;
    private String personId;
    private String windowId;
    private long windowEnd;
    private boolean busy;
    private boolean platformUi;
    private boolean fixtureUi;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        render();
        if (ProfileAdmin.ownsProfile(this) && RuntimeState.live == null
            && RuntimeState.prefs(this).getString("pendingLease", null) != null) {
            try {
                RuntimeState.recover(this);
                render();
                status("Interrupted test. Complete Android cleanup before requesting work.");
            } catch (Exception failure) { status("Recovery is blocked. Remove only the disposable work profile or contact the pilot operator."); }
        }
    }

    private void render() {
        screenRoot = new LinearLayout(this);
        screenRoot.setOrientation(LinearLayout.VERTICAL);
        var scroll = new ScrollView(this);
        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(24, 28, 24, 24);
        scroll.addView(layout);
        screenRoot.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(screenRoot);
        label("AGUS Phone Preview");
        message = label("");
        if (Build.VERSION.SDK_INT != 35 || !"ranchu".equals(Build.HARDWARE)
            || !Build.FINGERPRINT.startsWith("Android/sdk_phone64_x86_64/")) {
            label("This build is restricted to the disposable AOSP Android 15 preview image.");
            return;
        }
        if (!ProfileAdmin.ownsProfile(this)) {
            label("Local test environment. Use a disposable device and credentials.");
            button("Set up test work profile", this::provision);
            return;
        }
        if (RuntimeState.live != null) {
            var work = RuntimeState.live;
            label(work.stopped ? "Cleanup pending" : "Authorized test session");
            button("Stop test now", () -> { work.stop(); render(); status("Stopped locally. Complete Android cleanup."); });
            if (!work.stopped) {
                button("Allow Android installation source", this::openInstallerSource);
                button("Stage reviewed APK", () -> run(() -> {
                    RuntimeState.install(this, work); return "Queued for Android approval";
                }));
                button("Launch reviewed fixture", () -> launchFixture(work));
            }
            button("Review Android confirmation", this::confirmPackageOperation);
            button("Remove fixture", () -> {
                work.stop();
                RuntimeState.requestRemoval(this);
                render();
            });
            button("Confirm clean profile", () -> run(() -> {
                work.stop();
                work.acknowledge();
                mark("PROFILE_CLEANED");
                runOnUiThread(() -> { stopService(new Intent(this, RuntimeWatchdog.class)); render(); });
                return "Cleanup confirmed by AGUS.";
            }));
            return;
        }
        if (person == null) {
            EditText email = input("Preview account email", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
            EditText password = input("Preview password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            button("Sign in to AGUS", () -> {
                String account = email.getText().toString().trim();
                String secret = password.getText().toString();
                run(() -> {
                    var result = PilotApi.request("POST", "/auth/login", null,
                        new JSONObject().put("email", account).put("password", secret));
                    String identifier = result.getJSONObject("user").getString("id");
                    if (!RuntimeState.prefs(this).getString("personId", identifier).equals(identifier)) {
                        throw new SecurityException("Sign in as this profile’s enrolled preview account.");
                    }
                    person = result.getString("token");
                    personId = identifier;
                    runOnUiThread(this::render);
                    mark("PROFILE_PERSON_AUTHENTICATED");
                    return "Signed in.";
                });
            });
        } else {
            if (!RuntimeState.prefs(this).contains("installation")) {
                button("Enroll this phone for human testing", () -> enroll("phone_human"));
                button("Enroll this phone for cooperative testing", () -> enroll("phone_cooperative"));
            } else {
                label(RuntimeState.prefs(this).getString("runtimeClass", ""));
                button("Enable stop notification", () -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 12));
                button("Open foreground window", this::openWindow);
                button("Show my assignments", this::assignments);
                button("Qualification exercise", this::qualification);
                button("Campaign earnings", () -> run(() -> {
                    var earnings = PilotApi.request("GET", "/me/campaign-earnings", person, null).getJSONObject("earnings");
                    return earnings.getLong("testUnits") + " nontransferable test units. Payment is unavailable in the preview.";
                }));
                button("Revoke installation", () -> new AlertDialog.Builder(this).setTitle("Revoke this installation?")
                    .setNegativeButton("Back", null).setPositiveButton("Revoke", (dialog, which) -> revoke()).show());
            }
        }
        button("Remove test work profile", () -> new AlertDialog.Builder(this).setTitle("Remove the entire test profile?")
            .setMessage("Android removes the apps and data in this work profile.")
            .setNegativeButton("Back", null).setPositiveButton("Remove profile", (dialog, which) ->
                getSystemService(DevicePolicyManager.class).wipeData(0)).show());
    }

    private void provision() {
        if (getSystemService(UserManager.class).isManagedProfile()
            || getSystemService(UserManager.class).getUserProfiles().size() != 1) {
            status("An existing profile is present. Setup cannot continue.");
            return;
        }
        String action = DevicePolicyManager.ACTION_PROVISION_MANAGED_PROFILE;
        if (!getSystemService(DevicePolicyManager.class).isProvisioningAllowed(action)) {
            status("Android work-profile setup is unavailable.");
            return;
        }
        startActivityForResult(new Intent(action).putExtra(DevicePolicyManager.EXTRA_PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME,
            ProfileAdmin.component(this)), PROVISION);
    }

    private void enroll(String kind) {
        run(() -> {
            ProfileAdmin.requireProfile(this);
            JSONObject begin = new JSONObject().put("runtimeClass", kind).put("appVersion", "phone-preview-1")
                .put("policyVersion", "managed-profile-v1");
            JSONObject enrollment = PilotApi.request("POST", "/me/runtime-enrollments", person, begin).getJSONObject("enrollment");
            JSONObject body = new JSONObject().put("publicKey", PilotApi.publicKey())
                .put("proof", PilotApi.sign(enrollment.getJSONObject("binding")));
            JSONObject result = PilotApi.request("POST", "/me/runtime-enrollments/" + enrollment.getString("id") + "/complete", person, body);
            if (!RuntimeState.prefs(this).edit().putString("installation", result.getJSONObject("installation").getString("id"))
                .putString("credential", result.getString("credential")).putString("runtimeClass", kind)
                .putString("personId", personId).putLong("sequence", 0).commit())
                throw new IllegalStateException("Local enrollment could not be saved");
            mark("PROFILE_RUNTIME_ENROLLED");
            runOnUiThread(this::render);
            return "Installation enrolled.";
        });
    }

    private void revoke() {
        run(() -> {
            var preferences = RuntimeState.prefs(this);
            PilotApi.request("DELETE", "/me/runtime-installations/" + preferences.getString("installation", ""), person, null);
            preferences.edit().remove("installation").remove("runtimeClass").remove("credential").remove("sequence").remove("personId").commit();
            windowId = null;
            runOnUiThread(this::render);
            return "Installation revoked. Remove the test profile before setting up another device.";
        });
    }

    private void openWindow() {
        if (!RuntimeState.locallySafe(this)) { status("Device policy, power, storage or thermal checks failed."); return; }
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            status("Enable the Stop notification to open a testing window.");
            return;
        }
        windowId = UUID.randomUUID().toString();
        windowEnd = SystemClock.elapsedRealtime() + 600_000;
        run(() -> {
            RuntimeState.heartbeat(this, windowId, windowEnd);
            mark("PROFILE_WINDOW_OPEN");
            return "Foreground participation window opened for up to ten minutes.";
        });
    }

    private void assignments() {
        run(() -> {
            if (windowId != null && windowEnd > SystemClock.elapsedRealtime()) RuntimeState.heartbeat(this, windowId, windowEnd);
            var rows = PilotApi.request("GET", "/me/assignments", person, null).getJSONArray("assignments");
            runOnUiThread(() -> assignmentList(rows));
            return rows.length() == 0 ? "No eligible assignments are available." : "Select an assignment to review its terms.";
        });
    }

    private void assignmentList(JSONArray rows) {
        render();
        for (int index = 0; index < rows.length(); index++) {
            JSONObject item = rows.optJSONObject(index);
            if (item == null) continue;
            var task = item.optJSONObject("task");
            label(task.optString("title") + " · " + item.optString("state"));
            if ("open".equals(item.optString("state"))) {
                label(task.optString("instructions"));
                if ("human_demonstration".equals(task.optString("kind"))) {
                    label("This task records the fixture’s named actions and relative times as structured evidence.");
                }
                label(task.optString("packageName") + "\n" + task.optString("buildSha256"));
                label(task.optInt("testUnits") + " nontransferable test units · structured evidence only");
                String installationId = RuntimeState.prefs(this).getString("installation", "");
                var eligible = item.optJSONArray("eligibleInstallationIds");
                boolean canAccept = false;
                if (eligible != null) for (int slot = 0; slot < eligible.length(); slot++) {
                    if (installationId.equals(eligible.optString(slot))) canAccept = true;
                }
                if (!canAccept) label("Open a compatible foreground testing window to accept this assignment.");
                if (canAccept) button("Accept reviewed assignment", () -> new AlertDialog.Builder(this).setTitle("Authorize this foreground test?")
                    .setMessage("Install only the reviewed fixture in this work profile. Android will ask for package approval.")
                    .setNegativeButton("Back", null).setPositiveButton("Authorize", (dialog, button) -> accept(item)).show());
                button("Decline assignment", () -> run(() -> {
                    PilotApi.request("POST", "/me/assignments/" + item.optString("id") + "/decline", person, new JSONObject());
                    runOnUiThread(this::render);
                    return "Offer declined.";
                }));
            } else if (java.util.List.of("awaiting_submission", "needs_revision").contains(item.optString("state"))) {
                button("Prepare structured submission", () -> submission(item));
            }
            var attempt = item.optJSONObject("attempt");
            if (attempt != null && item.optJSONObject("terms").optBoolean("trainingEligible")) {
                button("Training consent", () -> training(item));
            }
            if (attempt != null && attempt.optJSONObject("review") != null) {
                label(attempt.optJSONObject("review").optString("reason"));
            }
        }
    }

    private void accept(JSONObject offer) {
        if (!hasWindow() || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            status("Open a foreground window with Stop notifications first.");
            return;
        }
        run(() -> {
            if (!RuntimeState.absent(this)) throw new SecurityException("An existing fixture requires operator cleanup.");
            RuntimeState.heartbeat(this, windowId, windowEnd);
            String installation = RuntimeState.prefs(this).getString("installation", null);
            String offerId = offer.getString("id");
            PilotApi.request("POST", "/me/assignments/" + offerId + "/accept", person, new JSONObject()
                .put("termsDigest", offer.getString("termsDigest")).put("installationId", installation).put("consent", true));
            long sentAt = SystemClock.elapsedRealtime();
            var grant = PilotApi.request("POST", "/runtime/installations/" + installation + "/claim",
                RuntimeState.prefs(this).getString("credential", null), new JSONObject().put("assignmentId", offerId)).getJSONObject("lease");
            var work = new RuntimeState.Session(this, grant, windowId, windowEnd, sentAt);
            work.requireLive();
            if (!RuntimeState.prefs(this).edit().putString("pendingLease", grant.toString()).commit()) {
                throw new IllegalStateException("One-time grant could not be saved");
            }
            RuntimeState.live = work;
            runOnUiThread(() -> {
                try {
                    startForegroundService(new Intent(this, RuntimeWatchdog.class));
                    render();
                    status("Claim verified. Approve Android installation.");
                    mark("PROFILE_LEASE_CLAIMED");
                } catch (RuntimeException denied) {
                    work.stop();
                    render();
                    status("Stop notification unavailable. Finish cleanup to continue.");
                }
            });
            return null;
        });
    }

    private boolean hasWindow() { return windowId != null && SystemClock.elapsedRealtime() < windowEnd; }

    private void openInstallerSource() {
        RuntimeState.live.requireLive();
        ProfileAdmin.restrictInstalls(this, false);
        if (!getPackageManager().canRequestPackageInstalls()) {
            platformUi = true;
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
        } else status("Android source is authorized for this operation.");
    }

    private void confirmPackageOperation() {
        var confirmation = PackageResult.confirmation;
        if (confirmation == null) { status("Android has no pending confirmation."); return; }
        PackageResult.confirmation = null;
        platformUi = true;
        startActivity(confirmation);
    }

    private void launchFixture(RuntimeState.Session work) throws Exception {
        work.requireLive();
        if (RuntimeState.absent(this) || !ProfileAdmin.installRestricted(this)
            || RuntimeState.prefs(this).getBoolean("packagePending", false)) throw new SecurityException("Finish Android installation first");
        var info = getPackageManager().getPackageInfo(RuntimeState.FIXTURE, PackageManager.GET_SIGNING_CERTIFICATES);
        var signer = info.signingInfo.getApkContentsSigners();
        if (signer.length != 1 || !work.manifest.document.getJSONObject("build").getString("signerSha256")
            .equals(app.agus.cooperative.Workload.sha256(signer[0].toByteArray()))) throw new SecurityException("Installed signer changed");
        fixtureUi = true;
        startActivityForResult(new Intent().setComponent(new ComponentName(RuntimeState.FIXTURE, RuntimeState.COMPONENT))
            .putExtra("manifest", work.grant.getJSONObject("manifest").toString()).putExtra("deadline", work.expiry), FIXTURE);
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != FIXTURE) return;
        fixtureUi = false;
        var work = RuntimeState.live;
        if (work == null) return;
        if (result != RESULT_OK || data == null || !work.eligible()) {
            work.stop();
            render();
            status("Test stopped. Remove the fixture to complete cleanup.");
            return;
        }
        run(() -> {
            try {
                work.report(new JSONArray(data.getStringExtra("observations")));
                mark("PROFILE_REPORT_VERIFIED");
                return "Evidence saved. Remove fixture and confirm cleanup.";
            } finally {
                work.stop();
                runOnUiThread(this::render);
            }
        });
    }

    @Override protected void onResume() { super.onResume(); platformUi = false; }

    @Override protected void onStop() {
        super.onStop();
        if (!platformUi && !fixtureUi && RuntimeState.live != null) RuntimeState.live.stop();
    }

    private void qualification() {
        run(() -> {
            var current = PilotApi.request("GET", "/me/qualifications", person, null);
            runOnUiThread(() -> {
                render();
                var exercise = current.optJSONObject("exercise");
                label(exercise.optString("reproduction"));
                EditText order = input("Action sequence, comma separated", InputType.TYPE_CLASS_TEXT);
                Spinner expected = choices("single_continue", "no_action", "multiple_continue");
                Spinner actual = choices("single_continue", "no_action", "multiple_continue");
                label(exercise.optString("wallet"));
                Spinner wallet = choices("skip", "wallet_callback", "screen_message", "finalized_effects");
                EditText finding = input("Redacted evidence note", InputType.TYPE_CLASS_TEXT);
                button("Submit qualification", () -> {
                    JSONObject answer = new JSONObject().put("sequence", new JSONArray(java.util.Arrays.asList(order.getText().toString().trim().split("[, ]+"))))
                        .put("expectedCode", expected.getSelectedItem()).put("actualCode", actual.getSelectedItem())
                        .put("walletAnswer", wallet.getSelectedItem()).put("evidenceNote", finding.getText().toString());
                    run(() -> PilotApi.request("POST", "/me/qualifications/" + exercise.optString("version") + "/submissions",
                        person, answer).getJSONObject("current").getString("feedback"));
                });
            });
            return null;
        });
    }

    private void training(JSONObject item) {
        run(() -> {
            String path = "/me/assignments/" + item.getString("id") + "/training-consent";
            var consent = PilotApi.request("GET", path, person, null);
            runOnUiThread(() -> new AlertDialog.Builder(this).setTitle("Separate training-data permission")
                .setMessage("AGUS can deliver redacted, accepted evidence only while both grants are current. " +
                    (consent.isNull("contributorGrantedAt") ? "You have no active training grant." : "You have an active training grant."))
                .setNegativeButton("Back", null).setNeutralButton("Withdraw", (dialog, which) -> run(() -> {
                    PilotApi.request("DELETE", path, person, null);
                    return "Training consent withdrawn for future deliveries.";
                })).setPositiveButton("Grant", (dialog, which) -> run(() -> {
                    PilotApi.request("PUT", path, person, new JSONObject().put("termsDigest", item.getString("termsDigest")).put("grant", true));
                    return "Training grant recorded. Testing permission is unchanged.";
                })).show());
            return null;
        });
    }

    private void submission(JSONObject assignment) {
        render();
        label("Confirm that your report contains only the reviewed test fixture and disposable data.");
        EditText steps = input("Reproduction steps, one per line", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        EditText expected = input("Expected outcome", InputType.TYPE_CLASS_TEXT);
        EditText actual = input("Actual outcome", InputType.TYPE_CLASS_TEXT);
        boolean autonomous = "phone_cooperative".equals(assignment.optJSONObject("task").optString("runtimeClass"));
        Spinner result = autonomous ? choices("passed", "failed", "blocked") : choices("failed", "passed", "blocked");
        boolean correction = "agent_correction".equals(assignment.optJSONObject("task").optString("kind"));
        Spinner category = correction ? choices("agent_correction") : choices("bug", "usability", "validation");
        EditText actionIndex = correction ? input("Recorded action index starting at zero", InputType.TYPE_CLASS_NUMBER) : null;
        Spinner alternative = correction ? choices("launch", "describe", "tap", "wait", "finish") : null;
        var reference = assignment.optJSONArray("referenceActions");
        if (correction && reference != null) for (int index = 0; index < reference.length(); index++) {
            var action = reference.optJSONObject(index);
            label(index + " · " + action.optString("type") + " · " + action.optString("status"));
        }
        var attempt = assignment.optJSONObject("attempt");
        var review = makeButton("Review submission", () -> {
            JSONObject body = new JSONObject().put("attemptId", attempt.optString("id"))
                .put("expectedVersion", attempt.optJSONArray("submissions").length())
                .put("steps", new JSONArray(java.util.Arrays.asList(steps.getText().toString().split("\\n"))))
                .put("expected", expected.getText().toString()).put("actual", actual.getText().toString())
                .put("result", result.getSelectedItem()).put("category", category.getSelectedItem());
            if (correction) {
                int index = Integer.parseInt(actionIndex.getText().toString());
                body.put("correction", new JSONObject().put("actionIndex", index)
                    .put("actualAction", reference.getJSONObject(index).getString("type")).put("suggestedAction", alternative.getSelectedItem()));
            }
            new AlertDialog.Builder(this).setTitle("Send this test report?")
                .setMessage(body.getJSONArray("steps") + "\nExpected: " + body.getString("expected") + "\nActual: " + body.getString("actual"))
                .setNegativeButton("Back", null).setPositiveButton("Send report", (dialog, button) -> run(() -> {
                    PilotApi.request("POST", "/assignments/" + assignment.optString("id") + "/submissions", person, body);
                    runOnUiThread(this::render);
                    mark("PERSON_SUBMISSION_SAVED");
                    return "Submission ready for developer review.";
                })).show();
        });
        screenRoot.addView(review, 0);
    }

    private Spinner choices(String... values) {
        var field = new Spinner(this);
        field.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, values));
        layout.addView(field);
        return field;
    }

    private EditText input(String hint, int type) {
        var field = new EditText(this);
        field.setHint(hint);
        field.setInputType(type);
        layout.addView(field);
        return field;
    }

    private TextView label(String text) {
        var value = new TextView(this);
        value.setText(text);
        layout.addView(value);
        return value;
    }

    private void button(String label, Click action) { layout.addView(makeButton(label, action)); }

    private Button makeButton(String label, Click action) {
        var button = new Button(this);
        button.setAllCaps(false);
        button.setText(label);
        button.setOnClickListener(view -> {
            if (busy) return;
            try { action.run(); }
            catch (Exception failure) { status(failure.getMessage()); }
        });
        return button;
    }

    private void status(String detail) { message.setText(detail == null ? "Action unavailable." : detail); }
    private void run(Operation action) {
        busy = true;
        worker.execute(() -> {
            String result;
            try { result = action.run(); }
            catch (Exception failure) { result = failure.getMessage(); }
            String detail = result;
            runOnUiThread(() -> {
                busy = false;
                if (detail != null) status(detail);
            });
        });
    }

    private static void mark(String value) { Log.i("AgusPreview", value); }
    interface Click { void run() throws Exception; }
    interface Operation { String run() throws Exception; }

    @Override protected void onDestroy() {
        worker.shutdownNow();
        super.onDestroy();
    }
}
