/**
 * Local time tool. No network, no keys.
 */

var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

function formatTime(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) {
        hours = 12;
    }
    return hours + ':' + pad(minutes) + ' ' + suffix;
}

function formatDate(date) {
    return DAYS[date.getDay()] + ', ' + MONTHS[date.getMonth()] + ' ' + date.getDate();
}

module.exports = {
    name: 'time',
    description: 'The current date and time on the watch.',
    criteria: 'What time or date is it right now?',
    fields: null,
    required: [],
    requiresKeys: [],
    thought: function() {
        return 'Checking the time...';
    },
    run: function(args, ctx, callback) {
        var now = new Date();
        callback({
            ok: true,
            text: 'It\'s ' + formatTime(now) + ' on ' + formatDate(now) + '.',
            data: {
                iso: now.toISOString(),
                time: formatTime(now),
                date: formatDate(now)
            }
        });
    },
    formatTime: formatTime,
    formatDate: formatDate
};
