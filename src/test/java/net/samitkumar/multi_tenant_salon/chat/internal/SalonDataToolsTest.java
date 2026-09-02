package net.samitkumar.multi_tenant_salon.chat.internal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the availability tools in {@link SalonDataTools}. They call the backend
 * {@code /availability} endpoint (stubbed here) and reshape the result for the LLM — the key
 * behaviours are: the single-date {@code checkAvailability} picks out the asked day, flattens
 * {@code status}/{@code reason}/{@code slots}, and forwards {@code firstAvailable} as
 * {@code nextAvailable}; {@code findAvailableDates} passes the range through untouched.
 */
class SalonDataToolsTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Captures the args the tool passed and returns canned availability JSON. */
    private static final class StubClient implements SalonApiClient {
        String availabilityJson = "{\"days\":[]}";
        final AtomicReference<String> lastGranularity = new AtomicReference<>();
        final AtomicReference<String> lastFrom = new AtomicReference<>();
        final AtomicReference<String> lastTo = new AtomicReference<>();
        Integer lastLimit;

        @Override public String getSalon(String salonId) { return "{}"; }
        @Override public String getStaff(String salonId) { return "[]"; }
        @Override public String getServices(String salonId) { return "[]"; }
        @Override public String getHolidays(String salonId) { return "[]"; }
        @Override public String getSlots(String salonId, Long serviceId, String date, Long staffId) { return "[]"; }

        @Override
        public String getAvailability(String salonId, Long serviceId, Long staffId,
                                      String from, String to, String granularity, Integer limit) {
            lastFrom.set(from);
            lastTo.set(to);
            lastGranularity.set(granularity);
            lastLimit = limit;
            return availabilityJson;
        }
    }

    @Test
    void checkAvailability_flattensAClosedDayWithItsReasonAndNextOpening() throws Exception {
        var stub = new StubClient();
        stub.availabilityJson = """
                {"serviceId":3,"serviceName":"Haircut","durationMinutes":45,
                 "from":"2026-09-04","to":"2026-09-18",
                 "days":[
                   {"date":"2026-09-04","weekday":"FRIDAY","status":"SALON_CLOSED",
                    "reason":"The salon is closed on Friday 4 September for Staff Training Day.",
                    "openSlotCount":0,"firstOpenTime":null,"availableStaffIds":[],"slots":[]},
                   {"date":"2026-09-05","weekday":"SATURDAY","status":"OPEN","reason":null,
                    "openSlotCount":4,"firstOpenTime":"10:00","availableStaffIds":[2],"slots":[]}],
                 "firstAvailable":{"date":"2026-09-05","startTime":"10:00","staffId":2}}""";

        JsonNode r = JSON.readTree(new SalonDataTools(stub, "salon-1").checkAvailability(3L, "2026-09-04", null));

        assertThat(r.get("date").asText()).isEqualTo("2026-09-04");
        assertThat(r.get("weekday").asText()).isEqualTo("FRIDAY");
        assertThat(r.get("status").asText()).isEqualTo("SALON_CLOSED");
        assertThat(r.get("available").asBoolean()).isFalse();
        assertThat(r.get("reason").asText()).contains("Staff Training Day");
        assertThat(r.get("nextAvailable").get("date").asText()).isEqualTo("2026-09-05");
        assertThat(r.get("nextAvailable").get("startTime").asText()).isEqualTo("10:00");
        // asked for a single date -> it queries a 2-week window at SLOT granularity
        assertThat(stub.lastGranularity.get()).isEqualTo("SLOT");
        assertThat(stub.lastFrom.get()).isEqualTo("2026-09-04");
        assertThat(stub.lastTo.get()).isEqualTo("2026-09-18");
    }

    @Test
    void checkAvailability_reportsOpenWithSlots() throws Exception {
        var stub = new StubClient();
        stub.availabilityJson = """
                {"from":"2026-09-05","to":"2026-09-19",
                 "days":[{"date":"2026-09-05","weekday":"SATURDAY","status":"OPEN","reason":null,
                          "openSlotCount":2,"firstOpenTime":"10:00","availableStaffIds":[2],
                          "slots":[{"staffId":2,"startTime":"10:00","endTime":"10:45","booked":false},
                                   {"staffId":2,"startTime":"10:45","endTime":"11:30","booked":true}]}],
                 "firstAvailable":{"date":"2026-09-05","startTime":"10:00","staffId":2}}""";

        JsonNode r = JSON.readTree(new SalonDataTools(stub, "s").checkAvailability(3L, "2026-09-05", 2L));

        assertThat(r.get("available").asBoolean()).isTrue();
        assertThat(r.get("status").asText()).isEqualTo("OPEN");
        assertThat(r.has("reason")).isFalse();
        assertThat(r.get("slots")).hasSize(2);
        assertThat(r.get("openSlotCount").asInt()).isEqualTo(2);
    }

    @Test
    void checkAvailability_rejectsAMalformedDate() throws Exception {
        JsonNode r = JSON.readTree(new SalonDataTools(new StubClient(), "s").checkAvailability(1L, "next friday", null));
        assertThat(r.get("error").asText()).contains("next friday");
    }

    @Test
    void checkAvailability_passesThroughWhenTheAskedDayIsMissing() {
        var stub = new StubClient();
        stub.availabilityJson = "{\"days\":[]}";
        String out = new SalonDataTools(stub, "s").checkAvailability(1L, "2026-09-04", null);
        assertThat(out).isEqualTo("{\"days\":[]}");
    }

    @Test
    void startBookingPicker_carriesAResolvedUpcomingDateIntoTheComponentProps() {
        var tools = new SalonDataTools(new StubClient(), "s");
        var wanted = LocalDate.now().plusDays(10).toString();

        tools.startBookingPicker(3L, null, wanted);

        var picker = tools.components().getFirst();
        assertThat(picker.type()).isEqualTo("booking-picker");
        assertThat(picker.props())
                .containsEntry("serviceId", 3L)
                .containsEntry("date", wanted);
    }

    @Test
    void startBookingPicker_dropsAPastOrUnparseableDateSoThePickerFallsBackToItsDefault() {
        var past = new SalonDataTools(new StubClient(), "s");
        past.startBookingPicker(3L, null, LocalDate.now().minusDays(1).toString());
        assertThat(past.components().getFirst().props()).doesNotContainKey("date");

        var junk = new SalonDataTools(new StubClient(), "s");
        junk.startBookingPicker(3L, null, "next sunday");
        assertThat(junk.components().getFirst().props()).doesNotContainKey("date");
    }

    @Test
    void showDatePicker_carriesAResolvedUpcomingDateIntoTheComponentProps() {
        var tools = new SalonDataTools(new StubClient(), "s");
        var wanted = LocalDate.now().plusDays(4).toString();

        tools.showDatePicker(3L, null, wanted);

        var picker = tools.components().getFirst();
        assertThat(picker.type()).isEqualTo("date-picker");
        assertThat(picker.props()).containsEntry("date", wanted);
    }

    @Test
    void findAvailableDates_forwardsRangeAndLimitAtDayGranularity() {
        var stub = new StubClient();
        stub.availabilityJson = "{\"days\":[],\"firstAvailable\":null}";

        String out = new SalonDataTools(stub, "s")
                .findAvailableDates(3L, 2L, "2026-09-01", "2026-09-30", 3);

        assertThat(out).isEqualTo("{\"days\":[],\"firstAvailable\":null}");
        assertThat(stub.lastGranularity.get()).isEqualTo("DAY");
        assertThat(stub.lastFrom.get()).isEqualTo("2026-09-01");
        assertThat(stub.lastTo.get()).isEqualTo("2026-09-30");
        assertThat(stub.lastLimit).isEqualTo(3);
    }
}
