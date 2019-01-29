const SLACK_ACCESS_TOKEN = process.env.SLACK_ACCESS_TOKEN as string;
if (SLACK_ACCESS_TOKEN == null) {
    console.error('Missing SLACK_ACCESS_TOKEN')
    process.exit(1)
}

import { WebClient, RTMClient, WebAPICallResult } from '@slack/client';
import notifier = require('node-notifier');
import * as path from 'path';
import { keyBy, Dictionary } from 'lodash';

const web = new WebClient(SLACK_ACCESS_TOKEN);
const rtm = new RTMClient(SLACK_ACCESS_TOKEN);

interface User {
    id: string;
    is_bot: boolean;
    real_name: string;
}

interface UsersResult extends WebAPICallResult {
    members: User[];
}

function getMessage(real_name: string, presence: string) {
    if (presence === 'active') {
        return `${real_name} just came online`;
    } else if (presence === 'away') {
        return `${real_name} just went offline`;
    } else {
        console.error(real_name, 'unknown presence: ', presence);
    }
}


type PresenceChangeEvent = {
    user: string;
    presence: string;
};
function handleUserEvent(event: PresenceChangeEvent) {
    const user = usersMap[event.user];
    const presence = event.presence;
    if (!user) {
        return;
    }
    notifier.notify({
        title: 'Slack presence notifications',
        message: getMessage(user.real_name, presence),
        sound: true,
        // https://brandfolder.com/slack/logos
        icon: path.join(__dirname, 'Slack_Mark_Web.png'),
    });
}

let usersMap: Dictionary<User> = {};

async function start() {
    await rtm.start();
    let usersResult = (await web.users.list()) as UsersResult;
    let users = usersResult.members.filter(u => !u.is_bot);
    // let users = [{ id: 'U360C2K33', real_name: 'Hayden' }] as User[];
    usersMap = keyBy(users, u => u.id);

    await rtm.subscribePresence(users.map(u => u.id));

    // skip the initial messages
    setTimeout(() => {
        rtm.on('presence_change', event => {
            console.log(event);
            handleUserEvent(event);
        });
    }, 1000)
}

start();
