import { ThreadIssue } from './schema.js';

export async function getThreadIssue(threadId) {
  return await ThreadIssue.findOne({ threadId });
}

export async function saveThreadIssue(data) {
  // Upsert to handle potential race conditions or re-runs, though typically creation is one-off
  return await ThreadIssue.findOneAndUpdate(
    { threadId: data.threadId },
    data,
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
