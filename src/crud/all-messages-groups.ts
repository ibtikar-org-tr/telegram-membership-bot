import { BaseCrud, DatabaseConnection } from './base';
import { AllMessagesGroups, AllMessagesGroupsModel } from '../models/all-messages-groups';

export class AllMessagesGroupsCrud extends BaseCrud<AllMessagesGroups> {
  constructor(db: DatabaseConnection) {
    super(db, 'all_messages_groups');
  }

  /**
   * Store a new group message
   * @param messageData The message object to store (will be JSON stringified)
   * @param notes Optional notes
   */
  async storeMessage(
    messageData: any,
    notes?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const message_json = JSON.stringify(messageData);
      const data: AllMessagesGroupsModel = {
        message_json,
        notes: notes || null
      };
      
      return await this.create(data as Omit<AllMessagesGroups, 'id'>);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get a message by ID and parse the JSON
   * @param id Message ID
   */
  async getMessageById(id: string): Promise<{ 
    id: string;
    message: any;
    notes: string | null;
    created_at: string;
  } | null> {
    try {
      const result = await this.getById(id);
      if (!result) return null;

      return {
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      };
    } catch (error) {
      console.error('Error getting group message by ID:', error);
      return null;
    }
  }

  /**
   * Get messages with pagination and parse JSON
   * @param limit Number of messages to retrieve
   * @param offset Offset for pagination
   */
  async getMessages(limit?: number, offset?: number): Promise<Array<{
    id: string;
    message: any;
    notes: string | null;
    created_at: string;
  }>> {
    try {
      const results = await this.getAll(limit, offset);
      
      return results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error getting group messages:', error);
      return [];
    }
  }

  /**
   * Get messages ordered by creation date (newest first)
   * @param limit Number of messages to retrieve
   * @param offset Offset for pagination
   */
  async getRecentMessages(limit: number = 50, offset: number = 0): Promise<Array<{
    id: string;
    message: any;
    notes: string | null;
    created_at: string;
  }>> {
    try {
      const query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      const result = await this.db.prepare(query).bind(limit, offset).all<AllMessagesGroups>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error getting recent group messages:', error);
      return [];
    }
  }

  /**
   * Update notes for a message
   * @param id Message ID
   * @param notes New notes
   */
  async updateNotes(id: string, notes: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.update(id, { notes } as Partial<Omit<AllMessagesGroups, 'id'>>);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search messages by content (basic text search in JSON)
   * Note: This is a simple LIKE search, may not be efficient for large datasets
   * @param searchTerm Search term
   * @param limit Number of results to return
   */
  async searchMessages(searchTerm: string, limit: number = 50): Promise<Array<{
    id: string;
    message: any;
    notes: string | null;
    created_at: string;
  }>> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE message_json LIKE ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      const result = await this.db.prepare(query).bind(`%${searchTerm}%`, limit).all<AllMessagesGroups>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error searching group messages:', error);
      return [];
    }
  }

