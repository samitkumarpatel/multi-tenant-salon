# Test Data — Saloons

Dummy saloons for local development against `http://localhost:8080`.

---

## Example 1 — Luxe Hair Studio, New York

**curl**
```bash
curl -s -X POST localhost:8080/api/saloons \
  -H 'Content-Type: application/json' \
  -d '{"name":"Luxe Hair Studio","ownerName":"Sophia Bennett","ownerEmail":"sophia@luxehair.com","ownerPhone":"+1 212 555 0101","location":{"address":"142 W 57th St","city":"New York","state":"NY","country":"USA","zipCode":"10019"},"contact":{"phone":"+1 212 555 0100","email":"info@luxehair.com","website":"www.luxehair.com"},"features":["BOOKING","STATIC_WEBSITE"],"operatingHours":[{"day":"MONDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"10:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloons \
  name="Luxe Hair Studio" \
  ownerName="Sophia Bennett" ownerEmail="sophia@luxehair.com" ownerPhone="+1 212 555 0101" \
  location:='{"address":"142 W 57th St","city":"New York","state":"NY","country":"USA","zipCode":"10019"}' \
  contact:='{"phone":"+1 212 555 0100","email":"info@luxehair.com","website":"www.luxehair.com"}' \
  features:='["BOOKING","STATIC_WEBSITE"]' \
  operatingHours:='[{"day":"MONDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"10:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]'
```

---

## Example 2 — The Bearded Gentleman, London

**curl**
```bash
curl -s -X POST localhost:8080/api/saloons \
  -H 'Content-Type: application/json' \
  -d '{"name":"The Bearded Gentleman","ownerName":"James Hartley","ownerEmail":"james@beardedgent.co.uk","ownerPhone":"+44 20 7946 0301","location":{"address":"34 Carnaby St","city":"London","state":"England","country":"UK","zipCode":"W1F 7DR"},"contact":{"phone":"+44 20 7946 0300","email":"hello@beardedgent.co.uk","website":"www.beardedgent.co.uk"},"features":["BOOKING","MEMBERSHIP","LOYALTY_PROGRAM"],"operatingHours":[{"day":"MONDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"TUESDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"WEDNESDAY","openTime":"08:00","closeTime":"18:00","closed":false},{"day":"THURSDAY","openTime":"08:00","closeTime":"20:00","closed":false},{"day":"FRIDAY","openTime":"08:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloons \
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
curl -s -X POST localhost:8080/api/saloons \
  -H 'Content-Type: application/json' \
  -d '{"name":"Glam & Go","ownerName":"Priya Sharma","ownerEmail":"priya@glamandgo.in","ownerPhone":"+91 98201 55678","location":{"address":"Shop 12, Linking Road","city":"Mumbai","state":"Maharashtra","country":"India","zipCode":"400050"},"contact":{"phone":"+91 98201 55678","email":"hello@glamandgo.in","website":"www.glamandgo.in"},"features":["BOOKING","WEBSHOP","ANALYTICS"],"operatingHours":[{"day":"MONDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"TUESDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"WEDNESDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"THURSDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"FRIDAY","openTime":"10:00","closeTime":"21:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"21:00","closed":false},{"day":"SUNDAY","openTime":"11:00","closeTime":"18:00","closed":false}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloons \
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
curl -s -X POST localhost:8080/api/saloons \
  -H 'Content-Type: application/json' \
  -d '{"name":"Scissors & Soul","ownerName":"Erik Müller","ownerEmail":"erik@scissorsandsoul.de","ownerPhone":"+49 30 12345678","location":{"address":"Oranienburger Str. 27","city":"Berlin","state":"Berlin","country":"Germany","zipCode":"10117"},"contact":{"phone":"+49 30 12345678","email":"info@scissorsandsoul.de"},"features":[],"operatingHours":[{"day":"MONDAY","openTime":"00:00","closeTime":"00:00","closed":true},{"day":"TUESDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"WEDNESDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"THURSDAY","openTime":"10:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"10:00","closeTime":"20:00","closed":false},{"day":"SATURDAY","openTime":"09:00","closeTime":"18:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloons \
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
curl -s -X POST localhost:8080/api/saloons \
  -H 'Content-Type: application/json' \
  -d '{"name":"Curl Up & Dye","ownerName":"Olivia Chen","ownerEmail":"olivia@curlupdye.com.au","ownerPhone":"+61 2 9876 5432","location":{"address":"88 Oxford St","city":"Sydney","state":"NSW","country":"Australia","zipCode":"2010"},"contact":{"phone":"+61 2 9876 5432","email":"hello@curlupdye.com.au","website":"www.curlupdye.com.au"},"features":["BOOKING","ANALYTICS","LOYALTY_PROGRAM","MEMBERSHIP"],"operatingHours":[{"day":"MONDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"SATURDAY","openTime":"08:00","closeTime":"17:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]}'
```

**HTTPie**
```bash
http POST localhost:8080/api/saloons \
  name="Curl Up & Dye" \
  ownerName="Olivia Chen" ownerEmail="olivia@curlupdye.com.au" ownerPhone="+61 2 9876 5432" \
  location:='{"address":"88 Oxford St","city":"Sydney","state":"NSW","country":"Australia","zipCode":"2010"}' \
  contact:='{"phone":"+61 2 9876 5432","email":"hello@curlupdye.com.au","website":"www.curlupdye.com.au"}' \
  features:='["BOOKING","ANALYTICS","LOYALTY_PROGRAM","MEMBERSHIP"]' \
  operatingHours:='[{"day":"MONDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"TUESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"WEDNESDAY","openTime":"09:00","closeTime":"17:00","closed":false},{"day":"THURSDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"FRIDAY","openTime":"09:00","closeTime":"19:00","closed":false},{"day":"SATURDAY","openTime":"08:00","closeTime":"17:00","closed":false},{"day":"SUNDAY","openTime":"00:00","closeTime":"00:00","closed":true}]'
```
