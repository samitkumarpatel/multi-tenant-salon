package net.samitkumar.multi_tenant_salon.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * What a salon charges for a missed appointment: nothing, a percentage of the service price, or a fixed
 * amount (never more than the service costs).
 */
public record BookingFeePolicy(FeeType noShowFeeType, BigDecimal noShowFeeValue) {

    public enum FeeType { NONE, PERCENT, FIXED }

    /** What a salon has until its owner sets one. */
    public static final BookingFeePolicy NONE = new BookingFeePolicy(FeeType.NONE, BigDecimal.ZERO);

    /** The no-show fee for a service costing {@code servicePrice}; zero when the salon charges none. */
    public BigDecimal noShowFee(BigDecimal servicePrice) {
        if (servicePrice == null || noShowFeeType == null || noShowFeeValue == null) return BigDecimal.ZERO;
        return switch (noShowFeeType) {
            case NONE -> BigDecimal.ZERO;
            case PERCENT -> servicePrice.multiply(noShowFeeValue).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            case FIXED -> noShowFeeValue.min(servicePrice).setScale(2, RoundingMode.HALF_UP);
        };
    }
}
