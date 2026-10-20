
require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("<h1>F1 History Stats</h1><p>A szerver sikeresen elindult!</p>");
});

async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`A szerver elindult: http://localhost:${PORT}`);
    });
}

startServer();
