package net.samitkumar.multi_tenant_salon.rating;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
class PublicFeedbackIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired RatingApi ratings;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    UUID salonId;
    UUID otherSalon;
    long staffId;
    String publicPath;
    String adminPath;
    RestTestClient client;

    @BeforeEach void setup() {
        salonId = UUID.randomUUID(); otherSalon = UUID.randomUUID();
        for (UUID id : List.of(salonId, otherSalon)) jdbc.update("INSERT INTO salon(id,name,handler,owner_email,created_at) VALUES (?,'Feedback salon',?,'owner@feedback.test',now())", id, "feedback-" + id);
        staffId = jdbc.queryForObject("INSERT INTO staff_member(salon_id,name,role,status,created_at) VALUES (?,'Stylist','STYLIST','ACTIVE',now()) RETURNING id", Long.class, salonId);
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        publicPath = "/api/salon/" + salonId;
        adminPath = "/api/salon-admin/" + salonId;
        when(decoder.decode(anyString())).thenAnswer(invocation -> {
            String token = invocation.getArgument(0);
            return Jwt.withTokenValue(token).header("alg", "RS256").subject(token + "@feedback.test")
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                    .claim("roles", List.of("OWNER")).claim("salons", List.of(Map.of("salonId", salonId.toString(), "role", "OWNER", "active", true))).build();
        });
    }

    private String submit(Map<String, Object> body) {
        return client.post().uri(publicPath + "/feedback").contentType(MediaType.APPLICATION_JSON).body(body)
                .exchange().expectStatus().isCreated().expectHeader().valueEquals("Cache-Control", "no-store")
                .returnResult(Map.class).getResponseBody().get("token").toString();
    }

    @Test void generalFeedbackHasSourceAndPrivateReceiptAndOwnerCanReply() {
        String token = submit(Map.of("customerName", "Eve", "staffId", staffId, "staffRating", 4, "staffFeedback", "Lovely cut", "source", "WEBSITE_STYLIST"));
        var inbox = ratings.getBookingRatings(salonId, null);
        assertThat(inbox).singleElement().satisfies(review -> {
            assertThat(review.bookingId()).isNull(); assertThat(review.feedbackId()).isNotNull();
            assertThat(review.source()).isEqualTo("WEBSITE_STYLIST"); assertThat(review.salonRating()).isNull();
            assertThat(review.staffRating()).isEqualTo(4);
        });
        long id = inbox.getFirst().feedbackId();
        client.put().uri(adminPath + "/feedback/" + id + "/reply").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "Thank you!")).exchange().expectStatus().isUnauthorized();
        client.put().uri(adminPath + "/feedback/" + id + "/reply").header("Authorization", "Bearer stranger").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "Not allowed")).exchange().expectStatus().isForbidden();
        client.put().uri("/api/salon-admin/" + otherSalon + "/feedback/" + id + "/reply").header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "Wrong salon")).exchange().expectStatus().isNotFound();
        client.put().uri(adminPath + "/feedback/" + id + "/reply").header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("reply", "Thank you!")).exchange().expectStatus().isNoContent();
        client.get().uri(publicPath + "/feedback/" + token).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.reply").isEqualTo("Thank you!").jsonPath("$.staffFeedback").isEqualTo("Lovely cut");
        client.get().uri("/api/salon/" + otherSalon + "/feedback/" + token).exchange().expectStatus().isNotFound();
        client.get().uri(publicPath + "/ratings").exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.salon.count").isEqualTo(0).jsonPath("$.staff['" + staffId + "'].average").isEqualTo(4.0)
                .jsonPath("$.staffFeedback").doesNotExist().jsonPath("$.reply").doesNotExist();
        assertThat(ratings.getBookingRatings(otherSalon, null)).isEmpty();
        assertThat(ratings.getBookingRatings(salonId, staffId + 10000)).isEmpty();
    }

    @Test void websiteSwitchIsOwnerOnlyAndDoesNotDisableNotificationFeedback() {
        client.get().uri(publicPath + "/feedback-settings").exchange().expectStatus().isOk().expectBody().jsonPath("$.publicWebsiteEnabled").isEqualTo(true);
        client.put().uri(adminPath + "/feedback-settings").contentType(MediaType.APPLICATION_JSON).body(Map.of("publicWebsiteEnabled", false))
                .exchange().expectStatus().isUnauthorized();
        client.put().uri(adminPath + "/feedback-settings").header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON).body(Map.of("publicWebsiteEnabled", false))
                .exchange().expectStatus().isOk();
        client.get().uri(publicPath + "/feedback-settings").exchange().expectStatus().isOk().expectBody().jsonPath("$.publicWebsiteEnabled").isEqualTo(false);
        client.post().uri(publicPath + "/feedback").contentType(MediaType.APPLICATION_JSON).body(Map.of("salonRating", 5, "source", "WEBSITE_FOOTER"))
                .exchange().expectStatus().isForbidden();
        submit(Map.of("salonRating", 5, "source", "NOTIFICATION"));
        client.put().uri(adminPath + "/feedback-settings").header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON).body(Map.of("publicWebsiteEnabled", true))
                .exchange().expectStatus().isOk();
        submit(Map.of("salonFeedback", "A private note without stars", "source", "PUBLIC_WEBSITE"));
        assertThat(ratings.getRatings(salonId).salon().count()).isEqualTo(1);
        assertThat(ratings.getBookingRatings(salonId, null)).hasSize(2);
    }

    @Test void validatesScoresStaffScopeTextAndThrottlesAnonymousSubmissions() {
        for (var body : List.of(Map.of("salonRating", 6), Map.of("staffRating", 5), Map.of("source", "CUSTOMER_ACCOUNT", "salonRating", 5), Map.of("salonFeedback", "x".repeat(1001)), Map.of("salonRating", 5, "website", "spam"), Map.of("salonFeedback", "  "))) {
            client.post().uri(publicPath + "/feedback").contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isBadRequest();
        }
        long otherStaff = jdbc.queryForObject("INSERT INTO staff_member(salon_id,name,role,status,created_at) VALUES (?,'Other','STYLIST','ACTIVE',now()) RETURNING id", Long.class, otherSalon);
        client.post().uri(publicPath + "/feedback").contentType(MediaType.APPLICATION_JSON).body(Map.of("staffId", otherStaff, "staffRating", 5)).exchange().expectStatus().isBadRequest();
        // Requests which reach the form validation count toward the per-salon/IP throttle too.
        for (int i = 0; i < 10; i++) client.post().uri(publicPath + "/feedback").contentType(MediaType.APPLICATION_JSON).body(Map.of("salonRating", 0)).exchange();
        client.post().uri(publicPath + "/feedback").contentType(MediaType.APPLICATION_JSON).body(Map.of("salonRating", 5)).exchange().expectStatus().isEqualTo(429);
    }
    @Test void publicStarHistoryIsPaginatedAndNeverExposesPrivateContent() {
        for (int i = 0; i < 25; i++) {
            jdbc.update("INSERT INTO customer_feedback(salon_id,staff_id,customer_name,salon_rating,staff_rating,salon_feedback,staff_feedback,reply,source,receipt_hash,submitted_at) VALUES (?,?, 'Private Customer',?,?, 'Private salon note','Private staff note','Private reply','PUBLIC_WEBSITE',?,?)",
                    salonId, staffId, i % 5 + 1, i % 5 + 1, UUID.randomUUID().toString(), java.sql.Timestamp.from(Instant.parse("2026-10-01T10:00:00Z").plusSeconds(i)));
        }
        jdbc.update("INSERT INTO customer_feedback(salon_id,salon_feedback,source,receipt_hash) VALUES (?,'Private text without stars','PUBLIC_WEBSITE',?)", salonId, UUID.randomUUID().toString());
        jdbc.update("INSERT INTO customer_feedback(salon_id,salon_rating,source,receipt_hash) VALUES (?,5,'PUBLIC_WEBSITE',?)", otherSalon, UUID.randomUUID().toString());
        var first = client.get().uri(publicPath + "/ratings/public").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.count").isEqualTo(25).jsonPath("$.average").isEqualTo(3.0)
                .jsonPath("$.distribution['5']").isEqualTo(5).jsonPath("$.items.length()").isEqualTo(20)
                .jsonPath("$.items[0].rating").isEqualTo(5).jsonPath("$.items[0].staffName").isEqualTo("Stylist")
                .jsonPath("$.items[0].verifiedVisit").isEqualTo(false).returnResult().getResponseBody();
        assertThat(new String(first, java.nio.charset.StandardCharsets.UTF_8))
                .doesNotContain("Private", "customerName", "salonFeedback", "staffFeedback", "reply", "receipt", "bookingId", "source");
        client.get().uri(publicPath + "/ratings/public?page=2").exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.page").isEqualTo(2).jsonPath("$.items.length()").isEqualTo(5).jsonPath("$.totalPages").isEqualTo(2);
        client.get().uri(publicPath + "/ratings/public?target=stylist&staffId=" + staffId).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.count").isEqualTo(25).jsonPath("$.average").isEqualTo(3.0);
        client.get().uri(publicPath + "/ratings/public?target=stylist&staffId=" + (staffId + 99999)).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.count").isEqualTo(0).jsonPath("$.items.length()").isEqualTo(0);
        client.get().uri("/api/salon/" + otherSalon + "/ratings/public").exchange().expectStatus().isOk().expectBody().jsonPath("$.count").isEqualTo(1);
        client.get().uri(publicPath + "/ratings/public?page=999").exchange().expectStatus().isOk().expectBody().jsonPath("$.page").isEqualTo(2);
        jdbc.update("INSERT INTO feedback_settings(salon_id,public_website_enabled) VALUES (?,false)", salonId);
        client.get().uri(publicPath + "/ratings/public").exchange().expectStatus().isOk().expectBody().jsonPath("$.count").isEqualTo(25);
    }

    @Test void publicHistoryValidatesPagingAndDoesNotShowDisabledSalons() {
        for (String query : List.of("page=0", "size=51", "size=0", "target=invalid", "staffId=1", "target=stylist&staffId=-1")) {
            client.get().uri(publicPath + "/ratings/public?" + query).exchange().expectStatus().isBadRequest();
        }
        client.get().uri("/api/salon/" + UUID.randomUUID() + "/ratings/public").exchange().expectStatus().isNotFound();
        jdbc.update("UPDATE salon SET status='DISABLED' WHERE id=?", salonId);
        client.get().uri(publicPath + "/ratings/public").exchange().expectStatus().isNotFound();
    }

}
