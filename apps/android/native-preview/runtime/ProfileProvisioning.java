package app.agus.runtime.preview;

import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.Intent;
import android.os.Bundle;

public class ProfileProvisioning extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String action = getIntent().getAction();
        if (DevicePolicyManager.ACTION_GET_PROVISIONING_MODE.equals(action)) {
            var modes = getIntent().getIntegerArrayListExtra(DevicePolicyManager.EXTRA_PROVISIONING_ALLOWED_PROVISIONING_MODES);
            int mode = DevicePolicyManager.PROVISIONING_MODE_MANAGED_PROFILE;
            if (modes != null && modes.contains(mode)) setResult(RESULT_OK,
                new Intent().putExtra(DevicePolicyManager.EXTRA_PROVISIONING_MODE, mode));
        } else if (DevicePolicyManager.ACTION_ADMIN_POLICY_COMPLIANCE.equals(action)) {
            ProfileAdmin.apply(this);
            setResult(RESULT_OK);
        }
        finish();
    }
}
