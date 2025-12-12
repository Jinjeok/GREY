import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GitHubHandler } from '../handlers/github-handler.js';
import {
  getThreadIssue,
  saveThreadIssue,
  updateThreadIssueStatus
} from '../database/queries.js';

const githubHandler = new GitHubHandler();

export const data = new SlashCommandBuilder()
  .setName('이슈')
  .setDescription('GitHub Issue를 관리합니다')
  .addSubcommand(subcommand =>
    subcommand
      .setName('생성')
      .setDescription('현재 스레드에 GitHub Issue를 생성합니다')
      .addStringOption(option =>
        option
          .setName('제목')
          .setDescription('이슈 제목 (최대 256자) - 생략 시 스레드 제목 사용')
          .setRequired(false)
          .setMaxLength(256)
      )
      .addStringOption(option =>
        option
          .setName('설명')
          .setDescription('이슈 설명 (최대 2000자) - 생략 시 스레드 내용 사용')
          .setMaxLength(2000)
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
  // Allow if existing is closed? Or strictly one per thread?
  // Assuming one active issue per thread.
  if (existing && existing.issueNumber && existing.status === 'connected') {
    return interaction.reply({
      content: `❌ 이미 Issue #${existing.issueNumber}이 연동되어 있습니다.\n` +
               `종료하려면: /이슈 종료`,
      ephemeral: true
    });
  }
  
  await interaction.deferReply();

  let title = interaction.options.getString('제목');
  let description = interaction.options.getString('설명');
  const assignee = interaction.options.getString('담당자');

  // If title/description not provided, fetch from thread
  if (!title || !description) {
    if (!title) title = interaction.channel.name;
    
    // Clean up title if it already has issue tag (though unlikely if new issue)
    // But maybe user is running command on a renamed thread?
    // Regex to remove existing tags like [#123] or [Page] if needed, but 
    // user said "keep adding [#1]", so we probably take the raw name
    // and let the new tag be prepended.
    
    if (!description) {
      try {
        const starterMsg = await interaction.channel.fetchStarterMessage().catch(() => null);
        if (starterMsg && starterMsg.content) {
          description = starterMsg.content;
        } else {
             // Fallback: fetch recent messages
             console.log('Fetching starter message failed, trying fallback...');
             const messages = await interaction.channel.messages.fetch({ limit: 10 });
             const firstMsg = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp).first();
             if (firstMsg && firstMsg.content) {
                 description = firstMsg.content;
             } else {
                 description = 'No description provided.';
             }
        }
      } catch (e) {
        console.warn('Description fetch failed:', e);
        description = 'No description provided.';
      }
    }
  }
  
  // Truncate if necessary (Discord limits vs GitHub limits)
  // GitHub title max ?? (usually ample), description ample.
  
  try {
    const issue = await githubHandler.createIssue(title, description, [], assignee);
    
    // We need to merge with existing if page exists, or create new
    // If existing exists (e.g. from page command), we update it.
    
    let dbData = {
        threadId: interaction.channel.id,
        channelId: interaction.channel.parentId,
        guildId: interaction.guildId,
        issueNumber: issue.number,
        status: 'connected',
        title, // Update title/desc to match issue? Or keep original?
        description,
        createdBy: interaction.user.id,
        // metadata merge handled potentially by saveThreadIssue or manual merge here
    };

    if (existing) {
        dbData = { ...dbData, metadata: { ...existing.metadata, issueUrl: issue.html_url } };
    } else {
        dbData.metadata = { issueUrl: issue.html_url, threadUrl: interaction.channel.url };
    }
    
    await saveThreadIssue(dbData);
    
    // Try update thread name
    try {
      // Remove any existing tags to avoid stacking? 
      // User said "keep adding [#1]". 
      // If thread is named "Bug Report", it becomes "[#1] Bug Report".
      // If it's already "[#1] Bug Report", we probably shouldn't add it again if it matched?
      // But this is a *new* issue.
      
      const newName = `[#${issue.number}] ${title}`.substring(0, 100);
      await interaction.channel.setName(newName);
    } catch (e) {
      console.warn('스레드 이름 변경 실패:', e.message);
    }

    // Try to add '이슈 생성됨' tag
    try {
        const parent = interaction.channel.parent;
        if (parent && parent.availableTags) {
            const tag = parent.availableTags.find(t => t.name === '이슈 생성됨');
            if (tag) {
                // Combine with existing tags
                const currentTags = interaction.channel.appliedTags || [];
                if (!currentTags.includes(tag.id)) {
                    await interaction.channel.setAppliedTags([...currentTags, tag.id]);
                }
            }
        }
    } catch (e) {
        console.warn('태그 추가 실패:', e.message);
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x28a745)
      .setTitle('✅ GitHub Issue 생성 완료!')
      .setDescription(`**[#${issue.number}] ${title}**`)
      .addFields(
        {
          name: '🔗 GitHub',
          value: `[#${issue.number}](${issue.html_url})`,
          inline: true
        },
        {
            name: '상태',
            value: issue.state,
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
  if (!threadData || !threadData.issueNumber) {
    return interaction.reply({
      content: '❌ 연동된 Issue가 없습니다.\n' +
               `생성하려면: /이슈 생성`,
      ephemeral: true
    });
  }
  
  // If we close issue, do we close the whole thread? 
  // Maybe only if page is also invalid? 
  // For now let's just close the GitHub issue.
    
  await interaction.deferReply();
  
  try {
    await githubHandler.closeIssue(threadData.issueNumber);
    
    // Update DB status only if this was the main thing? 
    // If we have page, maybe we shouldn't close the whole thread status?
    // But specific requirement said "/이슈 생성 is github only".
    // "Close" typically closes the issue.
    
    // Let's NOT archive the thread automatically if there might be a page.
    // Or just simple logic: Close issue.
    
    const embed = new EmbedBuilder()
      .setColor(0xdc3545)
      .setTitle('✅ Issue 종료 완료!')
      .setDescription(`**[#${threadData.issueNumber}] ${threadData.title}**`)
      .addFields(
        {
          name: '🔗 GitHub',
          value: `[#${threadData.issueNumber}](${threadData.metadata?.issueUrl || ''}) Closed`,
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
  if (!threadData || !threadData.issueNumber) {
    return interaction.reply({
      content: '❌ 연동된 Issue가 없습니다.',
      ephemeral: true
    });
  }
  
  await interaction.deferReply();
  
  try {
    const issue = await githubHandler.getIssue(threadData.issueNumber);
    
    const embed = new EmbedBuilder()
      .setColor(0x0366d6)
      .setTitle(`📊 GitHub Issue 상태`)
      .addFields(
        {
          name: '🔗 GitHub Issue',
          value: `**#${issue.number}** ${issue.title}\n` +
                 `상태: ${issue.state === 'open' ? '🟢 Open' : '🔴 Closed'}\n` +
                 `라벨: ${issue.labels.map(l => l.name).join(', ') || 'None'}\n` +
                 `[링크](${issue.html_url})`,
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
