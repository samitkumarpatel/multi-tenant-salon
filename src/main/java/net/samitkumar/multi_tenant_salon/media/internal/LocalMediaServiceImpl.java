package net.samitkumar.multi_tenant_salon.media.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.media.MediaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty(name = "spring.application.media.storage-type", havingValue = "LOCAL", matchIfMissing = true)
class LocalMediaServiceImpl implements MediaService {

    private static final long UPLOAD_URL_TTL_SECONDS = 15 * 60;

    private final String storageDir;
    private final String baseUrl;
    private final LocalMediaUploadSigner signer;

    LocalMediaServiceImpl(
            @Value("${spring.application.media.local-storage-path:/tmp/salon-photos}") String storageDir,
            @Value("${spring.application.media.local-base-url:http://localhost:8080}") String baseUrl,
            LocalMediaUploadSigner signer) {
        this.storageDir = storageDir;
        this.baseUrl = baseUrl;
        this.signer = signer;
        log.info("[LocalMediaService] Photo storage: {} (served via {})", storageDir, baseUrl);
    }

    @Override
    public PresignedUpload generateStaffPhotoUploadUrl(Long staffId, String contentType) {
        String ext = switch (contentType == null ? "" : contentType.toLowerCase()) {
            case "image/png"  -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif"  -> ".gif";
            default           -> ".jpg";
        };
        String key = "uploads/profile/" + staffId + "/" + UUID.randomUUID() + ext;
        // Encode slashes so the key fits in a single path segment for the upload endpoint.
        String encodedKey = key.replace("/", "~");
        long expires = Instant.now().plusSeconds(UPLOAD_URL_TTL_SECONDS).getEpochSecond();
        String signature = signer.sign(encodedKey, expires);
        // expires/signature stand in for what a real S3 pre-signed URL enforces natively —
        // without them the upload endpoint would accept a write from anyone, for any key.
        String presignedUrl = baseUrl + "/api/media/photos/upload/" + encodedKey
                + "?expires=" + expires + "&signature=" + signature;
        String publicUrl = baseUrl + "/api/media/photos/" + key;
        log.debug("[LocalMediaService] upload URL: {} public URL: {}", presignedUrl, publicUrl);
        return new PresignedUpload(presignedUrl, publicUrl);
    }
}
