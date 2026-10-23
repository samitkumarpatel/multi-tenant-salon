package net.samitkumar.multi_tenant_salon.customer.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.customer.CustomerSignInCodeRequestedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Passwordless sign-in for customers: an emailed six-digit code proves the visitor controls an email
 * address, for one salon, and buys a session token scoped to that {@code (salon, email)}.
 *
 * <p>Sign-in never says whether the salon knows the address — the response is the same either way —
 * so the endpoint can't be used to list a salon's customers. A code is only emailed when the address
 * has something in the salon. Codes and tokens are stored as SHA-256 hashes only. Requests are capped
 * per address and per client IP, and each code allows a few wrong guesses before it stops working.
 */
@Service
@Slf4j
class CustomerAuthService {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Duration EMAIL_WINDOW = Duration.ofMinutes(15);
    private static final Duration IP_WINDOW = Duration.ofHours(1);

    private final SecureRandom random = new SecureRandom();
    private final JdbcClient jdbc;
    private final CustomerAccountService accounts;
    private final ApplicationEventPublisher events;
    private final Duration codeTtl;
    private final Duration sessionTtl;
    private final int maxCodesPerEmail;
    private final int maxRequestsPerIp;
    private final int maxCodeAttempts;

    CustomerAuthService(JdbcTemplate template, CustomerAccountService accounts, ApplicationEventPublisher events,
                        @Value("${spring.application.customer.code-ttl:PT10M}") Duration codeTtl,
                        @Value("${spring.application.customer.session-ttl:P30D}") Duration sessionTtl,
                        @Value("${spring.application.customer.max-codes-per-email:5}") int maxCodesPerEmail,
                        @Value("${spring.application.customer.max-requests-per-ip:30}") int maxRequestsPerIp,
                        @Value("${spring.application.customer.max-code-attempts:5}") int maxCodeAttempts) {
        this.jdbc = JdbcClient.create(template);
        this.accounts = accounts;
        this.events = events;
        this.codeTtl = codeTtl;
        this.sessionTtl = sessionTtl;
        this.maxCodesPerEmail = maxCodesPerEmail;
        this.maxRequestsPerIp = maxRequestsPerIp;
        this.maxCodeAttempts = maxCodeAttempts;
    }

    record Session(String token, String email, Instant expiresAt) {}

