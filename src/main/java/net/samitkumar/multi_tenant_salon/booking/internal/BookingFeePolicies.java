package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.BookingFeePolicy;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.UUID;

/** Reads and writes a salon's {@link BookingFeePolicy}; no row means no fee. */
@Service
class BookingFeePolicies {

    private final JdbcClient jdbc;

    BookingFeePolicies(JdbcTemplate jdbcTemplate) {
        this.jdbc = JdbcClient.create(jdbcTemplate);
    }

    BookingFeePolicy get(UUID salonId) {
        return jdbc.sql("SELECT no_show_fee_type, no_show_fee_value FROM booking_fee_policy WHERE salon_id = :salonId")
                .param("salonId", salonId)
                .query((rs, i) -> new BookingFeePolicy(BookingFeePolicy.FeeType.valueOf(rs.getString(1)), rs.getBigDecimal(2)))
                .optional().orElse(BookingFeePolicy.NONE);
    }

    /** Upsert: the row is keyed by the salon id, which Spring Data's save() can't insert (assigned id). */
    BookingFeePolicy save(UUID salonId, BookingFeePolicy policy) {
        if (policy.noShowFeeType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "noShowFeeType is required");
        }
        var value = policy.noShowFeeType() == BookingFeePolicy.FeeType.NONE || policy.noShowFeeValue() == null
                ? BigDecimal.ZERO : policy.noShowFeeValue();
        if (value.signum() < 0 || (policy.noShowFeeType() == BookingFeePolicy.FeeType.PERCENT && value.compareTo(BigDecimal.valueOf(100)) > 0)
                || (policy.noShowFeeType() != BookingFeePolicy.FeeType.NONE && value.signum() == 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, policy.noShowFeeType() == BookingFeePolicy.FeeType.PERCENT
                    ? "A percentage fee must be between 0 and 100" : "The fee must be greater than zero");
        }
        var saved = new BookingFeePolicy(policy.noShowFeeType(), value);
        jdbc.sql("""
                        INSERT INTO booking_fee_policy (salon_id, no_show_fee_type, no_show_fee_value)
                        VALUES (:salonId, :type, :value)
                        ON CONFLICT (salon_id) DO UPDATE SET no_show_fee_type = EXCLUDED.no_show_fee_type,
                           no_show_fee_value = EXCLUDED.no_show_fee_value, updated_at = now()""")
                .param("salonId", salonId).param("type", saved.noShowFeeType().name()).param("value", saved.noShowFeeValue())
                .update();
        return saved;
    }
}
