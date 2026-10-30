const router = require("express").Router();

// ========================================
// CONTROLLEREK
// ========================================

const controller = require("../controllers/mainController");

const contactController = require("../controllers/contactController");

const statsController = require("../controllers/statsController");

const adminController = require("../controllers/adminController");

// ========================================
// CSRF-VÉDELEM
// ========================================

const {
    provideCsrfToken,
    verifyCsrfToken
} = require("../middleware/csrfProtection");

// ========================================
// JOGOSULTSÁGELLENŐRZŐ MIDDLEWARE-EK
// ========================================

// Bejelentkezés ellenőrzése
const isLoggedIn = (req, res, next) => {

    if (req.session && req.session.user) {
        return next();
    }

    return res.redirect("/login");
};

// Adminisztrátori jogosultság ellenőrzése
const isAdmin = (req, res, next) => {

    if (
        req.session &&
        req.session.user &&
        req.session.user.role === "admin"
    ) {
        return next();
    }

    return res.redirect("/");
};

// ========================================
// REGISZTRÁCIÓ
// ========================================

router.get(
    "/register",
    controller.registerGet
);

router.post(
    "/register",
    controller.registerPost
);

// ========================================
// BEJELENTKEZÉS
// ========================================

router.get(
    "/login",
    controller.loginGet
);

router.post(
    "/login",
    controller.loginPost
);

// ========================================
// KIJELENTKEZÉS
// ========================================

router.get(
    "/logout",
    isLoggedIn,
    controller.logout
);

// ========================================
// FELHASZNÁLÓI OLDAL
// ========================================

router.get(
    "/user",
    isLoggedIn,
    controller.userIndex
);

// ========================================
// ADMIN FŐOLDAL
// ========================================

router.get(
    "/admin",
    isAdmin,
    controller.adminIndex
);

// ========================================
// ADMIN - NAGYDÍJAK CRUD
// ========================================

// READ - Nagydíjak listázása
// Az oldalon törlési űrlapok is vannak,
// ezért átadjuk a CSRF-tokent.

router.get(
    "/admin/nagydijak",
    isAdmin,
    provideCsrfToken,
    adminController.gpList
);

// CREATE - Új nagydíj űrlap
router.get(
    "/admin/nagydijak/uj",
    isAdmin,
    provideCsrfToken,
    adminController.gpCreateGet
);

// CREATE - Új nagydíj mentése
router.post(
    "/admin/nagydijak/uj",
    isAdmin,
    verifyCsrfToken,
    adminController.gpCreatePost
);

// UPDATE - Meglévő nagydíj szerkesztése
router.get(
    "/admin/nagydijak/:id/szerkesztes",
    isAdmin,
    provideCsrfToken,
    adminController.gpEditGet
);

// UPDATE - Módosítás mentése
router.post(
    "/admin/nagydijak/:id/szerkesztes",
    isAdmin,
    verifyCsrfToken,
    adminController.gpEditPost
);

// DELETE - Nagydíj törlése
router.post(
    "/admin/nagydijak/:id/torles",
    isAdmin,
    verifyCsrfToken,
    adminController.gpDeletePost
);

// ========================================
// KAPCSOLAT
// ========================================

router.get(
    "/contact",
    contactController.contactGet
);

router.post(
    "/contact",
    contactController.contactPost
);

// ========================================
// BEÉRKEZETT ÜZENETEK
// ========================================

router.get(
    "/messages",
    isLoggedIn,
    contactController.messagesGet
);

// ========================================
// STATISZTIKÁK
// ========================================

router.get(
    "/statisztikak",
    statsController.statsGet
);

// ========================================
// ROUTER EXPORT
// ========================================

module.exports = router;



