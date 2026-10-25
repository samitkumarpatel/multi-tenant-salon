#!/usr/bin/env bash
#
# seed-salon-shop.sh — build one fully-populated salon + web-shop + membership for local testing.
#
# Creates a single salon (STATIC_WEBSITE + BOOKING + DASHBOARD + WEBSHOP + MEMBERSHIP) and fills it
# with a realistic amount of data so every admin / public / staff / customer screen has something to show.
# It only ADDS data — the website theme is left at the app default, never touched.
#
#   • 7 staff members — each with an AVATAR, a bio, a 3-image work gallery,
#     specializations and a weekly availability schedule
#   • 9 bookable services across categories, several pinned to specific staff
#   • a web-shop:
#       - 6 brands, 7 categories
#       - 21 products, most with MULTIPLE IMAGES (2–4 each) and 1–3 variants,
#         including sale prices, low stock, out-of-stock and one inactive product
#       - a couple of inventory restocks
#       - 8 shipping methods covering every rule: home / pickup point / business, free-over
#         threshold, order-value / item-count / weight brackets, destination countries,
#         a second currency (EUR, never offered to this USD shop) and a paused method
#       - the refund & sales policies published to the website (shown at checkout)
#   • 13 customer orders across every state: new, confirmed, processing, ready to ship, on hold,
#     shipped (tracking), delivered, fulfilled (+invoice), cancelled; collect-in-salon and shipped,
#     domestic / express / heavy / international shipping; work notes, customer and per-line
#     notifications, line notes; refund accepted, refund rejected; a full return
#     (requested → approved → item shipped → received → accepted) with its credit note paid out
#   • memberships: 6 plans (monthly highlighted with sign-up fee, quarterly, capped yearly VIP,
#     a sold-out founders plan, a draft, an archived one) with perks, included services and
#     discounts; 6 members sold at the desk (cash / other) — active, cancel-at-period-end,
#     resumed, cancelled now, contact corrected, partly refunded, notes, renewal link sent
#   • customer self-service: Riya Kapoor has a booking, shop orders and a membership, so
#     /account shows every tab (sign in with riya.kapoor@example.com; the code is in the backend log)
#   • ~12 bookings over the next two weeks, some confirmed / completed / cancelled
#   • Dashboard settings plus several in-salon cashier sales mixing services and products
#   • 2 salon closures and 1 recurring holiday
#   • the owner's customer list (Customers in the admin): filled by the bookings / orders / memberships
#     above, then enriched with owner notes, plus a walk-in customer with no history (erasable). Riya
#     can't be erased (active membership + upcoming booking); Priyanka (cancelled) and Chris (no-show) can.
#   • customer self-service rules (cancel up to 12 h / reschedule up to 24 h before) and two extra
#     upcoming bookings for Riya, so her /account offers Cancel + Reschedule
#
# Not seedable without Stripe: online card checkouts, so no PENDING_PAYMENT / INCOMPLETE
# memberships and no unpaid shop orders. EXPIRED memberships need time to pass (the renewal job).
#
# Usage:
#   ./seed-salon-shop.sh                                  # -> http://localhost:8080
#   BASE_URL=http://localhost:9090 ./seed-salon-shop.sh
#   SALON_NAME="Demo Salon" ./seed-salon-shop.sh          # custom name (handler is derived)
#
# Requires: bash 4+, curl, jq. Start the backend first, e.g.  ./mvnw spring-boot:test-run
#
# Re-runnable: the salon name is suffixed with a timestamp so each run makes a fresh salon.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
STAMP="$(date +%m%d-%H%M%S)"
SALON_NAME="${SALON_NAME:-WW Studio} ${STAMP}"

# Image sources (real, reachable, deterministic by seed):
#   products / galleries -> https://picsum.photos/seed/<seed>/<w>/<h>
#   staff avatars        -> https://i.pravatar.cc/400?u=<email>
PIC() { printf 'https://picsum.photos/seed/%s/%s/%s' "$1" "${2:-900}" "${3:-900}"; }
AVA() { printf 'https://i.pravatar.cc/400?u=%s' "$1"; }

# ── tiny http helper ─────────────────────────────────────────────────────────────
# req() prints the response body on stdout and writes the HTTP status code to a
# temp file. The file (not a variable) is used on purpose: every caller runs
# `resp=$(req …)`, and a variable set inside that command-substitution subshell
# would never reach the parent shell — the file does.
_CODEFILE="$(mktemp "${TMPDIR:-/tmp}/seed-http.XXXXXX")"
trap 'rm -f "$_CODEFILE"' EXIT
req() { # req METHOD PATH [JSON_BODY] -> stdout: body ; $_CODEFILE: HTTP code
  local method="$1" path="$2" body="${3:-}" out
  if [[ -n "$body" ]]; then
    out=$(curl -sS -X "$method" "${BASE_URL}${path}" \
          -H 'Content-Type: application/json' -d "$body" -w $'\n%{http_code}') || out=$'\n000'
  else
    out=$(curl -sS -X "$method" "${BASE_URL}${path}" -w $'\n%{http_code}') || out=$'\n000'
  fi
  printf '%s' "${out##*$'\n'}" > "$_CODEFILE"
  printf '%s' "${out%$'\n'*}"
}
code() { cat "$_CODEFILE" 2>/dev/null || echo 000; }
ok()   { [[ "$(code)" =~ ^2[0-9][0-9]$ ]]; }
die()  { echo "  ✖ $*" >&2; exit 1; }
warn() { echo "  ! $*" >&2; }

# spine call: dies if the response is not 2xx. Leaves the body in $_RESP.
_RESP=""
must() { # must METHOD PATH BODY LABEL
  _RESP=$(req "$1" "$2" "${3:-}")
  ok || die "$4 failed (HTTP $(code)): ${_RESP}"
}

# Portable date arithmetic: GNU `date -d` (Linux) vs BSD `date -v` (macOS's built-in /bin/bash
# and `date` — the ones this script actually runs under out of the box, since macOS's stock bash
# is too old for `declare -A`/`mapfile`, which is also why those are avoided below).
if date -d "+1 day" +%F >/dev/null 2>&1; then
  day() { date -d "+$1 days" +%F; }                 # +N days from today, yyyy-mm-dd
  weekday() { date -d "$1" +%u; }                    # ISO weekday (1=Mon..7=Sun) of a yyyy-mm-dd
else
  day() { date -v+"$1"d +%F; }
  weekday() { date -jf %F "$1" +%u; }
fi

# ── preflight ───────────────────────────────────────────────────────────────────
command -v curl >/dev/null || die "curl not found"
command -v jq   >/dev/null || die "jq not found"
req GET "/api/salon-onboarding" >/dev/null
ok || die "backend at ${BASE_URL} not reachable / not ready (HTTP $(code)) — start it with ./mvnw spring-boot:test-run"

echo "▶ Seeding against ${BASE_URL}"
echo "  salon name: ${SALON_NAME}"

# ── 1. salon ────────────────────────────────────────────────────────────────────
echo "▶ Creating salon…"
salon_json=$(cat <<JSON
{
  "name": "${SALON_NAME}",
  "ownerName": "Nadia Whitlock",
  "ownerEmail": "nadia.${STAMP}@willowwren.test",
  "ownerPhone": "+1 415 555 0110",
  "location": { "address": "512 Hayes St", "city": "San Francisco", "state": "California", "zipCode": "94102", "country": "United States" },
  "contact": { "email": "hello@willowwren.test", "phone": "+1 415 555 0111", "website": "https://willowwren.test" },
  "operatingHours": [
    { "day": "MONDAY",    "openTime": "09:00", "closeTime": "18:00", "closed": false },
    { "day": "TUESDAY",   "openTime": "09:00", "closeTime": "18:00", "closed": false },
    { "day": "WEDNESDAY", "openTime": "09:00", "closeTime": "18:00", "closed": false },
    { "day": "THURSDAY",  "openTime": "09:00", "closeTime": "20:00", "closed": false },
    { "day": "FRIDAY",    "openTime": "09:00", "closeTime": "20:00", "closed": false },
    { "day": "SATURDAY",  "openTime": "10:00", "closeTime": "17:00", "closed": false },
    { "day": "SUNDAY",    "openTime": "00:00", "closeTime": "00:00", "closed": true  }
  ],
  "features": ["STATIC_WEBSITE", "BOOKING", "DASHBOARD", "WEBSHOP", "MEMBERSHIP", "ANALYTICS"],
  "businessRegistrationId": "CA-2026-${STAMP}",
  "showBusinessId": false,
  "termsAccepted": true
}
JSON
)
must POST "/api/salon-onboarding" "$salon_json" "salon onboarding"
SALON_ID=$(jq -r '.salonId'      <<<"$_RESP")
HANDLER=$(jq -r '.salonHandler'  <<<"$_RESP")
OWNER_EMAIL=$(jq -r '.emailId'   <<<"$_RESP")
echo "  salonId = ${SALON_ID}"
echo "  handler = ${HANDLER}"

echo "▶ Configuring Operations Dashboard…"
dashboard_settings=$(jq -nc --arg salon "$SALON_NAME" '{
  bookingManagementEnabled:true,
  cashierEnabled:true
}')
must PUT "/api/salon-admin/${SALON_ID}/dashboard/settings" "$dashboard_settings" "Dashboard settings"
echo "  appointment management, cashier and customer notifications enabled"

