package app.agus.companion;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.net.URI;
import org.junit.Test;

public final class CompanionBoundariesTest {
    private static final String CODE = "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDx";
    private static final URI PORTAL = URI.create("https://portal.example");

    @Test public void releaseRequiresAnHttpsOriginWithoutCredentialsOrPath() {
        assertEquals("https://portal.example", ApiOrigin.parse(" https://PORTAL.example/ ", false).toString());
        assertThrows(IllegalArgumentException.class, () -> ApiOrigin.parse("http://127.0.0.1:8787", false));
        assertThrows(IllegalArgumentException.class, () -> ApiOrigin.parse("https://user@portal.example/", false));
        assertThrows(IllegalArgumentException.class, () -> ApiOrigin.parse("https://portal.example/api/v1", false));
        assertThrows(IllegalArgumentException.class, () -> ApiOrigin.parse("https://portal.example/?session=x", false));
    }

    @Test public void debugHttpIsLimitedToLocalTestHosts() {
        assertEquals("http://10.0.2.2:8787", ApiOrigin.parse("http://10.0.2.2:8787", true).toString());
        assertEquals("http://127.0.0.1:8787", ApiOrigin.parse("http://127.0.0.1:8787", true).toString());
        assertThrows(IllegalArgumentException.class, () -> ApiOrigin.parse("http://portal.example", true));
    }

    @Test public void acceptsOpaqueCodeOrExactConfiguredHttpsInviteLink() {
        assertEquals(CODE, InvitationCode.parse(CODE, null));
        assertEquals(CODE, InvitationCode.parse("https://portal.example:443/invite/" + CODE, PORTAL));
        assertThrows(IllegalArgumentException.class, () -> InvitationCode.parse("https://outside.example/invite/" + CODE, PORTAL));
        assertThrows(IllegalArgumentException.class, () -> InvitationCode.parse("https://portal.example:444/invite/" + CODE, PORTAL));
        assertThrows(IllegalArgumentException.class, () -> InvitationCode.parse("https://portal.example/invite/" + CODE + "?continue=/", PORTAL));
        assertThrows(IllegalArgumentException.class, () -> InvitationCode.parse("https://portal.example/invite/" + CODE, null));
    }

    @Test public void walletAddressRequiresAFullSolanaPublicKey() {
        assertEquals("11111111111111111111111111111111", SolanaAddress.encode(new byte[32]));
        byte[] bytes = new byte[32];
        bytes[31] = (byte) 57;
        assertEquals("1111111111111111111111111111111z", SolanaAddress.encode(bytes));
        assertThrows(IllegalArgumentException.class, () -> SolanaAddress.encode(new byte[31]));
    }

    @Test public void googleReturnRequiresTheExactOriginAndPendingAttempt() {
        String verifier = GoogleSignIn.verifier();
        String fragment = "#authCode=" + "a".repeat(43) + "&attempt=" + GoogleSignIn.challenge(verifier);
        assertNotNull(GoogleSignIn.callback(GoogleSignIn.ORIGIN.resolve("/auth/android" + fragment), verifier));
        assertNull(GoogleSignIn.callback(GoogleSignIn.ORIGIN.resolve("/auth/android" + fragment), GoogleSignIn.verifier()));
        assertNull(GoogleSignIn.callback(URI.create("https://outside.example/auth/android" + fragment), verifier));
        assertNull(GoogleSignIn.callback(GoogleSignIn.ORIGIN.resolve("/auth/android?code=unsafe" + fragment), verifier));
        assertTrue(GoogleSignIn.browserUrl(URI.create("https://accounts.google.com/o/oauth2/v2/auth?client_id=test")));
        assertFalse(GoogleSignIn.browserUrl(URI.create("https://accounts.google.com@outside.example/o/oauth2/v2/auth?client_id=test")));
    }
}
