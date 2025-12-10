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

export const ThreadIssue = mongoose.model('ThreadIssue', threadIssueSchema);
