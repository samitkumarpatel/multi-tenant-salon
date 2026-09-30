package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings;
import net.samitkumar.multi_tenant_salon.payments.StripeConnectedAccount;
import org.springframework.data.repository.ListCrudRepository;

import java.util.UUID;

interface StripeConnectedAccountRepository extends ListCrudRepository<StripeConnectedAccount, UUID> {
    java.util.Optional<StripeConnectedAccount> findByStripeAccountId(String stripeAccountId);
}
interface SalonPaymentSettingsRepository extends ListCrudRepository<SalonPaymentSettings, UUID> {}