  /**
   * Get messages within a date range
   * @param startDate Start date (ISO string or datetime)
   * @param endDate End date (ISO string or datetime)
   */
  async getMessagesByDateRange(
    startDate: string,
    endDate: string,
    limit: number = 100
  ): Promise<Array<{
    id: string;
    message: any;
    notes: string | null;
    created_at: string;
  }>> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE created_at BETWEEN ? AND ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      const result = await this.db.prepare(query).bind(startDate, endDate, limit).all<AllMessagesGroups>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error getting group messages by date range:', error);
      return [];
    }
  }

  /**
   * Delete old messages (older than specified days)
   * @param days Number of days to keep
   */
  async deleteOldMessages(days: number): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const query = `
        DELETE FROM ${this.tableName} 
        WHERE created_at < datetime('now', '-${days} days')
      `;
      const result = await this.db.prepare(query).bind().run();
      
      return {
        success: result.success,
        deletedCount: result.meta?.changes,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get today's messages for a specific group (by chat_id)
   * @param chatId The group's chat ID
   * @param limit Maximum number of messages to retrieve
   */
  async getTodaysMessagesForGroup(
    chatId: number,
    limit: number = 100
  ): Promise<Array<{
    id: string;
    message: any;
    notes: string | null;
    created_at: string;
  }>> {
    try {
      // Get messages from today where the chat.id matches the chatId
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE DATE(created_at) = DATE('now')
        AND json_extract(message_json, '$.chat.id') = ?
        ORDER BY created_at ASC 
        LIMIT ?
      `;
      const result = await this.db.prepare(query).bind(chatId, limit).all<AllMessagesGroups>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error getting today\'s messages for group:', error);
      return [];
    }
  }

  /**
   * Get messages from a specific user in a group
   * @param chatId The group's chat ID
   * @param userId The user's telegram ID
   * @param limit Maximum number of messages to retrieve
   */
  async getMessagesFromUserInGroup(
    chatId: number,
    userId: number,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    message: any;
    notes: string | null;
    created_at: string;
  }>> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE json_extract(message_json, '$.chat.id') = ?
        AND json_extract(message_json, '$.from.id') = ?
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      const result = await this.db.prepare(query).bind(chatId, userId, limit).all<AllMessagesGroups>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error getting messages from user in group:', error);
      return [];
    }
  }

  /**
   * Get today's conversation for a specific group
   * Returns in chronological order
   * @param chatId The group's chat ID
   * @param limit Maximum number of messages to retrieve
   */
  async getTodaysGroupConversation(
    chatId: number,
    limit: number = 200
  ): Promise<Array<{
    user_id: number;
    user_name: string;
    content: string;
    created_at: string;
  }>> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE DATE(created_at) = DATE('now')
        AND json_extract(message_json, '$.chat.id') = ?
        ORDER BY created_at ASC 
        LIMIT ?
      `;
      const result = await this.db.prepare(query).bind(chatId, limit).all<AllMessagesGroups>();
      
      if (!result.success) return [];

      return result.results
        .map(result => {
          const message = JSON.parse(result.message_json);
          const text = message.text;
          const from = message.from;
          
          if (!text || !from) return null;
          
          return {
            user_id: from.id,
            user_name: from.first_name + (from.last_name ? ' ' + from.last_name : ''),
            content: text,
            created_at: result.created_at
          };
        })
        .filter((msg): msg is NonNullable<typeof msg> => msg !== null);
    } catch (error) {
      console.error('Error getting today\'s group conversation:', error);
      return [];
    }
  }

  /**
   * Get all unique groups that have sent messages
   * @param limit Maximum number of groups to retrieve
   */
  async getActiveGroups(limit: number = 50): Promise<Array<{
    chat_id: number;
    chat_title: string;
    message_count: number;
    last_message_at: string;
  }>> {
    try {
      const query = `
        SELECT 
          json_extract(message_json, '$.chat.id') as chat_id,
          json_extract(message_json, '$.chat.title') as chat_title,
          COUNT(*) as message_count,
          MAX(created_at) as last_message_at
        FROM ${this.tableName}
        GROUP BY chat_id
        ORDER BY last_message_at DESC
        LIMIT ?
      `;
      const result = await this.db.prepare(query).bind(limit).all<{
        chat_id: number;
        chat_title: string;
        message_count: number;
        last_message_at: string;
      }>();
      
      if (!result.success) return [];

      return result.results;
    } catch (error) {
      console.error('Error getting active groups:', error);
      return [];
    }
  }

  /**
   * Get message statistics for a specific group
   * @param chatId The group's chat ID
   */
  async getGroupStatistics(chatId: number): Promise<{
    total_messages: number;
    unique_users: number;
    first_message_at: string | null;
    last_message_at: string | null;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT json_extract(message_json, '$.from.id')) as unique_users,
          MIN(created_at) as first_message_at,
          MAX(created_at) as last_message_at
        FROM ${this.tableName}
        WHERE json_extract(message_json, '$.chat.id') = ?
      `;
      const result = await this.db.prepare(query).bind(chatId).first<{
        total_messages: number;
        unique_users: number;
        first_message_at: string | null;
        last_message_at: string | null;
      }>();
      
      return result || {
        total_messages: 0,
        unique_users: 0,
        first_message_at: null,
        last_message_at: null
      };
    } catch (error) {
      console.error('Error getting group statistics:', error);
      return {
        total_messages: 0,
        unique_users: 0,
        first_message_at: null,
        last_message_at: null
      };
    }
  }
}
