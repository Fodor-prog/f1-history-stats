
const Message = require("../models/Message");

// ========================================
// KAPCSOLATFELVÉTELI OLDAL
// ========================================

exports.contactGet = (req, res) => {
    res.render("contact", {
        title: "Kapcsolat | F1 History Stats",
        errors: [],
        formData: {
            name: "",
            email: "",
            subject: "",
            message: ""
        },
        success: false
    });
};

// ========================================
// KAPCSOLATFELVÉTEL FELDOLGOZÁSA
// ========================================

exports.contactPost = async (req, res) => {
    const formData = {
        name: String(req.body.name || "").trim(),
        email: String(req.body.email || "").trim(),
        subject: String(req.body.subject || "").trim(),
        message: String(req.body.message || "").trim()
    };

    const errors = [];

    // Kötelező mezők ellenőrzése
    if (!formData.name) {
        errors.push("A név megadása kötelező.");
    }

    if (!formData.email) {
        errors.push("Az e-mail-cím megadása kötelező.");
    }

    if (!formData.subject) {
        errors.push("A tárgy megadása kötelező.");
    }

    if (!formData.message) {
        errors.push("Az üzenet megadása kötelező.");
    }

    // E-mail-cím formátumának ellenőrzése
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (formData.email && !emailRegex.test(formData.email)) {
        errors.push("Érvénytelen e-mail-cím.");
    }

    // Megengedett karakterszámok
    if (formData.name.length > 100) {
        errors.push("A név legfeljebb 100 karakter lehet.");
    }

    if (formData.email.length > 254) {
        errors.push("Az e-mail-cím túl hosszú.");
    }

    if (formData.subject.length > 150) {
        errors.push("A tárgy legfeljebb 150 karakter lehet.");
    }

    if (formData.message.length > 5000) {
        errors.push("Az üzenet legfeljebb 5000 karakter lehet.");
    }

    // Hibás adatok esetén az űrlap újbóli megjelenítése
    if (errors.length > 0) {
        return res.status(400).render("contact", {
            title: "Kapcsolat | F1 History Stats",
            errors,
            formData,
            success: false
        });
    }

    // Üzenet mentése MongoDB-be
    try {
        await Message.create(formData);

        return res.status(201).render("contact", {
            title: "Kapcsolat | F1 History Stats",
            errors: [],
            formData: {
                name: "",
                email: "",
                subject: "",
                message: ""
            },
            success: true
        });

    } catch (error) {
        console.error(
            "Kapcsolatfelvételi hiba:",
            error.message
        );

        return res.status(500).render("contact", {
            title: "Kapcsolat | F1 History Stats",
            errors: [
                "Hiba történt az üzenet mentése közben."
            ],
            formData,
            success: false
        });
    }
};

// ========================================
// BEÉRKEZETT ÜZENETEK LISTÁJA
// ========================================

exports.messagesGet = async (req, res) => {
    try {
        // Legújabb üzenetek előre
        const messages = await Message.find()
            .sort({ createdAt: -1, _id: -1 })
            .lean();

        return res.render("messages", {
            title: "Beérkezett üzenetek | F1 History Stats",
            messages
        });

    } catch (error) {
        console.error(
            "Üzenetek lekérdezési hiba:",
            error.message
        );

        return res.status(500).send(
            "Hiba történt az üzenetek betöltése közben."
        );
    }
};
