package net.samitkumar.multi_tenant_salon.chat.internal;

/** One prior turn of the conversation, as replayed back to the model. */
record ChatTurn(String role, String text) {
}
