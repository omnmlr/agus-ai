package app.agus.runtime.preview;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import app.agus.cooperative.Workload;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Signature;
import org.json.JSONObject;

final class PilotApi {
    private static final String ALIAS = "agus-preview-signing-v1";

    static JSONObject request(String method, String path, String bearer, JSONObject input) throws Exception {
        return new JSONObject(new String(exchange(method, path, bearer, input, 512 * 1024), StandardCharsets.UTF_8));
    }

    static byte[] apk(String leaseId, String credential) throws Exception {
        return exchange("GET", "/runtime/leases/" + leaseId + "/build", credential, null, 25 * 1024 * 1024);
    }

    private static byte[] exchange(String method, String path, String bearer, JSONObject input, int limit) throws Exception {
        if (!path.matches("/[a-zA-Z0-9/_-]+")) throw new IOException("Invalid pilot path");
        var connection = (HttpURLConnection) new URL(PreviewConfig.ORIGIN + path).openConnection();
        connection.setConnectTimeout(3500);
        connection.setReadTimeout(3500);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestMethod(method);
        try {
            if (bearer != null) connection.setRequestProperty("Authorization", "Bearer " + bearer);
            if (input != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (var output = connection.getOutputStream()) {
                    output.write(input.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            if (connection.getResponseCode() != 200 && connection.getResponseCode() != 201) {
                throw new IOException("Pilot service returned HTTP " + connection.getResponseCode());
            }
            try (var bytes = connection.getInputStream(); var output = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[8192];
                for (int size; (size = bytes.read(chunk)) != -1;) {
                    if (output.size() + size > limit) throw new IOException("Pilot response exceeded the size limit");
                    output.write(chunk, 0, size);
                }
                return output.toByteArray();
            }
        } finally { connection.disconnect(); }
    }

    private static synchronized KeyStore keys() throws Exception {
        var store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            var generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setKeySize(256).setDigests(KeyProperties.DIGEST_SHA256).build());
            generator.generateKeyPair();
        }
        return store;
    }

    static String publicKey() throws Exception {
        return Workload.encode(keys().getCertificate(ALIAS).getPublicKey().getEncoded());
    }

    static JSONObject sign(JSONObject data) throws Exception {
        var signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign((PrivateKey) keys().getKey(ALIAS, null));
        byte[] bytes = data.toString().getBytes(StandardCharsets.UTF_8);
        signer.update(bytes);
        return new JSONObject().put("payload", Workload.encode(bytes)).put("signature", Workload.encode(signer.sign()));
    }
}
