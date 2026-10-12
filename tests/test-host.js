'use strict';

// npx mocha tests/test-host.js

require('should');

const Host = require('../app/src/host');

describe('test-host', () => {
    let host;

    beforeEach(() => {
        host = new Host();
    });

    describe('1. Resolving the client IP', () => {
        it('should prefer the x-forwarded-for header', () => {
            const req = { headers: { 'x-forwarded-for': '203.0.113.7' }, socket: { remoteAddress: '10.0.0.1' } };
            host.getIP(req).should.equal('203.0.113.7');
        });

        it('should fall back to the socket address', () => {
            const req = { headers: {}, socket: { remoteAddress: '10.0.0.1' }, ip: '10.0.0.2' };
            host.getIP(req).should.equal('10.0.0.1');
        });

        it('should fall back to req.ip when the socket has no address', () => {
            const req = { headers: {}, socket: {}, ip: '10.0.0.2' };
            host.getIP(req).should.equal('10.0.0.2');
        });
    });

    describe('2. Tracking authorized IPs', () => {
        it('should start with no authorized IPs', () => {
            host.getAuthorizedIPs().should.eql({});
            host.isAuthorizedIP('203.0.113.7').should.be.false();
        });

        it('should authorize an IP', () => {
            host.setAuthorizedIP('203.0.113.7', true);
            host.isAuthorizedIP('203.0.113.7').should.be.true();
            host.getAuthorizedIPs().should.eql({ '203.0.113.7': true });
        });

        it('should keep IPs independent of each other', () => {
            host.setAuthorizedIP('203.0.113.7', true);
            host.isAuthorizedIP('203.0.113.8').should.be.false();
        });

        it('should remove an IP and report whether it was present', () => {
            host.setAuthorizedIP('203.0.113.7', true);
            host.deleteIP('203.0.113.7').should.be.true();
            host.deleteIP('203.0.113.7').should.be.false();
            host.isAuthorizedIP('203.0.113.7').should.be.false();
        });

        it('should not share state between instances', () => {
            host.setAuthorizedIP('203.0.113.7', true);
            new Host().isAuthorizedIP('203.0.113.7').should.be.false();
        });
    });
});
