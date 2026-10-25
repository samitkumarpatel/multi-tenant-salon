package net.samitkumar.multi_tenant_salon.customer.internal;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/** Reads and writes a salon's {@link SelfServicePolicy}; no row means the defaults. */
@Service
class SelfServicePolicies {

    private final JdbcClient jdbc;

    SelfServicePolicies(JdbcTemplate jdbcTemplate) {
        this.jdbc = JdbcClient.create(jdbcTemplate);
    }

    SelfServicePolicy get(UUID salonId) {
        return jdbc.sql("SELECT allow_cancel, cancel_notice_hours, allow_reschedule, reschedule_notice_hours FROM customer_self_service_policy WHERE salon_id = :salonId")
                .param("salonId", salonId)
                .query((rs, i) -> new SelfServicePolicy(rs.getBoolean(1), rs.getInt(2), rs.getBoolean(3), rs.getInt(4)))
                .optional().orElse(SelfServicePolicy.DEFAULT);
    }

    /** Upsert: the row is keyed by the salon id, which Spring Data's save() can't insert (assigned id). */
    SelfServicePolicy save(UUID salonId, SelfServicePolicy policy) {
        if (policy.cancelNoticeHours() < 0 || policy.cancelNoticeHours() > SelfServicePolicy.MAX_NOTICE_HOURS
                || policy.rescheduleNoticeHours() < 0 || policy.rescheduleNoticeHours() > SelfServicePolicy.MAX_NOTICE_HOURS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Notice must be between 0 and " + SelfServicePolicy.MAX_NOTICE_HOURS + " hours");
        }
        jdbc.sql("""
                        INSERT INTO customer_self_service_policy (salon_id, allow_cancel, cancel_notice_hours, allow_reschedule, reschedule_notice_hours)
                        VALUES (:salonId, :allowCancel, :cancelHours, :allowReschedule, :rescheduleHours)
                        ON CONFLICT (salon_id) DO UPDATE SET allow_cancel = EXCLUDED.allow_cancel,
                           cancel_notice_hours = EXCLUDED.cancel_notice_hours, allow_reschedule = EXCLUDED.allow_reschedule,
                           reschedule_notice_hours = EXCLUDED.reschedule_notice_hours, updated_at = now()""")
                .param("salonId", salonId).param("allowCancel", policy.allowCancel()).param("cancelHours", policy.cancelNoticeHours())
                .param("allowReschedule", policy.allowReschedule()).param("rescheduleHours", policy.rescheduleNoticeHours())
                .update();
        return policy;
    }
}
