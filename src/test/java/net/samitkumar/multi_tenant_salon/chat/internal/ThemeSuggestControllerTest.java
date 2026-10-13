package net.samitkumar.multi_tenant_salon.chat.internal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ThemeSuggestControllerTest {
    private static final String PATH = "/api/salon-admin/salon-1/ai/website-theme";
    private ChatModel model;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        model = mock(ChatModel.class);
        when(model.getOptions()).thenReturn(ChatOptions.builder().build());
        mvc = MockMvcBuilders.standaloneSetup(new ThemeSuggestController(ChatClient.builder(model))).build();
    }

    @Test
    void returnsNormalisedPalettesAndSendsSalonDetailsAsData() throws Exception {
        when(model.call(any(Prompt.class))).thenReturn(reply("""
                {"suggestions":[
                  {"name":" Blush Luxe ","mood":"Soft and elegant.","heroBg":"#fdf2f8","heroTextColor":"#831843",
                   "accentColor":"#DB2777","logoBgColor":"#be185d","headerBg":"#FCE7F3","footerBg":"#FCE7F3",
                   "chatBg":"#FFF7FB","fontFamily":" Playfair "},
                  {"name":"Midnight","mood":"Bold and modern.","heroBg":"#0F172A","heroTextColor":"#FFFFFF",
                   "accentColor":"#F59E0B","logoBgColor":"#F59E0B","headerBg":"#1E293B","footerBg":"#1E293B",
                   "fontFamily":"montserrat"}
                ]}
                """));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("""
                        {"salonName":"Rose Studio","style":"luxury","services":["Balayage","Bridal makeup"]}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions.length()").value(2))
                .andExpect(jsonPath("$.suggestions[0].name").value("Blush Luxe"))
                .andExpect(jsonPath("$.suggestions[0].heroBg").value("#FDF2F8"))
                .andExpect(jsonPath("$.suggestions[0].logoBgColor").value("#BE185D"))
                .andExpect(jsonPath("$.suggestions[0].fontFamily").value("playfair"))
                // chatBg falls back to heroBg when the model omits it
                .andExpect(jsonPath("$.suggestions[1].chatBg").value("#0F172A"));

        var prompt = ArgumentCaptor.forClass(Prompt.class);
        verify(model).call(prompt.capture());
        assertThat(prompt.getValue().getSystemMessage().getText()).contains("cormorant: Luxury refined serif");
        assertThat(prompt.getValue().getUserMessage().getText()).endsWith("""
                SALON DETAILS:
                Name: Rose Studio
                Services: Balayage, Bridal makeup
                Desired style: luxury
                """);
    }

    @Test
    void replacesLowContrastHeroText() throws Exception {
        when(model.call(any(Prompt.class))).thenReturn(reply("""
                {"suggestions":[{"name":"Fog","mood":"Calm.","heroBg":"#F8FAFC","heroTextColor":"#E2E8F0",
                 "accentColor":"#2563EB","logoBgColor":"#2563EB","headerBg":"#F1F5F9","footerBg":"#F1F5F9",
                 "chatBg":"#F1F5F9","fontFamily":"inter"}]}
                """));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"salonName\":\"Fog\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions[0].heroTextColor").value("#0F172A"));
    }

    @Test
    void rejectsInvalidRequestsWithoutCallingModel() throws Exception {
        for (var body : List.of("{}", "{\"salonName\":\"  \"}", "{\"salonName\":\"" + "x".repeat(201) + "\"}")) {
            mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verify(model, never()).call(any(Prompt.class));
    }

    @Test
    void rejectsUnusableModelOutput() throws Exception {
        var valid = "\"name\":\"A\",\"mood\":\"B\",\"heroTextColor\":\"#FFFFFF\",\"accentColor\":\"#F59E0B\","
                + "\"logoBgColor\":\"#F59E0B\",\"headerBg\":\"#111111\",\"footerBg\":\"#111111\",\"chatBg\":\"#111111\"";
        for (var text : List.of("not JSON", "{}", "{\"suggestions\":[]}",
                "{\"suggestions\":[{" + valid + ",\"heroBg\":\"red\",\"fontFamily\":\"inter\"}]}",
                "{\"suggestions\":[{" + valid + ",\"heroBg\":\"#000000\",\"fontFamily\":\"Comic Sans\"}]}")) {
            when(model.call(any(Prompt.class))).thenReturn(reply(text));
            mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"salonName\":\"S\"}"))
                    .andExpect(status().isBadGateway());
        }
    }

    @Test
    void providerFailureReturnsServiceUnavailable() throws Exception {
        when(model.call(any(Prompt.class))).thenThrow(new IllegalStateException("provider details"));
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content("{\"salonName\":\"S\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    private ChatResponse reply(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }
}
