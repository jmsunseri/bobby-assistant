/**
 * Typed access to the Clay settings relevant to the local agent.
 */

var MODELS = [
    {
        id: '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
        label: 'DeepSeek V4.1 Flash',
        paid: true,
        effort: true
    },
    {
        id: '@cf/thinkingmachines/inkling-2-small',
        label: 'Inkling 2 Small',
        paid: true,
        effort: true
    },
    {
        id: '@cf/zai-org/glm-5.3',
        label: 'GLM-5.3',
        paid: true,
        effort: true
    },
    {
        id: '@cf/qwen/qwen3.8-27b',
        label: 'Qwen 3.8 27B',
        paid: false,
        effort: true
    },
    {
        id: '@cf/google/gemma-4-26b-a4b-it',
        label: 'Gemma 4 26B',
        paid: false,
        effort: true
    }
];

var PAID_DEFAULT = '@cf/deepseek-ai/deepseek-v4.1-flash-1017';
var FREE_DEFAULT = '@cf/google/gemma-4-26b-a4b-it';
var DEFAULT_EFFORT = 'low';

function readSettings() {
    try {
        return JSON.parse(localStorage.getItem('clay-settings')) || {};
    } catch (e) {
        return {};
    }
}

function modelById(id) {
    for (var i = 0; i < MODELS.length; i++) {
        if (MODELS[i].id === id) {
            return MODELS[i];
        }
    }
    return null;
}

exports.MODELS = MODELS;
exports.getSettings = readSettings;

exports.getString = function(key, fallback) {
    var value = readSettings()[key];
    if (typeof value === 'undefined' || value === null) {
        return fallback || '';
    }
    return String(value);
};

exports.getBoolean = function(key, fallback) {
    var value = readSettings()[key];
    if (typeof value === 'undefined' || value === null) {
        return !!fallback;
    }
    if (value === false || value === 0 || value === '0' || value === 'false') {
        return false;
    }
    return !!value;
};

exports.hasPaidPlan = function() {
    return exports.getBoolean('CF_PAID_PLAN', true);
};

exports.getModelId = function() {
    var paid = exports.hasPaidPlan();
    var chosen = exports.getString('CF_MODEL', '');
    var model = modelById(chosen);
    if (!model) {
        return paid ? PAID_DEFAULT : FREE_DEFAULT;
    }
    if (model.paid && !paid) {
        return FREE_DEFAULT;
    }
    return model.id;
};

exports.getModel = function() {
    return modelById(exports.getModelId()) || modelById(PAID_DEFAULT);
};

exports.getReasoningEffort = function() {
    var effort = exports.getString('CF_REASONING_EFFORT', DEFAULT_EFFORT);
    if (effort !== 'none' && effort !== 'low' && effort !== 'high') {
        return DEFAULT_EFFORT;
    }
    return effort;
};

exports.getCloudflare = function() {
    return {
        accountId: exports.getString('CF_ACCOUNT_ID', '').replace(/\s+/g, ''),
        token: exports.getString('CF_API_TOKEN', '').replace(/\s+/g, ''),
        paid: exports.hasPaidPlan(),
        model: exports.getModelId(),
        effort: exports.getReasoningEffort()
    };
};

exports.hasCloudflareCredentials = function() {
    var cf = exports.getCloudflare();
    return !!(cf.accountId && cf.token);
};

exports.getBraveKey = function() {
    return exports.getString('BRAVE_API_KEY', '').replace(/\s+/g, '');
};

exports.getExchangeRateKey = function() {
    return exports.getString('EXCHANGE_RATE_API_KEY', '').replace(/\s+/g, '');
};

exports.getMapboxToken = function() {
    return exports.getString('MAPBOX_TOKEN', '').replace(/\s+/g, '');
};

exports.getUnits = function() {
    return exports.getString('UNIT_PREFERENCE', '');
};

exports.getLanguage = function() {
    return exports.getString('LANGUAGE_CODE', '');
};

exports.isLocationEnabled = function() {
    return exports.getBoolean('LOCATION_ENABLED', true);
};

exports.DEFAULTS = {
    paid: PAID_DEFAULT,
    free: FREE_DEFAULT,
    effort: DEFAULT_EFFORT
};
