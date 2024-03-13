require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'latex',
        description: 'Devolve a imagem de uma expressão em LaTeX.',
        options: [
            {
                name: 'expressao',
                description: 'A expressão que você quer renderizar. Exemplo: `\\frac{1}{2}`',
                type: 3,
                required: true,
            },
        ],
    },
    {
        name: 'help',
        description: 'Explica como a ferramenta funciona.',
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
    try{
        console.log('Registrando comandos.')
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        )
        console.log('Comandos registrados com sucesso!')
    }catch(error){
        console.error(`Aconteceu um erro: ${error}`);
    }   
})();