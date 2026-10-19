package net.samitkumar.multi_tenant_salon.chat.internal;

import java.util.List;

/**
 * The assistant's answer for one turn: a short conversational {@code message}, the interactive
 * {@code components} to render beneath it, the {@code suggestedQuestions} to offer as chips, the
 * data lookups that ran, and a staged {@link PendingBooking} if the model proposed one.
 * {@code mcpAppCall} holds the arguments of the Salon MCP App opened this turn and
 * {@code mcpAppTool} names that app's tool (e.g. {@code salon_booking_week}).
 */
record ChatReply(String message, List<UiComponent> components, List<String> suggestedQuestions,
                 java.util.Map<String, Object> mcpAppCall,
                 List<String> toolsUsed, PendingBooking pendingBooking, String mcpAppTool) {
}
