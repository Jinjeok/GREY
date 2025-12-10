import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import * as issueCommand from './commands/issue.js';
import * as pageCommand from './commands/page.js';

const commands = [
  issueCommand.data.toJSON(),
  pageCommand.data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

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
