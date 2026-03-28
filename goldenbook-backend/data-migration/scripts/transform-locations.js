const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INPUT_PATH = path.resolve("data-migration/firestore-export/locations.json");
const OUTPUT_DIR = path.resolve("data-migration/transformed");
const MAPPINGS_DIR = path.resolve("data-migration/mappings");

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function makeUuidFromString(value) {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function pseudoUuid(value) {
    const hex = makeUuidFromString(value);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function slugify(value) {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function inferDestinationType(name) {
    const lowered = name.toLowerCase();
    if (["madeira", "azores"].includes(lowered)) return "island";
    if (["algarve"].includes(lowered)) return "region";
    return "city";
}

function extractStoragePathFromUrl(url) {
    if (!url || typeof url !== "string") return null;

    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes("firebasestorage.googleapis.com")) {
            const match = parsed.pathname.match(/\/o\/(.+)$/);
            if (match) {
                return decodeURIComponent(match[1]);
            }
        }

        if (parsed.hostname.includes("storage.googleapis.com")) {
            const parts = parsed.pathname.replace(/^\/+/, "").split("/");
            if (parts.length >= 2) {
                parts.shift(); // bucket
                return parts.join("/");
            }
        }

        return parsed.pathname.replace(/^\/+/, "");
    } catch {
        return null;
    }
}

function main() {
    ensureDir(OUTPUT_DIR);
    ensureDir(MAPPINGS_DIR);

    const locations = readJson(INPUT_PATH);

    const countryByCode = new Map();
    const mediaAssets = [];
    const destinations = [];
    const destinationTranslations = [];
    const idMapping = {
        countries: {},
        destinations: {},
        media_assets: {},
    };

    for (const location of locations) {
        const countryCode = "PT";
        const countryName = location.country || "Portugal";

        if (!countryByCode.has(countryCode)) {
            const countryId = pseudoUuid(`country:${countryCode}`);
            countryByCode.set(countryCode, {
                id: countryId,
                code: countryCode,
                name: countryName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            idMapping.countries[countryCode] = countryId;
        }

        let heroImageAssetId = null;

        if (location.image) {
            const assetId = pseudoUuid(`media:${location.image}`);
            heroImageAssetId = assetId;

            mediaAssets.push({
                id: assetId,
                bucket: "locations",
                path: extractStoragePathFromUrl(location.image) || `locations/${location.id}.jpg`,
                mime_type: "image/jpeg",
                width: null,
                height: null,
                size_bytes: null,
                alt_text: location.name || null,
                blurhash: null,
                original_url: location.image,
                created_at: new Date().toISOString(),
            });

            idMapping.media_assets[location.image] = assetId;
        }

        const destinationId = pseudoUuid(`destination:${location.id}`);

        destinations.push({
            id: destinationId,
            country_id: countryByCode.get(countryCode).id,
            parent_destination_id: null,
            slug: slugify(location.id || location.name),
            destination_type: inferDestinationType(location.name || location.id),
            name: location.name,
            featured: Boolean(location.featured),
            hero_image_asset_id: heroImageAssetId,
            latitude: null,
            longitude: null,
            sort_order: 0,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source_firestore_id: location.id,
        });

        destinationTranslations.push({
            id: pseudoUuid(`destination_translation:${location.id}:pt`),
            destination_id: destinationId,
            locale: "pt",
            name: location.name,
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        idMapping.destinations[location.id] = destinationId;
    }

    const countries = Array.from(countryByCode.values());

    writeJson(path.join(OUTPUT_DIR, "countries.json"), countries);
    writeJson(path.join(OUTPUT_DIR, "media_assets.locations.json"), mediaAssets);
    writeJson(path.join(OUTPUT_DIR, "destinations.json"), destinations);
    writeJson(path.join(OUTPUT_DIR, "destination_translations.json"), destinationTranslations);
    writeJson(path.join(MAPPINGS_DIR, "locations-id-mapping.json"), idMapping);

    console.log("✅ transform-locations completado");
    console.log(`- countries: ${countries.length}`);
    console.log(`- media_assets.locations: ${mediaAssets.length}`);
    console.log(`- destinations: ${destinations.length}`);
    console.log(`- destination_translations: ${destinationTranslations.length}`);
}

main();