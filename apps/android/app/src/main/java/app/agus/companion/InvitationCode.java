package app.agus.companion;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Pattern;

final class InvitationCode {
    private static final Pattern CODE = Pattern.compile("[A-Za-z0-9_-]{43}");

    private InvitationCode() {}

    static String appLink(String value) {
        try {
            URI link = new URI(value);
            if ("https".equals(link.getScheme()) && GoogleSignIn.ORIGIN.getRawAuthority().equals(link.getRawAuthority())
                && link.getRawQuery() == null && link.getRawFragment() == null && link.getRawPath().startsWith("/invite/")) {
                String code = link.getRawPath().substring("/invite/".length());
                if (CODE.matcher(code).matches()) return code;
            }
        } catch (URISyntaxException invalid) {
            // Ignore untrusted intents that do not match the published App Link.
        }
        return null;
    }

    static String parse(String value, URI portal) {
        String text = value.trim();
        if (CODE.matcher(text).matches()) {
            return text;
        }
        try {
            URI link = new URI(text);
            if (portal != null && "https".equals(link.getScheme()) && "https".equals(portal.getScheme())
                && portal.getHost().equalsIgnoreCase(link.getHost()) && effectivePort(portal) == effectivePort(link)
                && link.getRawUserInfo() == null && link.getRawQuery() == null && link.getRawFragment() == null
                && link.getRawPath().startsWith("/invite/")) {
                String code = link.getRawPath().substring("/invite/".length());
                if (CODE.matcher(code).matches()) {
                    return code;
                }
            }
        } catch (URISyntaxException invalid) {
            // The same prompt covers malformed links and unknown origins.
        }
        throw new IllegalArgumentException("Enter the private code or a link from the configured developer portal.");
    }

    private static int effectivePort(URI origin) {
        return origin.getPort() < 0 ? 443 : origin.getPort();
    }
}
