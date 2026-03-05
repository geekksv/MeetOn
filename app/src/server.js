/*
 http://patorjk.com/software/taag/#p=display&f=ANSI%20Regular&t=Server

 ███████ ███████ ██████  ██    ██ ███████ ██████  
 ██      ██      ██   ██ ██    ██ ██      ██   ██ 
 ███████ █████   ██████  ██    ██ █████   ██████  
      ██ ██      ██   ██  ██  ██  ██      ██   ██ 
 ███████ ███████ ██   ██   ████   ███████ ██   ██                                           

 dependencies: {
    axios                   : https://www.npmjs.com/package/axios
    compression             : https://www.npmjs.com/package/compression
    cors                    : https://www.npmjs.com/package/cors
    crypto-js               : https://www.npmjs.com/package/crypto-js
    dompurify               : https://www.npmjs.com/package/dompurify
    dotenv                  : https://www.npmjs.com/package/dotenv
    express                 : https://www.npmjs.com/package/express
    helmet                  : https://www.npmjs.com/package/helmet
    httpolyglot             : https://www.npmjs.com/package/httpolyglot
    jsonwebtoken            : https://www.npmjs.com/package/jsonwebtoken
    socket.io               : https://www.npmjs.com/package/socket.io
    swagger-ui-express      : https://www.npmjs.com/package/swagger-ui-express
    uuid                    : https://www.npmjs.com/package/uuid
}
*/

/**
 * MeetOn P2P - Server component
 *
 * @link    GitHub: https://github.com/geekksv/MeetOn
 * @link    Official Live demo: https://p2p.mirotalk.com
 * @license For open source use: AGPLv3
 * @license For commercial use or closed source, contact us at license.mirotalk@gmail.com or purchase directly from CodeCanyon
 * @license CodeCanyon: https://codecanyon.net/item/mirotalk-p2p-webrtc-realtime-video-conferences/38376661
 * @author  Miroslav Pejic - miroslav.pejic.85@gmail.com
 * @version 1.7.36
 *
 */

'use strict'; // https://www.w3schools.com/js/js_strict.asp

require('dotenv').config();

const { Server } = require('socket.io');
const httpolyglot = require('httpolyglot');
const compression = require('compression');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const app = express();
const fs = require('fs');
const checkXSS = require('./xss.js');
const ServerApi = require('./api');
const Validate = require('./validate');
const HtmlInjector = require('./htmlInjector');
const Host = require('./host');
const roomManager = require('./roomManager');
const Logs = require('./logs');
const log = new Logs('server');
const cookieParser = require('cookie-parser');
const auth = require('./auth');

// Custom Brand and buttons
const config = safeRequire('./config');

const packageJson = require('../../package.json');

// Login attempts limit
const rateLimit = require('express-rate-limit');
const maxAttempts = process.env.HOST_MAX_LOGIN_ATTEMPTS || 5;
const minBlockTime = process.env.HOST_MIN_LOGIN_BLOCK_TIME || 15; // in minutes
const loginLimiter = rateLimit({
    windowMs: minBlockTime * 60 * 1000, // 15 minutes default
    max: maxAttempts,
    message: 'Too many login attempts, please try again later.',
    keyGenerator: (req) => req.body?.username || getIP(req),
});

const port = process.env.PORT || 3000;
const host = process.env.HOST || `http://localhost:${port}`;

const authHost = new Host(); // Authenticated IP by Login

// Define paths to the SSL key and certificate files
const keyPath = path.join(__dirname, '../ssl/key.pem');
const certPath = path.join(__dirname, '../ssl/cert.pem');

// Read SSL key and certificate files securely
const options = {
    key: fs.readFileSync(keyPath, 'utf-8'),
    cert: fs.readFileSync(certPath, 'utf-8'),
};

// Server both http and https
const server = httpolyglot.createServer(options, app);

// Trust Proxy
const trustProxy = !!getEnvBoolean(process.env.TRUST_PROXY);

// Cors
const cors_origin = process.env.CORS_ORIGIN;
const cors_methods = process.env.CORS_METHODS;

let corsOrigin = '*';
let corsMethods = ['GET', 'POST'];

if (cors_origin && cors_origin !== '*') {
    try {
        corsOrigin = JSON.parse(cors_origin);
    } catch (error) {
        log.error('Error parsing CORS_ORIGIN', error.message);
    }
}

if (cors_methods && cors_methods !== '') {
    try {
        corsMethods = JSON.parse(cors_methods);
    } catch (error) {
        log.error('Error parsing CORS_METHODS', error.message);
    }
}

const corsOptions = {
    origin: corsOrigin,
    methods: corsMethods,
};

/*  
    Set maxHttpBufferSize from 1e6 (1MB) to 1e7 (10MB)
*/
const io = new Server({
    maxHttpBufferSize: 1e7,
    transports: ['websocket'],
    cors: corsOptions,
}).listen(server);

// console.log(io);

// Host protection (disabled by default)
const hostProtected = getEnvBoolean(process.env.HOST_PROTECTED);
const userAuth = getEnvBoolean(process.env.HOST_USER_AUTH);
const hostUsersString = process.env.HOST_USERS || '[{"username": "MeetOn", "password": "P2P"}]';
const hostUsers = JSON.parse(hostUsersString);
const hostCfg = {
    protected: hostProtected,
    user_auth: userAuth,
    users: hostUsers,
    authenticated: !hostProtected,
    maxRoomParticipants: parseInt(process.env.ROOM_MAX_PARTICIPANTS) || 1000,
    showActiveRooms: getEnvBoolean(process.env.SHOW_ACTIVE_ROOMS) || false,
};

// JWT config
const jwtCfg = {
    JWT_KEY: process.env.JWT_KEY || 'mirotalk_jwt_secret',
    JWT_EXP: process.env.JWT_EXP || '1h',
};

// Room presenters
const roomPresentersString = process.env.PRESENTERS || '["MeetOn P2P"]';
const roomPresenters = JSON.parse(roomPresentersString);

// Swagger config
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = yaml.load(fs.readFileSync(path.join(__dirname, '/../api/swagger.yaml'), 'utf8'));

// Api config
const { v4: uuidV4 } = require('uuid');
const apiBasePath = '/api/v1'; // api endpoint path
const api_docs = host + apiBasePath + '/docs'; // api docs
const api_key_secret = process.env.API_KEY_SECRET || 'mirotalkp2p_default_secret';
const apiDisabledString = process.env.API_DISABLED || '["token", "meetings"]';
const api_disabled = JSON.parse(apiDisabledString);


// Stun (https://bloggeek.me/webrtcglossary/stun/)
// Turn (https://bloggeek.me/webrtcglossary/turn/)
const iceServers = [];
const stunServerUrl = process.env.STUN_SERVER_URL;
const turnServerUrl = process.env.TURN_SERVER_URL;
const turnServerUsername = process.env.TURN_SERVER_USERNAME;
const turnServerCredential = process.env.TURN_SERVER_CREDENTIAL;
const stunServerEnabled = getEnvBoolean(process.env.STUN_SERVER_ENABLED);
const turnServerEnabled = getEnvBoolean(process.env.TURN_SERVER_ENABLED);
// Stun is mandatory for not internal network
if (stunServerEnabled && stunServerUrl) iceServers.push({ urls: stunServerUrl });
// Turn is recommended if direct peer to peer connection is not possible
if (turnServerEnabled && turnServerUrl && turnServerUsername && turnServerCredential) {
    iceServers.push({ urls: turnServerUrl, username: turnServerUsername, credential: turnServerCredential });
}

// Test Stun and Turn connection with query params
const testStunTurn = host + '/icetest';

