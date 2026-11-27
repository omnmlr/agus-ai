package app.agus.phase1.fixture;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.UserManager;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;

public class Fixture extends Activity {
    private boolean advanced;
    private long deadline;
    private String nonce;
    private String probe;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        nonce = getIntent().getStringExtra("nonce");
        deadline = getIntent().getLongExtra("deadline", 0);
        long remaining = deadline - SystemClock.elapsedRealtime();
        if (!"app.agus.phase1".equals(getCallingPackage()) || !"advance".equals(getIntent().getStringExtra("action"))
                || nonce == null || remaining <= 0 || remaining > 90_000
                || !getSystemService(UserManager.class).isManagedProfile()) {
            finish();
            return;
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        new Handler(Looper.getMainLooper()).postDelayed(this::finish, remaining);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(24, 24, 24, 24);
        setContentView(layout);
        Button advance = button(layout, "Fixture step", () -> advanced = true);
        advance.setEnabled(false);
        advance.performClick(); // This is the fixture's own view and compiled action.
        if (!advanced) { finish(); return; }
        Log.i("AgusPhase1", "FIXTURE_OWN_VIEW_ADVANCED");
        var storage = getSharedPreferences("phase1_fixture", 0);
        Log.i("AgusPhase1", storage.getBoolean("previousSession", false)
                ? "FIXTURE_STALE_STATE" : "FIXTURE_FRESH_STATE");
        if (!storage.edit().putBoolean("previousSession", true).commit()) { finish(); return; }
        try (var socket = new java.net.Socket()) {
            socket.connect(new java.net.InetSocketAddress("10.0.2.2", 18765), 1500);
            Log.i("AgusPhase1", "FIXTURE_NETWORK_UNEXPECTED");
            finish();
            return;
        } catch (java.io.IOException | SecurityException denied) {
            Log.i("AgusPhase1", "FIXTURE_NO_INTERNET_SOCKET_DENIED");
        }
        probe = canReadParentCanary() ? "leaked" : "blocked";
        Log.i("AgusPhase1", "PARENT_CANARY_" + probe.toUpperCase(java.util.Locale.ROOT));
        button(layout, "Feedback: clear", () -> submit("clear"));
        button(layout, "Feedback: confusing", () -> submit("confusing"));
        button(layout, "Stop fixture now", this::finish);
    }

    private Button button(LinearLayout layout, String text, Runnable action) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setOnClickListener(view -> action.run());
        layout.addView(button);
        return button;
    }

    private boolean canReadParentCanary() {
        for (String authority : new String[]{"app.agus.phase1.canary", "0@app.agus.phase1.canary"}) {
            try (Cursor cursor = getContentResolver().query(Uri.parse("content://" + authority + "/fixture"),
                    null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) return true;
            } catch (SecurityException denied) {
                Log.i("AgusPhase1", "PARENT_EXPLICIT_USER_DENIED");
            }
        }
        return false;
    }

    private void submit(String label) {
        if (advanced && SystemClock.elapsedRealtime() < deadline) {
            setResult(RESULT_OK, new Intent().putExtra("nonce", nonce)
                    .putExtra("label", label).putExtra("probe", probe));
        }
        finish();
    }
}
