import { Client } from '@notionhq/client';

export class NotionHandler {
  constructor() {
    this.client = new Client({
      auth: process.env.NOTION_TOKEN
    });
    this.databaseId = process.env.NOTION_DATABASE_ID;
  }

  async createPage(title, description, tags = [], priority = 'medium', status = '준비') {
    try {
      const response = await this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          '제목': {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          },
          '설명': {
            rich_text: [
              {
                text: {
                  content: description.substring(0, 2000)
                }
              }
            ]
          },
          '우선순위': {
            select: {
              name: priority === 'high' ? '높음' : priority === 'low' ? '낮음' : '중간'
            }
          },
          '상태': {
            select: {
              name: status
            }
          }
        }
      });
      return response;
    } catch (error) {
      console.error('Notion Create Page Error:', error);
      throw new Error('Failed to create Notion Page');
    }
  }

  async updatePageProperty(pageId, properties) {
    try {
      const response = await this.client.pages.update({
        page_id: pageId,
        properties: properties
      });
      return response;
    } catch (error) {
      console.error('Notion Update Page Error:', error);
      throw new Error('Failed to update Notion Page');
    }
  }

  async getPage(pageId) {
    try {
      const response = await this.client.pages.retrieve({
        page_id: pageId
      });
      return response;
    } catch (error) {
      console.error('Notion Get Page Error:', error);
      throw new Error('Failed to get Notion Page');
    }
  }
}
