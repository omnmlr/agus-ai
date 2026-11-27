package app.agus.preview.fixture;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.UserManager;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import app.agus.cooperative.Workload;
import org.json.JSONArray;
import org.json.JSONObject;

public class TestActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long deadline;
    private JSONArray observations;
    private TextView content;
    private int submissions;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            if (!"app.agus.runtime.preview".equals(getCallingPackage())
                || !getSystemService(UserManager.class).isManagedProfile() || state != null) throw new SecurityException();
            Workload workload = Workload.verify(new JSONObject(getIntent().getStringExtra("manifest")), PreviewConfig.MANIFEST_KEY);
            var task = workload.document;
            if (!task.getJSONObject("build").getString("packageName").equals(getPackageName())) throw new SecurityException();
            deadline = getIntent().getLongExtra("deadline", 0);
            long remaining = deadline - SystemClock.elapsedRealtime();
            if (remaining <= 0 || remaining > task.getLong("ttlMs")) throw new SecurityException();
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(24, 36, 24, 24);
            content = new TextView(this);
            content.setText("Onboarding review");
            layout.addView(content);
            setContentView(layout);
            observations = new JSONArray();
            if ("phone_cooperative".equals(task.getString("runtimeClass"))) {
                getWindow().getDecorView().post(() -> automate(task.optJSONArray("actions")));
            } else {
                button(layout, "Continue", this::advance);
                button(layout, "Return to review", () -> content.setText("Onboarding review"));
                button(layout, "Finish attended test", this::complete);
            }
            button(layout, "Stop fixture", this::finish);
            handler.postDelayed(this::finish, remaining);
        } catch (Exception denied) { finish(); }
    }

    private void automate(JSONArray actions) {
        try {
            for (int index = 0; index < actions.length(); index++) {
                if (isFinishing() || SystemClock.elapsedRealtime() >= deadline) { finish(); return; }
                String action = actions.getString(index);
                String result = "ready";
                if ("advance".equals(action)) {
                    advance();
                    result = "advanced";
                }
                observations.put(new JSONObject().put("action", action).put("result", result));
            }
            complete();
        } catch (Exception denied) { finish(); }
    }

    private void advance() {
        content.setText("Onboarding submissions: " + ++submissions);
    }

    private void complete() {
        if (!isFinishing() && SystemClock.elapsedRealtime() < deadline) {
            setResult(RESULT_OK, new Intent().putExtra("observations", observations.toString()));
        }
        finish();
    }

    private void button(LinearLayout layout, String label, Runnable action) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(label);
        button.setOnClickListener(view -> action.run());
        layout.addView(button);
    }

    @Override protected void onStop() {
        super.onStop();
        if (!isFinishing()) finish();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
