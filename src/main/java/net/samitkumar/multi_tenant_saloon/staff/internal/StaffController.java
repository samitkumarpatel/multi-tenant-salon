package net.samitkumar.multi_tenant_saloon.staff.internal;

import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import net.samitkumar.multi_tenant_saloon.staff.StaffRole;
import net.samitkumar.multi_tenant_saloon.staff.StaffStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api/saloons/{saloonId}/staff")
class StaffController {

    private final StaffService service;

    StaffController(StaffService service) {
        this.service = service;
    }

    record OnboardRequest(String name, String email, String phone, StaffRole role, List<String> specializations) {}

    record UpdateRequest(String name, String email, String phone, StaffRole role, StaffStatus status,
                         List<String> specializations) {}

    @GetMapping
    List<StaffMember> findAll(@PathVariable String saloonId) {
        return service.findBySaloonId(saloonId);
    }

    @PostMapping
    ResponseEntity<StaffMember> onboard(@PathVariable String saloonId, @RequestBody OnboardRequest request) {
        var member = service.onboard(saloonId, request.name(), request.email(), request.phone(),
                request.role(), request.specializations());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(member.id())
                .toUri();
        return ResponseEntity.created(location).body(member);
    }

    @GetMapping("/{staffId}")
    ResponseEntity<StaffMember> findById(@PathVariable String saloonId, @PathVariable String staffId) {
        return service.findById(saloonId, staffId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{staffId}")
    ResponseEntity<StaffMember> update(@PathVariable String saloonId, @PathVariable String staffId,
                                       @RequestBody UpdateRequest request) {
        return service.update(saloonId, staffId, request.name(), request.email(), request.phone(),
                        request.role(), request.status(), request.specializations())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{staffId}")
    ResponseEntity<Void> remove(@PathVariable String saloonId, @PathVariable String staffId) {
        service.remove(saloonId, staffId);
        return ResponseEntity.noContent().build();
    }
}
