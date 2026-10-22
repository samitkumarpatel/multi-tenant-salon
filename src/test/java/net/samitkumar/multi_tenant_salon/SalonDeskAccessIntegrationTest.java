package net.samitkumar.multi_tenant_salon;

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

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Salon staff (stylists, receptionists, managers) can work the desk of the salon they belong to —
 * and only its desk endpoints — while everything else under the owner API stays owner-only.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
class SalonDeskAccessIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID salonId;
    UUID otherSalonId;
    String tag;
    final Map<String, String[]> tokens = new java.util.concurrent.ConcurrentHashMap<>();

    private String token(String role, UUID salon, String email) {
        var value = "tok-" + tokens.size();
        tokens.put(value, new String[] {role, salon.toString(), email});
        return "Bearer " + value;
    }

    @BeforeEach void setup() {
        tag = UUID.randomUUID().toString().substring(0, 8);
        salonId = salon("Desk salon", true);
        otherSalonId = salon("Other salon", true);
        staff(salonId, "stylist-" + tag + "@desk.test", "STYLIST", "ACTIVE");
        staff(salonId, "manager-" + tag + "@desk.test", "MANAGER", "ACTIVE");
        staff(salonId, "gone-" + tag + "@desk.test", "STYLIST", "INACTIVE");
        staff(otherSalonId, "elsewhere-" + tag + "@desk.test", "RECEPTIONIST", "ACTIVE");
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        // Opaque test tokens standing for the claims the auth server would issue for that person.
        when(decoder.decode(anyString())).thenAnswer(invocation -> {
            String[] parts = tokens.get((String) invocation.getArgument(0));
            return Jwt.withTokenValue(invocation.getArgument(0)).header("alg", "RS256").subject(parts[2])
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                    .claim("roles", List.of(parts[0]))
                    .claim("salons", List.of(Map.of("salonId", parts[1], "role", parts[0], "active", true))).build();
        });
    }

    private UUID salon(String name, boolean desk) {
        var id = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, 'Owner', ?, now())",
                id, name, "desk-" + id, "owner-" + id + "@desk.test");
        jdbc.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'BOOKING')", id);
        jdbc.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'MEMBERSHIP')", id);
        if (desk) jdbc.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'DASHBOARD')", id);
        return id;
    }

    private void staff(UUID salon, String email, String role, String status) {
        jdbc.update("INSERT INTO staff_member (salon_id, name, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salon, email, email, role, status);
    }

    private String staffToken(UUID salon, String who) { return token("STAFF", salon, who + "-" + tag + "@desk.test"); }

    private RestTestClient.ResponseSpec get(String path, String token) {
        return client.get().uri("/api/salon-admin/" + salonId + path).header("Authorization", token).exchange();
    }

    @Test void staffOfTheSalonCanUseTheDeskButNotTheRestOfTheOwnerApi() {
        for (var who : List.of("stylist", "manager")) {
            var token = staffToken(salonId, who);
            get("", token).expectStatus().isOk();
            get("/booking", token).expectStatus().isOk();
            get("/staff", token).expectStatus().isOk();
            get("/membership/plans", token).expectStatus().isOk();
            // Passes security; there is simply no member with that code.
            get("/membership/verify?code=NOPE", token).expectStatus().isNotFound();

            // Owner-only: salon settings, staff management, membership admin.
            client.put().uri("/api/salon-admin/" + salonId).header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{\"name\":\"Hijacked\"}").exchange().expectStatus().isForbidden();
            client.post().uri("/api/salon-admin/" + salonId + "/staff").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
            client.delete().uri("/api/salon-admin/" + salonId + "/booking/1").header("Authorization", token)
                    .exchange().expectStatus().isForbidden();
            get("/membership/overview", token).expectStatus().isForbidden();
            get("/membership/subscriptions", token).expectStatus().isForbidden();
            client.put().uri("/api/salon-admin/" + salonId + "/dashboard/settings").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        }
    }

    @Test void staffOfAnotherSalonAreRefusedEvenWithAForgedClaim() {
        // Their real token names their own salon.
        get("/booking", staffToken(otherSalonId, "elsewhere")).expectStatus().isForbidden();
        // A token claiming this salon doesn't help: the database says they don't work here.
        get("/booking", staffToken(salonId, "elsewhere")).expectStatus().isForbidden();
    }

    @Test void deactivatedOrRemovedStaffAreLockedOutStraightAway() {
        // The token still says active staff, but the database no longer does.
        get("/booking", staffToken(salonId, "gone")).expectStatus().isForbidden();
        var token = staffToken(salonId, "stylist");
        get("/booking", token).expectStatus().isOk();
        jdbc.update("UPDATE staff_member SET status = 'INACTIVE' WHERE email = ?", "stylist-" + tag + "@desk.test");
        get("/booking", token).expectStatus().isForbidden();
    }

    @Test void staffCantUseTheDeskOfASalonWithoutTheDeskFeature() {
        jdbc.update("DELETE FROM salon_feature WHERE salon_id = ? AND feature = 'DASHBOARD'", salonId);
        get("/booking", staffToken(salonId, "stylist")).expectStatus().isForbidden();
    }

    @Test void theOwnerKeepsFullAccess() {
        var owner = token("OWNER", salonId, "owner-" + salonId + "@desk.test");
        get("/membership/overview", owner).expectStatus().isOk();
        get("/membership/subscriptions", owner).expectStatus().isOk();
    }

    @Test void myDeskSalonsListsOnlyTheSalonsTheCallerWorksAt() {
        client.get().uri("/api/salon-admin/my-desk-salons").header("Authorization", staffToken(salonId, "manager"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.length()").isEqualTo(1).jsonPath("$[0].id").isEqualTo(salonId.toString());
        client.get().uri("/api/salon-admin/my-desk-salons").header("Authorization", staffToken(salonId, "gone"))
                .exchange().expectStatus().isNotFound();
        // The email param is ignored when a token is present — no peeking at someone else's salons.
        client.get().uri("/api/salon-admin/my-desk-salons?email=stylist-" + tag + "@desk.test")
                .header("Authorization", staffToken(otherSalonId, "elsewhere"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.length()").isEqualTo(1).jsonPath("$[0].id").isEqualTo(otherSalonId.toString());
        // Staff aren't handed salons in the owner-only admin app.
        client.get().uri("/api/salon-admin/my-salons").header("Authorization", staffToken(salonId, "stylist"))
                .exchange().expectStatus().isNotFound();
    }
}
