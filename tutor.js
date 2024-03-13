const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require("openai");
require("dotenv").config();
const axios = require('axios');
const fs = require('fs');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const client = new Client({
  intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

client.once('ready', () => {
    console.log('TT está pronto!');
});

const threadMap = {};

const getOpenAiThreadId = (discordThreadId) => {

    return threadMap[discordThreadId];
}

const addThreadToMap = (discordThreadId, openAiThreadId) => {
    threadMap[discordThreadId] = openAiThreadId;
}

const terminalStates = ["cancelled", "failed", "completed", "expired"];
const statusCheckLoop = async (openAiThreadId, runId) => {
    const run = await openai.beta.threads.runs.retrieve(
        openAiThreadId,
        runId
    );

    if(terminalStates.indexOf(run.status) < 0){
        await sleep(1000);
        return statusCheckLoop(openAiThreadId, runId);
    }

    return run.status;
}

const addMessage = (threadId, content) => {
    return openai.beta.threads.messages.create(
        threadId,
        { role: "user", content }
    )
}

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'latex') {
            await interaction.deferReply();
            await generateLatex(interaction.options.getString('expressao'));
            interaction.followUp({ files: [{ attachment: 'latex.jpg' }] });
        }else if(interaction.commandName === 'help'){
            interaction.reply('Obrigado por usar o Tutor Turing - TT! Aqui estão os comandos disponíveis: \n\n`/latex`: Devolve a imagem de uma expressão em LaTeX. Útil para mostrar o texto no formato LaTeX que o bot devolve (geralmente os que estão em colchetes []). \n\n`/help`: Explica como a ferramenta funciona. \n\nPara usar o bot, basta digitar uma mensagem no canal de texto e ele irá responder com uma mensagem. Se a resposta não for satisfatória, você pode corrigi-la respondendo a mensagem do bot com a resposta correta. Aos demais, reajam com ✅ ou ❌ para marcar a resposta como útil ou inútil. \n\nSempre que desejar que o bot não responda a uma resposta, basta iniciar a mensagem com `&`.');
        }
    } catch (error) {
        console.error(error);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content || message.content === '' || message.content.startsWith("&")) return;
    const discordThreadId = message.channel.id;
    let openAiThreadId = getOpenAiThreadId(discordThreadId);

    let messagesLoaded = false;

    await message.channel.sendTyping();

    const sendTypingInterval = setInterval(() => {message.channel.sendTyping();}, 5000);

    if(!openAiThreadId){
        const thread = await openai.beta.threads.create();
        openAiThreadId = thread.id;
        addThreadToMap(discordThreadId, openAiThreadId);
        
        if(message.channel.isThread()){
            const starterMsg = await message.channel.fetchStarterMessage();
            const otherMessagesRaw = await message.channel.messages.fetch();

            const otherMessages = Array.from(otherMessagesRaw.values())
                .map(msg => msg.content)
                .reverse();

            const messages = [starterMsg.content, ...otherMessages]
                .filter(msg => !!msg && msg !== '')

            await Promise.all(messages.map(msg => addMessage(openAiThreadId, msg)));
            messagesLoaded = true;
        }
    }
    if(!messagesLoaded){
        await addMessage(openAiThreadId, message.content);
    }

    const run = await openai.beta.threads.runs.create(
        openAiThreadId,
        { assistant_id: process.env.ASSISTANT_ID }
    )
    const status = await statusCheckLoop(openAiThreadId, run.id);

    const messages = await openai.beta.threads.messages.list(openAiThreadId);

    let response = messages.data[0].content[0].text.value;
    if(!response){
        response = "Não sei como responder a isso";
    }

    const chunkSize = 1999;


    const numberOfChunks = Math.ceil(response.length / chunkSize);


    const substrings = [];


    for (let i = 0; i < numberOfChunks; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const partialResponse = response.substring(start, end);
        substrings.push(partialResponse);
    }
    clearInterval(sendTypingInterval);
    
    substrings.forEach(substring => {
        message.reply(substring);
    });
    message.channel.send("Caso a resposta não tenha sido satisfatória, escreva abaixo uma correta respondendo essa mensagem. Aos demais, reajam com ✅ ou ❌ para marcar a resposta como útil ou inútil.");
});

async function generateLatex(latexInput) {
    const imageUrl = `https://chart.apis.google.com/chart?cht=tx&chl=${latexInput}`;
    await downloadImage(imageUrl, 'latex.jpg');
}
function downloadImage(url, filename) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            await fs.writeFile(filename, response.data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

client.login(process.env.DISCORD_TOKEN);