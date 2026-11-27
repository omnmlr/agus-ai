package app.agus.phase1;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;

public class Admin extends DeviceAdminReceiver {
    static ComponentName component(Context context) {
        return new ComponentName(context, Admin.class);
    }

    static void apply(Context context) {
        DevicePolicyManager policy = context.getSystemService(DevicePolicyManager.class);
        if (!policy.isProfileOwnerApp(context.getPackageName())
                || !context.getSystemService(UserManager.class).isManagedProfile()) {
            throw new IllegalStateException("Requires managed profile owner");
        }
        policy.addUserRestriction(component(context), UserManager.DISALLOW_CROSS_PROFILE_COPY_PASTE);
        restrictInstalls(context);
        policy.setProfileEnabled(component(context));
        Controller.mark("PROFILE_OWNER_POLICY_APPLIED");
    }

    static void restrictInstalls(Context context) {
        context.getSystemService(DevicePolicyManager.class).addUserRestriction(
                component(context), UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);
    }

    @Override public void onProfileProvisioningComplete(Context context, Intent intent) {
        apply(context);
    }
}
