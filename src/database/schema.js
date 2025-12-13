import mongoose from 'mongoose';

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
  
  // Linked Info
  issueNumber: {
    type: Number,
    index: true,
    sparse: true
  },
  pageId: {
    type: String,
    sparse: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['created', 'connected', 'closed', 'archived'],
    default: 'created',
    index: true
  },
  
  // Metadata
  title: String,
  description: String,
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  
  // User
  createdBy: String,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  closedAt: Date,
  
  // URLs
  metadata: {
    issueUrl: String,
    pageUrl: String,
    threadUrl: String
  }
}, { timestamps: true });

// Discord 메시지와 GitHub 댓글의 매핑
const messageCommentMapSchema = new mongoose.Schema({
  // Discord 메시지 정보
  discordMessageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  discordThreadId: {
    type: String,
    required: true,
    index: true
  },
  discordUserId: String,
  discordUsername: String,
  
  // GitHub 댓글 정보
  issueNumber: {
    type: Number,
    required: true,
    index: true
  },
  commentId: {
    type: Number,
    required: true,
    index: true
  },
  
  // 타임스탬프
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

export const ThreadIssue = mongoose.model('ThreadIssue', threadIssueSchema);
export const MessageCommentMap = mongoose.model('MessageCommentMap', messageCommentMapSchema);
