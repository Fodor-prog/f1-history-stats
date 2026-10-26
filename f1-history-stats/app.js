
require("dotenv").config();

const express = require("express");
const path = require("path");
const connectDB = require("./config/db");

const Gp = require("./models/Gp");
const Pilota = require("./models/Pilota");
const Eredmeny = require("./models/Eredmeny");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// ALAPBEÁLLÍTÁSOK
// ========================================

// EJS sablonmotor beállítása
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Statikus fájlok (CSS, képek, JavaScript)
app.use(express.static(path.join(__dirname, "public")));

// Űrlapadatok feldolgozásának előkészítése
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ========================================
// SEGÉDFÜGGVÉNYEK
// ========================================

// Speciális karakterek kezelése kereséskor
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Dátum megjelenítése magyar formátumban
function formatDate(value) {
    return new Date(value).toLocaleDateString("hu-HU", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// ========================================
// FŐOLDAL
// URL: /
// ========================================

app.get("/", async (req, res) => {
    try {
        // Adatok lekérdezése a MongoDB Atlasból
        const [
            gpCount,
            pilotaCount,
            eredmenyCount,
            legutobbiNagydijak
        ] = await Promise.all([
            Gp.countDocuments(),
            Pilota.countDocuments(),
            Eredmeny.countDocuments(),
            Gp.find()
                .sort({ datum: -1, _id: -1 })
                .limit(6)
                .lean()
        ]);

        // A nagydíjak adatainak előkészítése
        const nagydijak = legutobbiNagydijak.map(gp => ({
            id: gp._id.toString(),
            nev: gp.nev,
            helyszin: gp.helyszin,
            datum: formatDate(gp.datum),
            ev: new Date(gp.datum).getUTCFullYear()
        }));

        // Főoldal megjelenítése
        res.render("index", {
            title: "F1 History Stats | Forma–1 történelem",

            stats: {
                nagydijak: gpCount,
                pilotak: pilotaCount,
                eredmenyek: eredmenyCount
            },

            nagydijak
        });

    } catch (error) {
        console.error("Kezdőoldal hiba:", error.message);

        res.status(500).send(
            "Hiba történt a kezdőoldal betöltése közben."
        );
    }
});

// ========================================
// NAGYDÍJAK OLDAL
// URL: /nagydijak
// ========================================

app.get("/nagydijak", async (req, res) => {
    try {
        // Keresési paraméterek
        const keres = String(req.query.keres || "")
            .trim()
            .slice(0, 100);

        const ev = String(req.query.ev || "").trim();

        const rendez = req.query.rendez === "regi"
            ? "regi"
            : "uj";

        // Oldalanként megjelenített nagydíjak
        const limit = 20;

        // ========================================
        // ÉVSZÁMOK LEKÉRDEZÉSE
        // ========================================

        const evAdatok = await Gp.aggregate([
            {
                $project: {
                    ev: {
                        $year: {
                            date: "$datum",
                            timezone: "UTC"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$ev"
                }
            },
            {
                $sort: {
                    _id: -1
                }
            }
        ]);

        const evek = evAdatok.map(item => item._id);

        // ========================================
        // SZŰRÉSI FELTÉTELEK
        // ========================================

        const filter = {};

        // Keresés nagydíjnév és helyszín alapján
        if (keres) {
            const keresettSzoveg = escapeRegex(keres);

            filter.$or = [
                {
                    nev: {
                        $regex: keresettSzoveg,
                        $options: "i"
                    }
                },
                {
                    helyszin: {
                        $regex: keresettSzoveg,
                        $options: "i"
                    }
                }
            ];
        }

        // Szűrés évszám alapján
        if (
            /^\d{4}$/.test(ev) &&
            evek.includes(Number(ev))
        ) {
            const year = Number(ev);

            filter.datum = {
                $gte: new Date(Date.UTC(year, 0, 1)),
                $lt: new Date(Date.UTC(year + 1, 0, 1))
            };
        }

        // ========================================
        // TALÁLATOK SZÁMA ÉS LAPOZÁS
        // ========================================

        const osszesTalalat = await Gp.countDocuments(filter);

        const osszesOldal = Math.max(
            1,
            Math.ceil(osszesTalalat / limit)
        );

        const kertOldal = Number.parseInt(
            String(req.query.oldal || "1"),
            10
        );

        const oldal = Number.isSafeInteger(kertOldal)
            ? Math.min(
                Math.max(kertOldal, 1),
                osszesOldal
            )
            : 1;

        // ========================================
        // RENDEZÉS
        // ========================================

        const sorrend = rendez === "regi" ? 1 : -1;

        // ========================================
        // NAGYDÍJAK LEKÉRDEZÉSE
        // ========================================

        const adatok = await Gp.find(filter)
            .sort({
                datum: sorrend,
                _id: sorrend
            })
            .skip((oldal - 1) * limit)
            .limit(limit)
            .lean();

        // Dátumok formázása
        const nagydijak = adatok.map(gp => ({
            id: gp._id.toString(),
            nev: gp.nev,
            helyszin: gp.helyszin,
            datum: formatDate(gp.datum),
            ev: new Date(gp.datum).getUTCFullYear()
        }));

        // ========================================
        // LAPOZÁSI LINKEK
        // ========================================

        const queryParams = new URLSearchParams();

        if (keres) {
            queryParams.set("keres", keres);
        }

        if (ev) {
            queryParams.set("ev", ev);
        }

        if (rendez !== "uj") {
            queryParams.set("rendez", rendez);
        }

        const baseQuery = queryParams.toString();

        const pageUrl = pageNumber => {
            const params = new URLSearchParams(baseQuery);

            params.set("oldal", String(pageNumber));

            return `/nagydijak?${params.toString()}`;
        };

        // ========================================
        // NAGYDÍJAK OLDAL MEGJELENÍTÉSE
        // ========================================

        res.render("nagydijak", {
            title: "Nagydíjak | F1 History Stats",

            nagydijak,
            evek,
            keres,
            ev,
            rendez,

            oldal,
            osszesOldal,
            osszesTalalat,

            elsoTalalat: osszesTalalat === 0
                ? 0
                : (oldal - 1) * limit + 1,

            utolsoTalalat: Math.min(
                oldal * limit,
                osszesTalalat
            ),

            pageUrl
        });

    } catch (error) {
        console.error("Nagydíjak oldal hiba:", error.message);

        res.status(500).send(
            "Hiba történt a nagydíjak betöltése közben."
        );
    }
});

// ========================================
// 404 – NEM LÉTEZŐ OLDAL
// ========================================

app.use((req, res) => {
    res.status(404).send(
        "404 – A keresett oldal nem található."
    );
});

// ========================================
// ADATBÁZIS ÉS SZERVER INDÍTÁSA
// ========================================

async function startServer() {
    try {
        // MongoDB Atlas kapcsolat
        await connectDB();

        // Express szerver indítása
        app.listen(PORT, () => {
            console.log(
                `A szerver elindult: http://localhost:${PORT}`
            );
        });

    } catch (error) {
        console.error(
            "Szerverindítási hiba:",
            error.message
        );

        process.exit(1);
    }
}

startServer();



