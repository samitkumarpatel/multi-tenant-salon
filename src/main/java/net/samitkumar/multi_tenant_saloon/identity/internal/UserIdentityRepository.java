package net.samitkumar.multi_tenant_saloon.identity.internal;

import net.samitkumar.multi_tenant_saloon.identity.UserIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
class UserIdentityRepository {

    private final JdbcClient jdbcClient;

    UserIdentityRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    List<UserIdentity> findByEmail(String email) {
        return jdbcClient
                .sql("SELECT email, role, saloon_id, active FROM user_identity WHERE email = :email")
                .param("email", email)
                .query(UserIdentity.class)
                .list();
    }
}
