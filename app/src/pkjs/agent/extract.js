/**
 * Clairic argument extraction.
 *
 * Each tool declares the typed fields it needs. Clairic returns one answer per
 * field with a value, p_null and confidence. Required fields that are missing
 * or uncertain turn into a clarification instead of a wrong action.
 */

var cloudflare = require('./cloudflare');
var log = require('./log');

var NULL_THRESHOLD = 0.15;
var CONFIDENCE_THRESHOLD = 0.50;
var TYPED_FIELDS = {
    date: true,
    time: true,
    datetime: true,
    duration: true
};

function isTyped(spec) {
    return !!(spec && TYPED_FIELDS[spec.type]);
}

function isMissing(field, answers) {
    var answer = answers[field];
    if (!answer) {
        return true;
    }
    return answer.value === null || typeof answer.value === 'undefined';
}

function isUncertain(spec, answer) {
    var pNull = typeof answer.p_null === 'number' ? answer.p_null : 0;
    if (pNull > NULL_THRESHOLD) {
        return true;
    }
    // Typed answers (date/time/datetime/duration) carry a guess and report the
    // probability of that exact guess, which is naturally low for clock times.
    // p_null is the meaningful signal there; don't demand 80% on "six a.m.".
    if (isTyped(spec)) {
        return false;
    }
    var confidence = typeof answer.confidence === 'number' ? answer.confidence : 1;
    return confidence < CONFIDENCE_THRESHOLD;
}

function coerce(field, spec, value) {
    if (typeof value === 'undefined' || value === null) {
        return value;
    }
    if (spec.type === 'number') {
        var number = Number(value);
        return isNaN(number) ? value : number;
    }
    if (spec.type === 'text') {
        return String(value).replace(/^\s+|\s+$/g, '');
    }
    return value;
}

function checkFields(tool, answers) {
    var issues = [];
    var required = tool.required || [];
    var all = tool.fields || {};
    for (var i = 0; i < required.length; i++) {
        var field = required[i];
        var spec = all[field] || {};
        if (isMissing(field, answers)) {
            issues.push({ field: field, reason: 'missing', spec: spec, answer: answers[field] });
            continue;
        }
        var answer = answers[field];
        if (isUncertain(spec, answer)) {
            issues.push({
                field: field,
                reason: 'uncertain',
                spec: spec,
                pNull: typeof answer.p_null === 'number' ? answer.p_null : 0,
                confidence: answer.confidence
            });
        }
    }
    return issues;
}

function buildArgs(tool, answers) {
    var args = {};
    var fields = tool.fields || {};
    var required = tool.required || [];
    for (var field in fields) {
        if (!fields.hasOwnProperty(field)) {
            continue;
        }
        var answer = answers[field];
        if (!answer || answer.value === null || typeof answer.value === 'undefined') {
            continue;
        }
        // Optional fields still need to clear the same bar, otherwise a noisy
        // "Six a" comes back as the alarm's name.
        if (required.indexOf(field) === -1 && isUncertain(fields[field], answer)) {
            continue;
        }
        args[field] = coerce(field, fields[field], answer.value);
    }
    return args;
}

function referenceDate() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return now.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
}

exports.run = function(tool, state, callback) {
    var fields = tool.fields || {};
    var names = [];
    for (var name in fields) {
        if (fields.hasOwnProperty(name)) {
            names.push(name);
        }
    }
    if (!names.length) {
        callback(null, { args: {}, answers: {}, issues: [] });
        return;
    }
    cloudflare.clairic(state, fields, referenceDate(), function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        var answers = result.answers || {};
        var issues = checkFields(tool, answers);
        var args = buildArgs(tool, answers);
        log.info('extract.result', {
            tool: tool.name,
            args: args,
            answers: answers,
            issues: issues
        });
        callback(null, { args: args, answers: answers, issues: issues, truncated: result.truncated });
    });
};

exports.buildArgs = buildArgs;
exports.checkFields = checkFields;
exports.referenceDate = referenceDate;
exports.NULL_THRESHOLD = NULL_THRESHOLD;
exports.CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLD;
