/**
 * Clef router.
 *
 * clef-flash handles the hot path. If it is not confident about a tool, full
 * Clef gets one cheap second opinion before we fall back to the chat model.
 */

var cloudflare = require('./cloudflare');
var log = require('./log');

var TOOL_THRESHOLD = 0.60;
var CHAT_MARGIN = 0.15;

function chooseKind(choice, probabilities, confidence) {
    if (choice === 'chat' || choice === 'multi') {
        return { kind: choice, reason: 'model-choice' };
    }
    var top = probabilities[choice];
    if (typeof top === 'undefined') {
        top = confidence;
    }
    var chat = probabilities.chat;
    if (typeof chat === 'undefined') {
        chat = 0;
    }
    var margin = top - chat;
    if (top < TOOL_THRESHOLD || margin < CHAT_MARGIN) {
        return {
            kind: 'chat',
            reason: 'low-confidence',
            topProbability: top,
            margin: margin
        };
    }
    return {
        kind: 'tool',
        reason: 'confident',
        topProbability: top,
        margin: margin
    };
}

function buildQuestions(toolCriteria) {
    return {
        tool: {
            type: 'choice',
            instructions: 'Which option should handle the current user request? The current request is the last "User:" line in the state. Use earlier turns only to resolve references such as "that" or "six a"; do not let them change the task.',
            criteria: toolCriteria
        },
        needs_synthesis: {
            type: 'noul',
            instructions: 'Does the user want the result explained or interpreted, rather than just being told the value? Answer yes for questions like "should I bring an umbrella?" or "summarise this"; answer no for commands like "set a timer", "what time is it", or "weather in Paris".'
        }
    };
}

function evaluate(result, toolCriteria) {
    var answers = result.answers || {};
    var toolAnswer = answers.tool || {};
    var probabilities = toolAnswer.probabilities || {};
    var choice = toolAnswer.choice || 'chat';
    var confidence = typeof toolAnswer.confidence === 'number' ? toolAnswer.confidence : 0;
    var decision = chooseKind(choice, probabilities, confidence);
    var synthesisAnswer = answers.needs_synthesis || {};
    var needsSynthesis = typeof synthesisAnswer.noul === 'number' ? synthesisAnswer.noul >= 0.5 : false;

    if (decision.kind === 'tool' && !toolCriteria[choice]) {
        decision = { kind: 'chat', reason: 'unknown-tool' };
    }

    decision.tool = choice;
    decision.probabilities = probabilities;
    decision.confidence = confidence;
    decision.needsSynthesis = needsSynthesis;
    return decision;
}

function shouldAskFullClef(decision) {
    return decision.kind === 'chat' &&
        decision.reason === 'low-confidence' &&
        decision.tool !== 'chat' &&
        decision.tool !== 'multi';
}

exports.decide = function(state, toolCriteria, callback) {
    var questions = buildQuestions(toolCriteria);
    cloudflare.clef(state, questions, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
        var flashDecision = evaluate(result, toolCriteria);
        flashDecision.via = 'clef-flash';
        log.info('router.decision', flashDecision);

        if (!shouldAskFullClef(flashDecision)) {
            callback(null, flashDecision);
            return;
        }

        cloudflare.clefFull(state, questions, function(fullErr, fullResult) {
            if (fullErr) {
                log.warn('router.tiebreak.failed', fullErr);
                callback(null, flashDecision);
                return;
            }
            var fullDecision = evaluate(fullResult, toolCriteria);
            fullDecision.via = 'clef';
            fullDecision.flash = {
                tool: flashDecision.tool,
                topProbability: flashDecision.topProbability,
                margin: flashDecision.margin
            };
            log.info('router.tiebreak', fullDecision);
            callback(null, fullDecision);
        });
    });
};

exports.TOOL_THRESHOLD = TOOL_THRESHOLD;
exports.CHAT_MARGIN = CHAT_MARGIN;
exports.chooseKind = chooseKind;
exports.buildQuestions = buildQuestions;
exports.evaluate = evaluate;
exports.shouldAskFullClef = shouldAskFullClef;
