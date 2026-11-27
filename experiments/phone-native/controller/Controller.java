package app.agus.phase1;

import android.app.Activity;
import android.app.PendingIntent;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.PackageInstaller;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.UserManager;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Log;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.Signature;
import java.util.UUID;
import org.json.JSONObject;

public class Controller extends Activity {
    private static final String FIXTURE = "app.agus.phase1.fixture";
    private static final String UNTRUSTED = "app.agus.phase1.untrusted";
    private static final String ALIAS = "phase1-evidence";
    private LinearLayout layout;
    private TextView status;
    private long deadline;
    private String nonce;
    private static final String BACKEND = "http://10.0.2.2:18765";

    static void mark(String message) { Log.i("AgusPhase1", message); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(24, 24, 24, 24);
        status = new TextView(this);
        layout.addView(status);
        setContentView(layout);
        if (isProfileOwner()) {
            say("Managed testing profile");
            add("Enroll disposable AGUS account", this::connect);
            add("Install reviewed fixture", this::install);
            add("Review Android package operation", () -> {
                Intent confirmation = InstallResult.pendingConfirmation;
                InstallResult.pendingConfirmation = null;
                if (confirmation != null) startActivity(confirmation);
            });
            add("Run bounded fixture", this::runFixture);
            add("Emergency stop and remove fixture", () -> cleanup(true));
            add("Remove testing profile", this::removeProfile);
        } else if (getSystemService(UserManager.class).isManagedProfile()) {
            say("Missing profile owner");
        } else {
            say("Personal setup");
            add("Create testing profile", this::provision);
            add("Personal fixture presence check", () -> say(installed(FIXTURE)
                    ? "PERSONAL_FIXTURE_PRESENT" : "PERSONAL_FIXTURE_ABSENT"));
        }
    }

    private void add(String name, Runnable action) {
        Button button = new Button(this);
        button.setText(name);
        button.setAllCaps(false);
        button.setOnClickListener(view -> {
            try { action.run(); }
            catch (Exception error) { say("ERROR_" + error.getClass().getSimpleName()); }
        });
        layout.addView(button);
    }

    private void say(String message) {
        status.setText(message);
        mark(message);
    }

    private boolean isProfileOwner() {
        return getSystemService(UserManager.class).isManagedProfile()
                && getSystemService(DevicePolicyManager.class).isProfileOwnerApp(getPackageName());
    }

    private void provision() {
        getSharedPreferences("phase1", 0).edit().putBoolean("personalCanary", true).commit();
        try (var cursor = getContentResolver().query(
                android.net.Uri.parse("content://app.agus.phase1.canary/fixture"), null, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst() || !"SYNTHETIC_PARENT_ONLY".equals(cursor.getString(0))) {
                throw new IllegalStateException("Positive control unavailable");
            }
            mark("PARENT_CANARY_POSITIVE_CONTROL");
        }
        DevicePolicyManager policy = getSystemService(DevicePolicyManager.class);
        String action = DevicePolicyManager.ACTION_PROVISION_MANAGED_PROFILE;
        if (!policy.isProvisioningAllowed(action)) {
            say("PROVISIONING_UNAVAILABLE");
            return;
        }
        startActivity(new Intent(action).putExtra(
                DevicePolicyManager.EXTRA_PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME, Admin.component(this)));
        mark("PROVISIONING_REQUESTED");
    }

    private void connect() {
        new Thread(() -> {
            boolean ok = false;
            try {
                String email = "phase1-" + UUID.randomUUID() + "@example.invalid";
                JSONObject registration = new JSONObject().put("email", email)
                        .put("password", UUID.randomUUID().toString());
                String token = request("/auth/register", null, registration).getString("token");
                ok = request("/auth/me", token, null).getJSONObject("user").getString("email").equals(email);
            } catch (Exception error) {
                mark("BACKEND_ERROR_" + error.getClass().getSimpleName());
            }
            boolean accepted = ok;
            runOnUiThread(() -> say(accepted ? "BACKEND_REGISTER_AND_AUTH_ME_OK" : "BACKEND_AUTH_FAILED"));
        }).start();
    }

