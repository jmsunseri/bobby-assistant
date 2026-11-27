/**
 * Clef-flash router.
 *
 * Clef picks a tool (or chat/multi) and tells us whether the answer needs
 * prose. Everything here is pure so it can be tested without a network.
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
            instructions: 'Which option should handle the user\'s request? Pick exactly one.',
            criteria: toolCriteria
        },
        needs_synthesis: {
            type: 'noul',
            instructions: 'Does the user want the result explained or interpreted, rather than just being told the value? Answer yes for questions like "should I bring an umbrella?" or "summarise this"; answer no for commands like "set a timer", "what time is it", or "weather in Paris".'
        }
    };
}

exports.decide = function(state, toolCriteria, callback) {
    var questions = buildQuestions(toolCriteria);
    cloudflare.clef(state, questions, function(err, result) {
        if (err) {
            callback(err);
            return;
        }
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
        log.info('router.decision', decision);
        callback(null, decision);
    });
};

exports.TOOL_THRESHOLD = TOOL_THRESHOLD;
exports.CHAT_MARGIN = CHAT_MARGIN;
exports.chooseKind = chooseKind;
exports.buildQuestions = buildQuestions;
