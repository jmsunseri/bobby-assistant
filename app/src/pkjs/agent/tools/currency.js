/**
 * Currency conversion via ExchangeRate-API.
 */

var http = require('../http');
var settings = require('../settings');
var log = require('../log');

var CURRENCY_NAMES = {
    'usd': 'USD', 'dollar': 'USD', 'dollars': 'USD', 'us dollar': 'USD', 'us dollars': 'USD', 'buck': 'USD', 'bucks': 'USD', '$': 'USD',
    'eur': 'EUR', 'euro': 'EUR', 'euros': 'EUR', '€': 'EUR',
    'gbp': 'GBP', 'pound': 'GBP', 'pounds': 'GBP', 'sterling': 'GBP', 'quid': 'GBP', '£': 'GBP',
    'jpy': 'JPY', 'yen': 'JPY', '¥': 'JPY',
    'cny': 'CNY', 'yuan': 'CNY', 'rmb': 'CNY',
    'inr': 'INR', 'rupee': 'INR', 'rupees': 'INR',
    'cad': 'CAD', 'canadian dollar': 'CAD', 'canadian dollars': 'CAD',
    'aud': 'AUD', 'australian dollar': 'AUD', 'australian dollars': 'AUD',
    'chf': 'CHF', 'franc': 'CHF', 'francs': 'CHF', 'swiss franc': 'CHF',
    'mxn': 'MXN', 'peso': 'MXN', 'pesos': 'MXN',
    'krw': 'KRW', 'won': 'KRW',
    'brl': 'BRL', 'real': 'BRL', 'reais': 'BRL',
    'zar': 'ZAR', 'rand': 'ZAR',
    'sek': 'SEK', 'krona': 'SEK',
    'nok': 'NOK', 'krone': 'NOK',
    'huf': 'HUF', 'forint': 'HUF',
    'pln': 'PLN', 'zloty': 'PLN',
    'try': 'TRY', 'lira': 'TRY',
    'ils': 'ILS', 'shekel': 'ILS',
    'aed': 'AED', 'dirham': 'AED'
};

function normalizeCurrency(value) {
    var raw = String(value || '').replace(/^\s+|\s+$/g, '');
    var lower = raw.toLowerCase().replace(/\./g, '');
    if (CURRENCY_NAMES[lower]) {
        return CURRENCY_NAMES[lower];
    }
    var code = raw.toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length === 3) {
        return code;
    }
    return '';
}

function run(args, ctx, callback) {
    var key = settings.getExchangeRateKey();
    var from = normalizeCurrency(args.from);
    var to = normalizeCurrency(args.to);
    var amount = Number(args.amount);
    if (!isFinite(amount) || amount <= 0) {
        amount = 1;
    }
    if (!from || !to) {
        callback({ ok: false, error: 'Which currencies should I convert between?' });
        return;
    }
    if (!key) {
        callback({ ok: false, error: 'Add an ExchangeRate-API key in settings to use currency conversion.' });
        return;
    }
    var url = 'https://v6.exchangerate-api.com/v6/' + encodeURIComponent(key) +
        '/pair/' + from + '/' + to + '/' + amount;
    http.getJson(url, null, 15000, function(err, status, text, json) {
        if (err) {
            callback({ ok: false, error: err.message });
            return;
        }
        if (status !== 200 || !json || json.result !== 'success') {
            var message = json && json['error-type'] ? 'Currency service error: ' + json['error-type'] : 'Currency conversion failed.';
            callback({ ok: false, error: message });
            return;
        }
        var converted = Number(json.conversion_result);
        var rounded = Math.round(converted * 100) / 100;
        log.info('currency.result', { from: from, to: to, amount: amount, converted: rounded });
        callback({
            ok: true,
            data: {
                amount: amount,
                from: from,
                to: to,
                converted: rounded,
                rate: json.conversion_rate
            }
        });
    });
}

exports.currency = {
    name: 'currency',
    description: 'Convert an amount of money between currencies.',
    criteria: 'Convert money from one currency to another, or ask an exchange rate.',    fields: {
        amount: {
            type: 'number',
            instructions: 'The amount to convert. Use 1 when the user does not give an amount.'
        },
        from: {
            type: 'text',
            instructions: 'The source currency as the user said it, for example dollars or USD.'
        },
        to: {
            type: 'text',
            instructions: 'The target currency as the user said it, for example euros or EUR.'
        }
    },
    required: ['from', 'to'],
    requiresKeys: ['EXCHANGE_RATE_API_KEY'],
    thought: function() {
        return 'Converting currency...';
    },
    run: run
};

exports.normalizeCurrency = normalizeCurrency;
