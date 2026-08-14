package net.samitkumar.multi_tenant_salon.identity.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.identity.UserIdentity;
import net.samitkumar.multi_tenant_salon.identity.UserIdentity.SalonAccess;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@Slf4j
class UserIdentityRepository {

    private final JdbcClient jdbcClient;

    UserIdentityRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    Optional<UserIdentity> findByEmail(String email) {
        log.info("Finding user identity for email: {}", email);
        List<SalonAccess> salons = jdbcClient
                .sql("SELECT salon_id, role, active FROM user_identity WHERE email = :email")
                .param("email", email)
                .query((rs, _) -> new SalonAccess(
                        rs.getObject("salon_id", UUID.class),
                        rs.getString("role"),
                        rs.getBoolean("active")
                ))
                .list();
        log.info("Finding user identity for email: {} with result: {}", email, salons);
        if (salons.isEmpty()) return Optional.empty();
        return Optional.of(new UserIdentity(email, salons));
    }
}
