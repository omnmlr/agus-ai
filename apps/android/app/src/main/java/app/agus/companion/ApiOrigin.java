package app.agus.companion;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

final class ApiOrigin {
    private ApiOrigin() {}

    static URI parse(String value, boolean debug) {
        try {
            URI input = new URI(value.trim());
            String scheme = input.getScheme();
            String host = input.getHost();
            String path = input.getRawPath();
            if (scheme == null || host == null || input.getRawUserInfo() != null
                || input.getRawQuery() != null || input.getRawFragment() != null
                || (!path.isEmpty() && !path.equals("/")) || input.getPort() == 0
                || input.getPort() > 65535) {
                throw invalid();
            }
            scheme = scheme.toLowerCase(Locale.ROOT);
            host = host.toLowerCase(Locale.ROOT);
            if (!scheme.equals("https") && !(debug && scheme.equals("http") && isDebugHost(host))) {
                throw invalid();
            }
            return new URI(scheme, null, host, input.getPort(), null, null, null);
        } catch (URISyntaxException invalid) {
            throw invalid();
        }
    }

    private static boolean isDebugHost(String host) {
        return host.equals("127.0.0.1") || host.equals("localhost") || host.equals("10.0.2.2");
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("Enter an HTTPS control-plane origin without a path or credentials.");
    }
}
