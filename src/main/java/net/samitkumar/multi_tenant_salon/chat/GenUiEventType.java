package net.samitkumar.multi_tenant_salon.chat;

/** Kinds of Generative-UI chat interaction the {@code analytics} module can record usage for. */
public enum GenUiEventType {
    /** One visitor message sent to the assistant. */
    MESSAGE_SENT,
    /** One interactive component (services, staff, staff-profile, quick-actions, ...) shown for a turn. */
    COMPONENT_SHOWN,
    /** One data-lookup tool (getStaff, getServices, checkAvailability, ...) the assistant invoked. */
    TOOL_INVOKED,
    /** The assistant staged a booking proposal for the visitor to confirm. */
    BOOKING_PROPOSED
}
