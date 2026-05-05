#!/usr/bin/env node
/**
 * Prune unused Telegram TL schema definitions from the bundle.
 *
 * The TL schema contains 500+ API types, but we only need a subset
 * that GramJS actually references in the code.
 */

const fs = require('fs');
const path = require('path');

const bundlePath = process.argv[2] || path.join(__dirname, '../src/pkjs/lib/telegram-bundle.js');

// Required TL definitions extracted from all tl_1.Api.* references in the bundle
const REQUIRED = new Set([
    // Core primitives
    'boolFalse', 'boolTrue', 'true', 'vector', 'error', 'null',

    // Connection handshake
    'initConnection', 'invokeWithLayer', 'invokeAfterMsg',
    'reqPqMulti', 'req_DHParams', 'setClientDHParams',
    'resPQ', 'server_DHParamsOk', 'server_DHParamsFail',
    'serverDHInnerData', 'clientDHInnerData',
    'pQInnerData', 'dhGenOk', 'dhGenRetry', 'dhGenFail',
    'badMsgNotification', 'badServerSalt',
    'msgDetailedInfo', 'msgNewDetailedInfo', 'msgResendReq',
    'msgsAck', 'msgsAllInfo', 'msgsStateReq', 'msgsStateInfo',
    'newSessionCreated', 'pong', 'pingDelayDisconnect',
    'futureSalts', 'inputClientProxy',

    // Auth
    'auth.sentCode', 'auth.authorization', 'auth.sentCodeType', 'auth.codeType',
    'auth.loginToken', 'auth.loginTokenMigrateTo', 'auth.loginTokenSuccess',
    'auth.exportedSession', 'auth.exportSession',
    'auth.sendCode', 'auth.signIn', 'auth.signUp', 'auth.logOut',
    'auth.importAuthorization', 'auth.exportAuthorization',
    'auth.checkPassword', 'auth.resendCode',
    'auth.importLoginToken', 'auth.exportLoginToken', 'auth.importBotAuthorization',
    'auth.authorizationSignUpRequired',
    'auth.sentCodeSuccess', 'auth.sentCodeTypeApp', 'auth.sentCodeTypeSms',
    'auth.sentCodeTypeCall', 'auth.sentCodeTypeFlashCall',
    'auth.sentCodeTypeFragment', 'auth.sentCodeTypeEmailCode',
    'codeSettings',

    // Account
    'account.password', 'account.passwordSettings', 'account.passwordInputSettings',
    'account.getPassword', 'account.updatePasswordSettings', 'account.confirmPasswordEmail',
    'passwordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow',
    'passwordKdfAlgoUnknown', 'inputCheckPasswordEmpty', 'inputCheckPasswordSRP',

    // Users
    'user', 'userFull', 'userEmpty', 'userProfilePhoto', 'userProfilePhotoEmpty', 'userStatus',
    'inputUser', 'inputUserSelf', 'inputUserEmpty', 'inputUserFromMessage',
    'users.userFull', 'users.users', 'users.getUsers',

    // Chats/Channels
    'chat', 'chatFull', 'chatEmpty', 'chatForbidden', 'chatPhoto', 'chatPhotoEmpty',
    'chatBannedRights', 'chatInvite', 'chatInviteAlready', 'chatParticipantsForbidden',
    'channel', 'channelFull', 'channelEmpty', 'channelForbidden',
    'channelAdminLogEventActionEditMessage', 'channelAdminLogEventsFilter',
    'channelParticipantsBanned', 'channelParticipantsContacts',
    'channelParticipantsKicked', 'channelParticipantsSearch',
    'inputPeerChat', 'inputPeerChannel', 'inputPeerEmpty', 'inputPeerSelf',
    'inputPeerUser', 'inputPeerUserFromMessage', 'inputPeerChannelFromMessage',
    'inputChannel', 'inputChatPhoto', 'inputChatPhotoEmpty', 'inputChatUploadedPhoto',
    'chats.chats', 'channels.channels',
    'channels.getChannels', 'channels.getFullChannel', 'channels.getMessages',
    'channels.getParticipants', 'channels.channelParticipantsNotModified',
    'channels.deleteMessages', 'channels.editBanned', 'channels.getAdminLog',
    'channels.leaveChannel', 'channels.readHistory',

    // Peer types
    'peerUser', 'peerChat', 'peerChannel', 'peerEmpty',
    'dialog', 'dialogFolder', 'dialogPeer', 'inputDialogPeer', 'inputNotifyPeer',
    'topPeer',

    // Messages
    'message', 'messageEmpty', 'messageService',
    'messageMediaEmpty', 'messageMediaPhoto', 'messageMediaDocument',
    'messageMediaContact', 'messageMediaDice', 'messageMediaGame',
    'messageMediaGeo', 'messageMediaPoll', 'messageMediaUnsupported',
    'messageMediaVenue', 'messageMediaWebPage',
    'messageEntityBlockquote', 'messageEntityBold', 'messageEntityCode',
    'messageEntityCustomEmoji', 'messageEntityEmail', 'messageEntityItalic',
    'messageEntityMentionName', 'messageEntityPre', 'messageEntitySpoiler',
    'messageEntityStrike', 'messageEntityTextUrl', 'messageEntityUnderline',
    'messageEntityUrl',
    'messages.dialogs', 'messages.dialogsSlice', 'messages.dialogsNotModified',
    'messages.messages', 'messages.messagesSlice', 'messages.channelMessages',
    'messages.messagesNotModified', 'messages.chatFull',
    'messages.sentMessage', 'messages.affectedMessages',
    'inputMessagesEmpty', 'inputMessagesFilterEmpty',
    'inputMessageID', 'inputReplyToMessage', 'inputSingleMedia',
    'messages.sendMessage', 'messages.sendMedia', 'messages.sendMultiMedia',
    'messages.getDialogs', 'messages.getHistory', 'messages.getMessages',
    'messages.getReplies', 'messages.search', 'messages.searchGlobal',
    'messages.readHistory', 'messages.readMentions', 'messages.getChats',
    'messages.getFullChat', 'messages.forwardMessages', 'messages.deleteMessages',
    'messages.editMessage', 'messages.setTyping', 'messages.updatePinnedMessage',
    'messages.unpinAllMessages', 'messages.uploadMedia', 'messages.deleteChatUser',
    'messages.checkChatInvite', 'messages.getDiscussionMessage',
    'messages.getInlineBotResults',

    // Updates
    'updates.state', 'updates.difference', 'updates.differenceEmpty',
    'updates.newMessage', 'updateNewMessage', 'updateNewChannelMessage',
    'updateReadHistory', 'updateEditMessage', 'updateMessageID',
    'updateLoginToken', 'updateServiceNotification',
    'updateShort', 'updateShortMessage',
    'updateShortChatMessage', 'updateShortSentMessage',
    'updates', 'updatesCombined',
    'updates.getState', 'updates.getDifference',

    // Documents/Media
    'document', 'documentEmpty', 'documentAttributeFilename',
    'documentAttributeVideo', 'documentAttributeAudio',
    'documentAttributeImageSize',
    'inputDocument', 'inputDocumentEmpty', 'inputDocumentFileLocation',
    'inputFile', 'inputFileBig', 'inputPhoto', 'inputPhotoEmpty',
    'inputPhotoFileLocation', 'inputPeerPhotoFileLocation',
    'inputGeoPoint', 'inputGeoPointEmpty', 'inputGameID',
    'photo', 'photoEmpty', 'photoSize', 'photoSizeEmpty',
    'photoCachedSize', 'photoPathSize', 'photoStrippedSize',
    'photoSizeProgressive', 'videoSize',
    'inputMediaEmpty', 'inputMediaPhoto', 'inputMediaDocument',
    'inputMediaPhotoExternal', 'inputMediaDocumentExternal',
    'inputMediaUploadedPhoto', 'inputMediaUploadedDocument',
    'inputMediaContact', 'inputMediaDice', 'inputMediaGame',
    'inputMediaGeoPoint', 'inputMediaPoll', 'inputMediaVenue',
    'webDocument', 'webDocumentNoProxy', 'webPage', 'poll',
    'geoPoint', 'geoPointEmpty',

    // Keyboard/Reply
    'replyInlineMarkup', 'replyKeyboardMarkup', 'keyboardButtonRow',

    // Upload
    'upload.file', 'upload.fileCdnRedirect', 'upload.getFile',
    'upload.saveFilePart', 'upload.saveBigFilePart',

    // Contacts
    'contacts.getContacts', 'contacts.contactsNotModified',
    'contacts.resolveUsername', 'contacts.resolvedPeer',

    // Help / Config
    'config', 'help.getConfig', 'help.acceptTermsOfService',
    'dcOption',

    // Send message actions
    'sendMessageCancelAction', 'sendMessageChooseContactAction',
    'sendMessageGamePlayAction', 'sendMessageGeoLocationAction',
    'sendMessageRecordAudioAction', 'sendMessageRecordRoundAction',
    'sendMessageRecordVideoAction', 'sendMessageTypingAction',
    'sendMessageUploadAudioAction', 'sendMessageUploadDocumentAction',
    'sendMessageUploadPhotoAction', 'sendMessageUploadRoundAction',
    'sendMessageUploadVideoAction',

    // Photos
    'photos.photo',
]);