// IP Lookup
const IPLookupEnabled = getEnvBoolean(process.env.IP_LOOKUP_ENABLED);

// Redirect URL
const redirectEnabled = getEnvBoolean(process.env.REDIRECT_ENABLED);
const redirectURL = process.env.REDIRECT_URL || '/newcall';

// CryptoJS for token encoding
const CryptoJS = require('crypto-js');

// IP Whitelist
const ipWhitelist = {
    enabled: getEnvBoolean(process.env.IP_WHITELIST_ENABLED),
    allowed: process.env.IP_WHITELIST_ALLOWED ? JSON.parse(process.env.IP_WHITELIST_ALLOWED) : [],
};



// directory
const dir = {
    public: path.join(__dirname, '../../', 'public'),
};
// html views
const views = {
    about: path.join(__dirname, '../../', 'public/views/about.html'),
    client: path.join(__dirname, '../../', 'public/views/client.html'),
    landing: path.join(__dirname, '../../', 'public/views/landing.html'),
    login: path.join(__dirname, '../../', 'public/views/login.html'),
    newCall: path.join(__dirname, '../../', 'public/views/newcall.html'),
    notFound: path.join(__dirname, '../../', 'public/views/404.html'),
    privacy: path.join(__dirname, '../../', 'public/views/privacy.html'),
    activeRooms: path.join(__dirname, '../../', 'public/views/activeRooms.html'),
    customizeRoom: path.join(__dirname, '../../public/views/customizeRoom.html'),
    guestJoin: path.join(__dirname, '../../public/views/guest-join.html'),
    stunTurn: path.join(__dirname, '../../', 'public/views/testStunTurn.html'),
};

// Branding configuration
const brandHtmlInjection = config?.brand?.htmlInjection ?? true;

// File to cache and inject custom HTML data like OG tags and any other elements.
const filesPath = [views.landing, views.newCall, views.client, views.login, views.activeRooms, views.customizeRoom, views.guestJoin];
const htmlInjector = new HtmlInjector(filesPath, config?.brand || null);

const peers = {}; // roomId -> { socketId: { ... }, ... }
const guestLobby = {}; // roomId -> { socketId: guestName }
const channels = {}; // roomId -> { socketId: socket, ... }
const presenters = {}; // roomId -> { socketId: { ... }, ... }
const sockets = {}; // socketId -> socket
const authRooms = new Set(); // authenticated rooms list
const admittedPasses = new Map(); // UUID -> roomId

app.set('trust proxy', trustProxy); // Enables trust for proxy headers (e.g., X-Forwarded-For) based on the trustProxy setting
app.use(helmet.noSniff()); // Enable content type sniffing prevention

// Use all static files from the public folder
const staticOptions = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        // Add other headers if needed...
    },
};

// Serve static files from root (/)
app.use(express.static(dir.public, staticOptions));



app.use(cors(corsOptions)); // Enable CORS with options
app.use(compression()); // Compress all HTTP responses using GZip
app.use(cookieParser()); // Parse cookies
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(apiBasePath + '/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); // api docs

// Restrict access to specified IP
app.use((req, res, next) => {
    if (!ipWhitelist.enabled) return next();
    const clientIP = getIP(req);
    log.debug('Check IP', clientIP);
    if (ipWhitelist.allowed.includes(clientIP)) {
        next();
    } else {
        log.info('Forbidden: Access denied from this IP address', { clientIP: clientIP });
        res.status(403).json({ error: 'Forbidden', message: 'Access denied from this IP address.' });
    }
});

app.use((req, res, next) => {
    const ipAddress = getIP(req);
    log.debug('New request:', {
        ip: ipAddress,
        method: req.method,
        path: req.originalUrl,
        body: req.body,
        //headers: req.headers,
    });
    next();
});



// Remove trailing slashes in url handle bad requests
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError || err.status === 400 || 'body' in err) {
        log.error('Request Error', {
            header: req.headers,
            body: req.body,
            error: err.message,
        });
        return res.status(400).send({ status: 404, message: err.message }); // Bad request
    }
    if (req.path.substr(-1) === '/' && req.path.length > 1) {
        let query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});


// main page
app.get('/', (req, res) => {
    res.sendFile(views.login);
});

// User dashboard (deprecated, redirects to home)
app.get('/dashboard', (req, res) => {
    res.redirect('/');
});

// set new room name and join
app.get('/newcall', (req, res) => {
    res.redirect('/');
});

// Get Active rooms
app.get('/activeRooms', (req, res) => {
    htmlInjector.injectHtml(views.activeRooms, res);
});

// Get Custom room
app.get('/customizeRoom', (req, res) => {
    htmlInjector.injectHtml(views.customizeRoom, res);
});


// mirotalk about
app.get(['/about'], (req, res) => {
    res.sendFile(views.about);
});

// privacy policy
app.get(['/privacy'], (req, res) => {
    res.sendFile(views.privacy);
});

// test Stun and Turn connections
app.get(['/icetest'], (req, res) => {
    if (Object.keys(req.query).length > 0) {
        log.debug('Request Query', req.query);
    }
    res.sendFile(views.stunTurn);
});

// Check if room active (exists)
app.post('/isRoomActive', (req, res) => {
    const { roomId } = checkXSS(req.body);

    if (roomId && (hostCfg.protected || hostCfg.user_auth)) {
        const roomActive = Object.prototype.hasOwnProperty.call(peers, roomId);
        if (roomActive) log.debug('isRoomActive', { roomId, roomActive });
        res.status(200).json({ message: roomActive });
    } else {
        res.status(400).json({ message: 'Unauthorized' });
    }
});



// Handle Direct join room with params
app.get('/join/', async (req, res) => {
    if (Object.keys(req.query).length > 0) {
        log.debug('Request Query', req.query);
        /* 
            http://localhost:3000/join?room=test&name=mirotalk&audio=1&video=1&screen=0&chat=1&notify=0&hide=0
            https://p2p.mirotalk.com/join?room=test&name=mirotalk&audio=1&video=1&screen=0&chat=1&notify=0&hide=0&duration=00:00:30
            https://mirotalk.up.railway.app/join?room=test&name=mirotalk&audio=1&video=1&screen=0&chat=1&notify=0&hide=0
        */
        const { room, name, audio, video, screen, chat, notify, hide, duration, token } = checkXSS(req.query);

        if (!room) {
            log.warn('/join/params room empty', room);
            return res.status(401).json({ message: 'Direct Room Join: Missing mandatory room parameter!' });
        }

        if (!Validate.isValidRoomName(room)) {
            return res.status(400).json({
                message: 'Invalid Room name!\nPath traversal pattern detected!',
            });
        }

        const allowRoomAccess = isAllowedRoomAccess('/join/params', req, hostCfg, peers, room);

        if (!allowRoomAccess && !token) {
            return res.status(401).json({ message: 'Direct Room Join Unauthorized' });
        }

        let peerUsername,
            peerPassword = '';
        let isPeerValid = false;
        let isPeerPresenter = false;

        if (token) {
            try {
                // Check if valid JWT token
                const validToken = await isValidToken(token);

                // Not valid token
                if (!validToken) {
                    return res.status(401).json({ message: 'Invalid Token' });
                }

                const { username, password, presenter } = checkXSS(decodeToken(token));
                // Peer credentials
                peerUsername = username;
                peerPassword = password;
                // Check if valid peer
                isPeerValid = isAuthPeer(username, password);
                // Check if presenter
                isPeerPresenter = presenter === '1' || presenter === 'true';
            } catch (err) {
                // Invalid token
                log.error('Direct Join JWT error', err.message);
                return hostCfg.protected || hostCfg.user_auth
                    ? htmlInjector.injectHtml(views.login, res)
                    : htmlInjector.injectHtml(views.landing, res);
            }
        }

        const hostUserAuthenticated = hostCfg.protected && hostCfg.authenticated;

        // Peer valid going to auth as host
        if ((hostCfg.protected && isPeerValid && isPeerPresenter && !hostCfg.authenticated)) {
            const ip = getIP(req);
            hostCfg.authenticated = true;
            authHost.setAuthorizedIP(ip, true);
            log.debug('Direct Join user auth as host done', {
                ip: ip,
                username: peerUsername,
                password: peerPassword,
            });
        }

        // Check if peer authenticated or valid
        if (room && (hostCfg.authenticated || isPeerValid)) {
            // only room mandatory
            return htmlInjector.injectHtml(views.client, res);
        } else {
            return htmlInjector.injectHtml(views.login, res);
        }
    }
});

