terraform {
  required_version = ">= 1.9"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "5.1.0"
    }
  }

  # Uncomment to store state in Azure Blob Storage
  backend "azurerm" {
    resource_group_name  = "personal"
    storage_account_name = "azstrogeu001"
    container_name       = "tfstate"
    key                  = "multitenantsaloon.terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
}
