import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const testDatabaseUrl = process.env.DATABASE_TEST_URL;
if (!testDatabaseUrl) {
  console.error(
    "API tests require DATABASE_TEST_URL pointing to a dedicated isolated database.",
  );
  process.exit(2);
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === testDatabaseUrl) {
  console.error(
    "API tests refuse to run when DATABASE_URL and DATABASE_TEST_URL are the same value.",
  );
  process.exit(2);
}

const testFiles = readdirSync("src/routes")
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => `src/routes/${file}`);
if (testFiles.length === 0) {
  console.error("No API route tests were found.");
  process.exit(2);
}

const result = spawnSync(
  "pnpm",
  ["exec", "tsx", "--test", ...testFiles],
  {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "test",
    },
    stdio: "inherit",
  },
);
if (result.error) {
  console.error("Could not start the isolated API test runner.");
  process.exit(2);
}
process.exit(result.status ?? 1);
