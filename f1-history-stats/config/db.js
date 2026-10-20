
const mongoose = require("mongoose");

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Atlas kapcsolat sikeres!");
    } catch (error) {
        console.error("MongoDB kapcsolódási hiba:", error.message);
        process.exit(1);
    }
}

module.exports = connectDB;
