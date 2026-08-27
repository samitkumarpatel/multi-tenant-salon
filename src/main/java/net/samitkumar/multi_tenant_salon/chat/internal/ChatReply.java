package net.samitkumar.multi_tenant_salon.chat.internal;

import java.util.List;

record ChatReply(String text, List<String> toolsUsed, PendingBooking pendingBooking, UiDirective ui) {
}
