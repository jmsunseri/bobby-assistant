/**
 * Alarms and timers. These run through the existing phone <-> watch action
 * bridge, so the watch's alarm manager stays the source of truth.
 */

var actions = require('../../actions/alarms');
var timeTool = require('./time');

function minutesLabel(minutes) {
    var totalSeconds = Math.round(minutes * 60);
    if (totalSeconds < 60) {
        return totalSeconds + (totalSeconds === 1 ? ' second' : ' seconds');
    }
    var hours = Math.floor(totalSeconds / 3600);
    var mins = Math.floor((totalSeconds % 3600) / 60);
    var secs = totalSeconds % 60;
    var label = '';
    if (hours) {
        label += hours + (hours === 1 ? ' hour' : ' hours');
    }
    if (mins) {
        if (label) {
            label += ' ';
        }
        label += mins + (mins === 1 ? ' minute' : ' minutes');
    }
    if (secs) {
        if (label) {
            label += ' ';
        }
        label += secs + (secs === 1 ? ' second' : ' seconds');
    }
    return label;
}

function secondsLabel(seconds) {
    var value = Math.max(0, Math.round(seconds));
    var mins = Math.floor(value / 60);
    var secs = value % 60;
    if (mins === 0) {
        return secs + 's';
    }
    return mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's';
}

function setTimer(args, ctx, callback) {
    var seconds = Math.round(Number(args.duration_seconds));
    if (!isFinite(seconds) || seconds <= 0) {
        callback({ ok: false, error: 'How long should the timer be?' });
        return;
    }
    var target = new Date((new Date()).getTime() + seconds * 1000);
    actions.setAlarm(ctx.session, {
        isTimer: true,
        duration: seconds,
        time: target.toISOString(),
        name: args.name || null
    }, function(result) {
        if (result && result.error) {
            callback({ ok: false, error: result.error });
            return;
        }
        callback({
            ok: true,
            text: 'Timer set for ' + minutesLabel(seconds / 60) + '.',
            data: { seconds: seconds, target: target.toISOString(), name: args.name || '' }
        });
    });
}

function setAlarm(args, ctx, callback) {
    if (!args.time) {
        callback({ ok: false, error: 'What time should the alarm be set for?' });
        return;
    }
    var date = new Date(args.time);
    if (isNaN(date.getTime())) {
        callback({ ok: false, error: 'I couldn\'t understand that time.' });
        return;
    }
    if (date.getTime() <= (new Date()).getTime()) {
        date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    }
    actions.setAlarm(ctx.session, {
        time: date.toISOString(),
        name: args.name || null
    }, function(result) {
        if (result && result.error) {
            callback({ ok: false, error: result.error });
            return;
        }
        callback({
            ok: true,
            text: 'Alarm set for ' + timeTool.formatTime(date) + '.',
            data: { time: date.toISOString(), name: args.name || '' }
        });
    });
}

function getTimers(args, ctx, callback) {
    actions.getAlarm(ctx.session, { isTimer: true }, function(result) {
        if (result && result.error) {
            callback({ ok: false, error: result.error });
            return;
        }
        var timers = (result && result.timers) || [];
        if (!timers.length) {
            callback({ ok: true, text: 'No timers are running.', data: { timers: [] } });
            return;
        }
        var parts = [];
        for (var i = 0; i < timers.length && i < 4; i++) {
            var label = timers[i].name ? timers[i].name + ': ' : '';
            parts.push(label + secondsLabel(timers[i].secondsLeft));
        }
        var widget = {
            type: 'timer',
            content: {
                target_time: timers[0].expirationTimeForDeletingAndWidgets,
                name: timers[0].name || ''
            }
        };
        callback({
            ok: true,
            text: timers.length === 1 ? 'Timer: ' + parts[0] + ' left.' : 'Timers: ' + parts.join(', ') + '.',
            widget: widget,
            data: { timers: timers }
        });
    });
}

function getAlarms(args, ctx, callback) {
    actions.getAlarm(ctx.session, { isTimer: false }, function(result) {
        if (result && result.error) {
            callback({ ok: false, error: result.error });
            return;
        }
        var alarms = (result && result.alarms) || [];
        if (!alarms.length) {
            callback({ ok: true, text: 'No alarms are set.', data: { alarms: [] } });
            return;
        }
        var parts = [];
        for (var i = 0; i < alarms.length && i < 5; i++) {
            var date = new Date(alarms[i].time);
            var label = alarms[i].name ? alarms[i].name + ' at ' : '';
            parts.push(label + (isNaN(date.getTime()) ? alarms[i].time : timeTool.formatTime(date)));
        }
        callback({
            ok: true,
            text: alarms.length + (alarms.length === 1 ? ' alarm: ' : ' alarms: ') + parts.join(', ') + '.',
            data: { alarms: alarms }
        });
    });
}

