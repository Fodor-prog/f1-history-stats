
const mongoose = require("mongoose");

const gpSchema = new mongoose.Schema({
    datum: {
        type: Date,
        required: true
    },
    nev: {
        type: String,
        required: true
    },
    helyszin: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("Gp", gpSchema);
