### Migration from Azure to Mix Infra

# 1. open PG firewall to this host + back up
terraform apply -var 'postgres_client_ips={"here":"'"$(curl -s ifconfig.me)"'"}'
PGPW=$(terraform output -raw database_password)
docker run --rm -e PGPASSWORD="$PGPW" postgres:17-alpine pg_dump \
-h salon-saas-mix-psql.postgres.database.azure.com -U postgres -d salon \
-Fc --no-owner --no-privileges > salon-$(date +%F).dump
docker run --rm -v "$PWD:/b" postgres:17-alpine \
pg_restore --list /b/salon-$(date +%F).dump | head   # sanity-check the dump

# 2. destroy current mix, then old azure env
terraform destroy
cd ../../../azure/environments/dev && terraform init -reconfigure && terraform destroy
cd ../../mix/environments/mix
git stash pop                                 # new code

# 3. build new mix (new RG multi-tenant-salon-mix, Cloudflare zone, fresh Postgres)
terraform init -reconfigure
terraform apply -var bind_custom_domains=false

# 4. restore DB into the fresh server
terraform apply -var 'postgres_client_ips={"here":"'"$(curl -s ifconfig.me)"'"}'
PGPW=$(terraform output -raw database_password)
docker run --rm -i -v "$PWD:/b" -e PGPASSWORD="$PGPW" postgres:17-alpine pg_restore \
-h salon-saas-mix-psql.postgres.database.azure.com -U postgres -d salon \
--no-owner --no-privileges --clean --if-exists /b/salon-$(date +%F).dump
terraform apply -var 'postgres_client_ips={}'

# 5. YOU: terraform output name_servers  → set at registrar → wait dns_zone_status=active
# 6. terraform apply -var bind_custom_domains=true   → verify HTTPS + test email
