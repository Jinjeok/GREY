
export class ThreadManager {
  constructor(githubHandler, notionHandler) {
    this.github = githubHandler;
    this.notion = notionHandler;
  }

  // This class can hold shared logic or simply be a container.
  // The command handler will likely use the handlers directly or via this manager.
  // For now, I'll keep it simple as a pass-through or context holder if needed.
  // The blueprint had this usage: const threadManager = new ThreadManager(githubHandler, notionHandler);
  // but mostly used handlers directly in the example code, or maybe it implies the manager does the "Parallel Create" logic?
  // I will implement the parallel creation here to clean up the command file.

  // createIssueAndPage logic removed as commands are now split.
  // This class can effectively be deprecated or used for other shared logic.


  async closeIssueAndPage({ issueNumber, pageId }) {
    await Promise.all([
      this.github.closeIssue(issueNumber),
      this.notion.updatePageProperty(pageId, {
        '상태': { select: { name: '완료' } }
      })
    ]);
  }
}
