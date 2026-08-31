package net.samitkumar.multi_tenant_salon.media.internal;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.sas.BlobSasPermission;
import com.azure.storage.blob.sas.BlobServiceSasSignatureValues;
import net.samitkumar.multi_tenant_salon.media.MediaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "spring.application.media.storage-type", havingValue = "AZURE")
class AzureBlobMediaServiceImpl implements MediaService {

    private final BlobServiceClient blobServiceClient;
    private final String containerName;
    private final String cdnBaseUrl;

    AzureBlobMediaServiceImpl(BlobServiceClient blobServiceClient,
                              @Value("${spring.application.media.staff-container-name}") String containerName,
                              @Value("${spring.application.media.staff-cdn-base-url:https://staff.salonsaas.org}") String cdnBaseUrl) {
        this.blobServiceClient = blobServiceClient;
        this.containerName = containerName;
        this.cdnBaseUrl = cdnBaseUrl;
    }

    @Override
    public PresignedUpload generateStaffPhotoUploadUrl(Long staffId, String contentType) {
        String ext = switch (contentType == null ? "" : contentType.toLowerCase()) {
            case "image/png"       -> ".png";
            case "image/webp"      -> ".webp";
            case "image/gif"       -> ".gif";
            case "video/mp4"       -> ".mp4";
            case "video/webm"      -> ".webm";
            case "video/quicktime" -> ".mov";
            default                -> ".jpg";
        };
        String key = "uploads/profile/" + staffId + "/" + UUID.randomUUID() + ext;
        BlobClient blobClient = blobServiceClient.getBlobContainerClient(containerName).getBlobClient(key);

        // Shared-key SAS: the BlobServiceClient is configured with the account key
        // (spring.cloud.azure.storage.blob.account-key), so blobClient.generateSas(...)
        // signs directly with it — no user-delegation key / managed-identity RBAC.
        OffsetDateTime expiry = OffsetDateTime.now().plus(Duration.ofMinutes(15));
        BlobSasPermission permission = new BlobSasPermission()
                .setWritePermission(true)
                .setCreatePermission(true);
        BlobServiceSasSignatureValues sasValues = new BlobServiceSasSignatureValues(expiry, permission);

        String sas = blobClient.generateSas(sasValues);
        String presignedUrl = blobClient.getBlobUrl() + "?" + sas;
        return new PresignedUpload(presignedUrl, cdnBaseUrl + "/" + key);
    }
}
