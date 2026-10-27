package net.samitkumar.multi_tenant_salon.superadmin.internal;

import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/salon-super-admin/users")
class UserManagementController {
    private final UserManagementService users;
    private final LoginAuditService loginAudit;
    UserManagementController(UserManagementService users, LoginAuditService loginAudit) { this.users = users; this.loginAudit = loginAudit; }

    @GetMapping
    UserManagementService.UserPage list(@RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="") String role, @RequestParam(required=false) UUID salonId,
            @RequestParam(defaultValue="ALL") String status,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="25") int size) {
        return users.list(q, role, salonId, status, page, size);
    }
    @GetMapping("/detail")
    UserManagementService.Detail detail(@RequestParam String email) { return users.detail(email); }

    @GetMapping("/login-history")
    LoginAuditService.Page loginHistory(@RequestParam String email,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        users.detail(email); // Reuse canonical email validation and reject unknown identities.
        return loginAudit.customerHistory(email.trim().toLowerCase(java.util.Locale.ROOT), page, size);
    }
}
