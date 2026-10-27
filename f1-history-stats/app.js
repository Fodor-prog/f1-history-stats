
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const connectDB = require("./config/db");

const Gp = require("./models/Gp");
const Pilota = require("./models/Pilota");
const Eredmeny = require("./models/Eredmeny");

const mainRouter = require("./routes/mainRouter");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// KÖRNYEZETI VÁLTOZÓK ELLENŐRZÉSE
// ========================================

if (!process.env.SESSION_SECRET) {
    throw new Error(
        "Hiányzik a SESSION_SECRET változó a .env fájlból!"
    );
}

if (!process.env.SESSION_MONGO_URI) {
    throw new Error(
        "Hiányzik a SESSION_MONGO_URI változó a .env fájlból!"
    );
}

// ========================================
// ALAPBEÁLLÍTÁSOK
// ========================================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ========================================
// SESSIONKEZELÉS
// TANANYAG: AUTENTIKÁCIÓ
// ========================================

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: process.env.SESSION_MONGO_URI,
            collectionName: "sessions"
        }),

        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production"
        }
    })
);

// ========================================
// EJS VÁLTOZÓK ÉS ÜZENETEK
// ========================================

app.use((req, res, next) => {
    // Az összes EJS-oldal elérheti a bejelentkezett
    // felhasználó adatait.
    res.locals.user = req.session.user || null;

    // Egyszer megjelenő sikeres vagy hibaüzenet.
    res.locals.message = req.session.message || "";

    // Az üzenetet csak egyszer jelenítjük meg.
    if (req.session.message) {
        delete req.session.message;
    }

    next();
});

// ========================================
// AUTENTIKÁCIÓS ROUTER
// ========================================

app.use("/", mainRouter);

// ========================================
// SEGÉDFÜGGVÉNYEK
// ========================================

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function getPageNumber(rawPage, totalPages) {
    const requestedPage = Number.parseInt(
        String(rawPage || "1"),
        10
    );

    if (!Number.isSafeInteger(requestedPage)) {
        return 1;
    }

    return Math.min(
        Math.max(requestedPage, 1),
        totalPages
    );
}

function createPageUrl(route, filters) {
    return pageNumber => {
        const params = new URLSearchParams(filters);
        params.set("oldal", String(pageNumber));

        return `${route}?${params.toString()}`;
    };
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
        console.error(
            "Kezdőoldal hiba:",
            error.message
        );

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

        const oldal = getPageNumber(
            req.query.oldal,
            osszesOldal
        );

        const sorrend = rendez === "regi" ? 1 : -1;

        const adatok = await Gp.find(filter)
            .sort({
                datum: sorrend,
                _id: sorrend
            })
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
            pageUrl: createPageUrl(
                "/nagydijak",
                queryParams
            )
        });

    } catch (error) {
        console.error(
            "Nagydíjak oldal hiba:",
            error.message
        );

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
        const keres = String(req.query.keres || "")
            .trim()
            .slice(0, 100);

        const nemzet = String(req.query.nemzet || "")
            .trim()
            .slice(0, 100);

        const rendez = req.query.rendez === "za"
            ? "za"
            : "az";

        const limit = 20;

        const nemzetisegek = (
            await Pilota.distinct("nemzet")
        )
            .filter(value =>
                typeof value === "string" &&
                value.trim() !== ""
            )
            .sort((a, b) =>
                a.localeCompare(b, "hu")
            );

        const filter = {};

        if (keres) {
            filter.nev = {
                $regex: escapeRegex(keres),
                $options: "i"
            };
        }

        if (
            nemzet &&
            nemzetisegek.includes(nemzet)
        ) {
            filter.nemzet = nemzet;
        }

        const osszesTalalat = await Pilota.countDocuments(filter);

        const osszesOldal = Math.max(
            1,
            Math.ceil(osszesTalalat / limit)
        );

        const oldal = getPageNumber(
            req.query.oldal,
            osszesOldal
        );

        const sorrend = rendez === "za" ? -1 : 1;

        const adatok = await Pilota.find(filter)
            .sort({
                nev: sorrend,
                _id: sorrend
            })
            .skip((oldal - 1) * limit)
            .limit(limit)
            .lean();

        const pilotak = adatok.map(pilota => ({
            id: pilota._id.toString(),
            az: pilota.az,
            nev: pilota.nev || "Ismeretlen",
            nemzet: pilota.nemzet || "Nincs adat",
            szuldat: formatDate(pilota.szuldat)
        }));

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
            pageUrl: createPageUrl(
                "/pilotak",
                queryParams
            )
        });

    } catch (error) {
        console.error(
            "Pilóták oldal hiba:",
            error.message
        );

        res.status(500).send(
            "Hiba történt a pilóták betöltése közben."
        );
    }
});

// ========================================
// VERSENYEREDMÉNYEK OLDAL
// URL: /eredmenyek
// ========================================

app.get("/eredmenyek", async (req, res) => {
    try {
        const keres = String(req.query.keres || "")
            .trim()
            .slice(0, 100);

        const ev = String(req.query.ev || "").trim();

        const rendez = req.query.rendez === "regi"
            ? "regi"
            : "uj";

        const limit = 20;

        const evAdatok = await Eredmeny.aggregate([
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

        if (keres) {
            const regex = new RegExp(
                escapeRegex(keres),
                "i"
            );

            const talaltPilotak = await Pilota.find({
                nev: regex
            })
                .select("az")
                .lean();

            const pilotaAzonositok = talaltPilotak.map(
                pilota => pilota.az
            );

            filter.$or = [
                {
                    pilotaaz: {
                        $in: pilotaAzonositok
                    }
                },
                {
                    csapat: regex
                }
            ];
        }

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

        const osszesTalalat = await Eredmeny.countDocuments(filter);

        const osszesOldal = Math.max(
            1,
            Math.ceil(osszesTalalat / limit)
        );

        const oldal = getPageNumber(
            req.query.oldal,
            osszesOldal
        );

        const sorrend = rendez === "regi" ? 1 : -1;

        const adatok = await Eredmeny.find(filter)
            .sort({
                datum: sorrend,
                _id: sorrend
            })
            .skip((oldal - 1) * limit)
            .limit(limit)
            .lean();

        const pilotaAzonositok = [
            ...new Set(
                adatok.map(item => item.pilotaaz)
            )
        ];

        const pilotak = await Pilota.find({
            az: {
                $in: pilotaAzonositok
            }
        })
            .select("az nev")
            .lean();

        const pilotaNevek = new Map(
            pilotak.map(pilota => [
                pilota.az,
                pilota.nev
            ])
        );

        const eredmenyek = adatok.map(item => ({
            id: item._id.toString(),
            datum: formatDate(item.datum),
            ev: new Date(item.datum).getUTCFullYear(),
            pilota: pilotaNevek.get(item.pilotaaz)
                || `Ismeretlen pilóta (${item.pilotaaz})`,
            helyezes: item.helyezes ?? null,
            hiba: item.hiba || "",
            csapat: item.csapat || "Nincs adat",
            tipus: item.tipus || "Nincs adat",
            motor: item.motor || "Nincs adat"
        }));

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

        res.render("eredmenyek", {
            title: "Versenyeredmények | F1 History Stats",
            eredmenyek,
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
            pageUrl: createPageUrl(
                "/eredmenyek",
                queryParams
            )
        });

    } catch (error) {
        console.error(
            "Versenyeredmények oldal hiba:",
            error.message
        );

        res.status(500).send(
            "Hiba történt az eredmények betöltése közben."
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
