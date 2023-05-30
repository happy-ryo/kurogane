const { App, LogLevel} = require('@slack/bolt');
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY,
});

const postChat = async (
    messages
) => {

    const openai = new OpenAIApi(configuration);
    const response = await openai.createChatCompletion({
        engine: 'gpt-3-turbo',
        prompt: messages
    });

    if (response.status === 200) {
        return response.data.choices[0].message.content
    }
}

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: LogLevel.DEBUG,
    port: 3000
});

// // Listens to incoming messages that contain "hello"
app.message('hello', async ({ message, say }) => {
    await say(`Hey there <@${message.user}>!`);
});

// BOTに対するメンション付きの発言を検知して、スレッドで返信する
app.event('app_mention', async ({ event, say }) => {
    try {
        const relies = await app.client.conversations.replies({
            channel: event.channel,
            ts: event.thread_ts || event.ts,
        });

        // スレッドが見つからない場合エラーログを出力する
        if (!relies.ok) {
            console.error(relies.error);
            return;
        }

        // スレッドの内容をChat GPT-3に投げて返信を生成する
        const messages = relies.messages.map((message) => {
            return {
                role: message.subtype === 'bot_message' ? 'assistant' : 'user',
                content: message.text,
            };
        });

        // messages の先頭に {"role": "system", "content": "You are a helpful assistant."} を追加する
        messages.unshift({
            role: 'system',
            content: 'AI=Kurogane, Slack Bot. Follow: bold=*bold*, italic=_italic_, strike=~strikethrough~, code=`code`, link=<https://slack.com|link>, block=```block```, list=* item. Space around `. Start.',
        });

        const chat = await postChat(messages);

        // スレッドが見つかった場合、スレッドに返信する
        await say({
            text: chat,
            thread_ts: event.thread_ts || event.ts,
        });
    } catch (error) {
        console.error(error);
    }
});


(async () => {
    // Start your app
    await app.start();
})();

