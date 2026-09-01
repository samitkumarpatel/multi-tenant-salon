package net.samitkumar.multi_tenant_salon.chat.internal;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TtlChatMemoryRepositoryTest {

    /** A clock whose "now" the test advances by hand. */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-09-01T10:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public Instant instant() { return now; }
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    private static List<Message> msg(String text) {
        return List.of(new UserMessage(text));
    }

    @Test
    void returnsWhatWasSavedWhileWithinTtl() {
        var clock = new MutableClock();
        var repo = new TtlChatMemoryRepository(Duration.ofMinutes(30), 100, clock);

        repo.saveAll("c1", msg("hello"));
        clock.advance(Duration.ofMinutes(29));

        assertThat(repo.findByConversationId("c1")).extracting(Message::getText).containsExactly("hello");
    }

    @Test
    void forgetsAConversationOnceItHasBeenIdlePastTheTtl() {
        var clock = new MutableClock();
        var repo = new TtlChatMemoryRepository(Duration.ofMinutes(30), 100, clock);

        repo.saveAll("c1", msg("hello"));
        clock.advance(Duration.ofMinutes(31));

        assertThat(repo.findByConversationId("c1")).isEmpty();
        assertThat(repo.findConversationIds()).doesNotContain("c1");
    }

    @Test
    void readingWithinTtlSlidesTheExpiryWindow() {
        var clock = new MutableClock();
        var repo = new TtlChatMemoryRepository(Duration.ofMinutes(30), 100, clock);

        repo.saveAll("c1", msg("hello"));
        clock.advance(Duration.ofMinutes(20));
        assertThat(repo.findByConversationId("c1")).isNotEmpty(); // touch → resets last-access
        clock.advance(Duration.ofMinutes(20));

        assertThat(repo.findByConversationId("c1")).isNotEmpty();
    }

    @Test
    void evictsTheLeastRecentlyUsedConversationWhenOverCapacity() {
        var clock = new MutableClock();
        var repo = new TtlChatMemoryRepository(Duration.ofHours(1), 2, clock);

        repo.saveAll("a", msg("a"));
        clock.advance(Duration.ofMinutes(1));
        repo.saveAll("b", msg("b"));
        clock.advance(Duration.ofMinutes(1));
        repo.findByConversationId("a"); // make "a" more recently used than "b"
        clock.advance(Duration.ofMinutes(1));
        repo.saveAll("c", msg("c")); // over cap → evict LRU, which is now "b"

        assertThat(repo.findConversationIds()).containsExactlyInAnyOrder("a", "c");
        assertThat(repo.findByConversationId("b")).isEmpty();
    }
}
