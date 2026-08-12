package net.samitkumar.multi_tenant_saloon.media;

public interface MediaApi {
    record PresignedUpload(String presignedUrl, String publicUrl) {}

    PresignedUpload generateStaffPhotoUploadUrl(Long staffId, String contentType);
}
