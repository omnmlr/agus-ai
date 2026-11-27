package app.agus.runtime.preview;

import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.app.admin.DevicePolicyManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import app.agus.cooperative.Workload;
import java.io.File;
import java.nio.file.Files;
import org.json.JSONArray;
import org.json.JSONObject;

final class RuntimeState {
    private static final Object STORAGE = new Object();
    private static final String KEY = "runtime";
    static volatile Session live;

    private RuntimeState() {}

    static SharedPreferences prefs(Context context) { return context.getSharedPreferences(KEY, Context.MODE_PRIVATE); }

    static JSONObject policy(Context context, boolean foreground) throws Exception {
        var power = context.getSystemService(PowerManager.class);
        var battery = context.getSystemService(BatteryManager.class);
        var keyguard = context.getSystemService(KeyguardManager.class);
        String abi = Build.SUPPORTED_ABIS[0];
        return new JSONObject().put("managed", ProfileAdmin.ownsProfile(context)).put("profileOwner", ProfileAdmin.ownsProfile(context))
            .put("crossProfileCopyBlocked", ProfileAdmin.sharingRestricted(context)).put("installerRestricted", ProfileAdmin.installRestricted(context))
            .put("unlocked", !keyguard.isDeviceLocked() && power.isInteractive()).put("foreground", foreground)
            .put("apiLevel", Build.VERSION.SDK_INT).put("charging", battery.isCharging())
            .put("batteryPercent", Math.max(0, battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)))
            .put("availableStorageMiB", context.getFilesDir().getUsableSpace() / (1024 * 1024))
            .put("thermalStatus", power.getCurrentThermalStatus())
            .put("abi", "arm64-v8a".equals(abi) || "x86_64".equals(abi) ? abi : "other");
    }

    static boolean locallySafe(Context context) {
        try {
            JSONObject snapshot = policy(context, true);
            return snapshot.optBoolean("managed") && snapshot.optBoolean("crossProfileCopyBlocked")
                && snapshot.optBoolean("unlocked") && snapshot.optInt("batteryPercent") >= 25
                && snapshot.optLong("availableStorageMiB") >= 200 && snapshot.optInt("thermalStatus") <= 2;
        } catch (Exception unavailable) { return false; }
    }

    static void heartbeat(Context context, String windowId, long windowEnd) throws Exception {
        SharedPreferences preferences = prefs(context);
        String installation = preferences.getString("installation", null);
        long sequence;
        synchronized (STORAGE) {
            sequence = preferences.getLong("sequence", 0) + 1;
            if (!preferences.edit().putLong("sequence", sequence).commit()) throw new IllegalStateException("State unavailable");
        }
        long seconds = Math.max(0, (windowEnd - SystemClock.elapsedRealtime()) / 1000);
        JSONObject snapshot = policy(context, seconds > 0);
        if (windowId.equals(preferences.getString("sampleWindow", ""))) {
            snapshot.put("networkLatencyMs", preferences.getLong("networkLatencyMs", 0));
        }
        var values = new JSONObject().put("v", 1).put("kind", "heartbeat").put("installationId", installation)
            .put("sequence", sequence).put("windowId", windowId).put("windowSeconds", seconds)
            .put("policy", snapshot);
        long start = SystemClock.elapsedRealtime();
        PilotApi.request("POST", "/runtime/installations/" + installation + "/heartbeat",
            preferences.getString("credential", null), PilotApi.sign(values));
        preferences.edit().putString("sampleWindow", windowId)
            .putLong("networkLatencyMs", Math.min(60_000, SystemClock.elapsedRealtime() - start)).apply();
    }

    static Session recover(Context context) throws Exception {
        var record = prefs(context).getString("pendingLease", null);
        if (record == null) return null;
        Session work = new Session(context, new JSONObject(record), null, 0, 0);
        work.stop();
        live = work;
        return work;
    }

    static boolean absent(Context context, String packageName) {
        try { context.getPackageManager().getPackageInfo(packageName, 0); return false; }
        catch (PackageManager.NameNotFoundException absent) { return true; }
    }

    private static boolean signerMatches(PackageInfo info, Session work) {
        try {
            return info != null && info.signingInfo != null && !info.signingInfo.hasMultipleSigners()
                && info.signingInfo.getApkContentsSigners().length == 1
                && Workload.sha256(info.signingInfo.getApkContentsSigners()[0].toByteArray()).equals(work.signerSha256);
        } catch (Exception unavailable) { return false; }
    }

    static boolean installedSignerMatches(Context context, Session work) {
        try {
            return signerMatches(context.getPackageManager().getPackageInfo(work.packageName, PackageManager.GET_SIGNING_CERTIFICATES), work);
        } catch (PackageManager.NameNotFoundException absent) { return false; }
    }

    private static void validateApk(Context context, File apk, Session work) throws Exception {
        PackageInfo info = context.getPackageManager().getPackageArchiveInfo(apk.getPath(),
            PackageManager.GET_SIGNING_CERTIFICATES | PackageManager.GET_PERMISSIONS | PackageManager.GET_ACTIVITIES
                | PackageManager.GET_SERVICES | PackageManager.GET_RECEIVERS | PackageManager.GET_PROVIDERS | PackageManager.GET_INSTRUMENTATION);
        if (!signerMatches(info, work)) {
            Log.i("AgusPreview", "PROFILE_SIGNER_REJECTED");
            throw new SecurityException("APK does not match the reviewed signer");
        }
        if (!work.packageName.equals(info.packageName)
            || info.applicationInfo == null || (info.applicationInfo.flags & (ApplicationInfo.FLAG_DEBUGGABLE | ApplicationInfo.FLAG_ALLOW_BACKUP)) != 0
            || (info.requestedPermissions != null && info.requestedPermissions.length != 0)
            || info.activities == null || info.activities.length != 1 || !work.component.equals(info.activities[0].name) || !info.activities[0].exported
            || !"app.agus.runtime.preview.TEST".equals(info.activities[0].permission)
            || info.services != null || info.receivers != null || info.providers != null || info.instrumentation != null)
            throw new SecurityException("APK does not match the reviewed signer and offline workload policy");
    }

    static void install(Context context, Session work) throws Exception {
        try {
            stagePackage(context, work);
        } finally {
            if (!prefs(context).getBoolean("packagePending", false)) {
                ProfileAdmin.restrictInstalls(context, true);
                if (!ProfileAdmin.installRestricted(context)) throw new SecurityException("Could not restore profile install policy");
                Log.i("AgusPreview", "PROFILE_INSTALL_POLICY_RESTORED");
            }
        }
    }

    private static void stagePackage(Context context, Session work) throws Exception {
        work.requireLive();
        if (!absent(context, work.packageName) || prefs(context).getBoolean("packagePending", false)) throw new SecurityException("Package collision");
        if (!context.getPackageManager().canRequestPackageInstalls()) throw new SecurityException("Approve the Android installation source");
        byte[] bytes = PilotApi.apk(work.id, work.credential);
        if (!work.manifest.document.getJSONObject("build").getString("sha256").equals(Workload.sha256(bytes))) {
            throw new SecurityException("APK bytes changed");
        }
        File apk = File.createTempFile("reviewed-", ".apk", context.getCacheDir());
        try {
            Files.write(apk.toPath(), bytes);
            validateApk(context, apk, work);
            work.requireLive();
            var installer = context.getPackageManager().getPackageInstaller();
            var params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(work.packageName);
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
            int id = installer.createSession(params);
            try (var session = installer.openSession(id)) {
                try (var stream = session.openWrite("base.apk", 0, bytes.length)) {
                    stream.write(bytes);
                    session.fsync(stream);
                }
                work.requireLive();
                if (!prefs(context).edit().putBoolean("packagePending", true).commit()) throw new IllegalStateException("State unavailable");
                session.commit(callback(context, "install", 1));
            } catch (Exception error) {
                try { installer.abandonSession(id); prefs(context).edit().remove("packagePending").commit(); }
                catch (RuntimeException uncertain) { /* Keep the job quarantined. */ }
                throw error;
            }
        } finally { Files.deleteIfExists(apk.toPath()); }
    }

    static void requestRemoval(Context context, Session work) {
        if (absent(context, work.packageName)) return;
        if (!installedSignerMatches(context, work)) throw new SecurityException("Package ownership changed. Keep the profile quarantined.");
        context.getPackageManager().getPackageInstaller().uninstall(work.packageName, callback(context, "remove", 2));
    }

    private static android.content.IntentSender callback(Context context, String action, int code) {
        return PendingIntent.getBroadcast(context, code, new Intent(context, PackageResult.class).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE).getIntentSender();
    }

    static final class Session {
        final Context context;
        final Workload manifest;
        final String packageName;
        final String component;
        final String signerSha256;
        final JSONObject grant;
        final String id;
        final String credential;
        final String windowId;
        final long windowEnd;
        final long maximumEnd;
        volatile long expiry;
        volatile boolean stopped;

        Session(Context context, JSONObject grant, String windowId, long windowEnd, long sentAt) throws Exception {
            this.context = context.getApplicationContext();
            this.grant = grant;
            this.windowId = windowId;
            this.windowEnd = windowEnd;
            this.id = grant.getString("id");
            this.credential = grant.getString("credential");
            this.manifest = Workload.verify(grant.getJSONObject("manifest"), PreviewConfig.MANIFEST_KEY);
            JSONObject value = manifest.document;
            JSONObject build = value.getJSONObject("build");
            packageName = build.getString("packageName");
            component = build.getString("component");
            signerSha256 = build.getString("signerSha256");
            if (!PreviewConfig.REVIEWED_PACKAGES.contains(packageName) || !id.equals(value.getString("leaseId")) ||
                !prefs(context).getString("installation", "").equals(value.getString("audience")) ||
                !prefs(context).getString("runtimeClass", "").equals(value.getString("runtimeClass"))) {
                throw new SecurityException("Workload is bound to a different installation");
            }
            maximumEnd = Math.min(windowEnd, sentAt + Math.max(0, value.getLong("deadline") - grant.getLong("serverNow")));
            updateAuthority(grant, sentAt);
        }

        void updateAuthority(JSONObject status, long sentAt) throws Exception {
            long remaining = status.getLong("expiresAt") - status.getLong("serverNow");
            expiry = Math.min(maximumEnd, sentAt + Math.min(45000, Math.max(0, remaining)));
        }

        boolean eligible() {
            return !stopped && SystemClock.elapsedRealtime() < expiry && RuntimeState.locallySafe(context);
        }

        void requireLive() {
            if (!eligible()) throw new SecurityException("Local workload authority ended");
        }

        void stop() {
            stopped = true;
            ProfileAdmin.restrictInstalls(context, true);
            if (installedSignerMatches(context, this)) {
                var policy = context.getSystemService(DevicePolicyManager.class);
                policy.setPackagesSuspended(ProfileAdmin.component(context), new String[]{packageName}, true);
            }
        }

        void renew() throws Exception {
            if (!eligible() || !ProfileAdmin.installRestricted(context)) return;
            heartbeat(context, windowId, windowEnd);
            long start = SystemClock.elapsedRealtime();
            JSONObject status = PilotApi.request("GET", path(), credential, null).getJSONObject("lease");
            if (!"active".equals(status.getString("state"))) stop();
            else if (!stopped) updateAuthority(status, start);
        }

        void report(JSONArray observations) throws Exception {
            requireLive();
            PilotApi.request("POST", path() + "/report", credential,
                PilotApi.sign(binding("report").put("outcome", "completed").put("observations", observations)));
        }

        void notifyOwnerStop() throws Exception {
            PilotApi.request("POST", path() + "/stop", credential, PilotApi.sign(binding("owner_stop")));
        }

        void acknowledge() throws Exception {
            if (!absent(context, packageName) || prefs(context).getBoolean("packagePending", false) || !ProfileAdmin.installRestricted(context))
                throw new SecurityException("Package cleanup is unconfirmed");
            PilotApi.request("POST", path() + "/cleanup", credential,
                PilotApi.sign(binding("cleanup").put("packageAbsent", true).put("installRestricted", true)));
            if (!prefs(context).edit().remove("pendingLease").commit()) throw new IllegalStateException("State unavailable");
            live = null;
        }

        private String path() { return "/runtime/leases/" + id; }

        private JSONObject binding(String kind) throws Exception {
            return new JSONObject().put("v", 1).put("kind", kind)
                .put("installationId", prefs(context).getString("installation", null)).put("leaseId", id)
                .put("challenge", manifest.document.getString("challenge")).put("fence", manifest.document.getLong("fence"))
                .put("manifestSha256", manifest.hash);
        }
    }
}
