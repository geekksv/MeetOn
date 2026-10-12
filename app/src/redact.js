'use strict';

const MASK = '********';

// Keys whose values must never be written to the logs
const SECRET_KEY = /(secret|password|pass|credential|jwt_key|token|authorization|cookie)$/i;

function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/**
 * Return a copy of the given value with secrets masked, safe to log.
 * The original value is left untouched.
 * @param {any} value
 * @returns {any}
 */
function redact(value) {
    if (Array.isArray(value)) {
        return value.map(redact);
    }

    if (isPlainObject(value)) {
        return Object.keys(value).reduce((acc, key) => {
            const item = value[key];
            const isSecret = SECRET_KEY.test(key) && (typeof item === 'number' || (typeof item === 'string' && item));
            acc[key] = isSecret ? MASK : redact(item);
            return acc;
        }, {});
    }

    return value;
}

module.exports = redact;
