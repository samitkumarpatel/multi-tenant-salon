package net.samitkumar.multi_tenant_saloon.website.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_saloon.saloon.WebsitePublishRequestedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
class WebsitePublishListener {

    @ApplicationModuleListener
    void onWebsitePublishRequested(WebsitePublishRequestedEvent event) {
        log.info("""
                [WEBSITE] Publish requested — AWS deployment pipeline pending.
                  Saloon  : {} (id: {})
                  Handler : {} (future subdomain)
                  Owner   : {}
                """,
                event.saloonName(), event.saloonId(),
                event.handler(),
                event.ownerEmail());

        // TODO: invoke AWS pipeline
        //   1. Deploy static assets to S3 bucket for handler
        //   2. Create Route 53 subdomain record: {handler}.domain.com
        //   3. Point subdomain CNAME/ALIAS to S3 website endpoint
    }
}
