package net.samitkumar.multi_tenant_salon.media.internal;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Slf4j
@RestController
@RequestMapping("/api/media/photos")
@ConditionalOnProperty(name = "media.storage-type", havingValue = "LOCAL", matchIfMissing = true)
class MediaServiceController {

    private final Path root;

    MediaServiceController(@Value("${media.local-storage-path:/tmp/salon-photos}") String storageDir) {
        this.root = Path.of(storageDir).toAbsolutePath().normalize();
    }

    // Receives the raw file PUT from the browser (same contract as an S3 pre-signed URL).
    // encodedKey has slashes replaced with '~', e.g. "uploads~profile~1~uuid.jpg".
    @PutMapping("/upload/{encodedKey}")
    ResponseEntity<Void> upload(@PathVariable String encodedKey,
                                HttpServletRequest request) throws IOException {
        String key = encodedKey.replace("~", "/");
        Path target = resolve(key);
        if (target == null) return ResponseEntity.badRequest().build();
        Files.createDirectories(target.getParent());
        try (var in = request.getInputStream()) {
            Files.write(target, in.readAllBytes());
        }
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
