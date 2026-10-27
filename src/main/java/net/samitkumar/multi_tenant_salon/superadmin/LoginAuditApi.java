package net.samitkumar.multi_tenant_salon.superadmin;

import java.util.UUID;

/** Public entry point for recording sign-in attempts, so other modules never touch superadmin internals. */
public interface LoginAuditApi {
    /** Records a completed customer sign-in attempt in its own transaction, so a failed attempt still leaves a trace. */
    void recordCustomer(UUID salonId, String email, String result, boolean verified);
}
