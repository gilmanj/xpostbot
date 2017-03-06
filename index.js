if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./node_modules/botkit/lib/Botkit.js');
var os = require('os');

var controller = Botkit.slackbot({
    debug: false,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

var SUPPORT_CHANNEL = 'support_channel';
var channelList = [];
var userList = [];

//populate the list of channels for the team
bot.api.channels.list({}, function (err, response) {
    if (response.hasOwnProperty('channels') && response.ok) {
        let total = response.channels.length;
        for (let i = 0; i < total; i++) {
            let channel = response.channels[i];
            channelList.push({name: channel.name, id: channel.id});
        }
    }
});

//populate the list of users for the team
bot.api.users.list({}, function (err, response) {
    if (response.hasOwnProperty('members') && response.ok) {
        var total = response.members.length;
        for (var i = 0; i < total; i++) {
            var member = response.members[i];
            userList.push({name: member.name, id: member.id});
        }
    }
});

function findChannelIdByName(name) {
    let channelId;
    channelList.forEach(function(item) {
        if(item.name === name) {
            channelId = item.id;
        }
    });
    return channelId;
}

function crossPost(bot, message, source) {
    bot.say({
        text: `(${source}) ${message.text}`,
        channel: findChannelIdByName(SUPPORT_CHANNEL),
    },function(err,res) {
        if(err) {
            bot.botkit.log('Failed to cross-post message: ', err);    
        }
    });
}

controller.on('direct_mention,mention', function(bot, message) {
    crossPost(bot, message, `<@${message.user}> from <#${message.channel}>`);
});

controller.on('direct_message', function(bot, message) {
    crossPost(bot, message, `message from <@${message.user}>`);
});

controller.hears(['shutdown'], 'direct_message,direct_mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '> for slack team ' + bot.team_info.name + 
             '. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}