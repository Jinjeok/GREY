# Grey - Git & Record Extension Yielder

A Discord bot that integrates Discord Threads with GitHub Issues and Notion Pages using a 1:1:1 mapping strategy.

## Features

-   **Create Issue**: Creates a GitHub Issue and Notion Page from a Discord Thread.
-   **Sync Status**: Updates Discord Thread name with Issue ID.
-   **Close Issue**: Closes GitHub Issue, updates Notion Page status, and archives Discord Thread.
-   **View Status**: Shows real-time status of connected Issue and Page.

## Prerequisites

-   Node.js 20+
-   MongoDB (or Docker)
-   Discord Bot Token
-   GitHub Personal Access Token
-   Notion Integration Token

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord Bot Token |
| `DISCORD_CLIENT_ID` | Discord Application ID |
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `GITHUB_OWNER` | GitHub Username or Organization |
| `GITHUB_REPO` | Repository Name |
| `NOTION_TOKEN` | Notion Internal Integration Token |
| `NOTION_DATABASE_ID` | ID of the Notion Database |
| `MONGODB_URI` | MongoDB Connection String (e.g., `mongodb://localhost:27017/roundtable`) |

### 2. Token Permissions & Scopes

Following permissions are required for each token:

#### Discord Bot Token (`DISCORD_TOKEN`)
-   **Scopes**: `bot`, `applications.commands`
-   **Bot Permissions**: 
    -   `Send Messages`
    -   `Send Messages in Threads`
    -   `Create Public Threads`
    -   `Manage Threads` (Required for renaming and archiving threads)
    -   `View Channels`

#### GitHub Token (`GITHUB_TOKEN`)
-   **Type**: Personal Access Token (Classic)
-   **Scopes**: 
    -   `repo` (Full control of private repositories) - *Required for reading/writing Issues in private repos.*
    -   (Or `public_repo` if using only public repositories)

#### Notion Token (`NOTION_TOKEN`)
-   **Type**: Internal Integration Token
-   **Capabilities**:
    -   `Read content`
    -   `Update content`
    -   `Insert content`
-   **Important**: You must manually **connect** the target Database to the integration via the Notion UI (click `...` on the Database page -> `Connections` -> Add your integration).


### 2. Running Locally

Install dependencies:
```bash
npm install
```

Register Slash Commands:
```bash
npm run deploy
```

Start the Bot:
```bash
npm start
```

### 3. Running with Docker

You can run the Bot and MongoDB using Docker Compose.

```bash
docker-compose up -d --build
```

> **Note**: When running with Docker Compose, `MONGODB_URI` is automatically set to connect to the internal MongoDB container. You do not need to configure it in `.env`.

## Usage

### Create an Issue
Inside a Discord Thread:
```
/이슈 생성 제목:"버그 수정" 설명:"로그인 안됨" 우선순위:높음
```

### Check Status
```
/이슈 상태
```

### Close an Issue
```
/이슈 종료
```

## License
ISC

