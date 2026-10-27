package net.samitkumar.multi_tenant_salon.developer.internal;

import net.samitkumar.multi_tenant_salon.developer.ApiClientAccess;
import net.samitkumar.multi_tenant_salon.developer.internal.AuthzClientsClient.ClientView;
import net.samitkumar.multi_tenant_salon.developer.internal.AuthzClientsClient.CreatedClient;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Where a salon owner manages the OAuth2 clients their integrations use — {@code /api/salon-admin/{salonId}/developer/**}.
 * The salon comes from the URL, which the security rule has already matched to this owner's salon; it is never read from
 * the body. Creating, rotating and revoking are owner-only (the rule also keeps platform admins and desk staff out).
 */
@RestController
@RequestMapping("/api/salon-admin/{salonId}/developer")
class DeveloperClientController {
    private final DeveloperClientService clients;
    private final SalonApi salons;

    DeveloperClientController(DeveloperClientService clients, SalonApi salons) {
        this.clients = clients;
        this.salons = salons;
    }

    record CreateRequest(String name, List<String> scopes) {}

    private static String actor(Jwt jwt) {
        return jwt == null || jwt.getSubject() == null ? "owner" : jwt.getSubject();
    }

    @GetMapping("/scopes")
    List<ApiClientAccess.ScopeInfo> scopes(@PathVariable String salonId) {
        return ApiClientAccess.SCOPES;
    }

    @GetMapping("/clients")
    List<ClientView> list(@PathVariable String salonId) {
        return clients.list(salons.resolveId(salonId));
    }

    /** The only response that ever carries the client secret, so it must not be cached anywhere. */
    @PostMapping("/clients")
    ResponseEntity<CreatedClient> create(@PathVariable String salonId, @RequestBody CreateRequest request,
                                         @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        var created = clients.create(salons.resolveId(salonId), request.name(), request.scopes(), actor(jwt));
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(created);
    }

    @PostMapping("/clients/{clientId}/rotate")
    ResponseEntity<CreatedClient> rotate(@PathVariable String salonId, @PathVariable String clientId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(clients.rotate(salons.resolveId(salonId), clientId));
    }

    @DeleteMapping("/clients/{clientId}")
    ResponseEntity<Void> revoke(@PathVariable String salonId, @PathVariable String clientId,
                                @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        clients.revoke(salons.resolveId(salonId), clientId, actor(jwt));
        return ResponseEntity.noContent().build();
    }
}
