package net.samitkumar.multi_tenant_salon.developer.internal;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.DeleteExchange;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** The authorization server's client-management API ({@code /internal/clients}), called with a shared key. */
@HttpExchange("/internal/clients")
interface AuthzClientsClient {
    record ClientView(String clientId, String name, UUID salonId, List<String> scopes, String createdBy,
                      Instant createdAt, Instant secretRotatedAt) {}

    /** The secret appears here once and is never retrievable again. */
    record CreatedClient(ClientView client, String clientSecret) {}

    record CreateRequest(String salonId, String name, List<String> scopes, String createdBy) {}

    @GetExchange
    List<ClientView> list(@RequestParam String salonId);

    @PostExchange
    CreatedClient create(@RequestBody CreateRequest request);

    @PostExchange("/{clientId}/rotate")
    CreatedClient rotate(@PathVariable String clientId, @RequestParam String salonId);

    @DeleteExchange("/{clientId}")
    void revoke(@PathVariable String clientId, @RequestParam String salonId, @RequestParam String actor);
}
