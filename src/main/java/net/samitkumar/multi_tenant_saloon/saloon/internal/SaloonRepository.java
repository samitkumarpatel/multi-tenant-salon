package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import org.springframework.data.repository.ListCrudRepository;

interface SaloonRepository extends ListCrudRepository<Saloon, Long> {}
