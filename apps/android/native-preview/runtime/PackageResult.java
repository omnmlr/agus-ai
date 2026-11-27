package app.agus.runtime.preview;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.util.Log;

public class PackageResult extends BroadcastReceiver {
    static volatile Intent confirmation;

    @Override public void onReceive(Context context, Intent intent) {
        if (!ProfileAdmin.ownsProfile(context)) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String action = intent.getAction();
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            confirmation = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            return;
        }
        if ("install".equals(action)) {
            RuntimeState.prefs(context).edit().remove("packagePending").commit();
            ProfileAdmin.restrictInstalls(context, true);
            var work = RuntimeState.live;
            if (work != null && !work.eligible()) work.stop();
        }
        Log.i("AgusPreview", action + "_status_" + status);
    }
}
