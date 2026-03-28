require("dotenv").config();
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_PATH en .env");
}

const absoluteServiceAccountPath = path.resolve(serviceAccountPath);

if (!fs.existsSync(absoluteServiceAccountPath)) {
    throw new Error(
        `No existe el archivo de service account en: ${absoluteServiceAccountPath}`
    );
}

const serviceAccount = require(absoluteServiceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const OUTPUT_DIR = path.resolve("data-migration/firestore-export");

const COLLECTIONS = [
    "locations",
    "categories",
    "establishments",
    "users",
    "admin_users",
    "audit_logs",
    "migration_logs",
    "translation_fix_logs",
];

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function serializeFirestoreValue(value) {
    if (value === null || value === undefined) return value;

    if (value instanceof admin.firestore.Timestamp) {
        return {
            _type: "timestamp",
            iso: value.toDate().toISOString(),
        };
    }

    if (value instanceof admin.firestore.GeoPoint) {
        return {
            _type: "geopoint",
            latitude: value.latitude,
            longitude: value.longitude,
        };
    }

    if (value instanceof admin.firestore.DocumentReference) {
        return {
            _type: "document_reference",
            path: value.path,
            id: value.id,
        };
    }

    if (Array.isArray(value)) {
        return value.map(serializeFirestoreValue);
    }

    if (typeof value === "object") {
        const result = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            result[key] = serializeFirestoreValue(nestedValue);
        }
        return result;
    }

    return value;
}

async function exportCollection(collectionName) {
    console.log(`Exportando collection: ${collectionName}`);

    const snapshot = await db.collection(collectionName).get();

    const docs = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
            id: doc.id,
            ...serializeFirestoreValue(data),
        };
    });

    const outputPath = path.join(OUTPUT_DIR, `${collectionName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2), "utf8");

    console.log(
        `✅ ${collectionName}: ${docs.length} documentos exportados a ${outputPath}`
    );
}

async function main() {
    ensureDir(OUTPUT_DIR);

    const report = {
        exportedAt: new Date().toISOString(),
        collections: [],
    };

    for (const collectionName of COLLECTIONS) {
        try {
            const snapshot = await db.collection(collectionName).get();
            const count = snapshot.size;

            await exportCollection(collectionName);

            report.collections.push({
                collection: collectionName,
                status: "ok",
                count,
            });
        } catch (error) {
            console.error(`❌ Error exportando ${collectionName}:`, error.message);

            report.collections.push({
                collection: collectionName,
                status: "error",
                error: error.message,
            });
        }
    }

    const reportPath = path.join(OUTPUT_DIR, "_export-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log("\nExportación terminada.");
    console.log(`Reporte: ${reportPath}`);
}

main().catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
});