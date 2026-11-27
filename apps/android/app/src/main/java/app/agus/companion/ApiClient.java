package app.agus.companion;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONException;
import org.json.JSONObject;

final class ApiClient {
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final OkHttpClient TRANSPORT = new OkHttpClient.Builder()
        .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
        .connectTimeout(8, TimeUnit.SECONDS).callTimeout(15, TimeUnit.SECONDS).build();
    private final URI origin;
    private final String token;

    ApiClient(URI origin, String token) {
        this.origin = origin;
        this.token = token;
    }

    JSONObject get(String route) throws IOException, JSONException {
        return request("GET", route, null);
    }

    JSONObject post(String route, JSONObject payload) throws IOException, JSONException {
        return request("POST", route, payload);
    }

    JSONObject patch(String route, JSONObject payload) throws IOException, JSONException {
        return request("PATCH", route, payload);
    }

    JSONObject delete(String route) throws IOException, JSONException {
        return request("DELETE", route, null);
    }

    private JSONObject request(String method, String route, JSONObject payload) throws IOException, JSONException {
        Request.Builder request = new Request.Builder().url(origin.resolve("/api/v1" + route).toString())
            .header("Accept", "application/json")
            .method(method, payload == null ? null : RequestBody.create(payload.toString(), JSON));
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }

        try (Response response = TRANSPORT.newCall(request.build()).execute()) {
            ResponseBody body = response.body();
            InputStream bytes = body == null ? null : body.byteStream();
            if (!response.isSuccessful()) {
                throw readError(bytes, response.code());
            }
            return readObject(bytes);
        }
    }

    private static ApiError readError(InputStream body, int status) {
        JSONObject error = null;
        try {
            error = readObject(body).optJSONObject("error");
        } catch (IOException | JSONException ignored) {
            // A non-JSON error still has a meaningful HTTP status.
        }
        return new ApiError(status, error == null ? "" : error.optString("code"),
            error == null ? "" : error.optString("message"));
    }

    private static JSONObject readObject(InputStream response) throws IOException, JSONException {
        if (response == null) {
            return new JSONObject();
        }
        try (InputStream body = response; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = body.read(buffer)) != -1) {
                if (bytes.size() + read > MAX_RESPONSE_BYTES) {
                    throw new IOException("API response is too large");
                }
                bytes.write(buffer, 0, read);
            }
            return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    static final class ApiError extends IOException {
        final int status;
        final String code;

        ApiError(int status, String code, String detail) {
            super(message(status, code, detail));
            this.status = status;
            this.code = code;
        }

        private static String message(int status, String code, String detail) {
            if (status >= 400 && status < 500 && !detail.trim().isEmpty() && detail.length() <= 240) {
                return detail;
            }
            switch (status) {
                case 400: return "Check the details and try again.";
                case 401: return "Sign-in details or session are invalid. Please sign in again.";
                case 403: return "Your account can't access this resource.";
                case 404: return "This resource isn't available. Refresh the workspace.";
                case 409: return code.startsWith("email")
                    ? "An account already uses this email address. Sign in to continue."
                    : "The request conflicts with the current state. Refresh and try again.";
                case 429: return "Too many requests. Wait a moment and try again.";
                default: return "The control plane returned HTTP " + status + ".";
            }
        }
    }
}
