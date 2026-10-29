
const router = require("express").Router();

const controller = require("../controllers/mainController");
const contactController = require("../controllers/contactController");

// ========================================
// BEJELENTKEZÉS ELLENŐRZÉSE
// ========================================

const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next();
    }

    return res.redirect("/login");
};

// ========================================
// ADMIN JOGOSULTSÁG ELLENŐRZÉSE
// ========================================

const isAdmin = (req, res, next) => {
    if (
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

// Regisztrációs oldal
router.get(
    "/register",
    controller.registerGet
);

// Regisztráció feldolgozása
router.post(
    "/register",
    controller.registerPost
);

// ========================================
// BEJELENTKEZÉS
// ========================================

// Bejelentkezési oldal
router.get(
    "/login",
    controller.loginGet
);

// Bejelentkezés feldolgozása
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
// ADMINISZTRÁCIÓS OLDAL
// ========================================

router.get(
    "/admin",
    isAdmin,
    controller.adminIndex
);

// ========================================
// KAPCSOLATFELVÉTEL
// ========================================

// A kapcsolatfelvételi oldalt mindenki elérheti.
router.get(
    "/contact",
    contactController.contactGet
);

// Az űrlapot vendégek is beküldhetik.
router.post(
    "/contact",
    contactController.contactPost
);

// ========================================
// BEÉRKEZETT ÜZENETEK
// ========================================

// Csak bejelentkezett felhasználók láthatják.
router.get(
    "/messages",
    isLoggedIn,
    contactController.messagesGet
);

// ========================================
// ROUTER EXPORTÁLÁSA
// ========================================

module.exports = router;
