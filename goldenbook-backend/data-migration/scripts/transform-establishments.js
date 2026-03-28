const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INPUT_PATH = path.resolve("data-migration/firestore-export/establishments.json");
const OUTPUT_DIR = path.resolve("data-migration/transformed");
const MAPPINGS_DIR = path.resolve("data-migration/mappings");
const REPORTS_DIR = path.resolve("data-migration/reports");

const LOCATIONS_MAPPING_PATH = path.resolve("data-migration/mappings/locations-id-mapping.json");
const CATEGORIES_MAPPING_PATH = path.resolve("data-migration/mappings/categories-id-mapping.json");

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function hashHex(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

function pseudoUuid(value) {
    const hex = hashHex(value);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function uniqueBy(array, keyFn) {
    const seen = new Set();
    const result = [];
    for (const item of array) {
        const key = keyFn(item);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }
    return result;
}

function parseTimestamp(value) {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value._type === "timestamp" && value.iso) return value.iso;
    return null;
}

function extractStoragePathFromUrl(url) {
    if (!url || typeof url !== "string") return null;

    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes("firebasestorage.googleapis.com")) {
            const match = parsed.pathname.match(/\/o\/(.+)$/);
            if (match) return decodeURIComponent(match[1]);
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

function inferBucketFromUrl(url) {
    const storagePath = extractStoragePathFromUrl(url);
    if (!storagePath) return "establishments";

    const firstSegment = storagePath.split("/")[0];
    if (firstSegment) return firstSegment;

    return "establishments";
}

function normalizeWebsiteUrl(url) {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.includes(" ")) return trimmed;
    return `https://${trimmed}`;
}

function inferPlaceType(categories = [], subcategories = [], name = "") {
    const cats = categories.map((c) => String(c).toLowerCase());
    const subs = subcategories.map((s) => String(s).toLowerCase());
    const combined = [...cats, ...subs, name.toLowerCase()];

    if (combined.some((v) => ["restaurant", "restaurants", "traditional_food", "fine_dining"].includes(v))) {
        return "restaurant";
    }
    if (combined.some((v) => ["cafes", "cafe", "coffee_shops"].includes(v))) {
        return "cafe";
    }
    if (combined.some((v) => ["bars", "nightlife", "cocktail_bars"].includes(v))) {
        return "bar";
    }
    if (combined.some((v) => ["shops", "fashion", "concept_stores", "jewelry", "souvenirs"].includes(v))) {
        return "shop";
    }
    if (combined.some((v) => ["hotels", "boutique_hotels", "resorts", "accommodation"].includes(v))) {
        return "hotel";
    }
    if (combined.some((v) => ["beaches", "beach_clubs"].includes(v))) {
        return "beach";
    }
    if (combined.some((v) => ["museums", "galleries", "culture"].includes(v))) {
        return "museum";
    }
    if (combined.some((v) => ["activities", "sports", "tours", "experiences", "wellness"].includes(v))) {
        return "activity";
    }
    if (combined.some((v) => ["transport"].includes(v))) {
        return "transport";
    }

    return "other";
}

function normalizeCategoryKey(value) {
    return slugify(value).replace(/-/g, "_");
}

function buildUniqueSlug(baseSlug, usedSlugs) {
    let slug = baseSlug || "place";
    if (!usedSlugs.has(slug)) {
        usedSlugs.add(slug);
        return slug;
    }

    let counter = 2;
    while (usedSlugs.has(`${slug}-${counter}`)) {
        counter += 1;
    }

    const uniqueSlug = `${slug}-${counter}`;
    usedSlugs.add(uniqueSlug);
    return uniqueSlug;
}

function splitTopLevelBySemicolon(text) {
    return String(text)
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean);
}