    /**
     * Emails a code when the salon has bookings, orders or memberships under {@code rawEmail}; does
     * nothing visible otherwise. Only too many requests from one client IP is reported (429) — that
     * reveals nothing about any address.
     */
    @Transactional
    void requestCode(UUID salonId, String rawEmail, String clientIp) {
        var email = normalize(rawEmail);
        var now = Instant.now();
        if (clientIp != null && countSince("client_ip = :key", clientIp, now.minus(IP_WINDOW)) >= maxRequestsPerIp) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many sign-in attempts. Please try again later.");
        }
        var salon = accounts.activeSalon(salonId);
        boolean throttled = countSince("salon_id = :salon AND email = :key", email, now.minus(EMAIL_WINDOW), salonId) >= maxCodesPerEmail;
        boolean known = !throttled && accounts.hasHistory(salonId, email);
        var code = known ? newCode() : null;
        var expiresAt = now.plus(codeTtl);
        // Unknown and throttled requests are recorded too (without a code) so they count against the limits.
        jdbc.sql("""
                        INSERT INTO customer_sign_in_code (salon_id, email, code_hash, client_ip, created_at, expires_at)
                        VALUES (:salon, :email, :hash, :ip, :now, :expires)""")
                .param("salon", salonId).param("email", email).param("hash", code == null ? null : hash(salonId, email, code))
                .param("ip", clientIp).param("now", ts(now)).param("expires", ts(expiresAt))
                .update();
        if (code == null) {
            log.info("[CUSTOMER] Sign-in requested for salon {} — {}", salonId, throttled ? "throttled" : "no history, no code sent");
            return;
        }
        // A newer code replaces any older one still open, so only the latest email works.
        jdbc.sql("""
                        UPDATE customer_sign_in_code SET consumed_at = :now
                        WHERE salon_id = :salon AND email = :email AND consumed_at IS NULL AND code_hash IS NOT NULL
                          AND code_hash <> :hash""")
                .param("now", ts(now)).param("salon", salonId).param("email", email).param("hash", hash(salonId, email, code))
                .update();
        events.publishEvent(new CustomerSignInCodeRequestedEvent(salonId, salon.name(),
                salon.contact() == null ? null : salon.contact().phone(),
                salon.contact() == null ? null : salon.contact().email(),
                email, code, expiresAt));
    }

    /**
     * Trades a correct, unexpired code for a session. Any failure is the same 401, whatever the cause.
     * A wrong guess must still count against the code, so it doesn't roll the transaction back.
     */
    @Transactional(noRollbackFor = WrongCodeException.class)
    Session verify(UUID salonId, String rawEmail, String rawCode) {
        var email = normalize(rawEmail);
        var code = rawCode == null ? "" : rawCode.replaceAll("\\s", "");
        var now = Instant.now();
        var latest = jdbc.sql("""
                        SELECT id, code_hash, attempts FROM customer_sign_in_code
                        WHERE salon_id = :salon AND email = :email AND code_hash IS NOT NULL
                          AND consumed_at IS NULL AND expires_at > :now
                        ORDER BY created_at DESC LIMIT 1 FOR UPDATE""")
                .param("salon", salonId).param("email", email).param("now", ts(now))
                .query((rs, i) -> new OpenCode(rs.getLong("id"), rs.getString("code_hash"), rs.getInt("attempts")))
                .optional()
                .orElseThrow(CustomerAuthService::invalidCode);
        if (latest.attempts() >= maxCodeAttempts) throw invalidCode();
        if (!MessageDigest.isEqual(latest.codeHash().getBytes(StandardCharsets.US_ASCII),
                hash(salonId, email, code).getBytes(StandardCharsets.US_ASCII))) {
            // The row is locked FOR UPDATE above, so concurrent guesses can't both slip under the cap.
            jdbc.sql("UPDATE customer_sign_in_code SET attempts = attempts + 1 WHERE id = :id")
                    .param("id", latest.id()).update();
            throw new WrongCodeException();
        }
        jdbc.sql("UPDATE customer_sign_in_code SET consumed_at = :now WHERE id = :id")
                .param("now", ts(now)).param("id", latest.id()).update();

        var token = newToken();
        var expiresAt = now.plus(sessionTtl);
        jdbc.sql("""
                        INSERT INTO customer_session (salon_id, email, token_hash, created_at, expires_at)
                        VALUES (:salon, :email, :hash, :now, :expires)""")
                .param("salon", salonId).param("email", email).param("hash", sha256(token))
                .param("now", ts(now)).param("expires", ts(expiresAt))
                .update();
        log.info("[CUSTOMER] Signed in to salon {} (session until {})", salonId, expiresAt);
        return new Session(token, email, expiresAt);
    }

    /** The email a live session for this salon is signed in as, or 401. */
    String requireEmail(UUID salonId, String token) {
        if (!StringUtils.hasText(token)) throw unauthenticated();
        var now = Instant.now();
        return jdbc.sql("""
                        UPDATE customer_session SET last_seen_at = :now
                        WHERE token_hash = :hash AND salon_id = :salon AND revoked_at IS NULL AND expires_at > :now
                        RETURNING email""")
                .param("now", ts(now)).param("hash", sha256(token)).param("salon", salonId)
                .query(String.class)
                .optional()
                .orElseThrow(CustomerAuthService::unauthenticated);
    }

    /** Ends the session; signing out twice, or with a dead token, is not an error. */
    void signOut(UUID salonId, String token) {
        if (!StringUtils.hasText(token)) return;
        jdbc.sql("UPDATE customer_session SET revoked_at = :now WHERE token_hash = :hash AND salon_id = :salon AND revoked_at IS NULL")
                .param("now", ts(Instant.now())).param("hash", sha256(token)).param("salon", salonId)
                .update();
    }

    Duration codeTtl() { return codeTtl; }

    private record OpenCode(long id, String codeHash, int attempts) {}

    /** A wrong guess — the 401 that still commits its attempt counter. */
    static final class WrongCodeException extends ResponseStatusException {
        WrongCodeException() { super(HttpStatus.UNAUTHORIZED, "That code is wrong or has expired."); }
    }

    private long countSince(String where, String key, Instant since) {
        return countSince(where, key, since, null);
    }

    private long countSince(String where, String key, Instant since, UUID salonId) {
        var sql = jdbc.sql("SELECT count(*) FROM customer_sign_in_code WHERE " + where + " AND created_at > :since")
                .param("key", key).param("since", ts(since));
        if (salonId != null) sql = sql.param("salon", salonId);
        return sql.query(Long.class).single();
    }

    private String normalize(String rawEmail) {
        var email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        return email;
    }

    private String newCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private String newToken() {
        var bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Salted with the salon and address, so equal codes never share a hash. */
    private static String hash(UUID salonId, String email, String code) {
        return sha256(salonId + ":" + email + ":" + code);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** pgjdbc can't bind java.time.Instant through JdbcClient; OffsetDateTime maps to timestamptz. */
    private static OffsetDateTime ts(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }

    private static ResponseStatusException invalidCode() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "That code is wrong or has expired.");
    }

    private static ResponseStatusException unauthenticated() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }
}
