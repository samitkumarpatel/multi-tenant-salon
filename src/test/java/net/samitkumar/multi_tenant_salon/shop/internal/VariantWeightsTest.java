package net.samitkumar.multi_tenant_salon.shop.internal;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class VariantWeightsTest {

    @ParameterizedTest
    @CsvSource(nullValues = "null", value = {
            "250 ml, 280",
            "100 ml, 110",
            "1 L, 1100",
            "'1,5 kg', 1650",
            "50 g, 60",
            "8 fl oz, 270",
            "2 lb, 1000",
            "30 tablet, 40",
            "2 pcs, null",
            "Gift set, null",
            "0 ml, null",
            "null, null",
    })
    void estimatesContentsPlusPackaging(String label, Integer expected) {
        assertThat(VariantWeights.estimateGrams(label)).isEqualTo(expected);
    }
}
