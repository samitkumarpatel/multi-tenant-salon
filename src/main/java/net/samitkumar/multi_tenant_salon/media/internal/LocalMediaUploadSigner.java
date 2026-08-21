package net.samitkumar.multi_tenant_salon.media.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Signs and verifies the upload URLs handed out by {@link LocalMediaServiceImpl}, so the
 * local storage endpoint can check a request the same way S3 checks a real pre-signed URL's
 * signature — without one, any caller could PUT to any key with no proof they were ever
 * issued an upload grant.
 *
 * The signing secret is read from {@code spring.application.media.upload-signing-secret}
 * (set {@code MEDIA_UPLOAD_SIGNING_SECRET} explicitly for any multi-instance deployment,
 * since an unset secret falls back to a random value generated per instance).
 */
@Component
@ConditionalOnProperty(name = "spring.application.media.storage-type", havingValue = "LOCAL", matchIfMissing = true)
class LocalMediaUploadSigner {

    private static final String HMAC_ALGO = "HmacSHA256";

    private final byte[] secret;

    LocalMediaUploadSigner(@Value("${spring.application.media.upload-signing-secret:}") String configuredSecret) {
        this.secret = (configuredSecret == null || configuredSecret.isBlank())
                ? generateEphemeralSecret()
                : configuredSecret.getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] generateEphemeralSecret() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }

    String sign(String key, long expiresEpochSeconds) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            mac.init(new SecretKeySpec(secret, HMAC_ALGO));
            byte[] raw = mac.doFinal((key + ':' + expiresEpochSeconds).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(raw);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to sign media upload URL", e);
        }
    }

    boolean isValid(String key, long expiresEpochSeconds, String signature) {
        if (signature == null || expiresEpochSeconds < System.currentTimeMillis() / 1000) return false;
        String expected = sign(key, expiresEpochSeconds);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }
}
