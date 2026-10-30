const crypto = require("node:crypto");

// ========================================
// CSRF TOKEN LÉTREHOZÁSA
// ========================================

function getCsrfToken(req) {

    if (!req.session) {
        throw new Error(
            "A CSRF-védelemhez munkamenet szükséges."
        );
    }

    // Egy munkameneten belül ugyanazt a tokent
    // használjuk az adminisztrátori űrlapokhoz.

    if (!req.session.adminCsrfToken) {

        req.session.adminCsrfToken =
            crypto.randomBytes(32).toString("hex");
    }

    return req.session.adminCsrfToken;
}

// ========================================
// CSRF TOKEN ÁTADÁSA AZ EJS OLDALAKNAK
// ========================================

function provideCsrfToken(req, res, next) {

    try {

        res.locals.csrfToken = getCsrfToken(req);

        next();

    } catch (error) {

        next(error);
    }
}

// ========================================
// CSRF TOKEN ELLENŐRZÉSE
// ========================================

function verifyCsrfToken(req, res, next) {

    const expectedToken =
        req.session &&
        req.session.adminCsrfToken;

    const submittedToken =
        req.body &&
        req.body._csrf;

    // A tokennek mindkét oldalon
    // karakterláncnak kell lennie.

    if (
        typeof expectedToken !== "string" ||
        typeof submittedToken !== "string"
    ) {

        return res.status(403).send(
            "Érvénytelen vagy hiányzó CSRF token."
        );
    }

    // A tokeneket Bufferré alakítjuk.

    const expectedBuffer =
        Buffer.from(expectedToken, "utf8");

    const submittedBuffer =
        Buffer.from(submittedToken, "utf8");

    // timingSafeEqual csak azonos hosszúságú
    // Buffer objektumok esetén használható.

    if (
        expectedBuffer.length !==
        submittedBuffer.length
    ) {

        return res.status(403).send(
            "Érvénytelen CSRF token."
        );
    }

    // Biztonságos összehasonlítás.

    const isValid = crypto.timingSafeEqual(
        expectedBuffer,
        submittedBuffer
    );

    if (!isValid) {

        return res.status(403).send(
            "Érvénytelen CSRF token."
        );
    }

    next();
}

// ========================================
// EXPORTÁLÁS
// ========================================

module.exports = {
    provideCsrfToken,
    verifyCsrfToken
};



