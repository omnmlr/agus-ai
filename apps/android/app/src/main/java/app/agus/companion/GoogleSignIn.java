package app.agus.companion;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class GoogleSignIn {
    static final URI ORIGIN = URI.create("https://agusai.grindcity.app");
    private static final Pattern RETURN = Pattern.compile(
        "(authCode=[A-Za-z0-9_-]{43}|authError=(google_declined|google_unavailable|registration_required))&attempt=([a-f0-9]{64})");

    private GoogleSignIn() {}

    static String verifier() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return hex(bytes);
    }

    static String challenge(String verifier) {
        try {
            return hex(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String hex(byte[] bytes) {
        final String alphabet = "0123456789abcdef";
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(alphabet.charAt((value & 0xff) >>> 4)).append(alphabet.charAt(value & 15));
        return result.toString();
    }

    static boolean browserUrl(URI uri) {
        return "https".equals(uri.getScheme()) && "accounts.google.com".equals(uri.getRawAuthority())
            && "/o/oauth2/v2/auth".equals(uri.getRawPath()) && uri.getRawQuery() != null && uri.getRawFragment() == null;
    }

    static Matcher callback(URI uri, String verifier) {
        if (!"https".equals(uri.getScheme()) || !ORIGIN.getRawAuthority().equals(uri.getRawAuthority())
            || !"/auth/android".equals(uri.getRawPath()) || uri.getRawQuery() != null || uri.getRawFragment() == null) return null;
        Matcher result = RETURN.matcher(uri.getRawFragment());
        return result.matches() && result.group(3).equals(challenge(verifier)) ? result : null;
    }
}
