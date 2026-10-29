package net.samitkumar.multi_tenant_salon.rating.internal;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
class PublicFeedbackController {
    private final JdbcClient jdbc;
    private final SalonApi salons;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private record Window(long start, int count) {}
    record Settings(boolean publicWebsiteEnabled) {}
    record Submission(@Size(max = 120) String customerName, Long staffId, Integer salonRating, Integer staffRating,
                      @Size(max = 1000) String salonFeedback, @Size(max = 1000) String staffFeedback, String source,
                      @Size(max = 200) String website) {}
    record Receipt(String token) {}
    record Feedback(Integer salonRating, Integer staffRating, String salonFeedback, String staffFeedback, String reply, Instant repliedAt) {}
    record Reply(@Size(max = 1000) String reply) {}

    PublicFeedbackController(JdbcClient jdbc, SalonApi salons) { this.jdbc = jdbc; this.salons = salons; }

    @GetMapping({"/api/salon/{salonId}/feedback-settings", "/api/salon-admin/{salonId}/feedback-settings"})
    ResponseEntity<Settings> settings(@PathVariable String salonId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Settings(enabled(salons.resolveId(salonId))));
    }

    @PutMapping("/api/salon-admin/{salonId}/feedback-settings")
    Settings saveSettings(@PathVariable String salonId, @RequestBody Settings settings) {
        jdbc.sql("INSERT INTO feedback_settings(salon_id,public_website_enabled) VALUES (:id,:enabled) ON CONFLICT(salon_id) DO UPDATE SET public_website_enabled=EXCLUDED.public_website_enabled")
                .param("id", salons.resolveId(salonId)).param("enabled", settings.publicWebsiteEnabled()).update();
        return settings;
    }

    @PostMapping("/api/salon/{salonId}/feedback")
    @Transactional
    ResponseEntity<Receipt> submit(@PathVariable String salonId, @Valid @RequestBody Submission body, HttpServletRequest request) {
        var id = salons.resolveId(salonId);
        // This describes the entry point only; it never claims a verified appointment.
        String source = body.source() == null ? "PUBLIC_WEBSITE" : body.source();
        if (!Set.of("PUBLIC_WEBSITE", "WEBSITE_FOOTER", "WEBSITE_STYLIST", "NOTIFICATION").contains(source)) badRequest();
        jdbc.sql("SELECT id FROM salon WHERE id=:id AND status <> 'DISABLED' FOR UPDATE").param("id", id)
                .query(UUID.class).optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!source.equals("NOTIFICATION") && !enabled(id)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Website feedback is disabled.");
        throttle(id + ":" + request.getRemoteAddr());
        if (text(body.website()) != null) badRequest(); // Honeypot: excluded from keyboard and screen reader navigation.
        if (!RatingService.validRating(body.salonRating()) || !RatingService.validRating(body.staffRating())) badRequest();
        if (body.salonRating() == null && body.staffRating() == null && text(body.salonFeedback()) == null && text(body.staffFeedback()) == null) badRequest();
        if (body.staffId() == null && (body.staffRating() != null || text(body.staffFeedback()) != null)) badRequest();
        if (body.staffId() != null && jdbc.sql("SELECT id FROM staff_member WHERE id=:staff AND salon_id=:salon AND status='ACTIVE'")
                .param("staff", body.staffId()).param("salon", id).query(Long.class).optional().isEmpty()) badRequest();
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.sql("""
                INSERT INTO customer_feedback(salon_id,staff_id,customer_name,salon_rating,staff_rating,salon_feedback,staff_feedback,source,receipt_hash)
                VALUES (:salon,:staff,:name,:salonRating,:staffRating,:salonFeedback,:staffFeedback,:source,:receipt)
                """).param("salon", id).param("staff", body.staffId()).param("name", text(body.customerName()))
                .param("salonRating", body.salonRating()).param("staffRating", body.staffRating())
                .param("salonFeedback", text(body.salonFeedback())).param("staffFeedback", text(body.staffFeedback()))
                .param("source", source).param("receipt", hash(token)).update();
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(new Receipt(token));
    }

    /** A private receipt, available only to the customer holding its random credential. */
    @GetMapping("/api/salon/{salonId}/feedback/{token}")
    ResponseEntity<Feedback> receipt(@PathVariable String salonId, @PathVariable String token) {
        var result = jdbc.sql("SELECT * FROM customer_feedback WHERE salon_id=:salon AND receipt_hash=:hash")
                .param("salon", salons.resolveId(salonId)).param("hash", hash(token)).query((rs, row) -> new Feedback(
                        rs.getObject("salon_rating", Integer.class), rs.getObject("staff_rating", Integer.class),
                        rs.getString("salon_feedback"), rs.getString("staff_feedback"), rs.getString("reply"),
                        rs.getTimestamp("replied_at") == null ? null : rs.getTimestamp("replied_at").toInstant())).optional();
        return result.map(value -> ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{salonId}/feedback/{feedbackId}/reply")
    ResponseEntity<Void> reply(@PathVariable String salonId, @PathVariable long feedbackId, @Valid @RequestBody Reply body) {
        if (text(body.reply()) == null) badRequest();
        int updated = jdbc.sql("UPDATE customer_feedback SET reply=:reply,replied_at=now() WHERE salon_id=:salon AND id=:id")
                .param("reply", text(body.reply())).param("salon", salons.resolveId(salonId)).param("id", feedbackId).update();
        return updated == 1 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    private boolean enabled(UUID id) {
        return jdbc.sql("SELECT public_website_enabled FROM feedback_settings WHERE salon_id=:id").param("id", id)
                .query(Boolean.class).optional().orElse(true);
    }
    private void throttle(String key) {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(entry -> now - entry.getValue().start() > 900_000);
        if (windows.size() >= 10_000 && !windows.containsKey(key)) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
        var window = windows.compute(key, (ignored, old) -> old == null ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
        if (window.count() > 10) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Please try again later.");
    }
    private static String text(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static void badRequest() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose 1–5 stars or write feedback, and select a stylist when rating staff."); }
    private static String hash(String value) {
        try { return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
