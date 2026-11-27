package app.agus.runtime.preview;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;

public class ProfileAdmin extends DeviceAdminReceiver {
    static ComponentName component(Context context) { return new ComponentName(context, ProfileAdmin.class); }

    static boolean ownsProfile(Context context) {
        return context.getSystemService(UserManager.class).isManagedProfile()
            && context.getSystemService(DevicePolicyManager.class).isProfileOwnerApp(context.getPackageName());
    }

    static void requireProfile(Context context) {
        if (!ownsProfile(context)) throw new SecurityException("Work profile required");
    }

    static void apply(Context context) {
        requireProfile(context);
        var policy = context.getSystemService(DevicePolicyManager.class);
        var admin = component(context);
        policy.addUserRestriction(admin, UserManager.DISALLOW_CROSS_PROFILE_COPY_PASTE);
        policy.addUserRestriction(admin, UserManager.DISALLOW_SHARE_INTO_MANAGED_PROFILE);
        policy.setScreenCaptureDisabled(admin, true);
        restrictInstalls(context, true);
        policy.setProfileEnabled(admin);
    }

    static void restrictInstalls(Context context, boolean restrict) {
        requireProfile(context);
        var policy = context.getSystemService(DevicePolicyManager.class);
        if (restrict) policy.addUserRestriction(component(context), UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);
        else policy.clearUserRestriction(component(context), UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);
    }

    static boolean installRestricted(Context context) {
        return context.getSystemService(UserManager.class).hasUserRestriction(UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);
    }

    static boolean sharingRestricted(Context context) {
        var users = context.getSystemService(UserManager.class);
        return users.hasUserRestriction(UserManager.DISALLOW_CROSS_PROFILE_COPY_PASTE)
            && users.hasUserRestriction(UserManager.DISALLOW_SHARE_INTO_MANAGED_PROFILE)
            && context.getSystemService(DevicePolicyManager.class).getScreenCaptureDisabled(component(context));
    }

    @Override public void onProfileProvisioningComplete(Context context, Intent intent) { apply(context); }
}
