package net.samitkumar.multi_tenant_saloon.saloon;

import java.util.UUID;

public record WebsitePublishRequestedEvent(UUID saloonId, String saloonName, String handler, String ownerEmail) {}
