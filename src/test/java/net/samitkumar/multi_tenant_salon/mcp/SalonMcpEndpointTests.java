package net.samitkumar.multi_tenant_salon.mcp;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The salon-specific MCP URL ({@code /mcp/{salon}}) over real Streamable HTTP: a client that only
 * knows the URL gets that salon's data without ever passing {@code salonIdOrHandler}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class SalonMcpEndpointTests {

    @LocalServerPort
    int port;

    RestTestClient client;

    @BeforeEach
    void setUp() {
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @Test
    void aSalonUrlAnswersForThatSalonWithoutASalonArgument() {
        String handle = "mcp-url-" + UUID.randomUUID().toString().substring(0, 8);
        String salonId = onboardSalon(handle);

        String session = initialize("/mcp/" + handle);
        String services = rpc("/mcp/" + handle, session, """
                {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"salon_services","arguments":{}}}""");

        assertThat(services).contains("\"salonId\":\"" + salonId + "\"").doesNotContain("\"isError\":true");
    }

    @Test
    void appViewsDeclareTheMediaOriginInTheirCspSoHostsLoadPhotos() {
        String session = initialize("/mcp");
        String team = rpc("/mcp", session, """
                {"jsonrpc":"2.0","id":2,"method":"resources/read","params":{"uri":"ui://salon/team.html"}}""");

        // Tests run with LOCAL storage, so photos are served by the backend itself.
        assertThat(team).contains("\"mimeType\":\"text/html;profile=mcp-app\"")
                .contains("\"resourceDomains\":[\"http://localhost:8080\"]")
                .contains("\"resource_domains\":[\"http://localhost:8080\"]");
    }

    @Test
    void initializeTellsTheModelToWriteItsTextBeforeOpeningAnApp() {
        var initialized = client.post().uri("/mcp")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Accept", "application/json, text/event-stream")
                .body(INITIALIZE)
                .exchange()
                .expectStatus().isOk()
                .returnResult(String.class)
                .getResponseBody();

        assertThat(initialized).contains("\"instructions\"").contains("call the app tool as the last step of your turn");
    }

    @Test
    void anUnknownSalonUrlIsRejectedUpFront() {
        client.post().uri("/mcp/no-such-salon-" + UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .header("Accept", "application/json, text/event-stream")
                .body(INITIALIZE)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void theSharedEndpointAsksWhichSalonWhenNoneIsGiven() {
        String session = initialize("/mcp");
        String result = rpc("/mcp", session, """
                {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"salon_services","arguments":{}}}""");

        assertThat(result).contains("\"isError\":true").contains("Which salon?");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static final String INITIALIZE = """
            {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18",\
            "capabilities":{},"clientInfo":{"name":"test","version":"1"}}}""";

    private String onboardSalon(String name) {
        var result = client.post().uri("/api/salon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"name": "%s", "ownerName": "Owner", "ownerEmail": "%s@example.com",
                         "ownerPhone": "+1234567890",
                         "location": {"address": "1 Main St", "city": "Town", "state": "TS", "country": "US", "zipCode": "12345"},
                         "contact": {"phone": "+1987654321", "email": "%s@example.com"},
                         "features": ["BOOKING", "STATIC_WEBSITE"], "termsAccepted": true}
                        """.formatted(name, name, name))
                .exchange()
                .expectStatus().isCreated()
                .returnResult(String.class);
        return result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");
    }

    private String initialize(String path) {
        var result = client.post().uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Accept", "application/json, text/event-stream")
                .body(INITIALIZE)
                .exchange()
                .expectStatus().isOk()
                .returnResult(String.class);
        String session = result.getResponseHeaders().getFirst("Mcp-Session-Id");
        assertThat(session).isNotBlank();
        client.post().uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Accept", "application/json, text/event-stream")
                .header("Mcp-Session-Id", session)
                .body("{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}")
                .exchange()
                .expectStatus().is2xxSuccessful();
        return session;
    }

    private String rpc(String path, String session, String body) {
        return client.post().uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Accept", "application/json, text/event-stream")
                .header("Mcp-Session-Id", session)
                .body(body)
                .exchange()
                .expectStatus().isOk()
                .returnResult(String.class)
                .getResponseBody();
    }
}
