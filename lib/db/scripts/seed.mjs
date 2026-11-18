import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before seeding the development database.");
}

const client = new pg.Client({ connectionString });

const boundaryRetrievedAt = "2026-11-18T00:00:00.000Z";
const boundarySource = "IBGE Malha Municipal API v4; bounding box derived from the returned municipality polygon. Approximation only.";
const cities = [
  ["curitiba", "Curitiba", "PR", -25.6454, -49.3893, -25.345, -49.1844, "4106902"],
  ["londrina", "Londrina", "PR", -23.7799, -51.3213, -23.1722, -50.8763, "4113700"],
  ["maringa", "Maringá", "PR", -23.5581, -52.1001, -23.254, -51.8358, "4115200"],
  ["ponta-grossa", "Ponta Grossa", "PR", -25.3866, -50.4565, -24.8921, -49.6802, "4119905"],
].map(([id, name, state, minLat, minLng, maxLat, maxLng, code]) => [
  id,
  name,
  state,
  minLat,
  minLng,
  maxLat,
  maxLng,
  boundarySource,
  `https://servicodados.ibge.gov.br/api/v4/malhas/municipios/${code}?formato=application/vnd.geo+json&qualidade=maxima`,
  boundaryRetrievedAt,
]);

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
  for (const [
    id,
    name,
    state,
    bboxMinLatitude,
    bboxMinLongitude,
    bboxMaxLatitude,
    bboxMaxLongitude,
    source,
    sourceUrl,
    retrievedAt,
  ] of cities) {
    await client.query(
      `INSERT INTO city_eyes_cities
         (id, name, state, bbox_min_latitude, bbox_min_longitude,
          bbox_max_latitude, bbox_max_longitude, boundary_source,
          boundary_source_url, boundary_retrieved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         state = EXCLUDED.state,
         bbox_min_latitude = EXCLUDED.bbox_min_latitude,
         bbox_min_longitude = EXCLUDED.bbox_min_longitude,
         bbox_max_latitude = EXCLUDED.bbox_max_latitude,
         bbox_max_longitude = EXCLUDED.bbox_max_longitude,
         boundary_source = EXCLUDED.boundary_source,
         boundary_source_url = EXCLUDED.boundary_source_url,
         boundary_retrieved_at = EXCLUDED.boundary_retrieved_at`,
      [
        id,
        name,
        state,
        bboxMinLatitude,
        bboxMinLongitude,
        bboxMaxLatitude,
        bboxMaxLongitude,
        source,
        sourceUrl,
        retrievedAt,
      ],
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
