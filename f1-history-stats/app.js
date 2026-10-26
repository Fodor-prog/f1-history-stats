
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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ========================================
// SEGÉDFÜGGVÉNYEK
// ========================================

// Speciális karakterek kezelése a keresésben
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Magyar dátumformátum
function formatDate(value) {
    if (!value) {
        return "Nincs adat";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Nincs adat";
    }

    return date.toLocaleDateString("hu-HU", {
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

        const nagydijak = legutobbiNagydijak.map(gp => ({
            id: gp._id.toString(),
            nev: gp.nev,
            helyszin: gp.helyszin,
            datum: formatDate(gp.datum),
            ev: new Date(gp.datum).getUTCFullYear()
        }));

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
        const keres = String(req.query.keres || "")
            .trim()
            .slice(0, 100);

        const ev = String(req.query.ev || "").trim();

        const rendez = req.query.rendez === "regi"
            ? "regi"
            : "uj";

        const limit = 20;

        // Elérhető évszámok
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
        const filter = {};

        // Keresés
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

        // Évszám szűrése
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
            ? Math.min(Math.max(kertOldal, 1), osszesOldal)
            : 1;

        const sorrend = rendez === "regi" ? 1 : -1;

        const adatok = await Gp.find(filter)
            .sort({ datum: sorrend, _id: sorrend })
            .skip((oldal - 1) * limit)
            .limit(limit)
            .lean();

        const nagydijak = adatok.map(gp => ({
            id: gp._id.toString(),
            nev: gp.nev,
            helyszin: gp.helyszin,
            datum: formatDate(gp.datum),
            ev: new Date(gp.datum).getUTCFullYear()
        }));

        // Lapozási linkek
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
// PILÓTÁK OLDAL
// URL: /pilotak
// ========================================

app.get("/pilotak", async (req, res) => {
    try {
        // Keresési paraméterek
        const keres = String(req.query.keres || "")
            .trim()
            .slice(0, 100);

        const nemzet = String(req.query.nemzet || "")
            .trim()
            .slice(0, 100);

        const rendez = req.query.rendez === "za"
            ? "za"
            : "az";

        // Oldalanként 20 pilóta
        const limit = 20;

        // Nemzetiségek lekérdezése
        const nemzetisegek = (await Pilota.distinct("nemzet"))
            .filter(value =>
                typeof value === "string" &&
                value.trim() !== ""
            )
            .sort((a, b) => a.localeCompare(b, "hu"));

        // Szűrési feltételek
        const filter = {};

        // Név szerinti keresés
        if (keres) {
            filter.nev = {
                $regex: escapeRegex(keres),
                $options: "i"
            };
        }

        // Nemzetiség szerinti szűrés
        if (nemzet && nemzetisegek.includes(nemzet)) {
            filter.nemzet = nemzet;
        }

        // Találatok száma
        const osszesTalalat = await Pilota.countDocuments(filter);

        // Lapozás
        const osszesOldal = Math.max(
            1,
            Math.ceil(osszesTalalat / limit)
        );

        const kertOldal = Number.parseInt(
            String(req.query.oldal || "1"),
            10
        );

        const oldal = Number.isSafeInteger(kertOldal)
            ? Math.min(Math.max(kertOldal, 1), osszesOldal)
            : 1;

        // Rendezési sorrend
        const sorrend = rendez === "za" ? -1 : 1;

        // Pilóták lekérdezése az adatbázisból
        const adatok = await Pilota.find(filter)
            .sort({ nev: sorrend, _id: sorrend })
            .skip((oldal - 1) * limit)
            .limit(limit)
            .lean();

        // Megjelenítendő adatok
        const pilotak = adatok.map(pilota => ({
            id: pilota._id.toString(),
            az: pilota.az,
            nev: pilota.nev || "Ismeretlen",
            nemzet: pilota.nemzet || "Nincs adat",
            szuldat: formatDate(pilota.szuldat)
        }));

        // Lapozási linkek összeállítása
        const queryParams = new URLSearchParams();

        if (keres) {
            queryParams.set("keres", keres);
        }

        if (nemzet) {
            queryParams.set("nemzet", nemzet);
        }

        if (rendez !== "az") {
            queryParams.set("rendez", rendez);
        }

        const baseQuery = queryParams.toString();

        const pageUrl = pageNumber => {
            const params = new URLSearchParams(baseQuery);

            params.set("oldal", String(pageNumber));

            return `/pilotak?${params.toString()}`;
        };

        // Pilóták oldal megjelenítése
        res.render("pilotak", {
            title: "Pilóták | F1 History Stats",
            pilotak,
            nemzetisegek,
            keres,
            nemzet,
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
        console.error("Pilóták oldal hiba:", error.message);

        res.status(500).send(
            "Hiba történt a pilóták betöltése közben."
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
        await connectDB();

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



