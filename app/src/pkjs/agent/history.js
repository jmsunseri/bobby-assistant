/**
 * Phone-side conversation history.
 *
 * The Go service used to keep this in Redis with a ten-minute TTL. This build
 * keeps one active thread on the phone so it survives app restarts and the
 * watch forgetting its thread ID.
 */

var STORAGE_KEY = 'cf-agent-history';
var SCHEMA_VERSION = 1;
var MAX_TURNS = 20;
var MAX_TOTAL_CHARS = 8000;
var CONTEXT_CHARS = 2000;

function storage() {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    return localStorage;
}

function newThreadId() {
    var random = Math.floor(Math.random() * 0xFFFFFF).toString(16);
    return 'cf-' + (new Date()).getTime().toString(16) + '-' + random;
}

function empty(threadId) {
    return {
        version: SCHEMA_VERSION,
        threadId: threadId || '',
        turns: [],
        updated: 0
    };
}

function load() {
    var store = storage();
    if (!store) {
        return empty('');
    }
    var raw = store.getItem(STORAGE_KEY);
    if (!raw) {
        return empty('');
    }
    try {
        var data = JSON.parse(raw);
        if (!data || data.version !== SCHEMA_VERSION) {
            return empty('');
        }
        if (!data.turns || Object.prototype.toString.call(data.turns) !== '[object Array]') {
            return empty('');
        }
        return data;
    } catch (e) {
        return empty('');
    }
}

function save(data) {
    var store = storage();
    if (!store) {
        return;
    }
    data.updated = (new Date()).getTime();
    try {
        store.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // Storage full: drop the oldest half and try once more.
        data.turns = data.turns.slice(Math.floor(data.turns.length / 2));
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e2) {
            // Give up quietly; history is an optimisation.
        }
    }
}

function trim(data) {
    while (data.turns.length > MAX_TURNS) {
        data.turns.shift();
    }
    var total = 0;
    for (var i = 0; i < data.turns.length; i++) {
        total += data.turns[i].text.length;
    }
    while (total > MAX_TOTAL_CHARS && data.turns.length > 2) {
        total -= data.turns.shift().text.length;
    }
}

function begin(preferredThreadId) {
    var data = load();
    if (preferredThreadId && preferredThreadId !== data.threadId) {
        data = empty(preferredThreadId);
    }
    if (!data.threadId) {
        data.threadId = newThreadId();
    }
    save(data);
    return data.threadId;
}

function append(role, text) {
    var data = load();
    if (!data.threadId) {
        data.threadId = newThreadId();
    }
    data.turns.push({
        role: role,
        text: String(text || ''),
        at: (new Date()).getTime()
    });
    trim(data);
    save(data);
}

function recentContext() {
    var data = load();
    var turns = data.turns;
    var pairs = [];
    var chars = 0;
    for (var i = turns.length - 1; i >= 0 && pairs.length < 4; i--) {
        var turn = turns[i];
        var label = turn.role === 'user' ? 'User' : 'Assistant';
        var line = label + ': ' + turn.text;
        if (chars + line.length > CONTEXT_CHARS) {
            break;
        }
        pairs.unshift(line);
        chars += line.length + 1;
    }
    return pairs.join('\n');
}

function recentMessages(maxTurns) {
    var data = load();
    var turns = data.turns.slice(-(maxTurns || 10));
    var messages = [];
    for (var i = 0; i < turns.length; i++) {
        messages.push({
            role: turns[i].role === 'user' ? 'user' : 'assistant',
            content: turns[i].text
        });
    }
    return messages;
}

function clear() {
    var data = empty(newThreadId());
    save(data);
    return data.threadId;
}

exports.begin = begin;
exports.append = append;
exports.recentContext = recentContext;
exports.recentMessages = recentMessages;
exports.clear = clear;
exports.load = load;
exports.save = save;
exports.newThreadId = newThreadId;
exports.STORAGE_KEY = STORAGE_KEY;
