import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before seeding the development database.");
}

const client = new pg.Client({ connectionString });

const cities = [
  ["curitiba", "Curitiba", "PR"],
  ["londrina", "Londrina", "PR"],
  ["maringa", "Maringá", "PR"],
  ["ponta-grossa", "Ponta Grossa", "PR"],
];

const reports = [
  ["demo-curitiba-01", "curitiba", "Exemplo: calçada com passagem reduzida", "Registro fictício para demonstrar a consulta pública. Não representa uma ocorrência real nem um retorno da prefeitura.", "accessibility", "Localização ilustrativa", "2026-11-18T12:00:00.000Z"],
  ["demo-curitiba-02", "curitiba", "Exemplo: iluminação em via pública", "Conteúdo sintético usado somente para validar a navegação do protótipo.", "lighting", "Localização ilustrativa", "2026-11-17T16:00:00.000Z"],
  ["demo-londrina-01", "londrina", "Exemplo: acúmulo de água após chuva", "Registro fictício para demonstrar a consulta pública. Não representa uma ocorrência real nem um retorno da prefeitura.", "drainage", "Localização ilustrativa", "2026-11-18T10:30:00.000Z"],
  ["demo-londrina-02", "londrina", "Exemplo: descarte de resíduos", "Conteúdo sintético usado somente para validar a navegação do protótipo.", "waste", "Localização ilustrativa", "2026-11-16T14:15:00.000Z"],
  ["demo-maringa-01", "maringa", "Exemplo: rampa de acesso obstruída", "Registro fictício para demonstrar a consulta pública. Não representa uma ocorrência real nem um retorno da prefeitura.", "accessibility", "Localização ilustrativa", "2026-11-18T09:15:00.000Z"],
  ["demo-maringa-02", "maringa", "Exemplo: manutenção de espaço público", "Conteúdo sintético usado somente para validar a navegação do protótipo.", "public-space", "Localização ilustrativa", "2026-11-15T13:00:00.000Z"],
  ["demo-ponta-grossa-01", "ponta-grossa", "Exemplo: bueiro com obstrução", "Registro fictício para demonstrar a consulta pública. Não representa uma ocorrência real nem um retorno da prefeitura.", "drainage", "Localização ilustrativa", "2026-11-18T11:00:00.000Z"],
  ["demo-ponta-grossa-02", "ponta-grossa", "Exemplo: coleta de resíduos", "Conteúdo sintético usado somente para validar a navegação do protótipo.", "waste", "Localização ilustrativa", "2026-11-14T12:45:00.000Z"],
];

try {
  await client.connect();
  for (const [id, name, state] of cities) {
    await client.query(
      `INSERT INTO city_eyes_cities (id, name, state)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state`,
      [id, name, state],
    );
  }

  for (const [id, cityId, title, description, category, locationLabel, createdAt] of reports) {
    await client.query(
      `INSERT INTO city_eyes_reports
         (id, city_id, title, description, category, location_label, created_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [id, cityId, title, description, category, locationLabel, createdAt],
    );
  }

  console.log(`Seeded ${cities.length} cities and ${reports.length} clearly labeled demo reports.`);
} finally {
  await client.end();
}
