package net.samitkumar.multi_tenant_salon.payments.internal;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Set;

/** Converts prices to Stripe's integer minor units, per currency. */
final class StripeAmounts {
    private static final Set<String> ZERO_DECIMAL = Set.of("BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
            "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF");
    private static final Set<String> THREE_DECIMAL = Set.of("BHD", "JOD", "KWD", "OMR", "TND");

    private StripeAmounts() {}

    static long minorUnits(BigDecimal amount, String currency) {
        return amount.movePointRight(exponent(currency)).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    static int exponent(String currency) {
        var code = currency.toUpperCase(Locale.ROOT);
        if (ZERO_DECIMAL.contains(code)) return 0;
        if (THREE_DECIMAL.contains(code)) return 3;
        return 2;
    }
}
