import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel('ecommerce-backend-app')
}
