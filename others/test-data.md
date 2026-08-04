# Test Data — Saloons, Staff & Services

Dummy data for local development against `http://localhost:8080`.

> **Quickstart:** run `./others/seed.sh` to create all 3 saloons with staff, services, and
> availability in one go (requires `curl` and `jq`).

Staff and service commands use `<SALOON_ID>` — replace it with the UUID returned by the saloon
creation call (`.id` field in the JSON response).

**API namespaces:**
- `POST /api/saloon-onboarding` — create a new saloon (public onboarding)
- `GET /api/saloon/{id}` / `GET /api/saloon/handler/{handler}` — public read (customer-facing)
- `/api/saloon-admin/{id}/...` — all write and admin operations (requires auth)

---

## Example 1 — Luxe Hair Studio, New York

**curl**
```bash
curl -s -X POST localhost:8080/api/saloon-onboarding \
  -H 'Content-Type: application/json' \
  -d '{"name":"Luxe Hair Studio","ownerName":"Sophia Bennett","ownerEmail":"sophia@luxehair.com","ownerPhone":"+1 212 555 0101","location":{"address":"142 W 57th St","city":"New York","state":"NY","country":"USA","zipCode":"10019"},"contact":{"phone":"+1 212 555 0100","email":"info@luxehair.com","website":"www.luxehair.com"},"features":["BOOKING","STATIC_WEBSITE"],"operatingHours":[{"day":"MONDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"10:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloon-onboarding \
  name="Luxe Hair Studio F" \
  ownerName="Sophia Bennett" ownerEmail="sophia@luxehair.com" ownerPhone="+1 212 555 0101" \
  location:='{"address":"142 W 57th St","city":"New York","state":"NY","country":"USA","zipCode":"10019"}' \
  contact:='{"phone":"+1 212 555 0100","email":"info@luxehair.com","website":"www.luxehair.com"}' \
  features:='["BOOKING","STATIC_WEBSITE"]' \
  operatingHours:='[{"day":"MONDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"10:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]'

http POST localhost:8080/api/saloon-onboarding \
  name="Luxe Hair Studio G" \
  ownerName="Sophia Bennett" ownerEmail="sophia@luxehair.com" ownerPhone="+1 212 555 0101" \
  location:='{"address":"148 W 59th St","city":"New York","state":"NY","country":"USA","zipCode":"10020"}' \
  contact:='{"phone":"+1 212 555 0100","email":"info@luxehair.com","website":"www.luxehair.com"}' \
  features:='["BOOKING","STATIC_WEBSITE"]' \
  operatingHours:='[{"day":"MONDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"10:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]'

```

---

## Example 2 — The Bearded Gentleman, London

**curl**
```bash
curl -s -X POST localhost:8080/api/saloon-onboarding \
  -H 'Content-Type: application/json' \
  -d '{"name":"The Bearded Gentleman","ownerName":"James Hartley","ownerEmail":"james@beardedgent.co.uk","ownerPhone":"+44 20 7946 0301","location":{"address":"34 Carnaby St","city":"London","state":"England","country":"UK","zipCode":"W1F 7DR"},"contact":{"phone":"+44 20 7946 0300","email":"hello@beardedgent.co.uk","website":"www.beardedgent.co.uk"},"features":["BOOKING","MEMBERSHIP","LOYALTY_PROGRAM"],"operatingHours":[{"day":"MONDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"TUESDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"WEDNESDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"THURSDAY","openTime":"08:00","closeTime":"20:00","closed":false},{"day":"FRIDAY","openTime":"08:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloon-onboarding \
  name="The Bearded Gentleman" \
  ownerName="James Hartley" ownerEmail="james@beardedgent.co.uk" ownerPhone="+44 20 7946 0301" \
  location:='{"address":"34 Carnaby St","city":"London","state":"England","country":"UK","zipCode":"W1F 7DR"}' \
  contact:='{"phone":"+44 20 7946 0300","email":"hello@beardedgent.co.uk","website":"www.beardedgent.co.uk"}' \
  features:='["BOOKING","MEMBERSHIP","LOYALTY_PROGRAM"]' \
  operatingHours:='[{"day":"MONDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"TUESDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"WEDNESDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"THURSDAY","openTime":"08:00","closeTime":"20:00","closed":false},{"day":"FRIDAY","openTime":"08:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]'
```

