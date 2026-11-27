package app.agus.companion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONException;
import org.json.JSONObject;

final class AuthStorage {
    private static final String KEY_ALIAS = "agus-companion-auth-v1";
    private static final int IV_LENGTH = 12;
    private final SharedPreferences preferences;

    AuthStorage(Context context) {
        preferences = context.getSharedPreferences("protected_auth", Context.MODE_PRIVATE);
    }

    JSONObject read(String name) {
        String encoded = preferences.getString(name, null);
        if (encoded == null) return null;
        try {
            byte[] value = Base64.decode(encoded, Base64.NO_WRAP);
            if (value.length <= IV_LENGTH) throw new GeneralSecurityException("Invalid stored record");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, value, 0, IV_LENGTH));
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            byte[] clear = cipher.doFinal(value, IV_LENGTH, value.length - IV_LENGTH);
            return new JSONObject(new String(clear, StandardCharsets.UTF_8));
        } catch (Exception invalid) {
            clear(name);
            return null;
        }
    }

    void write(String name, JSONObject value) throws GeneralSecurityException {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            byte[] clear = value.toString().getBytes(StandardCharsets.UTF_8);
            byte[] encrypted = cipher.doFinal(clear);
            byte[] iv = cipher.getIV();
            if (iv.length != IV_LENGTH) throw new GeneralSecurityException("Invalid encryption nonce");
            byte[] combined = ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array();
            if (!preferences.edit().putString(name, Base64.encodeToString(combined, Base64.NO_WRAP)).commit()) {
                throw new GeneralSecurityException("Unable to save sign-in");
            }
        } catch (GeneralSecurityException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new GeneralSecurityException("Protected storage unavailable", failure);
        }
    }

    boolean clear(String name) {
        return preferences.edit().remove(name).commit();
    }

    private static synchronized SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey existing = (SecretKey) store.getKey(KEY_ALIAS, null);
        if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
}
