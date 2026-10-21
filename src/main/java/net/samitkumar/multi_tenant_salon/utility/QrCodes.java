package net.samitkumar.multi_tenant_salon.utility;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.CRC32;
import java.util.zip.Deflater;
import java.util.zip.DeflaterOutputStream;

/**
 * QR codes as PNG bytes. The PNG is encoded by hand (8-bit grayscale, one IDAT chunk) rather than
 * through ImageIO/AWT, which drag desktop libraries into the GraalVM native image.
 */
public final class QrCodes {
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    private QrCodes() {}

    /** A black-on-white QR code for {@code content}, at least {@code size} pixels square (quiet zone included). */
    public static byte[] png(String content, int size) {
        try {
            BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, Map.of(
                    EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                    EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name(),
                    EncodeHintType.MARGIN, 2));
            return encodePng(matrix);
        } catch (WriterException | IOException e) {
            throw new IllegalStateException("Could not render QR code", e);
        }
    }

    private static byte[] encodePng(BitMatrix matrix) throws IOException {
        int width = matrix.getWidth();
        int height = matrix.getHeight();
        var raw = new ByteArrayOutputStream();
        try (var deflate = new DeflaterOutputStream(raw, new Deflater(Deflater.BEST_COMPRESSION))) {
            var row = new byte[width + 1]; // leading filter byte 0 (None)
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) row[x + 1] = matrix.get(x, y) ? 0 : (byte) 0xFF;
                deflate.write(row);
            }
        }
        var out = new ByteArrayOutputStream();
        out.write(PNG_SIGNATURE);
        var header = new ByteArrayOutputStream();
        var h = new DataOutputStream(header);
        h.writeInt(width);
        h.writeInt(height);
        h.writeByte(8); // bit depth
        h.writeByte(0); // colour type: grayscale
        h.writeByte(0); // compression
        h.writeByte(0); // filter
        h.writeByte(0); // interlace
        chunk(out, "IHDR", header.toByteArray());
        chunk(out, "IDAT", raw.toByteArray());
        chunk(out, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void chunk(ByteArrayOutputStream out, String type, byte[] data) throws IOException {
        var d = new DataOutputStream(out);
        var typeBytes = type.getBytes(StandardCharsets.US_ASCII);
        d.writeInt(data.length);
        d.write(typeBytes);
        d.write(data);
        var crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        d.writeInt((int) crc.getValue());
    }
}
