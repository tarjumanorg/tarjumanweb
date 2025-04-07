// src/env.d.ts
declare namespace App {
  interface Locals {
    // Changed from email: string to userId?: string
    // Optional because not all requests will have an authenticated user
    userId?: string;
  }
}