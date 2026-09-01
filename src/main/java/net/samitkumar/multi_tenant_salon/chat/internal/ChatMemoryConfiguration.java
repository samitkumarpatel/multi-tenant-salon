package net.samitkumar.multi_tenant_salon.chat.internal;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the chat assistant's conversation memory: a {@link MessageWindowChatMemory} (keeps the
 * last {@code max-messages} turns) backed by {@link TtlChatMemoryRepository} (forgets a
 * conversation after it has been idle for {@code ttl}). Both explicit beans take precedence over
 * Spring AI's autoconfigured in-memory defaults.
 */
@Configuration
class ChatMemoryConfiguration {

    @Bean
    ChatMemory chatMemory(ChatMemoryRepository chatMemoryRepository,
                          @Value("${spring.application.chat.memory.max-messages:20}") int maxMessages) {
        return MessageWindowChatMemory.builder()
                .chatMemoryRepository(chatMemoryRepository)
                .maxMessages(maxMessages)
                .build();
    }
}
