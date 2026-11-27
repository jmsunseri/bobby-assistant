/**
 * Tool registry shared by the fast path and the chat fallback.
 */

var settings = require('../settings');
var log = require('../log');
var time = require('./time');
var alarms = require('./alarms');
var reminders = require('./reminders');
var weather = require('./weather');
var currency = require('./currency');
var websearch = require('./websearch');

var TOOLS = [
    time,
    alarms.setTimer,
    alarms.setAlarm,
    alarms.getTimers,
    alarms.getAlarms,
    alarms.cancelTimer,
    alarms.cancelAlarm,
    reminders.setReminder,
    reminders.getReminders,
    reminders.deleteReminder,
    weather.weather,
    currency.currency,
    websearch.websearch
];

var CHAT_CRITERIA = 'Open-ended conversation, explanations, advice, translations, or anything that no tool handles.';
var MULTI_CRITERIA = 'The request asks for more than one action or tool, for example a timer and the weather.';

function keyPresent(name) {
    if (name === 'BRAVE_API_KEY') {
        return !!settings.getBraveKey();
    }
    if (name === 'EXCHANGE_RATE_API_KEY') {
        return !!settings.getExchangeRateKey();
    }
    if (name === 'MAPBOX_TOKEN') {
        return !!settings.getMapboxToken();
    }
    return !!settings.getString(name, '');
}

function isAvailable(tool) {
    var required = tool.requiresKeys || [];
    for (var i = 0; i < required.length; i++) {
        if (!keyPresent(required[i])) {
            return false;
        }
    }
    return true;
}

exports.available = function() {
    var out = [];
    for (var i = 0; i < TOOLS.length; i++) {
        if (isAvailable(TOOLS[i])) {
            out.push(TOOLS[i]);
        }
    }
    return out;
};

exports.get = function(name) {
    var available = exports.available();
    for (var i = 0; i < available.length; i++) {
        if (available[i].name === name) {
            return available[i];
        }
    }
    return null;
};

exports.criteria = function() {
    var available = exports.available();
    var criteria = {};
    for (var i = 0; i < available.length; i++) {
        criteria[available[i].name] = available[i].criteria;
    }
    criteria.chat = CHAT_CRITERIA;
    criteria.multi = MULTI_CRITERIA;
    return criteria;
};

function propertySchema(spec) {
    if (!spec) {
        return { type: 'string' };
    }
    var out = {
        description: spec.instructions || ''
    };
    if (spec.type === 'number') {
        out.type = 'number';
    } else if (spec.type === 'list') {
        out.type = 'array';
        out.items = { type: 'string' };
    } else if (spec.type === 'datetime') {
        out.type = 'string';
        out.format = 'date-time';
    } else {
        out.type = 'string';
    }
    return out;
}

function toolSchema(tool) {
    var properties = {};
    var fields = tool.fields || {};
    for (var field in fields) {
        if (fields.hasOwnProperty(field)) {
            properties[field] = propertySchema(fields[field]);
        }
    }
    return {
        name: tool.name,
        description: tool.description,
        parameters: {
            type: 'object',
            properties: properties,
            required: tool.required || []
        }
    };
}

exports.chatTools = function() {
    var available = exports.available();
    var schemas = [];
    for (var i = 0; i < available.length; i++) {
        schemas.push(toolSchema(available[i]));
    }
    return schemas;
};

exports.execute = function(name, args, ctx, callback) {
    var tool = exports.get(name);
    if (!tool) {
        callback({ ok: false, error: 'That tool is not available.' });
        return;
    }
    log.info('tool.execute', { name: name, args: args });
    try {
        tool.run(args || {}, ctx, function(result) {
            if (!result || typeof result.ok === 'undefined') {
                callback({ ok: false, error: 'The tool returned nothing.' });
                return;
            }
            log.info('tool.result', { name: name, result: result });
            callback(result);
        });
    } catch (e) {
        log.error('tool.exception', e);
        callback({ ok: false, error: 'The tool failed: ' + e.message });
    }
};

exports.thought = function(name) {
    var tool = exports.get(name);
    if (tool && tool.thought) {
        return tool.thought();
    }
    return 'Working on it…';
};

exports.all = TOOLS;
