process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/ecommerce";
process.env.AUTH_JWKS_URL =
  process.env.AUTH_JWKS_URL ?? "https://example.com/.well-known/jwks.json";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "https://example.com";
