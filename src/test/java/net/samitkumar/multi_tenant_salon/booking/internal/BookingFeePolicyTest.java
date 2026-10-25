package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.booking.BookingFeePolicy;
import net.samitkumar.multi_tenant_salon.booking.BookingFeePolicy.FeeType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
class BookingFeePolicyTest {
    @Autowired BookingFeePolicies policies;
    @Autowired JdbcTemplate jdbc;

    private UUID salon() {
        var id = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, address, city, zip_code, country, created_at)"
                + " VALUES (?, 'Glow Studio', ?, 'Main St 1', 'Copenhagen', '2100', 'Denmark', now())", id, "glow-" + id);
        return id;
    }

    @Test void feeIsNothingAPercentageOrACappedFixedAmount() {
        var price = new BigDecimal("80.00");
        assertThat(BookingFeePolicy.NONE.noShowFee(price)).isEqualByComparingTo("0");
        assertThat(new BookingFeePolicy(FeeType.PERCENT, new BigDecimal("50")).noShowFee(price)).isEqualByComparingTo("40.00");
        assertThat(new BookingFeePolicy(FeeType.FIXED, new BigDecimal("25")).noShowFee(price)).isEqualByComparingTo("25.00");
        assertThat(new BookingFeePolicy(FeeType.FIXED, new BigDecimal("150")).noShowFee(price)).isEqualByComparingTo("80.00");
    }

    @Test void aSalonWithoutARowHasNoFeeAndSavingUpdatesInPlace() {
        var salon = salon();
        assertThat(policies.get(salon)).isEqualTo(BookingFeePolicy.NONE);

        policies.save(salon, new BookingFeePolicy(FeeType.PERCENT, new BigDecimal("30")));
        assertThat(policies.get(salon).noShowFeeType()).isEqualTo(FeeType.PERCENT);

        policies.save(salon, new BookingFeePolicy(FeeType.NONE, new BigDecimal("99")));
        var cleared = policies.get(salon);
        assertThat(cleared.noShowFeeType()).isEqualTo(FeeType.NONE);
        assertThat(cleared.noShowFeeValue()).isEqualByComparingTo("0");
    }

    @Test void rejectsFeesThatMakeNoSense() {
        var salon = salon();
        assertThatThrownBy(() -> policies.save(salon, new BookingFeePolicy(FeeType.PERCENT, new BigDecimal("101"))))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> policies.save(salon, new BookingFeePolicy(FeeType.FIXED, BigDecimal.ZERO)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> policies.save(salon, new BookingFeePolicy(null, BigDecimal.ONE)))
                .isInstanceOf(ResponseStatusException.class);
    }
}