function cancelTimer(args, ctx, callback) {
    actions.getAlarm(ctx.session, { isTimer: true }, function(result) {
        var timers = (result && result.timers) || [];
        var match = null;
        for (var i = 0; i < timers.length; i++) {
            if (!args.name || (timers[i].name || '').toLowerCase() === String(args.name).toLowerCase()) {
                match = timers[i];
                break;
            }
        }
        if (!match) {
            callback({ ok: false, error: 'I couldn\'t find that timer.' });
            return;
        }
        actions.setAlarm(ctx.session, {
            isTimer: true,
            cancel: true,
            time: match.expirationTimeForDeletingAndWidgets
        }, function(cancelResult) {
            if (cancelResult && cancelResult.error) {
                callback({ ok: false, error: cancelResult.error });
                return;
            }
            callback({ ok: true, text: 'Timer cancelled.', data: { cancelled: match } });
        });
    });
}

function cancelAlarm(args, ctx, callback) {
    actions.getAlarm(ctx.session, { isTimer: false }, function(result) {
        var alarms = (result && result.alarms) || [];
        var match = null;
        for (var i = 0; i < alarms.length; i++) {
            var date = new Date(alarms[i].time);
            var wanted = args.name ? String(args.name).toLowerCase() : '';
            var label = (alarms[i].name || '').toLowerCase();
            if (!wanted || label === wanted || (!isNaN(date.getTime()) && timeTool.formatTime(date).toLowerCase() === wanted)) {
                match = alarms[i];
                break;
            }
        }
        if (!match) {
            callback({ ok: false, error: 'I couldn\'t find that alarm.' });
            return;
        }
        actions.setAlarm(ctx.session, {
            cancel: true,
            time: match.time
        }, function(cancelResult) {
            if (cancelResult && cancelResult.error) {
                callback({ ok: false, error: cancelResult.error });
                return;
            }
            callback({ ok: true, text: 'Alarm cancelled.', data: { cancelled: match } });
        });
    });
}

var nameField = { type: 'text', instructions: 'Optional short name for this item.' };

exports.setTimer = {
    name: 'set_timer',
    description: 'Start a countdown timer.',
    criteria: 'Start a timer that counts down for a number of minutes or hours.',
    fields: {
        duration_seconds: {
            type: 'number',
            integer: true,
            instructions: 'How many seconds from now until the timer should fire. Convert minutes and hours to seconds.'
        },
        name: nameField
    },
    required: ['duration_seconds'],
    requiresKeys: [],
    thought: function(args) {
        return 'Setting a timer...';
    },
    run: setTimer
};

exports.setAlarm = {
    name: 'set_alarm',
    description: 'Set an alarm for a clock time.',
    criteria: 'Set an alarm for a specific clock time, such as 7am or 18:30.',
    fields: {
        time: {
            type: 'datetime',
            instructions: 'The local date and time the alarm should fire, in ISO 8601. If the user names a time that has already passed today, use tomorrow.'
        },
        name: nameField
    },
    required: ['time'],
    requiresKeys: [],
    thought: function() {
        return 'Setting an alarm...';
    },
    run: setAlarm
};

exports.getTimers = {
    name: 'get_timers',
    description: 'List the timers that are currently running.',
    criteria: 'Ask how much time is left on a timer, or list running timers.',
    fields: null,
    required: [],
    requiresKeys: [],
    thought: function() {
        return 'Checking your timers...';
    },
    run: getTimers
};

exports.getAlarms = {
    name: 'get_alarms',
    description: 'List the alarms that are set.',
    criteria: 'Ask what alarms are set, or when an alarm will go off.',
    fields: null,
    required: [],
    requiresKeys: [],
    thought: function() {
        return 'Checking your alarms...';
    },
    run: getAlarms
};

exports.cancelTimer = {
    name: 'cancel_timer',
    description: 'Cancel a running timer.',
    criteria: 'Cancel or stop a running timer.',
    fields: { name: nameField },
    required: [],
    requiresKeys: [],
    thought: function() {
        return 'Cancelling the timer...';
    },
    run: cancelTimer
};

exports.cancelAlarm = {
    name: 'cancel_alarm',
    description: 'Cancel an alarm.',
    criteria: 'Cancel or turn off an alarm.',
    fields: { name: nameField },
    required: [],
    requiresKeys: [],
    thought: function() {
        return 'Cancelling the alarm...';
    },
    run: cancelAlarm
};

exports.secondsLabel = secondsLabel;
exports.minutesLabel = minutesLabel;
