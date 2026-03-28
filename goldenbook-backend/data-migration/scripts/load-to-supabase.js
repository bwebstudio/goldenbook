require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const TRANSFORMED_DIR = path.resolve("data-migration/transformed");
const REPORTS_DIR = path.resolve("data-migration/reports");

if (!process.env.DATABASE_URL) {
    throw new Error("Falta DATABASE_URL en .env");
}

function readJson(fileName) {
    const fullPath = path.join(TRANSFORMED_DIR, fileName);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`No existe el archivo: ${fullPath}`);
    }
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function chunkArray(array, size = 200) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

function pick(obj, keys) {
    const out = {};
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            out[key] = obj[key];
        }
    }
    return out;
}

async function insertBatch(client, tableName, rows, allowedColumns, options = {}) {
    const { onConflict = null, chunkSize = 200 } = options;

    if (!rows.length) {
        console.log(`- ${tableName}: 0 filas`);
        return { inserted: 0 };
    }

    let inserted = 0;
    const chunks = chunkArray(rows, chunkSize);

    for (const chunk of chunks) {
        const sanitizedRows = chunk.map((row) => pick(row, allowedColumns));

        const columns = allowedColumns.filter((col) =>
            sanitizedRows.some((row) => row[col] !== undefined)
        );

        if (!columns.length) continue;

        const values = [];
        const placeholders = [];

        sanitizedRows.forEach((row, rowIndex) => {
            const rowPlaceholders = columns.map((col, colIndex) => {
                values.push(row[col] ?? null);
                return `$${rowIndex * columns.length + colIndex + 1}`;
            });
            placeholders.push(`(${rowPlaceholders.join(", ")})`);
        });

        let query = `
      insert into ${tableName} (${columns.join(", ")})
      values ${placeholders.join(", ")}
    `;

        if (onConflict) {
            query += ` ${onConflict}`;
        }

        await client.query(query, values);
        inserted += sanitizedRows.length;
        console.log(`  ${tableName}: +${sanitizedRows.length}`);
    }

    return { inserted };
}

