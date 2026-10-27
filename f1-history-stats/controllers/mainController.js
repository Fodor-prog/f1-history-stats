
const User = require("../models/User");
const bcrypt = require("bcrypt");

// ========================================
// REGISZTRÁCIÓS OLDAL
// ========================================

exports.registerGet = (req, res) => {
    res.render("register", {
        title: "Regisztráció | F1 History Stats"
    });
};

// ========================================
// REGISZTRÁCIÓ FELDOLGOZÁSA
// ========================================

exports.registerPost = async (req, res) => {
    try {
        const username = String(
            req.body.username || ""
        ).trim();

        const password = String(
            req.body.password || ""
        );

        // Kötelező adatok ellenőrzése
        if (!username || !password) {
            req.session.message =
                "A felhasználónév és a jelszó megadása kötelező.";

            return res.redirect("/register");
        }

        // Felhasználónév ellenőrzése
        const existingUser = await User.findOne({
            username
        });

        if (existingUser) {
            req.session.message =
                "Ez a felhasználónév már foglalt!";

            return res.redirect("/register");
        }

        // Jelszó hashelése bcrypt segítségével
        const hash = await bcrypt.hash(password, 10);

        // Új felhasználó létrehozása
        await User.create({
            username,
            password: hash,
            role: "user"
        });

        req.session.message =
            "Sikeres regisztráció! Most már bejelentkezhetsz.";

        return res.redirect("/login");

    } catch (error) {
        console.error(
            "Regisztrációs hiba:",
            error.message
        );

        req.session.message =
            "Hiba történt a regisztráció során.";

        return res.redirect("/register");
    }
};

// ========================================
// BEJELENTKEZÉSI OLDAL
// ========================================

exports.loginGet = (req, res) => {
    res.render("login", {
        title: "Bejelentkezés | F1 History Stats"
    });
};

// ========================================
// BEJELENTKEZÉS FELDOLGOZÁSA
// ========================================

exports.loginPost = async (req, res) => {
    try {
        const username = String(
            req.body.username || ""
        ).trim();

        const password = String(
            req.body.password || ""
        );

        // Felhasználó keresése
        const user = await User.findOne({
            username
        });

        if (!user) {
            req.session.message =
                "Hibás felhasználónév vagy jelszó!";

            return res.redirect("/login");
        }

        // Jelszó ellenőrzése
        const ok = await bcrypt.compare(
            password,
            user.password
        );

        if (!ok) {
            req.session.message =
                "Hibás felhasználónév vagy jelszó!";

            return res.redirect("/login");
        }

        // Bejelentkezett felhasználó mentése
        // a sessionbe
        req.session.regenerate(error => {
            if (error) {
                console.error(
                    "Session hiba:",
                    error.message
                );

                return res.status(500).send(
                    "Hiba történt a bejelentkezés során."
                );
            }

            req.session.user = {
                id: user._id.toString(),
                username: user.username,
                role: user.role
            };

            req.session.save(error => {
                if (error) {
                    return res.status(500).send(
                        "Hiba történt a munkamenet mentésekor."
                    );
                }

                return res.redirect("/user");
            });
        });

    } catch (error) {
        console.error(
            "Bejelentkezési hiba:",
            error.message
        );

        req.session.message =
            "Hiba történt a bejelentkezés során.";

        return res.redirect("/login");
    }
};

// ========================================
// KIJELENTKEZÉS
// ========================================

exports.logout = (req, res) => {
    req.session.destroy(error => {
        if (error) {
            console.error(
                "Kijelentkezési hiba:",
                error.message
            );

            return res.status(500).send(
                "Hiba történt a kijelentkezés során."
            );
        }

        res.clearCookie("connect.sid");
        return res.redirect("/");
    });
};

// ========================================
// FELHASZNÁLÓI OLDAL
// ========================================

exports.userIndex = (req, res) => {
    res.render("user", {
        title: "Felhasználói oldal | F1 History Stats"
    });
};

// ========================================
// ADMINISZTRÁCIÓS OLDAL
// ========================================

exports.adminIndex = (req, res) => {
    res.render("admin", {
        title: "Adminisztráció | F1 History Stats"
    });
};
