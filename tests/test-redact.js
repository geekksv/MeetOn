'use strict';

// npx mocha tests/test-redact.js

require('should');

const redact = require('../app/src/redact');

const MASK = '********';

describe('test-redact', () => {
    describe('1. Masking secrets', () => {
        it('should mask the secrets found in the server config', () => {
            const config = {
                server: 'http://localhost:3000',
                jwtCfg: { JWT_KEY: 'jwt-secret', JWT_EXP: '1h' },
                api_key_secret: 'api-secret',
                host_protected: {
                    protected: true,
                    users: [
                        { username: 'admin', password: 'admin-pass' },
                        { username: 'guest', password: 'guest-pass' },
                    ],
                },
                iceServers: [
                    { urls: 'stun:stun.example.com:19302' },
                    { urls: 'turn:turn.example.com:443', username: 'turn-user', credential: 'turn-pass' },
                ],
            };

            redact(config).should.eql({
                server: 'http://localhost:3000',
                jwtCfg: { JWT_KEY: MASK, JWT_EXP: '1h' },
                api_key_secret: MASK,
                host_protected: {
                    protected: true,
                    users: [
                        { username: 'admin', password: MASK },
                        { username: 'guest', password: MASK },
                    ],
                },
                iceServers: [
                    { urls: 'stun:stun.example.com:19302' },
                    { urls: 'turn:turn.example.com:443', username: 'turn-user', credential: MASK },
                ],
            });
        });

        it('should match key names whatever their case', () => {
            redact({ PASSWORD: 'a', Api_Key_Secret: 'b', authToken: 'c' }).should.eql({
                PASSWORD: MASK,
                Api_Key_Secret: MASK,
                authToken: MASK,
            });
        });

        it('should leave no secret in the serialised output', () => {
            const output = JSON.stringify(redact({ nested: [{ deep: { password: 'find-me' } }] }));
            output.should.not.containEql('find-me');
        });
    });

    describe('2. Leaving everything else alone', () => {
        it('should keep values that are not secrets', () => {
            const config = { turn_enabled: true, presenters: ['Admin'], port: 3000, redirect: false };
            redact(config).should.eql(config);
        });

        it('should keep an unset secret visible as unset', () => {
            redact({ password: '', api_key_secret: null, token: undefined, secret: false }).should.eql({
                password: '',
                api_key_secret: null,
                token: undefined,
                secret: false,
            });
        });

        it('should return primitives unchanged', () => {
            redact('text').should.equal('text');
            redact(42).should.equal(42);
            (redact(null) === null).should.be.true();
            (redact(undefined) === undefined).should.be.true();
        });

        it('should not descend into objects that are not plain data', () => {
            const pattern = /abc/;
            const date = new Date(0);
            const result = redact({ pattern, date });
            result.pattern.should.equal(pattern);
            result.date.should.equal(date);
        });
    });

    describe('3. Not mutating the input', () => {
        it('should return a copy and leave the original intact', () => {
            const config = { jwtCfg: { JWT_KEY: 'jwt-secret' }, users: [{ password: 'pass' }] };

            const result = redact(config);

            result.should.not.equal(config);
            config.jwtCfg.JWT_KEY.should.equal('jwt-secret');
            config.users[0].password.should.equal('pass');
        });
    });
});
