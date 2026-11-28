package app.agus.companion;

import static app.agus.companion.CompanionViews.ACCENT;
import static app.agus.companion.CompanionViews.MUTED;
import static app.agus.companion.CompanionViews.TEXT;
import static app.agus.companion.ProviderApi.INVITATIONS;
import static app.agus.companion.ProviderApi.MARKETPLACE;
import static app.agus.companion.ProviderApi.MY_DEVICES;
import static app.agus.companion.ProviderApi.MY_SESSIONS;
import static app.agus.companion.ProviderApi.string;

import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ImageView;
import android.widget.TextView;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import org.json.JSONArray;
import org.json.JSONObject;

final class ProviderScreens {
    private final MainActivity host;
    private final CompanionViews ui;

    ProviderScreens(MainActivity host) {
        this.host = host;
        this.ui = host.ui;
    }

    void show(MainActivity.Screen screen, LinearLayout content) {
        switch (screen) {
            case WELCOME: welcome(content); break;
            case AUTH: auth(content); break;
            case ENROLLMENT: enrollment(content); break;
            case HOME: home(content); break;
            case MY_DEVICE: myDevice(content); break;
            case ACTIVITY: activity(content); break;
            case JOB_DETAILS: job(content); break;
            case ACTIVE_SESSION: session(content, false); break;
            case COMPLETED_SESSION: session(content, true); break;
            case EARNINGS: earnings(content); break;
            case PROFILE: profile(content); break;
            case INBOX: inbox(content); break;
        }
    }

    private void welcome(LinearLayout content) {
        LinearLayout.LayoutParams wordmark = new LinearLayout.LayoutParams(-1, ui.dp(26));
        wordmark.topMargin = ui.dp(12);
        content.addView(ui.brandImage(R.drawable.brand_wordmark_dark, false), wordmark);
        ui.hero(content, host.getResources().getConfiguration().screenHeightDp < 720 ? 150 : 202);
        title(content, "Put your phone to work. Get paid.", 34, 20);
        detail(content, "Contribute eligible Android device time for app testing and earn on paid assignments.", false);
        button(content, "Get started", R.id.welcome_get_started, true, view -> host.navigate(MainActivity.Screen.AUTH, null));
        button(content, "I already have an account", 0, false, view -> host.navigate(MainActivity.Screen.AUTH, null));
        ui.rule(content, 18);
        button(content, "Developer portal", R.id.developer_portal, false, view -> host.openPortal(false));
        button(content, "Review a private invitation", R.id.review_private_code, false, view -> ProviderForms.reviewCode(host));
    }

