package net.samitkumar.multi_tenant_salon.identity;

import java.util.Optional;

/** Live lookup of who an email is in each salon (owner, staff, super-admin), straight from the database. */
public interface UserIdentityApi {
    Optional<UserIdentity> findByEmail(String email);
}
