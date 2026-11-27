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
import android.widget.ProgressBar;
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
        }
    }

    private void welcome(LinearLayout content) {
        heading(content, "Welcome", "Contribute a dedicated Android device to authorized mobile testing.");
        detail(content, "The provider runner runs on a desktop and connects to the test phone over USB, or uses a controlled emulator.", false);
        button(content, "Get started", R.id.welcome_get_started, true, view -> host.navigate(MainActivity.Screen.AUTH, null));
        button(content, "Developer portal", R.id.developer_portal, false, view -> host.openPortal(false));
        button(content, "Review a private invitation", R.id.review_private_code, false, view -> ProviderForms.reviewCode(host));
    }

    private void auth(LinearLayout content) {
        heading(content, "Auth", host.pendingInvitationCode == null
            ? "Sign in to your provider workspace." : "Sign in to review the private invitation.");
        LinearLayout card = ui.card(content);
        EditText origin = input(card, "Control-plane origin", GoogleSignIn.ORIGIN.toString(),
            InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI, R.id.auth_origin);
        origin.setText(host.preference("control_plane_origin"));
        EditText email = input(card, "Email", "you@example.com", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, R.id.auth_email);
        EditText password = input(card, "Password", "Password", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, R.id.auth_password);
        EditText registration = input(card, "Registration invite (if required)", "Pilot access code",
            InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, R.id.auth_registration_token);
        button(card, "Sign in", R.id.auth_sign_in, true, view -> host.authenticate(false, origin, email, password, registration));
        button(card, "Create account", R.id.auth_register, false, view -> host.authenticate(true, origin, email, password, registration));
        button(card, "Continue with Google", 0, false, view -> host.startGoogle(origin, registration));
        button(card, "Cancel Google sign-in", 0, false, view -> host.cancelGoogle());
        LinearLayout emailCode = ui.card(content);
        ui.add(emailCode, ui.heading("Email code", 18), 0);
        EditText code = input(emailCode, "Six-digit code", "000000", InputType.TYPE_CLASS_NUMBER, R.id.auth_email_code);
        button(emailCode, "Send email code", R.id.auth_email_send, false, view -> host.emailCode(false, origin, email, code, registration));
        button(emailCode, "Verify email code", R.id.auth_email_verify, false, view -> host.emailCode(true, origin, email, code, registration));
        button(content, "Developer portal", R.id.developer_portal, false, view -> host.openPortal(false));
        button(content, "Back to Welcome", 0, false, view -> host.navigate(MainActivity.Screen.WELCOME, null));
    }

    private void enrollment(LinearLayout content) {
        heading(content, "Enrollment", "Choose an approved test environment.");
        button(content, "Open phone-native preview", 0, false, view -> host.openPhonePreview());
        detail(content, "The phone-native preview is for disposable Android test environments.", false);
        detail(content, "Use a clean test phone or emulator. Enable USB debugging only on the dedicated test device and authorize your own desktop.", false);
        detail(content, "Open the project’s provider runner setup on the desktop, select the device and approved builds, then enter the one-time pairing code.", false);
        JSONObject pairing = host.pairing;
        if (pairing != null) {
            LinearLayout card = ui.card(content);
            named(card, "Pairing code", pairing, "code");
            named(card, "Expires", pairing, "expiresAt");
            button(card, "Copy pairing code", 0, false, view -> host.copy("pairing code", string(pairing, "code")));
        }
        if (devices() != null) {
            button(content, "Generate pairing code", R.id.generate_pairing, true, view ->
                host.perform("Generating pairing code…", api -> api.post(MY_DEVICES + "/pairings", new JSONObject()),
                    result -> {
                        host.pairing = result.optJSONObject("pairing");
                        host.render(true);
                    }, host::statusError, false));
        } else {
            detail(content, host.snapshot == null ? "Checking enrollment access…" : "This control plane has no provider enrollment API.", false);
        }
        button(content, "Open My Device", 0, false, view -> host.navigate(MainActivity.Screen.MY_DEVICE, null));
    }

    private void home(LinearLayout content) {
        heading(content, "Home", host.email());
        LinearLayout chart = ui.card(content);
        ui.add(chart, ui.heading("Earnings", 18), 0);
        JSONObject data = earningsData();
        if (data == null) {
            detail(chart, "No Devnet payout chart is available for this device.", false);
        } else {
            plot(chart, data, 5);
        }
        button(chart, "Open earnings chart", R.id.home_earnings_chart, false, view -> host.navigate(MainActivity.Screen.EARNINGS, null));

        LinearLayout device = ui.card(content);
        ui.add(device, ui.heading("Device readiness", 18), 0);
        JSONObject first = firstDevice();
        if (first == null) {
            detail(device, devices() == null ? "Waiting for provider device data." : "Pair a dedicated test device to get started.", false);
            button(device, "Enrollment", R.id.open_enrollment, true, view -> host.navigate(MainActivity.Screen.ENROLLMENT, null));
        } else {
            detail(device, title(first, "label", "Dedicated device") + " · " + status(string(first, "readiness")), false);
            named(device, "Connectivity", first, "connectivity");
            detail(device, first.optBoolean("marketplaceEligible") ? "Eligible for matching" : "Marketplace matching inactive", false);
            button(device, "My Device", R.id.open_my_device, false, view -> host.navigate(MainActivity.Screen.MY_DEVICE, string(first, "id")));
        }

        LinearLayout today = ui.card(content);
        ui.add(today, ui.heading("Today’s contributions", 18), 0);
        JSONArray runs = runs();
        if (runs == null) {
            detail(today, "Provider session data is unavailable.", false);
        } else {
            int completed = 0;
            JSONObject active = null;
            for (int index = 0; index < runs.length(); index++) {
                JSONObject run = runs.optJSONObject(index);
                if (ProviderApi.terminal(run) && occurredToday(string(run, "updatedAt"))) {
                    completed++;
                }
                if (active == null && ProviderApi.active(run)) {
                    active = run;
                }
            }
            detail(today, completed + (completed == 1 ? " session reached a terminal state" : " sessions reached a terminal state"), false);
            if (active != null) {
                JSONObject current = active;
                detail(today, "Current session · " + status(string(current, "state")), false);
                button(today, "Open current session", R.id.open_current_session, true, view -> host.openRun(current));
            } else {
                detail(today, "No current session.", false);
            }
        }
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
        ui.add(card, ui.heading(title(device, "label", "Dedicated device"), 18), 0);
        named(card, "Connectivity", device, "connectivity");
        named(card, "Readiness", device, "readiness");
        named(card, "Last heartbeat", device, "lastSeenAt");
        named(card, "Revoked", device, "revokedAt");
        JSONObject profile = device.optJSONObject("profile");
        if (profile != null) {
            ui.add(card, ui.heading("Capabilities", 16), 11);
            named(card, "Environment", profile, "kind");
            named(card, "Source", profile, "source");
            named(card, "Measured", profile, "measuredAt");
            named(card, "Manufacturer", profile, "manufacturer");
            named(card, "Model", profile, "model");
            named(card, "Android", profile, "androidVersion");
            named(card, "Available memory (bytes)", profile, "memoryAvailableBytes");
            named(card, "Free storage (bytes)", profile, "dataAvailableBytes");
            named(card, "Total storage (bytes)", profile, "dataTotalBytes");
            named(card, "Battery charge (%)", profile, "batteryPercent");
            named(card, "Battery temperature (°C)", profile, "batteryTemperatureC");
            named(card, "Network latency (ms)", profile, "networkLatencyMs");
            named(card, "Hardware attested", profile, "hardwareAttested");
            named(card, "Seeker verified", profile, "seekerVerified");
        }
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
        heading(content, "Activity", "Set participation and review work.");
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

        section(content, "In-app inbox");
        JSONArray notifications = host.snapshot == null ? null : host.snapshot.notifications;
        if (notifications == null || notifications.length() == 0) detail(content, "No inbox messages are available.", false);
        forEach(notifications, notification -> {
            LinearLayout card = ui.card(content);
            detail(card, status(string(notification, "type")), false);
            named(card, "Received", notification, "createdAt");
            if (string(notification, "readAt").isEmpty()) button(card, "Mark read", 0, false, view ->
                host.perform("Updating inbox…", api -> api.post(ProviderApi.item("/me/notifications", string(notification, "id")) + "/read",
                    new JSONObject()), result -> {}, host::statusError, true));
        });
        showRunGroup(content, "Running", false);
        showRunGroup(content, "History", true);
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

    private void session(LinearLayout content, boolean completed) {
        heading(content, completed ? "Completed Session" : "Active Session", "Provider-owned workload status and evidence.");
        JSONObject run = host.selectedRunOverride == null
            ? (host.snapshot == null ? null : host.snapshot.run) : host.selectedRunOverride;
        if (run == null || !string(run, "id").equals(host.selectedId)) {
            run = ProviderApi.find(runs(), host.selectedId);
        }
        if (run == null) {
            detail(content, "Loading session…", false);
            return;
        }
        JSONObject current = run;
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
        String state = string(run, "state");
        if (state.equals("stopping") || state.equals("cancelled") && stop != null && string(stop, "acknowledgedAt").isEmpty()) {
            detail(card, "Waiting for the runner to acknowledge termination. Stop locally on the runner if it is disconnected.", false);
        }
        if (!completed && !state.equals("stopping") && !state.equals("verifying")) {
            button(card, "Request stop", R.id.session_stop, true, view -> host.confirm("Request session stop?",
                "The runner must acknowledge the stop. Use the desktop runner’s local stop for emergencies.", "Request stop",
                () -> host.perform("Requesting stop…", api -> api.post(ProviderApi.item(MY_SESSIONS, string(current, "id")) + "/stop", new JSONObject()),
                    result -> host.openRun(result.optJSONObject("run")), host::statusError, true)));
        }
        showVerification(content, run);
        LinearLayout timeline = ui.card(content);
        ui.add(timeline, ui.heading("Timeline", 18), 0);
        JSONArray events = host.snapshot == null || !host.selectedId.equals(string(host.snapshot.run, "id"))
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
        JSONObject data = earningsData();
        LinearLayout summary = ui.card(content);
        ui.add(summary, ui.heading("Settled and pending", 18), 0);
        LinearLayout chart = ui.card(content);
        ui.add(chart, ui.heading("Earnings chart", 18), 0);
        if (data == null) {
            detail(summary, "Provider payout totals are unavailable for this device.", false);
            detail(chart, "No payout records are available for the chart.", false);
        } else {
            JSONObject total = data.optJSONObject("totals");
            detail(summary, "Settled · " + amount(data, total, "settledAtoms"), false);
            detail(summary, "Pending · " + amount(data, total, "pendingAtoms"), false);
            detail(summary, "Failed · " + amount(data, total, "failedAtoms"), false);
            detail(summary, "Needs review · " + amount(data, total, "needsReviewAtoms"), false);
            named(summary, "Cluster", data, "cluster");
            plot(chart, data, 10);
        }
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
        wallet(content);
    }

    private JSONObject earningsData() {
        return host.snapshot == null ? null : host.snapshot.earnings;
    }

    private void plot(LinearLayout chart, JSONObject data, int maximumRows) {
        JSONArray buckets = data.optJSONArray("buckets");
        if (buckets == null || buckets.length() == 0) {
            detail(chart, "No payout records for this period.", false);
            return;
        }
        int start = Math.max(0, buckets.length() - maximumRows);
        BigInteger maximum = BigInteger.ZERO;
        for (int index = start; index < buckets.length(); index++) {
            maximum = maximum.max(atoms(buckets.optJSONObject(index), "settledAtoms"));
        }
        for (int index = start; index < buckets.length(); index++) {
            JSONObject bucket = buckets.optJSONObject(index);
            detail(chart, string(bucket, "start") + "  ·  " + amount(data, bucket, "settledAtoms"), false);
            ProgressBar bar = new ProgressBar(host, null, android.R.attr.progressBarStyleHorizontal);
            bar.setIndeterminate(false);
            bar.setMax(100);
            bar.setProgress(maximum.signum() == 0 ? 0 : atoms(bucket, "settledAtoms").multiply(BigInteger.valueOf(100)).divide(maximum).intValue());
            bar.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            ui.add(chart, bar, 2);
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
        heading(content, "Profile", host.email());
        LinearLayout identity = ui.card(content);
        ui.add(identity, ui.heading("Account", 18), 0);
        JSONObject user = host.snapshot == null ? null : host.snapshot.user;
        named(identity, "Display name", user, "displayName");
        named(identity, "Account ID", user, "id");
        named(identity, "Developer capability", user == null ? null : user.optJSONObject("capabilities"), "developer");
        named(identity, "Provider capability", user == null ? null : user.optJSONObject("capabilities"), "provider");
        if (!string(user, "id").isEmpty()) {
            button(identity, "Copy account ID", 0, false, view -> host.copy("account ID", string(user, "id")));
            button(identity, "Edit display name", 0, false, view -> ProviderForms.displayName(host, user));
        }
        button(identity, "Developer portal", R.id.developer_portal, false, view -> host.openPortal(false));
        if (host.portal() != null) {
            button(identity, "Change developer portal", 0, false, view -> host.openPortal(true));
        }
        LinearLayout privacy = ui.card(content);
        ui.add(privacy, ui.heading("Privacy and consent", 18), 0);
        detail(privacy, "Review workload scope and allowed evidence before approving each invitation. Use only dedicated environments and disposable accounts.", false);
        wallet(content);
        button(content, "In-app notification preferences", 0, false, view -> host.notificationPreferences());
        button(content, "Sign out", R.id.auth_sign_out, false, view -> host.signOut(true));
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
        TextView title = ui.heading(heading, 30);
        title.setId(R.id.screen_title);
        ui.add(content, title, 7);
        detail(content, description, false);
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
