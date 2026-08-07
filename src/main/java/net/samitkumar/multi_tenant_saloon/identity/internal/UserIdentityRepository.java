package net.samitkumar.multi_tenant_saloon.identity.internal;

import net.samitkumar.multi_tenant_saloon.identity.UserIdentity;
import net.samitkumar.multi_tenant_saloon.identity.UserIdentity.SaloonAccess;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class UserIdentityRepository {

    private final JdbcClient jdbcClient;

    UserIdentityRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    Optional<UserIdentity> findByEmail(String email) {
        List<SaloonAccess> saloons = jdbcClient
                .sql("SELECT saloon_id, role, active FROM user_identity WHERE email = :email")
                .param("email", email)
                .query((rs, _) -> new SaloonAccess(
                        rs.getObject("saloon_id", UUID.class),
                        rs.getString("role"),
                        rs.getBoolean("active")
                ))
                .list();

        if (saloons.isEmpty()) return Optional.empty();
        return Optional.of(new UserIdentity(email, saloons));
    }
}
