import { BaseCrud, DatabaseConnection } from './base';
import { AllMessagesPrivate, AllMessagesPrivateModel } from '../models/all-messages-private';

export class AllMessagesPrivateCrud extends BaseCrud<AllMessagesPrivate> {
  constructor(db: DatabaseConnection) {
    super(db, 'all_messages_private');
  }

  /**
   * Store a new message
   * @param messageData The message object to store (will be JSON stringified)
   * @param notes Optional notes
   */
  async storeMessage(
    messageData: any,
    notes?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const message_json = JSON.stringify(messageData);
      const data: AllMessagesPrivateModel = {
        message_json,
        notes: notes || null
      };
      
      return await this.create(data as Omit<AllMessagesPrivate, 'id'>);
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
      console.error('Error getting message by ID:', error);
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
      console.error('Error getting messages:', error);
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
      const result = await this.db.prepare(query).bind(limit, offset).all<AllMessagesPrivate>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error getting recent messages:', error);
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
      return await this.update(id, { notes } as Partial<Omit<AllMessagesPrivate, 'id'>>);
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
      const result = await this.db.prepare(query).bind(`%${searchTerm}%`, limit).all<AllMessagesPrivate>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error searching messages:', error);
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
      const result = await this.db.prepare(query).bind(startDate, endDate, limit).all<AllMessagesPrivate>();
      
      if (!result.success) return [];

      return result.results.map(result => ({
        id: result.id,
        message: JSON.parse(result.message_json),
        notes: result.notes,
        created_at: result.created_at
      }));
    } catch (error) {
      console.error('Error getting messages by date range:', error);
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
}
