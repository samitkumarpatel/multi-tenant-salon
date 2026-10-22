package net.samitkumar.multi_tenant_salon.website;

import java.util.UUID;

/** Read-only access to a salon's website theme (its brand colours and font), e.g. for styling payment pages. */
public interface WebsiteThemeApi {
    /** The saved theme, or the platform default when the salon hasn't saved one. */
    WebsiteTheme theme(UUID salonId);
}