    private JSONObject request(String path, String token, JSONObject input) throws Exception {
        // Emulator host loopback and disposable credentials only.
        HttpURLConnection connection = (HttpURLConnection) new URL(BACKEND + "/api/v1" + path).openConnection();
        connection.setConnectTimeout(6000);
        connection.setReadTimeout(6000);
        connection.setInstanceFollowRedirects(false);
        try {
            if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
            if (input != null) {
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (var output = connection.getOutputStream()) {
                    output.write(input.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            try (var body = connection.getInputStream()) {
                return new JSONObject(new String(body.readNBytes(8192), StandardCharsets.UTF_8));
            }
        } finally { connection.disconnect(); }
    }

    private boolean installed(String name) {
        try { getPackageManager().getPackageInfo(name, 0); return true; }
        catch (android.content.pm.PackageManager.NameNotFoundException missing) { return false; }
    }

    private IntentSender callback(String operation, int code) {
        return PendingIntent.getBroadcast(this, code,
                new Intent(this, InstallResult.class).setAction(operation),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE).getIntentSender();
    }

    private void install() {
        if (!isProfileOwner()) throw new SecurityException();
        try (var fixture = getAssets().open("fixture.apk");
             var untrusted = getAssets().open("untrusted.apk")) {
            stage(untrusted.readAllBytes(), UNTRUSTED, "UNTRUSTED_INSTALL", 3);
            stage(fixture.readAllBytes(), FIXTURE, "FIXTURE_INSTALL", 1);
        } catch (Exception error) { throw new IllegalStateException(error); }
    }

    private void stage(byte[] bytes, String packageName, String marker, int code) throws Exception {
        String digest = java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        if (!digest.equals(Pins.FIXTURE_SHA256) || !packageName.equals(FIXTURE)) {
            say("ARTIFACT_REJECTED");
            return;
        }
        PackageInstaller installer = getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(packageName);
        int id = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (var stream = session.openWrite("base.apk", 0, bytes.length)) {
                stream.write(bytes);
                session.fsync(stream);
            }
            session.commit(callback(marker, code));
        } catch (Exception error) {
            installer.abandonSession(id);
            throw error;
        }
    }

    private void runFixture() {
        if (!isProfileOwner() || !installed(FIXTURE) || installed(UNTRUSTED))
            throw new IllegalStateException();
        nonce = UUID.randomUUID().toString();
        deadline = SystemClock.elapsedRealtime() + 90_000;
        Intent intent = new Intent().setComponent(new ComponentName(FIXTURE, FIXTURE + ".Fixture"))
                .putExtra("action", "advance").putExtra("nonce", nonce).putExtra("deadline", deadline);
        startActivityForResult(intent, 11);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != 11) return;
        String current = nonce;
        nonce = null;
        if (resultCode != RESULT_OK || data == null || current == null
                || !current.equals(data.getStringExtra("nonce")) || SystemClock.elapsedRealtime() > deadline) {
            say("FIXTURE_CANCELLED");
            cleanup(true);
            return;
        }
        String label = data.getStringExtra("label");
        String probe = data.getStringExtra("probe");
        if ((!"clear".equals(label) && !"confusing".equals(label)) || !"blocked".equals(probe)) {
            say("FIXTURE_RESULT_REJECTED");
            cleanup(true);
            return;
        }
        try {
            byte[] evidence = new JSONObject().put("nonce", current).put("action", "advance")
                    .put("label", label).put("parentCanary", probe).put("fixtureSha256", Pins.FIXTURE_SHA256)
                    .toString().getBytes(StandardCharsets.UTF_8);
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (!store.containsAlias(ALIAS)) {
                KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
                generator.initialize(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN
                        | KeyProperties.PURPOSE_VERIFY).setDigests(KeyProperties.DIGEST_SHA256).build());
                generator.generateKeyPair();
            }
            KeyPair key = new KeyPair(store.getCertificate(ALIAS).getPublicKey(),
                    (java.security.PrivateKey) store.getKey(ALIAS, null));
            Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(key.getPrivate());
            signature.update(evidence);
            byte[] bytes = signature.sign();
            signature.initVerify(key.getPublic());
            signature.update(evidence);
            if (!signature.verify(bytes)) throw new IllegalStateException("Signature verification failed");
            say("FIXTURE_EVIDENCE_VERIFIED_" + label.toUpperCase(java.util.Locale.ROOT));
            cleanup(false);
        } catch (Exception error) {
            say("EVIDENCE_ERROR_" + error.getClass().getSimpleName());
            cleanup(true);
        }
    }

    private void cleanup(boolean emergency) {
        if (!isProfileOwner()) throw new SecurityException();
        nonce = null;
        if (emergency) mark("EMERGENCY_STOP_LOCAL");
        if (installed(FIXTURE)) {
            DevicePolicyManager policy = getSystemService(DevicePolicyManager.class);
            if (policy.setPackagesSuspended(Admin.component(this), new String[]{FIXTURE}, true).length != 0) {
                mark("FIXTURE_SUSPENSION_FAILED");
            }
            getPackageManager().getPackageInstaller().uninstall(FIXTURE, callback("FIXTURE_REMOVE", 2));
        }
    }

    private void removeProfile() {
        if (!isProfileOwner()) throw new SecurityException();
        mark("PROFILE_REMOVAL_REQUESTED");
        getSystemService(DevicePolicyManager.class).wipeData(0);
    }
}
