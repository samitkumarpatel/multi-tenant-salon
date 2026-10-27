package net.samitkumar.multi_tenant_salon.superadmin.internal;

import net.samitkumar.multi_tenant_salon.accesscontrol.UserAccessPolicy;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
class UserManagementService {
    record UserSummary(String email, String name, String roles, int salonCount, boolean hasAccess) {}
    record UserPage(List<UserSummary> content, int page, int size, long totalElements, int totalPages) {}
    record Grant(UUID salonId, String salonName, String role, String staffRole, String effectiveRole,
                 boolean active, Long sourceId) {}
    record Detail(String email, List<Grant> grants, List<Map<String,Object>> customers) {}
    private final JdbcClient jdbc;

    UserManagementService(JdbcClient jdbc) { this.jdbc = jdbc; }

    UserPage list(String q, String role, UUID salonId, String status, int page, int size) {
        int limit=Math.clamp(size,1,100), offsetPage=Math.clamp(page,0,100000);
        String predicate="""
                WHERE g.email NOT LIKE '%@anonymized.invalid'
                AND (:q = '' OR g.email ILIKE :pattern OR EXISTS
                  (SELECT 1 FROM salon_customer c WHERE lower(btrim(c.email))=g.email AND (c.name ILIKE :pattern OR c.phone ILIKE :pattern)))
                AND (:role = '' OR g.role=:role)
                AND (CAST(:salon AS uuid) IS NULL OR g.salon_id=:salon)
                """;
        String having=switch(status) {
            case "ACTIVE" -> " HAVING bool_or(g.active)";
            case "INACTIVE" -> " HAVING NOT bool_or(g.active)";
            case "ALL" -> "";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown status filter");
        };
        if (!Set.of("","CUSTOMER","OWNER","STAFF","SUPER_ADMIN").contains(role))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown role filter");
        String escaped=q.strip().replace("\\","\\\\").replace("%","\\%").replace("_","\\_");
        String grouped=" FROM managed_user_grant g "+predicate+" GROUP BY g.email"+having;
        var count=jdbc.sql("SELECT count(*) FROM (SELECT g.email"+grouped+") entries")
                .param("q",q.strip()).param("pattern","%"+escaped+"%").param("role",role).param("salon",salonId).query(Long.class).single();
        var content=jdbc.sql("""
                SELECT g.email, COALESCE((SELECT min(c.name) FROM salon_customer c WHERE lower(btrim(c.email))=g.email),
                    (SELECT min(sm.name) FROM staff_member sm WHERE lower(btrim(sm.email))=g.email), g.email) AS name,
                string_agg(DISTINCT g.role, ', ' ORDER BY g.role) roles, count(DISTINCT g.salon_id) salon_count,
                bool_or(g.active) has_access
                """+grouped+" ORDER BY g.email LIMIT :limit OFFSET :offset")
                .param("q",q.strip()).param("pattern","%"+escaped+"%").param("role",role).param("salon",salonId)
                .param("limit",limit).param("offset",(long)offsetPage*limit)
                .query((rs,i)->new UserSummary(rs.getString("email"),rs.getString("name"),rs.getString("roles"),
                        rs.getInt("salon_count"),rs.getBoolean("has_access"))).list();
        return new UserPage(content,offsetPage,limit,count,(int)((count+limit-1)/limit));
    }

    Detail detail(String raw) {
        String email=email(raw);
        var grants=grants(email,null);
        if(grants.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found");
        var profiles=jdbc.sql("""
                SELECT c.id,c.salon_id,s.name salon_name,c.name,c.phone,c.notes,c.last_seen_at::text last_seen_at
                FROM salon_customer c JOIN salon s ON s.id=c.salon_id WHERE lower(btrim(c.email))=:email ORDER BY s.name,c.id
                """).param("email",email).query().listOfRows();
        return new Detail(email,grants,profiles);
    }

    private List<Grant> grants(String email,UUID salonId) {
        return jdbc.sql("""
                SELECT g.*,s.name salon_name, COALESCE((SELECT min(i.role) FROM user_identity i
                    WHERE lower(btrim(i.email))=g.email AND i.salon_id IS NOT DISTINCT FROM g.salon_id),g.role) effective_role
                FROM managed_user_grant g LEFT JOIN salon s ON s.id=g.salon_id
                WHERE g.email=:email AND (CAST(:salon AS uuid) IS NULL OR g.salon_id=:salon)
                ORDER BY g.salon_id NULLS FIRST,g.role,g.source_id
                """).param("email",email).param("salon",salonId)
                .query((rs,i)->new Grant(rs.getObject("salon_id",UUID.class),rs.getString("salon_name"),rs.getString("role"),
                        rs.getString("staff_role"),rs.getString("effective_role"),rs.getBoolean("active"),rs.getObject("source_id",Long.class))).list();
    }

    private static String email(String raw) {
        String email=UserAccessPolicy.canonical(raw);
        if(email.isEmpty() || email.length()>254 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a valid email address.");
        return email;
    }
}
