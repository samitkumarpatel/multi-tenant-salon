package net.samitkumar.multi_tenant_salon;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * A salon's API client (OAuth2 client_credentials token) reads only what its owner granted, only for its own salon, and
 * never writes or reaches owner-only, desk, staff or platform endpoints. Owners manage clients through the developer API.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "app.security.permit-all=false",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test",
        "spring.application.authz.client-management-key=test-key"
})
@Import(TestcontainersConfiguration.class)
class ApiClientAccessIntegrationTest {
    /** Stands in for the authorization server's /internal/clients API and remembers what it was asked. */
    record Seen(String method, String path, String query, String key, String body) {}
    static final List<Seen> seen = new CopyOnWriteArrayList<>();
    static volatile int nextStatus = 200;
    static volatile String nextBody = "[]";
    static final HttpServer authz = startAuthz();

    static HttpServer startAuthz() {
        try {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                var body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                seen.add(new Seen(exchange.getRequestMethod(), exchange.getRequestURI().getPath(), exchange.getRequestURI().getQuery(),
                        exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"), body));
                var bytes = nextBody.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(nextStatus, nextStatus == 204 ? -1 : bytes.length);
                if (nextStatus != 204) exchange.getResponseBody().write(bytes);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void authzUrl(DynamicPropertyRegistry registry) {
        registry.add("spring.application.authz.url", () -> "http://127.0.0.1:" + authz.getAddress().getPort());
    }

    @AfterAll
    static void stopAuthz() { authz.stop(0); }

    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID salonA;
    UUID salonB;
    final Map<String, Jwt> tokens = new ConcurrentHashMap<>();

    @BeforeEach void setup() {
        seen.clear();
        nextStatus = 200;
        nextBody = "[]";
        salonA = salon("Salon A");
        salonB = salon("Salon B");
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        when(decoder.decode(anyString())).thenAnswer(invocation -> tokens.get((String) invocation.getArgument(0)));
    }

    private UUID salon(String name) {
        var id = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, 'Owner', ?, now())",
                id, name, "api-" + id, "owner-" + id + "@api.test");
        return id;
    }

    private String bearer(Jwt.Builder builder) {
        var value = "tok-" + UUID.randomUUID();
        tokens.put(value, builder.tokenValue(value).header("alg", "RS256").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300)).build());
        return "Bearer " + value;
    }

    /** What the authorization server issues to a salon's API client. */
    private String apiClient(UUID salon, String... scopes) {
        return bearer(Jwt.withTokenValue("x").subject("sc_test").claim("client_type", "salon-api")
                .claim("salon_id", salon.toString()).claim("scope", List.of(scopes)));
    }

    private String owner(UUID salon) {
        return bearer(Jwt.withTokenValue("x").subject("owner-" + salon + "@api.test").claim("roles", List.of("OWNER"))
                .claim("salons", List.of(Map.of("salonId", salon.toString(), "role", "OWNER", "active", true))));
    }

    private int status(String method, String path, String token) {
        var spec = switch (method) {
            case "POST" -> client.post().uri(path).header("Authorization", token).contentType(MediaType.APPLICATION_JSON).body("{}");
            case "PUT" -> client.put().uri(path).header("Authorization", token).contentType(MediaType.APPLICATION_JSON).body("{}");
            case "DELETE" -> client.delete().uri(path).header("Authorization", token);
            default -> client.get().uri(path).header("Authorization", token);
        };
        return spec.exchange().returnResult(String.class).getStatus().value();
    }

    private String admin(UUID salon, String path) { return "/api/salon-admin/" + salon + path; }

    @Test void anApiClientReadsWhatItWasGrantedForItsOwnSalon() {
        var token = apiClient(salonA, "services:read", "bookings:read");
        assertThat(status("GET", admin(salonA, "/services"), token)).isEqualTo(200);
        assertThat(status("GET", admin(salonA, "/booking"), token)).isEqualTo(200);
        // A scope it wasn't granted.
        assertThat(status("GET", admin(salonA, "/staff"), token)).isEqualTo(403);
        assertThat(status("GET", admin(salonA, "/customers"), token)).isEqualTo(403);
        assertThat(status("GET", admin(salonA, "/shop/orders"), token)).isEqualTo(403);
        assertThat(status("GET", admin(salonA, "/ratings"), token)).isEqualTo(403);
    }

