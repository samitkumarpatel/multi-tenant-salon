package net.samitkumar.multi_tenant_salon.notification.internal;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

record MailjetMessage(
        @JsonProperty("From") MailjetEmail from,
        @JsonProperty("To") List<MailjetEmail> to,
        @JsonProperty("Subject") String subject,
        @JsonProperty("TextPart") String textPart,
        @JsonProperty("HTMLPart") String htmlPart,
        @JsonProperty("InlinedAttachments") @JsonInclude(JsonInclude.Include.NON_EMPTY) List<MailjetAttachment> inlinedAttachments) {

    MailjetMessage(MailjetEmail from, List<MailjetEmail> to, String subject, String textPart, String htmlPart) {
        this(from, to, subject, textPart, htmlPart, List.of());
    }
}
