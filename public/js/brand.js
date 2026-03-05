'use strict';

// Brand
const brandDataKey = 'brandDataMeetOn';
const brandData = window.sessionStorage.getItem(brandDataKey);

// Html pages
const landingTitle = document.getElementById('landingTitle');
const newCallTitle = document.getElementById('newCallTitle');
const newCallRoomTitle = document.getElementById('newCallRoomTitle');
const newCallRoomDescription = document.getElementById('newCallRoomDescription');
const loginTitle = document.getElementById('loginTitle');
const privacyPolicyTitle = document.getElementById('privacyPolicyTitle');
const stunTurnTitle = document.getElementById('stunTurnTitle');
const clientTitle = document.getElementById('clientTitle');
const notFoundTitle = document.getElementById('notFoundTitle');

const shortcutIcon = document.getElementById('shortcutIcon');
const appleTouchIcon = document.getElementById('appleTouchIcon');

const appTitle = document.getElementById('appTitle');
const appDescription = document.getElementById('appDescription');
const appJoinDescription = document.getElementById('appJoinDescription');
const joinRoomBtn = document.getElementById('joinRoomButton');
const customizeRoomBtn = document.getElementById('customizeRoomButton');
const appJoinLastRoom = document.getElementById('appJoinLastRoom');

const features = document.getElementById('features');
const footer = document.getElementById('footer');
//...

// Brand customizations...

let brand = {
    app: {
        language: 'en',
        name: 'MeetOn',
        title: '<h1>MeetOn</h1>Free peer-to-peer video calls.<br />No downloads. No sign-ups. Just connect.',
        description:
            'Start a video call instantly — just pick a room name and share the link. Crystal-clear HD quality with screen sharing, chat, and more.',
        joinDescription: 'Pick a room name.<br />How about this one?',
        joinButtonLabel: 'JOIN ROOM',
        customizeRoomButtonLabel: 'CUSTOMIZE ROOM',
        joinLastLabel: 'Your recent room:',
    },
    site: {
        shortcutIcon: '../images/logo.png',
        appleTouchIcon: '../images/logo.png',
        landingTitle: 'MeetOn — Free Secure Video Calls',
        newCallTitle: 'MeetOn — Start a Call',
        newCallRoomTitle: 'Pick name. <br />Share URL. <br />Start call.',
        newCallRoomDescription:
            "Each room has its own URL. Just pick a room name and share the link. It's that easy.",
        loginTitle: 'MeetOn — Login',
        clientTitle: 'MeetOn — Video Call',
        privacyPolicyTitle: 'MeetOn — Privacy Policy',
        stunTurnTitle: 'Test Stun/Turn Servers.',
        notFoundTitle: 'MeetOn — Page not found',
    },
    html: {
        features: true,
        footer: true,
    },
    about: {
        imageUrl: '../images/logo.png',
        title: 'MeetOn',
        html: `
            <br /><br />
            <hr />
            <span>&copy; ${new Date().getFullYear()} MeetOn</span>
            <hr />
        `,
    },
    //...
};

/**
 * Get started
 */
async function initBrand() {
    await getBrand();
    handleBrand();
}

/**
 * Get brand from server
 */
async function getBrand() {
    if (brandData) {
        setBrand(JSON.parse(brandData));
    } else {
        try {
            const response = await fetch('/brand', { timeout: 5000 });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            const serverBrand = data.message;
            if (serverBrand) {
                setBrand(serverBrand);
                console.log('FETCH BRAND SETTINGS', {
                    serverBrand: serverBrand,
                    clientBrand: brand,
                });
                window.sessionStorage.setItem(brandDataKey, JSON.stringify(serverBrand));
            } else {
                console.warn('FETCH BRAND SETTINGS - DISABLED');
            }
        } catch (error) {
            console.error('FETCH GET BRAND ERROR', error.message);
        }
    }
}

/**
 * Set brand
 * @param {object} data
 */
function setBrand(data) {
    brand = mergeBrand(brand, data);
    console.log('Set Brand done');
}

/**
 * Deep merge two objects
 * @param {object} target target object
 * @param {object} source source object
 * @returns {object} merged object
 */
function mergeBrand(target, source) {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return source;
    const output = Array.isArray(target) ? target.slice() : { ...target };
    for (const key of Object.keys(source)) {
        const srcVal = source[key];
        const tgtVal = output[key];
        if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
            output[key] = mergeBrand(tgtVal || {}, srcVal);
        } else {
            output[key] = srcVal;
        }
    }
    return output;
}

/**
 * Handle Brand
 */
function handleBrand() {
    if (landingTitle && brand.site?.landingTitle) landingTitle.textContent = brand.site.landingTitle;

    if (newCallTitle && brand.site?.newCallTitle) newCallTitle.textContent = brand.site.newCallTitle;
    if (newCallRoomTitle && brand.site?.newCallRoomTitle) newCallRoomTitle.innerHTML = brand.site.newCallRoomTitle;
    if (newCallRoomDescription && brand.site?.newCallRoomDescription)
        newCallRoomDescription.textContent = brand.site.newCallRoomDescription;

    if (loginTitle && brand.site?.loginTitle) loginTitle.textContent = brand.site.loginTitle;
    if (privacyPolicyTitle && brand.site?.privacyPolicyTitle)
        privacyPolicyTitle.textContent = brand.site.privacyPolicyTitle;
    if (stunTurnTitle && brand.site?.stunTurnTitle) stunTurnTitle.textContent = brand.site.stunTurnTitle;
    if (clientTitle && brand.site?.clientTitle) clientTitle.textContent = brand.site.clientTitle;
    if (notFoundTitle && brand.site?.notFoundTitle) notFoundTitle.textContent = brand.site.notFoundTitle;

    if (shortcutIcon && brand.site?.shortcutIcon) shortcutIcon.href = brand.site.shortcutIcon;
    if (appleTouchIcon && brand.site?.appleTouchIcon) appleTouchIcon.href = brand.site.appleTouchIcon;

    if (appTitle && brand.app?.title) appTitle.innerHTML = brand.app.title;
    if (appDescription && brand.app?.description) appDescription.textContent = brand.app.description;
    if (appJoinDescription && brand.app?.joinDescription) appJoinDescription.innerHTML = brand.app.joinDescription;
    if (joinRoomBtn && brand.app?.joinButtonLabel) joinRoomBtn.innerText = brand.app.joinButtonLabel;
    if (customizeRoomBtn && brand.app?.customizeRoomButtonLabel)
        customizeRoomBtn.innerText = brand.app.customizeRoomButtonLabel;
    if (appJoinLastRoom && brand.app?.joinLastLabel) appJoinLastRoom.innerText = brand.app.joinLastLabel;

    // helper to toggle elements
    const displayElements = (list) => list.forEach(([el, show]) => elementDisplay(el, !!show));

    displayElements([
        [features, brand.html?.features],
        [footer, brand.html?.footer],
    ]);
}

/**
 * Handle Element display
 * @param {object} element
 * @param {boolean} display
 * @param {string} mode
 */
function elementDisplay(element, display, mode = 'block') {
    if (!element) return;
    element.style.display = display ? mode : 'none';
}

initBrand();
