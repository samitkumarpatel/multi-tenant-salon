package net.samitkumar.multi_tenant_salon.accesscontrol;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import java.util.Locale;
import java.util.UUID;

/** Authorization always checks current source grants, including with an unexpired JWT. */
@Service
public class UserAccessPolicy {
    private final JdbcClient jdbc;
    public UserAccessPolicy(JdbcClient jdbc) { this.jdbc = jdbc; }

    public static String canonical(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    public boolean hasRole(String email, UUID salonId, String role) {
        return !canonical(email).isEmpty() && jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM user_identity
                WHERE lower(btrim(email)) = :email AND role = :role AND active
                AND salon_id IS NOT DISTINCT FROM :salon)
                """).param("email", canonical(email)).param("role", role).param("salon", salonId)
                .query(Boolean.class).single();
    }
}
