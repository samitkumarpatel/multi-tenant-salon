package net.samitkumar.multi_tenant_salon.developer.internal;

import net.samitkumar.multi_tenant_salon.developer.internal.AuthzClientsClient.ClientView;
import net.samitkumar.multi_tenant_salon.developer.internal.AuthzClientsClient.CreateRequest;
import net.samitkumar.multi_tenant_salon.developer.internal.AuthzClientsClient.CreatedClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/** Owner-facing API client management: every call carries the salon the caller was already authorized for. */
@Service
@Slf4j
class DeveloperClientService {
    private final AuthzClientsClient authz;
    private final boolean configured;

    DeveloperClientService(AuthzClientsClient authz, @Value("${spring.application.authz.client-management-key:}") String key) {
        this.authz = authz;
        this.configured = !key.isBlank();
    }

    List<ClientView> list(UUID salonId) {
        return call(() -> authz.list(salonId.toString()));
    }

    CreatedClient create(UUID salonId, String name, List<String> scopes, String createdBy) {
        return call(() -> authz.create(new CreateRequest(salonId.toString(), name, scopes, createdBy)));
    }

    CreatedClient rotate(UUID salonId, String clientId) {
        return call(() -> authz.rotate(clientId, salonId.toString()));
    }

    void revoke(UUID salonId, String clientId, String actor) {
        call(() -> { authz.revoke(clientId, salonId.toString(), actor); return null; });
    }

    /** Passes the authorization server's own client errors (bad input, limit reached, not found) on; anything else is "unavailable". */
    private <T> T call(Supplier<T> action) {
        if (!configured) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "API clients are not set up on this server yet");
        try {
            return action.get();
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            if (status == 400 || status == 404 || status == 409) {
                throw new ResponseStatusException(HttpStatus.valueOf(status), message(e));
            }
            log.error("[DeveloperClientService] Authorization server refused the request: {} {}", status, e.getResponseBodyAsString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The authorization server is unavailable, please try again later");
        } catch (RestClientException e) {
            log.error("[DeveloperClientService] Authorization server unreachable: {}", e.toString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The authorization server is unavailable, please try again later");
        }
    }

    private static String message(RestClientResponseException e) {
        try {
            var body = e.getResponseBodyAsString();
            int start = body.indexOf("\"error\":\"");
            if (start >= 0) return body.substring(start + 9, body.indexOf('"', start + 9));
        } catch (RuntimeException ignored) {
            // fall through to the generic message
        }
        return "The request was not accepted";
    }
}
