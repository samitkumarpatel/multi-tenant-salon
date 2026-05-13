package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import org.springframework.data.mongodb.repository.MongoRepository;

interface SaloonRepository extends MongoRepository<Saloon, String> {}
