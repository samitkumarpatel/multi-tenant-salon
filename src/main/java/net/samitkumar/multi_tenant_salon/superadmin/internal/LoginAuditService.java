package net.samitkumar.multi_tenant_salon.superadmin.internal;

import net.samitkumar.multi_tenant_salon.superadmin.LoginAuditApi;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Records completed customer authentication attempts in their own transaction. */
@Service
class LoginAuditService implements LoginAuditApi {
    record Event(long id, String occurredAt, String application, String method, String result,
                 String salonName, boolean identityVerified) {}
    record Page(java.util.List<Event> content, int page, int size, long totalElements, int totalPages) {}

    private final JdbcClient jdbc;
    LoginAuditService(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCustomer(UUID salonId, String email, String result, boolean verified) {
        jdbc.sql("""
                    INSERT INTO login_audit_event(email_snapshot,identity_verified,application,method,result,salon_id)
                    VALUES (:email,:verified,'CUSTOMER','EMAIL_CODE',:result,:salon)""")
                .param("email", email).param("verified", verified).param("result", result).param("salon", salonId).update();
    }

    Page customerHistory(String email, int requestedPage, int requestedSize) {
        int size = Math.clamp(requestedSize, 1, 50), page = Math.clamp(requestedPage, 0, 100000);
        long total = jdbc.sql("SELECT count(*) FROM login_audit_event WHERE lower(email_snapshot)=:email AND application='CUSTOMER'")
                .param("email", email).query(Long.class).single();
        var rows = jdbc.sql("""
                SELECT e.id,e.occurred_at::text occurred_at,e.application,e.method,e.result,s.name salon_name,e.identity_verified
                FROM login_audit_event e LEFT JOIN salon s ON s.id=e.salon_id
                WHERE lower(e.email_snapshot)=:email AND e.application='CUSTOMER'
                ORDER BY e.occurred_at DESC,e.id DESC LIMIT :size OFFSET :offset
                """).param("email", email).param("size", size).param("offset", (long) page * size)
                .query((rs, i) -> new Event(rs.getLong("id"), rs.getString("occurred_at"), rs.getString("application"),
                        rs.getString("method"), rs.getString("result"), rs.getString("salon_name"), rs.getBoolean("identity_verified"))).list();
        return new Page(rows, page, size, total, (int)((total + size - 1) / size));
    }
}
