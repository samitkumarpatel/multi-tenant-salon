package net.samitkumar.multi_tenant_saloon.identity;

import java.util.UUID;

public record UserIdentity(String email, String role, UUID saloonId, boolean active) {}
