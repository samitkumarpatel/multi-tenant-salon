package net.samitkumar.multi_tenant_salon.notification.internal;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

record MailjetRequest(@JsonProperty("Messages") List<MailjetMessage> messages) {}
