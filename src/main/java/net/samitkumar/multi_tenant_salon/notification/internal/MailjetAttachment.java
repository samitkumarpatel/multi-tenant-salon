package net.samitkumar.multi_tenant_salon.notification.internal;

import com.fasterxml.jackson.annotation.JsonProperty;

/** An inline attachment referenced from the HTML part as {@code cid:<ContentID>}. */
record MailjetAttachment(
        @JsonProperty("ContentType") String contentType,
        @JsonProperty("Filename") String filename,
        @JsonProperty("ContentID") String contentId,
        @JsonProperty("Base64Content") String base64Content) {
}
