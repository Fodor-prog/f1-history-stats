
require("dotenv").config();

const express = require("express");
const path = require("path");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// EJS sablonmotor beállítása
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Kezdőoldal
app.get("/", (req, res) => {
    res.render("index", {
        title: "F1 History Stats"
    });
});

// Adatbázis-kapcsolat és szerverindítás
async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`A szerver elindult: http://localhost:${PORT}`);
    });
}

startServer();
