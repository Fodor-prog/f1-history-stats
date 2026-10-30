const router = require("express").Router();
const controller = require("../controllers/mainController");
const contactController = require("../controllers/contactController");
const statsController = require("../controllers/statsController");

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
// ADMINISZTRÁCIÓ
// ========================================

router.get(
    "/admin",
    isAdmin,
    controller.adminIndex
);

// ========================================
// KAPCSOLATFELVÉTEL
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
// STATISZTIKÁK – CHART.JS
// ========================================

// Az oldal minden látogató számára elérhető.
router.get(
    "/statisztikak",
    statsController.statsGet
);

// ========================================
// ROUTER EXPORTÁLÁSA
// ========================================

module.exports = router;
