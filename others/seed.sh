#!/usr/bin/env bash
# seed.sh — end-to-end seed for local development
# Creates 3 saloons with staff, services, and weekly availability.
#
# Usage:
#   ./seed.sh                        # hits http://localhost:8080
#   ./seed.sh http://localhost:9090  # custom base URL
#
# Requires: curl, jq

set -euo pipefail

BASE="${1:-http://localhost:8080}/api/saloons"
SEP="──────────────────────────────────────────────"

command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required. Install it first."; exit 1; }

post()  { curl -s -X POST  "$1" -H 'Content-Type: application/json' -d "$2"; }
put()   { curl -s -X PUT   "$1" -H 'Content-Type: application/json' -d "$2"; }

# Monday–Saturday availability block reused for every staff member
WEEKLY_AVAIL='[
  {"dayOfWeek":"MONDAY",    "startTime":"09:00","endTime":"18:00","available":true},
  {"dayOfWeek":"TUESDAY",   "startTime":"09:00","endTime":"18:00","available":true},
  {"dayOfWeek":"WEDNESDAY", "startTime":"09:00","endTime":"18:00","available":true},
  {"dayOfWeek":"THURSDAY",  "startTime":"09:00","endTime":"18:00","available":true},
  {"dayOfWeek":"FRIDAY",    "startTime":"09:00","endTime":"20:00","available":true},
  {"dayOfWeek":"SATURDAY",  "startTime":"10:00","endTime":"17:00","available":true}
]'

set_availability() {
  local saloon_id="$1" staff_id="$2"
  put "$BASE/$saloon_id/staff/$staff_id/availability" "$WEEKLY_AVAIL" > /dev/null
}

echo ""
echo "$SEP"
echo "  Multi-Tenant Saloon — Dev Seed"
echo "$SEP"

# ─────────────────────────────────────────────────────────────────────────────
# SALOON 1 — Luxe Hair Studio, New York
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "▶  Creating Saloon 1: Luxe Hair Studio (New York)"

S1=$(post "$BASE" '{
  "name": "Luxe Hair Studio",
  "ownerName": "Sophia Bennett",
  "ownerEmail": "sophia@luxehair.com",
  "ownerPhone": "+1 212 555 0101",
  "location": {"address":"142 W 57th St","city":"New York","state":"NY","country":"USA","zipCode":"10019"},
  "contact":  {"phone":"+1 212 555 0100","email":"info@luxehair.com","website":"www.luxehair.com"},
  "features": ["BOOKING","STATIC_WEBSITE"],
  "operatingHours": [
    {"day":"MONDAY",    "openTime":"09:00","closeTime":"19:00","closed":false},
    {"day":"TUESDAY",   "openTime":"09:00","closeTime":"19:00","closed":false},
    {"day":"WEDNESDAY", "openTime":"09:00","closeTime":"19:00","closed":false},
    {"day":"THURSDAY",  "openTime":"09:00","closeTime":"19:00","closed":false},
    {"day":"FRIDAY",    "openTime":"09:00","closeTime":"20:00","closed":false},
    {"day":"SATURDAY",  "openTime":"10:00","closeTime":"18:00","closed":false},
    {"day":"SUNDAY",    "openTime":"00:00","closeTime":"00:00","closed":true}
  ]
}' | jq -r '.id')
echo "   Saloon ID : $S1"
echo "   Handler   : luxe-hair-studio"

# Owner was auto-enrolled as staff — set their availability
OWNER1=$(curl -s "$BASE/$S1/staff" | jq -r '[.[] | select(.isOwner==true)][0].id')
echo "   Owner staff ID: $OWNER1"
set_availability "$S1" "$OWNER1"

echo "   → Onboarding staff …"

ST1A=$(post "$BASE/$S1/staff" '{
  "name":"Marcus Reid","email":"marcus@luxehair.com","phone":"+1 212 555 0102",
  "role":"STYLIST","specializations":["HAIR","MAKEUP"]
}' | jq -r '.id')
set_availability "$S1" "$ST1A"
echo "     Marcus Reid (STYLIST) : $ST1A"

