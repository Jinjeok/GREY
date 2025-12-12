import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { NotionHandler } from '../handlers/notion-handler.js';
import {
  getThreadIssue,
  saveThreadIssue
} from '../database/queries.js';

const notionHandler = new NotionHandler();

export const data = new SlashCommandBuilder()
  .setName('페이지')
  .setDescription('Notion 페이지를 관리합니다')
  .addSubcommand(subcommand =>
    subcommand
      .setName('생성')
      .setDescription('현재 스레드에 Notion 페이지를 생성합니다')
      .addStringOption(option =>
        option
          .setName('제목')
          .setDescription('페이지 제목 (최대 256자) - 생략 시 스레드 제목 사용')
          .setRequired(false)
          .setMaxLength(256)
      )
      .addStringOption(option =>
        option
          .setName('설명')
          .setDescription('페이지 설명 (최대 2000자) - 생략 시 스레드 내용 사용')
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
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('종료')
      .setDescription('현재 스레드의 페이지 상태를 완료로 변경합니다')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('상태')
      .setDescription('현재 스레드의 페이지 상태를 조회합니다')
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
  if (existing && existing.pageId && existing.status === 'connected') {
    return interaction.reply({
      content: `❌ 이미 연동된 페이지가 있습니다.\n` +
               `종료하려면: /페이지 종료`,
      ephemeral: true
    });
  }
  
  await interaction.deferReply();

  let title = interaction.options.getString('제목');
  let description = interaction.options.getString('설명');
  const priority = interaction.options.getString('우선순위') || 'medium';

  // Fallback to thread info if missing
  if (!title || !description) {
    if (!title) title = interaction.channel.name;
    
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
  
  try {
    const page = await notionHandler.createPage(title, description, [], priority, '시작 전');
    
    let dbData = {
        threadId: interaction.channel.id,
        channelId: interaction.channel.parentId,
        guildId: interaction.guildId,
        pageId: page.id,
        status: 'connected',
        title, // Update title if new?
        description,
        priority,
        createdBy: interaction.user.id
    };

    if (existing) {
        // Merge with existing
        dbData = { 
           ...dbData, 
           issueNumber: existing.issueNumber, // Preserve GitHub link if exists
           metadata: { 
               ...existing.metadata, 
               pageUrl: `https://notion.so/${page.id.replace(/-/g, '')}` 
            } 
        };
    } else {
        dbData.metadata = { 
            pageUrl: `https://notion.so/${page.id.replace(/-/g, '')}`,
            threadUrl: interaction.channel.url
        };
    }

    await saveThreadIssue(dbData);
    
    // Update thread name if it's new? Or respect GitHub one?
    // Let's not touch thread name if GitHub issue exists as that usually has ID.
    if (!existing || !existing.issueNumber) {
        try {
            const newName = `[Page] ${title}`.substring(0, 100);
            await interaction.channel.setName(newName);
        } catch (e) {
            console.warn('스레드 이름 변경 실패:', e.message);
        }
    }

    // Try to add '페이지 생성됨' tag
    try {
        const parent = interaction.channel.parent;
        if (parent && parent.availableTags) {
            const tag = parent.availableTags.find(t => t.name === '페이지 생성됨');
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
      .setTitle('✅ Notion 페이지 생성 완료!')
      .setDescription(`**${title}**`)
      .addFields(
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
    console.error('Page 생성 오류:', error);
    await interaction.followUp({
      content: `❌ Page 생성 실패: ${error.message}`,
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
  if (!threadData || !threadData.pageId) {
    return interaction.reply({
      content: '❌ 연동된 페이지가 없습니다.\n' +
               `생성하려면: /페이지 생성`,
      ephemeral: true
    });
  }
  
  await interaction.deferReply();
  
  try {
    await notionHandler.updatePageProperty(threadData.pageId, {
      '작업 상태': { status: { name: '완료' } }
    });
    
    const embed = new EmbedBuilder()
      .setColor(0xdc3545)
      .setTitle('✅ Page 종료(완료) 처리!')
      .setDescription(`**${threadData.title}**`)
      .addFields(
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
    console.error('Page 종료 오류:', error);
    await interaction.followUp({
      content: `❌ Page 종료 실패: ${error.message}`,
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
  if (!threadData || !threadData.pageId) {
    return interaction.reply({
      content: '❌ 연동된 페이지가 없습니다.',
      ephemeral: true
    });
  }
  
  await interaction.deferReply();
  
  try {
    const page = await notionHandler.getPage(threadData.pageId);
    
    const embed = new EmbedBuilder()
      .setColor(0x0366d6)
      .setTitle(`📊 Notion Page 상태`)
      .addFields(
        {
          name: '📄 Notion Page',
          value: `**${page.properties['이름']?.title[0]?.text?.content || 'N/A'}**\n` +
                 `상태: ${page.properties['작업 상태']?.status?.name || 'N/A'}\n` +
                 `[링크](https://notion.so/${page.id.replace(/-/g, '')})`,
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
    console.error('Page 상태 조회 오류:', error);
    await interaction.followUp({
      content: `❌ 상태 조회 실패: ${error.message}`,
      ephemeral: true
    });
  }
}
