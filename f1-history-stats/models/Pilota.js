
const mongoose = require("mongoose");

const pilotaSchema = new mongoose.Schema({
    az: {
        type: Number,
        required: true,
        unique: true
    },
    nev: {
        type: String,
        required: true
    },
    nem: {
        type: String
    },
    szuldat: {
        type: Date
    },
    nemzet: {
        type: String
    }
});

module.exports = mongoose.model("Pilota", pilotaSchema);
