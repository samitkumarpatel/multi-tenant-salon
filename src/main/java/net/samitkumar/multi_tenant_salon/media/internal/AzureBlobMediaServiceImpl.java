package net.samitkumar.multi_tenant_salon.media.internal;

import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.models.UserDelegationKey;
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

        // Account keys/connection strings are avoided by design (DefaultAzureCredential /
        // managed identity only), so a SAS must be minted via a short-lived user delegation
        // key rather than blobClient.generateSas(...), which requires a shared key credential.
        OffsetDateTime start = OffsetDateTime.now().minusMinutes(5);
        OffsetDateTime expiry = OffsetDateTime.now().plus(Duration.ofMinutes(15));
        UserDelegationKey delegationKey = blobServiceClient.getUserDelegationKey(start, expiry);

        BlobSasPermission permission = new BlobSasPermission()
                .setWritePermission(true)
                .setCreatePermission(true);
        BlobServiceSasSignatureValues sasValues = new BlobServiceSasSignatureValues(expiry, permission)
                .setStartTime(start);

        String sas = blobClient.generateUserDelegationSas(sasValues, delegationKey);
        String presignedUrl = blobClient.getBlobUrl() + "?" + sas;
        return new PresignedUpload(presignedUrl, cdnBaseUrl + "/" + key);
    }
}
