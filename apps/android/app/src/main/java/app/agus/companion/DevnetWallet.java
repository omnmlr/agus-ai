package app.agus.companion;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.util.Base64;
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationIntentCreator;
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationScenario;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

final class DevnetWallet {
    private static final String FAKE_WALLET = "com.solana.mobilewalletadapter.fakewallet";

    interface Callback {
        void complete(JSONObject wallet, String error);
    }

    private DevnetWallet() {}

    static void prove(Activity host, Executor executor, ApiClient api, URI origin, String path, Callback callback) {
        LocalAssociationScenario scenario = new LocalAssociationScenario(60_000);
        try {
            host.startActivity(LocalAssociationIntentCreator.createAssociationIntent(
                null, scenario.getPort(), scenario.getSession()).setPackage(FAKE_WALLET));
        } catch (ActivityNotFoundException missing) {
            scenario.close();
            callback.complete(null, "Install the official Mobile Wallet Adapter Fake Wallet on a dedicated test device.");
            return;
        }

        executor.execute(() -> {
            JSONObject wallet = null;
            String error = null;
            try {
                var client = scenario.start().get(30, TimeUnit.SECONDS);
                var result = client.authorize(null, null, "AGUS AI Companion", "solana:devnet",
                    null, null, null, null).get(65, TimeUnit.SECONDS);
                try {
                    if (result.accounts.length == 0) throw new IllegalStateException("Wallet returned no Devnet account");
                    byte[] addressBytes = result.accounts[0].publicKey;
                    String address = SolanaAddress.encode(addressBytes);
                    var challenge = api.post(path + "/challenge", new JSONObject().put("wallet", address)).getJSONObject("challenge");
                    byte[] message = challengeMessage(challenge, origin, address).getBytes(StandardCharsets.UTF_8);
                    var signed = client.signMessagesDetached(new byte[][]{message}, new byte[][]{addressBytes})
                        .get(40, TimeUnit.SECONDS).messages;
                    if (signed.length != 1 || signed[0].signatures.length != 1 || signed[0].addresses.length != 1 ||
                        !Arrays.equals(signed[0].message, message) || !Arrays.equals(signed[0].addresses[0], addressBytes) ||
                        signed[0].signatures[0].length != 64) throw new SecurityException("Unexpected wallet signature");
                    var body = new JSONObject().put("challengeId", challenge.getString("id"))
                        .put("signature", Base64.encodeToString(signed[0].signatures[0], Base64.NO_WRAP));
                    wallet = api.post(path + "/verify", body).getJSONObject("payoutWallet");
                } finally {
                    try { client.deauthorize(result.authToken).get(5, TimeUnit.SECONDS); }
                    catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
                    catch (Exception unavailable) { /* Association closes below. */ }
                }
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                error = "The wallet connection was interrupted.";
            } catch (ApiClient.ApiError failed) {
                error = failed.getMessage();
            } catch (Exception failed) {
                error = "Wallet ownership was not verified. Check the Devnet wallet and request a new challenge.";
            } finally {
                scenario.close();
            }
            JSONObject verifiedWallet = wallet;
            String message = error;
            host.runOnUiThread(() -> callback.complete(verifiedWallet, message));
        });
    }

    private static String challengeMessage(JSONObject challenge, URI origin, String address) throws Exception {
        String expectedOrigin = origin.getScheme() + "://" + origin.getAuthority();
        if (!address.equals(challenge.getString("wallet")) || !expectedOrigin.equals(challenge.getString("origin"))) {
            throw new SecurityException("Payout challenge origin or address changed");
        }
        String message = String.join("\n", "Mobile execution payout wallet authorization v1",
            "Origin " + expectedOrigin, "Provider " + challenge.getString("providerId"), "Wallet " + address,
            "Challenge " + challenge.getString("id"), "Issued " + challenge.getString("issuedAt"),
            "Expires " + challenge.getString("expiresAt"), "Sign this message to register a wallet for future payouts.");
        if (!message.equals(challenge.getString("message"))) throw new SecurityException("Unexpected payout message");
        return message;
    }
}
