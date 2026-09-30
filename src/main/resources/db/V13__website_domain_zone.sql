-- DNS zone (e.g. mysalon.dk) that holds a customer hostname, discovered at connect time from the SOA
-- authority. Used to show zone-relative record names ("www", "_salonsaas-verification.www") because many
-- DNS providers (Azure DNS, GoDaddy, ...) append the zone to whatever is typed in the Name field.
ALTER TABLE website_domain ADD COLUMN IF NOT EXISTS dns_zone VARCHAR(253);
