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
    void notificationAndAccountReviewsKeepTheirSourceAndAllowOneScoreOrTextOnly() {
        var token = ratings.issueInvitation(bookingId, salonId, staffId);
        assertThat(ratings.findReviewTarget(token).submitted()).isFalse();
        assertThat(ratings.submitReview(token, null, 5, null, null)).isTrue();
        assertThat(ratings.submitReview(token, 1, null, null, null)).isFalse();
        assertThat(ratings.getBookingRatings(salonId, null)).singleElement().satisfies(review -> {
            assertThat(review.source()).isEqualTo("NOTIFICATION");
            assertThat(review.staffRating()).isEqualTo(5);
            assertThat(review.salonRating()).isNull();
        });
        assertThat(ratings.getRatings(salonId).salon().count()).isZero();
        assertThat(ratings.getRatings(salonId).staff().get(staffId).count()).isEqualTo(1);
    }

    @Test
    void accountAcceptsFeedbackWithoutStarsAndRejectsEmptySubmission() {
        assertThat(ratings.submitCustomerReview(salonId, "eve@example.com", bookingId, null, null, "  ", null)).isFalse();
        assertThat(ratings.submitCustomerReview(salonId, "eve@example.com", bookingId, null, null, "A private note", null)).isTrue();
        assertThat(ratings.getBookingRatings(salonId, null)).singleElement().satisfies(review -> assertThat(review.source()).isEqualTo("CUSTOMER_ACCOUNT"));
    }

    @Test
    void feedbackIsKeptAndOwnerReplyNeverRewritesIt() {
        assertThat(ratings.getCustomerRatingOptions(salonId, "eve@example.com")).singleElement()
                .satisfies(option -> assertThat(option.submitted()).isFalse());

        assertThat(ratings.submitCustomerReview(salonId, "eve@example.com", bookingId, 5, 4, "  Lovely salon!  ", " Sam was great ")).isTrue();
        assertThat(ratings.submitCustomerReview(salonId, "eve@example.com", bookingId, 1, 1, "changed my mind", "nope")).as("first submission wins").isFalse();
        assertThat(ratings.submitCustomerReview(salonId, "someone@else.com", bookingId, 5, 5, "x", "y")).as("not their visit").isFalse();

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
        assertThat(JsonPath.<String>read(admin, "$[0].salonFeedback")).isEqualTo("Lovely salon!");
        assertThat(JsonPath.<String>read(admin, "$[0].staffFeedback")).isEqualTo("Sam was great");
        assertThat(JsonPath.<Integer>read(admin, "$[0].salonRating")).isEqualTo(5);
        assertThat(JsonPath.<Integer>read(admin, "$[0].staffRating")).isEqualTo(4);
        assertThat(JsonPath.<String>read(admin, "$[0].reply")).isEqualTo("See you soon!");
        var forStaff = ratings.getBookingRatings(salonId, staffId);
        assertThat(forStaff).singleElement().satisfies(r -> {
            assertThat(r.salonFeedback()).isEqualTo("Lovely salon!");
            assertThat(r.staffFeedback()).isEqualTo("Sam was great");
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
    @Test
    void publicHistoryIncludesVerifiedBookingStarsWithoutPrivateFeedback() {
        assertThat(ratings.submitCustomerReview(salonId, "eve@example.com", bookingId, 5, 4, "Private salon words", "Private stylist words")).isTrue();
        assertThat(ratings.replyToReview(salonId, bookingId, "Private answer")).isTrue();
        client.get().uri("/api/salon/" + salonId + "/ratings/public?target=stylist&staffId=" + staffId)
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.count").isEqualTo(1)
                .jsonPath("$.items[0].rating").isEqualTo(4).jsonPath("$.items[0].verifiedVisit").isEqualTo(true)
                .jsonPath("$.items[0].staffName").isEqualTo("Sam Stylist")
                .jsonPath("$.items[0].salonFeedback").doesNotExist().jsonPath("$.items[0].reply").doesNotExist();
    }

}
