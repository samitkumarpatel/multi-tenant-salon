package net.samitkumar.multi_tenant_salon.website.internal;

import net.samitkumar.multi_tenant_salon.website.WebsiteTheme;
import org.springframework.data.repository.CrudRepository;

import java.util.UUID;

interface WebsiteThemeRepository extends CrudRepository<WebsiteTheme, UUID> {}
