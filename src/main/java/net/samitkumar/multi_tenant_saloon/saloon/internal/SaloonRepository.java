package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface SaloonRepository extends ListCrudRepository<Saloon, UUID> {
    Optional<Saloon> findByHandler(String handler);
    boolean existsByHandler(String handler);
    List<Saloon> findByOwnerEmail(String ownerEmail);
    List<Saloon> findByStatus(Saloon.SaloonStatus status);

    @Query("""
            SELECT * FROM saloon
            WHERE LOWER(name)                        LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(handler)                     LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(owner_name,     '')) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(owner_email,    '')) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(owner_phone,    '')) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(contact_phone,  '')) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(contact_email,  '')) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(city,           '')) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(COALESCE(country,        '')) LIKE LOWER(CONCAT('%', :q, '%'))
            """)
    List<Saloon> searchByText(@Param("q") String q);

    @Query("""
            SELECT * FROM saloon
            WHERE (   LOWER(name)                        LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(handler)                     LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(owner_name,     '')) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(owner_email,    '')) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(owner_phone,    '')) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(contact_phone,  '')) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(contact_email,  '')) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(city,           '')) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(country,        '')) LIKE LOWER(CONCAT('%', :q, '%')))
              AND status = :status
            """)
    List<Saloon> searchByTextAndStatus(@Param("q") String q, @Param("status") String status);
}
