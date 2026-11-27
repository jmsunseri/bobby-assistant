/**
 * Reminders. These are Pebble timeline pins managed on the phone.
 */

var actions = require('../../actions/reminders');
var timeTool = require('./time');

function formatWhen(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
        return String(value);
    }
    return timeTool.formatDate(date) + ' at ' + timeTool.formatTime(date);
}

function setReminder(args, ctx, callback) {
    if (!args.what || !args.when) {
        callback({ ok: false, error: 'What should I remind you about, and when?' });
        return;
    }
    var when = args.when;
    var date = new Date(when);
    if (!isNaN(date.getTime()) && date.getTime() <= (new Date()).getTime()) {
        date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
        when = date.toISOString();
    }
    actions.setReminder(ctx.session, {
        what: args.what,
        time: when
    }, function(result) {
        if (result && result.error) {
            callback({ ok: false, error: result.error });
            return;
        }
        var text = 'Reminder set: ' + args.what + ' on ' + formatWhen(when) + '.';
        if (result && result.warning) {
            text += ' Timeline reminders close to now can arrive late.';
        }
        callback({
            ok: true,
            text: text,
            data: { what: args.what, when: when }
        });
    });
}

function getReminders(args, ctx, callback) {
    actions.getReminders(ctx.session, {}, function(result) {
        if (result && result.error) {
            callback({ ok: false, error: result.error });
            return;
        }
        var reminders = (result && result.reminders) || [];
        if (!reminders.length) {
            callback({ ok: true, text: 'You have no reminders.', data: { reminders: [] } });
            return;
        }
        var parts = [];
        for (var i = 0; i < reminders.length && i < 4; i++) {
            parts.push(reminders[i].what + ' (' + formatWhen(reminders[i].time) + ')');
        }
        callback({
            ok: true,
            text: reminders.length + (reminders.length === 1 ? ' reminder: ' : ' reminders: ') + parts.join('; ') + '.',
            data: { reminders: reminders }
        });
    });
}

function deleteReminder(args, ctx, callback) {
    actions.getReminders(ctx.session, {}, function(result) {
        var reminders = (result && result.reminders) || [];
        var wanted = String(args.what || '').toLowerCase();
        var match = null;
        for (var i = 0; i < reminders.length; i++) {
            var text = String(reminders[i].what || '').toLowerCase();
            if (!wanted || text.indexOf(wanted) !== -1 || wanted.indexOf(text) !== -1) {
                match = reminders[i];
                break;
            }
        }
        if (!match) {
            callback({ ok: false, error: 'I couldn\'t find that reminder.' });
            return;
        }
        actions.deleteReminder(ctx.session, { id: match.id }, function(deleteResult) {
            if (deleteResult && deleteResult.error) {
                callback({ ok: false, error: deleteResult.error });
                return;
            }
            callback({
                ok: true,
                text: 'Reminder deleted: ' + match.what + '.',
                data: { deleted: match }
            });
        });
    });
}

exports.setReminder = {
    name: 'set_reminder',
    description: 'Create a reminder for a future time.',
    criteria: 'Create a reminder about something at a future time. This is not an alarm or timer.',
    fields: {
        what: {
            type: 'text',
            instructions: 'What the user wants to be reminded about, as a short phrase.'
        },
        when: {
            type: 'datetime',
            instructions: 'When the reminder should fire, in local ISO 8601. Resolve relative times like "tomorrow morning" or "in an hour".'
        }
    },
    required: ['what', 'when'],
    requiresKeys: [],
    thought: function() {
        return 'Setting a reminder...';
    },
    run: setReminder
};

exports.getReminders = {
    name: 'get_reminders',
    description: 'List the reminders that are set.',
    criteria: 'Ask what reminders exist or what is on the timeline.',
    fields: null,
    required: [],
    requiresKeys: [],
    thought: function() {
        return 'Checking your reminders...';
    },
    run: getReminders
};

exports.deleteReminder = {
    name: 'delete_reminder',
    description: 'Delete a reminder.',
    criteria: 'Delete or cancel a reminder.',
    fields: {
        what: {
            type: 'text',
            instructions: 'The text of the reminder to delete.'
        }
    },
    required: ['what'],
    requiresKeys: [],
    thought: function() {
        return 'Deleting the reminder...';
    },
    run: deleteReminder
};

exports.formatWhen = formatWhen;
