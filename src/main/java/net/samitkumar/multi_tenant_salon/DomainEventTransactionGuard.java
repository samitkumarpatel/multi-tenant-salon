package net.samitkumar.multi_tenant_salon;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationListener;
import org.springframework.context.PayloadApplicationEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Every domain event must be published inside a transaction. That is what makes Spring Modulith
 * store it in {@code event_publication} together with the business change, and only then are
 * {@code @ApplicationModuleListener}s invoked at all — published outside a transaction, an event is
 * silently dropped and never retried. This guard runs synchronously in the publishing thread and
 * flags any of our events published without one: an error log in production, a hard failure in tests
 * ({@code app.events.fail-outside-transaction=true}) so a new non-transactional publisher can't slip in.
 */
@Component
@Slf4j
class DomainEventTransactionGuard implements ApplicationListener<PayloadApplicationEvent<?>> {
    private static final String BASE_PACKAGE = DomainEventTransactionGuard.class.getPackageName() + ".";

    private final boolean failOutsideTransaction;

    DomainEventTransactionGuard(@Value("${app.events.fail-outside-transaction:false}") boolean failOutsideTransaction) {
        this.failOutsideTransaction = failOutsideTransaction;
    }

    @Override
    public void onApplicationEvent(PayloadApplicationEvent<?> event) {
        var type = event.getPayload().getClass();
        if (!type.getName().startsWith(BASE_PACKAGE) || TransactionSynchronizationManager.isActualTransactionActive()) return;
        var message = type.getSimpleName() + " was published outside a transaction: it is not stored in the event "
                + "publication registry and module listeners will not receive it";
        if (failOutsideTransaction) throw new IllegalStateException(message);
        log.error("[EVENTS] {}", message);
    }
}
