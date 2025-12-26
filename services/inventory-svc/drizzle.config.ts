import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// https://www.answeroverflow.com/m/1326636256565657682
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public", "inventory"],
});
