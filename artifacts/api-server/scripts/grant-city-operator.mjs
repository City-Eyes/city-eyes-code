import pg from "pg";

const [userId, cityId, role = "operator"] = process.argv.slice(2);
const cityIds = new Set([
  "curitiba",
  "londrina",
  "maringa",
  "ponta-grossa",
]);
const roles = new Set(["operator", "city_admin"]);

if (!userId || userId.length > 200 || !cityIds.has(cityId) || !roles.has(role)) {
  console.error(
    "Usage: pnpm --filter @workspace/api-server run grant-city-operator -- <replit-user-id> <city-id> [operator|city_admin]",
  );
  process.exit(2);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must point to the intended CITY EYES database.");
  process.exit(2);
}

const client = new pg.Client({ connectionString });
try {
  await client.connect();
  const user = await client.query("SELECT id FROM users WHERE id = $1", [userId]);
  if (user.rowCount !== 1) {
    console.error("That Replit-authenticated user was not found.");
    process.exitCode = 1;
  } else {
    const city = await client.query(
      "SELECT id FROM city_eyes_cities WHERE id = $1",
      [cityId],
    );
    if (city.rowCount !== 1) {
      console.error("That supported city was not found.");
      process.exitCode = 1;
    } else {
      await client.query(
        `INSERT INTO city_eyes_city_memberships (user_id, city_id, role)
         VALUES ($1, $2, $3::city_eyes_membership_role)
         ON CONFLICT (user_id, city_id) DO UPDATE SET role = EXCLUDED.role`,
        [userId, cityId, role],
      );
      console.log(`Municipal access updated for ${cityId}.`);
    }
  }
} catch {
  console.error("Could not update municipal access.");
  process.exitCode = 1;
} finally {
  await client.end();
}