// Join Room by id
app.get('/join/:roomId', function (req, res) {
    const { roomId } = req.params;

    if (!roomId || !Validate.isValidRoomName(roomId)) {
        log.warn('/join/:roomId invalid', roomId);
        return res.redirect('/');
    }

    // 1. If guest is already admitted (has cookie), let them in
    if (req.cookies[`MeetOn_admitted_${roomId}`] || req.cookies[`MeetOn_room_pass_${roomId}`]) {
        return htmlInjector.injectHtml(views.client, res);
    }

    // 2. [New Frictionless Rule] If the room is completely empty, the first person in bypasses the lobby
    const roomTsvActive = Object.prototype.hasOwnProperty.call(peers, roomId);
    if (!roomTsvActive || Object.keys(peers[roomId] || {}).length === 0) {
        // Issue an admission cookie so their browser knows they bypassed the lobby
        res.cookie(`MeetOn_admitted_${roomId}`, 'true', { maxAge: 900000, httpOnly: true });
        return htmlInjector.injectHtml(views.client, res);
    }

    // 3. Otherwise, show Guest Join / Waiting Room
    res.sendFile(views.guestJoin);
});

// Not specified correctly the room id
app.get('/join/\\*', function (req, res) {
    res.redirect('/');
});

// Signup page
app.get('/signup', (req, res) => {
    res.redirect('/');
});

// Login page
app.get('/login', (req, res) => {
    res.redirect('/');
});

// UI buttons configuration
app.get('/buttons', (req, res) => {
    res.status(200).json({ message: config && config.buttons ? config.buttons : false });
});

// UI brand configuration
app.get('/brand', (req, res) => {
    console.log('Serving brand config:', JSON.stringify(config.brand.about));
    res.status(200).json({ message: config && config.brand && brandHtmlInjection ? config.brand : false });
});

// Join roomId redirect to /join?room=roomId
app.get('/:roomId', (req, res) => {
    const { roomId } = checkXSS(req.params);

    if (!roomId) {
        log.warn('/:roomId empty', roomId);
        return res.redirect('/');
    }

    log.debug('Detected roomId --> redirect to /join?room=roomId');
    res.redirect(`/join/${roomId}`);
});

// Create Room API
app.post('/api/create-room', express.json(), (req, res) => {
    const { roomId, password } = req.body;
    if (!roomId) return res.status(400).json({ success: false, message: 'Room ID is required' });

    if (password) {
        roomManager.createRoom(roomId, password);
    }
    res.json({ success: true });
});

// Room Auth API (Join with password)
app.post('/api/room-auth', express.json(), (req, res) => {
    const { roomId, roomPass } = req.body;
    if (!roomId) return res.status(400).json({ success: false, message: 'Missing parameters' });

    if (roomManager.hasPassword(roomId)) {
        if (roomManager.verifyPassword(roomId, roomPass)) {
            res.cookie(`MeetOn_room_pass_${roomId}`, 'true', { maxAge: 900000, httpOnly: true });
            return res.json({ success: true });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }
    } else {
        // Room has no password, direct admit
        res.cookie(`MeetOn_admitted_${roomId}`, 'true', { maxAge: 900000, httpOnly: true });
        res.json({ success: true });
    }
});

// Check if room has password
app.get('/api/room-has-pass/:roomId', (req, res) => {
    const { roomId } = req.params;
    res.json({ hasPassword: roomManager.hasPassword(roomId) });
});

// Admit Guest API
app.get('/api/admit-guest', (req, res) => {
    const { pass } = req.query;
    if (!pass || !admittedPasses.has(pass)) {
        return res.status(403).json({ success: false, message: 'Invalid or expired pass' });
    }
    const roomId = admittedPasses.get(pass);
    admittedPasses.delete(pass);
    res.cookie(`MeetOn_admitted_${roomId}`, 'true', { maxAge: 900000, httpOnly: true }); // 15 mins
    res.json({ success: true });
});

/**
    MeetOn API v1
    For api docs we use: https://swagger.io/
*/

