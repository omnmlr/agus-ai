package app.agus.companion;

import android.net.Uri;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Objects;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class ProviderApi {
    static final String MY_DEVICES = "/me/devices";
    static final String MY_SESSIONS = "/me/sessions";
    static final String INVITATIONS = "/invitations";
    static final String MARKETPLACE = "/marketplace/jobs";
    final ApiClient client;

    ProviderApi(ApiClient client) {
        this.client = client;
    }

    Snapshot load(String sessionId, String deviceId, boolean marketplace, boolean payouts, boolean inbox) throws IOException, JSONException {
        JSONObject user = client.get("/auth/me").getJSONObject("user");
        JSONArray devices = optionalArray(MY_DEVICES, "devices");
        JSONArray runs = optionalArray(MY_SESSIONS, "runs");
        JSONArray invitations = optionalArray(INVITATIONS, "invitations");
        JSONObject device = find(devices, deviceId);
        if (device == null || !string(device, "revokedAt").isEmpty()) {
            device = firstDevice(devices);
        }
        String scope = string(device, "id");
        JSONArray jobs = null;
        JSONObject earnings = null;
        if (!scope.isEmpty() && marketplace) {
            jobs = optionalArray(MARKETPLACE + "?deviceId=" + Uri.encode(scope), "jobs");
        }
        if (!scope.isEmpty() && payouts) {
            LocalDate today = LocalDate.now(ZoneOffset.UTC);
            String path = "/me/earnings?deviceId=" + Uri.encode(scope) + "&from=" + today.minusDays(29) + "&to=" + today + "&bucket=day";
            try {
                earnings = client.get(path).optJSONObject("earnings");
            } catch (ApiClient.ApiError unavailable) {
                if (unavailable.status != 404 && !unavailable.code.equals("payment_unavailable")) {
                    throw unavailable;
                }
            }
        }
        JSONArray notifications = inbox ? optionalArray("/me/notifications", "notifications") : null;
        JSONObject run = null;
        JSONArray events = null;
        if (sessionId != null) {
            String path = item(MY_SESSIONS, sessionId);
            run = client.get(path).getJSONObject("run");
            events = client.get(path + "/events").getJSONArray("events");
        }
        return new Snapshot(user, devices, runs, invitations, run, events, scope, jobs, earnings, notifications);
    }

    private JSONArray optionalArray(String route, String key) throws IOException, JSONException {
        try {
            return client.get(route).getJSONArray(key);
        } catch (ApiClient.ApiError missing) {
            if (missing.status == 404) {
                return null;
            }
            throw missing;
        }
    }

    static String item(String route, String id) {
        return route + "/" + Uri.encode(id);
    }

    static String string(JSONObject object, String key) {
        if (object == null || object.isNull(key)) {
            return "";
        }
        Object value = object.opt(key);
        return value instanceof String || value instanceof Number || value instanceof Boolean ? value.toString() : "";
    }

    static JSONObject find(JSONArray items, String id) {
        if (items != null && id != null) {
            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.optJSONObject(index);
                if (id.equals(string(item, "id"))) {
                    return item;
                }
            }
        }
        return null;
    }

    static JSONObject firstDevice(JSONArray devices) {
        if (devices != null) {
            for (int index = 0; index < devices.length(); index++) {
                JSONObject device = devices.optJSONObject(index);
                if (device != null && string(device, "revokedAt").isEmpty()) {
                    return device;
                }
            }
        }
        return null;
    }

    static boolean active(JSONObject run) {
        String state = string(run, "state");
        return state.equals("reserved") || state.equals("preparing") || state.equals("running")
            || state.equals("awaiting_approval") || state.equals("stopping") || state.equals("verifying");
    }

    static boolean terminal(JSONObject run) {
        String state = string(run, "state");
        return state.equals("passed") || state.equals("failed") || state.equals("unverified")
            || state.equals("cancelled") || state.equals("expired");
    }

    static final class Snapshot {
        final JSONObject user;
        final JSONArray devices;
        final JSONArray runs;
        final JSONArray invitations;
        final JSONObject run;
        final JSONArray events;
        final String deviceScope;
        final JSONArray jobs;
        final JSONObject earnings;
        final JSONArray notifications;

        Snapshot(JSONObject user, JSONArray devices, JSONArray runs, JSONArray invitations, JSONObject run, JSONArray events,
            String deviceScope, JSONArray jobs, JSONObject earnings, JSONArray notifications) {
            this.user = user;
            this.devices = devices;
            this.runs = runs;
            this.invitations = invitations;
            this.run = run;
            this.events = events;
            this.deviceScope = deviceScope;
            this.jobs = jobs;
            this.earnings = earnings;
            this.notifications = notifications;
        }

        boolean sameAs(Snapshot other) {
            return sameJson(user, other.user) && sameJson(devices, other.devices) && sameJson(runs, other.runs)
                && sameJson(invitations, other.invitations) && sameJson(run, other.run) && sameJson(events, other.events)
                && deviceScope.equals(other.deviceScope) && sameJson(jobs, other.jobs) && sameJson(earnings, other.earnings) && sameJson(notifications, other.notifications);
        }

        private static boolean sameJson(Object first, Object second) {
            return Objects.toString(first).equals(Objects.toString(second));
        }
    }
}
