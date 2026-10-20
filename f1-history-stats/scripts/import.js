
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Gp = require("../models/Gp");
const Pilota = require("../models/Pilota");
const Eredmeny = require("../models/Eredmeny");

// Dátum átalakítása
function parseDate(value) {
    if (!value || !value.trim()) {
        return null;
    }

    const [year, month, day] = value.trim().split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

// TXT fájl beolvasása, fejléc kihagyásával
function readTxt(filename) {
    const filePath = path.join(__dirname, "../adatok", filename);
    const content = fs.readFileSync(filePath, "utf8");

    return content
        .split(/\r?\n/)
        .slice(1)
        .filter(line => line.trim() !== "");
}

async function importData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Atlas kapcsolat sikeres!");

        // 1. Nagydíjak importálása
        const gpLines = readTxt("gp.txt");

        const grandPrix = gpLines.map(line => {
            const [datum, nev, helyszin] = line.split("\t");

            return {
                datum: parseDate(datum),
                nev: nev.trim(),
                helyszin: helyszin.trim()
            };
        });

        console.log(`Beolvasott nagydíjak: ${grandPrix.length}`);

        if (await Gp.countDocuments() === 0) {
            await Gp.insertMany(grandPrix);
            console.log("A nagydíjak importálása sikeres!");
        } else {
            console.log("A nagydíjak már szerepelnek az adatbázisban.");
        }

        // 2. Pilóták importálása
        const pilotaLines = readTxt("pilota.txt");

        const pilotak = pilotaLines.map(line => {
            const [az, nev, nem, szuldat, nemzet] = line.split("\t");

            return {
                az: Number(az),
                nev: nev.trim(),
                nem: nem?.trim() || "",
                szuldat: parseDate(szuldat),
                nemzet: nemzet?.trim() || ""
            };
        });

        console.log(`Beolvasott pilóták: ${pilotak.length}`);

        if (await Pilota.countDocuments() === 0) {
            await Pilota.insertMany(pilotak);
            console.log("A pilóták importálása sikeres!");
        } else {
            console.log("A pilóták már szerepelnek az adatbázisban.");
        }

        // 3. Versenyeredmények importálása
        const eredmenyLines = readTxt("eredmeny.txt");

        const eredmenyek = eredmenyLines.map(line => {
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

        console.log(`Beolvasott versenyeredmények: ${eredmenyek.length}`);

        if (await Eredmeny.countDocuments() === 0) {
            await Eredmeny.insertMany(eredmenyek);
            console.log("A versenyeredmények importálása sikeres!");
        } else {
            console.log("A versenyeredmények már szerepelnek az adatbázisban.");
        }

    } catch (error) {
        console.error("Importálási hiba:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

importData();
