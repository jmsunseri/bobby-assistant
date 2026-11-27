/**
 * Weather via Open-Meteo.
 *
 * Open-Meteo needs no key and accepts lat/lon directly, so "here" works
 * without reverse geocoding. Mapbox is used as an optional nicer geocoder for
 * place names when the user has supplied a token.
 */

var http = require('../http');
var log = require('../log');
var settings = require('../settings');
var location = require('../../location');

var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

var SUMMARIES = {
    0: 'clear',
    1: 'mostly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'foggy',
    48: 'foggy',
    51: 'light drizzle',
    53: 'drizzle',
    55: 'heavy drizzle',
    56: 'freezing drizzle',
    57: 'freezing drizzle',
    61: 'light rain',
    63: 'rain',
    65: 'heavy rain',
    66: 'freezing rain',
    67: 'freezing rain',
    71: 'light snow',
    73: 'snow',
    75: 'heavy snow',
    77: 'snow grains',
    80: 'light showers',
    81: 'showers',
    82: 'heavy showers',
    85: 'snow showers',
    86: 'heavy snow showers',
    95: 'a thunderstorm',
    96: 'a thunderstorm with hail',
    99: 'a thunderstorm with hail'
};

function conditionName(code) {
    if (code === 0) {
        return 'SUN';
    }
    if (code === 1 || code === 2) {
        return 'PARTLY_CLOUDY';
    }
    if (code === 3) {
        return 'CLOUDY_DAY';
    }
    if (code === 45 || code === 48) {
        return 'CLOUDY_DAY';
    }
    if (code >= 51 && code <= 57) {
        return 'LIGHT_RAIN';
    }
    if (code >= 61 && code <= 65) {
        return code >= 65 ? 'HEAVY_RAIN' : 'LIGHT_RAIN';
    }
    if (code === 66 || code === 67) {
        return 'HEAVY_RAIN';
    }
    if (code >= 71 && code <= 77) {
        return 'LIGHT_SNOW';
    }
    if (code >= 80 && code <= 82) {
        return code === 82 ? 'HEAVY_RAIN' : 'LIGHT_RAIN';
    }
    if (code === 85 || code === 86) {
        return 'HEAVY_SNOW';
    }
    if (code >= 95) {
        return 'HEAVY_RAIN';
    }
    return 'CLOUDY_DAY';
}

function summary(code) {
    return SUMMARIES[code] || 'cloudy';
}

function temperature(celsius, units) {
    if (units === 'imperial') {
        return Math.round(celsius * 9 / 5 + 32);
    }
    return Math.round(celsius);
}

function tempUnit(units) {
    return units === 'imperial' ? '°F' : '°C';
}

function windSpeed(kmh, units) {
    if (units === 'imperial' || units === 'uk') {
        return Math.round(kmh * 0.621371);
    }
    return Math.round(kmh);
}

function windUnit(units) {
    return (units === 'imperial' || units === 'uk') ? 'mph' : 'km/h';
}

function dayLabel(isoDate, index) {
    if (index === 0) {
        return 'Today';
    }
    if (index === 1) {
        return 'Tomorrow';
    }
    var parts = String(isoDate).split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return DAYS[date.getDay()];
}

function mapboxGeocode(query, callback) {
    var token = settings.getMapboxToken();
    if (!token) {
        callback(null);
        return;
    }
    var url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
        encodeURIComponent(query) + '.json?types=place&limit=1&access_token=' + encodeURIComponent(token);
    http.getJson(url, null, 15000, function(err, status, text, json) {
        if (err || status !== 200 || !json || !json.features || !json.features.length) {
            callback(null);
            return;
        }
        var feature = json.features[0];
        var center = feature.center || [];
        callback({
            lat: center[1],
            lon: center[0],
            label: feature.text || query
        });
    });
}

function openMeteoGeocode(query, callback) {
    var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(query) + '&count=1&language=en&format=json';
    http.getJson(url, null, 15000, function(err, status, text, json) {
        if (err) {
            callback(err);
            return;
        }
        if (status !== 200 || !json || !json.results || !json.results.length) {
            callback({ code: 'no-place', message: 'I couldn\'t find that place.' });
            return;
        }
        var place = json.results[0];
        callback(null, {
            lat: place.latitude,
            lon: place.longitude,
            label: place.name
        });
    });
}

