package org.example.agus.checklist;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.WindowManager;
import android.widget.TextView;
import app.agus.cooperative.Workload;
import org.json.JSONArray;
import org.json.JSONObject;

public final class TestActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            if (state != null) throw new SecurityException("Start a fresh checklist session");
            Workload workload = Workload.authorize(this, PreviewConfig.MANIFEST_KEY);
            if (!"phone_cooperative".equals(workload.document.getString("runtimeClass"))) throw new SecurityException("Cooperative task required");
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            TextView view = new TextView(this);
            view.setText("Checklist ready");
            setContentView(view);
            getWindow().getDecorView().post(() -> runChecklist(workload, view));
        } catch (Exception denied) { finish(); }
    }

    private void runChecklist(Workload workload, TextView view) {
        try {
            JSONArray report = new JSONArray();
            JSONArray actions = workload.document.getJSONArray("actions");
            long deadline = getIntent().getLongExtra("deadline", 0);
            for (int step = 0; step < actions.length(); step++) {
                if (isFinishing() || SystemClock.elapsedRealtime() >= deadline) return;
                String action = actions.getString(step);
                String result = switch (action) {
                    case "describe" -> "ready";
                    case "advance" -> { view.setText("Checklist step complete"); yield "advanced"; }
                    default -> throw new SecurityException("Unknown checklist action");
                };
                report.put(new JSONObject().put("action", action).put("result", result));
            }
            if (SystemClock.elapsedRealtime() < deadline) setResult(RESULT_OK, new Intent().putExtra("observations", report.toString()));
        } catch (Exception denied) { /* Android will return a cancelled result. */ }
        finally { finish(); }
    }

    @Override protected void onStop() {
        super.onStop();
        if (!isFinishing()) finish();
    }
}