---

## Example 3 — Glam & Go, Mumbai

**curl**
```bash
curl -s -X POST localhost:8080/api/saloon-onboarding \
  -H 'Content-Type: application/json' \
  -d '{"name":"Glam & Go","ownerName":"Priya Sharma","ownerEmail":"priya@glamandgo.in","ownerPhone":"+91 98201 55678","location":{"address":"Shop 12, Linking Road","city":"Mumbai","state":"Maharashtra","country":"India","zipCode":"400050"},"contact":{"phone":"+91 98201 55678","email":"hello@glamandgo.in","website":"www.glamandgo.in"},"features":["BOOKING","WEBSHOP","ANALYTICS"],"operatingHours":[{"day":"MONDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"TUESDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"WEDNESDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"THURSDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"FRIDAY","openTime":"10:00","closeTime":"21:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"21:00","closed":false},{"day":"SUNDAY","openTime":"11:00","closeTime":"18:00","closed":false}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloon-onboarding \
  name="Glam & Go" \
  ownerName="Priya Sharma" ownerEmail="priya@glamandgo.in" ownerPhone="+91 98201 55678" \
  location:='{"address":"Shop 12, Linking Road","city":"Mumbai","state":"Maharashtra","country":"India","zipCode":"400050"}' \
  contact:='{"phone":"+91 98201 55678","email":"hello@glamandgo.in","website":"www.glamandgo.in"}' \
  features:='["BOOKING","WEBSHOP","ANALYTICS"]' \
  operatingHours:='[{"day":"MONDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"TUESDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"WEDNESDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"THURSDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"FRIDAY","openTime":"10:00","closeTime":"21:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"21:00","closed":false},{"day":"SUNDAY","openTime":"11:00","closeTime":"18:00","closed":false}]'
```

---

## Example 4 — Scissors & Soul, Berlin

**curl**
```bash
curl -s -X POST localhost:8080/api/saloon-onboarding \
  -H 'Content-Type: application/json' \
  -d '{"name":"Scissors & Soul","ownerName":"Erik Müller","ownerEmail":"erik@scissorsandsoul.de","ownerPhone":"+49 30 12345678","location":{"address":"Oranienburger Str. 27","city":"Berlin","state":"Berlin","country":"Germany","zipCode":"10117"},"contact":{"phone":"+49 30 12345678","email":"info@scissorsandsoul.de"},"features":[],"operatingHours":[{"day":"MONDAY","openTime":"00:00","closeTime":"00:00","closed":true},{"day":"TUESDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloon-onboarding \
  name="Scissors & Soul" \
  ownerName="Erik Müller" ownerEmail="erik@scissorsandsoul.de" ownerPhone="+49 30 12345678" \
  location:='{"address":"Oranienburger Str. 27","city":"Berlin","state":"Berlin","country":"Germany","zipCode":"10117"}' \
  contact:='{"phone":"+49 30 12345678","email":"info@scissorsandsoul.de"}' \
  features:='[]' \
  operatingHours:='[{"day":"MONDAY","openTime":"00:00","closeTime":"00:00","closed":true},{"day":"TUESDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]'
```

---

## Example 5 — Curl Up & Dye, Sydney

