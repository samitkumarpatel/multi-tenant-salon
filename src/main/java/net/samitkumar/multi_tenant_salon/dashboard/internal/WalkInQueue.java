package net.samitkumar.multi_tenant_salon.dashboard.internal;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/** Who is waiting at the desk without an appointment, in the order they arrived. Rides on the "Appointment management" switch. */
@Service
class WalkInQueue {
    private static final int MAX_WAITING = 100;

    record Entry(Long id, String customerName, String phone, Long serviceId, String serviceName, Long staffId, String staffName,
                 String note, Instant createdAt, String createdBy) {}

    record Request(String customerName, String phone, Long serviceId, Long staffId, String note) {}

    private final JdbcClient jdbc;
    private final DashboardManager dashboard;

    WalkInQueue(JdbcTemplate jdbcTemplate, DashboardManager dashboard) {
        this.jdbc = JdbcClient.create(jdbcTemplate);
        this.dashboard = dashboard;
    }

    List<Entry> waiting(UUID salonId) {
        requireBookingManagement(salonId);
        return jdbc.sql("""
                SELECT w.id, w.customer_name, w.phone, w.service_id, si.name AS service_name, w.staff_id, sm.name AS staff_name,
                       w.note, w.created_at, w.created_by
                FROM walk_in w
                LEFT JOIN service_item si ON si.id = w.service_id AND si.salon_id = w.salon_id
                LEFT JOIN staff_member sm ON sm.id = w.staff_id AND sm.salon_id = w.salon_id
                WHERE w.salon_id = :salon AND w.status = 'WAITING'
                ORDER BY w.created_at, w.id""")
                .param("salon", salonId)
                .query((rs, i) -> new Entry(rs.getLong("id"), rs.getString("customer_name"), rs.getString("phone"),
                        (Long) rs.getObject("service_id"), rs.getString("service_name"), (Long) rs.getObject("staff_id"), rs.getString("staff_name"),
                        rs.getString("note"), rs.getTimestamp("created_at").toInstant(), rs.getString("created_by")))
                .list();
    }

    Entry add(UUID salonId, Request request, String actor) {
        requireBookingManagement(salonId);
        var name = clean(request.customerName(), 255);
        if (name == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A name is required");
        if (waiting(salonId).size() >= MAX_WAITING) throw new ResponseStatusException(HttpStatus.CONFLICT, "The queue is full");
        // A service or stylist from another salon is the same as none: it simply isn't found.
        var serviceId = request.serviceId() == null ? null : owned("service_item", request.serviceId(), salonId);
        var staffId = request.staffId() == null ? null : owned("staff_member", request.staffId(), salonId);
        var id = jdbc.sql("""
                INSERT INTO walk_in (salon_id, customer_name, phone, service_id, staff_id, note, created_by)
                VALUES (:salon, :name, :phone, :service, :staff, :note, :by) RETURNING id""")
                .param("salon", salonId).param("name", name).param("phone", clean(request.phone(), 40))
                .param("service", serviceId).param("staff", staffId).param("note", clean(request.note(), 500)).param("by", actor)
                .query(Long.class).single();
        return waiting(salonId).stream().filter(e -> e.id().equals(id)).findFirst().orElseThrow();
    }

    /** {@code SEATED} (they are being served) or {@code LEFT} (they gave up waiting); only a waiting entry can move. */
    void resolve(UUID salonId, Long id, String status) {
        requireBookingManagement(salonId);
        int changed = jdbc.sql("UPDATE walk_in SET status = :status, resolved_at = :at WHERE id = :id AND salon_id = :salon AND status = 'WAITING'")
                .param("status", status).param("at", OffsetDateTime.now(ZoneOffset.UTC)).param("id", id).param("salon", salonId).update();
        if (changed != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No one is waiting under that entry");
    }

    private Long owned(String table, Long id, UUID salonId) {
        // table is one of two constants above, never user input.
        return jdbc.sql("SELECT id FROM " + table + " WHERE id = :id AND salon_id = :salon").param("id", id).param("salon", salonId)
                .query(Long.class).optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service or stylist not found"));
    }

    private void requireBookingManagement(UUID salonId) {
        if (!dashboard.settings(salonId).bookingManagementEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Appointment management is disabled");
        }
    }

    private static String clean(String value, int max) {
        if (value == null || value.isBlank()) return null;
        var trimmed = value.strip();
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
