/**
 * The on-phone agent loop.
 *
 * Fast path: Clef-flash picks a tool, Clairic extracts its arguments, the phone
 * runs the tool, and a deterministic template answers. The LLM is only used
 * when the request is open-ended, multi-step, ambiguous, or needs synthesis.
 */

var settings = require('./settings');
var history = require('./history');
var router = require('./router');
var extract = require('./extract');
var templates = require('./templates');
var tools = require('./tools');
var cloudflare = require('./cloudflare');
var log = require('./log');
var location = require('../location');

var MAX_CHAT_ROUNDS = 10;
var MAX_TEXT = 900;

function truncate(text, limit) {
    var value = String(text || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (value.length > (limit || MAX_TEXT)) {
        value = value.substring(0, (limit || MAX_TEXT) - 1) + '...';
    }
    return value;
}

function nowSentence() {
    var now = new Date();
    return now.toString();
}

function buildState(prompt, priorContext) {
    var parts = [];
    if (priorContext) {
        parts.push('Previous conversation:');
        parts.push(priorContext);
        parts.push('');
    }
    parts.push('Current local time: ' + nowSentence());
    parts.push('Timezone offset (minutes east of UTC): ' + (-(new Date()).getTimezoneOffset()));
    parts.push('Preferred units: ' + (settings.getUnits() || 'automatic'));
    parts.push('Location available: ' + (settings.isLocationEnabled() && location.isReady() ? 'yes' : 'no'));
    parts.push('');
    parts.push('User: ' + prompt);
    return parts.join('\n');
}

function streamText(text, emit, callback) {
    var clean = truncate(text);
    if (!clean) {
        callback();
        return;
    }
    var words = clean.split(' ');
    var index = 0;

    function next() {
        if (index >= words.length) {
            callback();
            return;
        }
        emit('c' + (index === 0 ? '' : ' ') + words[index]);
        index++;
        setTimeout(next, 35);
    }

    next();
}

function emitWidget(widget, emit) {
    if (!widget || !widget.type) {
        return;
    }
    emit('c' + '<<!!WIDGET:' + JSON.stringify({ type: widget.type, content: widget.content }) + '!!>>');
}

function systemPrompt(ctx) {
    var parts = [];
    parts.push('You are Bobby, a helpful assistant running on a Pebble smartwatch.');
    parts.push('The user\'s text is transcribed from voice input.');
    parts.push('Be extremely brief: at most 60 words, no markdown, no lists.');
    parts.push('Use the provided tools when they are needed. Never claim to have set a timer, alarm, or reminder unless you called the relevant tool.');
    parts.push('Alarms, timers, and reminders are different things; use the matching tool.');
    parts.push('Current local time: ' + nowSentence() + '.');
    parts.push('Preferred units: ' + (ctx.units || 'automatic') + '.');
    if (ctx.language) {
        parts.push('Respond in the language for the locale ' + ctx.language + '.');
    } else {
        parts.push('Respond in the user\'s language.');
    }
    if (settings.isLocationEnabled() && location.isReady()) {
        parts.push('The user has shared their location.');
    } else {
        parts.push('The user has not shared their location.');
    }
    return parts.join(' ');
}

function synthesisMessages(prompt, tool, result) {
    return [{
        role: 'system',
        content: 'You answer a question using only the tool result provided. Be brief: at most 50 words, no markdown. Do not mention JSON or tool names. If the result contains a clear value, lead with it. Answer in the same language as the question.'
    }, {
        role: 'user',
        content: 'Question: ' + prompt + '\nTool: ' + tool.name + '\nResult: ' + JSON.stringify(result.data || result.text || result)
    }];
}

function runChat(opts, ctx, callback) {
    var messages = [{ role: 'system', content: systemPrompt(ctx) }].concat(history.recentMessages(10));
    var schemas = tools.chatTools();
    var model = settings.getModelId();

    function step(round) {
        if (round >= MAX_CHAT_ROUNDS) {
            callback(null, 'I couldn\'t finish that. Try asking in a simpler way.');
            return;
        }
        cloudflare.chat(model, messages, schemas, function(err, response) {
            if (err) {
                callback(err);
                return;
            }
            if (response.toolCalls && response.toolCalls.length) {
                var call = response.toolCalls[0];
                var args = call.arguments || {};
                log.info('chat.tool', { round: round, call: call });
                opts.emit('f' + tools.thought(call.name));
                messages.push({
                    role: 'assistant',
                    content: JSON.stringify({ name: call.name, arguments: args })
                });
                tools.execute(call.name, args, ctx, function(result) {
                    if (result.widget) {
                        emitWidget(result.widget, opts.emit);
                    }
                    var payload = result.ok ?
                        (result.data || { text: result.text || '' }) :
                        { error: result.error || 'Tool failed.' };
                    messages.push({
                        role: 'tool',
                        content: JSON.stringify(payload)
                    });
                    step(round + 1);
                });
                return;
            }
            var text = response.text || '';
            if (!text) {
                text = 'I\'m not sure how to answer that.';
            }
            callback(null, text);
        });
    }

    step(0);
}

function synthesize(opts, ctx, tool, result, callback) {
    cloudflare.chat(settings.getModelId(), synthesisMessages(opts.prompt, tool, result), [], function(err, response) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, response.text || '');
    });
}

