import { ThreadIssue, MessageCommentMap } from './schema.js';

export async function getThreadIssue(threadId) {
  return await ThreadIssue.findOne({ threadId });
}

export async function saveThreadIssue(data) {
  // Upsert to handle potential race conditions or re-runs
  return await ThreadIssue.findOneAndUpdate(
    { threadId: data.threadId },
    { $set: data },
    { upsert: true, new: true }
  );
}

export async function closeThreadIssue(threadId) {
  return await ThreadIssue.findOneAndUpdate(
    { threadId },
    { 
      status: 'closed',
      closedAt: new Date()
    },
    { new: true }
  );
}

export async function updateThreadIssueStatus(threadId, status) {
  return await ThreadIssue.findOneAndUpdate(
    { threadId },
    { status },
    { new: true }
  );
}

// Discord 메시지 ↔ GitHub 댓글 매핑 저장
export async function saveMessageCommentMap({
  discordMessageId,
  discordThreadId,
  discordUserId,
  discordUsername,
  issueNumber,
  commentId,
}) {
  return await MessageCommentMap.findOneAndUpdate(
    { discordMessageId },
    {
      $set: {
        discordMessageId,
        discordThreadId,
        discordUserId,
        discordUsername,
        issueNumber,
        commentId,
      }
    },
    { upsert: true, new: true }
  );
}

// Discord 메시지 ID로 매핑 조회
export async function getMessageCommentMap(discordMessageId) {
  return await MessageCommentMap.findOne({ discordMessageId });
}

// 매핑 삭제 (옵션)
export async function deleteMessageCommentMap(discordMessageId) {
  return await MessageCommentMap.deleteOne({ discordMessageId });
}
