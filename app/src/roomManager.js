'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Logs = require('./logs');
const log = new Logs('RoomManager');

const ROOMS_FILE = path.join(__dirname, '../../rooms.json');

/**
 * Read rooms from file
 * @returns {object} rooms data
 */
function readRooms() {
    try {
        if (!fs.existsSync(ROOMS_FILE)) {
            fs.writeFileSync(ROOMS_FILE, JSON.stringify({}, null, 2));
        }
        const data = fs.readFileSync(ROOMS_FILE, 'utf-8');
        return data ? JSON.parse(data) : {};
    } catch (err) {
        log.error('Error reading rooms file', err.message);
        return {};
    }
}

/**
 * Write rooms to file
 * @param {object} rooms
 */
function writeRooms(rooms) {
    try {
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
    } catch (err) {
        log.error('Error writing rooms file', err.message);
    }
}

/**
 * Simple password check (Hash password using SHA-256)
 * @param {string} password 
 * @returns {string} hashed password
 */
function processPassword(password) {
    if (!password) return '';
    return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

/**
 * Create or update a room with a password
 * @param {string} roomId
 * @param {string} password
 */
function createRoom(roomId, password) {
    const rooms = readRooms();
    rooms[roomId] = {
        password: processPassword(password),
        createdAt: new Date().toISOString(),
    };
    writeRooms(rooms);
    log.info('Room created with password', { roomId });
}

/**
 * Check if a room has a password
 * @param {string} roomId
 * @returns {boolean}
 */
function hasPassword(roomId) {
    const rooms = readRooms();
    return !!(rooms[roomId] && rooms[roomId].password);
}

/**
 * Verify room password
 * @param {string} roomId
 * @param {string} password
 * @returns {boolean}
 */
function verifyPassword(roomId, password) {
    const rooms = readRooms();
    if (!rooms[roomId]) return false;
    return rooms[roomId].password === processPassword(password);
}

module.exports = {
    createRoom,
    hasPassword,
    verifyPassword,
};
