package net.samitkumar.multi_tenant_salon.identity;

import java.util.List;
import java.util.UUID;

public record UserIdentity(String email, List<SalonAccess> salons) {

    public record SalonAccess(UUID salonId, String role, boolean active) {}
}
