# Multi-Tenant Saloon — Application Checklist

---

## ✅ Saloon Module (`/api/saloons`)

### Saloon Management
- [x] Create saloon — name, owner (name, email, phone)
- [x] Saloon location — address, city, state, country, zip
- [x] Saloon contact info — phone, email, website
- [x] Operating hours — open/close time per day, closed flag
- [x] Update saloon details
- [x] Update enabled features (Booking, Webshop, Membership, etc.)
- [x] List all saloons / Get by ID / Delete

### Staff Management (`/{saloonId}/staff`)
- [x] Onboard staff — name, email, phone, role
- [x] Staff roles — Manager, Stylist, Colorist, Makeup Artist, Nail Tech, Receptionist, Assistant
- [x] Staff status — Active, Inactive, On Leave
- [x] Staff specializations — service categories they handle
- [x] Update staff details
- [x] Remove staff
- [x] List staff per saloon

### Saloon Services (`/{saloonId}/services`)
- [x] Add service — name, description, price, currency, duration, category
- [x] Service categories — Hair, Makeup, Nails, Skin Care, Beard, Massage, Waxing
- [x] Assign staff to a service
- [x] Toggle service active / inactive
- [x] Update service pricing and details
- [x] Remove service
- [x] List services per saloon

---

## 🔲 Booking / Calender Module