    @Test void anApiClientCanNeverReachAnotherSalon() {
        var token = apiClient(salonA, "services:read", "bookings:read", "customers:read");
        assertThat(status("GET", admin(salonB, "/services"), token)).isEqualTo(403);
        assertThat(status("GET", admin(salonB, "/customers"), token)).isEqualTo(403);
        assertThat(status("GET", admin(salonB, "/booking"), token)).isEqualTo(403);
        // Not even by case or an unparseable id.
        assertThat(status("GET", "/api/salon-admin/" + salonA.toString().toUpperCase() + "/services", token)).isEqualTo(200);
        assertThat(status("GET", "/api/salon-admin/not-a-uuid/services", token)).isEqualTo(403);
    }

    @Test void anApiClientIsReadOnlyAndLimitedToTheAllowlist() {
        var token = apiClient(salonA, "services:read", "bookings:read", "staff:read", "ratings:read", "orders:read", "customers:read", "loyalty:read");
        assertThat(status("POST", admin(salonA, "/services"), token)).isEqualTo(403);
        assertThat(status("PUT", admin(salonA, "/loyalty/program"), token)).isEqualTo(403);
        assertThat(status("DELETE", admin(salonA, "/services/1"), token)).isEqualTo(403);
        assertThat(status("POST", admin(salonA, "/booking"), token)).isEqualTo(403);
        // Real GET endpoints that are deliberately not offered.
        for (var path : List.of("/payments/stripe", "/payments/transactions", "/dashboard/settings", "/analytics/summary",
                "/loyalty/redemptions", "/loyalty/redemptions/by-code/ABC", "/membership/subscriptions", "/policies",
                "/website/domains", "/developer/clients", "/shop/refunds", "/customer-self-service")) {
            assertThat(status("GET", admin(salonA, path), token)).as(path).isEqualTo(403);
        }
    }

    @Test void anApiClientIsRefusedOnEveryOtherPartOfTheApi() {
        var token = apiClient(salonA, "services:read", "staff:read", "bookings:read");
        assertThat(status("GET", "/api/salon-admin/my-salons", token)).isEqualTo(403);
        assertThat(status("GET", "/api/salon-admin/my-desk-salons", token)).isEqualTo(403);
        assertThat(status("GET", "/api/salon-staff/1/ratings", token)).isEqualTo(403);
        assertThat(status("GET", "/api/salon-super-admin/salons", token)).isEqualTo(403);
        assertThat(status("GET", "/api/salon-admin/" + salonA, token)).isEqualTo(403);
    }

    @Test void onlyTheAuthorizationServersClientTokensCount() {
        // Scopes and a salon id without the client_type marker don't make a token an API client, so the owner checks apply.
        var imposter = bearer(Jwt.withTokenValue("x").subject("sc_test").claim("salon_id", salonA.toString()).claim("scope", List.of("services:read")));
        assertThat(status("GET", admin(salonA, "/services"), imposter)).isEqualTo(403);
        // An API client token with no (or a malformed) salon binding gets nothing.
        var unbound = bearer(Jwt.withTokenValue("x").subject("sc_test").claim("client_type", "salon-api").claim("scope", List.of("services:read")));
        assertThat(status("GET", admin(salonA, "/services"), unbound)).isEqualTo(403);
        var malformed = bearer(Jwt.withTokenValue("x").subject("sc_test").claim("client_type", "salon-api").claim("salon_id", "nope").claim("scope", List.of("services:read")));
        assertThat(status("GET", admin(salonA, "/services"), malformed)).isEqualTo(403);
        assertThat(client.get().uri(admin(salonA, "/services")).exchange().returnResult(String.class).getStatus().value()).isEqualTo(401);
    }

