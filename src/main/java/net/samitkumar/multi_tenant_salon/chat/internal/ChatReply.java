package net.samitkumar.multi_tenant_salon.chat.internal;

import java.util.List;

/**
 * The assistant's answer for one turn: a short conversational {@code message}, the interactive
 * {@code components} to render beneath it, the {@code suggestedQuestions} to offer as chips, the
 * data lookups that ran, and a staged {@link PendingBooking} if the model proposed one.
 */
record ChatReply(String message, List<UiComponent> components, List<String> suggestedQuestions,
                 List<String> toolsUsed, PendingBooking pendingBooking) {
}
