package net.samitkumar.multi_tenant_salon.chat.internal;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.Message;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import org.springframework.util.Assert;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-process {@link ChatMemoryRepository} that forgets a conversation once it has been idle for
 * {@code spring.application.chat.memory.ttl}. Public-website chat sessions are anonymous and
 * short-lived, so there is nothing worth persisting to Postgres — a visitor who returns after the
 * TTL simply starts a fresh conversation.
 *
 * <p>Expiry is lazy: a stale conversation is dropped the next time it is read, with an
 * opportunistic sweep on every write. {@code max-conversations} caps how many live conversations
 * are held, evicting the least-recently-used when full.
 *
 * <p>Per-instance only. If the app is ever scaled beyond one replica, swap this for the JDBC
 * repository ({@code spring-ai-starter-model-chat-memory-repository-jdbc}) plus a migration.
 */
@Repository
@Slf4j
class TtlChatMemoryRepository implements ChatMemoryRepository {

    private record Entry(List<Message> messages, Instant lastAccess) {}

    private final Map<String, Entry> store = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final int maxConversations;
    private final Clock clock;

    @Autowired
    TtlChatMemoryRepository(
            @Value("${spring.application.chat.memory.ttl:PT30M}") Duration ttl,
            @Value("${spring.application.chat.memory.max-conversations:5000}") int maxConversations) {
        this(ttl, maxConversations, Clock.systemUTC());
    }

    /** Test seam: lets a unit test drive expiry with a controllable clock. */
    TtlChatMemoryRepository(Duration ttl, int maxConversations, Clock clock) {
        Assert.notNull(ttl, "ttl cannot be null");
        Assert.isTrue(maxConversations > 0, "maxConversations must be greater than 0");
        this.ttl = ttl;
        this.maxConversations = maxConversations;
        this.clock = clock;
    }

    @Override
    public List<String> findConversationIds() {
        sweep();
        return new ArrayList<>(store.keySet());
    }

    @Override
    public List<Message> findByConversationId(String conversationId) {
        Assert.hasText(conversationId, "conversationId cannot be null or empty");
        var entry = store.get(conversationId);
        if (entry == null) {
            return List.of();
        }
        if (isExpired(entry)) {
            store.remove(conversationId);
            return List.of();
        }
        store.put(conversationId, new Entry(entry.messages(), clock.instant()));
        return new ArrayList<>(entry.messages());
    }

    @Override
    public void saveAll(String conversationId, List<Message> messages) {
        Assert.hasText(conversationId, "conversationId cannot be null or empty");
        Assert.notNull(messages, "messages cannot be null");
        Assert.noNullElements(messages, "messages cannot contain null elements");
        sweep();
        if (!store.containsKey(conversationId) && store.size() >= maxConversations) {
            evictOldest();
        }
        store.put(conversationId, new Entry(new ArrayList<>(messages), clock.instant()));
    }

    @Override
    public void deleteByConversationId(String conversationId) {
        Assert.hasText(conversationId, "conversationId cannot be null or empty");
        store.remove(conversationId);
    }

    private boolean isExpired(Entry entry) {
        return entry.lastAccess().plus(ttl).isBefore(clock.instant());
    }

    private void sweep() {
        store.entrySet().removeIf(e -> isExpired(e.getValue()));
    }

    private void evictOldest() {
        store.entrySet().stream()
                .min(Comparator.comparing(e -> e.getValue().lastAccess()))
                .map(Map.Entry::getKey)
                .ifPresent(store::remove);
    }
}
