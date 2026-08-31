variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "storage_account_name" {
  description = "Globally unique Storage account name (3-24 chars, lowercase alphanumeric only). Holds staff profile photos / work-gallery media as block blobs."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "storage_account_name must be 3-24 lowercase alphanumeric characters."
  }
}

variable "container_name" {
  description = "Blob container the app writes staff media into. Must match the app's MEDIA_STAFF_CONTAINER_NAME / spring.application.media.staff-container-name."
  type        = string
  default     = "staff-media"
}

variable "anonymous_blob_read" {
  description = <<-EOT
    When true (default), the container allows anonymous read of individual blobs
    (container_access_type = "blob"). Staff photos and work-gallery media are
    public content shown on the salon website, and the app's returned publicUrl
    (MEDIA_STAFF_CDN_BASE_URL/<key>) points straight at the blob endpoint. Set
    false to keep the container private and front it with a CDN / signed reads.
  EOT
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "Browser origins allowed to PUT directly to the blob endpoint via the shared-key SAS (the salon-admin and salon-staff SPAs). Empty disables the CORS rule."
  type        = list(string)
  default     = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