function dayLabelToIndex(labelRaw) {
    const label = String(labelRaw || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const map = {
        "segunda": 1,
        "segunda-feira": 1,
        "terca": 2,
        "terca-feira": 2,
        "quarta": 3,
        "quarta-feira": 3,
        "quinta": 4,
        "quinta-feira": 4,
        "sexta": 5,
        "sexta-feira": 5,
        "sabado": 6,
        "domingo": 0,
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
        "friday": 5,
        "saturday": 6,
        "sunday": 0,
    };

    return map[label] ?? null;
}

function expandDayRange(label) {
    const normalized = String(label || "")
        .replace(/\s+/g, " ")
        .trim();

    const parts = normalized.split(/\s+a\s+|\s+to\s+/i).map((p) => p.trim());

    if (parts.length === 2) {
        const start = dayLabelToIndex(parts[0]);
        const end = dayLabelToIndex(parts[1]);

        if (start !== null && end !== null) {
            const days = [];
            let current = start;
            while (true) {
                days.push(current);
                if (current === end) break;
                current = (current + 1) % 7;
                if (days.length > 7) break;
            }
            return days;
        }
    }

    const single = dayLabelToIndex(normalized);
    return single !== null ? [single] : [];
}

function parseTimeRanges(text) {
    const matches = String(text || "").match(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/g);
    if (!matches) return [];

    return matches.map((match) => {
        const [open, close] = match.split(/[–-]/).map((v) => v.trim());
        return { opens_at: open, closes_at: close };
    });
}

function parseOpeningHoursToRows(openingHoursText, placeId, sourceId, reports) {
    if (!openingHoursText || typeof openingHoursText !== "string") return [];

    const rows = [];
    const segments = splitTopLevelBySemicolon(openingHoursText);

    for (const segment of segments) {
        const parts = segment.split(":");
        if (parts.length < 2) continue;

        const dayPart = parts[0].trim();
        const timePart = parts.slice(1).join(":").trim();

        const days = expandDayRange(dayPart);

        if (!days.length) {
            reports.unparsed_opening_hours.push({
                source_firestore_id: sourceId,
                raw_segment: segment,
            });
            continue;
        }

        const isClosed = /fechado|closed/i.test(timePart);
        const ranges = parseTimeRanges(timePart);

        for (const day of days) {
            if (isClosed || ranges.length === 0) {
                rows.push({
                    id: pseudoUuid(`opening_hours:${placeId}:${day}:closed:${segment}`),
                    place_id: placeId,
                    day_of_week: day,
                    opens_at: null,
                    closes_at: null,
                    is_closed: true,
                    slot_order: 0,
                    created_at: new Date().toISOString(),
                });
            } else {
                ranges.forEach((range, index) => {
                    rows.push({
                        id: pseudoUuid(`opening_hours:${placeId}:${day}:${index}:${range.opens_at}-${range.closes_at}`),
                        place_id: placeId,
                        day_of_week: day,
                        opens_at: range.opens_at,
                        closes_at: range.closes_at,
                        is_closed: false,
                        slot_order: index,
                        created_at: new Date().toISOString(),
                    });
                });
            }
        }
    }

    return rows;
}

function main() {
    ensureDir(OUTPUT_DIR);
    ensureDir(MAPPINGS_DIR);
    ensureDir(REPORTS_DIR);

    const establishments = readJson(INPUT_PATH);
    const locationsMapping = readJson(LOCATIONS_MAPPING_PATH);
    const categoriesMapping = readJson(CATEGORIES_MAPPING_PATH);

    const destinationIdMap = locationsMapping.destinations || {};
    const categoryIdMap = categoriesMapping.categories || {};
    const subcategoryIdMap = categoriesMapping.subcategories || {};

    const places = [];
    const mediaAssets = [];
    const placeImages = [];
    const placeCategories = [];
    const placeTranslations = [];
    const openingHours = [];
    const placeStats = [];

    const reports = {
        unresolved_cities: [],
        unknown_categories: [],
        unknown_subcategories: [],
        duplicate_slug_sources: [],
        unparsed_opening_hours: [],
        missing_main_image: [],
    };

    const idMapping = {
        places: {},
        media_assets: {},
    };

    const usedSlugs = new Set();

    for (const establishment of establishments) {
        const sourceId = establishment.id;
        const rawCity = establishment.city || null;
        const destinationId = resolveDestinationId(rawCity, destinationIdMap);

        if (!destinationId) {
            reports.unresolved_cities.push({
                source_firestore_id: sourceId,
                city: rawCity,
                name: establishment.name || null,
            });
            continue;
        }

        const baseSlug = slugify(sourceId || establishment.name || "place");
        const uniqueSlug = buildUniqueSlug(baseSlug, usedSlugs);

        if (uniqueSlug !== baseSlug) {
            reports.duplicate_slug_sources.push({
                source_firestore_id: sourceId,
                original_slug: baseSlug,
                final_slug: uniqueSlug,
            });
        }

        const placeId = pseudoUuid(`place:${sourceId}`);
        idMapping.places[sourceId] = placeId;

        const categories = Array.isArray(establishment.categories) ? establishment.categories : [];
        const subcategories = Array.isArray(establishment.subcategories) ? establishment.subcategories : [];
        const placeType = inferPlaceType(categories, subcategories, establishment.name);

        const createdAt = parseTimestamp(establishment.createdAt) || new Date().toISOString();
        const updatedAt =
            parseTimestamp(establishment.lastModifiedAt) ||
            parseTimestamp(establishment.migratedAt) ||
            createdAt;

        places.push({
            id: placeId,
            destination_id: destinationId,
            slug: uniqueSlug,
            place_type: placeType,
            status: "published",
            name: establishment.name || "Untitled place",
            short_description: establishment.shortDescription || null,
            editorial_summary: null,
            full_description: establishment.fullDescription || null,
            address_line: establishment.address || null,
            postal_code: null,
            latitude: establishment.coordinates?.latitude ?? null,
            longitude: establishment.coordinates?.longitude ?? null,
            phone: establishment.phone || null,
            email: establishment.email || null,
            website_url: normalizeWebsiteUrl(establishment.website),
            instagram_url: null,
            booking_url: normalizeWebsiteUrl(establishment.reservationLink),
            price_tier: null,
            featured: Boolean(establishment.featured),
            trending: Boolean(establishment.trending),
            is_temporarily_closed: false,
            is_active: true,
            published_at: createdAt,
            created_by: null,
            updated_by: null,
            created_at: createdAt,
            updated_at: updatedAt,
            source_firestore_id: sourceId,
            source_version: establishment.version ?? null,
            source_created_by: establishment.createdBy || null,
            source_last_modified_by: establishment.lastModifiedBy || null,
        });

        const rawCategoryKeys = categories.map(normalizeCategoryKey);
        const rawSubcategoryKeys = subcategories.map(normalizeCategoryKey);

        rawCategoryKeys.forEach((categoryKey, index) => {
            const categoryId = categoryIdMap[categoryKey];

            if (!categoryId) {
                reports.unknown_categories.push({
                    source_firestore_id: sourceId,
                    category: categoryKey,
                    name: establishment.name || null,
                });
                return;
            }

            let resolvedSubcategoryId = null;

            if (rawSubcategoryKeys.length > 0) {
                const matchingSub = rawSubcategoryKeys.find((subKey) => subcategoryIdMap[`${categoryKey}:${subKey}`]);
                if (matchingSub) {
                    resolvedSubcategoryId = subcategoryIdMap[`${categoryKey}:${matchingSub}`];
                }
            }

            placeCategories.push({
                id: pseudoUuid(`place_category:${placeId}:${categoryId}:${resolvedSubcategoryId || "none"}`),
                place_id: placeId,
                category_id: categoryId,
                subcategory_id: resolvedSubcategoryId,
                is_primary: index === 0,
                sort_order: index,
                created_at: new Date().toISOString(),
            });
        });

        rawSubcategoryKeys.forEach((subKey) => {
            const hasMapping = Object.keys(subcategoryIdMap).some((key) => key.endsWith(`:${subKey}`));
            if (!hasMapping) {
                reports.unknown_subcategories.push({
                    source_firestore_id: sourceId,
                    subcategory: subKey,
                    name: establishment.name || null,
                });
            }
        });

        const allImages = [];

        if (establishment.mainImage) {
            allImages.push({
                url: establishment.mainImage,
                image_role: "cover",
                is_primary: true,
            });
        } else {
            reports.missing_main_image.push({
                source_firestore_id: sourceId,
                name: establishment.name || null,
            });
        }

        if (Array.isArray(establishment.gallery)) {
            establishment.gallery.forEach((url) => {
                allImages.push({
                    url,
                    image_role: "gallery",
                    is_primary: false,
                });
            });
        }

        uniqueBy(allImages.filter((img) => img.url), (img) => img.url).forEach((image, index) => {
            const assetId = pseudoUuid(`media:${image.url}`);
            idMapping.media_assets[image.url] = assetId;

            mediaAssets.push({
                id: assetId,
                bucket: inferBucketFromUrl(image.url),
                path: extractStoragePathFromUrl(image.url) || `establishments/${sourceId}/image-${index + 1}.jpg`,
                mime_type: "image/jpeg",
                width: null,
                height: null,
                size_bytes: null,
                alt_text: establishment.name || null,
                blurhash: null,
                original_url: image.url,
                created_at: new Date().toISOString(),
            });

            placeImages.push({
                id: pseudoUuid(`place_image:${placeId}:${assetId}`),
                place_id: placeId,
                asset_id: assetId,
                image_role: image.image_role,
                sort_order: index,
                caption: null,
                is_primary: image.is_primary,
                created_at: new Date().toISOString(),
            });
        });

        const translations = establishment.translations || {};
        const locales = new Set(["pt"]);

        ["shortDescription", "fullDescription", "openingHours", "categories", "subcategories"].forEach((field) => {
            const fieldTranslations = translations[field];
            if (fieldTranslations && typeof fieldTranslations === "object") {
                Object.keys(fieldTranslations).forEach((locale) => locales.add(locale));
            }
        });

        Array.from(locales).forEach((locale) => {
            const shortDescription =
                translations.shortDescription?.[locale] ??
                (locale === "pt" ? establishment.shortDescription || null : null);

            const fullDescription =
                translations.fullDescription?.[locale] ??
                (locale === "pt" ? establishment.fullDescription || null : null);

            const localizedName = establishment.name || "Untitled place";

            placeTranslations.push({
                id: pseudoUuid(`place_translation:${placeId}:${locale}`),
                place_id: placeId,
                locale,
                name: localizedName,
                short_description: shortDescription,
                editorial_summary: null,
                full_description: fullDescription,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        });

        const openingHoursRows = parseOpeningHoursToRows(
            establishment.openingHours,
            placeId,
            sourceId,
            reports
        );

        openingHours.push(...openingHoursRows);

        placeStats.push({
            place_id: placeId,
            favorites_count: establishment.stats?.favoriteCount ?? 0,
            bookmarks_count: 0,
            popularity_score: null,
            last_computed_at: updatedAt,
        });
    }

    const dedupedMediaAssets = uniqueBy(mediaAssets, (item) => item.id);
    const dedupedPlaceCategories = uniqueBy(
        placeCategories,
        (item) => `${item.place_id}:${item.category_id}:${item.subcategory_id || "none"}`
    );
    const dedupedPlaceImages = uniqueBy(placeImages, (item) => item.id);
    const dedupedPlaceTranslations = uniqueBy(
        placeTranslations,
        (item) => `${item.place_id}:${item.locale}`
    );
    const dedupedOpeningHours = uniqueBy(openingHours, (item) => item.id);

    writeJson(path.join(OUTPUT_DIR, "places.json"), places);
    writeJson(path.join(OUTPUT_DIR, "media_assets.establishments.json"), dedupedMediaAssets);
    writeJson(path.join(OUTPUT_DIR, "place_categories.json"), dedupedPlaceCategories);
    writeJson(path.join(OUTPUT_DIR, "place_images.json"), dedupedPlaceImages);
    writeJson(path.join(OUTPUT_DIR, "place_translations.json"), dedupedPlaceTranslations);
    writeJson(path.join(OUTPUT_DIR, "opening_hours.json"), dedupedOpeningHours);
    writeJson(path.join(OUTPUT_DIR, "place_stats.json"), placeStats);

    writeJson(path.join(MAPPINGS_DIR, "places-id-mapping.json"), idMapping);

    writeJson(path.join(REPORTS_DIR, "unresolved-cities.json"), reports.unresolved_cities);
    writeJson(path.join(REPORTS_DIR, "unknown-categories.json"), reports.unknown_categories);
    writeJson(path.join(REPORTS_DIR, "unknown-subcategories.json"), reports.unknown_subcategories);
    writeJson(path.join(REPORTS_DIR, "duplicate-slugs.json"), reports.duplicate_slug_sources);
    writeJson(path.join(REPORTS_DIR, "unparsed-opening-hours.json"), reports.unparsed_opening_hours);
    writeJson(path.join(REPORTS_DIR, "missing-main-image.json"), reports.missing_main_image);

    console.log("✅ transform-establishments completado");
    console.log(`- places: ${places.length}`);
    console.log(`- media_assets.establishments: ${dedupedMediaAssets.length}`);
    console.log(`- place_categories: ${dedupedPlaceCategories.length}`);
    console.log(`- place_images: ${dedupedPlaceImages.length}`);
    console.log(`- place_translations: ${dedupedPlaceTranslations.length}`);
    console.log(`- opening_hours: ${dedupedOpeningHours.length}`);
    console.log(`- place_stats: ${placeStats.length}`);
    console.log(`- unresolved_cities: ${reports.unresolved_cities.length}`);
    console.log(`- unknown_categories: ${reports.unknown_categories.length}`);
    console.log(`- unknown_subcategories: ${reports.unknown_subcategories.length}`);
    console.log(`- unparsed_opening_hours: ${reports.unparsed_opening_hours.length}`);
}
function resolveDestinationId(rawCity, destinationIdMap) {
    if (!rawCity) return null;

    const candidates = [
        rawCity,
        String(rawCity).trim(),
        slugify(rawCity),
        String(rawCity).trim().toLowerCase(),
    ];

    for (const candidate of candidates) {
        if (destinationIdMap[candidate]) {
            return destinationIdMap[candidate];
        }
    }

    return null;
}

main();