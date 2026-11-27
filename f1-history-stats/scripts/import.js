require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Gp = require("../models/Gp");
const Pilota = require("../models/Pilota");
const Eredmeny = require("../models/Eredmeny");

const APPLY = process.argv.includes("--apply");
const HIBAS_KARAKTER = "\uFFFD";

// Dátum átalakítása
function parseDate(value) {
    if (!value || !value.trim()) {
        return null;
    }

    const [year, month, day] = value.trim().split(".").map(Number);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Érvénytelen dátum: ${value}`);
    }

    return date;
}

// Dátum egységesítése
function dateKey(value) {
    return value
        ? new Date(value).toISOString().slice(0, 10)
        : "";
}

// TXT-fájl beolvasása UTF-8 kódolással
function readTxt(filename) {
    const filePath = path.join(__dirname, "../adatok", filename);

    const content = fs.readFileSync(filePath, "utf8")
        .replace(/^\uFEFF/, "");

    if (content.includes(HIBAS_KARAKTER)) {
        throw new Error(
            `A(z) ${filename} fájl hibás karaktereket tartalmaz!`
        );
    }

    return content
        .split(/\r?\n/)
        .slice(1)
        .filter(line => line.trim() !== "");
}

// Nagydíjak
function readGp() {
    return readTxt("gp.txt").map(line => {
        const [datum, nev, helyszin] = line.split("\t");

        return {
            datum: parseDate(datum),
            nev: nev.trim(),
            helyszin: helyszin.trim()
        };
    });
}

// Pilóták
function readPilota() {
    return readTxt("pilota.txt").map(line => {
        const [az, nev, nem, szuldat, nemzet] = line.split("\t");

        return {
            az: Number(az),
            nev: nev.trim(),
            nem: nem?.trim() || "",
            szuldat: parseDate(szuldat),
            nemzet: nemzet?.trim() || ""
        };
    });
}

// Versenyeredmények
function readEredmeny() {
    return readTxt("eredmeny.txt").map(line => {
        const [
            datum,
            pilotaaz,
            helyezes,
            hiba,
            csapat,
            tipus,
            motor
        ] = line.split("\t");

        return {
            datum: parseDate(datum),
            pilotaaz: Number(pilotaaz),
            helyezes: helyezes?.trim()
                ? Number(helyezes)
                : null,
            hiba: hiba?.trim() || "",
            csapat: csapat?.trim() || "",
            tipus: tipus?.trim() || "",
            motor: motor?.trim() || ""
        };
    });
}

// Rekordok csoportosítása azonosító alapján
function createIndex(records, getKey) {
    const index = new Map();

    for (const record of records) {
        const key = getKey(record);

        if (!index.has(key)) {
            index.set(key, []);
        }

        index.get(key).push(record);
    }

    return index;
}

// Szöveg összehasonlítása hibás karakterek esetén
function matchesText(current, source) {
    if (current === source) {
        return true;
    }

    if (
        typeof current !== "string" ||
        typeof source !== "string" ||
        !current.includes(HIBAS_KARAKTER)
    ) {
        return false;
    }

    const escapeRegex = value =>
        value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const pattern = current
        .split(HIBAS_KARAKTER)
        .map(escapeRegex)
        .join(".");

    return new RegExp(`^${pattern}$`, "u").test(source);
}

// Teljesen azonos, hibátlan rekordcsoport ellenőrzése
function isIdenticalCleanGroup(
    sourceGroup,
    databaseGroup,
    fields,
    extraFields
) {
    const allFields = [...extraFields, ...fields];

    const signature = record =>
        JSON.stringify(allFields.map(field => record[field]));

    const sourceSignatures = sourceGroup
        .map(signature)
        .sort();

    const databaseSignatures = databaseGroup
        .map(signature)
        .sort();

    const hasBrokenCharacters = databaseGroup.some(record =>
        fields.some(field =>
            typeof record[field] === "string" &&
            record[field].includes(HIBAS_KARAKTER)
        )
    );

    return (
        !hasBrokenCharacters &&
        JSON.stringify(sourceSignatures) ===
        JSON.stringify(databaseSignatures)
    );
}

// Egy gyűjtemény javításának előkészítése
async function prepareFix(
    title,
    Model,
    sourceRecords,
    getKey,
    fields,
    extraFields = []
) {
    console.log(`\n========== ${title} ==========`);

    const databaseRecords = await Model.find().lean();

    console.log("TXT rekordok:", sourceRecords.length);
    console.log("MongoDB rekordok:", databaseRecords.length);

    if (sourceRecords.length !== databaseRecords.length) {
        throw new Error(
            `${title}: eltérő rekordszám!`
        );
    }

    const sourceIndex = createIndex(sourceRecords, getKey);
    const databaseIndex = createIndex(databaseRecords, getKey);

    const sourceKeys = [...sourceIndex.keys()].sort();
    const databaseKeys = [...databaseIndex.keys()].sort();

    if (
        JSON.stringify(sourceKeys) !==
        JSON.stringify(databaseKeys)
    ) {
        throw new Error(
            `${title}: a TXT és az adatbázis azonosítói eltérnek!`
        );
    }

    const operations = [];

    let javitandoMezok = 0;
    let bizonytalan = 0;
    let azonosCsoportok = 0;
    let elteroDeNemHibas = 0;

    for (const [key, databaseGroup] of databaseIndex) {
        const sourceGroup = sourceIndex.get(key);

        if (databaseGroup.length !== sourceGroup.length) {
            throw new Error(
                `${title}: eltérő rekordmennyiség: ${key}`
            );
        }

        // Azonos és hibátlan rekordok esetén nincs mit javítani.
        // Ez kezeli a teljesen egyforma duplikált rekordokat is.
        if (
            isIdenticalCleanGroup(
                sourceGroup,
                databaseGroup,
                fields,
                extraFields
            )
        ) {
            azonosCsoportok++;
            continue;
        }

        const parositasok = [];
        const hasznaltForrasok = new Set();

        let csoportBizonytalan = false;

        for (const current of databaseGroup) {
            const jeloltek = sourceGroup
                .map((source, index) => ({ source, index }))
                .filter(({ source }) => {
                    // A helyezés és más azonosítómezők
                    // pontos egyezése kötelező.
                    for (const field of extraFields) {
                        if (current[field] !== source[field]) {
                            return false;
                        }
                    }

                    return fields.every(field =>
                        matchesText(current[field], source[field])
                    );
                });

            if (jeloltek.length !== 1) {
                bizonytalan++;
                csoportBizonytalan = true;

                console.log(
                    `Bizonytalan rekord: ${key}, ` +
                    `jelöltek: ${jeloltek.length}`
                );

                continue;
            }

            const jelolt = jeloltek[0];

            if (hasznaltForrasok.has(jelolt.index)) {
                bizonytalan++;
                csoportBizonytalan = true;

                console.log(
                    `Többszörös párosítás: ${key}`
                );

                continue;
            }

            hasznaltForrasok.add(jelolt.index);

            parositasok.push({
                current,
                source: jelolt.source
            });
        }

        if (
            csoportBizonytalan ||
            parositasok.length !== databaseGroup.length
        ) {
            continue;
        }

        for (const { current, source } of parositasok) {
            const changes = {};
            const originalValues = {};

            for (const field of fields) {
                if (current[field] === source[field]) {
                    continue;
                }

                if (
                    typeof current[field] === "string" &&
                    current[field].includes(HIBAS_KARAKTER)
                ) {
                    changes[field] = source[field];
                    originalValues[field] = current[field];
                } else {
                    elteroDeNemHibas++;
                }
            }

            if (Object.keys(changes).length > 0) {
                javitandoMezok += Object.keys(changes).length;

                operations.push({
                    updateOne: {
                        filter: {
                            _id: current._id,
                            ...originalValues
                        },
                        update: {
                            $set: changes
                        }
                    }
                });

                if (operations.length <= 10) {
                    console.log(`\nJavítandó rekord: ${key}`);

                    for (const field of Object.keys(changes)) {
                        console.log(
                            `${field}: ` +
                            `${originalValues[field]} → ${changes[field]}`
                        );
                    }
                }
            }
        }
    }

    console.log("\nÖSSZESÍTÉS");
    console.log("Javítandó rekordok:", operations.length);
    console.log("Javítandó mezők:", javitandoMezok);
    console.log("Bizonytalan párosítások:", bizonytalan);
    console.log("Változatlan rekordcsoportok:", azonosCsoportok);
    console.log(
        "Hibás karakter nélküli eltérések:",
        elteroDeNemHibas
    );

    return {
        title,
        Model,
        operations,
        bizonytalan,
        elteroDeNemHibas
    };
}

// Főprogram
async function main() {
    try {
        console.log("F1 HISTORY STATS – KARAKTERJAVÍTÁS");
        console.log("----------------------------------");

        console.log(
            APPLY
                ? "ÜZEMMÓD: TÉNYLEGES JAVÍTÁS"
                : "ÜZEMMÓD: ELŐNÉZET"
        );

        const gpData = readGp();
        const pilotaData = readPilota();
        const eredmenyData = readEredmeny();

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB Atlas kapcsolat sikeres!");

        const tervek = [];

        tervek.push(
            await prepareFix(
                "NAGYDÍJAK",
                Gp,
                gpData,
                item => dateKey(item.datum),
                ["nev", "helyszin"]
            )
        );

        tervek.push(
            await prepareFix(
                "PILÓTÁK",
                Pilota,
                pilotaData,
                item => String(item.az),
                ["nev", "nem", "nemzet"]
            )
        );

        tervek.push(
            await prepareFix(
                "VERSENYEREDMÉNYEK",
                Eredmeny,
                eredmenyData,
                item =>
                    `${dateKey(item.datum)}_${item.pilotaaz}`,
                ["hiba", "csapat", "tipus", "motor"],
                ["helyezes"]
            )
        );

        const osszesBizonytalan = tervek.reduce(
            (sum, terv) => sum + terv.bizonytalan,
            0
        );

        const osszesEgyebElteres = tervek.reduce(
            (sum, terv) => sum + terv.elteroDeNemHibas,
            0
        );

        const osszesJavitando = tervek.reduce(
            (sum, terv) => sum + terv.operations.length,
            0
        );

        console.log("\n==================================");
        console.log("TELJES ÖSSZESÍTÉS");
        console.log("Javítandó rekordok:", osszesJavitando);
        console.log("Bizonytalan párosítások:", osszesBizonytalan);
        console.log(
            "Egyéb eltérések:",
            osszesEgyebElteres
        );

        if (!APPLY) {
            console.log("ELŐNÉZET: az adatbázis nem módosult.");
            return;
        }

        // Egyetlen bizonytalan párosítás esetén sem írunk.
        if (
            osszesBizonytalan > 0 ||
            osszesEgyebElteres > 0
        ) {
            throw new Error(
                "Bizonytalan párosítás vagy egyéb eltérés miatt " +
                "a teljes javítás megszakadt."
            );
        }

        for (const terv of tervek) {
            if (terv.operations.length === 0) {
                continue;
            }

            const result = await terv.Model.bulkWrite(
                terv.operations,
                { ordered: true }
            );

            console.log(
                `${terv.title}: ${result.modifiedCount} rekord javítva.`
            );

            if (result.matchedCount !== terv.operations.length) {
                throw new Error(
                    `${terv.title}: nem minden rekord frissült!`
                );
            }
        }

        console.log("\nA karakterjavítás befejeződött.");

    } catch (error) {
        console.error("Hiba:", error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

main();