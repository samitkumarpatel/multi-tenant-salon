package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;

import java.util.Optional;
import java.util.UUID;

interface SaloonRepository extends ListCrudRepository<Saloon, UUID> {
    Optional<Saloon> findByHandler(String handler);
    boolean existsByHandler(String handler);
    List<Saloon> findByOwnerEmail(String ownerEmail);
}
