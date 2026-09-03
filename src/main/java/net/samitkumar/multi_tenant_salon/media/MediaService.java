package net.samitkumar.multi_tenant_salon.media;

public interface  MediaService {
    record PresignedUpload(String presignedUrl, String publicUrl) {}

    PresignedUpload generateStaffPhotoUploadUrl(Long staffId, String contentType);

    PresignedUpload generateProductImageUploadUrl(Long productId, String contentType);
}
