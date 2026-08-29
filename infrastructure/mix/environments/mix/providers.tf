terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "5.1.0"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Same state storage account as the other environments, distinct key.
  backend "azurerm" {
    resource_group_name  = "personal"
    storage_account_name = "azstrogeu001"
    container_name       = "tfstate"
    key                  = "multitenantsaloon-mix.terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
}

provider "azapi" {}

# Reads the API token from CLOUDFLARE_API_TOKEN in the environment.
provider "cloudflare" {}
