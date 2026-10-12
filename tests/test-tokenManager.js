'use strict';

// npx mocha tests/test-tokenManager.js

require('should');

const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const TokenManager = require('../app/src/tokenManager');

describe('test-tokenManager', () => {
    const jwtSecret = 'jwt-secret';
    const encryptionKey = 'encryption-key';
    let tokenManager;

    beforeEach(() => {
        // The manager logs every failure; keep the test output readable
        sinon.stub(console, 'error');
        sinon.stub(console, 'warn');
        sinon.stub(console, 'debug');
        tokenManager = new TokenManager(jwtSecret, '1h', encryptionKey);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('1. Creating tokens', () => {
        it('should sign an object payload as is', () => {
            const token = tokenManager.create({ room: 'room1', presenter: true });
            const decoded = jwt.verify(token, jwtSecret);
            decoded.room.should.equal('room1');
            decoded.presenter.should.be.true();
        });

        it('should wrap a primitive payload in a value field', () => {
            jwt.verify(tokenManager.create('room1'), jwtSecret).value.should.equal('room1');
            jwt.verify(tokenManager.create(0), jwtSecret).value.should.equal(0);
        });

        it('should hide the payload when encoding is requested', () => {
            const decoded = jwt.verify(tokenManager.create({ room: 'room1' }, true), jwtSecret);
            decoded.should.have.property('encrypted');
            decoded.type.should.equal('object');
            decoded.should.not.have.property('room');
        });

        it('should reject an empty payload', () => {
            (() => tokenManager.create(null)).should.throw('Invalid payload');
            (() => tokenManager.create(undefined)).should.throw('Invalid payload');
            (() => tokenManager.create('')).should.throw('Invalid payload');
        });

        it('should fall back to 24h for an invalid expiry', () => {
            const decoded = jwt.verify(tokenManager.create({ room: 'room1' }, false, 'soon'), jwtSecret);
            (decoded.exp - decoded.iat).should.equal(24 * 60 * 60);
        });

        it('should honour a valid expiry', () => {
            const decoded = jwt.verify(tokenManager.create({ room: 'room1' }, false, '2h'), jwtSecret);
            (decoded.exp - decoded.iat).should.equal(2 * 60 * 60);
        });
    });

    describe('2. Validating tokens', () => {
        it('should accept a matching object payload', () => {
            const token = tokenManager.create({ room: 'room1', peer: 'alice' });
            tokenManager.validate({ room: 'room1', peer: 'alice' }, token).should.be.true();
        });

        it('should accept a matching primitive payload', () => {
            tokenManager.validate('room1', tokenManager.create('room1')).should.be.true();
            tokenManager.validate(42, tokenManager.create(42)).should.be.true();
        });

        it('should accept a matching encrypted payload', () => {
            const token = tokenManager.create({ room: 'room1' }, true);
            tokenManager.validate({ room: 'room1' }, token, true).should.be.true();
        });

        it('should reject a payload that does not match', () => {
            const token = tokenManager.create({ room: 'room1' });
            tokenManager.validate({ room: 'room2' }, token).should.be.false();
        });

        it('should reject a token signed with another secret', () => {
            const other = new TokenManager('another-secret', '1h', encryptionKey);
            tokenManager.validate({ room: 'room1' }, other.create({ room: 'room1' })).should.be.false();
        });

        it('should reject a malformed token', () => {
            tokenManager.validate({ room: 'room1' }, 'not-a-token').should.be.false();
        });

        it('should reject an expired token unless expiry is ignored', () => {
            const clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
            const token = tokenManager.create({ room: 'room1' }, false, '1h');

            clock.tick(2 * 60 * 60 * 1000);

            tokenManager.validate({ room: 'room1' }, token).should.be.false();
            tokenManager.validate({ room: 'room1' }, token, false, true).should.be.true();
        });
    });

    describe('3. Reading payloads', () => {
        it('should decode and decrypt an encrypted token', () => {
            const token = tokenManager.create({ room: 'room1', peers: 2 }, true);
            tokenManager.decodePayload(token).should.eql({ room: 'room1', peers: 2 });
        });

        it('should restore the type of an encrypted number', () => {
            tokenManager.decodePayload(tokenManager.create(42, true)).should.equal(42);
        });

        it('should return null when the encryption key is wrong', () => {
            const other = new TokenManager(jwtSecret, '1h', 'another-key');
            (tokenManager.decodePayload(other.create({ room: 'room1' }, true)) === null).should.be.true();
        });

        it('should return null for a token that fails verification', () => {
            (tokenManager.decodePayload('not-a-token') === null).should.be.true();
        });

        it('should extract an unencrypted payload without verifying it', () => {
            const other = new TokenManager('another-secret', '1h', encryptionKey);
            tokenManager.extractPayload(other.create('room1')).should.equal('room1');
            tokenManager.extractPayload(other.create({ room: 'room1' })).room.should.equal('room1');
        });

        it('should not extract an encrypted payload', () => {
            (tokenManager.extractPayload(tokenManager.create({ room: 'room1' }, true)) === null).should.be.true();
            (tokenManager.extractPayload('not-a-token') === null).should.be.true();
        });
    });
});
