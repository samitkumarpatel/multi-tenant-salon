package net.samitkumar.multi_tenant_saloon.identity.internal;

import net.samitkumar.multi_tenant_saloon.identity.UserIdentity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
class UserIdentityController {

    private final UserIdentityRepository repository;

    UserIdentityController(UserIdentityRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/internal/user-identity")
    ResponseEntity<List<UserIdentity>> findByEmail(@RequestParam String email) {
        var identities = repository.findByEmail(email);
        if (identities.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(identities);
    }
}
