# Grey - Git & Record Extension Yielder

**문서 작성일**: 2025년 12월 10일  
**최종 수정일**: 2025년 12월 10일  
**버전**: 2.1 - 단일 명령어 구조  
**상태**: 개발 준비 완료 ✅

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [단일 명령어 아키텍처](#단일-명령어-아키텍처)
3. [기술 스택](#기술-스택)
4. [주요 기능](#주요-기능)
5. [API 명세](#api-명세)
6. [데이터베이스 설계](#데이터베이스-설계)
7. [구현 상세](#구현-상세)
8. [개발 일정](#개발-일정)

---

## 프로젝트 개요

### 1.1 핵심 개념: 1:1:1 매핑

```
1 Discord 스레드 = 1 GitHub Issue = 1 Notion 페이지
```

**단일 명령어 구조**:
```
/이슈 생성 title:"로그인" description:"OAuth"
/이슈 종료
```

### 1.2 스레드 생명주기

```
Discord 채널 (#개발)
│
├─ 스레드 생성 (사용자가 수동 생성)
│  └─ 초기 상태: "생성되지 않음" (issue metadata 없음)
│
├─ /이슈 생성
│  ├─ ✅ 조건: 아직 issue 연동이 없어야 함
│  ├─ 🔄 작업:
│  │  ├─ GitHub Issue 생성 (#123)
│  │  ├─ Notion 페이지 생성 (Database)
│  │  ├─ MongoDB 메타데이터 저장
│  │  └─ 스레드 이름 변경: "[#123] 로그인"
│  │
│  └─ 상태: "연동됨" (issueNumber, pageId 저장됨)
│
├─ 팀이 스레드에서 논의
│
└─ /이슈 종료
   ├─ ✅ 조건: issue 연동이 있어야 함
   ├─ 🔄 작업:
   │  ├─ GitHub Issue Close (#123)
   │  ├─ Notion 페이지 Status: "완료"로 변경
   │  ├─ MongoDB 상태 업데이트
   │  └─ 스레드 아카이브
   │
   └─ 상태: "종료됨"
```

### 1.3 사용 예시

**명령어 형식**:
```
/이슈 <subcommand> [options]
```

**예시 1: Issue 생성**
```
/이슈 생성 title:"로그인 기능" description:"OAuth 로그인 구현"
```

**예시 2: Issue 종료**
```
/이슈 종료
```

**예시 3: Issue 상태 조회**
```
/이슈 상태
```

---

## 단일 명령어 아키텍처

### 2.1 명령어 구조

```javascript
/이슈 (그룹 명령어)
├─ 생성 (subcommand)
│  ├─ title (필수): 이슈 제목
│  ├─ description (선택): 상세 설명
│  ├─ priority (선택): High/Medium/Low
│  └─ assignee (선택): GitHub 담당자
│
├─ 종료 (subcommand)
│  └─ (옵션 없음)
│
└─ 상태 (subcommand)
   └─ (옵션 없음)
```

### 2.2 명령어 정의 코드

```javascript
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
```

### 2.3 실행 흐름

```javascript
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
```

---

## 기술 스택

### 3.1 코어 기술

| 구분 | 기술 | 버전 |
|------|------|------|
| **런타임** | Node.js | 20+ |
| **Discord** | discord.js | 14+ |
| **GitHub** | @octokit/rest | 20.0.0 |
| **Notion** | @notionhq/client | 2.2.13 |
| **Database** | MongoDB + Mongoose | 6.3.0 + 8.0.0 |

---

## 주요 기능

### 4.1 `/이슈 생성` (subcommand)

#### 요구사항

- **사용 위치**: Discord 스레드 내부에서만 사용 가능
- **전제조건**: 현재 스레드에 연동된 Issue가 없어야 함
- **실패 케이스**:
  - ❌ 스레드가 아닌 일반 채널에서 사용
  - ❌ 이미 Issue가 연동되어 있음 (이중 생성 방지)
  - ❌ 제목이 비어있음
  - ❌ GitHub API 오류

#### 자동 동작 흐름

```
1️⃣ 검증
   ├─ 스레드 여부 확인
   ├─ 기존 Issue 연동 여부 확인 (DB 조회)
   └─ 제목 길이 검증

2️⃣ 생성 (병렬 처리)
   ├─ GitHub Issue 생성
   ├─ Notion Page 생성
   └─ MongoDB 저장

3️⃣ 업데이트
   ├─ Discord 스레드 이름 변경: "[#123] 로그인 기능"
   └─ Embed 응답 전송

4️⃣ 상태
   status: "connected"
   issueNumber: 123
   pageId: "abc..."
```

#### 응답 예시

```
✅ Issue 생성 완료!

[#123] 로그인 기능
────────────────────
🔗 GitHub: https://github.com/owner/repo/issues/123
📄 Notion: https://notion.so/abc...
🔴 우선순위: 높음

생성자: @username | 2025-12-10
```

### 4.2 `/이슈 종료` (subcommand)

#### 요구사항

- **사용 위치**: Discord 스레드 내부에서만 사용 가능
- **전제조건**: 현재 스레드에 연동된 Issue가 있어야 함
- **실패 케이스**:
  - ❌ 스레드가 아닌 일반 채널에서 사용
  - ❌ 연동된 Issue가 없음
  - ❌ 이미 종료된 Issue
  - ❌ GitHub API 오류

#### 자동 동작 흐름

```
1️⃣ 검증
   ├─ 스레드 여부 확인
   ├─ 연동된 Issue 조회 (DB에서)
   └─ 이미 종료되었는지 확인

2️⃣ 종료 (병렬 처리)
   ├─ GitHub Issue Close (#123)
   ├─ Notion Page Status: "완료" 변경
   └─ MongoDB 상태 업데이트

3️⃣ 정리
   ├─ 스레드 아카이브 (선택사항)
   └─ Embed 응답 전송

4️⃣ 상태
   status: "closed"
   closedAt: timestamp
```

#### 응답 예시

```
✅ Issue 종료 완료!

[#123] 로그인 기능
────────────────────
🔗 GitHub: #123 Closed
📄 Notion: Status 변경 → 완료

종료자: @username | 2025-12-10
```

### 4.3 `/이슈 상태` (subcommand)

#### 기능

현재 스레드와 연동된 Issue/Page의 실시간 상태 조회

#### 응답 예시

```
📊 현재 Issue 상태

🔗 GitHub Issue
  ID: #123
  제목: 로그인 기능
  상태: Open ✅
  라벨: feature, priority-high
  담당자: @devname
  생성: 2025-12-10
  URL: https://github.com/...

📄 Notion Page
  제목: 로그인 기능
  상태: 준비
  우선순위: 높음
  담당자: @devname
  생성: 2025-12-10
  URL: https://notion.so/...

─────────────────────
스레드 상태: Connected
생성자: @username
```

---

## API 명세

### 5.1 Subcommand Handler: 생성

```javascript
async function handleCreate(interaction) {
  // ✅ 1단계: 검증
  
  // 스레드 확인
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  // 기존 Issue 확인 (중복 생성 방지)
  const existing = await getThreadIssue(interaction.channel.id);
  if (existing && existing.status === 'connected') {
    return interaction.reply({
      content: `❌ 이미 Issue #${existing.issueNumber}이 연동되어 있습니다.\n` +
               `종료하려면: /이슈 종료`,
      ephemeral: true
    });
  }
  
  // ✅ 2단계: 입력값 수집
  const title = interaction.options.getString('제목');
  const description = interaction.options.getString('설명') || '';
  const priority = interaction.options.getString('우선순위') || 'medium';
  const assignee = interaction.options.getString('담당자');
  
  await interaction.deferReply();
  
  try {
    // ✅ 3단계: 병렬 생성
    const [issue, page] = await Promise.all([
      githubHandler.createIssue(title, description, [], assignee),
      notionHandler.createPage(title, description, [], priority, '준비')
    ]);
    
    // ✅ 4단계: Database 저장
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
    
    // ✅ 5단계: 스레드 이름 업데이트
    try {
      const newName = `[#${issue.number}] ${title}`.substring(0, 100);
      await interaction.channel.setName(newName);
    } catch (e) {
      console.warn('스레드 이름 변경 실패:', e.message);
    }
    
    // ✅ 6단계: 응답
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
```

### 5.2 Subcommand Handler: 종료

```javascript
async function handleClose(interaction) {
  // ✅ 1단계: 검증
  
  // 스레드 확인
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  // 연동된 Issue 조회
  const threadData = await getThreadIssue(interaction.channel.id);
  if (!threadData) {
    return interaction.reply({
      content: '❌ 연동된 Issue가 없습니다.\n' +
               `생성하려면: /이슈 생성`,
      ephemeral: true
    });
  }
  
  // 이미 종료되었는지 확인
  if (threadData.status === 'closed') {
    return interaction.reply({
      content: `❌ 이미 종료된 Issue입니다.`,
      ephemeral: true
    });
  }
  
  await interaction.deferReply();
  
  try {
    // ✅ 2단계: 병렬 종료
    await Promise.all([
      githubHandler.closeIssue(threadData.issueNumber),
      notionHandler.updatePageProperty(threadData.pageId, {
        상태: { select: { name: '완료' } }
      })
    ]);
    
    // ✅ 3단계: Database 업데이트
    await closeThreadIssue(interaction.channel.id);
    
    // ✅ 4단계: 스레드 아카이브
    try {
      await interaction.channel.setArchived(true);
    } catch (e) {
      console.warn('스레드 아카이브 실패:', e.message);
    }
    
    // ✅ 5단계: 응답
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
```

### 5.3 Subcommand Handler: 상태

```javascript
async function handleStatus(interaction) {
  // ✅ 1단계: 검증
  
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  // 연동된 Issue 조회
  const threadData = await getThreadIssue(interaction.channel.id);
  if (!threadData) {
    return interaction.reply({
      content: '❌ 연동된 Issue가 없습니다.',
      ephemeral: true
    });
  }
  
  await interaction.deferReply();
  
  try {
    // ✅ 2단계: 실시간 데이터 조회
    const issue = await githubHandler.getIssue(threadData.issueNumber);
    const page = await notionHandler.getPage(threadData.pageId);
    
    // ✅ 3단계: Embed 생성
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
```

---

## 데이터베이스 설계

### 6.1 ThreadIssue Schema

```javascript
const threadIssueSchema = new mongoose.Schema({
  // Discord
  threadId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  channelId: String,
  guildId: String,
  
  // 연동 정보 (🔑 중요: 생성 후에만 채워짐)
  issueNumber: {
    type: Number,
    index: true,
    sparse: true  // null 허용 (생성 전)
  },
  pageId: {
    type: String,
    sparse: true  // null 허용 (생성 전)
  },
  
  // 상태
  status: {
    type: String,
    enum: ['created', 'connected', 'closed', 'archived'],
    default: 'created',
    index: true
  },
  
  // 메타데이터
  title: String,
  description: String,
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  
  // 사용자
  createdBy: String,
  
  // 타임스탬프
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  closedAt: Date,
  
  // 메타데이터
  metadata: {
    issueUrl: String,
    pageUrl: String,
    threadUrl: String
  }
}, { timestamps: true });
```

### 6.2 중요: 생성 전후의 상태

```javascript
// ❌ 생성 전 (스레드만 생성됨, /이슈 생성 미실행)
{
  threadId: "123",
  channelId: "456",
  guildId: "789",
  issueNumber: null,     // 아직 없음
  pageId: null,          // 아직 없음
  status: "created",     // 초기 상태
  createdBy: "user1",
  // ...
}

// ✅ 생성 후 (/이슈 생성 실행됨)
{
  threadId: "123",
  channelId: "456",
  guildId: "789",
  issueNumber: 456,      // GitHub Issue #456
  pageId: "abc-def-...",  // Notion Page
  status: "connected",   // 연동됨
  createdBy: "user1",
  metadata: {
    issueUrl: "https://github.com/...",
    pageUrl: "https://notion.so/..."
  }
  // ...
}

// ❌ 종료 후 (/이슈 종료 실행됨)
{
  // ... (위와 동일)
  status: "closed",      // 종료됨
  closedAt: timestamp,   // 종료 시간 기록
  // ...
}
```

---

## 구현 상세

### 7.1 명령어 파일 구조

```
src/commands/
└── issue.js                    # 단일 명령어 파일
    ├─ data (명령어 정의)
    │  ├─ addSubcommand('생성', ...)
    │  ├─ addSubcommand('종료', ...)
    │  └─ addSubcommand('상태', ...)
    │
    └─ execute(interaction)
       ├─ handleCreate(interaction)
       ├─ handleClose(interaction)
       └─ handleStatus(interaction)
```

### 7.2 완전한 명령어 구현

```javascript
// src/commands/issue.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ThreadManager } from '../handlers/thread-manager.js';
import {
  getThreadIssue,
  saveThreadIssue,
  closeThreadIssue
} from '../database/queries.js';

const threadManager = new ThreadManager(
  githubHandler,
  notionHandler
);

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
  }
}

// 🟢 생성
async function handleCreate(interaction) {
  // 스레드 확인
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  // 중복 생성 방지
  const existing = await getThreadIssue(interaction.channel.id);
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
    // 병렬 생성
    const result = await threadManager.createThreadIssue(interaction.channel, {
      title,
      description,
      priority,
      assignee
    });
    
    // DB 저장
    await saveThreadIssue({
      threadId: interaction.channel.id,
      channelId: interaction.channel.parentId,
      guildId: interaction.guildId,
      issueNumber: result.issueNumber,
      pageId: result.pageId,
      status: 'connected',
      title,
      description,
      priority,
      createdBy: interaction.user.id,
      metadata: {
        issueUrl: result.issueUrl,
        pageUrl: result.pageUrl,
        threadUrl: interaction.channel.url
      }
    });
    
    // 응답
    const embed = new EmbedBuilder()
      .setColor(0x28a745)
      .setTitle('✅ Issue 생성 완료!')
      .setDescription(`**[#${result.issueNumber}] ${title}**`)
      .addFields(
        {
          name: '🔗 GitHub',
          value: `[#${result.issueNumber}](${result.issueUrl})`,
          inline: true
        },
        {
          name: '📄 Notion',
          value: `[페이지](${result.pageUrl})`,
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

// 🔴 종료
async function handleClose(interaction) {
  // 스레드 확인
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  // Issue 조회
  const threadData = await getThreadIssue(interaction.channel.id);
  if (!threadData) {
    return interaction.reply({
      content: '❌ 연동된 Issue가 없습니다.',
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
    // 병렬 종료
    await threadManager.closeThreadIssue(interaction.channel);
    
    // DB 업데이트
    await closeThreadIssue(interaction.channel.id);
    
    // 스레드 아카이브
    try {
      await interaction.channel.setArchived(true);
    } catch (e) {
      console.warn('스레드 아카이브 실패:', e.message);
    }
    
    // 응답
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

// 📊 상태
async function handleStatus(interaction) {
  // 스레드 확인
  if (!interaction.channel.isThread()) {
    return interaction.reply({
      content: '❌ 이 명령어는 스레드 내에서만 사용할 수 있습니다.',
      ephemeral: true
    });
  }
  
  // Issue 조회
  const threadData = await getThreadIssue(interaction.channel.id);
  if (!threadData || threadData.status === 'created') {
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
          value: `**${threadData.title}**\n` +
                 `상태: ${threadData.priority}\n` +
                 `[링크](${threadData.metadata.pageUrl})`,
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
```

---

## 개발 일정

### Phase 1: 핵심 기능 (2주)

| 작업 | 예상 시간 |
|------|---------|
| MongoDB 설정 | 2h |
| ThreadIssue 모델 | 2h |
| `/이슈 생성` 구현 | 3h |
| `/이슈 종료` 구현 | 2h |
| `/이슈 상태` 구현 | 2h |
| 로컬 테스트 | 4h |

### Phase 2: 강화 (1주)

| 작업 | 예상 시간 |
|------|---------|
| 에러 핸들링 | 2h |
| 권한 관리 | 2h |
| 로깅 시스템 | 2h |
| 통합 테스트 | 3h |

### Phase 3: 배포 (1주)

| 작업 | 예상 시간 |
|------|---------|
| Railway 배포 | 3h |
| 모니터링 | 2h |
| 문서 작성 | 2h |

---

## 환경 변수

```env
# Discord
DISCORD_TOKEN=your_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

# GitHub
GITHUB_TOKEN=your_token
GITHUB_REPO=owner/repo

# Notion
NOTION_TOKEN=your_token
NOTION_DATABASE_ID=your_db_id

# MongoDB
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/roundtable

# Node
NODE_ENV=development
```

---

## 에러 케이스 및 방어

### `/이슈 생성` 시 에러

| 상황 | 에러 메시지 | 해결 방법 |
|------|-----------|---------|
| 스레드 아님 | ❌ 스레드 내에서만 사용 가능 | 스레드 생성 후 사용 |
| 이미 Issue 있음 | ❌ Issue #123이 이미 연동됨 | `/이슈 종료` 후 재시도 |
| 제목 비어있음 | ❌ 제목은 필수입니다 | 제목 입력 |
| GitHub API 실패 | ❌ GitHub API 오류: ... | 토큰 확인 |
| Notion API 실패 | ❌ Notion API 오류: ... | 토큰 & Database ID 확인 |

### `/이슈 종료` 시 에러

| 상황 | 에러 메시지 | 해결 방법 |
|------|-----------|---------|
| 스레드 아님 | ❌ 스레드 내에서만 사용 가능 | 스레드 생성 후 사용 |
| Issue 없음 | ❌ 연동된 Issue가 없습니다 | `/이슈 생성` 먼저 실행 |
| 이미 종료됨 | ❌ 이미 종료된 Issue입니다 | 다시 생성하거나 상태 확인 |

---

## 매핑 정리

```
1개의 Discord 스레드
    ↓
    ├─ 초기: 아무것도 연동 안 됨 (status: created)
    │
    ├─ /이슈 생성 실행 시:
    │  ├─ 1개의 GitHub Issue 생성 (#123)
    │  ├─ 1개의 Notion Page 생성
    │  └─ MongoDB에 연결 정보 저장
    │
    └─ /이슈 종료 실행 시:
       ├─ GitHub Issue #123 Close
       ├─ Notion Page Status: 완료
       └─ 스레드 아카이브

결과:
✅ 1 스레드 = 1 GitHub Issue = 1 Notion Page (데이터베이스)
```

---

**문서 작성자**: Project Round Table 개발팀  
**버전**: 2.1 (단일 명령어 구조)  
**상태**: 개발 준비 완료 ✅