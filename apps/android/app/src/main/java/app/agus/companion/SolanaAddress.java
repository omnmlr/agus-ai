package app.agus.companion;

import java.math.BigInteger;

final class SolanaAddress {
    private static final String BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    private static final BigInteger RADIX = BigInteger.valueOf(BASE58.length());

    private SolanaAddress() {}

    static String encode(byte[] publicKey) {
        if (publicKey == null || publicKey.length != 32) {
            throw new IllegalArgumentException("Expected a 32-byte Solana public key.");
        }
        StringBuilder result = new StringBuilder();
        BigInteger remaining = new BigInteger(1, publicKey);
        while (remaining.signum() > 0) {
            BigInteger[] quotientRemainder = remaining.divideAndRemainder(RADIX);
            result.append(BASE58.charAt(quotientRemainder[1].intValue()));
            remaining = quotientRemainder[0];
        }
        for (byte value : publicKey) {
            if (value != 0) {
                break;
            }
            result.append('1');
        }
        return result.reverse().toString();
    }
}
