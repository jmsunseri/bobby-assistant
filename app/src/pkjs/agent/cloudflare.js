/**
 * Workers AI REST client.
 *
 * All calls go straight from the phone to api.cloudflare.com using the account
 * ID and API token the user entered in Clay. No hosted code sits in between.
 */

var http = require('./http');
var settings = require('./settings');
var log = require('./log');

var API_BASE = 'https://api.cloudflare.com/client/v4/accounts/';

function errorFromResponse(status, json, fallback) {
    var message = fallback;
    if (json && json.errors && json.errors.length) {
        message = json.errors[0].message || message;
    } else if (json && json.error) {
        message = json.error;
    }
    if (status === 401 || status === 403) {
        message = 'Cloudflare rejected the API token (HTTP ' + status + '). Check the token and its Workers AI permission.';
    } else if (status === 429) {
        message = 'Cloudflare rate limit hit. Wait a moment and try again.';
    } else if (status === 410) {
        message = 'That model was retired by Cloudflare (HTTP 410). Choose another model in settings.';
    } else if (status >= 500) {
        message = 'Cloudflare had a problem (HTTP ' + status + '). Try again shortly.';
    }
    return { code: 'cloudflare', status: status, message: message };
}

function runRaw(modelId, body, callback) {
    var cf = settings.getCloudflare();
    if (!cf.accountId || !cf.token) {
        callback({
            code: 'missing-credentials',
            message: 'Add your Cloudflare account ID and API token in settings first.'
        });
        return;
    }
    var url = API_BASE + encodeURIComponent(cf.accountId) + '/ai/run/' + modelId;
    log.info('cf.request', { model: modelId, body: body });
    http.postJson(url, {
        'Authorization': 'Bearer ' + cf.token,
        'Content-Type': 'application/json'
    }, body, 30000, function(err, status, text, json) {
        if (err) {
            log.error('cf.network', err);
            callback(err);
            return;
        }
        if (status !== 200 || (json && json.success === false)) {
            var failure = errorFromResponse(status, json, 'Cloudflare returned HTTP ' + status + '.');
            log.error('cf.response', failure);
            callback(failure);
            return;
        }
        var result = json && Object.prototype.hasOwnProperty.call(json, 'result') ? json.result : json;
        if (!result) {
            callback({ code: 'empty', status: status, message: 'Cloudflare returned an empty response.' });
            return;
        }
        log.info('cf.response', { model: modelId, status: status, result: result });
        callback(null, result);
    });
}

function normalizeToolCalls(result) {
    var raw = result && result.tool_calls;
    if (!raw && result && result.choices && result.choices[0] && result.choices[0].message) {
        raw = result.choices[0].message.tool_calls;
    }
    if (!raw || !raw.length) {
        return [];
    }
    var calls = [];
    for (var i = 0; i < raw.length; i++) {
        var call = raw[i] || {};
        var fn = call.function || call;
        var name = fn.name || '';
        var args = fn.arguments;
        if (typeof args === 'string') {
            try {
                args = JSON.parse(args);
            } catch (e) {
                args = {};
            }
        }
        if (name) {
            calls.push({ name: name, arguments: args || {} });
        }
    }
    return calls;
}

function responseText(result) {
    if (!result) {
        return '';
    }
    if (typeof result.response === 'string') {
        return result.response;
    }
    if (typeof result.text === 'string') {
        return result.text;
    }
    if (result.choices && result.choices[0] && result.choices[0].message) {
        return result.choices[0].message.content || '';
    }
    return '';
}

exports.isConfigured = function() {
    return settings.hasCloudflareCredentials();
};

exports.chat = function(modelId, messages, tools, callback) {
    var cf = settings.getCloudflare();
    var body = {
        messages: messages,
        stream: false,
        max_tokens: 700,
        parallel_tool_calls: false
    };
    if (tools && tools.length) {
        body.tools = tools;
    }
    if (cf.effort && modelId.indexOf('gemma') === -1) {
        body.reasoning_effort = cf.effort;
        if (modelId.indexOf('qwen') !== -1 && cf.effort === 'high') {
            body.reasoning_effort = 'xhigh';
        }
    }
    log.info('cf.chat', { model: modelId, messages: messages, tools: tools || [], effort: cf.effort });
    runRaw(modelId, body, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, {
            text: responseText(result),
            toolCalls: normalizeToolCalls(result),
            usage: result.usage || null,
            raw: result
        });
    });
};

exports.clef = function(state, questions, callback) {
    runClef('@cf/cloudflare/clef-flash', 'clef-flash', state, questions, callback);
};

exports.clefFull = function(state, questions, callback) {
    runClef('@cf/cloudflare/clef', 'clef', state, questions, callback);
};

function runClef(modelId, modelName, state, questions, callback) {
    runRaw(modelId, {
        model: modelName,
        state: state,
        questions: questions
    }, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        if (!result.answers) {
            callback({ code: 'bad-clef', message: 'Clef returned no answers.' });
            return;
        }
        callback(null, result);
    });
}

exports.clairic = function(state, fields, referenceDate, callback) {
    var body = {
        model: 'clairic',
        state: state,
        fields: fields
    };
    if (referenceDate) {
        body.reference_date = referenceDate;
    }
    runRaw('@cf/cloudflare/clairic', body, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        if (!result.answers) {
            callback({ code: 'bad-clairic', message: 'Clairic returned no answers.' });
            return;
        }
        callback(null, result);
    });
};
