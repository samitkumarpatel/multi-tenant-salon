package net.samitkumar.multi_tenant_saloon.media.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_saloon.media.MediaApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
// Active when media.staff-bucket-name is absent (local dev); havingValue is set to an impossible string
// so the condition only passes via matchIfMissing=true (i.e., when the property is not set at all).
@ConditionalOnProperty(name = "media.staff-bucket-name", matchIfMissing = true, havingValue = "__local__")
class LocalMediaService implements MediaApi {

    private final String storageDir;
    private final String baseUrl;

    LocalMediaService(
            @Value("${media.local-storage-path:/tmp/saloon-photos}") String storageDir,
            @Value("${media.local-base-url:http://localhost:8080}") String baseUrl) {
        this.storageDir = storageDir;
        this.baseUrl = baseUrl;
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
        String presignedUrl = baseUrl + "/api/media/photos/upload/" + encodedKey;
        String publicUrl = baseUrl + "/api/media/photos/" + key;
        log.debug("[LocalMediaService] upload URL: {} public URL: {}", presignedUrl, publicUrl);
        return new PresignedUpload(presignedUrl, publicUrl);
    }
}