ST1B=$(post "$BASE/$S1/staff" '{
  "name":"Isabella Torres","email":"isabella@luxehair.com","phone":"+1 212 555 0103",
  "role":"COLORIST","specializations":["HAIR","SKIN_CARE"]
}' | jq -r '.id')
set_availability "$S1" "$ST1B"
echo "     Isabella Torres (COLORIST) : $ST1B"

ST1C=$(post "$BASE/$S1/staff" '{
  "name":"David Kim","email":"david@luxehair.com","phone":"+1 212 555 0104",
  "role":"ASSISTANT","specializations":["HAIR"]
}' | jq -r '.id')
set_availability "$S1" "$ST1C"
echo "     David Kim (ASSISTANT) : $ST1C"

echo "   → Adding services …"

post "$BASE/$S1/services" "{
  \"name\":\"Classic Haircut\",\"description\":\"Shampoo, cut & blow-dry\",
  \"price\":45.00,\"currency\":\"USD\",\"durationMinutes\":45,\"category\":\"HAIR\",
  \"assignedStaffIds\":[\"$ST1A\",\"$ST1C\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S1/services" "{
  \"name\":\"Balayage & Highlights\",\"description\":\"Hand-painted colour with toning\",
  \"price\":195.00,\"currency\":\"USD\",\"durationMinutes\":180,\"category\":\"HAIR\",
  \"assignedStaffIds\":[\"$ST1B\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S1/services" "{
  \"name\":\"Blowout & Style\",\"description\":\"Professional blowout and finishing\",
  \"price\":60.00,\"currency\":\"USD\",\"durationMinutes\":45,\"category\":\"HAIR\",
  \"assignedStaffIds\":[\"$ST1A\",\"$ST1B\",\"$ST1C\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S1/services" "{
  \"name\":\"Deep Conditioning Treatment\",\"description\":\"Intensive repair mask & scalp massage\",
  \"price\":55.00,\"currency\":\"USD\",\"durationMinutes\":30,\"category\":\"HAIR\",
  \"assignedStaffIds\":[\"$ST1A\",\"$ST1B\"]
}" | jq -r '"     " + .name + " → \(.id)"'

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# SALOON 2 — The Bearded Gentleman, London
# ─────────────────────────────────────────────────────────────────────────────
echo "▶  Creating Saloon 2: The Bearded Gentleman (London)"

S2=$(post "$BASE" '{
  "name": "The Bearded Gentleman",
  "ownerName": "James Hartley",
  "ownerEmail": "james@beardedgent.co.uk",
  "ownerPhone": "+44 20 7946 0301",
  "location": {"address":"34 Carnaby St","city":"London","state":"England","country":"UK","zipCode":"W1F 7DR"},
  "contact":  {"phone":"+44 20 7946 0300","email":"hello@beardedgent.co.uk","website":"www.beardedgent.co.uk"},
  "features": ["BOOKING","MEMBERSHIP","LOYALTY_PROGRAM","STATIC_WEBSITE"],
  "operatingHours": [
    {"day":"MONDAY",    "openTime":"08:00","closeTime":"18:00","closed":false},
    {"day":"TUESDAY",   "openTime":"08:00","closeTime":"18:00","closed":false},
    {"day":"WEDNESDAY", "openTime":"08:00","closeTime":"18:00","closed":false},
    {"day":"THURSDAY",  "openTime":"08:00","closeTime":"20:00","closed":false},
    {"day":"FRIDAY",    "openTime":"08:00","closeTime":"20:00","closed":false},
    {"day":"SATURDAY",  "openTime":"09:00","closeTime":"17:00","closed":false},
    {"day":"SUNDAY",    "openTime":"00:00","closeTime":"00:00","closed":true}
  ]
}' | jq -r '.id')
echo "   Saloon ID : $S2"
echo "   Handler   : the-bearded-gentleman"

