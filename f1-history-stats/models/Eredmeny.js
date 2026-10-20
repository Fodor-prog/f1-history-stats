
const mongoose = require("mongoose");

const eredmenySchema = new mongoose.Schema({
    datum: {
        type: Date,
        required: true
    },
    pilotaaz: {
        type: Number,
        required: true
    },
    helyezes: {
        type: Number
    },
    hiba: {
        type: String
    },
    csapat: {
        type: String
    },
    tipus: {
        type: String
    },
    motor: {
        type: String
    }
});

module.exports = mongoose.model("Eredmeny", eredmenySchema);
