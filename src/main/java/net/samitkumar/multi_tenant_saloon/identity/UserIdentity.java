package net.samitkumar.multi_tenant_saloon.identity;

import java.util.List;
import java.util.UUID;

public record UserIdentity(String email, List<SaloonAccess> saloons) {

    public record SaloonAccess(UUID saloonId, String role, boolean active) {}
}
