package net.samitkumar.multi_tenant_saloon.media;

public interface  MediaService {
    record PresignedUpload(String presignedUrl, String publicUrl) {}

    PresignedUpload generateStaffPhotoUploadUrl(Long staffId, String contentType);
}
