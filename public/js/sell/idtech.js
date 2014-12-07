function decodeIdTech(raw) {
    validateIdTech(raw);
    var cardData = raw.substring(6, raw.length - 6), parsed = {}, info = {};

    var format = getHexValue(cardData, 0);
    if (format & 0x80 !== 0x80) {
        throw new Error('Unknown card data format byte ' + cardData.substring(0, 2));
    }
    parsed.format = 'ISO/ABA';
    readMaskedIdTech(parsed, info, cardData);
    readIdTechSettings(parsed, cardData);
    readEncryptedIdTech(parsed, info, cardData);
    readSerialIdTech(parsed, info, cardData);

    return parsed;
}

function getHexValue(bufString, spot) {
    return parseInt(bufString.substring(spot, spot + 2), 16);
}

function isBitSet(val, bits) {
    return (val & bits) ? true : false;
}

function validateIdTech(raw) {
    if (getHexValue(raw, 0) !== 2 || getHexValue(raw, raw.length - 2) !== 3) {
        throw new Error('Invalid raw track data. Missing start and end sentinel.');
    }
    var tkLen = getHexValue(raw, 2) + (getHexValue(raw, 4) << 8);
    if (raw.length !== tkLen + 12) {
        throw new Error('Raw track data length mismatch. Expected ' + (tkLen + 12) + ' got ' + raw.length);
    }
    validateIdTechChecksums(raw);
}

function validateIdTechChecksums(raw) {
    var ckSum = 0, ckXor = 0;
    for (var i = 6; i < raw.length - 6; i++) {
        ckXor ^= raw.charCodeAt(i);
        ckSum += raw.charCodeAt(i);
    }
    if (ckXor !== getHexValue(raw, raw.length - 6)) {
        throw new Error('Card Data XOR hash mismatch.');
    }
    if (ckSum % 256 !== getHexValue(raw, raw.length - 4)) {
        throw new Error('Card Data SUM hash mismatch.');
    }
}

function readIdTechSettings(parsed, cardData) {
    var field8 = getHexValue(cardData, 10);
    if (field8 & 0x8) {
        throw new Error('Card data is not encrypted with DUKPT - not supported.');
    }
    parsed.hasSessionId = (field8 & 0x40) ? true : false;
    parsed.hasKsn = (field8 & 0x80) ? true : false;
    parsed.encrypted = (field8 & 0x30) === 0 ? 'TDES' : 'AES';
    parsed.key = (field8 & 0x40) ? 'pin' : 'data';
}

function readMaskedIdTech(parsed, info, cardData) {
    checkForMaskedIdTechTracks(parsed, info, cardData);
    if (info.t1len) {
        parsed.track1Masked = cardData.substring(14, 14 + info.t1len);
    }
    if (info.t2len) {
        parsed.track2Masked = cardData.substring(14 + info.t1len, 14 + info.t1len + info.t2len);
    }
    if (info.t3len) {
        parsed.track3Masked = cardData.substring(14 + info.t1len + info.t2len, 14 + info.t1len + info.t2len + info.t3len);
    }
}

function checkForMaskedIdTechTracks(parsed, info, cardData) {
    var trackInfo = getHexValue(cardData, 2);
    parsed.hasTrack1Masked = (trackInfo & 0x1) ? true : false;
    parsed.hasTrack2Masked = (trackInfo & 0x2) ? true : false;
    parsed.hasTrack3Masked = (trackInfo & 0x4) ? true : false;

    info.t1len = getHexValue(cardData, 4);
    info.t2len = getHexValue(cardData, 6);
    info.t3len = getHexValue(cardData, 8);
}

function readEncryptedIdTech(parsed, info, cardData) {
    checkForEncryptedIdTechTracks(parsed, info, cardData);
    info.encStart = 14 + info.t1len + info.t2len + info.t3len;
    info.enct1 = Math.ceil(info.t1len / 8.0) * 16;
    info.enct2 = Math.ceil(info.t2len / 8.0) * 16;
    info.enct3 = Math.ceil(info.t3len / 8.0) * 16;

    if (info.enct1) {
        parsed.track1 = cardData.substring(info.encStart, info.encStart + info.enct1);
    }
    if (info.enct2) {
        parsed.track2 = cardData.substring(info.encStart + info.enct1, info.encStart + info.enct1 + info.enct2);
    }
    if (info.enct3) {
        parsed.track3 = cardData.substring(info.encStart + info.enct1 + info.enct2, info.encStart + info.enct1 + info.enct2 + info.enct3);
    }
}

function checkForEncryptedIdTechTracks(parsed, info, cardData) {
    var field9 = getHexValue(cardData, 12);
    parsed.hasTrack1 = isBitSet(field9, 0x1);
    parsed.hasTrack2 = isBitSet(field9, 0x2);
    parsed.hasTrack3 = isBitSet(field9, 0x4);
    info.hasDummyHash1 = isBitSet(field9, 0x8);
    info.hasDummyHash2 = isBitSet(field9, 0x10);
    info.hasDummyHash3 = isBitSet(field9, 0x20);
}

function readSerialIdTech(parsed, info, cardData) {
    var encEnd = info.encStart + info.enct1 + info.enct2 + info.enct3;
    encEnd += (info.hasDummyHash1 ? 40 : 0) + (info.hasDummyHash2 ? 40 : 0) + (info.hasDummyHash3 ? 40 : 0);

    parsed.serial = cardData.substring(encEnd, encEnd + 20);
    parsed.ksn = cardData.substring(encEnd + 20, encEnd + 40);
}

module.exports = decodeIdTech;