    @Test void ownersManageTheirOwnClientsThroughTheDeveloperApi() {
        nextStatus = 201;
        nextBody = "{\"client\":{\"clientId\":\"sc_abc\",\"name\":\"Sync\",\"salonId\":\"" + salonA + "\",\"scopes\":[\"services:read\"],\"createdBy\":\"x\"},\"clientSecret\":\"s3cret\"}";
        var created = client.post().uri(admin(salonA, "/developer/clients")).header("Authorization", owner(salonA))
                .contentType(MediaType.APPLICATION_JSON).body("{\"name\":\"Sync\",\"scopes\":[\"services:read\"],\"salonId\":\"" + salonB + "\"}").exchange();
        created.expectStatus().isEqualTo(201);
        created.expectHeader().value("Cache-Control", v -> assertThat(v).contains("no-store"));
        // The salon sent on is the one in the URL (the owner's), never the body's, with the shared key and the owner as creator.
        assertThat(seen).singleElement().satisfies(request -> {
            assertThat(request.method()).isEqualTo("POST");
            assertThat(request.path()).isEqualTo("/internal/clients");
            assertThat(request.key()).isEqualTo("test-key");
            assertThat(request.body()).contains("\"salonId\":\"" + salonA + "\"").doesNotContain(salonB.toString())
                    .contains("owner-" + salonA + "@api.test");
        });

        seen.clear();
        nextStatus = 200;
        nextBody = "[]";
        assertThat(status("GET", admin(salonA, "/developer/clients"), owner(salonA))).isEqualTo(200);
        assertThat(seen).singleElement().satisfies(request -> assertThat(request.query()).isEqualTo("salonId=" + salonA));
        assertThat(status("GET", admin(salonA, "/developer/scopes"), owner(salonA))).isEqualTo(200);
    }

    @Test void nobodyElseCanManageAnotherSalonsClients() {
        var otherOwner = owner(salonB);
        assertThat(status("GET", admin(salonA, "/developer/clients"), otherOwner)).isEqualTo(403);
        assertThat(status("POST", admin(salonA, "/developer/clients"), otherOwner)).isEqualTo(403);
        assertThat(status("POST", admin(salonA, "/developer/clients/sc_abc/rotate"), otherOwner)).isEqualTo(403);
        assertThat(status("DELETE", admin(salonA, "/developer/clients/sc_abc"), otherOwner)).isEqualTo(403);
        // Desk staff and the client credentials themselves can't mint or revoke credentials either.
        assertThat(status("POST", admin(salonA, "/developer/clients"), apiClient(salonA, "services:read"))).isEqualTo(403);
        assertThat(seen).as("the authorization server was never asked").isEmpty();
    }

    @Test void authorizationServerErrorsAreReportedWithoutLeakingInternals() {
        nextStatus = 409;
        nextBody = "{\"error\":\"This salon already has 5 API clients; revoke one first\"}";
        var spec = client.post().uri(admin(salonA, "/developer/clients")).header("Authorization", owner(salonA))
                .contentType(MediaType.APPLICATION_JSON).body("{\"name\":\"Sync\",\"scopes\":[\"services:read\"]}").exchange();
        spec.expectStatus().isEqualTo(409);
        assertThat(spec.returnResult(String.class).getResponseBody()).contains("5 API clients");

        nextStatus = 401; // the shared key was wrong: a configuration problem, not something to show the owner
        nextBody = "";
        var failed = client.get().uri(admin(salonA, "/developer/clients")).header("Authorization", owner(salonA)).exchange();
        failed.expectStatus().isEqualTo(502);
        assertThat(failed.returnResult(String.class).getResponseBody()).doesNotContain("test-key").doesNotContain("401");
    }

    /**
     * A browser hides the body of a cross-origin error that lacks CORS headers and reports a bare network failure
     * ("Can't reach the server"). So a refusal must carry them too, or every 4xx would look like an outage.
     */
    @Test void refusalsStillCarryCorsHeadersSoTheBrowserCanReadThem() {
        nextStatus = 409;
        nextBody = "{\"error\":\"This salon already has 5 API clients; revoke one first\"}";
        var conflict = client.post().uri(admin(salonA, "/developer/clients")).header("Authorization", owner(salonA))
                .header("Origin", "https://admin.salonsaas.org").contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Sync\",\"scopes\":[\"services:read\"]}").exchange();
        conflict.expectStatus().isEqualTo(409);
        conflict.expectHeader().exists("Access-Control-Allow-Origin");
        var forbidden = client.get().uri(admin(salonB, "/services")).header("Authorization", apiClient(salonA, "services:read"))
                .header("Origin", "https://admin.salonsaas.org").exchange();
        forbidden.expectStatus().isEqualTo(403);
        forbidden.expectHeader().exists("Access-Control-Allow-Origin");
    }
}
