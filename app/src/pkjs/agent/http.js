/**
 * Tiny XMLHttpRequest JSON client. PebbleKit JS has no fetch(), and this
 * helper keeps every network call in one place with a consistent error shape.
 */

function request(method, url, headers, body, timeoutMs, callback) {
    var done = false;
    var req = new XMLHttpRequest();
    var timer = null;

    function finish(err, status, text, json) {
        if (done) {
            return;
        }
        done = true;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        callback(err, status, text, json);
    }

    try {
        req.open(method, url, true);
    } catch (e) {
        finish({ code: 'open-failed', message: 'Could not open request: ' + e });
        return;
    }

    if (headers) {
        for (var name in headers) {
            if (headers.hasOwnProperty(name)) {
                try {
                    req.setRequestHeader(name, headers[name]);
                } catch (e) {
                    // Some runtimes reject unusual headers; the server will tell us.
                }
            }
        }
    }

    req.onload = function() {
        var text = req.responseText || '';
        var json = null;
        if (text) {
            try {
                json = JSON.parse(text);
            } catch (e) {
                json = null;
            }
        }
        finish(null, req.status, text, json);
    };

    req.onerror = function() {
        finish({ code: 'network', message: 'Network request failed.' });
    };

    req.ontimeout = function() {
        finish({ code: 'timeout', message: 'Network request timed out.' });
    };

    if (typeof req.timeout === 'number' || typeof req.timeout === 'undefined') {
        try {
            req.timeout = timeoutMs || 30000;
        } catch (e) {
            // ignore
        }
    }

    // Belt and braces: some old WebViews do not fire ontimeout.
    timer = setTimeout(function() {
        finish({ code: 'timeout', message: 'Network request timed out.' });
        try {
            req.abort();
        } catch (e) {
            // ignore
        }
    }, (timeoutMs || 30000) + 1000);

    try {
        req.send(body || null);
    } catch (e) {
        finish({ code: 'send-failed', message: 'Could not send request: ' + e });
    }
}

exports.getJson = function(url, headers, timeoutMs, callback) {
    request('GET', url, headers, null, timeoutMs, callback);
};

exports.postJson = function(url, headers, body, timeoutMs, callback) {
    request('POST', url, headers, JSON.stringify(body), timeoutMs, callback);
};
