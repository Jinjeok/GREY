import { Octokit } from '@octokit/rest';

export class GitHubHandler {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    this.owner = process.env.GITHUB_OWNER;
    this.repo = process.env.GITHUB_REPO;
  }

  async createIssue(title, body, labels = [], assignees = []) {
    try {
      const response = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels,
        assignees: assignees ? [assignees] : []
      });
      return response.data;
    } catch (error) {
      console.error('GitHub Create Issue Error:', error);
      throw new Error('Failed to create GitHub Issue');
    }
  }

  async closeIssue(issueNumber) {
    try {
      const response = await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed'
      });
      return response.data;
    } catch (error) {
      console.error('GitHub Close Issue Error:', error);
      throw new Error('Failed to close GitHub Issue');
    }
  }

  async getIssue(issueNumber) {
    try {
      const response = await this.octokit.rest.issues.get({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber
      });
      return response.data;
    } catch (error) {
      console.error('GitHub Get Issue Error:', error);
      throw new Error('Failed to get GitHub Issue');
    }
  }

  async addComment(issueNumber, body) {
    try {
      const response = await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body
      });
      return response.data;
    } catch (error) {
      console.error('GitHub Add Comment Error:', error);
      throw new Error('Failed to add comment to GitHub Issue');
    }
  }

  async deleteComment(commentId) {
    try {
      await this.octokit.rest.issues.deleteComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId
      });
      return true;
    } catch (error) {
      console.error('GitHub Delete Comment Error:', error);
      throw new Error('Failed to delete comment from GitHub Issue');
    }
  }
}
