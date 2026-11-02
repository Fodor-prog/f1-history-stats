
const mongoose = require("mongoose");
const Gp = require("../models/Gp");

// ========================================
// ADMIN JOGOSULTSÁG ELLENŐRZÉSE
// ========================================

function checkAdmin(req, res) {

    if (
        !req.session ||
        !req.session.user ||
        req.session.user.role !== "admin"
    ) {

        res.status(403).send(
            "Hozzáférés megtagadva. Admin jogosultság szükséges."
        );

        return false;
    }

    return true;
}

// ========================================
// DÁTUM ELLENŐRZÉSE
// ========================================

function parseDate(value) {

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return null;
    }

    const date = new Date(
        value + "T00:00:00.000Z"
    );

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (
        date.toISOString().slice(0, 10) !== value
    ) {
        return null;
    }

    return date;
}

// ========================================
// NAGYDÍJ ADATOK ELLENŐRZÉSE
// ========================================

function validateGp(body) {

    const nev = typeof body.nev === "string"
        ? body.nev.trim()
        : "";

    const helyszin = typeof body.helyszin === "string"
        ? body.helyszin.trim()
        : "";

    const datum = parseDate(body.datum);

    if (!nev || !helyszin || !datum) {

        return {
            error:
                "Minden mező kitöltése kötelező, érvényes dátummal."
        };
    }

    if (nev.length > 150) {

        return {
            error:
                "A nagydíj neve legfeljebb 150 karakter lehet."
        };
    }

    if (helyszin.length > 150) {

        return {
            error:
                "A helyszín legfeljebb 150 karakter lehet."
        };
    }

    return {
        data: {
            nev,
            helyszin,
            datum
        }
    };
}

// ========================================
// ŰRLAPADATOK ELŐKÉSZÍTÉSE
// ========================================

function getFormData(body, id = null) {

    return {
        _id: id,

        nev: typeof body.nev === "string"
            ? body.nev
            : "",

        helyszin: typeof body.helyszin === "string"
            ? body.helyszin
            : "",

        datum: typeof body.datum === "string"
            ? body.datum
            : ""
    };
}

// ========================================
// ŰRLAP MEGJELENÍTÉSE HIBA ESETÉN
// ========================================

function renderFormError(
    req,
    res,
    {
        status = 400,
        isEdit = false,
        id = null,
        error
    }
) {

    return res.status(status).render(
        "admin/gp-form",
        {

            title: isEdit
                ? "Nagydíj szerkesztése | Admin"
                : "Új nagydíj | Admin",

            isEdit,

            gp: getFormData(req.body, id),

            error,

            // A korábbi GET kérés során létrehozott
            // CSRF-token továbbra is érvényes.
            csrfToken: req.session.adminCsrfToken

        }
    );
}

// ========================================
// READ - NAGYDÍJAK LISTÁZÁSA
// ========================================

exports.gpList = async (req, res) => {

    if (!checkAdmin(req, res)) return;

    try {

        const nagydijak = await Gp.find()
            .sort({
                datum: -1,
                _id: -1
            })
            .lean();

        return res.render(
            "admin/gp-list",
            {

                title:
                    "Nagydíjak kezelése | Admin",

                nagydijak,

                error: req.query.error || "",

                success: req.query.success || "",

                csrfToken:
                    req.session.adminCsrfToken

            }
        );

    } catch (error) {

        console.error(
            "Admin nagydíj lista hiba:",
            error
        );

        return res.status(500).send(
            "Hiba történt a nagydíjak lekérdezésekor."
        );
    }
};

// ========================================
// CREATE - ÚJ NAGYDÍJ ŰRLAP
// ========================================

exports.gpCreateGet = (req, res) => {

    if (!checkAdmin(req, res)) return;

    return res.render(
        "admin/gp-form",
        {

            title:
                "Új nagydíj | Admin",

            isEdit: false,

            gp: {
                nev: "",
                helyszin: "",
                datum: ""
            },

            error: "",

            csrfToken:
                req.session.adminCsrfToken

        }
    );
};

// ========================================
// CREATE - ÚJ NAGYDÍJ MENTÉSE
// ========================================

