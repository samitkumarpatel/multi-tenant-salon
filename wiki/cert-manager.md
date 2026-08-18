# cert-manager

cert-manager is installed via `helm/cert-manager/cert-manager.yaml` and manages TLS certificates for `api.salonsaas.org` and `auth.salonsaas.org` using Let's Encrypt ACME HTTP01 challenges.

## Files

| File | Purpose |
|------|---------|
| `helm/cert-manager/cert-manager.yaml` | Helm install manifest for cert-manager itself |
| `helm/cert-manager/letsencrypt-staging.yaml` | `ClusterIssuer` — Let's Encrypt staging (untrusted, no rate limits) |
| `helm/cert-manager/letsencrypt-prod.yaml` | `ClusterIssuer` — Let's Encrypt production (browser-trusted) |
| `helm/cert-manager/certificate-staging.yaml` | `Certificate` for staging — produces secret `salonsaas.org-staging` |
| `helm/cert-manager/certificate-prod.yaml` | `Certificate` for production — produces secret `salonsaas.org-prod` |

## How HTTP01 challenge works

When a `Certificate` is created, cert-manager:

1. Registers/reuses an ACME account with the `ClusterIssuer`
2. Creates a temporary `Challenge` resource
3. Spins up a solver pod and a temporary `Ingress` to serve `/.well-known/acme-challenge/<token>`
4. Let's Encrypt hits that URL to verify domain ownership
5. On success, cert-manager deletes the challenge resources and writes the TLS cert into the named Kubernetes `Secret`

The whole process typically completes in under a minute. The temporary Ingress and pod are cleaned up immediately — you will not see them unless you watch in real time.

## Staging vs Production

| | Staging | Production |
|---|---|---|
| CA | Fake LE Root X1 (untrusted) | ISRG Root X1 (browser-trusted) |
| Browser | Shows security warning | No warning |
| Rate limits | None | [Strict](https://letsencrypt.org/docs/rate-limits/) |
| Use for | Validating the pipeline | Real traffic |
| Secret name | `salonsaas.org-staging` | `salonsaas.org-prod` |

Always test with staging first, then switch to production once the pipeline is verified.

## Applying

```bash
# Install cert-manager
kubectl apply -f helm/cert-manager/cert-manager.yaml

# Wait for cert-manager pods to be ready
kubectl -n cert-manager rollout status deployment/cert-manager

# Apply the issuer and certificate (staging)
kubectl apply -f helm/cert-manager/letsencrypt-staging.yaml
kubectl apply -f helm/cert-manager/certificate-staging.yaml

# For production
kubectl apply -f helm/cert-manager/letsencrypt-prod.yaml
kubectl apply -f helm/cert-manager/certificate-prod.yaml
```

## Debugging

### Check ClusterIssuer status

```bash
kubectl describe clusterissuer letsencrypt-staging
kubectl describe clusterissuer letsencrypt-prod
```

Look for `Status.Conditions` — `Ready: True` means the ACME account is registered and working.

### Check Certificate status

```bash
kubectl get certificate
kubectl describe certificate salonsaas.org-staging
kubectl describe certificate salonsaas.org
```

Key fields in `Status`:
- `Ready: True` — cert is issued and stored in the secret
- `Not After` — expiry date
- `Renewal Time` — when cert-manager will auto-renew (typically 30 days before expiry)

### Check CertificateRequest

```bash
kubectl get certificaterequest
kubectl describe certificaterequest <name>
```

### Watch the HTTP01 challenge in real time

The challenge Ingress is ephemeral — watch these right after applying a `Certificate`:

```bash
# Watch challenge resources
kubectl get challenges -w

# Watch for the temporary Ingress cert-manager creates
kubectl get ingress -w

# Watch cert-manager events filtered to issuance
kubectl get events --field-selector reason=Issuing -w

# Full event stream for a certificate
kubectl describe certificate salonsaas.org-staging | grep -A 20 Events
```

### Check the issued secret

```bash
# Confirm the secret exists
kubectl get secret salonsaas.org-staging

# Inspect cert metadata (expiry, SANs)
kubectl get secret salonsaas.org-staging -o jsonpath='{.data.tls\.crt}' \
  | base64 -d | openssl x509 -noout -text | grep -E 'DNS:|Not After'
```

### Check cert-manager logs

```bash
# Main controller
kubectl -n cert-manager logs -l app=cert-manager --tail=100

# ACME challenge solver
kubectl -n cert-manager logs -l app=cert-manager-controller --tail=100
```

### Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `ClusterIssuer` not `Ready` | ACME account registration failed — network or wrong server URL | Check cert-manager logs |
| Challenge Ingress ignored by nginx | Solver used `class: nginx` instead of `ingressClassName: nginx` | Use `ingressClassName` in the `ClusterIssuer` solver |
| Certificate `Ready: False` with timeout | Let's Encrypt couldn't reach the challenge URL | Verify the nginx Ingress is publicly reachable on port 80 |
| Browser shows untrusted cert | Using staging issuer | Expected — switch to `letsencrypt-prod` for trusted certs |
| `Secret not found` in Ingress | `secretName` in Ingress doesn't match `Certificate.spec.secretName` | Align the names |

## Related

- [Kubernetes access](./k8s.md)
- [Backend deployment](./backend-deployment.md)
- cert-manager docs: https://cert-manager.io/docs/
- Let's Encrypt rate limits: https://letsencrypt.org/docs/rate-limits/
