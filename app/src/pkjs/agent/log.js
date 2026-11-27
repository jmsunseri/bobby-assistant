/**
 * Structured logging for the on-phone agent.
 *
 * Everything here stays on the phone: the logs are only visible through
 * `pebble logs` while the app is running. API keys are redacted; other request
 * data is safe to log for this build.
 */

var SECRET_KEYS = {
    CF_API_TOKEN: true,
    CLOUDFLARE_API_TOKEN: true,
    BRAVE_API_KEY: true,
    EXCHANGE_RATE_API_KEY: true,
    MAPBOX_TOKEN: true,
    IBM_KEY: true
};

function scrub(value, depth) {
    if (depth > 4) {
        return '[deep]';
    }
    if (value === null || typeof value === 'undefined') {
        return value;
    }
    if (typeof value === 'string') {
        return value.length > 2000 ? value.substring(0, 2000) + '…' : value;
    }
    if (typeof value !== 'object') {
        return value;
    }
    if (Object.prototype.toString.call(value) === '[object Array]') {
        var arr = [];
        for (var i = 0; i < value.length && i < 20; i++) {
            arr.push(scrub(value[i], depth + 1));
        }
        if (value.length > 20) {
            arr.push('[…' + (value.length - 20) + ' more]');
        }
        return arr;
    }
    var out = {};
    for (var key in value) {
        if (!value.hasOwnProperty(key)) {
            continue;
        }
        if (SECRET_KEYS[key]) {
            out[key] = value[key] ? '***redacted***' : '';
        } else {
            out[key] = scrub(value[key], depth + 1);
        }
    }
    return out;
}

function emit(level, stage, data) {
    var entry = {
        t: new Date().toISOString(),
        level: level,
        stage: stage
    };
    if (typeof data !== 'undefined') {
        entry.data = scrub(data, 0);
    }
    console.log('[agent] ' + JSON.stringify(entry));
}

exports.info = function(stage, data) {
    emit('info', stage, data);
};

exports.warn = function(stage, data) {
    emit('warn', stage, data);
};

exports.error = function(stage, err) {
    if (err && err.message) {
        emit('error', stage, { message: err.message, code: err.code, status: err.status });
    } else {
        emit('error', stage, err);
    }
};

exports.scrub = scrub;
