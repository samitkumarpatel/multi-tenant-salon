package net.samitkumar.multi_tenant_salon.website;

import java.util.UUID;

/** Read-only domain checks for the HTTP boundary. No verification tokens are exposed. */
public interface WebsiteDomainApi {
    boolean isActiveOrigin(String origin);

    /** True when {@code origin} is the currently active custom domain connected by {@code salonId}. */
    boolean isActiveOriginFor(UUID salonId, String origin);
}
