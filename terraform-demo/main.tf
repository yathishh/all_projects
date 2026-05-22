terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

provider "local" {}

resource "local_file" "example" {
  filename = "hello.txt"
  content  = "Hello Terraform! This is a local setup."
}

