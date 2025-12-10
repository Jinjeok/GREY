import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { connectDatabase } from './database/connect.js';
import * as issueCommand from './commands/issue.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

client.commands = new Collection();
client.commands.set(issueCommand.data.name, issueCommand);

client.once(Events.ClientReady, async () => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  await connectDatabase();
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
