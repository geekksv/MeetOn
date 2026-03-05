'use strict';

/**
 * ==============================================
 * MeetOn - Configuration Template
 * ==============================================
 */

const packageJson = require('../../package.json');

module.exports = {
    brand: {
        htmlInjection: true,
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
        og: {
            type: 'app-webrtc',
            siteName: 'MeetOn',
            title: 'Click the link to join the call.',
            description:
                'Free peer-to-peer HD video calls. No downloads or sign-ups required.',
            image: '',
            url: 'https://MeetOn.duckdns.org',
        },
        site: {
            shortcutIcon: '../images/logo.svg',
            appleTouchIcon: '../images/logo.svg',
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
            imageUrl: '../images/logo.svg',
            title: `MeetOn v${packageJson.version}`,
            html: `
                <br /><br />
                <hr />
                <span>&copy; ${new Date().getFullYear()} MeetOn</span>
                <hr />
            `,
        },
        //...
    },
    buttons: {
        main: {
            showAudioBtn: true,
            showVideoBtn: true,
            showScreenBtn: true,
            showMyHandBtn: true,
            showChatRoomBtn: true,
            showParticipantsBtn: true,
            showMySettingsBtn: true,
            showExtraBtn: true,
            showShareQr: true,
            showShareRoomBtn: true,
            showHideMeBtn: true,
            showRecordStreamBtn: true,
            showFullScreenBtn: true,
            showRoomEmojiPickerBtn: true,
            showCaptionRoomBtn: true,
            showWhiteboardBtn: true,
            showSnapshotRoomBtn: true,
            showFileShareBtn: true,
            showDocumentPipBtn: true,
            showAboutBtn: true,
        },
        chat: {
            showTogglePinBtn: true,
            showMaxBtn: true,
            showSaveMessageBtn: true,
            showMarkDownBtn: true,
            showChatGPTBtn: false,
            showFileShareBtn: true,
            showShareVideoAudioBtn: true,
            showParticipantsBtn: true,
        },
        caption: {
            showTogglePinBtn: true,
            showMaxBtn: true,
        },
        settings: {
            showActiveRoomsBtn: true,
            showMicOptionsBtn: true,
            showTabRoomPeerName: true,
            showTabRoomParticipants: true,
            showTabRoomSecurity: true,
            showTabEmailInvitation: false,
            showCaptionEveryoneBtn: true,
            showMuteEveryoneBtn: true,
            showHideEveryoneBtn: true,
            showEjectEveryoneBtn: true,
            showLockRoomBtn: true,
            showUnlockRoomBtn: true,
            showShortcutsBtn: true,
            customNoiseSuppression: true,
        },
        remote: {
            showAudioVolume: true,
            audioBtnClickAllowed: true,
            videoBtnClickAllowed: true,
            showVideoPipBtn: true,
            showKickOutBtn: true,
            showSnapShotBtn: true,
            showFileShareBtn: true,
            showShareVideoAudioBtn: true,
            showGeoLocationBtn: true,
            showPrivateMessageBtn: true,
            showZoomInOutBtn: false,
            showVideoFocusBtn: true,
        },
        local: {
            showVideoPipBtn: true,
            showSnapShotBtn: true,
            showVideoCircleBtn: true,
            showZoomInOutBtn: false,
            showVideoFocusBtn: true,
        },
        whiteboard: {
            whiteboardLockBtn: false,
        },
    },
};