OWNER2=$(curl -s "$BASE/$S2/staff" | jq -r '[.[] | select(.isOwner==true)][0].id')
echo "   Owner staff ID: $OWNER2"
set_availability "$S2" "$OWNER2"

echo "   → Onboarding staff …"

ST2A=$(post "$BASE/$S2/staff" '{
  "name":"Tom Whitfield","email":"tom@beardedgent.co.uk","phone":"+44 20 7946 0302",
  "role":"STYLIST","specializations":["BEARD","HAIR"]
}' | jq -r '.id')
set_availability "$S2" "$ST2A"
echo "     Tom Whitfield (STYLIST) : $ST2A"

ST2B=$(post "$BASE/$S2/staff" '{
  "name":"Liam Cooper","email":"liam@beardedgent.co.uk","phone":"+44 20 7946 0303",
  "role":"RECEPTIONIST","specializations":["HAIR","BEARD"]
}' | jq -r '.id')
set_availability "$S2" "$ST2B"
echo "     Liam Cooper (RECEPTIONIST) : $ST2B"

echo "   → Adding services …"

post "$BASE/$S2/services" "{
  \"name\":\"Classic Wet Shave\",\"description\":\"Hot towel preparation and straight-razor shave\",
  \"price\":35.00,\"currency\":\"GBP\",\"durationMinutes\":30,\"category\":\"BEARD\",
  \"assignedStaffIds\":[\"$ST2A\",\"$OWNER2\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S2/services" "{
  \"name\":\"Beard Trim & Shape\",\"description\":\"Precision trim, shape & edge-up\",
  \"price\":22.00,\"currency\":\"GBP\",\"durationMinutes\":20,\"category\":\"BEARD\",
  \"assignedStaffIds\":[\"$ST2A\",\"$ST2B\",\"$OWNER2\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S2/services" "{
  \"name\":\"Men's Haircut\",\"description\":\"Consultation, cut & finish\",
  \"price\":38.00,\"currency\":\"GBP\",\"durationMinutes\":45,\"category\":\"HAIR\",
  \"assignedStaffIds\":[\"$ST2A\",\"$OWNER2\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S2/services" "{
  \"name\":\"The Full Works\",\"description\":\"Haircut + hot towel shave + beard shape\",
  \"price\":70.00,\"currency\":\"GBP\",\"durationMinutes\":75,\"category\":\"HAIR\",
  \"assignedStaffIds\":[\"$ST2A\",\"$OWNER2\"]
}" | jq -r '"     " + .name + " → \(.id)"'

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# SALOON 3 — Glam & Go, Mumbai
# ─────────────────────────────────────────────────────────────────────────────
echo "▶  Creating Saloon 3: Glam & Go (Mumbai)"

S3=$(post "$BASE" '{
  "name": "Glam and Go",
  "ownerName": "Priya Sharma",
  "ownerEmail": "priya@glamandgo.in",
  "ownerPhone": "+91 98201 55678",
  "location": {"address":"Shop 12, Linking Road","city":"Mumbai","state":"Maharashtra","country":"India","zipCode":"400050"},
  "contact":  {"phone":"+91 98201 55678","email":"hello@glamandgo.in","website":"www.glamandgo.in"},
  "features": ["BOOKING","WEBSHOP","ANALYTICS","STATIC_WEBSITE"],
  "operatingHours": [
    {"day":"MONDAY",    "openTime":"10:00","closeTime":"20:00","closed":false},
    {"day":"TUESDAY",   "openTime":"10:00","closeTime":"20:00","closed":false},
    {"day":"WEDNESDAY", "openTime":"10:00","closeTime":"20:00","closed":false},
    {"day":"THURSDAY",  "openTime":"10:00","closeTime":"20:00","closed":false},
    {"day":"FRIDAY",    "openTime":"10:00","closeTime":"21:00","closed":false},
    {"day":"SATURDAY",  "openTime":"09:00","closeTime":"21:00","closed":false},
    {"day":"SUNDAY",    "openTime":"11:00","closeTime":"18:00","closed":false}
  ]
}' | jq -r '.id')
echo "   Saloon ID : $S3"
echo "   Handler   : glam-and-go"

