import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import * as issueCommand from './commands/issue.js';

const commands = [issueCommand.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Note: This deploys logic globally. To deploy to a specific guild, use Routes.applicationGuildCommands(clientId, guildId)
    // For production bot, global is fine but takes time to propagate. For dev, guild is better.
    // I will use applicationCommands which is global, or if user wants guild I can change.
    // Assuming global for now as per "single command architecture".
    
    // Actually, for quicker testing, let's look if we have a GUILD_ID in env (not in example but useful). 
    // If not, global.
    const route = Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

    const data = await rest.put(
      route,
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
