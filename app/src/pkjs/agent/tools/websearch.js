/**
 * Brave web search. Results always go through the synthesis LLM: raw JSON
 * snippets are not useful on a watch screen.
 */

var http = require('../http');
var settings = require('../settings');
var log = require('../log');

function run(args, ctx, callback) {
    var key = settings.getBraveKey();
    var query = String(args.query || '').replace(/^\s+|\s+$/g, '');
    if (!query) {
        callback({ ok: false, error: 'What should I search for?' });
        return;
    }
    if (!key) {
        callback({ ok: false, error: 'Add a Brave Search API key in settings to use web search.' });
        return;
    }
    var url = 'https://api.search.brave.com/res/v1/web/search?q=' +
        encodeURIComponent(query) + '&count=5&text_decorations=false&result_filter=web';
    http.getJson(url, {
        'Accept': 'application/json',
        'X-Subscription-Token': key
    }, 20000, function(err, status, text, json) {
        if (err) {
            callback({ ok: false, error: err.message });
            return;
        }
        if (status === 401 || status === 403) {
            callback({ ok: false, error: 'Brave rejected the API key.' });
            return;
        }
        if (status !== 200 || !json) {
            callback({ ok: false, error: 'Web search failed (HTTP ' + status + ').' });
            return;
        }
        var raw = (json.web && json.web.results) || [];
        var results = [];
        for (var i = 0; i < raw.length && i < 5; i++) {
            results.push({
                title: raw[i].title || '',
                url: raw[i].url || '',
                description: (raw[i].description || '').replace(/<[^>]*>/g, '')
            });
        }
        if (!results.length) {
            callback({ ok: false, error: 'No web results found.' });
            return;
        }
        log.info('websearch.result', { query: query, count: results.length });
        callback({
            ok: true,
            data: { query: query, results: results },
            text: 'Top result: ' + results[0].title + '. ' + results[0].description
        });
    });
}

exports.websearch = {
    name: 'websearch',
    description: 'Search the web for current facts, news, or anything that needs an up-to-date source.',
    criteria: 'Look something up on the web, current events, facts that need a source, or anything not covered by another tool.',
    fields: {
        query: {
            type: 'text',
            instructions: 'A short web search query preserving the important terms from the request.'
        }
    },
    required: ['query'],
    requiresKeys: ['BRAVE_API_KEY'],
    alwaysSynthesis: true,
    thought: function() {
        return 'Searching the web…';
    },
    run: run
};
