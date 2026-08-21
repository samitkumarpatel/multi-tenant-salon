package net.samitkumar.multi_tenant_salon.media.internal;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Slf4j
@RestController
@RequestMapping("/api/media/photos")
@ConditionalOnProperty(name = "spring.application.media.storage-type", havingValue = "LOCAL", matchIfMissing = true)
class MediaServiceController {

    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024;

    private final Path root;
    private final LocalMediaUploadSigner signer;

    MediaServiceController(@Value("${spring.application.media.local-storage-path:/tmp/salon-photos}") String storageDir,
                            LocalMediaUploadSigner signer) {
        this.root = Path.of(storageDir).toAbsolutePath().normalize();
        this.signer = signer;
    }

    // Receives the raw file PUT from the browser (same contract as an S3 pre-signed URL).
    // encodedKey has slashes replaced with '~', e.g. "uploads~profile~1~uuid.jpg".
    // expires/signature must match what generateStaffPhotoUploadUrl issued — otherwise this
    // endpoint would accept a write from anyone, for any key, with no proof of authorization.
    @PutMapping("/upload/{encodedKey}")
    ResponseEntity<Void> upload(@PathVariable String encodedKey,
                                @RequestParam long expires,
                                @RequestParam String signature,
                                HttpServletRequest request) throws IOException {
        if (!signer.isValid(encodedKey, expires, signature)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        if (request.getContentLengthLong() > MAX_UPLOAD_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
        }
        String key = encodedKey.replace("~", "/");
        Path target = resolve(key);
        if (target == null) return ResponseEntity.badRequest().build();
        Files.createDirectories(target.getParent());
        byte[] content = request.getInputStream().readNBytes((int) MAX_UPLOAD_BYTES + 1);
        if (content.length > MAX_UPLOAD_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
        }
        Files.write(target, content);
        log.debug("[LocalMediaController] saved photo: {}", target);
        return ResponseEntity.ok().build();
    }

    // Serves a previously uploaded photo by its key path, e.g. /uploads/profile/1/uuid.jpg.
    @GetMapping("/{*key}")
    ResponseEntity<byte[]> serve(@PathVariable String key) throws IOException {
        // Strip leading slash that Spring MVC includes in wildcard capture.
        String normalizedKey = key.startsWith("/") ? key.substring(1) : key;
        Path target = resolve(normalizedKey);
        if (target == null) return ResponseEntity.badRequest().build();
        if (!Files.exists(target)) return ResponseEntity.notFound().build();
        byte[] content = Files.readAllBytes(target);
        String contentType = Files.probeContentType(target);
        return ResponseEntity.ok()
                .contentType(contentType != null
                        ? MediaType.parseMediaType(contentType)
                        : MediaType.APPLICATION_OCTET_STREAM)
                .body(content);
    }

    /** Resolves a key relative to the storage root, rejecting path-traversal attempts. */
    private Path resolve(String key) {
        Path resolved = root.resolve(key).normalize();
        return resolved.startsWith(root) ? resolved : null;
    }
}