exports.gpCreatePost = async (req, res) => {

    if (!checkAdmin(req, res)) return;

    const validation = validateGp(req.body);

    if (validation.error) {

        return renderFormError(
            req,
            res,
            {
                isEdit: false,
                error: validation.error
            }
        );
    }

    try {

        await Gp.create(
            validation.data
        );

        return res.redirect(
            "/admin/nagydijak?success=created"
        );

    } catch (error) {

        console.error(
            "Nagydíj létrehozási hiba:",
            error
        );

        return renderFormError(
            req,
            res,
            {
                status: 500,
                isEdit: false,
                error:
                    "Nem sikerült létrehozni a nagydíjat."
            }
        );
    }
};

// ========================================
// UPDATE - SZERKESZTŐ ŰRLAP
// ========================================

exports.gpEditGet = async (req, res) => {

    if (!checkAdmin(req, res)) return;

    if (
        !mongoose.isValidObjectId(
            req.params.id
        )
    ) {

        return res.status(400).send(
            "Érvénytelen nagydíj-azonosító."
        );
    }

    try {

        const gp = await Gp.findById(
            req.params.id
        ).lean();

        if (!gp) {

            return res.status(404).send(
                "A nagydíj nem található."
            );
        }

        return res.render(
            "admin/gp-form",
            {

                title:
                    "Nagydíj szerkesztése | Admin",

                isEdit: true,

                gp: {

                    _id: gp._id,

                    nev: gp.nev,

                    helyszin: gp.helyszin,

                    datum: gp.datum
                        ? new Date(gp.datum)
                            .toISOString()
                            .slice(0, 10)
                        : ""
                },

                error: "",

                csrfToken:
                    req.session.adminCsrfToken

            }
        );

    } catch (error) {

        console.error(
            "Nagydíj lekérdezési hiba:",
            error
        );

        return res.status(500).send(
            "Nem sikerült betölteni a nagydíjat."
        );
    }
};

// ========================================
// UPDATE - MÓDOSÍTÁS MENTÉSE
// ========================================

exports.gpEditPost = async (req, res) => {

    if (!checkAdmin(req, res)) return;

    if (
        !mongoose.isValidObjectId(
            req.params.id
        )
    ) {

        return res.status(400).send(
            "Érvénytelen nagydíj-azonosító."
        );
    }

    const validation = validateGp(
        req.body
    );

    if (validation.error) {

        return renderFormError(
            req,
            res,
            {

                isEdit: true,

                id: req.params.id,

                error: validation.error

            }
        );
    }

    try {

        const gp =
            await Gp.findByIdAndUpdate(

                req.params.id,

                {
                    $set: validation.data
                },

                {
                    new: true,
                    runValidators: true
                }

            );

        if (!gp) {

            return res.status(404).send(
                "A nagydíj nem található."
            );
        }

        return res.redirect(
            "/admin/nagydijak?success=updated"
        );

    } catch (error) {

        console.error(
            "Nagydíj módosítási hiba:",
            error
        );

        return renderFormError(
            req,
            res,
            {

                status: 500,

                isEdit: true,

                id: req.params.id,

                error:
                    "Nem sikerült módosítani a nagydíjat."

            }
        );
    }
};

// ========================================
// DELETE - NAGYDÍJ TÖRLÉSE
// ========================================

exports.gpDeletePost = async (req, res) => {

    if (!checkAdmin(req, res)) return;

    if (
        !mongoose.isValidObjectId(
            req.params.id
        )
    ) {

        return res.status(400).send(
            "Érvénytelen nagydíj-azonosító."
        );
    }

    try {

        const gp = await Gp.findByIdAndDelete(
            req.params.id
        );

        if (!gp) {

            return res.status(404).send(
                "A nagydíj nem található."
            );
        }

        return res.redirect(
            "/admin/nagydijak?success=deleted"
        );

    } catch (error) {

        console.error(
            "Nagydíj törlési hiba:",
            error
        );

        return res.status(500).send(
            "Nem sikerült törölni a nagydíjat."
        );
    }
};
