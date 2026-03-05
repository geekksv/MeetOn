'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Logs = require('./logs');
const log = new Logs('Auth');

const CREDS_FILE = path.join(__dirname, '../../creds.json');
const JWT_SECRET = process.env.JWT_SECRET || 'MeetOn_secret_key_change_me';
const JWT_EXPIRES = '7d';
const COOKIE_NAME = 'MeetOn_token';

/**
 * Read credentials from file
 * @returns {{ users: Array }}
 */
function readCreds() {
    try {
        if (!fs.existsSync(CREDS_FILE)) {
            fs.writeFileSync(CREDS_FILE, JSON.stringify({ users: [] }, null, 2));
        }
        const data = fs.readFileSync(CREDS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        log.error('Error reading creds file', err.message);
        return { users: [] };
    }
}

/**
 * Write credentials to file
 * @param {object} creds
 */
function writeCreds(creds) {
    try {
        fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
    } catch (err) {
        log.error('Error writing creds file', err.message);
    }
}

/**
 * Hash password with SHA-256
 * @param {string} password
 * @returns {string} hashed password
 */
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Sign up a new user
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, message: string, user?: object }}
 */
function signup(name, email, password) {
    const creds = readCreds();

    // Check duplicate email
    const exists = creds.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
        return { success: false, message: 'An account with this email already exists.' };
    }

    const user = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashPassword(password),
        createdAt: new Date().toISOString(),
    };

    creds.users.push(user);
    writeCreds(creds);

    log.info('New user signed up', { id: user.id, name: user.name, email: user.email });

    return { success: true, message: 'Account created successfully.', user };
}

/**
 * Log in an existing user
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, message: string, user?: object }}
 */
function login(email, password) {
    const creds = readCreds();

    const user = creds.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
        return { success: false, message: 'No account found with this email.' };
    }

    if (user.password !== hashPassword(password)) {
        return { success: false, message: 'Incorrect password.' };
    }

    log.info('User logged in', { id: user.id, name: user.name, email: user.email });

    return { success: true, message: 'Login successful.', user };
}

/**
 * Create JWT token for user
 * @param {object} user
 * @returns {string} JWT token
 */
function createToken(user) {
    return jwt.sign(
        { id: user.id, name: user.name, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES },
    );
}

/**
 * Verify JWT token
 * @param {string} token
 * @returns {object|null} decoded user or null
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Express middleware — require authentication
 * Redirects to /login if not authenticated
 */
function requireAuth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
        return res.redirect('/login');
    }
    const user = verifyToken(token);
    if (!user) {
        res.clearCookie(COOKIE_NAME);
        return res.redirect('/login');
    }
    req.user = user;
    next();
}

/**
 * Express middleware — attach user if authenticated (non-blocking)
 */
function attachUser(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
        const user = verifyToken(token);
        if (user) req.user = user;
    }
    next();
}

module.exports = {
    signup,
    login,
    createToken,
    verifyToken,
    requireAuth,
    attachUser,
    COOKIE_NAME,
};
