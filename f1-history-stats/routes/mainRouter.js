
const router = require("express").Router();

const controller = require("../controllers/mainController");

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

// Regisztrációs oldal megjelenítése
router.get("/register", controller.registerGet);

// Regisztráció feldolgozása
router.post("/register", controller.registerPost);

// ========================================
// BEJELENTKEZÉS
// ========================================

// Bejelentkezési oldal megjelenítése
router.get("/login", controller.loginGet);

// Bejelentkezés feldolgozása
router.post("/login", controller.loginPost);

// ========================================
// KIJELENTKEZÉS
// ========================================

router.get("/logout", controller.logout);

// ========================================
// FELHASZNÁLÓI OLDAL
// ========================================

// Csak bejelentkezett felhasználóknak
router.get(
    "/user",
    isLoggedIn,
    controller.userIndex
);

// ========================================
// ADMINISZTRÁCIÓS OLDAL
// ========================================

// Kizárólag admin jogosultsággal
router.get(
    "/admin",
    isAdmin,
    controller.adminIndex
);

// ========================================
// ROUTER EXPORTÁLÁSA
// ========================================

module.exports = router;
