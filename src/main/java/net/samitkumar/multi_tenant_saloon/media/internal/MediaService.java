package net.samitkumar.multi_tenant_saloon.media.internal;

import io.awspring.cloud.s3.S3Template;
import net.samitkumar.multi_tenant_saloon.media.MediaApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
@ConditionalOnProperty("media.staff-bucket-name")
class MediaService implements MediaApi {

    private final S3Template s3Template;
    private final String bucketName;
    private final String cdnBaseUrl;

    MediaService(S3Template s3Template,
                 @Value("${media.staff-bucket-name}") String bucketName,
                 @Value("${media.staff-cdn-base-url:https://staff.my-saloon.online}") String cdnBaseUrl) {
        this.s3Template = s3Template;
        this.bucketName = bucketName;
        this.cdnBaseUrl = cdnBaseUrl;
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
        String presignedUrl = s3Template.createSignedPutURL(bucketName, key, Duration.ofMinutes(15)).toString();
        return new PresignedUpload(presignedUrl, cdnBaseUrl + "/" + key);
    }
}
