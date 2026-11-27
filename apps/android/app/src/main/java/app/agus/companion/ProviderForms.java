package app.agus.companion;

import static app.agus.companion.ProviderApi.INVITATIONS;
import static app.agus.companion.ProviderApi.MY_DEVICES;
import static app.agus.companion.ProviderApi.string;

import android.app.AlertDialog;
import android.text.InputType;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import java.net.URI;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class ProviderForms {
    private static final int TEXT = InputType.TYPE_CLASS_TEXT;
    private static final Pattern WINDOW = Pattern.compile("([0-6](?:,[0-6])*)\\s+(\\d{2}:\\d{2})-(\\d{2}:\\d{2})");
    private final MainActivity host;
    private final LinearLayout fields;
    private final AlertDialog dialog;
    private final TextView error;

    private interface Submit {
        void send() throws JSONException;
    }

    private ProviderForms(MainActivity host, String title, String action) {
        this.host = host;
        fields = host.ui.column();
        fields.setPadding(host.ui.dp(20), host.ui.dp(8), host.ui.dp(20), host.ui.dp(12));
        ScrollView scroll = new ScrollView(host);
        scroll.addView(fields);
        dialog = new AlertDialog.Builder(host).setTitle(title).setView(scroll)
            .setNegativeButton("Back", null).setPositiveButton(action, null).create();
        error = host.ui.text("", 14, CompanionViews.ERROR, false);
        error.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    }

    static void portal(MainActivity host, Consumer<URI> onConfigured) {
        ProviderForms form = new ProviderForms(host, "Developer portal", "Open portal");
        EditText url = form.input("Portal origin", "https://portal.example", host.preference("developer_portal"),
            TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        form.show(() -> {
            URI origin = ApiOrigin.parse(value(url), BuildConfig.DEBUG);
            form.dialog.dismiss();
            onConfigured.accept(origin);
        });
    }

    static void reviewCode(MainActivity host) {
        ProviderForms form = new ProviderForms(host, "Review private invitation", "Continue");
        form.explain("Paste the private code or a link from the configured HTTPS developer portal.");
        EditText code = form.input("Code or link", "Private invitation", "", TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        form.show(() -> {
            String token = InvitationCode.parse(value(code), host.portal());
            form.dialog.dismiss();
            host.reviewCode(token);
        });
    }

    static void rename(MainActivity host, JSONObject device) {
        ProviderForms form = new ProviderForms(host, "Rename device", "Save");
        EditText label = form.input("Device label", "Dedicated Android", string(device, "label"), TEXT);
        form.show(() -> form.updateDevice(device, new JSONObject().put("label", required(label, "Device label"))));
    }

    static void displayName(MainActivity host, JSONObject user) {
        ProviderForms form = new ProviderForms(host, "Edit display name", "Save");
        EditText label = form.input("Display name", "Your name", string(user, "displayName"), TEXT);
        form.show(() -> {
            JSONObject input = new JSONObject().put("displayName", required(label, "Display name"));
            form.request("Updating profile…", api -> api.patch("/auth/me", input), result -> {}, true);
        });
    }

    static void availability(MainActivity host, JSONObject device) {
        ProviderForms form = new ProviderForms(host, "Availability and matching", "Save");
        form.explain("Listing and automatic matching are independent. An available device still needs an authorized lease.");
        CheckBox listing = form.check("Public listing", device.optBoolean("publicListing"));
        CheckBox auto = form.check("Automatic matching", device.optBoolean("autoMatch"));
        JSONObject constraints = device.optJSONObject("constraints");
        CheckBox charging = form.check("Require charging", constraints != null && constraints.optBoolean("chargingRequired"));
        CheckBox wifi = form.check("Require Wi-Fi", constraints != null && constraints.optBoolean("wifiRequired"));
        JSONObject schedule = device.optJSONObject("schedule");
        EditText zone = form.input("IANA timezone", "Africa/Lagos",
            schedule == null ? ZoneId.systemDefault().getId() : string(schedule, "timeZone"), TEXT);
        form.explain("One rule per line. Use 0 for Sunday through 6 for Saturday. Example: 1,2,3,4,5 09:00-18:00. Earlier end times run overnight. Leave blank for no schedule.");
        EditText windows = form.input("Weekly windows", "1,2,3,4,5 09:00-18:00", formatWindows(schedule), TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        windows.setSingleLine(false);
        windows.setMinLines(2);
        form.show(() -> form.updateDevice(device, new JSONObject().put("publicListing", listing.isChecked())
            .put("autoMatch", auto.isChecked()).put("schedule", parseSchedule(value(zone), value(windows)))
            .put("constraints", new JSONObject().put("chargingRequired", charging.isChecked()).put("wifiRequired", wifi.isChecked()))));
    }

    private void updateDevice(JSONObject device, JSONObject input) {
        request("Saving device settings…", api -> api.patch(ProviderApi.item(MY_DEVICES, string(device, "id")), input),
            result -> {}, true);
    }

    static Object parseSchedule(String zone, String windows) throws JSONException {
        if (windows.isEmpty()) {
            return JSONObject.NULL;
        }
        try {
            ZoneId.of(zone);
        } catch (java.time.DateTimeException invalid) {
            throw new IllegalArgumentException("Enter a valid IANA timezone, such as Africa/Lagos.");
        }
        JSONArray rules = new JSONArray();
        for (String line : windows.split("\\R")) {
            if (line.trim().isEmpty()) {
                continue;
            }
            Matcher match = WINDOW.matcher(line.trim());
            if (!match.matches() || rules.length() >= 24) {
                throw new IllegalArgumentException("Enter up to 24 weekly windows in the format 1,2,3 09:00-18:00.");
            }
            JSONArray days = new JSONArray();
            Set<Integer> unique = new HashSet<>();
            for (String day : match.group(1).split(",")) {
                int number = Integer.parseInt(day);
                if (!unique.add(number)) {
                    throw new IllegalArgumentException("List each day once per window.");
                }
                days.put(number);
            }
            String start = match.group(2);
            String end = match.group(3);
            try {
                if (LocalTime.parse(start).equals(LocalTime.parse(end))) {
                    throw new IllegalArgumentException("Choose different start and end times for each window.");
                }
            } catch (DateTimeParseException invalid) {
                throw new IllegalArgumentException("Use 24-hour times from 00:00 through 23:59.");
            }
            rules.put(new JSONObject().put("days", days).put("start", start).put("end", end));
        }
        return new JSONObject().put("timeZone", zone).put("windows", rules);
    }

    private static String formatWindows(JSONObject schedule) {
        StringBuilder output = new StringBuilder();
        JSONArray windows = schedule == null ? null : schedule.optJSONArray("windows");
        if (windows != null) {
            for (int index = 0; index < windows.length(); index++) {
                JSONObject window = windows.optJSONObject(index);
                JSONArray days = window == null ? null : window.optJSONArray("days");
                if (days == null) {
                    continue;
                }
                for (int offset = 0; offset < days.length(); offset++) {
                    output.append(offset == 0 ? "" : ",").append(days.optInt(offset));
                }
                output.append(' ').append(string(window, "start")).append('-').append(string(window, "end")).append('\n');
            }
        }
        return output.toString().trim();
    }

    static void privateShare(MainActivity host, JSONObject device) {
        ProviderForms form = new ProviderForms(host, "Share a private invitation", "Create invitation");
        form.explain("The recipient reviews this exact dedicated device, build, workload and evidence scope. Private invitations are unpaid in the pilot.");
        EditText recipient = form.input("Recipient account ID", "From recipient’s Profile", "", TEXT);
        EditText packageName = form.input("Android package", "app.example.test", "", TEXT);
        EditText digest = form.input("APK SHA-256 digest", "64 hexadecimal characters", "", TEXT);
        EditText duration = form.input("Maximum duration (seconds)", "60", "60", InputType.TYPE_CLASS_NUMBER);
        Spinner scenario = form.choices("Scenario", strings(device.optJSONArray("scenarios")));
        Spinner mode = form.choices("Execution mode", java.util.Arrays.asList("scripted", "agent"));
        CheckBox screenshots = form.check("Allow approved workload screenshots", false);
        CheckBox logs = form.check("Allow sanitized workload logs", false);
        form.show(() -> {
            String account = required(recipient, "Recipient account ID");
            String packageId = required(packageName, "Android package");
            String sha = required(digest, "APK SHA-256").toLowerCase(java.util.Locale.ROOT);
            if (!sha.matches("[a-f0-9]{64}")) {
                throw new IllegalArgumentException("Enter the exact 64-character SHA-256 digest of the APK.");
            }
            if (scenario.getSelectedItem() == null) {
                throw new IllegalArgumentException("The runner has not declared supported scenarios.");
            }
            int maximum;
            try {
                maximum = Integer.parseInt(value(duration));
            } catch (NumberFormatException invalid) {
                throw new IllegalArgumentException("Enter a maximum duration in seconds.");
            }
            JSONObject evidence = new JSONObject().put("screenshots", screenshots.isChecked()).put("logs", logs.isChecked())
                .put("trajectory", false);
            JSONObject input = new JSONObject().put("kind", "provider_share").put("deviceId", string(device, "id"))
                .put("targetUserId", account).put("packageName", packageId).put("buildSha256", sha)
                .put("scenario", scenario.getSelectedItem()).put("mode", mode.getSelectedItem())
                .put("maximumDurationSeconds", maximum).put("evidence", evidence);
            form.request("Creating invitation…", api -> api.post(INVITATIONS, input), result -> {
                JSONObject invitation = result.optJSONObject("invitation");
                host.openInvitation(invitation);
                showCreatedCode(host, result.optString("token"));
            }, true);
        });
    }

    private static void showCreatedCode(MainActivity host, String code) {
        if (code.isEmpty()) {
            return;
        }
        URI portal = host.portal();
        String share = portal != null && "https".equals(portal.getScheme())
            ? portal.resolve("/invite/" + code).toString() : code;
        new AlertDialog.Builder(host).setTitle("Invitation created")
            .setMessage("Send the link or code to the intended recipient.\n\n" + share)
            .setPositiveButton("Copy", (dialog, button) -> host.copy("private invitation", share)).show();
    }

    static void accept(MainActivity host, JSONObject invitation) {
        String path = ProviderApi.item(INVITATIONS, string(invitation, "id")) + "/accept";
        if (string(invitation, "kind").equals("provider_share")) {
            host.perform("Loading approved builds…", api -> new JSONObject()
                .put("projects", api.get("/projects").getJSONArray("projects"))
                .put("builds", api.get("/builds").getJSONArray("builds")),
                result -> chooseBuild(host, invitation, path, result), host::statusError, false);
            return;
        }
        host.confirm("Accept dedicated workload?",
            "You are approving the stated app, maximum duration and evidence scope. The private workload is unpaid.", "Accept",
            () -> host.perform("Accepting invitation…", api -> api.post(path, new JSONObject()),
                result -> host.openInvitation(result.optJSONObject("invitation")), host::statusError, true));
    }

    private static void chooseBuild(MainActivity host, JSONObject invitation, String path, JSONObject result) {
        JSONArray all = result.optJSONArray("builds");
        JSONArray projects = result.optJSONArray("projects");
        List<JSONObject> matches = new ArrayList<>();
        List<String> names = new ArrayList<>();
        if (all != null) {
            for (int index = 0; index < all.length(); index++) {
                JSONObject build = all.optJSONObject(index);
                String projectId = string(build, "projectId");
                if (string(invitation, "buildSha256").equals(string(build, "sha256"))
                    && string(invitation, "packageName").equals(string(build, "packageName"))) {
                    matches.add(build);
                    names.add(string(ProviderApi.find(projects, projectId), "name") + " / " + string(build, "name"));
                }
            }
        }
        ProviderForms form = new ProviderForms(host, "Accept the invitation", "Accept");
        if (matches.isEmpty()) {
            form.explain("Register the exact requested APK in the developer portal, then review the invitation again.");
            form.show(() -> {
                form.dialog.dismiss();
                host.openPortal(false);
            });
            form.dialog.getButton(AlertDialog.BUTTON_POSITIVE).setText(R.string.developer_portal);
            return;
        }
        form.explain("This private request is unpaid. Choose the approved APK matching the invitation.");
        Spinner builds = form.choices("Project and build", names);
        boolean transfer = string(invitation, "scenario").equals("wallet-transfer")
            || string(invitation, "scenario").equals("wallet-false-success");
        Spinner network = transfer ? form.choices("Verification network", java.util.Arrays.asList("devnet", "localnet")) : null;
        EditText recipient = transfer ? form.input("Expected Solana recipient", "Disposable test address", "", TEXT) : null;
        EditText amount = transfer ? form.input("Expected lamports", "1", "", InputType.TYPE_CLASS_NUMBER) : null;
        form.show(() -> {
            JSONObject build = matches.get(builds.getSelectedItemPosition());
            JSONObject input = new JSONObject().put("projectId", string(build, "projectId")).put("buildId", string(build, "id"));
            if (transfer) {
                long lamports;
                try {
                    lamports = Long.parseLong(value(amount));
                } catch (NumberFormatException invalid) {
                    throw new IllegalArgumentException("Enter the expected whole number of lamports.");
                }
                input.put("expectedTransaction", new JSONObject().put("network", network.getSelectedItem())
                    .put("recipient", required(recipient, "Expected recipient")).put("lamports", lamports));
            }
            form.request("Accepting invitation…", api -> api.post(path, input), response ->
                host.openInvitation(response.optJSONObject("invitation")), true);
        });
    }

    private void request(String progress, MainActivity.Operation operation, MainActivity.Result finished, boolean refetch) {
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
        error.setText(progress);
        host.perform(progress, operation, result -> {
            dialog.dismiss();
            finished.received(result);
        }, message -> {
            error.setText(message);
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
        }, refetch);
    }

    private void show(Submit submit) {
        host.ui.add(fields, error, 9);
        dialog.show();
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            error.setText("");
            try {
                submit.send();
            } catch (IllegalArgumentException invalid) {
                error.setText(invalid.getMessage());
            } catch (JSONException invalid) {
                error.setText(R.string.invalid_form);
            }
        });
    }

    private void explain(String message) {
        host.ui.add(fields, host.ui.text(message, 14, CompanionViews.MUTED, false), 8);
    }

    private CheckBox check(String label, boolean checked) {
        CheckBox box = new CheckBox(host);
        box.setText(label);
        box.setChecked(checked);
        host.ui.add(fields, box, 5);
        return box;
    }

    private EditText input(String label, String hint, String data, int type) {
        EditText field = host.ui.input(hint, type);
        field.setText(data);
        label(field, label);
        host.ui.add(fields, field, 4);
        return field;
    }

    private Spinner choices(String label, List<String> items) {
        Spinner field = new Spinner(host);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(host, android.R.layout.simple_spinner_dropdown_item, items);
        field.setAdapter(adapter);
        label(field, label);
        host.ui.add(fields, field, 4);
        return field;
    }

    private void label(View field, String label) {
        field.setId(View.generateViewId());
        TextView name = host.ui.text(label, 13, CompanionViews.TEXT, true);
        name.setLabelFor(field.getId());
        host.ui.add(fields, name, 10);
    }

    private static List<String> strings(JSONArray values) {
        List<String> result = new ArrayList<>();
        if (values != null) {
            for (int index = 0; index < values.length(); index++) {
                result.add(values.optString(index));
            }
        }
        return result;
    }

    private static String required(EditText field, String label) {
        String value = value(field);
        if (value.isEmpty()) {
            throw new IllegalArgumentException(label + " is required.");
        }
        return value;
    }

    private static String value(EditText field) {
        return field.getText().toString().trim();
    }
}
