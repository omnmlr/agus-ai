package app.agus.cooperative;

import android.util.Base64;
import android.app.Activity;
import android.os.SystemClock;
import android.os.UserManager;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Verifies transport bytes and the fixed offline preview action contract. */
public final class Workload {
    public final JSONObject document;
    public final String hash;

    private Workload(JSONObject document, String hash) {
        this.document = document;
        this.hash = hash;
    }

    public static byte[] decode(String encoded) { return Base64.decode(encoded, Base64.NO_WRAP); }
    public static String encode(byte[] bytes) { return Base64.encodeToString(bytes, Base64.NO_WRAP); }
    public static String sha256(byte[] bytes) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    /** Call before accessing the app's reviewed test surface. */
    public static Workload authorize(Activity activity, String trustedKey) throws Exception {
        if (!"app.agus.runtime.preview".equals(activity.getCallingPackage())
            || !activity.getSystemService(UserManager.class).isManagedProfile()) throw new SecurityException("Expected the work-profile controller");
        Workload workload = verify(new JSONObject(activity.getIntent().getStringExtra("manifest")), trustedKey);
        JSONObject build = workload.document.getJSONObject("build");
        long remaining = activity.getIntent().getLongExtra("deadline", 0) - SystemClock.elapsedRealtime();
        if (!activity.getPackageName().equals(build.getString("packageName"))
            || !activity.getComponentName().getClassName().equals(build.getString("component"))
            || remaining <= 0 || remaining > workload.document.getLong("ttlMs")) throw new SecurityException("Workload target or deadline differs");
        return workload;
    }

    public static Workload verify(JSONObject envelope, String trustedKey) throws Exception {
        byte[] key = decode(trustedKey);
        byte[] bytes = decode(envelope.getString("payload"));
        if (bytes.length > 8192 || !"ECDSA-P256-SHA256-DER".equals(envelope.getString("alg"))
            || !"base64".equals(envelope.getString("encoding")) || !sha256(key).equals(envelope.getString("keyId"))
            || !sha256(bytes).equals(envelope.getString("sha256"))) throw new SecurityException("Invalid manifest envelope");
        Signature verifier = Signature.getInstance("SHA256withECDSA");
        verifier.initVerify(KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(key)));
        verifier.update(bytes);
        if (!verifier.verify(decode(envelope.getString("signature")))) throw new SecurityException("Manifest signature failed");
        JSONObject value = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        if (value.getInt("v") != 1 || !"agus.native.workload".equals(value.getString("type"))
            || !"cooperative-v1".equals(value.getString("actionContract"))
            || !"managed-profile-v1".equals(value.getString("policyVersion"))
            || !"structured_only".equals(value.getString("evidence"))
            || value.getLong("ttlMs") != 45000) throw new SecurityException("Unsupported workload version");
        String runtimeClass = value.getString("runtimeClass");
        if (!List.of("phone_human", "phone_cooperative").contains(runtimeClass)) throw new SecurityException("Unsupported lane");
        JSONArray actions = value.getJSONArray("actions");
        if (actions.length() > 4 || ("phone_human".equals(runtimeClass) && actions.length() != 0))
            throw new SecurityException("Invalid action scope");
        for (int index = 0; index < actions.length(); index++) {
            if (!List.of("describe", "advance").contains(actions.getString(index))) throw new SecurityException("Unknown action");
        }
        return new Workload(value, sha256(bytes));
    }
}
