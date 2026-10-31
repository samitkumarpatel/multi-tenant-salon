package net.samitkumar.multi_tenant_salon;

import lombok.extern.slf4j.Slf4j;
import org.aopalliance.intercept.MethodInterceptor;
import org.springframework.aop.Advisor;
import org.springframework.aop.support.DefaultPointcutAdvisor;
import org.springframework.aop.support.annotation.AnnotationMatchingPointcut;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;
import org.springframework.core.Ordered;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.modulith.events.core.EventSerializer;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Keeps the reason an {@code @ApplicationModuleListener} threw. Modulith only stores the publication's status
 * and attempt count, so without this the cause lives in the application log alone. Every failed attempt is
 * written to {@code event_publication_failure} in its own transaction (the listener's rolls back) and the
 * exception is rethrown untouched, so retry and resubmission behave exactly as before. Recording never
 * throws: losing a reason must not change how the event is handled.
 */
@Configuration(proxyBeanMethods = false)
class EventListenerFailureRecorder {

    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    static Advisor eventListenerFailureAdvisor(JdbcClient jdbc, EventSerializer serializer, PlatformTransactionManager tx) {
        var advice = new FailureRecordingInterceptor(jdbc, serializer, new TransactionTemplate(tx, requiresNew()));
        // Meta-annotation aware: @ApplicationModuleListener is itself @Async/@Transactional/@TransactionalEventListener.
        var advisor = new DefaultPointcutAdvisor(new AnnotationMatchingPointcut(null, ApplicationModuleListener.class, true), advice);
        advisor.setOrder(Ordered.LOWEST_PRECEDENCE);
        return advisor;
    }

    private static org.springframework.transaction.support.DefaultTransactionDefinition requiresNew() {
        var definition = new org.springframework.transaction.support.DefaultTransactionDefinition();
        definition.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return definition;
    }

    @Slf4j
    record FailureRecordingInterceptor(JdbcClient jdbc, EventSerializer serializer, TransactionTemplate requiresNew) implements MethodInterceptor {
        private static final int MAX_STACK = 8000, MAX_MESSAGE = 2000;

        @Override
        public Object invoke(org.aopalliance.intercept.MethodInvocation invocation) throws Throwable {
            try {
                return invocation.proceed();
            } catch (Throwable failure) {
                record(invocation, failure);
                throw failure;
            }
        }

        private void record(org.aopalliance.intercept.MethodInvocation invocation, Throwable failure) {
            try {
                Method method = invocation.getMethod();
                Object event = invocation.getArguments().length > 0 ? invocation.getArguments()[0] : null;
                if (event == null) return;
                // Same id Modulith stores in event_publication.listener_id.
                final String listenerId = method.getDeclaringClass().getName() + "." + method.getName() + "("
                        + Arrays.stream(method.getParameterTypes()).map(Class::getName).collect(Collectors.joining(",")) + ")";
                final String eventType = event.getClass().getName();
                final String payload = String.valueOf(serializer.serialize(event));
                Throwable found = failure;
                while (found.getCause() != null && found.getCause() != found) found = found.getCause();
                final Throwable root = found;
                var trace = new StringWriter();
                failure.printStackTrace(new PrintWriter(trace));
                requiresNew.executeWithoutResult(status -> jdbc.sql("""
                        INSERT INTO event_publication_failure(publication_id,listener_id,event_type,error_class,message,stack_trace)
                        VALUES ((SELECT id FROM event_publication WHERE listener_id=:listener AND serialized_event=:payload
                                 ORDER BY publication_date DESC LIMIT 1),:listener,:type,:errorClass,:message,:trace)""")
                        .param("listener", listenerId).param("payload", payload).param("type", eventType)
                        .param("errorClass", root.getClass().getName())
                        .param("message", cut(root.getMessage() != null ? root.getMessage() : failure.getMessage(), MAX_MESSAGE))
                        .param("trace", cut(trace.toString(), MAX_STACK)).update());
            } catch (RuntimeException e) {
                log.warn("[EVENTS] Could not record the failure of {}", invocation.getMethod(), e);
            }
        }

        private static String cut(String text, int max) { return text == null || text.length() <= max ? text : text.substring(0, max); }
    }

    /** Failure rows go with the archive: kept as long as delivered publications are. */
    @Component
    @Slf4j
    static class Pruning {
        private final JdbcClient jdbc;
        private final Duration retention;
        Pruning(JdbcClient jdbc, @Value("${app.events.archive-retention:P90D}") Duration retention) { this.jdbc = jdbc; this.retention = retention; }

        @Scheduled(initialDelay = 600_000, fixedDelay = 86_400_000)
        void prune() {
            try {
                int n = jdbc.sql("DELETE FROM event_publication_failure WHERE failed_at < now() - make_interval(secs => :secs)")
                        .param("secs", retention.toSeconds()).update();
                if (n > 0) log.info("[EVENTS] Pruned {} old listener failure records", n);
            } catch (RuntimeException e) {
                log.warn("[EVENTS] Pruning listener failure records failed", e);
            }
        }
    }
}
