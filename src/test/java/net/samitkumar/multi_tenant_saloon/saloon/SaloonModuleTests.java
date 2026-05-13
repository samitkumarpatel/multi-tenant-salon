package net.samitkumar.multi_tenant_saloon.saloon;

import net.samitkumar.multi_tenant_saloon.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ApplicationModuleTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SaloonModuleTests {

    @Autowired
    MockMvc mockMvc;

    @Test
    void createSaloon() throws Exception {
        mockMvc.perform(post("/api/saloons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Glam Saloon",
                                    "ownerName": "Jane Doe",
                                    "ownerEmail": "jane@glamsaloon.com",
                                    "ownerPhone": "+1234567890",
                                    "features": ["BOOKING", "STATIC_WEBSITE"]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Glam Saloon"))
                .andExpect(jsonPath("$.owner.name").value("Jane Doe"))
                .andExpect(jsonPath("$.features").isArray());
    }

    @Test
    void listSaloons() throws Exception {
        mockMvc.perform(get("/api/saloons"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void saloonNotFound() throws Exception {
        mockMvc.perform(get("/api/saloons/nonexistent-id"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateFeatures() throws Exception {
        var result = mockMvc.perform(post("/api/saloons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Style Hub",
                                    "ownerName": "John Smith",
                                    "ownerEmail": "john@stylehub.com",
                                    "ownerPhone": "+9876543210",
                                    "features": ["BOOKING"]
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String location = result.getResponse().getHeader("Location");
        String id = location.substring(location.lastIndexOf('/') + 1);

        mockMvc.perform(put("/api/saloons/" + id + "/features")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "features": ["BOOKING", "MEMBERSHIP", "WEBSHOP"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.features.length()").value(3));
    }

    @Test
    void deleteSaloon() throws Exception {
        var result = mockMvc.perform(post("/api/saloons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                    "name": "Temp Saloon",
                                    "ownerName": "Alice",
                                    "ownerEmail": "alice@temp.com",
                                    "ownerPhone": "+1111111111",
                                    "features": []
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        String location = result.getResponse().getHeader("Location");
        String id = location.substring(location.lastIndexOf('/') + 1);

        mockMvc.perform(delete("/api/saloons/" + id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/saloons/" + id))
                .andExpect(status().isNotFound());
    }
}