async function main() {
    ensureDir(REPORTS_DIR);

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    const loadReport = {
        startedAt: new Date().toISOString(),
        steps: [],
    };

    const datasets = {
        countries: readJson("countries.json"),
        mediaAssetsLocations: readJson("media_assets.locations.json"),
        destinations: readJson("destinations.json"),
        destinationTranslations: readJson("destination_translations.json"),
        categories: readJson("categories.normalized.json"),
        subcategories: readJson("subcategories.normalized.json"),
        categoryTranslations: readJson("category_translations.json"),
        subcategoryTranslations: readJson("subcategory_translations.json"),
        places: readJson("places.json"),
        mediaAssetsEstablishments: readJson("media_assets.establishments.json"),
        placeCategories: readJson("place_categories.json"),
        placeImages: readJson("place_images.json"),
        placeTranslations: readJson("place_translations.json"),
        openingHours: readJson("opening_hours.json"),
        placeStats: readJson("place_stats.json"),
    };

    try {
        await client.connect();
        console.log("✅ Conectado a Postgres");

        await client.query("begin");

        const orderedSteps = [
            {
                name: "countries",
                table: "countries",
                rows: datasets.countries,
                columns: ["id", "code", "name", "created_at", "updated_at"],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "media_assets.locations",
                table: "media_assets",
                rows: datasets.mediaAssetsLocations,
                columns: [
                    "id",
                    "bucket",
                    "path",
                    "mime_type",
                    "width",
                    "height",
                    "size_bytes",
                    "alt_text",
                    "blurhash",
                    "created_at",
                ],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "destinations",
                table: "destinations",
                rows: datasets.destinations,
                columns: [
                    "id",
                    "country_id",
                    "parent_destination_id",
                    "slug",
                    "destination_type",
                    "name",
                    "featured",
                    "hero_image_asset_id",
                    "latitude",
                    "longitude",
                    "sort_order",
                    "is_active",
                    "created_at",
                    "updated_at",
                ],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "destination_translations",
                table: "destination_translations",
                rows: datasets.destinationTranslations,
                columns: [
                    "id",
                    "destination_id",
                    "locale",
                    "name",
                    "description",
                    "created_at",
                    "updated_at",
                ],
                onConflict: "on conflict (destination_id, locale) do nothing",
            },
            {
                name: "categories",
                table: "categories",
                rows: datasets.categories,
                columns: ["id", "slug", "icon_name", "sort_order", "is_active", "created_at", "updated_at"],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "subcategories",
                table: "subcategories",
                rows: datasets.subcategories,
                columns: ["id", "category_id", "slug", "sort_order", "is_active", "created_at", "updated_at"],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "category_translations",
                table: "category_translations",
                rows: datasets.categoryTranslations,
                columns: ["id", "category_id", "locale", "name", "description", "created_at", "updated_at"],
                onConflict: "on conflict (category_id, locale) do nothing",
            },
            {
                name: "subcategory_translations",
                table: "subcategory_translations",
                rows: datasets.subcategoryTranslations,
                columns: ["id", "subcategory_id", "locale", "name", "description", "created_at", "updated_at"],
                onConflict: "on conflict (subcategory_id, locale) do nothing",
            },
            {
                name: "places",
                table: "places",
                rows: datasets.places,
                columns: [
                    "id",
                    "destination_id",
                    "slug",
                    "place_type",
                    "status",
                    "name",
                    "short_description",
                    "editorial_summary",
                    "full_description",
                    "address_line",
                    "postal_code",
                    "latitude",
                    "longitude",
                    "phone",
                    "email",
                    "website_url",
                    "instagram_url",
                    "booking_url",
                    "price_tier",
                    "featured",
                    "trending",
                    "is_temporarily_closed",
                    "is_active",
                    "published_at",
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                ],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "media_assets.establishments",
                table: "media_assets",
                rows: datasets.mediaAssetsEstablishments,
                columns: [
                    "id",
                    "bucket",
                    "path",
                    "mime_type",
                    "width",
                    "height",
                    "size_bytes",
                    "alt_text",
                    "blurhash",
                    "created_at",
                ],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "place_categories",
                table: "place_categories",
                rows: datasets.placeCategories,
                columns: [
                    "id",
                    "place_id",
                    "category_id",
                    "subcategory_id",
                    "is_primary",
                    "sort_order",
                    "created_at",
                ],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "place_images",
                table: "place_images",
                rows: datasets.placeImages,
                columns: [
                    "id",
                    "place_id",
                    "asset_id",
                    "image_role",
                    "sort_order",
                    "caption",
                    "is_primary",
                    "created_at",
                ],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "place_translations",
                table: "place_translations",
                rows: datasets.placeTranslations,
                columns: [
                    "id",
                    "place_id",
                    "locale",
                    "name",
                    "short_description",
                    "editorial_summary",
                    "full_description",
                    "created_at",
                    "updated_at",
                ],
                onConflict: "on conflict (place_id, locale) do nothing",
            },
            {
                name: "opening_hours",
                table: "opening_hours",
                rows: datasets.openingHours,
                columns: [
                    "id",
                    "place_id",
                    "day_of_week",
                    "opens_at",
                    "closes_at",
                    "is_closed",
                    "slot_order",
                    "created_at",
                ],
                onConflict: "on conflict (id) do nothing",
            },
            {
                name: "place_stats",
                table: "place_stats",
                rows: datasets.placeStats,
                columns: [
                    "place_id",
                    "favorites_count",
                    "bookmarks_count",
                    "popularity_score",
                    "last_computed_at",
                ],
                onConflict: `
          on conflict (place_id) do update set
            favorites_count = excluded.favorites_count,
            bookmarks_count = excluded.bookmarks_count,
            popularity_score = excluded.popularity_score,
            last_computed_at = excluded.last_computed_at
        `,
            },
        ];

        for (const step of orderedSteps) {
            console.log(`\n➡️  Cargando ${step.name}...`);
            const result = await insertBatch(
                client,
                step.table,
                step.rows,
                step.columns,
                { onConflict: step.onConflict, chunkSize: 200 }
            );

            loadReport.steps.push({
                name: step.name,
                table: step.table,
                count: step.rows.length,
                inserted: result.inserted,
                status: "ok",
            });
        }

        await client.query("commit");
        console.log("\n✅ Carga completada correctamente");

        loadReport.finishedAt = new Date().toISOString();
        loadReport.status = "ok";
    } catch (error) {
        await client.query("rollback").catch(() => { });
        console.error("\n❌ Error durante la carga:", error.message);

        loadReport.finishedAt = new Date().toISOString();
        loadReport.status = "error";
        loadReport.error = {
            message: error.message,
            stack: error.stack,
        };

        const reportPath = path.join(REPORTS_DIR, "load-to-supabase-report.json");
        fs.writeFileSync(reportPath, JSON.stringify(loadReport, null, 2), "utf8");
        console.log(`Reporte guardado en: ${reportPath}`);

        await client.end().catch(() => { });
        process.exit(1);
    }

    const reportPath = path.join(REPORTS_DIR, "load-to-supabase-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(loadReport, null, 2), "utf8");
    console.log(`Reporte guardado en: ${reportPath}`);

    await client.end();
}

main().catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
});