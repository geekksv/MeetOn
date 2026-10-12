'use strict';

// npx mocha tests/test-htmlInjector.js

require('should');

const sinon = require('sinon');
const proxyquire = require('proxyquire');

const PAGE = '/views/page.html';
const MISSING = '/views/missing.html';
const TEMPLATE = '<title>{{OG_TITLE}}</title><meta content="{{OG_URL}}"><meta content="{{OG_UNKNOWN}}">';

/**
 * Load HtmlInjector with the file system and the file watcher replaced by fakes.
 */
function loadHtmlInjector(files) {
    const handlers = {};
    const watcher = {
        on(event, handler) {
            handlers[event] = handler;
            return watcher;
        },
        close: sinon.spy(),
    };
    const fsStub = {
        readFileSync: (filePath) => {
            if (!(filePath in files)) throw new Error(`ENOENT: ${filePath}`);
            return files[filePath];
        },
    };
    const logStub = class {
        info() {}
        debug() {}
        error() {}
    };
    const HtmlInjector = proxyquire('../app/src/htmlInjector', {
        fs: fsStub,
        chokidar: { watch: sinon.stub().returns(watcher) },
        './logs': logStub,
    });
    return { HtmlInjector, handlers, watcher };
}

function fakeResponse(headersSent = false) {
    const res = { headersSent, statusCode: 200, body: undefined };
    res.status = sinon.spy((code) => {
        res.statusCode = code;
        return res;
    });
    res.send = sinon.spy((body) => {
        res.body = body;
        return res;
    });
    return res;
}

describe('test-htmlInjector', () => {
    describe('1. Injection enabled', () => {
        it('should replace placeholders with the configured values', () => {
            const { HtmlInjector } = loadHtmlInjector({ [PAGE]: TEMPLATE });
            const config = { htmlInjection: true, og: { title: 'My call', url: 'https://example.com' } };
            const res = fakeResponse();

            new HtmlInjector([PAGE], config).injectHtml(PAGE, res);

            res.body.should.equal('<title>My call</title><meta content="https://example.com"><meta content="">');
            res.status.called.should.be.false();
        });

        it('should fall back to defaults for values that are not configured', () => {
            const { HtmlInjector } = loadHtmlInjector({ [PAGE]: '{{OG_SITE_NAME}}|{{OG_TYPE}}' });
            const res = fakeResponse();

            new HtmlInjector([PAGE], { htmlInjection: true }).injectHtml(PAGE, res);

            res.body.should.equal('MeetOn|app-webrtc');
        });
    });

    describe('2. Injection disabled', () => {
        it('should send the cached file untouched', () => {
            const { HtmlInjector } = loadHtmlInjector({ [PAGE]: TEMPLATE });
            const res = fakeResponse();

            new HtmlInjector([PAGE], { htmlInjection: false }).injectHtml(PAGE, res);

            res.body.should.equal(TEMPLATE);
        });

        it('should behave the same when there is no config at all', () => {
            const { HtmlInjector } = loadHtmlInjector({ [PAGE]: TEMPLATE });
            const res = fakeResponse();

            new HtmlInjector([PAGE], null).injectHtml(PAGE, res);

            res.body.should.equal(TEMPLATE);
        });
    });

    describe('3. File that could not be loaded', () => {
        [true, false].forEach((htmlInjection) => {
            it(`should answer 500 when injection is ${htmlInjection ? 'enabled' : 'disabled'}`, () => {
                const { HtmlInjector } = loadHtmlInjector({ [PAGE]: TEMPLATE });
                const res = fakeResponse();

                new HtmlInjector([PAGE, MISSING], { htmlInjection }).injectHtml(MISSING, res);

                res.statusCode.should.equal(500);
                res.body.should.equal('Server Error');
            });
        });

        it('should not write to a response that was already sent', () => {
            const { HtmlInjector } = loadHtmlInjector({ [PAGE]: TEMPLATE });
            const res = fakeResponse(true);

            new HtmlInjector([PAGE, MISSING], { htmlInjection: true }).injectHtml(MISSING, res);

            res.send.called.should.be.false();
        });
    });

    describe('4. Watching files', () => {
        it('should serve the new content after a file changes', () => {
            const files = { [PAGE]: 'old' };
            const { HtmlInjector, handlers } = loadHtmlInjector(files);
            const injector = new HtmlInjector([PAGE], { htmlInjection: false });

            files[PAGE] = 'new';
            handlers.change(PAGE);

            const res = fakeResponse();
            injector.injectHtml(PAGE, res);
            res.body.should.equal('new');
        });

        it('should close the watcher on cleanup', () => {
            const { HtmlInjector, watcher } = loadHtmlInjector({ [PAGE]: TEMPLATE });

            new HtmlInjector([PAGE], {}).cleanup();

            watcher.close.calledOnce.should.be.true();
        });
    });
});
