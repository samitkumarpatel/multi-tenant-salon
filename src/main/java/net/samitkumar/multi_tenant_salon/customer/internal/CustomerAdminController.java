package net.samitkumar.multi_tenant_salon.customer.internal;

import net.samitkumar.multi_tenant_salon.customer.internal.CustomerDirectoryViews.CustomerDetail;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerDirectoryViews.CustomerPage;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerDirectoryViews.CustomerSpec;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * The owner's customer list — {@code /api/salon-admin/{salonId}/customers/**}, owner-gated by the
 * security config's {@code /api/salon-admin/{salonId}/**} rule. Deliberately not on the desk-staff allowlist.
 */
@RestController
@RequestMapping("/api/salon-admin/{salonId}/customers")
class CustomerAdminController {

    private final CustomerDirectory directory;
    private final SalonApi salonApi;

    CustomerAdminController(CustomerDirectory directory, SalonApi salonApi) {
        this.directory = directory;
        this.salonApi = salonApi;
    }

    @GetMapping
    CustomerPage list(@PathVariable String salonId,
                      @RequestParam(required = false) String q,
                      @RequestParam(defaultValue = "recent") String sort,
                      @RequestParam(defaultValue = "0") int page,
                      @RequestParam(defaultValue = "50") int size) {
        return directory.list(salonApi.resolveId(salonId), q, sort, page, size);
    }

    @PostMapping
    ResponseEntity<SalonCustomer> create(@PathVariable String salonId, @RequestBody CustomerSpec spec) {
        var customer = directory.create(salonApi.resolveId(salonId), spec);
        var location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(customer.id()).toUri();
        return ResponseEntity.created(location).body(customer);
    }

    @GetMapping("/{id}")
    ResponseEntity<CustomerDetail> get(@PathVariable String salonId, @PathVariable Long id) {
        return ResponseEntity.of(directory.detail(salonApi.resolveId(salonId), id));
    }

    @PutMapping("/{id}")
    ResponseEntity<SalonCustomer> update(@PathVariable String salonId, @PathVariable Long id, @RequestBody CustomerSpec spec) {
        return ResponseEntity.of(directory.update(salonApi.resolveId(salonId), id, spec));
    }

    /** Erases the customer's details everywhere (see {@link CustomerDirectory#delete}); 409 while they have an active membership or upcoming appointment. */
    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable String salonId, @PathVariable Long id) {
        return directory.delete(salonApi.resolveId(salonId), id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
