package net.samitkumar.multi_tenant_salon.rating;

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

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Customers leave stars + feedback, the owner replies, and nobody can rewrite the customer's words. */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
class RatingFeedbackIntegrationTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired RatingApi ratings;

    RestTestClient client;
    UUID salonId;
    long staffId;
    long bookingId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                "VALUES (?, 'Rating Salon', ?, 'Owner', 'owner@rating.test', 'salon@rating.test', '+100000000', now())",
                salonId, "rate-" + salonId.toString().substring(0, 8));
        long serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) " +
                "VALUES (?, 'Haircut', 'HAIR', 40, 'EUR', 60, true, now()) RETURNING id", Long.class, salonId);
        staffId = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) " +
                "VALUES (?, 'Sam Stylist', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salonId);
        bookingId = jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, customer_phone, appointment_date, " +
                "start_time, end_time, status, created_at) VALUES (?, ?, ?, 'Eve', 'eve@example.com', '+4500000000', ?, '10:00', '11:00', 'COMPLETED', now()) RETURNING id",
                Long.class, salonId, serviceId, staffId, LocalDate.now().minusDays(2));
    }

    @Test
    void feedbackIsKeptAndOwnerReplyNeverRewritesIt() {
        assertThat(ratings.getCustomerRatingOptions(salonId, "eve@example.com")).singleElement()
                .satisfies(option -> assertThat(option.submitted()).isFalse());

        assertThat(ratings.submitCustomerReview(salonId, "eve@example.com", bookingId, 5, 4, "  Lovely cut!  ")).isTrue();
        assertThat(ratings.submitCustomerReview(salonId, "eve@example.com", bookingId, 1, 1, "changed my mind")).as("first submission wins").isFalse();
        assertThat(ratings.submitCustomerReview(salonId, "someone@else.com", bookingId, 5, 5, "x")).as("not their visit").isFalse();

        // Replying needs text and an existing salon.
        client.put().uri("/api/salon-admin/{s}/ratings/{b}/reply", salonId, bookingId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "  ")).exchange().expectStatus().isBadRequest();
        client.put().uri("/api/salon-admin/{s}/ratings/{b}/reply", UUID.randomUUID(), bookingId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "hi")).exchange().expectStatus().isNotFound();
        client.put().uri("/api/salon-admin/{s}/ratings/{b}/reply", salonId, bookingId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "Thank you Eve!")).exchange().expectStatus().isNoContent();
        client.put().uri("/api/salon-admin/{s}/ratings/{b}/reply", salonId, bookingId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "See you soon!")).exchange().expectStatus().isNoContent();

        // Admin and staff read the same row: customer's words untouched, owner's latest reply attached.
        var admin = client.get().uri("/api/salon-admin/{s}/ratings", salonId).exchange().expectStatus().isOk()
                .returnResult(String.class).getResponseBody();
        assertThat(JsonPath.<String>read(admin, "$[0].feedback")).isEqualTo("Lovely cut!");
        assertThat(JsonPath.<Integer>read(admin, "$[0].salonRating")).isEqualTo(5);
        assertThat(JsonPath.<Integer>read(admin, "$[0].staffRating")).isEqualTo(4);
        assertThat(JsonPath.<String>read(admin, "$[0].reply")).isEqualTo("See you soon!");
        var forStaff = ratings.getBookingRatings(salonId, staffId);
        assertThat(forStaff).singleElement().satisfies(r -> {
            assertThat(r.feedback()).isEqualTo("Lovely cut!");
            assertThat(r.reply()).isEqualTo("See you soon!");
            assertThat(r.repliedAt()).isNotNull();
        });
        assertThat(ratings.getCustomerRatingOptions(salonId, "eve@example.com")).singleElement()
                .satisfies(o -> assertThat(o.reply()).isEqualTo("See you soon!"));

        // There is deliberately no way to edit or remove a review.
        client.delete().uri("/api/salon-admin/{s}/ratings/{b}", salonId, bookingId).exchange().expectStatus().is4xxClientError();
        client.put().uri("/api/salon-admin/{s}/ratings/{b}", salonId, bookingId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("feedback", "edited")).exchange().expectStatus().is4xxClientError();
    }
}
