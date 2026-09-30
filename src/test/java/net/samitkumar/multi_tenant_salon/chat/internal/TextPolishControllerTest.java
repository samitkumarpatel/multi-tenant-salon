package net.samitkumar.multi_tenant_salon.chat.internal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TextPolishControllerTest {
    private ChatModel model;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        model = mock(ChatModel.class);
        when(model.getOptions()).thenReturn(ChatOptions.builder().build());
        mvc = MockMvcBuilders.standaloneSetup(new TextPolishController(ChatClient.builder(model))).build();
    }

    @Test
    void bothPortalRoutesReturnPolishedText() throws Exception {
        when(model.call(any(Prompt.class))).thenReturn(reply("""
                {"polished":"  A welcoming salon.  ","friendly":" Welcome to our salon! ","concise":" Welcoming salon. "}
                """));
        for (var path : List.of("/api/salon-admin/salon-1/ai/polish", "/api/salon-staff/ai/polish")) {
            mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\":\"welcoming salon\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.text").value("A welcoming salon."))
                    .andExpect(jsonPath("$.suggestions.polished").value("A welcoming salon."))
                    .andExpect(jsonPath("$.suggestions.friendly").value("Welcome to our salon!"))
                    .andExpect(jsonPath("$.suggestions.concise").value("Welcoming salon."));
        }
    }

    @Test
    void serviceDescriptionsKeepTheOriginalPromptAfterEditingABio() throws Exception {
        when(model.call(any(Prompt.class))).thenReturn(reply("""
                {"polished":"Haircut with wash and styling.","friendly":"Enjoy a haircut with a wash and styling.","concise":"Haircut, wash and styling."}
                """));
        mvc.perform(post("/api/salon-admin/salon-1/ai/polish").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"i love hair styling\",\"context\":\"STAFF_BIO\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/salon-admin/salon-1/ai/polish").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"haircut with wash and styling\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("Haircut with wash and styling."))
                .andExpect(jsonPath("$.suggestions.polished").value("Haircut with wash and styling."))
                .andExpect(jsonPath("$.suggestions.friendly").value("Enjoy a haircut with a wash and styling."))
                .andExpect(jsonPath("$.suggestions.concise").value("Haircut, wash and styling."));

        var prompts = ArgumentCaptor.forClass(Prompt.class);
        verify(model, times(2)).call(prompts.capture());
        var servicePrompt = prompts.getAllValues().get(1);
        assertThat(servicePrompt.getSystemMessage().getText())
                .startsWith("Polish the supplied salon biography or description for customers.\n")
                .doesNotContain("About me", "personal biography about that person", "use first person");
        assertThat(servicePrompt.getInstructions())
                .filteredOn(message -> message instanceof UserMessage)
                .extracting(message -> message.getText())
                .containsExactly("Rewrite the following draft into all three versions.\n\nDRAFT TO EDIT:\nhaircut with wash and styling");
    }

    @Test
    void bothPortalRoutesUsePersonalBiographyInstructionsWhenRequested() throws Exception {
        when(model.call(any(Prompt.class))).thenReturn(reply("""
                {"polished":"I love styling hair.","friendly":"I love helping people style their hair.","concise":"I love hairstyling."}
                """));
        for (var path : List.of("/api/salon-admin/salon-1/ai/polish", "/api/salon-staff/ai/polish")) {
            mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\":\"i love styling hair\",\"context\":\"STAFF_BIO\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.text").value("I love styling hair."));
        }
        var prompts = ArgumentCaptor.forClass(Prompt.class);
        verify(model, times(2)).call(prompts.capture());
        for (var prompt : prompts.getAllValues()) {
            assertThat(prompt.getSystemMessage().getText())
                    .contains("About me", "personal biography about that person", "Preserve first-person or third-person voice",
                            "Do not turn them into service benefits, sales copy or booking calls to action.")
                    .doesNotContain("Polish the supplied salon biography or description for customers.");
            assertThat(prompt.getUserMessage().getText()).endsWith("DRAFT TO EDIT:\ni love styling hair");
        }
    }

    @Test
    void rejectsUnknownContextWithoutCallingModel() throws Exception {
        mvc.perform(post("/api/salon-staff/ai/polish").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"my bio\",\"context\":\"UNKNOWN\"}"))
                .andExpect(status().isBadRequest());
        verify(model, never()).call(any(Prompt.class));
    }

    @Test
    void sendsTheExactDraftToTheModelWithoutTemplateExpansionOrPreviousDrafts() throws Exception {
        when(model.call(any(Prompt.class))).thenReturn(reply("""
                {"polished":"A stylist.","friendly":"Your stylist.","concise":"Stylist."}
                """));
        for (var draft : List.of("I work at {salon} & love colour.", "Nadia specialises in beard grooming.")) {
            mvc.perform(post("/api/salon-staff/ai/polish").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\":\"" + draft + "\"}"))
                    .andExpect(status().isOk());
        }
        var prompts = ArgumentCaptor.forClass(Prompt.class);
        verify(model, times(2)).call(prompts.capture());
        assertThat(prompts.getAllValues().get(0).getInstructions())
                .filteredOn(message -> message instanceof UserMessage)
                .extracting(message -> message.getText())
                .containsExactly("Rewrite the following draft into all three versions.\n\nDRAFT TO EDIT:\nI work at {salon} & love colour.");
        assertThat(prompts.getAllValues().get(1).getInstructions())
                .filteredOn(message -> message instanceof UserMessage)
                .extracting(message -> message.getText())
                .containsExactly("Rewrite the following draft into all three versions.\n\nDRAFT TO EDIT:\nNadia specialises in beard grooming.");
    }

    @Test
    void rejectsMissingBlankAndOversizedTextWithoutCallingModel() throws Exception {
        for (var body : List.of("{}", "{\"text\":\"   \"}", "{\"text\":\"" + "x".repeat(5001) + "\"}")) {
            mvc.perform(post("/api/salon-staff/ai/polish").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verify(model, never()).call(any(Prompt.class));
    }

    @Test
    void rejectsEmptyAndOversizedSuggestions() throws Exception {
        for (var text : List.of("   ", "x".repeat(5001))) {
            when(model.call(any(Prompt.class))).thenReturn(reply(
                    "{\"polished\":\"Valid\",\"friendly\":\"" + text + "\",\"concise\":\"Valid\"}"));
            mvc.perform(post("/api/salon-staff/ai/polish").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\":\"my bio\"}"))
                    .andExpect(status().isBadGateway());
        }
    }

    @Test
    void rejectsMalformedOrIncompleteSuggestions() throws Exception {
        for (var text : List.of("not JSON", "null", "{}", "{\"polished\":\"Only one version\"}",
                "{\"text\":\"Please provide the salon biography you would like me to refine.\"}")) {
            when(model.call(any(Prompt.class))).thenReturn(reply(text));
            mvc.perform(post("/api/salon-staff/ai/polish").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\":\"my bio\"}"))
                    .andExpect(status().isBadGateway());
        }
    }

    @Test
    void providerFailureReturnsServiceUnavailable() throws Exception {
        when(model.call(any(Prompt.class))).thenThrow(new IllegalStateException("provider details"));
        mvc.perform(post("/api/salon-staff/ai/polish").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"my bio\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    private ChatResponse reply(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }
}
