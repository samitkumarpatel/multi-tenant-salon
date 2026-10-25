package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.booking.BookingPaymentLinkEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** A payment link sent after the visit settles the money without touching the visit's outcome. */
@SpringBootTest(properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
@RecordApplicationEvents
class BookingPaymentLinkTest {
    @Autowired BookingService service;
    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationEvents events;

    UUID salonId;
    long serviceId;
    long staffId;

    @BeforeEach void setup() {
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, address, city, zip_code, country, created_at)"
                + " VALUES (?, 'Glow Studio', ?, 'Main St 1', 'Copenhagen', '2100', 'Denmark', now())", salonId, "glow-" + salonId);
        serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, created_at)"
                + " VALUES (?, 'Cut', 40.00, 'EUR', 30, 'HAIR', now()) RETURNING id", Long.class, salonId);
        staffId = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at)"
                + " VALUES (?, 'Ida', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salonId);
    }

    private long booking(String status, String paymentStatus) {
        return jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email,"
                        + " appointment_date, start_time, end_time, status, payment_status, created_at)"
                        + " VALUES (?, ?, ?, 'Eva', 'eva@example.com', ?, '10:00', '10:30', ?, ?, now()) RETURNING id", Long.class,
                salonId, serviceId, staffId, LocalDate.now().minusDays(1), status, paymentStatus);
    }

    private String column(long id, String column) {
        return jdbc.queryForObject("SELECT " + column + " FROM booking WHERE id = ?", String.class, id);
    }

    @Test void paidNoShowKeepsItsStatus() {
        long id = booking("NO_SHOW", "NOT_REQUIRED");

        assertThat(service.beginPaymentLink(salonId, id)).contains("NOT_REQUIRED");
        assertThat(column(id, "payment_status")).isEqualTo("PENDING");

        service.recordStripePayment(salonId, id, "cs_1", true);

        assertThat(column(id, "payment_status")).isEqualTo("PAID");
        assertThat(column(id, "status")).isEqualTo(BookingStatus.NO_SHOW.name());
    }

    @Test void failedPaymentDoesNotCancelANoShowAndTheLinkCanBeSentAgain() {
        long id = booking("NO_SHOW", "NOT_REQUIRED");
        service.beginPaymentLink(salonId, id);

        service.recordStripePayment(salonId, id, "cs_1", false);

        assertThat(column(id, "payment_status")).isEqualTo("FAILED");
        assertThat(column(id, "status")).isEqualTo("NO_SHOW");
        assertThat(service.beginPaymentLink(salonId, id)).contains("FAILED");
        // Sending the same unpaid link twice is allowed too.
        assertThat(service.beginPaymentLink(salonId, id)).contains("PENDING");
    }

    @Test void paidAndCancelledAppointmentsCannotBeBilled() {
        assertThat(service.beginPaymentLink(salonId, booking("NO_SHOW", "PAID"))).isEmpty();
        assertThat(service.beginPaymentLink(salonId, booking("CANCELLED", "NOT_REQUIRED"))).isEmpty();
        assertThat(service.beginPaymentLink(UUID.randomUUID(), booking("NO_SHOW", "NOT_REQUIRED"))).isEmpty();
    }

    @Test void abandoningRestoresThePreviousPaymentStatus() {
        long id = booking("NO_SHOW", "NOT_REQUIRED");
        var previous = service.beginPaymentLink(salonId, id).orElseThrow();

        service.abandonPaymentLink(salonId, id, previous);

        assertThat(column(id, "payment_status")).isEqualTo("NOT_REQUIRED");
    }

    @Test void fullRefundMarksOnlyPaidAppointmentsRefunded() {
        long paid = booking("CANCELLED", "PAID");
        long unpaid = booking("CANCELLED", "NOT_REQUIRED");

        service.markRefunded(salonId, paid);
        service.markRefunded(salonId, unpaid);

        assertThat(column(paid, "payment_status")).isEqualTo("REFUNDED");
        assertThat(column(unpaid, "payment_status")).isEqualTo("NOT_REQUIRED");
    }

    @Test void emailingTheLinkPublishesTheEvent() {
        long id = booking("NO_SHOW", "NOT_REQUIRED");
        var booking = service.findById(salonId, id).orElseThrow();

        service.sendPaymentLink(booking, "Cut", new BigDecimal("40.00"), "EUR", "https://checkout.stripe.com/c/pay/cs_1");

        assertThat(events.stream(BookingPaymentLinkEvent.class)).singleElement().satisfies(event -> {
            assertThat(event.bookingId()).isEqualTo(id);
            assertThat(event.customerEmail()).isEqualTo("eva@example.com");
            assertThat(event.paymentUrl()).isEqualTo("https://checkout.stripe.com/c/pay/cs_1");
            assertThat(event.salonName()).isEqualTo("Glow Studio");
        });
    }
}
