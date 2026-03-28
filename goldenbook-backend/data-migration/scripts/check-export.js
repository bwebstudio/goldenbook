const fs = require("fs");
const path = require("path");

const dir = path.resolve("data-migration/firestore-export");

if (!fs.existsSync(dir)) {
    throw new Error(`No existe el directorio: ${dir}`);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

for (const file of files) {
    const fullPath = path.join(dir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
        console.log(`${file}: ${data.length} registros`);
    } else {
        console.log(`${file}: objeto`);
    }
}