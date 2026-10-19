
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("<h1>F1 History Stats</h1><p>A szerver sikeresen elindult!</p>");
});

app.listen(PORT, () => {
    console.log(`A szerver elindult: http://localhost:${PORT}`);
});
