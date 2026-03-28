const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INPUT_PATH = path.resolve("data-migration/firestore-export/categories.json");
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
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function main() {
    ensureDir(OUTPUT_DIR);
    ensureDir(MAPPINGS_DIR);

    const source = readJson(INPUT_PATH);

    const categories = [];
    const subcategories = [];
    const categoryTranslations = [];
    const subcategoryTranslations = [];
    const idMapping = {
        categories: {},
        subcategories: {},
    };

    source.forEach((category, categoryIndex) => {
        const categoryId = pseudoUuid(`category:${category.id}`);

        categories.push({
            id: categoryId,
            slug: slugify(category.id),
            icon_name: category.icon || null,
            sort_order: categoryIndex,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source_firestore_id: category.id,
        });

        categoryTranslations.push({
            id: pseudoUuid(`category_translation:${category.id}:en`),
            category_id: categoryId,
            locale: "en",
            name: category.title || category.id,
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        idMapping.categories[category.id] = categoryId;

        (category.subcategories || []).forEach((subcategory, subIndex) => {
            const subcategoryKey = `${category.id}:${subcategory}`;
            const subcategoryId = pseudoUuid(`subcategory:${subcategoryKey}`);

            subcategories.push({
                id: subcategoryId,
                category_id: categoryId,
                slug: slugify(subcategory),
                sort_order: subIndex,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                source_firestore_key: subcategoryKey,
            });

            subcategoryTranslations.push({
                id: pseudoUuid(`subcategory_translation:${subcategoryKey}:en`),
                subcategory_id: subcategoryId,
                locale: "en",
                name: subcategory
                    .split("_")
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(" "),
                description: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            idMapping.subcategories[subcategoryKey] = subcategoryId;
        });
    });

    writeJson(path.join(OUTPUT_DIR, "categories.normalized.json"), categories);
    writeJson(path.join(OUTPUT_DIR, "subcategories.normalized.json"), subcategories);
    writeJson(path.join(OUTPUT_DIR, "category_translations.json"), categoryTranslations);
    writeJson(path.join(OUTPUT_DIR, "subcategory_translations.json"), subcategoryTranslations);
    writeJson(path.join(MAPPINGS_DIR, "categories-id-mapping.json"), idMapping);

    console.log("✅ transform-categories completado");
    console.log(`- categories: ${categories.length}`);
    console.log(`- subcategories: ${subcategories.length}`);
    console.log(`- category_translations: ${categoryTranslations.length}`);
    console.log(`- subcategory_translations: ${subcategoryTranslations.length}`);
}

main();