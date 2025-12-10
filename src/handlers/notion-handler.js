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
          '이름': {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          },
          '작업 상태': {
            status: {
              name: status // Assuming '준비' or similar is valid. status property uses 'status' not 'select' usually for Notion Status type, or 'select' for Select type. Debug said 'status'.
              // actually Notion API for Status property allows setting by name in 'status' field: { status: { name: "Done" } }
            }
          }
          // '우선순위': Skipped as property name unknown
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  text: {
                    content: description.substring(0, 2000)
                  }
                }
              ]
            }
          }
        ]
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
