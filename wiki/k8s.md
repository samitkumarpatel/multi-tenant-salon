# Accessing the AKS Cluster (dev)

The backend infrastructure provisions an **Azure Kubernetes Service (AKS)** cluster in resource group `multi-tenant-salon-dev` (region: `westeurope`).

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- An Azure account with at least the **Azure Kubernetes Service Cluster User** role on the cluster or its resource group

## Steps

### 1. Get the cluster name

```bash
cd infrastructure/azure/environments/dev
terraform output aks_cluster_name
```

### 2. Log in to Azure

```bash
az login
```

### 3. Fetch kubeconfig credentials

```bash
az aks get-credentials \
  --resource-group multi-tenant-salon-dev \
  --name <aks_cluster_name> \
  --overwrite-existing
```

This merges the cluster credentials into `~/.kube/config`.

For full cluster-admin access (admins only):

```bash
az aks get-credentials \
  --resource-group multi-tenant-salon-dev \
  --name <aks_cluster_name> \
  --admin \
  --overwrite-existing
```

### 4. Verify access

```bash
kubectl get nodes
kubectl get namespaces
```

## Alternative: use Terraform's raw kubeconfig

The Terraform backend stack exposes a `kube_config_raw` sensitive output. To use it directly:

```bash
terraform -chdir=./infrastructure/azure/environments/dev output -raw kube_config_raw > kube-config
export KUBECONFIG=./kube-config
```

## Related

- [Backend Deployment](./backend-deployment.md)
- Terraform backend stack: `infrastructure/azure/stacks/backend/`
- Environment config: `infrastructure/azure/environments/dev/main.tf`