// request stats list
app.get(`${apiBasePath}/stats`, (req, res) => {
    // Check if endpoint allowed
    if (api_disabled.includes('stats')) {
        return res.status(403).json({
            error: 'This endpoint has been disabled. Please contact the administrator for further information.',
        });
    }
    // check if user was authorized for the api call
    const { host, authorization } = req.headers;
    const api = new ServerApi(host, authorization, api_key_secret);
    if (!api.isAuthorized()) {
        log.debug('MeetOn get stats - Unauthorized', {
            header: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    // Get stats
    const { timestamp, totalRooms, totalPeers } = api.getStats(peers);
    res.json({
        success: true,
        timestamp,
        totalRooms,
        totalPeers,
    });
    // log.debug the output if all done
    log.debug('MeetOn get stats - Authorized', {
        header: req.headers,
        body: req.body,
        timestamp,
        totalRooms,
        totalPeers,
    });
});

// request token endpoint
app.post(`${apiBasePath}/token`, (req, res) => {
    // Check if endpoint allowed
    if (api_disabled.includes('token')) {
        return res.status(403).json({
            error: 'This endpoint has been disabled. Please contact the administrator for further information.',
        });
    }
    // check if user was authorized for the api call
    const { host, authorization } = req.headers;
    const api = new ServerApi(host, authorization, api_key_secret);
    if (!api.isAuthorized()) {
        log.debug('MeetOn get token - Unauthorized', {
            header: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    // Get Token
    const token = api.getToken(req.body);
    res.json({ token: token });
    // log.debug the output if all done
    log.debug('MeetOn get token - Authorized', {
        header: req.headers,
        body: req.body,
        token: token,
    });
});

// request meetings list
app.get(`${apiBasePath}/meetings`, (req, res) => {
    // Check if endpoint allowed
    if (api_disabled.includes('meetings')) {
        return res.status(403).json({
            error: 'This endpoint has been disabled. Please contact the administrator for further information.',
        });
    }
    // check if user was authorized for the api call
    const { host, authorization } = req.headers;
    const api = new ServerApi(host, authorization, api_key_secret);
    if (!api.isAuthorized()) {
        log.debug('MeetOn get meetings - Unauthorized', {
            header: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    // Get meetings
    const meetings = api.getMeetings(peers);
    res.json({ meetings: meetings });
    // log.debug the output if all done
    log.debug('MeetOn get meetings - Authorized', {
        header: req.headers,
        body: req.body,
        meetings: meetings,
    });
});

// API request meeting room endpoint
app.post(`${apiBasePath}/meeting`, (req, res) => {
    // Check if endpoint allowed
    if (api_disabled.includes('meeting')) {
        return res.status(403).json({
            error: 'This endpoint has been disabled. Please contact the administrator for further information.',
        });
    }
    const { host, authorization } = req.headers;
    const api = new ServerApi(host, authorization, api_key_secret);
    if (!api.isAuthorized()) {
        log.debug('MeetOn get meeting - Unauthorized', {
            header: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    const meetingURL = api.getMeetingURL();
    res.json({ meeting: meetingURL });
    log.debug('MeetOn get meeting - Authorized', {
        header: req.headers,
        body: req.body,
        meeting: meetingURL,
    });
});

// API request join room endpoint
app.post(`${apiBasePath}/join`, (req, res) => {
    // Check if endpoint allowed
    if (api_disabled.includes('join')) {
        return res.status(403).json({
            error: 'This endpoint has been disabled. Please contact the administrator for further information.',
        });
    }
    const { host, authorization } = req.headers;
    const api = new ServerApi(host, authorization, api_key_secret);
    if (!api.isAuthorized()) {
        log.debug('MeetOn get join - Unauthorized', {
            header: req.headers,
            body: req.body,
        });
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    const joinURL = api.getJoinURL(req.body);
    res.json({ join: joinURL });
    log.debug('MeetOn get join - Authorized', {
        header: req.headers,
        body: req.body,
        join: joinURL,
    });
});



/**
 * Request meeting room endpoint
 * @returns  entrypoint / Room URL for your meeting.
 */
function getMeetingURL(host) {
    return 'http' + (host.includes('localhost') ? '' : 's') + '://' + host + '/join/' + uuidV4();
}

// request active rooms endpoint
app.get(`${apiBasePath}/activeRooms`, (req, res) => {
    // Check if endpoint allowed
    if (!hostCfg.showActiveRooms) {
        return res.status(403).json({
            error: 'This endpoint has been disabled. Please contact the administrator for further information.',
        });
    }
    // check if user was authorized for the api call
    const { host, authorization = api_key_secret } = req.headers;
    const api = new ServerApi(host, authorization, api_key_secret);

    // Get active rooms
    const activeRooms = api.getActiveRooms(peers);
    res.json({ activeRooms: activeRooms });

    // log.debug the output if all done
    log.debug('MeetOn get active rooms - Authorized', {
        header: req.headers,
        body: req.body,
        activeRooms: activeRooms,
    });
});

// end of MeetOn API v1

// not match any of page before, so 404 not found
app.use((req, res) => {
    res.sendFile(views.notFound);
});

// Global error handler for URIError and other errors
app.use((err, req, res, next) => {
    if (err instanceof URIError) {
        log.warn('Malformed URI detected', {
            url: req.url,
            ip: getIP(req),
            error: err.message,
        });
        return res.status(400).send({ status: 400, message: 'Invalid URL encoding' });
    }
    // Handle other errors
    log.error('Unhandled error', {
        url: req.url,
        error: err.message,
        stack: err.stack,
    });
    res.status(500).send({ status: 500, message: 'Internal server error' });
});

/**
 * Get Server config
 * @param {string} tunnel
 * @returns server config
 */
function getServerConfig() {
    return {
        // General Server Information
        server: host,
        trust_proxy: trustProxy,
        api_docs: api_docs,

        // Core Configurations
        jwtCfg: jwtCfg,
        cors: corsOptions,
        iceServers: iceServers,
        test_ice_servers: testStunTurn,

        // Security, Authorization, and User Management
        host_protected: hostCfg.protected || hostCfg.user_auth ? hostCfg : false,
        presenters: roomPresenters,
        ip_whitelist: ipWhitelist.enabled ? ipWhitelist : false,
        api_key_secret: api_key_secret,

        // Media and Connection Settings
        turn_enabled: turnServerEnabled,
        ip_lookup_enabled: IPLookupEnabled,

        // URLs for Redirection
        redirect: redirectEnabled ? redirectURL : false,

        // Versions and environment information
        environment: process.env.NODE_ENV || 'development',
        app_version: packageJson.version,
        node_version: process.versions.node,
    };
}

/**
 * Start Local Server
 */
server.listen(port, null, () => {
    log.debug(
        `%c

	███████╗██╗ ██████╗ ███╗   ██╗      ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ 
	██╔════╝██║██╔════╝ ████╗  ██║      ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
	███████╗██║██║  ███╗██╔██╗ ██║█████╗███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
	╚════██║██║██║   ██║██║╚██╗██║╚════╝╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
	███████║██║╚██████╔╝██║ ╚████║      ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
	╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝      ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ started...

	`,
        'font-family:monospace'
    );

    log.info('Server config', getServerConfig());
});

/**
 * On peer connected
 * Users will connect to the signaling server, after which they'll issue a "join"
 * to join a particular channel. The signaling server keeps track of all sockets
 * who are in a channel, and on join will send out 'addPeer' events to each pair
 * of users in a channel. When clients receive the 'addPeer' even they'll begin
 * setting up an RTCPeerConnection with one another. During this process they'll
 * need to relay ICECandidate information to one another, as well as SessionDescription
 * information. After all of that happens, they'll finally be able to complete
 * the peer connection and will be in streaming audio/video between eachother.
 */
io.sockets.on('connect', async (socket) => {
    log.debug('[' + socket.id + '] connection accepted', {
        host: socket.handshake.headers.host.split(':')[0],
        time: socket.handshake.time,
    });

    socket.channels = {};
    sockets[socket.id] = socket;

    const transport = socket.conn.transport.name; // in most cases, "polling"
    log.debug('[' + socket.id + '] Connection transport', transport);

    /**
     * Check upgrade transport
     */
    socket.conn.on('upgrade', () => {
        const upgradedTransport = socket.conn.transport.name; // in most cases, "websocket"
        log.debug('[' + socket.id + '] Connection upgraded transport', upgradedTransport);
    });

    /**
     * On peer disconnected
     */
    socket.on('disconnect', async (reason) => {
        removeIP(socket);
        for (let channel in socket.channels) {
            await removePeerFrom(channel, socket, reason);
        }

        // Remove from guest lobby if present
        for (let roomId in guestLobby) {
            if (guestLobby[roomId][socket.id]) {
                delete guestLobby[roomId][socket.id];
                log.debug('[' + socket.id + '] Removed from guest lobby on disconnect');
            }
        }

        log.debug('[' + socket.id + '] disconnected', { reason: reason });
        delete sockets[socket.id];
    });

    /**
     * Guest "Knock" on room
     */
    socket.on('knock', (data) => {
        const { roomId, guestName } = data;
        log.debug('[' + socket.id + '] Guest knocking on room: ' + roomId, { guestName });

        if (!guestLobby[roomId]) guestLobby[roomId] = {};
        guestLobby[roomId][socket.id] = guestName;

        // Notify all authenticated users (hosts) in this room
        // We look into the 'peers' for this room and find those with req.user equivalent data
        // For simplicity, we can emit to everyone in the room and let them handle it if they are a 'host'
        // In Mirotalk, 'presenters' are often the hosts.
        io.to(roomId).emit('peerKnocking', {
            guestId: socket.id,
            guestName: guestName
        });
    });

    /**
     * Host response to guest knock
     */
    socket.on('admissionResponse', (data) => {
        const { roomId, guestId, status } = data;
        log.debug('[' + socket.id + '] Host response for guest ' + guestId + ': ' + status);

        const guestSocket = sockets[guestId];
        if (guestSocket) {
            let pass = null;
            if (status === 'admitted') {
                const { v4: uuidv4 } = require('uuid');
                pass = uuidv4();
                admittedPasses.set(pass, roomId);
                // Auto-expire pass after 1 minute if not used
                setTimeout(() => admittedPasses.delete(pass), 60000);
            }
            guestSocket.emit('admissionStatus', { status, pass });
        }
    });

    // End of admission logic

    /**
     * Handle incoming data, res with a callback
     */
    socket.on('data', async (dataObj, cb) => {
        const data = checkXSS(dataObj);

        log.debug('Socket Promise', data);

        if (!Validate.isValidData(data)) return;

        //...
        const { room_id, peer_id, peer_name, method, params } = data;

        switch (method) {
            case 'checkPeerName':
                log.debug('Check if peer name exists', { peer_name: peer_name, room_id: room_id });
                for (let id in peers[room_id]) {
                    if (peer_id != id && peers[room_id][id]['peer_name'] == peer_name) {
                        log.debug('Peer name found', { peer_name: peer_name, room_id: room_id });
                        cb(true);
                        break;
                    }
                }
                break;
            //....
            default:
                cb(false);
                break;
        }
        cb(false);
    });

    /**
     * On peer join
     */
    socket.on('join', async (cfg) => {
        // Get peer IPv4 (::1 Its the loopback address in ipv6, equal to 127.0.0.1 in ipv4)
        const peer_ip = getSocketIP(socket);

        // Get peer Geo Location
        if (IPLookupEnabled && peer_ip != '::1') {
            cfg.peer_geo = await getPeerGeoLocation(peer_ip);
        }

        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        // log.debug('Join room', config);
        log.debug('[' + socket.id + '] join ', config);

        const {
            channel,
            channel_password,
            peer_uuid,
            peer_name,
            peer_avatar,
            peer_token,
            peer_video,
            peer_audio,
            peer_video_status,
            peer_audio_status,
            peer_screen_status,
            peer_hand_status,
            peer_rec_status,
            peer_privacy_status,
            peer_info,
        } = config;

        if (!Validate.isValidRoomName(channel)) {
            log.warn('[' + socket.id + '] - Invalid room name', channel);
            return socket.emit('unauthorized');
        }

        if (channel in socket.channels) {
            return log.debug('[' + socket.id + '] [Warning] already joined', channel);
        }
        // no channel aka room in channels init
        if (!(channel in channels)) channels[channel] = {};

        // no channel aka room in peers init
        if (!(channel in peers)) peers[channel] = {};

        // no presenter aka host in presenters init
        if (!(channel in presenters)) presenters[channel] = {};

        let is_presenter = true;

        // User Auth required, we check if peer valid
        if (hostCfg.user_auth || peer_token) {
            // Check JWT
            if (peer_token) {
                try {
                    const validToken = await isValidToken(peer_token);

                    if (!validToken) {
                        // redirect peer to login page
                        return socket.emit('unauthorized');
                    }

                    const { username, password, presenter } = checkXSS(decodeToken(peer_token));

                    const isPeerValid = isAuthPeer(username, password);

                    if (!isPeerValid) {
                        // redirect peer to login page
                        return socket.emit('unauthorized');
                    }

                    // Presenter if token 'presenter' is '1'/'true' or first to join room
                    is_presenter =
                        presenter === '1' || presenter === 'true' || Object.keys(presenters[channel]).length === 0;

                    log.debug('[' + socket.id + '] JOIN ROOM - USER AUTH check peer', {
                        ip: peer_ip,
                        peer_username: username,
                        peer_password: password,
                        peer_valid: isPeerValid,
                        peer_presenter: is_presenter,
                    });
                } catch (err) {
                    // redirect peer to login page
                    log.error('[' + socket.id + '] [Warning] Join Room JWT error', err.message);
                    return socket.emit('unauthorized');
                }
            } else {
                // redirect peer to login page
                return socket.emit('unauthorized');
            }
        }

        // room locked by the participants can't join
        if (peers[channel]['lock'] === true && peers[channel]['password'] != channel_password) {
            log.debug('[' + socket.id + '] [Warning] Room Is Locked', channel);
            return socket.emit('roomIsLocked');
        }

        // Set the presenters
        const presenter = {
            peer_ip: peer_ip,
            peer_name: peer_name,
            peer_uuid: peer_uuid,
            is_presenter: is_presenter,
        };
        // first we check if the username match the presenters username
        if (roomPresenters && roomPresenters.includes(peer_name)) {
            presenters[channel][socket.id] = presenter;
        } else {
            // if not match the presenters username, the first one join room is the presenter
            if (Object.keys(presenters[channel]).length === 0) {
                presenters[channel][socket.id] = presenter;
            }
        }

        // Check if peer is presenter, if token check the presenter key
        const isPresenter = peer_token ? is_presenter : isPeerPresenter(channel, socket.id, peer_name, peer_uuid);

        // Some peer info data
        const { osName, osVersion, browserName, browserVersion, extras } = peer_info;

        // collect peers info grp by channels
        peers[channel][socket.id] = {
            peer_name: peer_name,
            peer_avatar: peer_avatar,
            peer_presenter: isPresenter,
            peer_video: peer_video,
            peer_audio: peer_audio,
            peer_video_status: peer_video_status,
            peer_audio_status: peer_audio_status,
            peer_screen_status: peer_screen_status,
            peer_hand_status: peer_hand_status,
            peer_rec_status: peer_rec_status,
            peer_privacy_status: peer_privacy_status,
            os: osName ? `${osName} ${osVersion}` : '',
            browser: browserName ? `${browserName} ${browserVersion}` : '',
            extras: extras,
        };

        const activeRooms = getActiveRooms();

        log.debug('[Join] - active rooms and peers count', activeRooms);

        log.debug('[Join] - connected presenters grp by roomId', presenters);

        log.debug('[Join] - connected peers grp by roomId', peers);

        await addPeerTo(channel);

        channels[channel][socket.id] = socket;
        socket.channels[channel] = channel;

        const peerCounts = Object.keys(peers[channel]).length;

        // Send some server info to joined peer
        await sendToPeer(socket.id, sockets, 'serverInfo', {
            peers_count: peerCounts,
            host_protected: hostCfg.protected,
            user_auth: hostCfg.user_auth,
            is_presenter: isPresenter,
            redirect: {
                active: redirectEnabled,
                url: redirectURL,
            },
            maxRoomParticipants: hostCfg.maxRoomParticipants,
            //...
        });

        // [Bug Fix] Send pending lobby knocks to the host if they just joined
        if (isPresenter && guestLobby[channel]) {
            for (let guestId in guestLobby[channel]) {
                socket.emit('peerKnocking', {
                    guestId: guestId,
                    guestName: guestLobby[channel][guestId]
                });
            }
        }
    });

    /**
     * Relay ICE to peers
     */
    socket.on('relayICE', async (config) => {
        if (!Validate.isValidData(config)) return;
        const { peer_id, ice_candidate } = config;

        // log.debug('[' + socket.id + '] relay ICE-candidate to [' + peer_id + '] ', {
        //     address: config.ice_candidate,
        // });

        await sendToPeer(peer_id, sockets, 'iceCandidate', {
            peer_id: socket.id,
            ice_candidate: ice_candidate,
        });
    });

    /**
     * Relay SDP to peers
     */
    socket.on('relaySDP', async (config) => {
        if (!Validate.isValidData(config)) return;
        const { peer_id, session_description } = config;

        log.debug('[' + socket.id + '] relay SessionDescription to [' + peer_id + '] ', {
            type: session_description.type,
        });

        await sendToPeer(peer_id, sockets, 'sessionDescription', {
            peer_id: socket.id,
            session_description: session_description,
        });
    });

    /**
     * Handle Room action
     */
    socket.on('roomAction', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        //log.debug('[' + socket.id + '] Room action:', config);
        const { room_id, peer_id, peer_name, peer_uuid, password, action } = config;

        // Check if peer is presenter
        const isPresenter = isPeerPresenter(room_id, peer_id, peer_name, peer_uuid);

        let room_is_locked = false;
        //
        try {
            switch (action) {
                case 'lock':
                    if (!isPresenter) return;
                    peers[room_id]['lock'] = true;
                    peers[room_id]['password'] = password;
                    await sendToRoom(room_id, socket.id, 'roomAction', {
                        peer_name: peer_name,
                        action: action,
                    });
                    room_is_locked = true;
                    break;
                case 'unlock':
                    if (!isPresenter) return;
                    delete peers[room_id]['lock'];
                    delete peers[room_id]['password'];
                    await sendToRoom(room_id, socket.id, 'roomAction', {
                        peer_name: peer_name,
                        action: action,
                    });
                    break;
                case 'checkPassword':
                    const data = {
                        peer_name: peer_name,
                        action: action,
                        password: password == peers[room_id]['password'] ? 'OK' : 'KO',
                    };
                    await sendToPeer(socket.id, sockets, 'roomAction', data);
                    break;
                default:
                    break;
            }
        } catch (err) {
            log.error('Room action', toJson(err));
        }
        log.debug('[' + socket.id + '] Room ' + room_id, { locked: room_is_locked, password: password });
    });

    /**
     * Relay NAME to peers
     */
    socket.on('peerName', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        // log.debug('Peer name', config);
        const { room_id, peer_name_old, peer_name_new, peer_avatar } = config;

        let peer_id_to_update = null;

        for (let peer_id in peers[room_id]) {
            if (peers[room_id][peer_id]['peer_name'] == peer_name_old && peer_id == socket.id) {
                peers[room_id][peer_id]['peer_name'] = peer_name_new;
                // presenter
                if (presenters && presenters[room_id] && presenters[room_id][peer_id]) {
                    presenters[room_id][peer_id]['peer_name'] = peer_name_new;
                }
                peer_id_to_update = peer_id;
                log.debug('[' + socket.id + '] Peer name changed', {
                    peer_name_old: peer_name_old,
                    peer_name_new: peer_name_new,
                });
            }
        }

        if (peer_id_to_update) {
            const data = {
                peer_id: peer_id_to_update,
                peer_name: peer_name_new,
                peer_avatar: peer_avatar,
            };
            log.debug('[' + socket.id + '] emit peerName to [room_id: ' + room_id + ']', data);

            await sendToRoom(room_id, socket.id, 'peerName', data);
        }
    });

    /**
     * Handle messages
     */
    socket.on('message', async (message) => {
        const data = checkXSS(message);

        log.debug('Got message', data);

        if (!Validate.isValidData(data)) return;

        await sendToRoom(data.room_id, socket.id, 'message', data);
    });

    /**
     * Relay commands to peers or specific peer in the same room
     * @param {Object} cfg - The configuration object containing command details.
     * @param {string} cfg.action - The action to be performed (e.g., 'geoLocation').
     * @param {boolean} cfg.send_to_all - Whether to send the command to all peers in the room.
     * @param {Object} cfg.data - The data associated with the command.
     */
    socket.on('cmd', async (cfg) => {
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        const { action, send_to_all, data } = config;

        const { room_id, peer_id, peer_name, peer_uuid, to_peer_id } = data;

        log.debug('cmd', config);

        // Only the presenter can do this actions
        const presenterActions = ['geoLocation'];
        if (presenterActions.some((v) => action === v)) {
            // Check if peer is presenter
            const isPresenter = isPeerPresenter(room_id, peer_id, peer_name, peer_uuid);
            // if not presenter do nothing
            if (!isPresenter) return;
        }

        if (send_to_all) {
            log.debug('[' + socket.id + '] emit cmd to [room_id: ' + room_id + ']', config);

            await sendToRoom(room_id, socket.id, 'cmd', config);
        } else {
            log.debug('[' + socket.id + '] emit cmd to [' + to_peer_id + '] from room_id [' + room_id + ']');

            await sendToPeer(to_peer_id, sockets, 'cmd', config);
        }
    });

    /**
     * Relay Audio Video Hand ... Status to peers
     */
    socket.on('peerStatus', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        // log.debug('Peer status', config);
        const { room_id, peer_name, peer_id, element, status, extras } = config;

        const data = {
            peer_id: peer_id,
            peer_name: peer_name,
            element: element,
            status: status,
            extras: extras,
        };

        try {
            for (let peer_id in peers[room_id]) {
                if (peers[room_id][peer_id]['peer_name'] == peer_name && peer_id == socket.id) {
                    switch (element) {
                        case 'video':
                            peers[room_id][peer_id]['peer_video_status'] = status;
                            break;
                        case 'audio':
                            peers[room_id][peer_id]['peer_audio_status'] = status;
                            break;
                        case 'screen':
                            peers[room_id][peer_id]['peer_screen_status'] = status;
                            if (extras) peers[room_id][peer_id]['extras'] = extras;
                            break;
                        case 'hand':
                            peers[room_id][peer_id]['peer_hand_status'] = status;
                            break;
                        case 'rec':
                            peers[room_id][peer_id]['peer_rec_status'] = status;
                            break;
                        case 'privacy':
                            peers[room_id][peer_id]['peer_privacy_status'] = status;
                            break;
                        default:
                            break;
                    }
                }
            }

            log.debug('[' + socket.id + '] emit peerStatus to [room_id: ' + room_id + ']', data);

            await sendToRoom(room_id, socket.id, 'peerStatus', data);
        } catch (err) {
            log.error('Peer Status', toJson(err));
        }
    });

    /**
     * Relay actions to peers or specific peer in the same room
     */
    socket.on('peerAction', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        // log.debug('Peer action', config);
        const {
            room_id,
            peer_id,
            peer_uuid,
            peer_name,
            peer_avatar,
            peer_use_video,
            peer_action,
            extras,
            send_to_all,
        } = config;

        // Only the presenter can do this actions
        const presenterActions = ['muteAudio', 'hideVideo', 'ejectAll'];
        if (presenterActions.some((v) => peer_action === v)) {
            // Check if peer is presenter
            const isPresenter = isPeerPresenter(room_id, peer_id, peer_name, peer_uuid);
            // if not presenter do nothing
            if (!isPresenter) return;
        }

        const data = {
            peer_id: peer_id,
            peer_name: peer_name,
            peer_avatar: peer_avatar,
            peer_action: peer_action,
            peer_use_video: peer_use_video,
            extras: extras,
        };

        if (send_to_all) {
            log.debug('[' + socket.id + '] emit peerAction to [room_id: ' + room_id + ']', data);

            await sendToRoom(room_id, socket.id, 'peerAction', data);
        } else {
            log.debug('[' + socket.id + '] emit peerAction to [' + peer_id + '] from room_id [' + room_id + ']');

            await sendToPeer(peer_id, sockets, 'peerAction', data);
        }
    });

    /**
     * Start caption
     */
    socket.on('caption', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        await sendToRoom(cfg.room_id, sockets, 'caption', config);
    });

    /**
     * Relay Kick out peer from room
     */
    socket.on('kickOut', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        const { room_id, peer_id, peer_uuid, peer_name } = config;

        // Check if peer is presenter
        const isPresenter = await isPeerPresenter(room_id, peer_id, peer_name, peer_uuid);

        // Only the presenter can kickOut others
        if (isPresenter) {
            log.debug('[' + socket.id + '] kick out peer [' + peer_id + '] from room_id [' + room_id + ']');

            await sendToPeer(peer_id, sockets, 'kickOut', {
                peer_name: peer_name,
            });
        }
    });

    /**
     * Relay File info
     */
    socket.on('fileInfo', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        // log.debug('File info', config);
        const { room_id, peer_id, peer_name, peer_avatar, broadcast, file } = config;

        // check if valid fileName
        if (!isValidFileName(file.fileName)) {
            log.debug('[' + socket.id + '] File name not valid', config);
            return;
        }

        function bytesToSize(bytes) {
            let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes == 0) return '0 Byte';
            let i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        }

        log.debug('[' + socket.id + '] Peer [' + peer_name + '] send file to room_id [' + room_id + ']', {
            peerName: peer_name,
            peerAvatar: peer_avatar,
            fileName: file.fileName,
            fileSize: bytesToSize(file.fileSize),
            fileType: file.fileType,
            broadcast: broadcast,
        });

        if (broadcast) {
            await sendToRoom(room_id, socket.id, 'fileInfo', config);
        } else {
            await sendToPeer(peer_id, sockets, 'fileInfo', config);
        }
    });

    /**
     * Abort file sharing
     */
    socket.on('fileAbort', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        const { room_id, peer_name } = config;

        log.debug('[' + socket.id + '] Peer [' + peer_name + '] send fileAbort to room_id [' + room_id + ']');
        await sendToRoom(room_id, socket.id, 'fileAbort');
    });

    socket.on('fileReceiveAbort', async (cfg) => {
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        const { room_id, peer_name } = config;
        log.debug('[' + socket.id + '] Peer [' + peer_name + '] send fileReceiveAbort to room_id [' + room_id + ']');
        await sendToRoom(room_id, socket.id, 'fileReceiveAbort', config);
    });

    /**
     * Relay video player action
     */
    socket.on('videoPlayer', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        // log.debug('Video player', config);
        const { room_id, peer_id, peer_name, video_action, video_src } = config;

        // Check if valid video src url
        if (video_action == 'open' && !isValidHttpURL(video_src)) {
            log.debug('[' + socket.id + '] Video src not valid', config);
            return;
        }

        const data = {
            peer_id: socket.id,
            peer_name: peer_name,
            video_action: video_action,
            video_src: video_src,
        };

        if (peer_id) {
            log.debug('[' + socket.id + '] emit videoPlayer to [' + peer_id + '] from room_id [' + room_id + ']', data);

            await sendToPeer(peer_id, sockets, 'videoPlayer', data);
        } else {
            log.debug('[' + socket.id + '] emit videoPlayer to [room_id: ' + room_id + ']', data);

            await sendToRoom(room_id, socket.id, 'videoPlayer', data);
        }
    });

    /**
     * Whiteboard actions for all user in the same room
     */
    socket.on('wbCanvasToJson', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        // log.debug('Whiteboard send canvas', config);
        const { room_id } = config;
        await sendToRoom(room_id, socket.id, 'wbCanvasToJson', config);
    });

    socket.on('whiteboardAction', async (cfg) => {
        // Prevent XSS injection
        const config = checkXSS(cfg);

        if (!Validate.isValidData(config)) return;

        log.debug('Whiteboard', config);
        const { room_id } = config;
        await sendToRoom(room_id, socket.id, 'whiteboardAction', config);
    });

    /**
     * Add peers to channel
     * @param {string} channel room id
     */
    async function addPeerTo(channel) {
        for (let id in channels[channel]) {
            // offer false
            await channels[channel][id].emit('addPeer', {
                peer_id: socket.id,
                peers: peers[channel],
                should_create_offer: false,
                iceServers: iceServers,
            });
            // offer true
            socket.emit('addPeer', {
                peer_id: id,
                peers: peers[channel],
                should_create_offer: true,
                iceServers: iceServers,
            });
            log.debug('[' + socket.id + '] emit addPeer [' + id + ']');
        }
    }

    /**
     * Remove peers from channel
     * @param {string} channel room id
     */
    async function removePeerFrom(channel, socket, reason = 'unknown') {
        if (!(channel in socket.channels)) {
            return log.debug('[' + socket.id + '] [Warning] not in ', channel);
        }
        try {

            delete socket.channels[channel];
            delete channels[channel][socket.id];
            delete peers[channel][socket.id]; // delete peer data from the room

            switch (Object.keys(peers[channel]).length) {
                case 0: // last peer disconnected from the room without room lock & password set
                    delete peers[channel];
                    delete presenters[channel];
                    delete channels[channel]; // Clean up channels to prevent memory leak
                    break;
                case 2: // last peer disconnected from the room having room lock & password set
                    if (peers[channel]['lock'] && peers[channel]['password']) {
                        delete peers[channel]; // clean lock and password value from the room
                        delete presenters[channel]; // clean the presenter from the channel
                        delete channels[channel]; // Clean up channels to prevent memory leak
                    }
                    break;
                default:
                    break;
            }
        } catch (err) {
            log.error('Remove Peer', toJson(err));
        }

        const activeRooms = getActiveRooms();

        log.debug('[removePeerFrom] - active rooms and peers count', activeRooms);

        log.debug('[removePeerFrom] - connected presenters grp by roomId', presenters);

        log.debug('[removePeerFrom] - connected peers grp by roomId', peers);

        for (let id in channels[channel]) {
            await channels[channel][id].emit('removePeer', { peer_id: socket.id });
            socket.emit('removePeer', { peer_id: id });
            log.debug('[' + socket.id + '] emit removePeer [' + id + ']');
        }

        if (hostCfg.protected) {
            hostCfg.authenticated = false;
            removeIP(socket);
        }
    }

    /**
     * Object to Json
     * @param {object} data object
     * @returns {json} indent 4 spaces
     */
    function toJson(data) {
        return JSON.stringify(data, null, 4); // "\t"
    }

    /**
     * Send async data to all peers in the same room except yourself
     * @param {string} room_id id of the room to send data
     * @param {string} socket_id socket id of peer that send data
     * @param {string} msg message to send to the peers in the same room
     * @param {object} config data to send to the peers in the same room
     */
    async function sendToRoom(room_id, socket_id, msg, config = {}) {
        for (let peer_id in channels[room_id]) {
            // not send data to myself
            if (peer_id != socket_id) {
                await channels[room_id][peer_id].emit(msg, config);
                //console.log('Send to room', { msg: msg, config: config });
            }
        }
    }

    /**
     * Send async data to specified peer
     * @param {string} peer_id id of the peer to send data
     * @param {object} sockets all peers connections
     * @param {string} msg message to send to the peer in the same room
     * @param {object} config data to send to the peer in the same room
     */
    async function sendToPeer(peer_id, sockets, msg, config = {}) {
        if (peer_id in sockets) {
            await sockets[peer_id].emit(msg, config);
            //console.log('Send to peer', { msg: msg, config: config });
        }
    }
}); // end [sockets.on-connect]

/**
 * Get Env as boolean
 * @param {string} key
 * @param {boolean} force_true_if_undefined
 * @returns boolean
 */
function getEnvBoolean(key, force_true_if_undefined = false) {
    if (key == undefined && force_true_if_undefined) return true;
    return key == 'true' ? true : false;
}

/**
 * Check if valid filename
 * @param {string} fileName
 * @returns boolean
 */
function isValidFileName(fileName) {
    const invalidChars = /[\\\/\?\*\|:"<>]/;
    return !invalidChars.test(fileName);
}

/**
 * Check if valid URL
 * @param {string} str to check
 * @returns boolean true/false
 */
function isValidHttpURL(input) {
    try {
        const url = new URL(input);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

/**
 * get Peer geo Location using GeoJS
 * https://www.geojs.io/docs/v1/endpoints/geo/
 *
 * @param {string} ip
 * @returns json
 */
async function getPeerGeoLocation(ip) {
    const endpoint = `https://get.geojs.io/v1/ip/geo/${ip}.json`;
    log.debug('Get peer geo', { ip: ip, endpoint: endpoint });
    return axios
        .get(endpoint)
        .then((response) => response.data)
        .catch((error) => log.error(error));
}

/**
 * Check if peer is Presenter
 * @param {string} room_id
 * @param {string} peer_id
 * @param {string} peer_name
 * @param {string} peer_uuid
 * @returns boolean
 */
function isPeerPresenter(room_id, peer_id, peer_name, peer_uuid) {
    try {
        if (!presenters[room_id] || !presenters[room_id][peer_id]) {
            // Presenter not in the presenters config list, disconnected, or peer_id changed...
            for (const [existingPeerID, presenter] of Object.entries(presenters[room_id] || {})) {
                if (presenter.peer_name === peer_name) {
                    log.debug('[' + peer_id + '] Presenter found', presenters[room_id][existingPeerID]);
                    return true;
                }
            }
            return false;
        }

        const isPresenter =
            (typeof presenters[room_id] === 'object' &&
                Object.keys(presenters[room_id][peer_id]).length > 1 &&
                presenters[room_id][peer_id]['peer_name'] === peer_name &&
                presenters[room_id][peer_id]['peer_uuid'] === peer_uuid) ||
            (roomPresenters && roomPresenters.includes(peer_name));

        log.debug('[' + peer_id + '] isPeerPresenter', presenters[room_id][peer_id]);

        return isPresenter;
    } catch (err) {
        log.error('isPeerPresenter', err);
        return false;
    }
}

/**
 * Check if peer is present in the host users
 * @param {string} username
 * @param {string} password
 * @returns Boolean true/false
 */
function isAuthPeer(username, password) {
    return hostCfg.users && hostCfg.users.some((user) => user.username === username && user.password === password);
}

/**
 * Check if valid JWT token
 * @param {string} token
 * @returns boolean
 */
async function isValidToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, jwtCfg.JWT_KEY, (err, decoded) => {
            if (err) {
                // Token is invalid
                resolve(false);
            } else {
                // Token is valid
                resolve(true);
            }
        });
    });
}

/**
 * Encode JWT token payload
 * @param {object} token
 * @returns
 */
function encodeToken(token) {
    if (!token) return '';

    const { username = 'username', password = 'password', presenter = false, expire } = token;

    const expireValue = expire || jwtCfg.JWT_EXP;

    // Constructing payload
    const payload = {
        username: String(username),
        password: String(password),
        presenter: String(presenter),
    };

    // Encrypt payload using AES encryption
    const payloadString = JSON.stringify(payload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, jwtCfg.JWT_KEY).toString();

    // Constructing JWT token
    const jwtToken = jwt.sign({ data: encryptedPayload }, jwtCfg.JWT_KEY, { expiresIn: expireValue });

    return jwtToken;
}

/**
 * Decode JWT Payload data
 * @param {object} jwtToken
 * @returns mixed
 */
function decodeToken(jwtToken) {
    if (!jwtToken) return null;

    // Verify and decode the JWT token
    const decodedToken = jwt.verify(jwtToken, jwtCfg.JWT_KEY);
    if (!decodedToken || !decodedToken.data) {
        throw new Error('Invalid token');
    }

    // Decrypt the payload using AES decryption
    const decryptedPayload = CryptoJS.AES.decrypt(decodedToken.data, jwtCfg.JWT_KEY).toString(CryptoJS.enc.Utf8);

    // Parse the decrypted payload as JSON
    const payload = JSON.parse(decryptedPayload);

    return payload;
}

/**
 * Get All connected peers count grouped by roomId
 * @return {object} array
 */
function getActiveRooms() {
    const roomPeersArray = [];
    // Iterate through each room
    for (const roomId in peers) {
        if (peers.hasOwnProperty(roomId)) {
            // Get the count of peers in the current room
            const peersCount = Object.keys(peers[roomId]).length;
            roomPeersArray.push({
                roomId: roomId,
                peersCount: peersCount,
            });
        }
    }
    return roomPeersArray;
}

/**
 * Check if Allowed Room Access
 * @param {string} logMessage
 * @param {object} req
 * @param {object} hostCfg
 * @param {object} peers
 * @param {string} roomId
 * @returns boolean true/false
 */
function isAllowedRoomAccess(logMessage, req, hostCfg, peers, roomId) {
    const hostUserAuthenticated = hostCfg.protected && hostCfg.authenticated;
    const roomExist = roomId in peers;
    const roomCount = Object.keys(peers).length;

    const allowRoomAccess =
        !hostCfg.protected || // No host protection (default)
        (hostUserAuthenticated && roomExist) || // User authenticated via Login and room Exist
        (hostUserAuthenticated && roomCount === 0) || // User authenticated joins the first room
        roomExist; // User Or Guest join an existing Room

    log.debug(logMessage, {
        hostUserAuthenticated: hostUserAuthenticated,
        roomExist: roomExist,
        roomCount: roomCount,
        extraInfo: {
            roomId: roomId,
            hostProtected: hostCfg.protected,
            hostAuthenticated: hostCfg.authenticated,
        },
        allowRoomAccess: allowRoomAccess,
    });

    return allowRoomAccess;
}

/**
 * Get ip
 * @param {object} req
 * @returns string ip
 */
function getIP(req) {
    const forwarded = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];

    if (forwarded) {
        // Return only the first IP (client's real IP)
        return forwarded.split(',')[0].trim();
    }

    return req.socket.remoteAddress || req.ip;
}