// Also add name without dot (e.g., 'user' for 'user#...')
for (const name of [...REQUIRED]) {
    if (name.includes('.')) {
        const parts = name.split('.');
        REQUIRED.add(parts[1]);
    }
}

function shouldKeep(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return true;

    const match = trimmed.match(/^([a-zA-Z0-9_.]+)#([a-f0-9]+)/);
    if (!match) return true;

    const name = match[1];

    if (REQUIRED.has(name)) return true;

    const parts = name.split('.');
    if (parts.length > 1) {
        if (REQUIRED.has(name)) return true;
        if (REQUIRED.has(parts[1])) return true;
    }

    for (const req of REQUIRED) {
        if (name.startsWith(req) || trimmed.includes('=' + req + ';')) return true;
    }

    return false;
}

function pruneSchema(schema) {
    const lines = schema.split('\\n');
    let kept = 0, removed = 0;
    const result = [];

    for (const line of lines) {
        if (shouldKeep(line)) {
            result.push(line);
            kept++;
        } else {
            removed++;
        }
    }

    console.log('TL schema: kept', kept, 'definitions, removed', removed);
    return result.join('\\n');
}

function main() {
    console.log('Reading bundle...');
    let code = fs.readFileSync(bundlePath, 'utf8');
    console.log('Original size:', (code.length / 1024).toFixed(1), 'KB');

    const startPattern = 'module.exports="boolFalse#';
    const startIdx = code.indexOf(startPattern);
    if (startIdx === -1) {
        console.log('Could not find TL schema start');
        process.exit(1);
    }

    console.log('Found TL schema at offset', startIdx);

    const endPattern = /fragment\.getCollectibleInfo[^\\]*\\n"/;
    const endMatch = code.slice(startIdx).match(endPattern);
    if (endMatch) {
        endIdx = startIdx + endMatch.index + endMatch[0].length - 1;
        console.log('Found schema end at offset', endIdx - startIdx);
    } else {
        console.log('Could not find schema end, trying alternative...');
        const altPattern = /module\.exports="[^"]*";/;
        console.log('Skipping pruning - could not locate schema boundaries');
        process.exit(0);
    }

    const schemaStart = startIdx + 'module.exports="'.length;
    const schemaEnd = endIdx;
    const schema = code.slice(schemaStart, schemaEnd);

    console.log('Schema size:', (schema.length / 1024).toFixed(1), 'KB');

    const pruned = pruneSchema(schema);
    console.log('Pruned schema size:', (pruned.length / 1024).toFixed(1), 'KB');

    const newCode = code.slice(0, schemaStart) + pruned + code.slice(schemaEnd);
    console.log('New bundle size:', (newCode.length / 1024).toFixed(1), 'KB');
    console.log('Reduction:', ((1 - newCode.length / code.length) * 100).toFixed(1), '%');

    fs.writeFileSync(bundlePath, newCode);
    console.log('Done!');
}

main();