**curl**
```bash
curl -s -X POST localhost:8080/api/saloon-onboarding \
  -H 'Content-Type: application/json' \
  -d '{"name":"Curl Up & Dye","ownerName":"Olivia Chen","ownerEmail":"olivia@curlupdye.com.au","ownerPhone":"+61 2 9876 5432","location":{"address":"88 Oxford St","city":"Sydney","state":"NSW","country":"Australia","zipCode":"2010"},"contact":{"phone":"+61 2 9876 5432","email":"hello@curlupdye.com.au","website":"www.curlupdye.com.au"},"features":["BOOKING","ANALYTICS","LOYALTY_PROGRAM","MEMBERSHIP"],"operatingHours":[{"day":"MONDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"SATURDAY","openTime":"08:00","closeTime":"17:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloon-onboarding \
  name="Curl Up & Dye" \
  ownerName="Olivia Chen" ownerEmail="olivia@curlupdye.com.au" ownerPhone="+61 2 9876 5432" \
  location:='{"address":"88 Oxford St","city":"Sydney","state":"NSW","country":"Australia","zipCode":"2010"}' \
  contact:='{"phone":"+61 2 9876 5432","email":"hello@curlupdye.com.au","website":"www.curlupdye.com.au"}' \
  features:='["BOOKING","ANALYTICS","LOYALTY_PROGRAM","MEMBERSHIP"]' \
  operatingHours:='[{"day":"MONDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"SATURDAY","openTime":"08:00","closeTime":"17:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]'
```

---

## Staff

> The saloon owner is automatically enrolled as a staff member (`isOwner: true`) when the saloon
> is created. The commands below add additional staff. Replace `<SALOON_ID>` with the UUID from
> the saloon creation response.

### Weekly availability (PUT after creating each staff member)

Replace `<SALOON_ID>` and `<STAFF_ID>` with real UUIDs.

**curl**
```bash
curl -s -X PUT localhost:8080/api/saloon-admin/<SALOON_ID>/staff/<STAFF_ID>/availability \
  -H 'Content-Type: application/json' \
  -d '[
    {"dayOfWeek":"MONDAY",    "startTime":"09:00","endTime":"18:00","available":true},
    {"dayOfWeek":"TUESDAY",   "startTime":"09:00","endTime":"18:00","available":true},
    {"dayOfWeek":"WEDNESDAY", "startTime":"09:00","endTime":"18:00","available":true},
    {"dayOfWeek":"THURSDAY",  "startTime":"09:00","endTime":"18:00","available":true},
    {"dayOfWeek":"FRIDAY",    "startTime":"09:00","endTime":"20:00","available":true},
    {"dayOfWeek":"SATURDAY",  "startTime":"10:00","endTime":"17:00","available":true}
  ]'
```

**HTTPie**
```bash
http PUT localhost:8080/api/saloon-admin/<SALOON_ID>/staff/<STAFF_ID>/availability \
  :='[{"dayOfWeek":"MONDAY","startTime":"09:00","endTime":"18:00","available":true},{"dayOfWeek":"TUESDAY","startTime":"09:00","endTime":"18:00","available":true},{"dayOfWeek":"WEDNESDAY","startTime":"09:00","endTime":"18:00","available":true},{"dayOfWeek":"THURSDAY","startTime":"09:00","endTime":"18:00","available":true},{"dayOfWeek":"FRIDAY","startTime":"09:00","endTime":"20:00","available":true},{"dayOfWeek":"SATURDAY","startTime":"10:00","endTime":"17:00","available":true}]'
```

---

### Example 1 — Luxe Hair Studio staff

**Marcus Reid (STYLIST)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"Marcus Reid","email":"marcus@luxehair.com","phone":"+1 212 555 0102","role":"STYLIST","specializations":["HAIR","MAKEUP"]}'
```

**Isabella Torres (COLORIST)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"Isabella Torres","email":"isabella@luxehair.com","phone":"+1 212 555 0103","role":"COLORIST","specializations":["HAIR","SKIN_CARE"]}'
```

**David Kim (ASSISTANT)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"David Kim","email":"david@luxehair.com","phone":"+1 212 555 0104","role":"ASSISTANT","specializations":["HAIR"]}'
```

---

### Example 2 — The Bearded Gentleman staff

**Tom Whitfield (STYLIST)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"Tom Whitfield","email":"tom@beardedgent.co.uk","phone":"+44 20 7946 0302","role":"STYLIST","specializations":["BEARD","HAIR"]}'
```

