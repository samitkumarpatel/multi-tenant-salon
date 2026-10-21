package net.samitkumar.multi_tenant_salon.utility;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;

import static org.assertj.core.api.Assertions.assertThat;

class QrCodesTest {

    /** The hand-written PNG must be a valid image that decodes back to the encoded text. */
    @Test void pngDecodesBackToItsContent() throws Exception {
        var png = QrCodes.png("M7K2Q9XZT", 300);

        var image = ImageIO.read(new ByteArrayInputStream(png));
        assertThat(image.getWidth()).isGreaterThanOrEqualTo(300);
        var pixels = image.getRGB(0, 0, image.getWidth(), image.getHeight(), null, 0, image.getWidth());
        var bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(image.getWidth(), image.getHeight(), pixels)));
        assertThat(new QRCodeReader().decode(bitmap).getText()).isEqualTo("M7K2Q9XZT");
    }
}
