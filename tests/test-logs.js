'use strict';

// npx mocha tests/test-logs.js

require('should');

const sinon = require('sinon');

const LOGS_PATH = require.resolve('../app/src/logs');

function loadLogs(env = {}) {
    const keys = ['LOGS_DEBUG', 'LOGS_COLORS', 'LOGS_JSON', 'LOGS_JSON_PRETTY'];
    const saved = {};
    keys.forEach((key) => {
        saved[key] = process.env[key];
        if (key in env) process.env[key] = env[key];
        else delete process.env[key];
    });
    delete require.cache[LOGS_PATH];
    const Logs = require('../app/src/logs');
    keys.forEach((key) => {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    });
    return Logs;
}

describe('test-logs', () => {
    afterEach(() => {
        sinon.restore();
        delete require.cache[LOGS_PATH];
    });

    describe('1. Elapsed time formatting', () => {
        it('should format milliseconds, seconds, minutes and hours', () => {
            const Logs = loadLogs();
            const log = new Logs('test');
            log.getFormatTime(250).should.equal('+250ms');
            log.getFormatTime(5000).should.equal('+5s');
            log.getFormatTime(3 * 60 * 1000).should.equal('+3m');
            log.getFormatTime(2 * 60 * 60 * 1000).should.equal('+2h');
        });
    });

    describe('2. Plain text output', () => {
        it('should write each level to the matching console method', () => {
            const Logs = loadLogs({ LOGS_COLORS: 'false' });
            const log = new Logs('test');
            const stubs = ['log', 'info', 'warn', 'error', 'debug'].map((level) => sinon.stub(console, level));

            log.log('a');
            log.info('b');
            log.warn('c');
            log.error('d');
            log.debug('e');

            stubs.forEach((stub) => stub.calledOnce.should.be.true());
            stubs[1].firstCall.args[0].should.containEql('[test] b');
        });

        it('should skip debug output when LOGS_DEBUG is false', () => {
            const Logs = loadLogs({ LOGS_DEBUG: 'false' });
            const log = new Logs('test');
            const debugStub = sinon.stub(console, 'debug');

            log.debug('hidden');

            debugStub.called.should.be.false();
        });
    });

    describe('3. JSON output', () => {
        it('should emit one JSON object per call for every level', () => {
            const Logs = loadLogs({ LOGS_JSON: 'true' });
            const log = new Logs('test');
            const logStub = sinon.stub(console, 'log');

            ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => log[level]('message', { key: 'value' }));

            logStub.callCount.should.equal(5);
            const levels = logStub.getCalls().map((call) => JSON.parse(call.args[0]).level);
            levels.should.eql(['log', 'info', 'warn', 'error', 'debug']);
        });

        it('should include the app name, message and data', () => {
            const Logs = loadLogs({ LOGS_JSON: 'true' });
            const log = new Logs('test');
            const logStub = sinon.stub(console, 'log');

            log.log('hello', { room: 'abc' });

            const entry = JSON.parse(logStub.firstCall.args[0]);
            entry.app.should.equal('test');
            entry.message.should.equal('hello');
            entry.data.should.eql({ room: 'abc' });
        });

        it('should omit data when no payload is given', () => {
            const Logs = loadLogs({ LOGS_JSON: 'true' });
            const log = new Logs('test');
            const logStub = sinon.stub(console, 'log');

            log.info('no payload');

            JSON.parse(logStub.firstCall.args[0]).should.not.have.property('data');
        });
    });
});