OWNER3=$(curl -s "$BASE/$S3/staff" | jq -r '[.[] | select(.isOwner==true)][0].id')
echo "   Owner staff ID: $OWNER3"
set_availability "$S3" "$OWNER3"

echo "   → Onboarding staff …"

ST3A=$(post "$BASE/$S3/staff" '{
  "name":"Anjali Desai","email":"anjali@glamandgo.in","phone":"+91 98201 55679",
  "role":"MAKEUP_ARTIST","specializations":["MAKEUP","SKIN_CARE"]
}' | jq -r '.id')
set_availability "$S3" "$ST3A"
echo "     Anjali Desai (MAKEUP_ARTIST) : $ST3A"

ST3B=$(post "$BASE/$S3/staff" '{
  "name":"Pooja Nair","email":"pooja@glamandgo.in","phone":"+91 98201 55680",
  "role":"NAIL_TECHNICIAN","specializations":["NAILS"]
}' | jq -r '.id')
set_availability "$S3" "$ST3B"
echo "     Pooja Nair (NAIL_TECHNICIAN) : $ST3B"

ST3C=$(post "$BASE/$S3/staff" '{
  "name":"Rahul Verma","email":"rahul@glamandgo.in","phone":"+91 98201 55681",
  "role":"STYLIST","specializations":["HAIR","WAXING"]
}' | jq -r '.id')
set_availability "$S3" "$ST3C"
echo "     Rahul Verma (STYLIST) : $ST3C"

echo "   → Adding services …"

post "$BASE/$S3/services" "{
  \"name\":\"Bridal Makeup\",\"description\":\"Full bridal package with trial session\",
  \"price\":8000.00,\"currency\":\"INR\",\"durationMinutes\":120,\"category\":\"MAKEUP\",
  \"assignedStaffIds\":[\"$ST3A\",\"$OWNER3\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S3/services" "{
  \"name\":\"Gel Manicure\",\"description\":\"Gel colour application with cuticle care\",
  \"price\":1500.00,\"currency\":\"INR\",\"durationMinutes\":60,\"category\":\"NAILS\",
  \"assignedStaffIds\":[\"$ST3B\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S3/services" "{
  \"name\":\"Hair Spa\",\"description\":\"Deep conditioning, scalp massage & blow-dry\",
  \"price\":2500.00,\"currency\":\"INR\",\"durationMinutes\":90,\"category\":\"HAIR\",
  \"assignedStaffIds\":[\"$ST3C\",\"$OWNER3\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S3/services" "{
  \"name\":\"Party Makeup\",\"description\":\"Glamour look for events and occasions\",
  \"price\":4000.00,\"currency\":\"INR\",\"durationMinutes\":60,\"category\":\"MAKEUP\",
  \"assignedStaffIds\":[\"$ST3A\",\"$OWNER3\"]
}" | jq -r '"     " + .name + " → \(.id)"'

post "$BASE/$S3/services" "{
  \"name\":\"Full Body Waxing\",\"description\":\"Smooth finish with soothing lotion\",
  \"price\":3500.00,\"currency\":\"INR\",\"durationMinutes\":90,\"category\":\"WAXING\",
  \"assignedStaffIds\":[\"$ST3C\"]
}" | jq -r '"     " + .name + " → \(.id)"'

echo ""
echo "$SEP"
echo "  Seed complete — 3 saloons, staff & services loaded."
echo ""
echo "  Public pages:"
echo "    http://localhost:5173/luxe-hair-studio/c"
echo "    http://localhost:5173/the-bearded-gentleman/c"
echo "    http://localhost:5173/glam-and-go/c"
echo ""
echo "  Admin pages:"
echo "    http://localhost:5173/luxe-hair-studio/c  (append nothing, click Manage)"
echo "    Owner login uses the owner e-mail + OTP: 123456"
echo "$SEP"
echo ""
