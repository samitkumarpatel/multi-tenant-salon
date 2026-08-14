package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface SalonRepository extends ListCrudRepository<Salon, UUID> {
    Optional<Salon> findByHandler(String handler);
    boolean existsByHandler(String handler);
    List<Salon> findByOwnerEmail(String ownerEmail);
    List<Salon> findByStatus(Salon.SalonStatus status);

    @Query("""
            SELECT * FROM salon
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
    List<Salon> searchByText(@Param("q") String q);

    @Query("""
            SELECT * FROM salon
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
    List<Salon> searchByTextAndStatus(@Param("q") String q, @Param("status") String status);
}
