package net.samitkumar.multi_tenant_salon.customer;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** A signed-in customer cancels or moves their own appointment — within the salon's rules, and only their own. */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
class CustomerBookingSelfServiceIntegrationTest {

    private static final String SESSION = "X-Customer-Session";

    @Autowired JdbcTemplate jdbc;

    RestTestClient client;
    UUID salonId;
    long serviceId;
    long staffId;
    String ann;
    String bob;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) throws Exception {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                        "VALUES (?, 'Self Service Salon', ?, 'Owner', 'owner@self.test', 'salon@self.test', '+100000000', now())",
                salonId, "self-" + salonId.toString().substring(0, 8));
        serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) " +
                "VALUES (?, 'Haircut', 'HAIR', 40, 'EUR', 60, true, now()) RETURNING id", Long.class, salonId);
        staffId = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) " +
                "VALUES (?, 'Sam Stylist', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salonId);
        for (var day : new String[]{"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"}) {
            jdbc.update("INSERT INTO staff_availability (salon_id, staff_id, day_of_week, start_time, end_time, available) VALUES (?, ?, ?, '09:00', '18:00', true)",
                    salonId, staffId, day);
        }
        ann = session("ann@example.com");
        bob = session("bob@example.com");
    }

    @Test
    void accountFlagsWhatTheCustomerMayDo() {
        long far = booking("ann@example.com", LocalDate.now().plusDays(7), "10:00", "CONFIRMED", "NOT_REQUIRED");
        var soon = LocalDateTime.now().plusHours(2);
        // A same-day slot can wrap past midnight in the last hours of the day; the date/time pair is what matters.
        long near = booking("ann@example.com", soon.toLocalDate(), soon.toLocalTime().withSecond(0).withNano(0).toString(), "CONFIRMED", "NOT_REQUIRED");
        long paid = booking("ann@example.com", LocalDate.now().plusDays(8), "10:00", "CONFIRMED", "PAID");
        long done = booking("ann@example.com", LocalDate.now().minusDays(3), "10:00", "COMPLETED", "NOT_REQUIRED");

        var account = account(ann);
        assertThat(flag(account, far, "canCancel")).isTrue();
        assertThat(flag(account, far, "canReschedule")).isTrue();
        assertThat(field(account, far, "blockedReason")).isNull();
        assertThat(flag(account, near, "canCancel")).isFalse();
        assertThat(flag(account, near, "canReschedule")).isFalse();
        assertThat(field(account, near, "blockedReason")).isEqualTo("TOO_LATE");
        assertThat(flag(account, paid, "canCancel")).as("paid online: only the salon refunds").isFalse();
        assertThat(flag(account, paid, "canReschedule")).isTrue();
        assertThat(field(account, paid, "blockedReason")).isEqualTo("PAID");
        assertThat(flag(account, done, "canCancel")).isFalse();
        assertThat(JsonPath.<Integer>read(account, "$.selfService.cancelNoticeHours")).isEqualTo(24);
    }

    @Test
    void cancelOnlyYourOwnWithinTheRules() {
        long mine = booking("ann@example.com", LocalDate.now().plusDays(7), "10:00", "CONFIRMED", "NOT_REQUIRED");
        long his = booking("bob@example.com", LocalDate.now().plusDays(7), "12:00", "CONFIRMED", "NOT_REQUIRED");
        long paid = booking("ann@example.com", LocalDate.now().plusDays(8), "10:00", "CONFIRMED", "PAID");
        var soon = LocalDateTime.now().plusHours(2);
        long near = booking("ann@example.com", soon.toLocalDate(), soon.toLocalTime().withSecond(0).withNano(0).toString(), "PENDING", "NOT_REQUIRED");

        cancel(ann, his).expectStatus().isNotFound();
        assertThat(status(his)).isEqualTo("CONFIRMED");
        cancel("not-a-session", mine).expectStatus().isUnauthorized();
        cancel(ann, near).expectStatus().isEqualTo(409);
        cancel(ann, paid).expectStatus().isEqualTo(409);

        cancel(ann, mine).expectStatus().isOk().expectBody()
                .jsonPath("$.status").isEqualTo("CANCELLED")
                .jsonPath("$.canCancel").isEqualTo(false);
        assertThat(status(mine)).isEqualTo("CANCELLED");
        cancel(ann, mine).expectStatus().isOk(); // repeating it is harmless

        // The salon can switch it off, or widen the window beyond this appointment.
        long again = booking("ann@example.com", LocalDate.now().plusDays(7), "15:00", "CONFIRMED", "NOT_REQUIRED");
        policy("{\"allowCancel\":true,\"cancelNoticeHours\":240,\"allowReschedule\":true,\"rescheduleNoticeHours\":24}").expectStatus().isOk();
        cancel(ann, again).expectStatus().isEqualTo(409);
        policy("{\"allowCancel\":false,\"cancelNoticeHours\":1,\"allowReschedule\":true,\"rescheduleNoticeHours\":24}").expectStatus().isOk();
        cancel(ann, again).expectStatus().isEqualTo(409);
        assertThat(status(again)).isEqualTo("CONFIRMED");
    }

    @Test
    void rescheduleToAnOfferedSlotOnly() {
        var date = LocalDate.now().plusDays(7);
        long mine = booking("ann@example.com", date, "10:00", "CONFIRMED", "NOT_REQUIRED");
        long his = booking("bob@example.com", date, "13:00", "CONFIRMED", "NOT_REQUIRED");
        var newDate = LocalDate.now().plusDays(9);

        reschedule(ann, his, newDate, "11:00", staffId).expectStatus().isNotFound();
        reschedule(bob, mine, newDate, "11:00", staffId).expectStatus().isNotFound();
        // 03:00 is outside the staff schedule; 13:00 on the original day is Bob's.
        reschedule(ann, mine, newDate, "03:00", staffId).expectStatus().isEqualTo(409);
        reschedule(ann, mine, date, "13:00", staffId).expectStatus().isEqualTo(409);
        reschedule(ann, mine, LocalDate.now().minusDays(1), "11:00", staffId).expectStatus().isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT start_time::text FROM booking WHERE id = ?", String.class, mine)).startsWith("10:00");

        reschedule(ann, mine, newDate, "11:00", staffId).expectStatus().isOk().expectBody()
                .jsonPath("$.appointmentDate").isEqualTo(newDate.toString())
                .jsonPath("$.startTime").isEqualTo("11:00:00")
                .jsonPath("$.endTime").isEqualTo("12:00:00")
                .jsonPath("$.status").isEqualTo("CONFIRMED");
        assertThat(jdbc.queryForObject("SELECT appointment_date FROM booking WHERE id = ?", LocalDate.class, mine)).isEqualTo(newDate);

        // The vacated slot is bookable again; the new one is not.
        reschedule(bob, his, date, "10:00", staffId).expectStatus().isOk();
        reschedule(bob, his, newDate, "11:00", staffId).expectStatus().isEqualTo(409);

        policy("{\"allowCancel\":true,\"cancelNoticeHours\":24,\"allowReschedule\":false,\"rescheduleNoticeHours\":24}").expectStatus().isOk();
        reschedule(ann, mine, newDate, "14:00", staffId).expectStatus().isEqualTo(409);
    }

    @Test
    void ownerPolicyIsValidatedAndDefaultsApply() {
        client.get().uri("/api/salon-admin/{id}/customer-self-service", salonId).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.allowCancel").isEqualTo(true)
                .jsonPath("$.cancelNoticeHours").isEqualTo(24)
                .jsonPath("$.allowReschedule").isEqualTo(true)
                .jsonPath("$.rescheduleNoticeHours").isEqualTo(24);
        policy("{\"allowCancel\":true,\"cancelNoticeHours\":-1,\"allowReschedule\":true,\"rescheduleNoticeHours\":24}").expectStatus().isBadRequest();
        policy("{\"allowCancel\":true,\"cancelNoticeHours\":24,\"allowReschedule\":true,\"rescheduleNoticeHours\":9999}").expectStatus().isBadRequest();
        policy("{\"allowCancel\":false,\"cancelNoticeHours\":0,\"allowReschedule\":true,\"rescheduleNoticeHours\":48}").expectStatus().isOk();
        client.get().uri("/api/salon-admin/{id}/customer-self-service", salonId).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.allowCancel").isEqualTo(false)
                .jsonPath("$.rescheduleNoticeHours").isEqualTo(48);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private RestTestClient.ResponseSpec cancel(String token, long bookingId) {
        return client.post().uri("/api/salon/{s}/account/bookings/{b}/cancel", salonId, bookingId).header(SESSION, token).exchange();
    }

    private RestTestClient.ResponseSpec reschedule(String token, long bookingId, LocalDate date, String time, Long staff) {
        return client.post().uri("/api/salon/{s}/account/bookings/{b}/reschedule", salonId, bookingId).header(SESSION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"appointmentDate\":\"" + date + "\",\"startTime\":\"" + time + "\",\"staffId\":" + staff + "}").exchange();
    }

    private RestTestClient.ResponseSpec policy(String json) {
        return client.put().uri("/api/salon-admin/{id}/customer-self-service", salonId).contentType(MediaType.APPLICATION_JSON).body(json).exchange();
    }

    private String account(String token) {
        var body = client.get().uri("/api/salon/{id}/account", salonId).header(SESSION, token).exchange()
                .expectStatus().isOk().expectBody().returnResult().getResponseBody();
        return new String(body, StandardCharsets.UTF_8);
    }

    private static boolean flag(String account, long bookingId, String field) {
        return (Boolean) JsonPath.<java.util.List<Object>>read(account, "$.bookings[?(@.id==" + bookingId + ")]." + field).get(0);
    }

    private static String field(String account, long bookingId, String field) {
        return (String) JsonPath.<java.util.List<Object>>read(account, "$.bookings[?(@.id==" + bookingId + ")]." + field).get(0);
    }

    private String status(long bookingId) {
        return jdbc.queryForObject("SELECT status FROM booking WHERE id = ?", String.class, bookingId);
    }

    private long booking(String email, LocalDate date, String start, String status, String paymentStatus) {
        var from = LocalTime.parse(start);
        return jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, appointment_date, start_time, end_time, " +
                        "status, payment_status, created_at) VALUES (?, ?, ?, 'Customer', ?, ?, ?, ?, ?, ?, now()) RETURNING id",
                Long.class, salonId, serviceId, staffId, email, date, java.sql.Time.valueOf(from), java.sql.Time.valueOf(from.plusHours(1)), status, paymentStatus);
    }

    /** A signed-in session, stored the way the API does: only the SHA-256 of the token. */
    private String session(String email) throws Exception {
        var token = "tok-" + UUID.randomUUID();
        var hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        jdbc.update("INSERT INTO customer_session (salon_id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)",
                salonId, email, hash, Timestamp.from(Instant.now().plus(1, ChronoUnit.DAYS)));
        return token;
    }
}
