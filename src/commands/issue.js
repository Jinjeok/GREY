import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ThreadManager } from '../handlers/thread-manager.js';
import { GitHubHandler } from '../handlers/github-handler.js';
import { NotionHandler } from '../handlers/notion-handler.js';
import {
  getThreadIssue,
  saveThreadIssue,
  closeThreadIssue
} from '../database/queries.js';

// Initialize handlers
const githubHandler = new GitHubHandler();
const notionHandler = new NotionHandler();
const threadManager = new ThreadManager(githubHandler, notionHandler);

export const data = new SlashCommandBuilder()
  .setName('이슈')
  .setDescription('GitHub Issue와 Notion 페이지를 관리합니다')
  .addSubcommand(subcommand =>
    subcommand
      .setName('생성')
      .setDescription('현재 스레드에 GitHub Issue와 Notion 페이지를 생성합니다')
      .addStringOption(option =>
        option
          .setName('제목')
          .setDescription('이슈 제목 (최대 256자)')
          .setRequired(true)
          .setMaxLength(256)
      )
      .addStringOption(option =>
        option
          .setName('설명')
          .setDescription('이슈 설명 (최대 2000자)')
          .setMaxLength(2000)
      )
      .addStringOption(option =>
        option
          .setName('우선순위')
          .setDescription('우선순위 선택')
          .addChoices(
            { name: '높음', value: 'high' },
            { name: '중간', value: 'medium' },
            { name: '낮음', value: 'low' }
          )
      )
      .addStringOption(option =>
        option
          .setName('담당자')
          .setDescription('GitHub 사용자명')
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('종료')
      .setDescription('현재 스레드의 Issue를 종료합니다')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('상태')
      .setDescription('현재 스레드의 Issue 상태를 조회합니다')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  switch (subcommand) {
    case '생성':
      return await handleCreate(interaction);
    case '종료':
      return await handleClose(interaction);
    case '상태':
      return await handleStatus(interaction);
    default:
      return await interaction.reply('알 수 없는 명령어입니다');
  }
}

async function handleCreate(interaction) {
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  const existing = await getThreadIssue(interaction.channel.id);
  // Also check if already connected (could be in closed state, creating new one allowed if closed? 
  // Requirements say "Conditions: No existing issue connected". If status is 'closed', maybe allowed?
  // But let's follow the simple check: if existing and connected, block.
  if (existing && existing.status === 'connected') {
    return interaction.reply({
      content: `❌ 이미 Issue #${existing.issueNumber}이 연동되어 있습니다.\n` +
               `종료하려면: /이슈 종료`,
      ephemeral: true
    });
  }
  
  const title = interaction.options.getString('제목');
  const description = interaction.options.getString('설명') || '';
  const priority = interaction.options.getString('우선순위') || 'medium';
  const assignee = interaction.options.getString('담당자');
  
  await interaction.deferReply();
  
  try {
    const { issue, page } = await threadManager.createIssueAndPage({
        title, 
        description, 
        priority, 
        assignee
    });
    
    await saveThreadIssue({
      threadId: interaction.channel.id,
      channelId: interaction.channel.parentId,
      guildId: interaction.guildId,
      issueNumber: issue.number,
      pageId: page.id,
      status: 'connected',
      title,
      description,
      priority,
      createdBy: interaction.user.id,
      metadata: {
        issueUrl: issue.html_url,
        pageUrl: `https://notion.so/${page.id.replace(/-/g, '')}`,
        threadUrl: interaction.channel.url
      }
    });
    
    try {
      const newName = `[#${issue.number}] ${title}`.substring(0, 100);
      await interaction.channel.setName(newName);
    } catch (e) {
      console.warn('스레드 이름 변경 실패:', e.message);
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x28a745)
      .setTitle('✅ Issue 생성 완료!')
      .setDescription(`**[#${issue.number}] ${title}**`)
      .addFields(
        {
          name: '🔗 GitHub',
          value: `[#${issue.number}](${issue.html_url})`,
          inline: true
        },
        {
          name: '📄 Notion',
          value: `[페이지](https://notion.so/${page.id.replace(/-/g, '')})`,
          inline: true
        },
        {
          name: '🔴 우선순위',
          value: priority === 'high' ? '높음' : priority === 'low' ? '낮음' : '중간',
          inline: true
        }
      )
      .setFooter({
        text: `생성자: ${interaction.user.username}`,
        iconURL: interaction.user.avatarURL()
      })
      .setTimestamp();
    
    await interaction.followUp({ embeds: [embed] });
    
  } catch (error) {
    console.error('Issue 생성 오류:', error);
    await interaction.followUp({
      content: `❌ Issue 생성 실패: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleClose(interaction) {
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  const threadData = await getThreadIssue(interaction.channel.id);
  if (!threadData) {
    return interaction.reply({
      content: '❌ 연동된 Issue가 없습니다.\n' +
               `생성하려면: /이슈 생성`,
      ephemeral: true
    });
  }
  
  if (threadData.status === 'closed') {
    return interaction.reply({
      content: `❌ 이미 종료된 Issue입니다.`,
      ephemeral: true
    });
  }
  
  await interaction.deferReply();
  
  try {
    await threadManager.closeIssueAndPage({
        issueNumber: threadData.issueNumber,
        pageId: threadData.pageId
    });
    
    await closeThreadIssue(interaction.channel.id);
    
    try {
      await interaction.channel.setArchived(true);
    } catch (e) {
      console.warn('스레드 아카이브 실패:', e.message);
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xdc3545)
      .setTitle('✅ Issue 종료 완료!')
      .setDescription(`**[#${threadData.issueNumber}] ${threadData.title}**`)
      .addFields(
        {
          name: '🔗 GitHub',
          value: `[#${threadData.issueNumber}](${threadData.metadata.issueUrl}) Closed`,
          inline: true
        },
        {
          name: '📄 Notion',
          value: `Status: 완료`,
          inline: true
        }
      )
      .setFooter({
        text: `종료자: ${interaction.user.username}`,
        iconURL: interaction.user.avatarURL()
      })
      .setTimestamp();
    
    await interaction.followUp({ embeds: [embed] });
    
  } catch (error) {
    console.error('Issue 종료 오류:', error);
    await interaction.followUp({
      content: `❌ Issue 종료 실패: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleStatus(interaction) {
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  const threadData = await getThreadIssue(interaction.channel.id);
  if (!threadData) {
    return interaction.reply({
      content: '❌ 연동된 Issue가 없습니다.',
      ephemeral: true
    });
  }
  
  await interaction.deferReply();
  
  try {
    const issue = await githubHandler.getIssue(threadData.issueNumber);
    const page = await notionHandler.getPage(threadData.pageId);
    
    const embed = new EmbedBuilder()
      .setColor(0x0366d6)
      .setTitle(`📊 Issue 상태 조회`)
      .addFields(
        {
          name: '🔗 GitHub Issue',
          value: `**#${issue.number}** ${issue.title}\n` +
                 `상태: ${issue.state === 'open' ? '🟢 Open' : '🔴 Closed'}\n` +
                 `라벨: ${issue.labels.map(l => l.name).join(', ') || 'None'}\n` +
                 `[링크](${issue.html_url})`,
          inline: false
        },
        {
          name: '📄 Notion Page',
          value: `**${page.properties.제목?.title[0]?.text?.content || 'N/A'}**\n` +
                 `상태: ${page.properties.상태?.select?.name || 'N/A'}\n` +
                 `우선순위: ${page.properties.우선순위?.select?.name || 'N/A'}\n` +
                 `[링크](https://notion.so/${page.id.replace(/-/g, '')})`,
          inline: false
        },
        {
          name: '📌 스레드 정보',
          value: `생성자: <@${threadData.createdBy}>\n` +
                 `생성일: <t:${Math.floor(new Date(threadData.createdAt).getTime() / 1000)}:D>\n` +
                 `상태: ${threadData.status === 'connected' ? '✅ Connected' : '❌ Closed'}`,
          inline: false
        }
      )
      .setFooter({
        text: `조회자: ${interaction.user.username}`,
        iconURL: interaction.user.avatarURL()
      })
      .setTimestamp();
    
    await interaction.followUp({ embeds: [embed] });
    
  } catch (error) {
    console.error('Issue 상태 조회 오류:', error);
    await interaction.followUp({
      content: `❌ 상태 조회 실패: ${error.message}`,
      ephemeral: true
    });
  }
}
