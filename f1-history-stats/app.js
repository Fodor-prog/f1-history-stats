
require("dotenv").config();

const express = require("express");
const path = require("path");
const connectDB = require("./config/db");

const Gp = require("./models/Gp");
const Pilota = require("./models/Pilota");
const Eredmeny = require("./models/Eredmeny");

const app = express();
const PORT = process.env.PORT || 3000;

// EJS sablonmotor
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Statikus fájlok (CSS, képek, JavaScript)
app.use(express.static(path.join(__dirname, "public")));

// Kezdőoldal
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
                .sort({ datum: -1 })
                .limit(6)
                .lean()
        ]);

        const nagydijak = legutobbiNagydijak.map(gp => ({
            id: gp._id.toString(),
            nev: gp.nev,
            helyszin: gp.helyszin,
            datum: new Date(gp.datum).toLocaleDateString(
                "hu-HU",
                {
                    timeZone: "UTC",
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                }
            ),
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
            "Hiba történt az adatok betöltése közben."
        );
    }
});

// Szerver indítása
async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(
            `A szerver elindult: http://localhost:${PORT}`
        );
    });
}

startServer();



