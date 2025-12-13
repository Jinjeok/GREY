import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { connectDatabase } from './database/connect.js';
import * as issueCommand from './commands/issue.js';
import * as pageCommand from './commands/page.js';
import { GitHubHandler } from './handlers/github-handler.js';
import { 
  getThreadIssue, 
  saveMessageCommentMap,
  getMessageCommentMap,
  deleteMessageCommentMap
} from './database/queries.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const githubHandler = new GitHubHandler();

client.commands = new Collection();
client.commands.set(issueCommand.data.name, issueCommand);
client.commands.set(pageCommand.data.name, pageCommand);

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

// Discord 스레드 메시지를 GitHub 이슈에 동기화
client.on(Events.MessageCreate, async message => {
  try {
    // 봇 메시지는 무시
    if (message.author.bot) return;
    
    // 스레드 메시지만 처리
    if (!message.channel.isThread()) return;
    
    // 메시지 내용이 없으면 무시
    if (!message.content || message.content.trim() === '') return;
    
    // 해당 스레드의 GitHub 이슈 정보 조회
    const threadData = await getThreadIssue(message.channel.id);
    
    // 연동된 이슈가 없으면 무시
    if (!threadData || !threadData.issueNumber) return;
    
    // 이슈 상태 확인 (closed 이슈는 댓글 추가 안함)
    const issue = await githubHandler.getIssue(threadData.issueNumber);
    if (issue.state === 'closed') return;
    
    // GitHub 댓글 포맷: 닉네임: 내용
    const commentBody = `**${message.author.username}**: ${message.content}`;
    
    // GitHub 이슈에 댓글 추가
    const comment = await githubHandler.addComment(threadData.issueNumber, commentBody);

    // Discord 메시지와 GitHub 댓글 매핑 저장
    await saveMessageCommentMap({
      discordMessageId: message.id,
      discordThreadId: message.channel.id,
      discordUserId: message.author.id,
      discordUsername: message.author.username,
      issueNumber: threadData.issueNumber,
      commentId: comment.id,
    });
    
    console.log(`✅ 댓글 동기화됨: #${threadData.issueNumber} - ${message.author.username}`);
  } catch (error) {
    console.error('메시지 동기화 오류:', error.message);
    // 에러가 발생해도 Discord 메시지는 정상 전송되도록 함
  }
});

// Discord 메시지 삭제 → GitHub 댓글 삭제 동기화
client.on(Events.MessageDelete, async message => {
  try {
    // partial 메시지일 수도 있어서 ID만 사용
    const discordMessageId = message.id;
    if (!discordMessageId) return;

    // 매핑 조회
    const map = await getMessageCommentMap(discordMessageId);
    if (!map) return; // 매핑 없으면 무시

    // GitHub 댓글 삭제
    await githubHandler.deleteComment(map.commentId);

    // 매핑도 정리
    await deleteMessageCommentMap(discordMessageId);

    console.log(`🗑️ Discord 메시지 삭제 → GitHub 댓글 삭제 완료 (issue #${map.issueNumber}, comment ${map.commentId})`);
  } catch (error) {
    console.error('메시지 삭제 동기화 오류:', error.message);
  }
});

client.login(process.env.DISCORD_TOKEN);
