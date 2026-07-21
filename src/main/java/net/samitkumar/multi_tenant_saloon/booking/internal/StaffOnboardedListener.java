package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonApi;
import net.samitkumar.multi_tenant_saloon.staff.StaffOnboardedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
class StaffOnboardedListener {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("H:mm");

    private final StaffAvailabilityRepository availabilityRepo;
    private final SaloonApi saloonApi;

    StaffOnboardedListener(StaffAvailabilityRepository availabilityRepo, SaloonApi saloonApi) {
        this.availabilityRepo = availabilityRepo;
        this.saloonApi = saloonApi;
    }

    @ApplicationModuleListener
    void onStaffOnboarded(StaffOnboardedEvent event) {
        List<Saloon.OperatingHours> operatingHours = saloonApi.findOperatingHours(event.saloonId());

        var entries = event.schedule().stream()
                .flatMap(d -> {
                    if (operatingHours.isEmpty()) {
                        // No saloon hours configured — keep the requested schedule as-is
                        return java.util.stream.Stream.of(
                                new StaffAvailability(null, event.saloonId(), event.staffId(),
                                        d.dayOfWeek(), d.startTime(), d.endTime(), true));
                    }

                    return operatingHours.stream()
                            .filter(oh -> oh.day() == d.dayOfWeek() && !oh.closed())
                            .findFirst()
                            .flatMap(oh -> {
                                LocalTime saloonOpen  = LocalTime.parse(oh.openTime(),  TIME_FMT);
                                LocalTime saloonClose = LocalTime.parse(oh.closeTime(), TIME_FMT);
                                LocalTime start = d.startTime().isBefore(saloonOpen)  ? saloonOpen  : d.startTime();
                                LocalTime end   = d.endTime().isAfter(saloonClose)    ? saloonClose : d.endTime();
                                if (!start.isBefore(end)) return java.util.Optional.empty();
                                return java.util.Optional.of(
                                        new StaffAvailability(null, event.saloonId(), event.staffId(),
                                                d.dayOfWeek(), start, end, true));
                            })
                            .stream();
                })
                .toList();

        availabilityRepo.saveAll(entries);
    }
}