function resolvePlace(query, ctx, callback) {
    var wanted = String(query || '').replace(/^\s+|\s+$/g, '').replace(/^in\s+/i, '');
    var lower = wanted.toLowerCase();
    if (!wanted || lower === 'here' || lower === 'my location' || lower === 'current location' ||
        lower === 'weather' || lower === 'temperature' || lower === 'forecast' || lower === 'outside') {
        if (settings.isLocationEnabled() && location.isReady()) {
            callback(null, { lat: location.getPos().lat, lon: location.getPos().lon, label: 'Here' });
        } else {
            callback({ code: 'no-location', message: 'I don\'t have your location. Turn on location access or name a city.' });
        }
        return;
    }
    mapboxGeocode(wanted, function(place) {
        if (place) {
            callback(null, place);
            return;
        }
        openMeteoGeocode(wanted, callback);
    });
}

function findDay(days, when) {
    var wanted = String(when || '').toLowerCase();
    if (!wanted || wanted === 'now' || wanted === 'today' || wanted.indexOf('today') !== -1) {
        return { mode: 'current', index: 0 };
    }
    if (wanted.indexOf('tomorrow') !== -1) {
        return { mode: 'single', index: 1 };
    }
    if (wanted.indexOf('week') !== -1 || wanted.indexOf('days') !== -1) {
        return { mode: 'multi', index: 0 };
    }
    for (var i = 0; i < days.length; i++) {
        var label = days[i].label.toLowerCase();
        if (label === wanted || label.substring(0, 3) === wanted.substring(0, 3) || wanted.indexOf(label) !== -1) {
            return { mode: 'single', index: i };
        }
    }
    return { mode: 'current', index: 0 };
}

function buildResult(place, json, ctx, when) {
    var units = ctx.units || '';
    var current = json.current || {};
    var daily = json.daily || {};
    var days = [];
    var dates = daily.time || [];
    for (var i = 0; i < dates.length && i < 4; i++) {
        var code = (daily.weather_code || [])[i];
        days.push({
            date: dates[i],
            label: dayLabel(dates[i], i),
            high: temperature((daily.temperature_2m_max || [])[i], units),
            low: temperature((daily.temperature_2m_min || [])[i], units),
            code: code,
            condition: conditionName(code),
            summary: summary(code)
        });
    }
    var currentResult = {
        temperature: temperature(current.temperature_2m, units),
        feelsLike: temperature(current.apparent_temperature, units),
        code: current.weather_code,
        condition: conditionName(current.weather_code),
        summary: summary(current.weather_code),
        windSpeed: windSpeed(current.wind_speed_10m, units),
        windUnit: windUnit(units),
        unit: tempUnit(units)
    };
    var selection = findDay(days, when);
    return {
        location: place.label,
        current: currentResult,
        days: days,
        mode: selection.mode,
        index: selection.index
    };
}

function fetchForecast(place, ctx, when, callback) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat +
        '&longitude=' + place.lon +
        '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
        '&timezone=auto&forecast_days=4&temperature_unit=celsius&wind_speed_unit=kmh';
    http.getJson(url, null, 20000, function(err, status, text, json) {
        if (err) {
            callback(err);
            return;
        }
        if (status !== 200 || !json || !json.current) {
            callback({ code: 'weather-failed', message: 'The weather service didn\'t answer.' });
            return;
        }
        callback(null, buildResult(place, json, ctx, when));
    });
}

function run(args, ctx, callback) {
    var when = args.when || 'now';
    resolvePlace(args.location, ctx, function(err, place) {
        if (err) {
            callback({ ok: false, error: err.message || 'I couldn\'t find that place.' });
            return;
        }
        fetchForecast(place, ctx, when, function(forecastErr, result) {
            if (forecastErr) {
                callback({ ok: false, error: forecastErr.message || 'The weather service didn\'t answer.' });
                return;
            }
            log.info('weather.result', result);
            callback({ ok: true, data: result, text: null });
        });
    });
}

exports.weather = {
    name: 'weather',
    description: 'Current weather or a forecast for a place, or for the user\'s location.',
    criteria: 'Weather now or in the next few days, for a named place or "here", including whether to bring an umbrella or what to wear.',
    fields: {
        location: {
            type: 'text',
            instructions: 'The place to get weather for, exactly as the user said it. Leave it out when they do not name a place.'
        },
        when: {
            type: 'text',
            instructions: 'One of: now, today, tomorrow, week, or a weekday name. Default to now.'
        }
    },
    required: [],
    requiresKeys: [],
    thought: function() {
        return 'Checking the weather...';
    },
    run: run
};

exports.conditionName = conditionName;
exports.summary = summary;
exports.temperature = temperature;
exports.buildResult = buildResult;
exports.findDay = findDay;
