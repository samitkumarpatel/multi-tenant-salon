package net.samitkumar.multi_tenant_salon.website;

/** Read-only domain checks for the HTTP boundary. No verification tokens are exposed. */
public interface WebsiteDomainApi {
    boolean isActiveOrigin(String origin);
}
