package net.samitkumar.multi_tenant_salon.identity.internal;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.identity.UserIdentity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Serves the Authorization Server, which calls this while issuing a JWT to learn which salons an
 * email belongs to. It is reachable without a bearer token (the caller has none yet), which also
 * makes it a staff directory for anyone who finds it: ask for an address and the answer reveals
 * whether that person works at a salon, which one, and in what role.
 *
 * <p>Set {@code spring.application.identity.internal-api-key} on this service and send it as
 * {@code X-Internal-Api-Key} from the Authorization Server to close that off. The key is optional
 * only so that configuring it is a deploy-order choice rather than an outage; an unset key logs a
 * warning on every startup.
 */
@RestController
@Slf4j
class UserIdentityController {

    private final UserIdentityRepository repository;
    private final String apiKey;

    UserIdentityController(UserIdentityRepository repository,
                           @Value("${spring.application.identity.internal-api-key:}") String apiKey) {
        this.repository = repository;
        this.apiKey = apiKey == null ? "" : apiKey.strip();
    }

    @PostConstruct
    void warnWhenUnprotected() {
        if (apiKey.isEmpty()) {
            log.warn("/internal/user-identity is unauthenticated: anyone who can reach this service can look up "
                    + "whether an email is salon staff. Set spring.application.identity.internal-api-key here and "
                    + "send it as X-Internal-Api-Key from the Authorization Server.");
        }
    }

    @GetMapping("/internal/user-identity")
    ResponseEntity<UserIdentity> findByEmail(@RequestParam String email,
                                             @RequestHeader(name = "X-Internal-Api-Key", required = false) String presented) {
        if (!apiKey.isEmpty() && !matches(presented)) {
            // 404 rather than 403: a wrong or missing key shouldn't confirm the endpoint is here.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return repository.findByEmail(email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    private boolean matches(String presented) {
        if (presented == null) return false;
        return MessageDigest.isEqual(presented.strip().getBytes(StandardCharsets.UTF_8),
                apiKey.getBytes(StandardCharsets.UTF_8));
    }
}
