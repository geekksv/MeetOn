'use strict';

// npx mocha tests/test-roomManager.js

require('should');

const proxyquire = require('proxyquire');

/**
 * Load roomManager against an in-memory rooms file, so tests never touch disk.
 * @param {string|null} initial initial file content, or null when the file does not exist
 */
function loadRoomManager(initial = null) {
    const disk = { content: initial, writes: 0 };
    const fsStub = {
        existsSync: () => disk.content !== null,
        readFileSync: () => disk.content,
        writeFileSync: (file, data) => {
            disk.content = data;
            disk.writes++;
        },
    };
    const logStub = class {
        info() {}
        error() {}
    };
    const roomManager = proxyquire('../app/src/roomManager', { fs: fsStub, './logs': logStub });
    return { roomManager, disk };
}

describe('test-roomManager', () => {
    describe('1. Creating rooms', () => {
        it('should create the rooms file when it does not exist', () => {
            const { roomManager, disk } = loadRoomManager();
            roomManager.hasPassword('room1').should.be.false();
            JSON.parse(disk.content).should.eql({});
        });

        it('should store a digest, never the plain password', () => {
            const { roomManager, disk } = loadRoomManager();
            roomManager.createRoom('room1', 'secret');

            const stored = JSON.parse(disk.content).room1;
            stored.password.should.match(/^[0-9a-f]{64}$/);
            disk.content.should.not.containEql('secret');
            new Date(stored.createdAt).toISOString().should.equal(stored.createdAt);
        });

        it('should keep existing rooms when another is created', () => {
            const { roomManager } = loadRoomManager();
            roomManager.createRoom('room1', 'one');
            roomManager.createRoom('room2', 'two');

            roomManager.verifyPassword('room1', 'one').should.be.true();
            roomManager.verifyPassword('room2', 'two').should.be.true();
        });
    });

    describe('2. Checking for a password', () => {
        it('should report a room that has a password', () => {
            const { roomManager } = loadRoomManager();
            roomManager.createRoom('room1', 'secret');
            roomManager.hasPassword('room1').should.be.true();
        });

        it('should report false for an unknown room', () => {
            const { roomManager } = loadRoomManager();
            roomManager.hasPassword('missing').should.be.false();
        });

        it('should report false for a room created without a password', () => {
            const { roomManager } = loadRoomManager();
            roomManager.createRoom('room1', '');
            roomManager.hasPassword('room1').should.be.false();
        });
    });

    describe('3. Verifying a password', () => {
        it('should accept the right password', () => {
            const { roomManager } = loadRoomManager();
            roomManager.createRoom('room1', 'secret');
            roomManager.verifyPassword('room1', 'secret').should.be.true();
        });

        it('should ignore surrounding whitespace', () => {
            const { roomManager } = loadRoomManager();
            roomManager.createRoom('room1', '  secret ');
            roomManager.verifyPassword('room1', 'secret').should.be.true();
            roomManager.verifyPassword('room1', ' secret  ').should.be.true();
        });

        it('should reject a wrong, empty or missing password', () => {
            const { roomManager } = loadRoomManager();
            roomManager.createRoom('room1', 'secret');
            roomManager.verifyPassword('room1', 'Secret').should.be.false();
            roomManager.verifyPassword('room1', '').should.be.false();
            roomManager.verifyPassword('room1', undefined).should.be.false();
        });

        it('should reject an unknown room', () => {
            const { roomManager } = loadRoomManager();
            roomManager.verifyPassword('missing', 'secret').should.be.false();
        });

        it('should not throw for a room name that shadows an object property', () => {
            const { roomManager } = loadRoomManager();
            roomManager.verifyPassword('__proto__', 'secret').should.be.false();
            roomManager.verifyPassword('constructor', 'secret').should.be.false();
        });
    });

    describe('4. Damaged rooms file', () => {
        it('should treat an unreadable file as having no rooms', () => {
            const { roomManager } = loadRoomManager('{ not json');
            roomManager.hasPassword('room1').should.be.false();
            roomManager.verifyPassword('room1', 'secret').should.be.false();
        });

        it('should treat an empty file as having no rooms', () => {
            const { roomManager } = loadRoomManager('');
            roomManager.hasPassword('room1').should.be.false();
        });
    });
});
