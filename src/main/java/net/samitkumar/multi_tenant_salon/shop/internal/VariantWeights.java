package net.samitkumar.multi_tenant_salon.shop.internal;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Estimates a variant's gross shipping weight from its label ("250 ml", "1.5 kg", "30 tablet"):
 * the measured contents — liquids at water density, so 1 ml ≈ 1 g — plus 10 % for packaging,
 * rounded up to the next 10 g. Counted units with no physical size ("pcs", "set", "pair") can't be
 * estimated. The product editor and the V23 backfill use the same table, so a weight the owner
 * never typed is the one they were shown.
 */
final class VariantWeights {
    private VariantWeights() {}

    private static final Pattern LABEL = Pattern.compile(
            "^\\s*(\\d+(?:[.,]\\d+)?)\\s*(fl oz|ml|kg|g|l|oz|lb|tablet|capsule|sachet)\\s*$", Pattern.CASE_INSENSITIVE);

    private static final Map<String, BigDecimal> GRAMS_PER_UNIT = Map.of(
            "ml", BigDecimal.ONE, "g", BigDecimal.ONE,
            "l", BigDecimal.valueOf(1000), "kg", BigDecimal.valueOf(1000),
            "oz", new BigDecimal("28.35"), "fl oz", new BigDecimal("29.57"), "lb", new BigDecimal("453.59"),
            "tablet", BigDecimal.ONE, "capsule", BigDecimal.ONE, "sachet", BigDecimal.valueOf(15));

    private static final BigDecimal PACKAGING = new BigDecimal("1.1");
    private static final BigDecimal TEN = BigDecimal.TEN;

    /** The estimated weight in grams, or {@code null} when the label has no measurable unit. */
    static Integer estimateGrams(String label) {
        if (label == null) return null;
        var m = LABEL.matcher(label);
        if (!m.matches()) return null;
        var amount = new BigDecimal(m.group(1).replace(',', '.'));
        var grams = amount.multiply(GRAMS_PER_UNIT.get(m.group(2).toLowerCase(Locale.ROOT))).multiply(PACKAGING);
        if (grams.signum() <= 0) return null;
        return grams.divide(TEN, 0, RoundingMode.CEILING).multiply(TEN).intValueExact();
    }
}