/**
 * Get IP from socket
 * @param {object} socket
 * @returns string
 */
function getSocketIP(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'] || socket.handshake.headers['X-Forwarded-For'];

    if (forwarded) {
        // Return only the first IP (client's real IP)
        return forwarded.split(',')[0].trim();
    }

    return socket.handshake.address;
}

/**
 * Check if auth ip
 * @param {string} ip
 * @returns boolean
 */
function allowedIP(ip) {
    const authorizedIPs = authHost.getAuthorizedIPs();
    const authorizedIP = authHost.isAuthorizedIP(ip);
    log.info('Allowed IPs', { ip: ip, authorizedIP: authorizedIP, authorizedIPs: authorizedIPs });
    return authHost != null && authorizedIP;
}

/**
 * Remove hosts auth ip on socket disconnect
 * @param {object} socket
 */
function removeIP(socket) {
    if (hostCfg.protected) {
        const ip = getSocketIP(socket);
        log.debug('[removeIP] - Host protected check ip', { ip: ip });
        if (ip && allowedIP(ip)) {
            authHost.deleteIP(ip);
            hostCfg.authenticated = false;
            log.info('[removeIP] - Remove IP from auth', {
                ip: ip,
                authorizedIps: authHost.getAuthorizedIPs(),
            });
        }
    }
}

/**
 * Load modules if exists
 * @param {string} filePath
 * @returns
 */
function safeRequire(filePath) {
    let data = null;
    try {
        data = require(filePath);
    } catch (error) {
        log.error(error);
    }
    return data;
}

/**
 * Cleanup HTML injector when the application is shutting down
 */
process.on('SIGINT', () => {
    log.debug('PROCESS', 'SIGINT');
    htmlInjector.cleanup();
    process.exit();
});

process.on('SIGTERM', () => {
    log.debug('PROCESS', 'SIGTERM');
    htmlInjector.cleanup();
    process.exit();
});
