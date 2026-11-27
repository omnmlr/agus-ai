package app.agus.phase1;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

public class InstallResult extends BroadcastReceiver {
    static Intent pendingConfirmation;
    @Override public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String operation = intent.getAction();
        if (status == PackageInstaller.STATUS_SUCCESS) {
            if ("FIXTURE_INSTALL".equals(operation)) Admin.restrictInstalls(context);
            Controller.mark(operation + "_SUCCESS");
        } else if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            pendingConfirmation = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            Controller.mark(operation + "_ANDROID_CONFIRMATION_REQUIRED");
        } else {
            Controller.mark(operation + "_STATUS_" + status);
        }
    }
}
