const Gp = require("../models/Gp");
const Pilota = require("../models/Pilota");
const Eredmeny = require("../models/Eredmeny");

// ========================================
// PILÓTA STATISZTIKÁINAK LEKÉRDEZÉSE
// ========================================

async function getPilotaStats(pilota) {

    if (!pilota) {
        return null;
    }

    // A pilóta összes rögzített eredménye
    const osszesEredmeny = await Eredmeny.countDocuments({
        pilotaaz: pilota.az
    });

    // Győzelmek száma
    const gyozelmek = await Eredmeny.countDocuments({
        pilotaaz: pilota.az,
        helyezes: 1
    });

    // Dobogós helyezések száma
    const dobogok = await Eredmeny.countDocuments({
        pilotaaz: pilota.az,
        helyezes: {
            $in: [1, 2, 3]
        }
    });

    // Győzelmi arány százalékban
    const gyozelmiArany = osszesEredmeny > 0
        ? Number(
            (
                gyozelmek / osszesEredmeny * 100
            ).toFixed(1)
        )
        : 0;

    return {
        az: pilota.az,
        nev: pilota.nev,
        nemzet: pilota.nemzet || "Nincs adat",

        osszesEredmeny,
        gyozelmek,
        dobogok,
        gyozelmiArany
    };
}

// ========================================
// STATISZTIKÁK OLDAL
// ========================================

exports.statsGet = async (req, res) => {

    try {

        // ========================================
        // 1. MEGLÉVŐ NAGYDÍJSTATISZTIKÁK
        // ========================================

        const nagydijakEvente = await Gp.aggregate([
            {
                $group: {
                    _id: {
                        $year: {
                            date: "$datum",
                            timezone: "UTC"
                        }
                    },

                    darab: {
                        $sum: 1
                    }
                }
            },

            {
                $sort: {
                    _id: 1
                }
            }
        ]);

        // Diagram adatainak előkészítése
        const evek = nagydijakEvente.map(
            item => item._id
        );

        const darabszamok = nagydijakEvente.map(
            item => item.darab
        );

        // Összes nagydíj
        const osszesNagydij = darabszamok.reduce(
            (sum, value) => sum + value,
            0
        );

        // Versenyévek száma
        const evekSzama = evek.length;

        // Rekordév
        const legtobbNagydijAdat = nagydijakEvente.reduce(
            (max, item) => {

                if (!max || item.darab > max.darab) {
                    return item;
                }

                return max;
            },
            null
        );

        const legtobbNagydij = legtobbNagydijAdat
            ? {
                ev: legtobbNagydijAdat._id,
                darab: legtobbNagydijAdat.darab
            }
            : null;

        // ========================================
        // 2. PILÓTÁK LISTÁJÁNAK LEKÉRDEZÉSE
        // ========================================

        const pilotak = await Pilota.find()
            .select("az nev nemzet")
            .sort({
                nev: 1,
                az: 1
            })
            .lean();

        // ========================================
        // 3. KIVÁLASZTOTT PILÓTÁK
        // ========================================

        const pilota1Param = String(
            req.query.pilota1 || ""
        );

        const pilota2Param = String(
            req.query.pilota2 || ""
        );

        // Csak érvényes, pozitív egész azonosítók
        // fogadhatók el.

        const parsePilotaAz = value => {

            if (!/^\d+$/.test(value)) {
                return null;
            }

            const az = Number(value);

            return Number.isSafeInteger(az) && az > 0
                ? az
                : null;
        };

        const pilota1Az = parsePilotaAz(pilota1Param);
        const pilota2Az = parsePilotaAz(pilota2Param);

        // ========================================
        // 4. PILÓTÁK KIKERESÉSE
        // ========================================

        const pilota1 = pilota1Az === null
            ? null
            : pilotak.find(
                item => item.az === pilota1Az
            ) || null;

        const pilota2 = pilota2Az === null
            ? null
            : pilotak.find(
                item => item.az === pilota2Az
            ) || null;

        // ========================================
        // 5. ÖSSZEHASONLÍTÁS
        // ========================================

        let pilota1Stats = null;
        let pilota2Stats = null;

        let osszehasonlitasHiba = "";

        const vanValasztas =
            pilota1Param !== "" ||
            pilota2Param !== "";

        if (vanValasztas) {

            if (!pilota1 || !pilota2) {

                osszehasonlitasHiba =
                    "Válassz ki két érvényes pilótát!";

            } else if (pilota1.az === pilota2.az) {

                osszehasonlitasHiba =
                    "Két különböző pilótát válassz!";

            } else {

                // Két pilóta statisztikáinak
                // párhuzamos lekérdezése.

                [
                    pilota1Stats,
                    pilota2Stats
                ] = await Promise.all([
                    getPilotaStats(pilota1),
                    getPilotaStats(pilota2)
                ]);
            }
        }

        // ========================================
        // 6. DIAGRAMADATOK ELŐKÉSZÍTÉSE
        // ========================================

        const osszehasonlitasChart = {

            labels: [
                "Rögzített eredmények",
                "Győzelmek",
                "Dobogók"
            ],

            pilota1: pilota1Stats
                ? [
                    pilota1Stats.osszesEredmeny,
                    pilota1Stats.gyozelmek,
                    pilota1Stats.dobogok
                ]
                : [],

            pilota2: pilota2Stats
                ? [
                    pilota2Stats.osszesEredmeny,
                    pilota2Stats.gyozelmek,
                    pilota2Stats.dobogok
                ]
                : []

        };

        // ========================================
        // 7. EJS OLDAL MEGJELENÍTÉSE
        // ========================================

        return res.render("statisztikak", {

            title: "Statisztikák | F1 History Stats",

            // Korábbi diagram adatai
            evek,
            darabszamok,

            // Korábbi statisztikai kártyák
            osszesNagydij,
            evekSzama,
            legtobbNagydij,

            // Új pilótaválasztó
            pilotak,

            // Kiválasztott pilóták azonosítói
            pilota1Az,
            pilota2Az,

            // Új összehasonlítás
            pilota1Stats,
            pilota2Stats,

            // Diagramadatai
            osszehasonlitasChart,

            // Hibaüzenet
            osszehasonlitasHiba
        });

    } catch (error) {

        console.error(
            "Statisztikák lekérdezési hiba:",
            error.message
        );

        return res.status(500).send(
            "Hiba történt a statisztikák betöltése közben."
        );
    }
};
