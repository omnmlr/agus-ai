package app.agus.companion;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationIntentCreator;
import com.solana.mobilewalletadapter.clientlib.scenario.LocalAssociationScenario;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

final class DevnetWallet {
    private static final String FAKE_WALLET = "com.solana.mobilewalletadapter.fakewallet";

    interface Callback {
        void complete(String address, String error);
    }

    private DevnetWallet() {}

    static void connect(Activity host, Executor executor, Callback callback) {
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
            String address = null;
            String error = null;
            try {
                var client = scenario.start().get(30, TimeUnit.SECONDS);
                var result = client.authorize(null, null, "AGUS AI Companion", "solana:devnet",
                    null, null, null, null).get(65, TimeUnit.SECONDS);
                if (result.accounts.length == 0) {
                    error = "The test wallet returned no Devnet account.";
                } else {
                    address = SolanaAddress.encode(result.accounts[0].publicKey);
                }
                client.deauthorize(result.authToken).get(5, TimeUnit.SECONDS);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                error = "The wallet connection was interrupted.";
            } catch (Exception failed) {
                error = "Wallet authorization did not complete. Open the test wallet and try again.";
            } finally {
                scenario.close();
            }
            String verifiedAddress = error == null ? address : null;
            String outcome = error;
            host.runOnUiThread(() -> callback.complete(verifiedAddress, outcome));
        });
    }
}
