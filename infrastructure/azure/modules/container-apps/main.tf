resource "azurerm_container_app" "this" {
  name                         = var.name
  container_app_environment_id = var.container_app_environment_id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  dynamic "secret" {
    for_each = var.registry_password != null ? [1] : []
    content {
      name  = "registry-password"
      value = var.registry_password
    }
  }

  dynamic "registry" {
    for_each = var.registry_password != null ? [1] : []
    content {
      server               = var.registry_server
      username             = var.registry_username
      password_secret_name = "registry-password"
    }
  }

  template {
    min_replicas = var.replicas.min
    max_replicas = var.replicas.max

    dynamic "volume" {
      for_each = toset(var.volumes)
      content {
        name          = "${volume.value}-volume"
        storage_name  = var.app_env_storage_name
        storage_type  = "AzureFile"
        mount_options = "rw"
      }
    }

    container {
      name   = var.container.name
      image  = var.container.image
      cpu    = var.container.cpu
      memory = var.container.memory

      dynamic "env" {
        for_each = var.container.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "volume_mounts" {
        for_each = var.container.volume
        content {
          name = "${volume_mounts.key}-volume"
          path = volume_mounts.value
        }
      }
    }
  }

  ingress {
    allow_insecure_connections = var.ingress.allow_insecure_connections
    external_enabled           = var.ingress.external_enabled
    target_port                = var.ingress.target_port
    exposed_port               = var.ingress.exposed_port
    transport                  = var.ingress.transport

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}
