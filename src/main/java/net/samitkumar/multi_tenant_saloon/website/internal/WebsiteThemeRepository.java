package net.samitkumar.multi_tenant_saloon.website.internal;

import net.samitkumar.multi_tenant_saloon.website.WebsiteTheme;
import org.springframework.data.repository.CrudRepository;

import java.util.UUID;

interface WebsiteThemeRepository extends CrudRepository<WebsiteTheme, UUID> {}
