package net.samitkumar.multi_tenant_salon.rating.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Public scores only. Customer identities, written feedback and replies stay on private endpoints. */
@RestController
class PublicRatingsController {
    private final JdbcClient jdbc;
    private final SalonApi salons;

    PublicRatingsController(JdbcClient jdbc, SalonApi salons) {
        this.jdbc = jdbc;
        this.salons = salons;
    }

    record Score(int rating, Long staffId, String staffName, LocalDate date, boolean verifiedVisit) {}
    record Page(List<Score> items, long count, Double average, Map<Integer, Long> distribution, int page, int size, long totalPages) {}

    private static final String SCORES = """
            FROM (
                SELECT salon_id, staff_id, salon_rating, staff_rating, submitted_at, true verified_visit,
                       booking_id sort_id, 0 sort_source FROM booking_review
                UNION ALL
                SELECT salon_id, staff_id, salon_rating, staff_rating, submitted_at, false verified_visit,
                       id sort_id, 1 sort_source FROM customer_feedback
            ) r
            """;

    @GetMapping("/api/salon/{salonId}/ratings/public")
    Page scores(@PathVariable String salonId, @RequestParam(defaultValue = "salon") String target,
                @RequestParam(required = false) Long staffId, @RequestParam(defaultValue = "1") int page,
                @RequestParam(defaultValue = "20") int size) {
        if ((!target.equals("salon") && !target.equals("stylist")) || page < 1 || size < 1 || size > 50
                || (staffId != null && (staffId < 1 || !target.equals("stylist")))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose salon or stylist ratings and a page size from 1 to 50.");
        }
        var id = salons.resolveId(salonId);
        jdbc.sql("SELECT id FROM salon WHERE id=:id AND status <> 'DISABLED'").param("id", id).query(java.util.UUID.class)
                .optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // Only these fixed column names enter the query; customer input is always bound.
        var column = target.equals("salon") ? "salon_rating" : "staff_rating";
        var where = " WHERE r.salon_id=:salon AND r." + column + " IS NOT NULL"
                + (staffId == null ? "" : " AND r.staff_id=:staff");
        var counts = jdbc.sql("SELECT r." + column + " rating, count(*) total " + SCORES + where + " GROUP BY r." + column)
                .param("salon", id);
        if (staffId != null) counts = counts.param("staff", staffId);
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int rating = 1; rating <= 5; rating++) distribution.put(rating, 0L);
        counts.query((rs, row) -> { distribution.put(rs.getInt("rating"), rs.getLong("total")); return 1; }).list();
        long count = distribution.values().stream().mapToLong(Long::longValue).sum();
        long weighted = distribution.entrySet().stream().mapToLong(entry -> entry.getKey() * entry.getValue()).sum();
        Double average = count == 0 ? null : Math.round(10.0 * weighted / count) / 10.0;
        long totalPages = Math.max(1L, (count + size - 1) / size);
        int currentPage = (int) Math.min(page, totalPages);
        var query = jdbc.sql("SELECT r." + column + " rating,r.staff_id,sm.name staff_name,r.submitted_at,r.verified_visit "
                        + SCORES + " LEFT JOIN staff_member sm ON sm.id=r.staff_id AND sm.salon_id=r.salon_id" + where
                        + " ORDER BY r.submitted_at DESC,r.sort_source DESC,r.sort_id DESC LIMIT :limit OFFSET :offset")
                .param("salon", id).param("limit", size).param("offset", (long) (currentPage - 1) * size);
        if (staffId != null) query = query.param("staff", staffId);
        var items = query.query((rs, row) -> new Score(rs.getInt("rating"), rs.getObject("staff_id", Long.class),
                rs.getString("staff_name"), rs.getTimestamp("submitted_at").toLocalDateTime().toLocalDate(),
                rs.getBoolean("verified_visit"))).list();
        return new Page(items, count, average, distribution, currentPage, size, totalPages);
    }
}
