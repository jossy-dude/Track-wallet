import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/sqlite/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./local-authority.sqlite",
  },
  strict: true,
  verbose: true,
});