    private void auth(LinearLayout content) {
        if (host.authMethod == MainActivity.AuthMethod.CHOICE) {
            ui.hero(content, 132);
            title(content, "Your AGUS account", 32, 16);
            detail(content, host.pendingInvitationCode == null ? "Sign in or create an account to manage your contributions."
                : "Sign in with the account that received the private invitation.", false);
            boolean awaiting = host.waitingForGoogle();
            button(content, awaiting ? "Cancel Google sign-in" : "Continue with Google", 0, true,
                view -> { if (awaiting) host.cancelGoogle(); else host.startGoogle(); });
            button(content, "Continue with email", R.id.auth_use_email, false,
                view -> host.changeAuth(MainActivity.AuthMethod.EMAIL));
            if (host.canUseTestServer()) {
                button(content, "Use a password or test server", R.id.auth_use_password, false,
                    view -> host.changeAuth(MainActivity.AuthMethod.PASSWORD));
            } else {
                button(content, "Use a password", R.id.auth_use_password, false,
                    view -> host.changeAuth(MainActivity.AuthMethod.PASSWORD));
            }
            legal(content);
            return;
        }
        if (host.authMethod == MainActivity.AuthMethod.PASSWORD) {
            heading(content, "Use a password", "Sign in to an existing account or create one.");
            EditText origin = null;
            if (host.canUseTestServer()) {
                origin = input(content, "Test server (optional)", GoogleSignIn.ORIGIN.toString(),
                    InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI, R.id.auth_origin);
                origin.setText(host.preference("control_plane_origin"));
            }
            EditText server = origin;
            EditText email = input(content, "Email", "you@example.com", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, R.id.auth_email);
            email.setText(host.authEmail);
            EditText password = input(content, "Password", "At least 12 characters", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, R.id.auth_password);
            button(content, "Sign in", R.id.auth_sign_in, true, view -> host.authenticate(false, server, email, password));
            button(content, "Create account", R.id.auth_register, false, view -> host.authenticate(true, server, email, password));
            legal(content);
            return;
        }
        if (host.emailCodeSent) {
            heading(content, "Check your inbox", "Enter the six-digit code sent to " + host.authEmail + ".");
            EditText code = input(content, "Email code", "Six digits", InputType.TYPE_CLASS_NUMBER, R.id.auth_email_code);
            code.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(6) });
            code.setAutofillHints("emailOTPCode");
            button(content, "Verify code", R.id.auth_email_verify, true, view -> host.emailCode(null, code));
            Button resend = button(content, "Resend code", R.id.auth_email_send, false, view -> host.emailCode(null, null));
            host.retryCode(resend);
            button(content, "Use another address", 0, false, view -> host.editAuthEmail());
        } else {
            heading(content, "Continue with email", "We’ll email a sign-in code. The same code flow creates a new account if needed.");
            EditText email = input(content, "Email address", "you@example.com", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, R.id.auth_email);
            email.setAutofillHints(View.AUTOFILL_HINT_EMAIL_ADDRESS);
            email.setText(host.authEmail);
            button(content, "Email me a code", R.id.auth_email_send, true, view -> host.emailCode(email, null));
        }
        legal(content);
    }

    private void legal(LinearLayout content) {
        ui.rule(content, 18);
        LinearLayout links = ui.row();
        ui.weighted(links, ui.button("Privacy", false, view -> host.openPublicPage("/privacy")), 8);
        ui.weighted(links, ui.button("Terms", false, view -> host.openPublicPage("/terms")), 0);
        ui.add(content, links, 12);
    }

    private void enrollment(LinearLayout content) {
        JSONObject device = firstDevice();
        boolean connected = "online".equals(string(device, "connectivity"));
        ui.hero(content, 112);
        heading(content, "Set up your device", "Pair an authorized test phone or emulator with the desktop runner.");
        LinearLayout steps = ui.card(content);
        step(steps, "1", "Choose a test environment", "Use a dedicated Android phone or controlled emulator.");
        step(steps, "2", "Authorize your desktop runner", "Connect only the device you intend to use and approve its USB debugging prompt.");
        step(steps, "3", "Pair and check connection",
            connected ? "The server sees a connected runner." : "The runner must check in before the device can take work.");
        JSONObject pairing = host.pairing;
        if (pairing != null) {
            LinearLayout card = ui.card(content);
            ui.add(card, ui.heading(title(pairing, "code", "Pairing code unavailable"), 24), 0);
            named(card, "Expires", pairing, "expiresAt");
            button(card, "Copy pairing code", 0, true, view -> host.copy("pairing code", string(pairing, "code")));
        }
        if (devices() != null) {
            button(content, pairing == null ? "Generate pairing code" : "Generate new code", R.id.generate_pairing, pairing == null, view ->
                host.perform("Generating pairing code…", api -> api.post(MY_DEVICES + "/pairings", new JSONObject()),
                    result -> {
                        host.pairing = result.optJSONObject("pairing");
                        host.render(true);
                        String code = string(host.pairing, "code");
                        if (!code.isEmpty() && host.screen == MainActivity.Screen.ENROLLMENT) {
                            new android.app.AlertDialog.Builder(host).setTitle("Pairing code")
                                .setMessage(code + "\n\nExpires " + string(host.pairing, "expiresAt"))
                                .setPositiveButton("Copy pairing code", (dialog, which) -> host.copy("pairing code", code))
                                .setNegativeButton("Close", null).show();
                        }
                    }, host::statusError, false));
        } else {
            detail(content, host.snapshot == null ? "Checking enrollment access…" : "This server does not offer enrollment.", false);
            button(content, "Retry connection", 0, false, view -> host.refresh(true));
        }
        button(content, "Runner setup guide", 0, false, view -> host.openPublicPage("/docs/quickstart"));
        button(content, "Set up later", 0, false, view -> host.navigate(MainActivity.Screen.HOME, null));
        section(content, "Work Runtime preview");
        detail(content, "Separate managed-profile testing for approved disposable environments.", false);
        button(content, "Open Work Runtime", 0, false, view -> host.openWorkRuntime());
    }

    private void step(LinearLayout parent, String number, String label, String explanation) {
        LinearLayout line = ui.row();
        TextView badge = ui.text(number, 14, ACCENT, true);
        badge.setGravity(android.view.Gravity.CENTER);
        badge.setBackground(ui.surface(CompanionViews.RAISED, CompanionViews.BORDER, 18));
        line.addView(badge, new LinearLayout.LayoutParams(ui.dp(34), ui.dp(34)));
        LinearLayout copy = ui.column();
        copy.setPadding(ui.dp(12), 0, 0, 0);
        ui.add(copy, ui.text(label, 15, TEXT, true), 0);
        detail(copy, explanation, false);
        ui.weighted(line, copy, 0);
        ui.add(parent, line, 9);
    }

    private void home(LinearLayout content) {
        JSONObject device = firstDevice();
        JSONObject active = activeRun();
        String readiness = string(device, "readiness");
        String connection = string(device, "connectivity");
        String headline = active != null ? ("queued".equals(string(active, "state")) ? "Session queued" : "Session in progress") : device == null
            ? (host.snapshot == null ? "Checking your workspace" : "Set up your first device")
            : "ready".equals(readiness) && "online".equals(connection) ? "Your device is ready"
            : "online".equals(connection) ? "Your device needs attention" : "Your device is offline";
        LinearLayout intro = ui.card(content);
        var gradient = new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
            new int[] {0xff25262d, 0xff151619, CompanionViews.PANEL});
        gradient.setCornerRadius(ui.dp(22));
        intro.setBackground(gradient);
        LinearLayout lead = ui.row();
        LinearLayout copy = ui.column();
        title(copy, headline, 28, 0);
        String message = device == null ? "Pair a test environment to start contributing." :
            title(device, "label", "Dedicated device") + " · " + status(connection);
        detail(copy, message, false);
        ui.weighted(lead, copy, 8);
        lead.addView(ui.brandImage(R.drawable.brand_mascot, true), new LinearLayout.LayoutParams(ui.dp(82), ui.dp(82)));
        ui.add(intro, lead, 0);
        if (active != null) {
            button(intro, "Open current session", R.id.open_current_session, true, view -> host.openRun(active));
            stopAction(intro, active);
        } else if (device == null && host.snapshot != null) {
            button(intro, "Set up device", R.id.open_enrollment, true, view -> host.navigate(MainActivity.Screen.ENROLLMENT, null));
        }

        LinearLayout chart = ui.card(content);
        ui.add(chart, ui.text("Settled earnings", 13, ACCENT, true), 0);
        JSONObject data = earningsData();
        ui.add(chart, ui.heading(data == null ? "—" : amount(data, data.optJSONObject("totals"), "settledAtoms"), 29), 2);
        detail(chart, "Devnet test tokens · total last 30 days", false);
        if (data != null) plot(chart, data, 7, false);
        chart.setOnClickListener(view -> host.navigate(MainActivity.Screen.EARNINGS, null));
        button(chart, "View earnings", R.id.home_earnings_chart, false, view -> host.navigate(MainActivity.Screen.EARNINGS, null));
        if (device != null) {
            LinearLayout deviceInfo = ui.card(content);
            deviceLead(deviceInfo, title(device, "label", "Dedicated device"), status(connection) + " · " + status(readiness));
            button(deviceInfo, "My Device", R.id.open_my_device, false,
                view -> host.navigate(MainActivity.Screen.MY_DEVICE, string(device, "id")));
            detail(deviceInfo, device.optBoolean("marketplaceEligible") ? "Available for matching" : "Marketplace availability inactive", false);
            button(deviceInfo, "Manage availability", 0, false, view -> {
                host.activitySection = 0;
                host.navigate(MainActivity.Screen.ACTIVITY, null);
            });
        }
        JSONArray runs = runs();
        if (runs != null) {
            int completed = 0;
            for (int index = 0; index < runs.length(); index++) {
                JSONObject run = runs.optJSONObject(index);
                if (ProviderApi.terminal(run) && occurredToday(string(run, "updatedAt"))) completed++;
            }
            section(content, "Today’s contributions");
            detail(content, completed + (completed == 1 ? " finished session" : " finished sessions"), false);
        }
    }

    private JSONObject activeRun() {
        JSONArray runs = runs();
        if (runs != null) {
            for (int index = 0; index < runs.length(); index++) {
                JSONObject run = runs.optJSONObject(index);
                if (ProviderApi.active(run) || "queued".equals(string(run, "state"))) return run;
            }
        }
        return null;
    }

    private void deviceLead(LinearLayout parent, String title, String subtitle) {
        LinearLayout row = ui.row();
        ImageView phone = new ImageView(host);
        phone.setImageResource(R.drawable.ic_phone);
        phone.setScaleType(ImageView.ScaleType.CENTER);
        phone.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        phone.setBackground(ui.surface(CompanionViews.RAISED, CompanionViews.BORDER, 12));
        row.addView(phone, new LinearLayout.LayoutParams(ui.dp(46), ui.dp(46)));
        LinearLayout label = ui.column();
        label.setPadding(ui.dp(12), 0, 0, 0);
        ui.add(label, ui.text(title, 16, TEXT, true), 0);
        detail(label, subtitle, false);
        ui.weighted(row, label, 0);
        ui.add(parent, row, 0);
    }

    private void myDevice(LinearLayout content) {
        heading(content, "My Device", "Manage your enrolled dedicated environments.");
        JSONArray devices = devices();
        if (devices == null || devices.length() == 0) {
            detail(content, devices == null ? "Provider device data is unavailable." : "You have no paired devices.", false);
        }
        forEach(devices, device -> {
            if (host.selectedId == null || host.selectedId.equals(string(device, "id"))) {
                deviceCard(content, device);
            }
        });
        if (host.selectedId != null) {
            button(content, "All my devices", 0, false, view -> host.navigate(MainActivity.Screen.MY_DEVICE, null));
        }
        button(content, "Enrollment", R.id.open_enrollment, false, view -> host.navigate(MainActivity.Screen.ENROLLMENT, null));
    }

    private void deviceCard(LinearLayout content, JSONObject device) {
        LinearLayout card = ui.card(content);
        JSONObject profile = device.optJSONObject("profile");
        deviceLead(card, title(device, "label", "Dedicated device"),
            status(string(device, "connectivity")) + " · " + status(string(device, "readiness")));
        named(card, "Model", profile, "model");
        named(card, "Android", profile, "androidVersion");
        ui.rule(card, 14);
        LinearLayout first = ui.row();
        metric(first, "Available memory", bytes(profile, "memoryAvailableBytes"), 8);
        metric(first, "Free storage", bytes(profile, "dataAvailableBytes"), 0);
        ui.add(card, first, 10);
        LinearLayout second = ui.row();
        metric(second, "Battery charge", measured(profile, "batteryPercent", "%"), 8);
        metric(second, "Network latency", measured(profile, "networkLatencyMs", " ms"), 0);
        ui.add(card, second, 8);
        named(card, "Last heartbeat", device, "lastSeenAt");
        named(card, "Revoked", device, "revokedAt");
        if (profile != null) button(card, "Device capabilities", 0, false, view -> capabilities(profile));
        String id = string(device, "id");
        button(card, "Run diagnostics", R.id.device_diagnostics, false, view ->
            host.perform("Checking last runner profile…", api -> api.post(ProviderApi.item(MY_DEVICES, id) + "/diagnostics", new JSONObject()),
                response -> diagnostics(response.optJSONObject("diagnostics")), host::statusError, true));
        if (string(device, "revokedAt").isEmpty()) {
            button(card, "Device options", R.id.device_options, false, view -> {
                PopupMenu menu = new PopupMenu(host, view);
                menu.getMenu().add(0, R.id.share_private_invitation, 0, "Share a private invitation")
                    .setOnMenuItemClickListener(item -> { ProviderForms.privateShare(host, device); return true; });
                menu.getMenu().add("Rename device")
                    .setOnMenuItemClickListener(item -> { ProviderForms.rename(host, device); return true; });
                menu.getMenu().add("Revoke device").setOnMenuItemClickListener(item -> {
                    host.confirm("Revoke device?", "This removes the device from scheduling and requests termination of existing sessions.",
                        "Revoke device", () -> host.perform("Revoking device…", api -> api.delete(ProviderApi.item(MY_DEVICES, id)),
                            result -> host.navigate(MainActivity.Screen.MY_DEVICE, null), host::statusError, true));
                    return true;
                });
                menu.show();
            });
        }
    }

    private void metric(LinearLayout row, String label, String value, int gap) {
        LinearLayout cell = ui.column();
        cell.setPadding(ui.dp(10), ui.dp(8), ui.dp(10), ui.dp(8));
        cell.setBackground(ui.surface(CompanionViews.RAISED, CompanionViews.BORDER, 13));
        ui.add(cell, ui.text(value, 16, TEXT, true), 0);
        ui.add(cell, ui.text(label, 12, MUTED, false), 2);
        ui.weighted(row, cell, gap);
    }

    private String bytes(JSONObject data, String name) {
        long value = data == null ? -1 : data.optLong(name, -1);
        return value < 0 ? "Unavailable" : android.text.format.Formatter.formatShortFileSize(host, value);
    }

    private static String measured(JSONObject data, String name, String unit) {
        String value = string(data, name);
        return value.isEmpty() ? "Unavailable" : value + unit;
    }

    private void capabilities(JSONObject profile) {
        String message = String.join("\n",
            "Environment · " + status(string(profile, "kind")),
            "Source · " + status(string(profile, "source")),
            "Measured · " + measured(profile, "measuredAt", ""),
            "Total storage · " + bytes(profile, "dataTotalBytes"),
            "Battery temperature · " + measured(profile, "batteryTemperatureC", " °C"),
            "Thermal status · " + status(string(profile, "thermalStatus")),
            "Wallet network · " + status(string(profile, "walletNetwork")),
            "Seeker verification · " + (profile.optBoolean("seekerVerified") ? "Verified" : "Unverified"));
        new android.app.AlertDialog.Builder(host).setTitle("Device capabilities").setMessage(message)
            .setPositiveButton("Done", null).show();
    }

    private void diagnostics(JSONObject diagnostics) {
        if (diagnostics == null) {
            return;
        }
        StringBuilder message = new StringBuilder("Checked ").append(string(diagnostics, "checkedAt"))
            .append("\nSource ").append(string(diagnostics, "source"));
        forEach(diagnostics.optJSONArray("checks"), check -> message.append("\n").append(status(string(check, "id")))
            .append(" · ").append(check.optBoolean("passed") ? "Passed" : "Needs attention"));
        new android.app.AlertDialog.Builder(host).setTitle("Runner diagnostics").setMessage(message.toString())
            .setPositiveButton("Done", null).show();
    }

    private void activity(LinearLayout content) {
        heading(content, "Activity", "Review opportunities, sessions and requests.");
        LinearLayout filters = ui.row();
        String[] sections = { "Available", "Running", "History" };
        for (int index = 0; index < sections.length; index++) {
            int sectionIndex = index;
            Button filter = ui.button(sections[index], index == host.activitySection, view -> {
                host.activitySection = sectionIndex;
                host.render(false);
            });
            filter.setSelected(index == host.activitySection);
            ui.weighted(filters, filter, index == sections.length - 1 ? 0 : 6);
        }
        ui.add(content, filters, 14);
        if (host.activitySection != 0) {
            boolean history = host.activitySection == 2;
            showRunGroup(content, history ? "Session history" : "Current sessions", history);
            return;
        }
        section(content, "Availability");
        JSONObject device = firstDevice();
        if (device == null) {
            detail(content, "Pair a device to manage its schedule and matching.", false);
        }
        forEach(devices(), entry -> {
            if (!string(entry, "revokedAt").isEmpty()) {
                return;
            }
            LinearLayout settings = ui.card(content);
            ui.add(settings, ui.heading(title(entry, "label", "Dedicated device"), 18), 0);
            detail(settings, "Public listing · " + enabled(entry.optBoolean("publicListing")), false);
            detail(settings, "Automatic matching · " + enabled(entry.optBoolean("autoMatch")), false);
            detail(settings, "Eligible now · " + (entry.optBoolean("marketplaceEligible") ? "Yes" : "No"), false);
            button(settings, "Availability and matching", 0, false, view -> ProviderForms.availability(host, entry));
        });

        section(content, "Available");
        scopedDevice(content);
        JSONArray jobs = host.snapshot == null ? null : host.snapshot.jobs;
        if (jobs == null || jobs.length() == 0) {
            detail(content, jobs == null ? "No compatible offer list is available for the selected device." : "No compatible public job offers.", false);
        }
        forEach(jobs, offer -> {
            LinearLayout card = ui.card(content);
            ui.add(card, ui.heading(title(offer, "scenario", "Public offer"), 18), 0);
            named(card, "App", offer, "packageName");
            named(card, "Expires", offer, "expiresAt");
            button(card, "Review offer", R.id.review_market_offer, false, view -> host.openOffer(offer));
        });
        section(content, "Private requests");
        button(content, "Review private code", R.id.review_private_code, false, view -> ProviderForms.reviewCode(host));
        JSONArray invitations = host.snapshot == null ? null : host.snapshot.invitations;
        if (invitations == null || invitations.length() == 0) {
            detail(content, invitations == null ? "Invitation service is unavailable." : "No private requests yet.", false);
        }
        forEach(invitations, invitation -> {
            LinearLayout request = ui.card(content);
            ui.add(request, ui.heading(title(invitation, "scenario", "Private request"), 18), 0);
            detail(request, status(string(invitation, "state")), false);
            named(request, "Expires", invitation, "expiresAt");
            button(request, "Review job details", 0, false, view -> {
                if (string(invitation, "state").equals("pending") && host.email().equals(string(invitation.optJSONObject("recipient"), "email"))) {
                    host.perform("Loading invitation…", api -> api.post(ProviderApi.item(INVITATIONS, string(invitation, "id")) + "/review", new JSONObject()),
                        result -> host.openInvitation(result.optJSONObject("invitation")), host::statusError, true);
                } else {
                    host.openInvitation(invitation);
                }
            });
        });

    }

    private void inbox(LinearLayout content) {
        heading(content, "Inbox", "Invitations and updates from your workspace.");
        JSONArray notifications = host.snapshot == null ? null : host.snapshot.notifications;
        if (notifications == null) detail(content, "Inbox updates are unavailable. Refresh to try again.", false);
        else if (notifications.length() == 0) detail(content, "You’re all caught up.", false);
        forEach(notifications, notification -> {
            LinearLayout card = ui.card(content);
            String type = status(string(notification, "type"));
            ui.add(card, ui.heading(type, 17), 0);
            named(card, "Received", notification, "createdAt");
            JSONObject data = notification.optJSONObject("data");
            JSONObject run = ProviderApi.find(runs(), string(data, "runId"));
            JSONObject invitation = host.snapshot == null ? null
                : ProviderApi.find(host.snapshot.invitations, string(data, "invitationId"));
            if (run != null) button(card, "Open session", 0, false, view -> host.openRun(run));
            if (invitation != null) button(card, "Find private request", 0, false, view -> {
                host.activitySection = 0;
                host.navigate(MainActivity.Screen.ACTIVITY, null);
            });
            if (string(notification, "readAt").isEmpty()) button(card, "Mark read", 0, false, view ->
                host.perform("Updating inbox…", api -> api.post(ProviderApi.item("/me/notifications", string(notification, "id")) + "/read",
                    new JSONObject()), result -> {}, host::statusError, true));
        });
        button(content, "Refresh inbox", 0, false, view -> host.refresh(true));
        button(content, "Notification preferences", 0, false, view -> host.notificationPreferences());
    }

    private void showRunGroup(LinearLayout content, String title, boolean history) {
        section(content, title);
        boolean[] displayed = { false };
        forEach(runs(), run -> {
            if (history == ProviderApi.terminal(run)) {
                displayed[0] = true;
                LinearLayout card = ui.card(content);
                ui.add(card, ui.heading(title(run, "scenario", "Session"), 17), 0);
                detail(card, status(string(run, "state")), false);
                named(card, "Updated", run, "updatedAt");
                button(card, history ? "Open completed session" : "Open active session", 0, false, view -> host.openRun(run));
            }
        });
        if (!displayed[0]) {
            detail(content, runs() == null ? "Provider sessions are unavailable."
                : (history ? "No completed sessions." : "No active or queued sessions."), false);
        }
    }

    private void job(LinearLayout content) {
        heading(content, "Job Details", "Review the request before accepting or declining.");
        if (host.selectedOffer != null) {
            publicJob(content, host.selectedOffer);
            return;
        }
        JSONObject invitation = host.snapshot == null ? null : ProviderApi.find(host.snapshot.invitations, host.selectedId);
        if (invitation == null) {
            invitation = host.selectedInvitation;
        }
        if (invitation == null) {
            detail(content, "This invitation is unavailable.", false);
            return;
        }
        JSONObject request = invitation;
        LinearLayout card = ui.card(content);
        ui.add(card, ui.heading(title(request, "scenario", "Private request"), 18), 0);
        named(card, "Status", request, "state");
        named(card, "Requester", request.optJSONObject("requester"), "email");
        named(card, "Recipient", request.optJSONObject("recipient"), "email");
        named(card, "Device", request, "deviceId");
        named(card, "App", request, "packageName");
        named(card, "Build SHA-256", request, "buildSha256");
        named(card, "Mode", request, "mode");
        named(card, "Maximum duration (seconds)", request, "maximumDurationSeconds");
        named(card, "Expires", request, "expiresAt");
        named(card, "Payout", request, "payout");
        JSONObject evidence = request.optJSONObject("evidence");
        if (evidence != null) {
            named(card, "Screenshots allowed", evidence, "screenshots");
            named(card, "Logs allowed", evidence, "logs");
            named(card, "Trajectory allowed", evidence, "trajectory");
        }
        String userId = host.snapshot == null ? "" : string(host.snapshot.user, "id");
        String state = string(request, "state");
        boolean pending = state.equals("pending") || state.equals("reviewed");
        if (pending && !userId.isEmpty() && userId.equals(string(request.optJSONObject("recipient"), "id"))) {
            button(content, "Accept request", R.id.invitation_accept, true, view -> ProviderForms.accept(host, request));
            button(content, "Decline", R.id.invitation_decline, false, view -> invitationAction(request, "decline"));
        }
        if ((pending || state.equals("accepted")) && !userId.isEmpty()
            && userId.equals(string(request.optJSONObject("requester"), "id"))) {
            button(content, "Revoke request", R.id.invitation_revoke, false, view -> invitationAction(request, "revoke"));
        }
        String runId = string(request, "runId");
        if (!runId.isEmpty() && ProviderApi.find(runs(), runId) != null) {
            button(content, "Open session", 0, false, view -> host.openRun(ProviderApi.find(runs(), runId)));
        }
        button(content, "Back to Activity", 0, false, view -> host.navigate(MainActivity.Screen.ACTIVITY, null));
    }

    private void publicJob(LinearLayout content, JSONObject job) {
        LinearLayout card = ui.card(content);
        ui.add(card, ui.heading(title(job, "scenario", "Public offer"), 18), 0);
        named(card, "Requester", job.optJSONObject("requester"), "email");
        named(card, "App", job, "packageName");
        named(card, "Build SHA-256", job, "buildSha256");
        named(card, "Mode", job, "mode");
        named(card, "Maximum duration (seconds)", job, "maximumDurationSeconds");
        named(card, "Expires", job, "expiresAt");
        JSONObject quote = job.optJSONObject("quote");
        named(card, "Quote", quote, "kind");
        named(card, "Asset", quote, "asset");
        named(card, "Cluster", quote, "cluster");
        named(card, "Amount (atomic units)", quote, "amountAtoms");
        JSONObject evidence = job.optJSONObject("evidence");
        named(card, "Screenshots allowed", evidence, "screenshots");
        named(card, "Logs allowed", evidence, "logs");
        named(card, "Trajectory allowed", evidence, "trajectory");
        String deviceId = host.selectedOfferDeviceId;
        if (!deviceId.isEmpty()) {
            button(card, "Accept offer", R.id.accept_market_offer, true, view -> host.confirm("Accept public workload?",
                "The control plane will check current device readiness and reserve an exclusive lease for this work.", "Accept",
                () -> host.perform("Accepting offer…", api -> api.post(ProviderApi.item(MARKETPLACE, string(job, "id")) + "/accept",
                    new JSONObject().put("deviceId", deviceId)), response -> host.openRun(response.optJSONObject("run")), host::statusError, true)));
        }
        if (!string(job, "id").isEmpty() && host.selectedOfferDeviceId != null) {
            button(content, "Decline offer", 0, false, view -> host.perform("Declining offer…", api ->
                api.post(ProviderApi.item(ProviderApi.MARKETPLACE, string(job, "id")) + "/decline",
                    new JSONObject().put("deviceId", host.selectedOfferDeviceId)),
                result -> host.navigate(MainActivity.Screen.ACTIVITY, null), host::statusError, true));
        }
        button(content, "Back to Activity", 0, false, view -> host.navigate(MainActivity.Screen.ACTIVITY, null));
    }

    private void invitationAction(JSONObject invitation, String action) {
        host.confirm(action.equals("revoke") ? "Revoke this request?" : "Decline this request?",
            "The control plane will update the request for both parties.", action.equals("revoke") ? "Revoke" : "Decline",
            () -> host.perform("Updating invitation…",
                api -> api.post(ProviderApi.item(INVITATIONS, string(invitation, "id")) + "/" + action, new JSONObject()),
                result -> host.openInvitation(result.optJSONObject("invitation")), host::statusError, true));
    }

    private JSONObject currentRun() {
        JSONObject run = host.selectedRunOverride == null
            ? (host.snapshot == null ? null : host.snapshot.run) : host.selectedRunOverride;
        return run == null || !string(run, "id").equals(host.selectedId) ? ProviderApi.find(runs(), host.selectedId) : run;
    }

    void stopBar(LinearLayout root, int gutter) {
        JSONObject run = currentRun();
        if (run == null || ProviderApi.terminal(run)) return;
        ui.rule(root, 0);
        LinearLayout actions = ui.column();
        actions.setPadding(ui.dp(gutter), 0, ui.dp(gutter), ui.dp(10));
        stopAction(actions, run);
        ui.add(root, actions, 0);
    }

    private void stopAction(LinearLayout parent, JSONObject run) {
        String state = string(run, "state");
        if ("stopping".equals(state) || "verifying".equals(state)) {
            detail(parent, "stopping".equals(state) ? "Stop requested · waiting for the runner" : "The runner is verifying the result.", false);
            return;
        }
        button(parent, "Request stop", R.id.session_stop, false, view -> host.confirm("Request session stop?",
            "The runner must acknowledge the stop. Use the desktop runner’s local stop for emergencies.", "Request stop",
            () -> host.perform("Requesting stop…", api -> api.post(ProviderApi.item(MY_SESSIONS, string(run, "id")) + "/stop", new JSONObject()),
                result -> host.openRun(result.optJSONObject("run")), host::statusError, true)));
    }

    private void session(LinearLayout content, boolean completed) {
        JSONObject run = currentRun();
        if (run == null) {
            heading(content, "Session", "Loading session details…");
            return;
        }
        String state = string(run, "state");
        if (completed && "passed".equals(state)) ui.hero(content, 116);
        String headline = completed ? switch (state) {
            case "passed" -> "Session complete";
            case "failed" -> "Session failed";
            case "cancelled" -> "Session cancelled";
            case "expired" -> "Session expired";
            default -> "Review session result";
        } : "Running session";
        heading(content, headline, status(state));
        LinearLayout card = ui.card(content);
        ui.add(card, ui.heading(title(run, "scenario", "Workload"), 18), 0);
        named(card, "Execution", run, "state");
        named(card, "Mode", run, "mode");
        named(card, "Device", run, "deviceId");
        named(card, "Created", run, "createdAt");
        named(card, "Updated", run, "updatedAt");
        JSONObject stop = run.optJSONObject("stop");
        named(card, "Stop requested", stop, "requestedAt");
        named(card, "Stop acknowledged", stop, "acknowledgedAt");
        if ("stopping".equals(state) || "cancelled".equals(state) && stop != null && string(stop, "acknowledgedAt").isEmpty()) {
            detail(card, "Waiting for the runner to acknowledge termination. Stop locally on the runner if it is disconnected.", false);
        }
        if (!completed) detail(card, "For immediate intervention, use the local stop on the desktop runner.", false);
        showVerification(content, run);
        LinearLayout timeline = ui.card(content);
        ui.add(timeline, ui.heading("Timeline", 18), 0);
        JSONArray events = host.snapshot == null || !java.util.Objects.equals(host.selectedId, string(host.snapshot.run, "id"))
            ? null : host.snapshot.events;
        if (events == null || events.length() == 0) {
            detail(timeline, "No timeline events yet.", false);
        }
        forEach(events, event -> detail(timeline, title(event, "type", "Event") + " · " + string(event, "at"), false));
        button(content, "Refresh session", 0, false, view -> host.refresh(true));
        button(content, "Back to Activity", 0, false, view -> host.navigate(MainActivity.Screen.ACTIVITY, null));
    }

    private void showVerification(LinearLayout content, JSONObject run) {
        LinearLayout card = ui.card(content);
        ui.add(card, ui.heading("Results and verification", 18), 0);
        JSONObject verification = run.optJSONObject("verification");
        JSONObject receipt = run.optJSONObject("receipt");
        if (verification == null && receipt == null) {
            detail(card, "No execution receipt is available yet.", false);
        }
        named(card, "Test outcome", verification, "state");
        named(card, "Scope", verification, "scope");
        named(card, "Duration (ms)", verification, "durationMs");
        named(card, "Reason", verification, "reason");
        if (verification != null) {
            JSONObject transaction = verification.optJSONObject("transaction");
            named(card, "Independent chain check", transaction, "status");
            named(card, "Network", transaction, "network");
            named(card, "Transaction", transaction, "signature");
            JSONObject metrics = verification.optJSONObject("actionMetrics");
            named(card, "Actions", metrics, "actionCount");
            named(card, "Invalid actions", metrics, "invalidActions");
        }
        if (receipt != null) {
            named(card, "Receipt", receipt, "id");
            named(card, "Issuer", receipt, "issuer");
            named(card, "Manifest SHA-256", receipt, "manifestSha256");
            named(card, "Signature", receipt, "signature");
            named(card, "Build SHA-256", receipt.optJSONObject("manifest"), "buildSha256");
            forEach(receipt.optJSONArray("evidence"), item ->
                named(card, title(item, "kind", "Evidence") + " SHA-256", item, "sha256"));
        }
    }

    private void earnings(LinearLayout content) {
        heading(content, "Earnings", "Devnet settlement history.");
        scopedDevice(content);
        LinearLayout ranges = ui.row();
        int[] days = { 7, 30, 365 };
        String[] labels = { "7 days", "30 days", "12 months" };
        for (int index = 0; index < days.length; index++) {
            int period = days[index];
            Button range = ui.button(labels[index], period == host.earningsDays, view -> host.chooseEarningsPeriod(period));
            range.setSelected(period == host.earningsDays);
            ui.weighted(ranges, range, index == days.length - 1 ? 0 : 6);
        }
        ui.add(content, ranges, 12);
        JSONObject data = earningsData();
        LinearLayout summary = ui.card(content);
        ui.add(summary, ui.heading("Settled earnings", 18), 0);
        LinearLayout chart = ui.card(content);
        ui.add(chart, ui.heading("Earnings chart", 18), 0);
        if (data == null) {
            detail(summary, "Provider payout totals are unavailable for this device.", false);
            detail(chart, "No payout records are available for the chart.", false);
        } else {
            JSONObject total = data.optJSONObject("totals");
            ui.add(summary, ui.heading(amount(data, total, "settledAtoms"), 32), 4);
            detail(summary, "Devnet test tokens · " + string(data, "from") + " to " + endDate(data, "to"), false);
            ui.rule(summary, 12);
            detail(summary, "Pending · " + amount(data, total, "pendingAtoms"), false);
            detail(summary, "Failed · " + amount(data, total, "failedAtoms"), false);
            detail(summary, "Needs review · " + amount(data, total, "needsReviewAtoms"), false);
            named(summary, "Cluster", data, "cluster");
            plot(chart, data, 31, true);
        }
        wallet(content);
        section(content, "Payout history");
        JSONArray payouts = data == null ? null : data.optJSONArray("jobs");
        if (payouts == null || payouts.length() == 0) {
            detail(content, "Unpaid private jobs appear in Activity. There are no payout records to display.", false);
        }
        forEach(payouts, payout -> {
            LinearLayout card = ui.card(content);
            ui.add(card, ui.heading(status(string(payout, "state")), 17), 0);
            detail(card, amount(data, payout, "amountAtoms"), false);
            named(card, "Run", payout, "runId");
            named(card, "Destination", payout, "destination");
            named(card, "Accepted", payout, "acceptedAt");
            String signature = string(payout, "signature");
            if (!signature.isEmpty() && !string(payout, "explorerUrl").isEmpty() && string(data, "cluster").equals("devnet")) {
                button(card, "Open Devnet Explorer", 0, false, view -> host.openDevnetExplorer(signature));
            }
        });
        JSONObject campaign = host.snapshot == null ? null : host.snapshot.campaignEarnings;
        if (campaign != null) {
            LinearLayout card = ui.card(content);
            ui.add(card, ui.heading("Phone campaign earnings", 18), 0);
            detail(card, campaign.optLong("testUnits") + " nontransferable test units", false);
            JSONArray assets = campaign.optJSONArray("funded");
            if (assets == null || assets.length() == 0) detail(card, "No funded campaign earnings yet.", false);
            forEach(assets, row -> {
                JSONObject network = row.optJSONObject("network");
                if (network == null) return;
                String label = "devnet".equals(network.optString("cluster")) ? "Devnet test USDC" : "Localnet test SPL";
                detail(card, label, false);
                detail(card, "Finalized · " + amount(network, row, "finalizedAtoms"), false);
                detail(card, "Pending · " + amount(network, row, "pendingAtoms"), false);
                detail(card, "Under review · " + amount(network, row, "reviewAtoms"), false);
            });
        }
    }

    private JSONObject earningsData() {
        return host.snapshot == null ? null : host.snapshot.earnings;
    }

    private void plot(LinearLayout chart, JSONObject data, int days, boolean interactive) {
        JSONArray buckets = data.optJSONArray("buckets");
        if (buckets == null || buckets.length() == 0) {
            detail(chart, "No payout records for this period.", false);
            return;
        }
        java.util.List<JSONObject> points = new java.util.ArrayList<>();
        java.util.List<BigInteger> values = new java.util.ArrayList<>();
        for (int index = Math.max(0, buckets.length() - days); index < buckets.length(); index++) {
            JSONObject point = buckets.optJSONObject(index);
            if (point != null) {
                points.add(point);
                values.add(atoms(point, "settledAtoms"));
            }
        }
        if (points.isEmpty()) return;
        int[] selected = { points.size() - 1 };
        TextView pointLabel = ui.text("", 13, ACCENT, true);
        EarningsChart graph = new EarningsChart(host, values, interactive ? index -> {
            selected[0] = index;
            JSONObject point = points.get(index);
            pointLabel.setText(host.getString(R.string.earnings_point, title(point, "start", "Period"), amount(data, point, "settledAtoms")));
        } : null);
        LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(-1, ui.dp(interactive ? 118 : 53));
        layout.topMargin = ui.dp(10);
        chart.addView(graph, layout);
        if (!interactive) {
            detail(chart, "Settled per day · last seven UTC dates", false);
            return;
        }
        graph.select(selected[0]);
        pointLabel.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        ui.add(chart, pointLabel, 8);
        LinearLayout controls = ui.row();
        ui.weighted(controls, ui.button("Previous point", false, view -> graph.select(selected[0] - 1)), 6);
        ui.weighted(controls, ui.button("Next point", false, view -> graph.select(selected[0] + 1)), 0);
        ui.add(chart, controls, 8);
    }

    private static String endDate(JSONObject data, String key) {
        try {
            return LocalDate.parse(string(data, key)).minusDays(1).toString();
        } catch (DateTimeParseException invalid) {
            return "latest";
        }
    }

    private static BigInteger atoms(JSONObject object, String key) {
        String value = string(object, key);
        return value.matches("[0-9]{1,90}") ? new BigInteger(value) : BigInteger.ZERO;
    }

    private static String amount(JSONObject data, JSONObject object, String key) {
        String value = string(object, key);
        int decimals = data.optInt("decimals", -1);
        if (!value.matches("[0-9]{1,90}") || decimals < 0 || decimals > 18) {
            return "Unavailable";
        }
        return new BigDecimal(atoms(object, key), decimals).stripTrailingZeros().toPlainString() + " " + string(data, "asset");
    }

    private void scopedDevice(LinearLayout content) {
        if (host.snapshot == null || host.snapshot.deviceScope.isEmpty()) {
            return;
        }
        JSONObject current = ProviderApi.find(devices(), host.snapshot.deviceScope);
        detail(content, "Device · " + title(current, "label", "Dedicated device"), false);
        if (devices() != null && devices().length() > 1) {
            java.util.List<JSONObject> available = new java.util.ArrayList<>();
            java.util.List<String> labels = new java.util.ArrayList<>();
            forEach(devices(), device -> {
                if (string(device, "revokedAt").isEmpty()) {
                    available.add(device);
                    labels.add(title(device, "label", "Dedicated device"));
                }
            });
            if (available.size() > 1) {
                button(content, "Choose device", 0, false, view -> new android.app.AlertDialog.Builder(host).setTitle("Choose device")
                    .setItems(labels.toArray(new String[0]), (dialog, index) -> host.chooseDevice(string(available.get(index), "id"))).show());
            }
        }
    }

    private void profile(LinearLayout content) {
        heading(content, "Profile", "");
        JSONObject user = host.snapshot == null ? null : host.snapshot.user;
        String email = host.email();
        String name = string(user, "displayName");
        LinearLayout identity = ui.card(content);
        LinearLayout row = ui.row();
        TextView avatar = ui.text(email.isEmpty() ? "?" : email.substring(0, 1).toUpperCase(java.util.Locale.ROOT),
            24, ACCENT, true);
        avatar.setGravity(android.view.Gravity.CENTER);
        avatar.setBackground(ui.surface(CompanionViews.RAISED, CompanionViews.BORDER, 24));
        avatar.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        row.addView(avatar, new LinearLayout.LayoutParams(ui.dp(48), ui.dp(48)));
        LinearLayout copy = ui.column();
        copy.setPadding(ui.dp(12), 0, 0, 0);
        ui.add(copy, ui.heading(name.isEmpty() ? "Your account" : name, 19), 0);
        detail(copy, email, false);
        ui.weighted(row, copy, 0);
        ui.add(identity, row, 0);
        if (!string(user, "id").isEmpty()) {
            button(identity, "Edit display name", 0, false, view -> ProviderForms.displayName(host, user));
        }
        section(content, "Account and preferences");
        LinearLayout preferences = ui.card(content);
        button(preferences, "My devices", R.id.open_my_device, false, view -> host.navigate(MainActivity.Screen.MY_DEVICE, null));
        button(preferences, "Notification preferences", 0, false, view -> host.notificationPreferences());
        button(preferences, "Privacy and consent", 0, false, view -> new android.app.AlertDialog.Builder(host)
            .setTitle("Privacy and consent")
            .setMessage("Review the test scope and evidence before accepting a workload. Only enroll dedicated test environments.")
            .setPositiveButton("Privacy policy", (dialog, which) -> host.openPublicPage("/privacy"))
            .setNegativeButton("Close", null).show());
        wallet(content);
        section(content, "Developer and support");
        LinearLayout support = ui.card(content);
        button(support, "Developer portal", R.id.developer_portal, false, view -> host.openPortal(false));
        button(support, "Setup and help", 0, false, view -> host.openPublicPage("/docs/quickstart"));
        button(support, "Advanced diagnostics", 0, false, view -> new android.app.AlertDialog.Builder(host)
            .setTitle("Advanced diagnostics")
            .setMessage("Companion " + BuildConfig.VERSION_NAME + "\nAndroid API " + android.os.Build.VERSION.SDK_INT
                + "\nDeveloper portal " + host.portal().getHost())
            .setPositiveButton("Done", null).setNeutralButton("Portal settings", (dialog, which) -> host.openPortal(true)).show());
        legal(content);
        button(content, "Sign out", R.id.auth_sign_out, false, view -> {
            JSONObject running = activeRun();
            if (running != null) {
                new android.app.AlertDialog.Builder(host).setTitle("A session is still open")
                    .setMessage("Signing out leaves the session running. You can stop it from the session screen or the desktop runner.")
                    .setPositiveButton("Open session", (dialog, which) -> host.openRun(running))
                    .setNeutralButton("Sign out anyway", (dialog, which) -> host.signOut(true))
                    .setNegativeButton("Back", null).show();
            } else {
                host.confirm("Sign out?", "Sign in again to manage your devices.", "Sign out", () -> host.signOut(true));
            }
        });
        detail(content, "Version " + BuildConfig.VERSION_NAME, false);
    }

    private void wallet(LinearLayout content) {
        LinearLayout card = ui.card(content);
        ui.add(card, ui.heading("Devnet payout wallet", 18), 0);
        if (host.snapshot == null) {
            detail(card, "Loading the account’s payout wallet scope.", false);
            return;
        }
        if (host.snapshot.deviceScope.isEmpty()) {
            detail(card, "This verifies an account-level disposable wallet. Campaign payments are unavailable.", false);
        }
        detail(card, "The official Fake Wallet signs an exact ownership challenge for a disposable Devnet account.", false);
        if (host.hasCurrentWallet()) {
            detail(card, host.walletAddress, true);
            detail(card, "Verified " + host.walletVerifiedAt, false);
            button(card, "Copy verified address", 0, false, view -> host.copy("Devnet address", host.walletAddress));
            button(card, "Disconnect payout wallet", 0, false, view -> host.disconnectWallet());
        }
        if (host.walletStatus != null) detail(card, host.walletStatus, false);
        button(card, "Refresh verified wallet", 0, false, view -> host.loadWallet()).setEnabled(!host.walletInFlight);
        Button connect = button(card, host.walletInFlight ? "Waiting for wallet…" :
            host.hasCurrentWallet() ? "Replace payout wallet" : "Verify test wallet",
            R.id.connect_test_wallet, false, view -> host.connectWallet());
        connect.setEnabled(!host.walletInFlight);
    }

    private JSONArray devices() {
        return host.snapshot == null ? null : host.snapshot.devices;
    }

    private JSONArray runs() {
        return host.snapshot == null ? null : host.snapshot.runs;
    }

    private JSONObject firstDevice() {
        return ProviderApi.firstDevice(devices());
    }

    private void heading(LinearLayout content, String heading, String description) {
        title(content, heading, 30, 7);
        detail(content, description, false);
    }

    private void title(LinearLayout content, String text, int size, int top) {
        TextView title = ui.heading(text, size);
        title.setId(R.id.screen_title);
        ui.add(content, title, top);
    }

    private void section(LinearLayout container, String title) {
        ui.add(container, ui.heading(title, 19), 18);
    }

    private void named(LinearLayout card, String label, JSONObject object, String key) {
        String value = string(object, key);
        if (!value.isEmpty()) {
            detail(card, label + "  " + value, true);
        }
    }

    private void detail(LinearLayout card, String value, boolean selectable) {
        if (!value.isEmpty()) {
            TextView label = ui.text(value, 14, MUTED, false);
            label.setTextIsSelectable(selectable);
            ui.add(card, label, 6);
        }
    }

    private Button button(LinearLayout content, String text, int id, boolean primary, View.OnClickListener action) {
        Button button = ui.button(text, primary, action);
        if (id != 0) {
            button.setId(id);
        }
        ui.add(content, button, 10);
        return button;
    }

    private EditText input(LinearLayout parent, String label, String hint, int inputType, int id) {
        EditText field = ui.input(hint, inputType);
        field.setId(id);
        TextView name = ui.text(label, 13, TEXT, true);
        name.setLabelFor(field.getId());
        ui.add(parent, name, 12);
        ui.add(parent, field, 4);
        return field;
    }

    private static String status(String value) {
        return value.isEmpty() ? "Unknown" : value.replace('_', ' ');
    }

    private static String enabled(boolean value) {
        return value ? "On" : "Off";
    }

    private static String title(JSONObject entry, String key, String fallback) {
        String value = string(entry, key);
        return value.isEmpty() ? fallback : value;
    }

    private static boolean occurredToday(String timestamp) {
        try {
            return Instant.parse(timestamp).atZone(ZoneId.systemDefault()).toLocalDate().equals(LocalDate.now());
        } catch (DateTimeParseException invalid) {
            return false;
        }
    }

    private interface Item {
        void show(JSONObject entry);
    }

    private static void forEach(JSONArray items, Item item) {
        if (items != null) {
            for (int index = 0; index < items.length(); index++) {
                JSONObject entry = items.optJSONObject(index);
                if (entry != null) {
                    item.show(entry);
                }
            }
        }
    }
}