function finish(opts, text, widget, callback) {
    if (widget) {
        emitWidget(widget, opts.emit);
    }
    streamText(text, opts.emit, function() {
        history.append('assistant', truncate(text));
        opts.emit('d');
        if (callback) {
            callback();
        }
    });
}

function warnAndDone(opts, message, callback) {
    var text = truncate(message);
    opts.emit('w' + text);
    opts.emit('d');
    if (callback) {
        callback();
    }
}

function runFastPath(opts, ctx, decision, state, callback) {
    var tool = tools.get(decision.tool);
    if (!tool) {
        runChat(opts, ctx, function(err, text) {
            if (err) {
                warnAndDone(opts, err.message || 'That tool is not available.', callback);
                return;
            }
            finish(opts, text, null, callback);
        });
        return;
    }
    opts.emit('f' + tool.thought());

    function execute(args, extraction) {
        tools.execute(tool.name, args, ctx, function(result) {
            if (!result.ok) {
                finish(opts, templates.errorText(result), null, callback);
                return;
            }
            if (decision.needsSynthesis || tool.alwaysSynthesis) {
                synthesize(opts, ctx, tool, result, function(synthErr, text) {
                    var template = templates.forTool(tool.name, args, result, ctx);
                    if (synthErr || !text) {
                        if (synthErr) {
                            log.warn('synthesis.failed', synthErr);
                        }
                        finish(opts, template.text, template.widget, callback);
                        return;
                    }
                    finish(opts, text, template.widget, callback);
                });
                return;
            }
            var reply = templates.forTool(tool.name, args, result, ctx);
            finish(opts, reply.text, reply.widget, callback);
        });
    }

    if (tool.fields && Object.keys(tool.fields).length) {
        extract.run(tool, state, function(err, extraction) {
            if (err) {
                log.warn('extract.failed', err);
                runChat(opts, ctx, function(chatErr, text) {
                    if (chatErr) {
                        warnAndDone(opts, chatErr.message || 'I couldn\'t work out the details.', callback);
                        return;
                    }
                    finish(opts, text, null, callback);
                });
                return;
            }
            if (extraction.issues && extraction.issues.length) {
                finish(opts, templates.clarification(tool, extraction.issues), null, callback);
                return;
            }
            execute(extraction.args, extraction);
        });
        return;
    }

    execute({}, null);
}

exports.runTurn = function(opts) {
    var callback = opts.done || function() {};
    var ctx = {
        session: opts.session,
        units: settings.getUnits(),
        language: settings.getLanguage(),
        prompt: opts.prompt
    };

    log.info('turn.start', { prompt: opts.prompt, threadId: opts.threadId });
    if (!settings.hasCloudflareCredentials()) {
        warnAndDone(opts, 'Add your Cloudflare account ID and API token in settings first.', callback);
        return;
    }

    var threadId = history.begin(opts.threadId);
    var priorContext = history.recentContext();
    opts.emit('t' + threadId);
    history.append('user', opts.prompt);
    var state = buildState(opts.prompt, priorContext);
    var criteria = tools.criteria();

    router.decide(state, criteria, function(err, decision) {
        if (err) {
            log.warn('router.failed', err);
            runChat(opts, ctx, function(chatErr, text) {
                if (chatErr) {
                    warnAndDone(opts, chatErr.message || 'The assistant failed.', callback);
                    return;
                }
                finish(opts, text, null, callback);
            });
            return;
        }
        if (decision.kind === 'tool') {
            runFastPath(opts, ctx, decision, state, callback);
            return;
        }
        runChat(opts, ctx, function(chatErr, text) {
            if (chatErr) {
                warnAndDone(opts, chatErr.message || 'The assistant failed.', callback);
                return;
            }
            finish(opts, text, null, callback);
        });
    });
};

exports.MAX_CHAT_ROUNDS = MAX_CHAT_ROUNDS;
exports.buildState = buildState;
exports.truncate = truncate;
