/**
 * Deterministic replies for the fast path.
 *
 * No language model is involved in these strings: an alarm confirmation is a
 * template, not a generated sentence.
 */

var QUESTIONS = {
    duration_minutes: 'How long should the timer be?',
    time: 'What time should that be for?',
    what: 'What should I remind you about?',
    when: 'When should that happen?',
    location: 'Which place?',
    from: 'Which currency are you converting from?',
    to: 'Which currency are you converting to?',
    query: 'What should I search for?',
    name: 'Which one?',
    amount: 'How much?'
};

function placeLabel(location) {
    if (!location || String(location).toLowerCase() === 'here') {
        return 'your location';
    }
    return location;
}

function weatherWidget(result) {
    var data = result.data;
    if (data.mode === 'multi') {
        var days = [];
        for (var i = 0; i < data.days.length && i < 3; i++) {
            days.push({
                day: data.days[i].label,
                high: data.days[i].high,
                low: data.days[i].low,
                condition_name: data.days[i].condition
            });
        }
        return {
            type: 'weather-multi-day',
            content: { location: data.location, days: days }
        };
    }
    if (data.mode === 'single') {
        var day = data.days[data.index] || data.days[0];
        return {
            type: 'weather-single-day',
            content: {
                high: day.high,
                low: day.low,
                location: data.location,
                summary: day.summary,
                unit: data.current.unit,
                condition_name: day.condition,
                day: day.label
            }
        };
    }
    return {
        type: 'weather-current',
        content: {
            temperature: data.current.temperature,
            feels_like: data.current.feelsLike,
            location: data.location,
            description: data.current.summary,
            unit: data.current.unit,
            wind_speed: data.current.windSpeed,
            wind_speed_unit: data.current.windUnit,
            condition_name: data.current.condition
        }
    };
}

function weatherText(result) {
    var data = result.data;
    var where = placeLabel(data.location);
    if (data.mode === 'multi') {
        var parts = [];
        for (var i = 0; i < data.days.length && i < 3; i++) {
            var day = data.days[i];
            parts.push(day.label + ' ' + day.summary + ' ' + day.high + '/' + day.low + data.current.unit);
        }
        return where + ': ' + parts.join('; ') + ' (high/low).';
    }
    if (data.mode === 'single') {
        var single = data.days[data.index] || data.days[0];
        return single.label + ' in ' + where + ': ' + single.summary + ', high ' +
            single.high + data.current.unit + ', low ' + single.low + data.current.unit + '.';
    }
    var current = data.current;
    return 'In ' + where + ' it is ' + current.temperature + current.unit + ' and ' +
        current.summary + ', feels like ' + current.feelsLike + current.unit +
        '. Wind ' + current.windSpeed + ' ' + current.windUnit + '.';
}

exports.forTool = function(name, args, result, ctx) {
    if (name === 'weather') {
        return { text: weatherText(result), widget: weatherWidget(result) };
    }
    if (name === 'currency') {
        var data = result.data;
        return {
            text: data.amount + ' ' + data.from + ' is ' + data.converted + ' ' + data.to + '.',
            widget: {
                type: 'number',
                content: {
                    number: String(data.converted),
                    unit: data.to
                }
            }
        };
    }
    if (name === 'websearch') {
        return {
            text: result.text || 'I found some results, but could not summarise them.'
        };
    }
    if (result.widget) {
        return { text: result.text || '', widget: result.widget };
    }
    return { text: result.text || 'Done.' };
};

exports.clarification = function(tool, issues) {
    if (!issues || !issues.length) {
        return 'Could you give me a bit more detail?';
    }
    var issue = issues[0];
    var question = QUESTIONS[issue.field];
    if (question) {
        return question;
    }
    var spec = issue.spec || {};
    if (spec.instructions) {
        return spec.instructions;
    }
    return 'Could you give me a bit more detail about ' + issue.field + '?';
};

exports.errorText = function(result) {
    if (result && result.error) {
        return result.error;
    }
    return 'Something went wrong.';
};

exports.placeLabel = placeLabel;
exports.weatherWidget = weatherWidget;
exports.weatherText = weatherText;
