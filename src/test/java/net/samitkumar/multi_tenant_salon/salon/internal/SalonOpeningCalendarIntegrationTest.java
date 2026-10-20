package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * The opening calendar against real PostgreSQL: holidays and closures added through the admin
 * API, plus a recurring holiday with no materialised closure rows, all override the weekly hours.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
class SalonOpeningCalendarIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired SalonApi salons;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID salonId;
    String adminPath;

    @BeforeEach void setup() {
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, created_at) VALUES (?, 'Calendar test', ?, now())",
                salonId, "calendar-" + salonId);
        int key = 0;
        for (DayOfWeek day : DayOfWeek.values()) {
            jdbc.update("INSERT INTO salon_operating_hours(salon_id, salon_key, day, open_time, close_time, closed) VALUES (?, ?, ?, '09:00', '18:00', ?)",
                    salonId, key++, day.name(), day == DayOfWeek.SUNDAY);
        }
        adminPath = "/api/salon-admin/" + salonId;
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        when(decoder.decode(anyString())).thenAnswer(invocation -> Jwt.withTokenValue(invocation.getArgument(0))
                .header("alg", "RS256").subject("owner")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                .claim("roles", List.of("OWNER"))
                .claim("salons", List.of(Map.of("salonId", salonId.toString(), "role", "OWNER", "active", true)))
                .build());
    }

    @Test void holidaysAndClosuresOverrideTheWeeklyHoursWithTheirNames() {
        // A Monday–Wednesday stretch well inside the materialised holiday years.
        LocalDate monday = LocalDate.now().plusMonths(2).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        client.post().uri(adminPath + "/holidays").header("Authorization", "Bearer owner")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", "Founders' Day", "month", monday.getMonthValue(), "day", monday.getDayOfMonth()))
                .exchange().expectStatus().isOk();
        client.post().uri(adminPath + "/closures").header("Authorization", "Bearer owner")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("startDate", monday.plusDays(1).toString(), "endDate", monday.plusDays(1).toString(), "reason", "Staff training"))
                .exchange().expectStatus().isOk();

        var days = salons.openingCalendar(salonId, monday, monday.plusDays(6));

        assertThat(days).extracting(SalonOpeningDay::status).containsExactly(
                SalonOpeningDay.Status.CLOSED_HOLIDAY, SalonOpeningDay.Status.CLOSED_SPECIAL,
                SalonOpeningDay.Status.OPEN, SalonOpeningDay.Status.OPEN, SalonOpeningDay.Status.OPEN,
                SalonOpeningDay.Status.OPEN, SalonOpeningDay.Status.CLOSED_WEEKLY);
        assertThat(days.get(0).reason()).isEqualTo("Founders' Day");
        assertThat(days.get(1).reason()).isEqualTo("Staff training");
        assertThat(days.get(2).openTime()).isEqualTo("09:00");
        assertThat(salons.closureReason(salonId, monday)).contains("Founders' Day");
        assertThat(salons.closureReason(salonId, monday.plusDays(6))).contains("Closed on Sundays");
        assertThat(salons.closureReason(salonId, monday.plusDays(2))).isEmpty();
    }

    @Test void aRecurringHolidayBeyondTheMaterialisedYearsStillClosesTheSalon() {
        // Inserted directly, as the admin API only materialises closure rows five years ahead.
        jdbc.update("INSERT INTO salon_holiday(salon_id, name, holiday_month, holiday_day, end_month, end_day) VALUES (?, 'Winter break', 12, 30, 1, 2)",
                salonId);
        LocalDate farNewYear = LocalDate.of(LocalDate.now().getYear() + 20, 1, 1);

        var days = salons.openingCalendar(salonId, farNewYear.minusDays(2), farNewYear.plusDays(2));

        assertThat(days).extracting(SalonOpeningDay::reason).startsWith("Winter break", "Winter break", "Winter break", "Winter break");
        assertThat(days.getLast().status()).isNotEqualTo(SalonOpeningDay.Status.CLOSED_HOLIDAY);
        assertThat(salons.isClosedOn(salonId, farNewYear.plusDays(1))).isTrue();
    }
}
