package net.samitkumar.multi_tenant_salon.analytics.internal;

import com.azure.storage.queue.QueueClient;
import com.azure.storage.queue.QueueServiceClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Lazily resolves (and creates, if missing) the single Azure Storage Queue this module reads
 * and writes. Spring Cloud Azure's {@link QueueServiceClient} autoconfiguration is only
 * {@code @ConditionalOnClass}, not on the account-name property, so the bean exists even when
 * {@code AZURE_STORAGE_ACCOUNT_NAME} is unset — calling it in that state doesn't fail fast, it
 * hangs for minutes walking the DefaultAzureCredential chain before failing. So "enabled" is
 * decided from the account-name property directly, never from bean presence; unset, both the
 * producer and the consumer degrade to logging instead of touching a queue, the same fallback
 * the notification module uses for an unset Mailjet key.
 */
@Component
class AnalyticsQueueClientProvider {

    private final Optional<QueueServiceClient> queueServiceClient;
    private final String queueName;
    private final boolean enabled;
    private volatile QueueClient queueClient;

    AnalyticsQueueClientProvider(Optional<QueueServiceClient> queueServiceClient,
                                 @Value("${spring.application.analytics.queue-name}") String queueName,
                                 @Value("${spring.cloud.azure.storage.queue.account-name:}") String accountName) {
        this.queueServiceClient = queueServiceClient;
        this.queueName = queueName;
        this.enabled = !accountName.isBlank();
    }

    boolean isEnabled() {
        return enabled;
    }

    QueueClient get() {
        QueueClient client = queueClient;
        if (client == null) {
            synchronized (this) {
                client = queueClient;
                if (client == null) {
                    client = queueServiceClient.orElseThrow().getQueueClient(queueName);
                    client.createIfNotExists();
                    queueClient = client;
                }
            }
        }
        return client;
    }
}