**Liam Cooper (RECEPTIONIST)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"Liam Cooper","email":"liam@beardedgent.co.uk","phone":"+44 20 7946 0303","role":"RECEPTIONIST","specializations":["HAIR","BEARD"]}'
```

---

### Example 3 — Glam and Go staff

**Anjali Desai (MAKEUP_ARTIST)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"Anjali Desai","email":"anjali@glamandgo.in","phone":"+91 98201 55679","role":"MAKEUP_ARTIST","specializations":["MAKEUP","SKIN_CARE"]}'
```

**Pooja Nair (NAIL_TECHNICIAN)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"Pooja Nair","email":"pooja@glamandgo.in","phone":"+91 98201 55680","role":"NAIL_TECHNICIAN","specializations":["NAILS"]}'
```

**Rahul Verma (STYLIST)**

```bash
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/staff \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rahul Verma","email":"rahul@glamandgo.in","phone":"+91 98201 55681","role":"STYLIST","specializations":["HAIR","WAXING"]}'
```

---

## Services

> Replace `<SALOON_ID>` and `<STAFF_ID_x>` with real UUIDs. `assignedStaffIds` is optional — omit
> it to make the service available with any bookable staff.

### Example 1 — Luxe Hair Studio services

```bash
# Classic Haircut
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Classic Haircut","description":"Shampoo, cut & blow-dry","price":45.00,"currency":"USD","durationMinutes":45,"category":"HAIR","assignedStaffIds":["<MARCUS_ID>","<DAVID_ID>"]}'

# Balayage & Highlights
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Balayage & Highlights","description":"Hand-painted colour with toning","price":195.00,"currency":"USD","durationMinutes":180,"category":"HAIR","assignedStaffIds":["<ISABELLA_ID>"]}'

# Blowout & Style
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Blowout & Style","description":"Professional blowout and finishing","price":60.00,"currency":"USD","durationMinutes":45,"category":"HAIR"}'

# Deep Conditioning Treatment
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Deep Conditioning Treatment","description":"Intensive repair mask & scalp massage","price":55.00,"currency":"USD","durationMinutes":30,"category":"HAIR"}'
```

### Example 2 — The Bearded Gentleman services

```bash
# Classic Wet Shave
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Classic Wet Shave","description":"Hot towel preparation and straight-razor shave","price":35.00,"currency":"GBP","durationMinutes":30,"category":"BEARD"}'

# Beard Trim & Shape
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Beard Trim & Shape","description":"Precision trim, shape & edge-up","price":22.00,"currency":"GBP","durationMinutes":20,"category":"BEARD"}'

# Men'\''s Haircut
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Men'\''s Haircut","description":"Consultation, cut & finish","price":38.00,"currency":"GBP","durationMinutes":45,"category":"HAIR"}'

# The Full Works
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"The Full Works","description":"Haircut + hot towel shave + beard shape","price":70.00,"currency":"GBP","durationMinutes":75,"category":"HAIR"}'
```

### Example 3 — Glam and Go services

```bash
# Bridal Makeup
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bridal Makeup","description":"Full bridal package with trial session","price":8000.00,"currency":"INR","durationMinutes":120,"category":"MAKEUP"}'

# Gel Manicure
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Gel Manicure","description":"Gel colour application with cuticle care","price":1500.00,"currency":"INR","durationMinutes":60,"category":"NAILS","assignedStaffIds":["<POOJA_ID>"]}'

# Hair Spa
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Hair Spa","description":"Deep conditioning, scalp massage & blow-dry","price":2500.00,"currency":"INR","durationMinutes":90,"category":"HAIR","assignedStaffIds":["<RAHUL_ID>"]}'

# Party Makeup
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Party Makeup","description":"Glamour look for events and occasions","price":4000.00,"currency":"INR","durationMinutes":60,"category":"MAKEUP"}'

# Full Body Waxing
curl -s -X POST localhost:8080/api/saloon-admin/<SALOON_ID>/services \
  -H 'Content-Type: application/json' \
  -d '{"name":"Full Body Waxing","description":"Smooth finish with soothing lotion","price":3500.00,"currency":"INR","durationMinutes":90,"category":"WAXING","assignedStaffIds":["<RAHUL_ID>"]}'
```