# NOTE: the website theme is intentionally left untouched — the salon keeps the
# application default. This script only adds staff / services / shop / bookings data.

# ── 2. staff (+ avatar, bio, work gallery, weekly schedule) ─────────────────────
echo "▶ Creating staff…"
# name|email-local|phone|role|specializations(csv)|bio
STAFF_ROWS=(
  "Marcus Reid|marcus|+1 415 555 0102|STYLIST|HAIR,MAKEUP|Editorial stylist with 12 years behind the chair. Known for lived-in layers and precision fringe."
  "Isabella Torres|isabella|+1 415 555 0103|COLORIST|HAIR,SKIN_CARE|Balayage and colour-correction specialist. Trained in Milan, obsessed with dimensional blondes."
  "David Kim|david|+1 415 555 0104|STYLIST|HAIR|Texture and curl expert. Loves a big blow-out and an even bigger playlist."
  "Priya Anand|priya|+1 415 555 0105|MAKEUP_ARTIST|MAKEUP,SKIN_CARE|Bridal and event makeup, soft-glam a speciality. Ten years in film and TV."
  "Ana Nguyen|ana|+1 415 555 0106|NAIL_TECHNICIAN|NAILS|Structured gel manicures and hand-painted nail art. Certified in Russian manicure technique."
  "Tom Whitfield|tom|+1 415 555 0107|STYLIST|BEARD,HAIR|Barbering and classic cuts. Straight-razor shaves are his meditation."
  "Sofia Marín|sofia|+1 415 555 0108|RECEPTIONIST|HAIR|Runs the front desk and keeps the day on time. Ask her for a coffee recommendation."
)
STAFF_IDS=(); STAFF_NAMES=()
SCHEDULE='[
  {"dayOfWeek":"MONDAY","startTime":"09:00","endTime":"18:00","available":true},
  {"dayOfWeek":"TUESDAY","startTime":"09:00","endTime":"18:00","available":true},
  {"dayOfWeek":"WEDNESDAY","startTime":"09:00","endTime":"18:00","available":true},
  {"dayOfWeek":"THURSDAY","startTime":"09:00","endTime":"20:00","available":true},
  {"dayOfWeek":"FRIDAY","startTime":"09:00","endTime":"20:00","available":true},
  {"dayOfWeek":"SATURDAY","startTime":"10:00","endTime":"17:00","available":true}
]'

for row in "${STAFF_ROWS[@]}"; do
  IFS='|' read -r name local phone role specs bio <<<"$row"
  email="${local}.${STAMP}@willowwren.test"
  slug=$(tr '[:upper:] ' '[:lower:]-' <<<"$name")
  # specializations csv -> json array
  specs_json=$(jq -Rc 'split(",")' <<<"$specs")
  gallery=$(jq -nc --arg a "$(PIC "${slug}-work-1" 800 1000)" \
                    --arg b "$(PIC "${slug}-work-2" 800 1000)" \
                    --arg c "$(PIC "${slug}-work-3" 800 1000)" '[$a,$b,$c]')

  create=$(jq -nc --arg name "$name" --arg email "$email" --arg phone "$phone" \
                  --arg role "$role" --argjson specs "$specs_json" --arg bio "$bio" \
                  --argjson media "$gallery" \
    '{name:$name,email:$email,phone:$phone,role:$role,specializations:$specs,bio:$bio,workMedia:$media}')
  resp=$(req POST "/api/salon-admin/${SALON_ID}/staff" "$create")
  ok || { warn "staff '${name}' create failed (HTTP $(code)): $resp"; continue; }
  sid=$(jq -r '.id' <<<"$resp")

  # avatar goes on via the admin update (OnboardStaffRequest has no avatarUrl) —
  # resend the identity fields so the PUT does not blank them.
  upd=$(jq -nc --arg name "$name" --arg email "$email" --arg phone "$phone" \
               --arg role "$role" --argjson specs "$specs_json" --arg bio "$bio" \
               --argjson media "$gallery" --arg avatar "$(AVA "$email")" \
    '{name:$name,email:$email,phone:$phone,role:$role,status:"ACTIVE",availableForBooking:true,
      specializations:$specs,bio:$bio,workMedia:$media,avatarUrl:$avatar}')
  resp=$(req PUT "/api/salon-admin/${SALON_ID}/staff/${sid}" "$upd")
  ok || warn "staff '${name}' avatar update failed (HTTP $(code)): $resp"

  resp=$(req PUT "/api/salon-admin/${SALON_ID}/staff/${sid}/availability" "$SCHEDULE")
  ok || warn "staff '${name}' availability failed (HTTP $(code)): $resp"

  STAFF_IDS+=("$sid"); STAFF_NAMES+=("$name")
  echo "  + ${name} (id ${sid}) — avatar, bio, 3-image gallery, schedule"
