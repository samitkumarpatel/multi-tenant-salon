# nginx Ingress Controller

Static manifest for the nginx ingress controller on the AKS cluster.
One shared Azure Load Balancer IP routes traffic to all backend services by hostname.

## Before applying

Replace `<NGINX_INGRESS_IP>` in `nginx-ingress.yaml` with the static IP provisioned by Terraform:

```bash
INGRESS_IP=$(terraform -chdir=infrastructure/azure/environments/dev output -raw nginx_ingress_ip)
sed "s/<NGINX_INGRESS_IP>/$INGRESS_IP/" helm/nginx-ingress/nginx-ingress.yaml | kubectl apply -f -
```

Or edit the file directly and apply:

```bash
kubectl apply -f helm/nginx-ingress/nginx-ingress.yaml
```

## Verify

```bash
kubectl get pods -n ingress-nginx
kubectl get svc  -n ingress-nginx
```

The `ingress-nginx-controller` Service should show the static IP under `EXTERNAL-IP`.