done
[[ ${#STAFF_IDS[@]} -gt 0 ]] || die "no staff created — aborting"

# One staff day-off override (next Thursday) for realistic gaps
req POST "/api/salon-admin/${SALON_ID}/staff/${STAFF_IDS[0]}/availability/overrides" \
  "$(jq -nc --arg d "$(day 8)" '{overrideDate:$d,available:false,reason:"Training day"}')" >/dev/null

# ── 3. services ────────────────────────────────────────────────────────────────
echo "▶ Creating services…"
# name|desc|price|minutes|category|staffIdxCsv (indexes into STAFF_IDS, empty = any)
SERVICE_ROWS=(
  "Classic Haircut|Consultation, shampoo, cut & blow-dry|65|45|HAIR|0,2"
  "Cut & Restyle|A fresh direction — longer consultation and finish|95|60|HAIR|0,2"
  "Balayage & Gloss|Hand-painted lightening with a toning gloss|210|180|HAIR|1"
  "Full Highlights|Full head of foils with toner and treatment|185|150|HAIR|1"
  "Blow-Dry & Style|Wash and professional blow-out|55|45|HAIR|2"
  "Deep Conditioning Treatment|Bond-building mask with scalp massage|48|30|HAIR|"
  "Beard Trim & Hot Towel|Shape, line-up and a hot-towel finish|38|30|BEARD|5"
  "Event Makeup|Full face for events and occasions|120|60|MAKEUP|3"
  "Structured Gel Manicure|Gel overlay with cuticle work and shaping|70|75|NAILS|4"
)
SERVICE_IDS=(); SERVICE_NAMES=()
for row in "${SERVICE_ROWS[@]}"; do
  IFS='|' read -r name desc price mins cat idxs <<<"$row"
  assigned='[]'
  if [[ -n "$idxs" ]]; then
    assigned=$(printf '%s\n' "${idxs//,/$'\n'}" \
      | while read -r i; do [[ -n "$i" ]] && printf '"%s"\n' "${STAFF_IDS[$i]}"; done | jq -sc '.')
  fi
  body=$(jq -nc --arg name "$name" --arg desc "$desc" --argjson price "$price" \
                --argjson mins "$mins" --arg cat "$cat" --argjson staff "$assigned" \
    '{name:$name,description:$desc,price:$price,currency:"USD",durationMinutes:$mins,category:$cat}
     + (if ($staff|length)>0 then {assignedStaffIds:$staff} else {} end)')
  resp=$(req POST "/api/salon-admin/${SALON_ID}/services" "$body")
  ok || { warn "service '${name}' failed (HTTP $(code)): $resp"; continue; }
  SERVICE_IDS+=("$(jq -r '.id' <<<"$resp")"); SERVICE_NAMES+=("$name")
  echo "  + ${name}"
done

# ── 4. shop — brands & categories ──────────────────────────────────────────────
# Parallel name/id arrays instead of `declare -A` — macOS's built-in bash (3.2, what
# `#!/usr/bin/env bash` actually resolves to there) has no associative arrays.
echo "▶ Creating shop brands & categories…"
BRAND_NAMES=(); BRAND_IDS=()
CAT_NAMES=(); CAT_IDS=()
add_brand() {
  local resp; resp=$(req POST "/api/salon-admin/${SALON_ID}/shop/brands" \
    "$(jq -nc --arg n "$1" --arg d "$2" --arg l "$3" \
      '{name:$n,description:$d,logoUrl:(if $l=="" then null else $l end)}')")
  ok || { warn "brand '$1' failed (HTTP $(code)): $resp"; return; }
  BRAND_NAMES+=("$1"); BRAND_IDS+=("$(jq -r '.id' <<<"$resp")"); echo "  brand + $1"
}
add_cat() {
  local resp; resp=$(req POST "/api/salon-admin/${SALON_ID}/shop/categories" \
    "$(jq -nc --arg n "$1" --arg d "$2" '{name:$n,description:$d,active:true}')")
  ok || { warn "category '$1' failed (HTTP $(code)): $resp"; return; }
  CAT_NAMES+=("$1"); CAT_IDS+=("$(jq -r '.id' <<<"$resp")"); echo "  category + $1"
}
brand_id() { local i; for i in "${!BRAND_NAMES[@]}"; do [[ "${BRAND_NAMES[$i]}" == "$1" ]] && { printf '%s' "${BRAND_IDS[$i]}"; return; }; done; }
cat_id()   { local i; for i in "${!CAT_NAMES[@]}";   do [[ "${CAT_NAMES[$i]}"   == "$1" ]] && { printf '%s' "${CAT_IDS[$i]}";   return; }; done; }

add_brand "Kōkua Botanicals" "Plant-based haircare, made in small batches"  "$(PIC brand-kokua 300 300)"
add_brand "Aveline Studio"   "Salon-professional colour care and styling"    "$(PIC brand-aveline 300 300)"
add_brand "Noble & Vine"     "Grooming — beard, shave and skin"              ""
add_brand "Lume Cosmetics"   "Clean colour cosmetics for face, lips and eyes" ""
add_brand "Petal & Stone"    "Botanical skincare for face and body"           "$(PIC brand-petalstone 300 300)"
add_brand "Vernis Nail Co."  "Long-wear gel polish and nail care"             ""
add_cat "Shampoo & Conditioner" "Wash-day essentials"
add_cat "Styling"               "Creams, sprays, oils and finishing"
add_cat "Treatments"            "Masks, bonders and scalp care"
add_cat "Grooming"              "Beard and shave"
add_cat "Makeup"                "Face, lips and eyes"
add_cat "Skin Care"             "Cleansers, serums and moisturisers"
add_cat "Nail Care"             "Polish, treatments and tools"

# ── 5. shop — products (multi-image, multi-variant) ────────────────────────────
echo "▶ Creating products…"
PRODUCT_IDS=()
mkprod() { # mkprod  <name> <desc> <brandKey|-> <catKey|-> <imgSeedBase> <nImgs> <variantsJson>
  local name="$1" desc="$2" bkey="$3" ckey="$4" seed="$5" n="$6" variants="$7"
  local imgs="[]" i
  for ((i=1;i<=n;i++)); do imgs=$(jq -c --arg u "$(PIC "${seed}-${i}")" '. + [$u]' <<<"$imgs"); done
  local bid="null" cid="null" v
  if [[ "$bkey" != "-" ]]; then v=$(brand_id "$bkey"); [[ -n "$v" ]] && bid="$v"; fi
  if [[ "$ckey" != "-" ]]; then v=$(cat_id "$ckey");   [[ -n "$v" ]] && cid="$v"; fi
  local body
  body=$(jq -nc --arg name "$name" --arg desc "$desc" --argjson bid "$bid" --argjson cid "$cid" \
                --argjson imgs "$imgs" --argjson variants "$variants" \
    '{brandId:$bid,categoryId:$cid,name:$name,description:$desc,images:$imgs,active:true,variants:$variants}')
  local resp; resp=$(req POST "/api/salon-admin/${SALON_ID}/shop/products" "$body")
  ok || { warn "product '$name' failed (HTTP $(code)): $resp"; return; }
  PRODUCT_IDS+=("$(jq -r '.id' <<<"$resp")")
  echo "  + ${name}  (${n} images, $(jq '.variants|length' <<<"$resp") variants)"
}
V() { # V <sku> <label> <price> <compareAt|-> <qty> <reorder> [weightGrams]  -> one variant object
  # No currency: the server prices it in the salon's currency. No weight: the server estimates it
  # from the label ("250 ml" → 280 g); labels without a measurable unit (shades, "1 L refill") need one.
  # `--arg lbl` (not `label`) on purpose: jq 1.6's lexer treats `$label` as the `label $out|...`
  # keyword rather than a variable reference, so `--arg label` + `$label` fails to compile.
  jq -nc --arg sku "$1" --arg lbl "$2" --argjson price "$3" \
         --arg cmp "$4" --argjson qty "$5" --argjson ro "$6" --arg wt "${7:-}" \
    '{id:null,sku:$sku,
      label:(if $lbl=="" then null else $lbl end),
      price:$price,
      compareAtPrice:(if $cmp=="-" then null else ($cmp|tonumber) end),
      weightGrams:(if $wt=="" then null else ($wt|tonumber) end),
      quantityOnHand:$qty,reorderLevel:$ro,active:true}'
}

mkprod "Everyday Gentle Shampoo" "Sulphate-free daily cleanser for all hair types" \
  "Kōkua Botanicals" "Shampoo & Conditioner" "prod-gentle-shampoo" 3 \
  "$(jq -sc '.' <(V KB-SHMP-250 "250 ml" 24 - 60 12) <(V KB-SHMP-500 "500 ml" 40 46 28 8) <(V KB-SHMP-1L "1 L refill" 68 - 12 4 1100))"

mkprod "Hydrating Conditioner" "Slip-rich conditioner with aloe and coconut" \
  "Kōkua Botanicals" "Shampoo & Conditioner" "prod-hydrating-cond" 2 \
  "$(jq -sc '.' <(V KB-COND-250 "250 ml" 26 - 44 10) <(V KB-COND-500 "500 ml" 42 - 20 6))"

mkprod "Clarifying Rinse" "Weekly reset for product build-up" \
  "Kōkua Botanicals" "Treatments" "prod-clarifying" 2 \
  "$(jq -sc '.' <(V KB-CLR-200 "200 ml" 22 - 30 8))"

mkprod "Bond Repair Mask" "At-home bond-building treatment mask" \
  "Aveline Studio" "Treatments" "prod-bond-mask" 4 \
  "$(jq -sc '.' <(V AV-BOND-100 "100 ml" 34 - 25 6) <(V AV-BOND-250 "250 ml" 58 72 9 4))"

mkprod "Scalp Serum" "Lightweight leave-in serum for a balanced scalp" \
  "Aveline Studio" "Treatments" "prod-scalp-serum" 2 \
  "$(jq -sc '.' <(V AV-SCLP-60 "60 ml" 39 - 18 5))"

mkprod "Colour-Lock Shampoo" "Gentle wash that protects salon colour" \
  "Aveline Studio" "Shampoo & Conditioner" "prod-colourlock" 3 \
  "$(jq -sc '.' <(V AV-CLK-250 "250 ml" 28 - 40 10) <(V AV-CLK-500 "500 ml" 46 - 15 6))"

mkprod "Sea Salt Texture Spray" "Matte, tousled texture with a flexible hold" \
  "Aveline Studio" "Styling" "prod-salt-spray" 3 \
  "$(jq -sc '.' <(V AV-SALT-150 "150 ml" 25 - 50 12))"

mkprod "Smoothing Blow-Dry Cream" "Cuts drying time and fights frizz" \
  "Aveline Studio" "Styling" "prod-blowdry-cream" 2 \
  "$(jq -sc '.' <(V AV-BDC-120 "120 ml" 27 - 33 8))"

mkprod "Finishing Hair Oil" "A few drops for shine on mid-lengths and ends" \
  "Kōkua Botanicals" "Styling" "prod-hair-oil" 4 \
  "$(jq -sc '.' <(V KB-OIL-30 "30 ml" 22 - 26 6) <(V KB-OIL-50 "50 ml" 32 - 14 5))"

mkprod "Flexible Hold Hairspray" "Brushable hold, no crunch" \
  "Aveline Studio" "Styling" "prod-hairspray" 2 \
  "$(jq -sc '.' <(V AV-SPRAY-200 "200 ml" 24 - 4 6))"      # low stock

mkprod "Beard Oil — Cedar & Bergamot" "Softens coarse hair and conditions skin" \
  "Noble & Vine" "Grooming" "prod-beard-oil" 3 \
  "$(jq -sc '.' <(V NV-BRD-30 "30 ml" 26 - 22 6) <(V NV-BRD-50 "50 ml" 38 - 11 4))"

mkprod "Beard Balm" "Light styling hold with a natural finish" \
  "Noble & Vine" "Grooming" "prod-beard-balm" 2 \
  "$(jq -sc '.' <(V NV-BLM-60 "60 g" 24 - 17 5))"

mkprod "Pre-Shave Oil" "Cushions the blade for a closer, calmer shave" \
  "Noble & Vine" "Grooming" "prod-preshave" 2 \
  "$(jq -sc '.' <(V NV-PSO-100 "100 ml" 21 - 0 4))"        # out of stock

mkprod "Tinted Lip Balm" "Sheer colour with a balm feel — three shades" \
  "Lume Cosmetics" "Makeup" "prod-lip-balm" 3 \
  "$(jq -sc '.' <(V LM-LIP-ROSE "Rosewood" 19 - 12 4 40) <(V LM-LIP-BERRY "Berry" 19 - 3 4 40) <(V LM-LIP-CLAY "Clay" 19 - 0 4 40))"

mkprod "Cream Blush Stick" "Blendable cream blush for cheeks and lips" \
  "Lume Cosmetics" "Makeup" "prod-cream-blush" 4 \
  "$(jq -sc '.' <(V LM-BLSH-PEACH "Peach" 23 - 20 5 60) <(V LM-BLSH-PLUM "Plum" 23 - 16 5 60))"

mkprod "Rosewater Facial Toner" "Alcohol-free toner that soothes and refreshes" \
  "Petal & Stone" "Skin Care" "prod-rosewater-toner" 2 \
  "$(jq -sc '.' <(V PS-TNR-150 "150 ml" 28 - 34 8) <(V PS-TNR-300 "300 ml" 46 - 12 5))"

mkprod "Vitamin C Brightening Serum" "Lightweight serum that evens tone and adds glow" \
  "Petal & Stone" "Skin Care" "prod-vitc-serum" 3 \
  "$(jq -sc '.' <(V PS-SER-30 "30 ml" 44 54 21 6))"

mkprod "Daily Moisturizer SPF 30" "Non-greasy day cream with broad-spectrum SPF" \
  "Petal & Stone" "Skin Care" "prod-day-moisturizer" 3 \
  "$(jq -sc '.' <(V PS-MST-50 "50 ml" 36 - 27 6) <(V PS-MST-100 "100 ml" 58 - 8 4))"

mkprod "Clay Purifying Mask" "Kaolin clay mask for oily and combination skin" \
  "Petal & Stone" "Skin Care" "prod-clay-mask" 2 \
  "$(jq -sc '.' <(V PS-MSK-75 "75 ml" 32 - 0 6))"          # out of stock

mkprod "Gel Polish Duo Kit" "Base and colour coat with a long-wear gel finish" \
  "Vernis Nail Co." "Nail Care" "prod-gel-polish" 3 \
  "$(jq -sc '.' <(V VN-GEL-CORAL "Coral Reef" 21 - 25 6 50) <(V VN-GEL-BERRY "Berry Wine" 21 - 19 6 50) <(V VN-GEL-NUDE "Bare Nude" 21 - 5 6 50))"

mkprod "Cuticle Oil Pen" "Click-pen applicator with jojoba and vitamin E" \
  "Vernis Nail Co." "Nail Care" "prod-cuticle-oil" 2 \
  "$(jq -sc '.' <(V VN-CUT-10 "10 ml" 14 - 3 6))"          # low stock

# one inactive product — hidden from the storefront, still in admin
_lume_bid="$(brand_id "Lume Cosmetics")"
req POST "/api/salon-admin/${SALON_ID}/shop/products" "$(jq -nc \
  --argjson bid "${_lume_bid:-null}" --arg img "$(PIC prod-discontinued-1)" \
  '{brandId:$bid,categoryId:null,name:"Glitter Gel (discontinued)",description:"End of line — not for sale",
    images:[$img],active:false,
    variants:[{id:null,sku:"LM-GLT-10",label:"10 ml",price:12,currency:"USD",quantityOnHand:0,reorderLevel:0,active:false}]}')" \
  >/dev/null
ok && echo "  + Glitter Gel (inactive)" || warn "inactive product failed (HTTP $(code))"

# ── 5b. a couple of inventory restocks ─────────────────────────────────────────
# Exercises the inventory-update endpoint. Deliberately does NOT touch the
# low-stock (AV-SPRAY-200, LM-LIP-BERRY) or out-of-stock (NV-PSO-100, LM-LIP-CLAY)
# variants — those are left thin on purpose so the storefront/admin show those states.
echo "▶ Restocking a few variants…"
inv=$(req GET "/api/salon-admin/${SALON_ID}/shop/inventory")
if ok; then
  for sku in KB-SHMP-1L KB-COND-500; do
    vid=$(jq -r --arg s "$sku" '.[] | select(.sku==$s) | .variantId' <<<"$inv")
    [[ -n "$vid" && "$vid" != "null" ]] || continue
    req PUT "/api/salon-admin/${SALON_ID}/shop/inventory/${vid}" '{"quantityOnHand":50,"reorderLevel":10}' >/dev/null
    ok && echo "  restocked ${sku} -> 50" || warn "restock ${sku} failed (HTTP $(code))"
  done
fi

# ── 5c. shipping methods ───────────────────────────────────────────────────────
# Created before any order: once a salon has active methods, a shipped order must qualify for one.
# Every order below ships within the US or Canada, or is collected in the salon.
echo "▶ Creating shipping methods…"
# Called as `id=$(add_ship …)`, i.e. in a subshell: it can only hand back the id on stdout, so the
# progress line goes to stderr and nothing is appended to an array here.
add_ship() { # add_ship <json> <summary> -> stdout: the new id (empty on failure)
  local resp; resp=$(req POST "/api/salon-admin/${SALON_ID}/shop/shipping-methods" "$1")
  ok || { warn "shipping method $(jq -r .name <<<"$1") failed (HTTP $(code)): $resp"; return; }
  echo "  + $(jq -r '.name' <<<"$resp") — $2" >&2
  jq -r '.id' <<<"$resp"
}
SHIP_STANDARD=$(add_ship '{"name":"Standard Delivery","description":"Tracked to your door","carrier":"USPS","deliveryType":"HOME","price":6.95,"freeOver":75,"currency":"USD","minDeliveryDays":3,"maxDeliveryDays":5,"sortOrder":0,"countries":["US"]}' "US home, free over \$75")
SHIP_EXPRESS=$(add_ship '{"name":"Express","description":"Next business day when ordered before 2pm","carrier":"UPS","deliveryType":"HOME","price":14.95,"maxWeightGrams":2000,"currency":"USD","minDeliveryDays":1,"maxDeliveryDays":2,"sortOrder":1,"countries":["US"]}' "US, parcels up to 2 kg")
SHIP_PICKUP=$(add_ship '{"name":"Pickup Point","description":"Collect from a nearby parcel locker","carrier":"FedEx","deliveryType":"PICKUP_POINT","price":4.5,"maxItems":5,"currency":"USD","minDeliveryDays":2,"maxDeliveryDays":4,"sortOrder":2,"countries":["US"]}' "US, up to 5 items")
SHIP_BUSINESS=$(add_ship '{"name":"Business Delivery","description":"To an office, weekdays 9–5","carrier":"UPS","deliveryType":"BUSINESS","price":9.95,"minOrderValue":50,"currency":"USD","minDeliveryDays":2,"maxDeliveryDays":3,"sortOrder":3,"countries":["US"]}' "US, orders from \$50")
SHIP_HEAVY=$(add_ship '{"name":"Heavy Parcel","description":"For bulky orders over 2 kg","carrier":"UPS Freight","deliveryType":"HOME","price":24.95,"minWeightGrams":2000,"currency":"USD","minDeliveryDays":4,"maxDeliveryDays":7,"sortOrder":4,"countries":["US","CA"]}' "US & Canada, 2 kg and up")
SHIP_INTL=$(add_ship '{"name":"International","description":"Tracked international post","carrier":"DHL","deliveryType":"HOME","price":19.95,"freeOver":150,"maxOrderValue":500,"currency":"USD","minDeliveryDays":7,"maxDeliveryDays":12,"sortOrder":5,"countries":["CA","GB","AU"]}' "Canada / UK / Australia, orders up to \$500")
add_ship '{"name":"EU Standard","description":"Only for carts priced in euros","carrier":"DHL","deliveryType":"HOME","price":7.5,"currency":"EUR","minDeliveryDays":3,"maxDeliveryDays":6,"sortOrder":6,"countries":["DE","FR","DK"]}' "EUR carts only — never offered here" >/dev/null
add_ship '{"name":"Same-day Courier (paused)","description":"Temporarily unavailable","deliveryType":"HOME","price":19,"currency":"USD","sortOrder":7,"active":false,"countries":["US"]}' "inactive" >/dev/null

# ── 5d. policies on the website (the checkout links the refund & sales policies) ──
echo "▶ Publishing salon policies to the website…"
pol=$(req GET "/api/salon-admin/${SALON_ID}/policies")
if ok; then
  req PUT "/api/salon-admin/${SALON_ID}/policies" "$(jq -c 'map(.website = true | .enabled = true)' <<<"$pol")" >/dev/null
  ok || warn "policy save failed (HTTP $(code))"
  req POST "/api/salon-admin/${SALON_ID}/policies/publish" >/dev/null
  ok && echo "  $(jq -r 'map(.title) | join(", ")' <<<"$pol")" || warn "policy publish failed (HTTP $(code))"
else
  warn "policy editor failed (HTTP $(code))"
fi

# ── 6. customer orders + fulfilment lifecycle ─────────────────────────────────
echo "▶ Placing customer orders…"
inv=$(req GET "/api/salon-admin/${SALON_ID}/shop/inventory")
# sellable = active variant on an active product with stock to spare
SELLABLE=()
while IFS= read -r vid; do [[ -n "$vid" ]] && SELLABLE+=("$vid"); done < <(
  jq -r '.[] | select(.active and .productActive and .quantityOnHand > 3) | .variantId' <<<"$inv"
)
[[ ${#SELLABLE[@]} -ge 4 ]] || warn "few sellable variants (${#SELLABLE[@]}) — orders will be small"

CUSTOMERS=(
  "Riya Kapoor|riya.kapoor@example.com|+1 415 555 0201"
  "Aditya Menon|aditya.menon@example.com|"
  "Grace Oduya|grace.oduya@example.com|+1 415 555 0203"
  "Liam Carter|liam.carter@example.com|+1 415 555 0204"
  "Mei Tanaka|mei.tanaka@example.com|"
  "Owen Frost|owen.frost@example.com|+1 415 555 0206"
  "Zoe Bianchi|zoe.bianchi@example.com|+1 415 555 0207"
  "Hassan Ali|hassan.ali@example.com|+1 415 555 0208"
)
ORDER_IDS=()
n_sell=${#SELLABLE[@]}
oi=0
for row in "${CUSTOMERS[@]}"; do
  [[ $n_sell -gt 0 ]] || { warn "no sellable variants — skipping orders"; break; }
  IFS='|' read -r cname cemail cphone <<<"$row"
  # 1–3 lines, cycling through the sellable pool
  nlines=$(( (oi % 3) + 1 ))
  items='[]'
  for ((k=0;k<nlines;k++)); do
    vid=${SELLABLE[$(( (oi*3 + k) % n_sell ))]}
    qty=$(( (k % 2) + 1 ))
    items=$(jq -c --argjson v "$vid" --argjson q "$qty" '. + [{variantId:$v,quantity:$q}]' <<<"$items")
  done
  # every other order carries a shipping address
  if (( oi % 2 == 0 )); then
    addr=$(jq -nc '{line1:"402 Sea Breeze Apts",line2:"Carter Road",city:"San Francisco",state:"California",country:"United States",zipCode:"94110"}')
  else
    addr='null'
  fi
  pref=$([[ $((oi % 3)) -eq 0 ]] && echo ALL || echo IMPORTANT_ONLY)
  body=$(jq -nc --arg n "$cname" --arg e "$cemail" --arg p "$cphone" \
                --argjson items "$items" --argjson addr "$addr" --arg pref "$pref" \
    '{customerName:$n,customerEmail:$e,
      customerPhone:(if $p=="" then null else $p end),
      shippingAddress:$addr,items:$items,communicationPreference:$pref}')
  resp=$(req POST "/api/salon/${SALON_ID}/shop/orders" "$body")
  if ok; then
    oid=$(jq -r '.id' <<<"$resp"); ORDER_IDS+=("$oid")
    echo "  + order $(jq -r '.orderNumber' <<<"$resp") — ${cname} (${nlines} line/s)"
  else
    warn "order for ${cname} failed (HTTP $(code)): $resp"
  fi
  oi=$((oi+1))
done

# Scenario orders with a chosen shipping method and specific items (by SKU), so each shipping rule
# is exercised: express (≤ 2 kg), heavy (≥ 2 kg), international (Canada), business (≥ $50).
sku_vid() { jq -r --arg s "$1" '.[] | select(.sku==$s) | .variantId' <<<"$inv"; }
place_order() { # place_order NAME EMAIL PHONE ADDR_JSON|null ITEMS_JSON SHIP_METHOD_ID|"" [PREF] -> stdout: order JSON
  local body resp
  body=$(jq -nc --arg n "$1" --arg e "$2" --arg p "$3" --argjson addr "$4" --argjson items "$5" \
                --arg m "$6" --arg pref "${7:-IMPORTANT_ONLY}" \
    '{customerName:$n,customerEmail:$e,customerPhone:(if $p=="" then null else $p end),
      shippingAddress:$addr,items:$items,communicationPreference:$pref,
      shippingMethodId:(if $m=="" then null else ($m|tonumber) end)}')
  resp=$(req POST "/api/salon/${SALON_ID}/shop/orders" "$body")
  ok || { warn "order for $1 failed (HTTP $(code)): $resp"; return; }
  echo "  + order $(jq -r '.orderNumber' <<<"$resp") — $1 · $(jq -r '(.shippingMethodName // "collect in salon") + " " + (.shippingCost|tostring)' <<<"$resp")" >&2
  printf '%s' "$resp"
}
inv=$(req GET "/api/salon-admin/${SALON_ID}/shop/inventory")
US_ADDR='{"line1":"88 Valencia St","line2":"Apt 4","city":"San Francisco","state":"California","country":"United States","zipCode":"94103"}'
OFFICE_ADDR='{"line1":"1 Market St","line2":"Floor 12, Reception","city":"San Francisco","state":"California","country":"United States","zipCode":"94105"}'
CA_ADDR='{"line1":"220 King St W","city":"Toronto","state":"Ontario","country":"Canada","zipCode":"M5H 1K4"}'
item() { jq -nc --arg v "$(sku_vid "$1")" --argjson q "$2" '{variantId:($v|tonumber),quantity:$q}'; }

EXPRESS_ORDER=""; HEAVY_ORDER=""; INTL_ORDER=""; BUSINESS_ORDER=""; RIYA_COLLECT_ORDER=""
resp=$(place_order "Elena Petrova" "elena.petrova@example.com" "+1 415 555 0209" "$US_ADDR" \
  "$(jq -sc '.' <(item AV-BOND-100 1) <(item KB-OIL-30 1))" "$SHIP_EXPRESS" ALL)
[[ -n "$resp" ]] && { EXPRESS_ORDER=$(jq -r .id <<<"$resp"); EXPRESS_LINE=$(jq -r '.lines[0].id' <<<"$resp"); ORDER_IDS+=("$EXPRESS_ORDER"); }
resp=$(place_order "Kenji Watanabe" "kenji.watanabe@example.com" "+1 415 555 0210" "$US_ADDR" \
  "$(jq -sc '.' <(item KB-SHMP-1L 2))" "$SHIP_HEAVY")
[[ -n "$resp" ]] && { HEAVY_ORDER=$(jq -r .id <<<"$resp"); ORDER_IDS+=("$HEAVY_ORDER"); }
resp=$(place_order "James O'Connor" "james.oconnor@example.com" "+1 416 555 0211" "$CA_ADDR" \
  "$(jq -sc '.' <(item PS-SER-30 1) <(item PS-TNR-150 1))" "$SHIP_INTL")
[[ -n "$resp" ]] && { INTL_ORDER=$(jq -r .id <<<"$resp"); ORDER_IDS+=("$INTL_ORDER"); }
resp=$(place_order "Nadia Office Supplies" "orders@nadia-office.example.com" "+1 415 555 0212" "$OFFICE_ADDR" \
  "$(jq -sc '.' <(item AV-CLK-500 2))" "$SHIP_BUSINESS")
[[ -n "$resp" ]] && { BUSINESS_ORDER=$(jq -r .id <<<"$resp"); ORDER_IDS+=("$BUSINESS_ORDER"); }
# Riya's second order, collected in the salon — her account shows one shipped and one collected order.
resp=$(place_order "Riya Kapoor" "riya.kapoor@example.com" "+1 415 555 0201" null \
  "$(jq -sc '.' <(item NV-BLM-60 1))" "")
[[ -n "$resp" ]] && { RIYA_COLLECT_ORDER=$(jq -r .id <<<"$resp"); ORDER_IDS+=("$RIYA_COLLECT_ORDER"); }

echo "▶ Advancing orders through fulfilment…"
O() { req "$1" "/api/salon-admin/${SALON_ID}/shop/orders/$2" "${3:-}" >/dev/null; ok || warn "  $1 orders/$2 -> HTTP $(code)"; }
adv() { O POST "$1/status" "$(jq -nc --arg s "$2" '{status:$s}')"; }
if [[ ${#ORDER_IDS[@]} -ge 6 ]]; then
  # #1 processing, then a refund raised → approved → accepted (accept also mints a credit note)
  adv "${ORDER_IDS[0]}" PROCESSING
  O POST "${ORDER_IDS[0]}/refunds" '{"amount":24.00,"reason":"One item arrived damaged"}'
  O POST "${ORDER_IDS[0]}/refunds/approve"
  O POST "${ORDER_IDS[0]}/refunds/accept"
  # #2 processing + shipped with tracking
  adv "${ORDER_IDS[1]}" PROCESSING
  O POST "${ORDER_IDS[1]}/shipping" '{"carrier":"USPS","trackingNumber":"9400111899560000000001"}'
  # #3 processing → shipped → fulfilled + invoice
  adv "${ORDER_IDS[2]}" PROCESSING
  O POST "${ORDER_IDS[2]}/shipping" '{"carrier":"FedEx","trackingNumber":"7712 3456 7890"}'
  adv "${ORDER_IDS[2]}" FULFILLED
  O POST "${ORDER_IDS[2]}/invoice"
  # #4 internal note + a customer message
  O POST "${ORDER_IDS[3]}/work-note" '{"note":"Customer asked for gift wrap."}'
  O POST "${ORDER_IDS[3]}/notify"    '{"message":"Your order is packed and ships tomorrow."}'
  adv "${ORDER_IDS[3]}" READY_TO_SHIP
  # #5 cancelled
  adv "${ORDER_IDS[4]}" CANCELLED
  # #6 confirmed → ready to ship → on hold (address query) with a work note
  adv "${ORDER_IDS[5]}" CONFIRMED
  adv "${ORDER_IDS[5]}" READY_TO_SHIP
  O POST "${ORDER_IDS[5]}/work-note" '{"note":"Apartment number missing — emailed the customer."}'
  adv "${ORDER_IDS[5]}" ON_HOLD
  echo "  processing ×3, ready to ship ×1, shipped ×2 (+tracking), fulfilled ×1 (+invoice), cancelled ×1, on hold ×1, refund accepted ×1"
fi
if [[ ${#ORDER_IDS[@]} -ge 8 ]]; then
  # #7 a full return: delivered → return requested → approved → item shipped back → received → accepted,
  # then the refund for it is raised, approved and accepted, and the credit note it mints is paid out.
  adv "${ORDER_IDS[6]}" PROCESSING
  O POST "${ORDER_IDS[6]}/shipping" '{"carrier":"USPS","trackingNumber":"9400111899560000000077"}'
  adv "${ORDER_IDS[6]}" DELIVERED
  O POST "${ORDER_IDS[6]}/returns" '{"reason":"Wrong shade — would like to return it"}'
  for st in APPROVED ITEM_SHIPPED RECEIVED INSPECTING ACCEPTED; do
    O POST "${ORDER_IDS[6]}/returns/status" "$(jq -nc --arg s "$st" '{status:$s,notes:("Return " + ($s|ascii_downcase))}')"
  done
  total7=$(req GET "/api/salon-admin/${SALON_ID}/shop/orders/${ORDER_IDS[6]}" | jq -r '.subtotal')
  O POST "${ORDER_IDS[6]}/refunds" "$(jq -nc --argjson a "${total7:-10}" '{amount:$a,reason:"Returned item accepted"}')"
  O POST "${ORDER_IDS[6]}/refunds/approve"
  O POST "${ORDER_IDS[6]}/refunds/accept"
  O POST "${ORDER_IDS[6]}/credit-note/pay"
  # #8 a refund request the salon turns down
  adv "${ORDER_IDS[7]}" DELIVERED
  O POST "${ORDER_IDS[7]}/refunds" '{"amount":15.00,"reason":"Changed my mind"}'
  O POST "${ORDER_IDS[7]}/refunds/reject"
  echo "  return completed (+credit note paid) ×1, refund rejected ×1"
fi
# Scenario orders: express gets a line note and a per-line notification; heavy / international are
# shipped; business is confirmed; Riya's collect-in-salon order stays new for her account.
if [[ -n "$EXPRESS_ORDER" ]]; then
  adv "$EXPRESS_ORDER" PROCESSING
  O POST "${EXPRESS_ORDER}/lines/${EXPRESS_LINE}/notes" '{"note":"Picked from the back-room stock."}'
  O POST "${EXPRESS_ORDER}/lines/${EXPRESS_LINE}/notify" '{"message":"Your Bond Repair Mask is packed."}'
fi
if [[ -n "$HEAVY_ORDER" ]]; then
  adv "$HEAVY_ORDER" PROCESSING
  O POST "${HEAVY_ORDER}/shipping" '{"carrier":"UPS Freight","trackingNumber":"1Z999AA10123456784"}'
fi
if [[ -n "$INTL_ORDER" ]]; then
  adv "$INTL_ORDER" PROCESSING
  O POST "${INTL_ORDER}/shipping" '{"carrier":"DHL","trackingNumber":"JD014600006281384422"}'
  adv "$INTL_ORDER" DELIVERED
fi
[[ -n "$BUSINESS_ORDER" ]] && adv "$BUSINESS_ORDER" CONFIRMED

# ── 7. bookings over the next two weeks ───────────────────────────────────────
echo "▶ Creating bookings…"
BOOK_CUSTOMERS=(
  "Riya Kapoor|riya.kapoor@example.com|+1 415 555 0201"
  "Grace Oduya|grace.oduya@example.com|+1 415 555 0203"
  "Jordan Blake|jordan.blake@example.com|+1 415 555 0301"
  "Priyanka Rao|priyanka.rao@example.com|+1 415 555 0302"
  "Chris Donnelly|chris.donnelly@example.com|+1 415 555 0303"
  "Fatima Noor|fatima.noor@example.com|+1 415 555 0304"
  "Sam Ellison|sam.ellison@example.com|+1 415 555 0305"
  "Beatriz Lima|beatriz.lima@example.com|+1 415 555 0306"
  "Henry Watts|henry.watts@example.com|+1 415 555 0307"
  "Aiko Mori|aiko.mori@example.com|+1 415 555 0308"
  "Devon Pryce|devon.pryce@example.com|+1 415 555 0309"
  "Lucia Ferrari|lucia.ferrari@example.com|+1 415 555 0310"
  "Noah Berger|noah.berger@example.com|+1 415 555 0311"
  "Yara Haddad|yara.haddad@example.com|+1 415 555 0312"
)
BOOKING_IDS=()
[[ ${#SERVICE_IDS[@]} -gt 0 ]] || warn "no services — skipping bookings"
bi=0
for row in "${BOOK_CUSTOMERS[@]}"; do
  [[ ${#SERVICE_IDS[@]} -gt 0 ]] || break
  IFS='|' read -r bname bemail bphone <<<"$row"
  svc=${SERVICE_IDS[$(( bi % ${#SERVICE_IDS[@]} ))]}
  # spread across days 1..14, skip Sundays (salon closed) by nudging forward
  d=$(( (bi % 12) + 2 ))
  date=$(day "$d")
  [[ "$(weekday "$date")" == "7" ]] && date=$(day $((d+1)))
  slots=$(req GET "/api/salon/${SALON_ID}/booking/slots?serviceId=${svc}&date=${date}")
  if ! ok; then warn "slots lookup failed for ${date} (HTTP $(code))"; bi=$((bi+1)); continue; fi
  # pick a free slot — prefer one a few rows in so the day isn't all back-to-back
  read -r start sstaff < <(jq -r '[.[] | select(.booked==false)] | (.[3] // .[0]) | "\(.startTime) \(.staffId)"' <<<"$slots")
  if [[ -z "$start" || "$start" == "null" ]]; then warn "no open slot on ${date} for service ${svc}"; bi=$((bi+1)); continue; fi
  body=$(jq -nc --argjson svc "$svc" --argjson staff "${sstaff:-null}" \
                --arg n "$bname" --arg e "$bemail" --arg p "$bphone" \
                --arg d "$date" --arg t "$start" \
    '{serviceId:$svc,staffId:$staff,
      customerName:$n,customerEmail:$e,customerPhone:$p,
      appointmentDate:$d,startTime:$t,notes:"Seeded booking"}')
  resp=$(req POST "/api/salon/${SALON_ID}/booking" "$body")
  if ok; then
    id=$(jq -r '.id' <<<"$resp"); BOOKING_IDS+=("$id")
    echo "  + ${bname} — ${date} ${start}"
  else
    warn "booking for ${bname} on ${date} failed (HTTP $(code)): $resp"
  fi
  bi=$((bi+1))
done

echo "▶ Updating booking statuses…"
transition() { req POST "/api/salon-admin/${SALON_ID}/booking/$1/$2" >/dev/null; ok || warn "  booking $1 -> $2 : HTTP $(code)"; }
if [[ ${#BOOKING_IDS[@]} -ge 6 ]]; then
  transition "${BOOKING_IDS[0]}" confirm
  transition "${BOOKING_IDS[1]}" confirm
  transition "${BOOKING_IDS[2]}" confirm
  transition "${BOOKING_IDS[2]}" complete
  transition "${BOOKING_IDS[3]}" cancel
  transition "${BOOKING_IDS[4]}" no-show
  echo "  confirmed ×3, completed ×1, cancelled ×1, no-show ×1"
fi

# ── 8. Dashboard cashier sales ───────────────────────────────────────────────
echo "▶ Recording Dashboard cashier sales…"
POS_SALE_IDS=()
record_sale() { # record_sale CUSTOMER PAYMENT ITEMS_JSON
  local customer="$1" payment="$2" items="$3" resp
  resp=$(req POST "/api/salon-admin/${SALON_ID}/dashboard/sales" \
    "$(jq -nc --arg customer "$customer" --arg payment "$payment" --argjson items "$items" \
      '{customerName:$customer,paymentMethod:$payment,items:$items}')")
  if ok; then
    POS_SALE_IDS+=("$(jq -r '.id' <<<"$resp")")
    echo "  + $(jq -r '.saleNumber' <<<"$resp") — ${customer} · ${payment} · $(jq -r '.currency + " " + (.total|tostring)' <<<"$resp")"
  else
    warn "cashier sale for ${customer} failed (HTTP $(code)): $resp"
  fi
}

if [[ ${#SERVICE_IDS[@]} -gt 0 ]]; then
  # Service-only walk-in paid with cash.
  sale_items=$(jq -nc --argjson service "${SERVICE_IDS[0]}" \
    '[{sourceType:"SERVICE",sourceId:$service,quantity:1}]')
  record_sale "Walk-in customer" CASH "$sale_items"

  # A second service sale gives the recent-sales list another payment method. (CARD needs Stripe
  # now — the plain sales endpoint refuses it — so this one is OTHER.)
  service_index=$(( ${#SERVICE_IDS[@]} > 4 ? 4 : 0 ))
  sale_items=$(jq -nc --argjson service "${SERVICE_IDS[$service_index]}" \
    '[{sourceType:"SERVICE",sourceId:$service,quantity:1}]')
  record_sale "Maya Thompson" OTHER "$sale_items"
fi

POS_PRODUCT_IDS=()
cashier_items=$(req GET "/api/salon-admin/${SALON_ID}/dashboard/cashier/items")
if ok; then
  while IFS= read -r vid; do [[ -n "$vid" ]] && POS_PRODUCT_IDS+=("$vid"); done < <(
    jq -r '.[] | select(.sourceType=="PRODUCT" and .availableQuantity >= 3) | .sourceId' <<<"$cashier_items"
  )
else
  warn "Dashboard cashier catalogue failed (HTTP $(code)): $cashier_items"
fi

if [[ ${#POS_PRODUCT_IDS[@]} -gt 0 ]]; then
  # Product-only counter purchase. Stock is decremented by the Dashboard API.
  sale_items=$(jq -nc --argjson product "${POS_PRODUCT_IDS[0]}" \
    '[{sourceType:"PRODUCT",sourceId:$product,quantity:1}]')
  record_sale "Ethan Cole" CASH "$sale_items"

  # Mixed service + retail sale mirrors a typical appointment checkout.
  if [[ ${#SERVICE_IDS[@]} -gt 1 ]]; then
    product_index=$(( ${#POS_PRODUCT_IDS[@]} > 2 ? 2 : 0 ))
    sale_items=$(jq -nc --argjson service "${SERVICE_IDS[1]}" --argjson product "${POS_PRODUCT_IDS[$product_index]}" \
      '[{sourceType:"SERVICE",sourceId:$service,quantity:1},{sourceType:"PRODUCT",sourceId:$product,quantity:2}]')
    record_sale "Olivia Chen" OTHER "$sale_items"
  fi
fi

# ── 8b. memberships ────────────────────────────────────────────────────────────
# Plans in every state, and members sold at the desk. Cash / other activate on the spot, with no
# Stripe needed; online card sign-ups (PENDING_PAYMENT → ACTIVE / INCOMPLETE) need a connected Stripe account.
echo "▶ Creating membership plans…"
M="/api/salon-admin/${SALON_ID}/membership"
svc_id() { local i; for i in "${!SERVICE_NAMES[@]}"; do [[ "${SERVICE_NAMES[$i]}" == "$1" ]] && { printf '%s' "${SERVICE_IDS[$i]}"; return; }; done; }
add_plan() { # add_plan <json> -> stdout: plan id
  local resp; resp=$(req POST "${M}/plans" "$1")
  ok || { warn "plan $(jq -r .name <<<"$1") failed (HTTP $(code)): $resp"; return; }
  echo "  + $(jq -r '.name + " · " + .status + " · " + (.price|tostring) + " " + .currency + " / " + .billingInterval' <<<"$resp")" >&2
  jq -r '.id' <<<"$resp"
}
included() { # included "<service name>:<qty>" ... -> includedServices JSON
  local spec out='[]' name qty id
  for spec in "$@"; do
    name="${spec%:*}"; qty="${spec##*:}"; id=$(svc_id "$name")
    [[ -n "$id" ]] && out=$(jq -c --argjson s "$id" --argjson q "$qty" '. + [{serviceId:$s,quantityPerCycle:$q}]' <<<"$out")
  done
  printf '%s' "$out"
}
PLAN_MONTHLY=$(add_plan "$(jq -nc --argjson inc "$(included "Blow-Dry & Style:1")" '{
  name:"Glow Monthly",description:"A monthly blow-dry plus member prices on everything else.",
  price:49,currency:"USD",billingInterval:"MONTHLY",signupFee:10,serviceDiscountPercent:10,productDiscountPercent:15,
  highlighted:true,status:"ACTIVE",perks:["Priority booking","Free fringe trims","Birthday treat"],includedServices:$inc}')")
PLAN_QUARTERLY=$(add_plan "$(jq -nc --argjson inc "$(included "Deep Conditioning Treatment:1" "Blow-Dry & Style:2")" '{
  name:"Glow Quarterly",description:"Three months of care, paid once a quarter.",
  price:135,currency:"USD",billingInterval:"QUARTERLY",serviceDiscountPercent:10,productDiscountPercent:10,
  status:"ACTIVE",perks:["Priority booking"],includedServices:$inc}')")
PLAN_VIP=$(add_plan "$(jq -nc --argjson inc "$(included "Classic Haircut:4" "Deep Conditioning Treatment:4")" '{
  name:"VIP Yearly",description:"Our top tier — limited places.",
  price:499,currency:"USD",billingInterval:"YEARLY",signupFee:25,serviceDiscountPercent:20,productDiscountPercent:20,
  maxMembers:5,status:"ACTIVE",perks:["Complimentary drinks","Late-night appointments","Guest pass twice a year"],includedServices:$inc}')")
PLAN_FOUNDERS=$(add_plan '{"name":"Founders Club","description":"One place only — now taken.","price":39,"currency":"USD","billingInterval":"MONTHLY","serviceDiscountPercent":25,"maxMembers":1,"status":"ACTIVE","perks":["Founding member wall"],"includedServices":[]}')
add_plan '{"name":"Student Saver","description":"Not launched yet.","price":25,"currency":"USD","billingInterval":"MONTHLY","serviceDiscountPercent":15,"status":"DRAFT","perks":["Valid student ID required"],"includedServices":[]}' >/dev/null
PLAN_SUMMER=$(add_plan '{"name":"Summer Pass 2025","description":"Last summer'"'"'s seasonal pass.","price":89,"currency":"USD","billingInterval":"QUARTERLY","status":"ACTIVE","perks":["Two blow-dries a month"],"includedServices":[]}')
# A plan nobody holds is retired by archiving it (a plan with members can only ever be archived).
if [[ -n "$PLAN_SUMMER" ]]; then
  plan=$(req GET "${M}/plans/${PLAN_SUMMER}")
  req PUT "${M}/plans/${PLAN_SUMMER}" "$(jq -c '.status = "ARCHIVED"' <<<"$plan")" >/dev/null
  ok && echo "  ~ Summer Pass 2025 → ARCHIVED" || warn "archive Summer Pass failed (HTTP $(code))"
fi

echo "▶ Selling memberships at the desk…"
MEMBER_IDS=()
sell() { # sell PLAN_ID NAME EMAIL PHONE METHOD -> sets SOLD to the subscription id (empty on failure)
  SOLD=""
  [[ -n "$1" ]] || return
  local resp; resp=$(req POST "${M}/desk-sales" "$(jq -nc --argjson p "$1" --arg n "$2" --arg e "$3" --arg ph "$4" --arg m "$5" \
    '{planId:$p,customerName:$n,customerEmail:$e,customerPhone:(if $ph=="" then null else $ph end),paymentMethod:$m}')")
  ok || { warn "desk sale for $2 failed (HTTP $(code)): $resp"; return; }
  SOLD=$(jq -r '.subscriptionId' <<<"$resp"); MEMBER_IDS+=("$SOLD")
  echo "  + $2 — plan ${1} · $5 (subscription ${SOLD})"
}
sub_detail() { req GET "${M}/subscriptions/$1"; }

# Riya: active monthly member — with her booking and orders, the customer account shows every tab.
sell "$PLAN_MONTHLY" "Riya Kapoor" "riya.kapoor@example.com" "+1 415 555 0201" CASH
[[ -n "$SOLD" ]] && req POST "${M}/subscriptions/${SOLD}/send-renewal-link" >/dev/null \
  && { ok && echo "    renewal link emailed" || warn "    renewal link: HTTP $(code)"; }
# Jordan: VIP yearly paid another way, with a desk note.
sell "$PLAN_VIP" "Jordan Blake" "jordan.blake@example.com" "+1 415 555 0301" OTHER
[[ -n "$SOLD" ]] && req POST "${M}/subscriptions/${SOLD}/notes" '{"note":"Paid by bank transfer, ref JB-2291."}' >/dev/null
# Grace: quarterly, cancelling at the end of the paid period.
sell "$PLAN_QUARTERLY" "Grace Oduya" "grace.oduya@example.com" "+1 415 555 0203" CASH
[[ -n "$SOLD" ]] && { req POST "${M}/subscriptions/${SOLD}/cancel" '{"atPeriodEnd":true,"reason":"Moving away in the spring"}' >/dev/null
  ok && echo "    cancels at period end" || warn "    cancel at period end: HTTP $(code)"; }
# Mei: the founders plan's only place — the plan now shows as full.
sell "$PLAN_FOUNDERS" "Mei Tanaka" "mei.tanaka@example.com" "" CASH
# Hassan: monthly, cancelled straight away and the sign-up partly refunded.
sell "$PLAN_MONTHLY" "Hassan Ali" "hassan.ali@example.com" "+1 415 555 0208" CASH
if [[ -n "$SOLD" ]]; then
  pay=$(sub_detail "$SOLD" | jq -r '.payments[0].id')
  req POST "${M}/subscriptions/${SOLD}/payments/${pay}/refund" '{"amount":20,"reason":"Goodwill — cancelled in the first week"}' >/dev/null
  ok && echo "    \$20 refunded" || warn "    refund: HTTP $(code)"
  req POST "${M}/subscriptions/${SOLD}/cancel" '{"atPeriodEnd":false,"reason":"Customer asked to stop"}' >/dev/null
  ok && echo "    cancelled now" || warn "    cancel now: HTTP $(code)"
fi
# Owen: VIP; a cancellation scheduled then taken back, and a typo in his email corrected.
sell "$PLAN_VIP" "Owen Frost" "owen.frost@exmaple.com" "+1 415 555 0206" CASH
if [[ -n "$SOLD" ]]; then
  req POST "${M}/subscriptions/${SOLD}/cancel" '{"atPeriodEnd":true,"reason":"Thinking it over"}' >/dev/null
  req POST "${M}/subscriptions/${SOLD}/resume" >/dev/null
  ok && echo "    cancellation resumed" || warn "    resume: HTTP $(code)"
  req PATCH "${M}/subscriptions/${SOLD}/contact" '{"customerName":"Owen Frost","customerEmail":"owen.frost@example.com","customerPhone":"+1 415 555 0206"}' >/dev/null
  ok && echo "    email corrected" || warn "    contact update: HTTP $(code)"
fi
# The founders plan is full: a second sale is refused.
req POST "${M}/desk-sales" "$(jq -nc --argjson p "${PLAN_FOUNDERS:-0}" '{planId:$p,customerName:"Late Comer",customerEmail:"late.comer@example.com",paymentMethod:"CASH"}')" >/dev/null
[[ "$(code)" == "409" ]] && echo "  ✓ Founders Club is full (second sale refused with 409)" || warn "expected 409 for a full plan, got HTTP $(code)"

# ── 9. closures + holiday ────────────────────────────────────────────────────
echo "▶ Adding closures & a holiday…"
req POST "/api/salon-admin/${SALON_ID}/closures" \
  "$(jq -nc --arg s "$(day 20)" --arg e "$(day 22)" '{startDate:$s,endDate:$e,reason:"Team offsite"}')" >/dev/null
ok && echo "  closure: $(day 20) → $(day 22)" || warn "closure failed (HTTP $(code))"
req POST "/api/salon-admin/${SALON_ID}/closures" \
  "$(jq -nc --arg s "$(day 45)" --arg e "$(day 45)" '{startDate:$s,endDate:$e,reason:"Deep clean"}')" >/dev/null
req POST "/api/salon-admin/${SALON_ID}/holidays" '{"name":"New Year Day","month":1,"day":1}' >/dev/null
ok && echo "  holiday: New Year Day (recurring)" || warn "holiday failed (HTTP $(code))"

# ── 9b. customer list + self-service rules ──────────────────────────────────────
# The list is filled by event listeners (a booking / order / membership adds its customer), which run
# asynchronously after commit — so wait for the last of them before editing.
echo "▶ Preparing the customer list…"
C="/api/salon-admin/${SALON_ID}/customers"
# Wait until the list stops growing (same count on two checks a second apart).
prev=-1; seen=0
for _ in $(seq 1 30); do
  seen=$(req GET "${C}?size=1" | jq -r '.totalElements // 0' 2>/dev/null)
  [[ "${seen:-0}" -gt 0 && "$seen" == "$prev" ]] && break
  prev=$seen; sleep 1
done
[[ "${seen:-0}" -gt 0 ]] || warn "customer list is still empty — notes below may be skipped"

# Owner notes on customers the events created. PUT replaces name/phone/notes, so keep the current name and phone.
annotate() { # annotate EMAIL NOTES
  local row id name phone
  row=$(req GET "${C}?q=$1" | jq -c '.content[0] // empty')
  [[ -n "$row" ]] || { warn "  no customer $1 yet"; return; }
  id=$(jq -r '.id' <<<"$row"); name=$(jq -r '.name' <<<"$row"); phone=$(jq -r '.phone // ""' <<<"$row")
  req PUT "${C}/${id}" "$(jq -nc --arg n "$name" --arg p "$phone" --arg t "$2" '{name:$n,phone:$p,notes:$t}')" >/dev/null
  ok && echo "  note: ${name}" || warn "  note for $1 failed (HTTP $(code))"
}
annotate riya.kapoor@example.com   "Regular — prefers Saturday mornings. Sensitive scalp: no strong colour developer. Founding member."
annotate grace.oduya@example.com   "Books for her mother too. Pays at the desk, always cash."
annotate jordan.blake@example.com  "Vegan products only. Ask before using any wax."
annotate fatima.noor@example.com   "Allergic to ammonia-based dyes (patch test done)."
annotate henry.watts@example.com   "Sends the same photo every visit — keep the reference on the booking notes."

# A walk-in who never booked online: no bookings, orders or memberships, so the owner can erase her straight away.
req POST "${C}" '{"name":"Wendy Walk-in","email":"wendy.walkin@example.com","phone":"+1 415 555 0399","notes":"Walked in, left her number. Call about the spring promo."}' >/dev/null
ok && echo "  + Wendy Walk-in (no history — erasable)" || warn "walk-in customer failed (HTTP $(code))"

# Rules for customers changing their own appointments (the defaults are 24 h / 24 h; this makes them differ).
req PUT "/api/salon-admin/${SALON_ID}/customer-self-service" \
  '{"allowCancel":true,"cancelNoticeHours":12,"allowReschedule":true,"rescheduleNoticeHours":24}' >/dev/null
ok && echo "  self-service: cancel up to 12 h, reschedule up to 24 h before" || warn "self-service policy failed (HTTP $(code))"

# Extra upcoming bookings for Riya well outside the notice windows, so /account offers Cancel + Reschedule.
RIYA_EXTRA=0
for offset in 9 12; do
  [[ ${#SERVICE_IDS[@]} -gt 0 ]] || break
  date=$(day "$offset"); [[ "$(weekday "$date")" == "7" ]] && date=$(day $((offset+1)))
  svc=${SERVICE_IDS[$(( offset % ${#SERVICE_IDS[@]} ))]}
  slots=$(req GET "/api/salon/${SALON_ID}/booking/slots?serviceId=${svc}&date=${date}")
  read -r start sstaff < <(jq -r '[.[] | select(.booked==false)] | (.[2] // .[0]) | "\(.startTime) \(.staffId)"' <<<"$slots")
  if [[ -z "$start" || "$start" == "null" ]]; then warn "no open slot on ${date} for Riya"; continue; fi
  resp=$(req POST "/api/salon/${SALON_ID}/booking" "$(jq -nc --argjson svc "$svc" --argjson staff "${sstaff:-null}" --arg d "$date" --arg t "$start" \
    '{serviceId:$svc,staffId:$staff,customerName:"Riya Kapoor",customerEmail:"riya.kapoor@example.com",customerPhone:"+1 415 555 0201",appointmentDate:$d,startTime:$t,notes:"Seeded — for cancel / reschedule from the account"}')")
  if ok; then
    transition "$(jq -r '.id' <<<"$resp")" confirm
    BOOKING_IDS+=("$(jq -r '.id' <<<"$resp")"); RIYA_EXTRA=$((RIYA_EXTRA+1))
    echo "  + Riya Kapoor — ${date} ${start} (self-service cancel / reschedule)"
  else
    warn "extra booking for Riya on ${date} failed (HTTP $(code))"
  fi
done
CUSTOMER_COUNT=$(req GET "${C}?size=1" | jq -r '.totalElements // "?"' 2>/dev/null)

# ── summary ─────────────────────────────────────────────────────────────────────
cat <<SUMMARY

────────────────────────────────────────────────────────────────────
✔ Seed complete

  Salon .............. ${SALON_NAME}
  salonId ............ ${SALON_ID}
  handler ............ ${HANDLER}
  owner email ........ ${OWNER_EMAIL}

  Staff .............. ${#STAFF_IDS[@]} (each with avatar + gallery + schedule)
  Services .......... ${#SERVICE_IDS[@]}
  Brands ............ ${#BRAND_NAMES[@]}
  Categories ........ ${#CAT_NAMES[@]}
  Products .......... ${#PRODUCT_IDS[@]} (+ 1 inactive)
  Orders ............ ${#ORDER_IDS[@]}
  Bookings .......... ${#BOOKING_IDS[@]}
  Cashier sales ..... ${#POS_SALE_IDS[@]}
  Shipping methods .. $(req GET "/api/salon-admin/${SALON_ID}/shop/shipping-methods" | jq 'length' 2>/dev/null)
  Membership plans .. $(req GET "/api/salon-admin/${SALON_ID}/membership/plans" | jq 'length' 2>/dev/null)
  Members ........... ${#MEMBER_IDS[@]}
  Customers ......... ${CUSTOMER_COUNT} (admin → Customers; Wendy Walk-in is erasable, Riya is not)

  Customer account .. sign in as riya.kapoor@example.com (booking + orders + membership);
                      without Mailjet the 6-digit code is printed in the backend log.
                      Her upcoming appointments offer Cancel + Reschedule (${RIYA_EXTRA} extra seeded 9–12 days out)

  Public website ..... http://localhost:5174/?slug=${HANDLER}
  Shop ............... http://localhost:5174/shop?slug=${HANDLER}
  Membership ......... http://localhost:5174/membership?slug=${HANDLER}
  My account ......... http://localhost:5174/account?slug=${HANDLER}
  Admin panel ....... http://localhost:5173/${SALON_ID}
  Dashboard ......... http://localhost:5179/${SALON_ID}
  API ............... ${BASE_URL}/api/salon/${SALON_ID}
────────────────────────────────────────────────────────────────────
SUMMARY
