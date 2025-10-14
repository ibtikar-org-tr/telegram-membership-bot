import { BaseCrud, DatabaseConnection } from '../base';
import { Sheet, TaskSheetModel } from '../../models/task-follower/sheet';

export class SheetCrud extends BaseCrud<Sheet> {
  constructor(db: DatabaseConnection) {
    super(db, TaskSheetModel.tableName);
  }

  // Get sheet by sheetID
  async getBySheetId(sheetId: string): Promise<Sheet | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE sheetID = ?`;
      const result = await this.db.prepare(query).bind(sheetId).first<Sheet>();
      return result;
    } catch (error) {
      console.error('Error getting sheet by sheetID:', error);
      return null;
    }
  }

  // Get sheet by name
  async getBySheetName(sheetName: string): Promise<Sheet | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE sheetName = ?`;
      const result = await this.db.prepare(query).bind(sheetName).first<Sheet>();
      return result;
    } catch (error) {
      console.error('Error getting sheet by name:', error);
      return null;
    }
  }

  // Check if sheetID exists
  async sheetIdExists(sheetId: string): Promise<boolean> {
    try {
      const query = `SELECT 1 FROM ${this.tableName} WHERE sheetID = ? LIMIT 1`;
      const result = await this.db.prepare(query).bind(sheetId).first();
      return result !== null;
    } catch (error) {
      console.error('Error checking if sheetID exists:', error);
      return false;
    }
  }

  // Check if sheet name exists
  async sheetNameExists(sheetName: string): Promise<boolean> {
    try {
      const query = `SELECT 1 FROM ${this.tableName} WHERE sheetName = ? LIMIT 1`;
      const result = await this.db.prepare(query).bind(sheetName).first();
      return result !== null;
    } catch (error) {
      console.error('Error checking if sheet name exists:', error);
      return false;
    }
  }

  // Search sheets by name
  async searchByName(searchTerm: string, limit: number = 20): Promise<Sheet[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE sheetName LIKE ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      const result = await this.db.prepare(query)
        .bind(`%${searchTerm}%`, limit)
        .all<Sheet>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error searching sheets by name:', error);
      return [];
    }
  }

  // Get sheets ordered by creation date
  async getOrderedByDate(ascending: boolean = false, limit?: number): Promise<Sheet[]> {
    try {
      const order = ascending ? 'ASC' : 'DESC';
      let query = `SELECT * FROM ${this.tableName} ORDER BY created_at ${order}`;
      const params: any[] = [];
      
      if (limit) {
        query += ` LIMIT ?`;
        params.push(limit);
      }
      
      const result = await this.db.prepare(query).bind(...params).all<Sheet>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting sheets ordered by date:', error);
      return [];
    }
  }

  // Get recently created sheets
  async getRecentSheets(days: number = 7, limit: number = 20): Promise<Sheet[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE created_at >= ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      const result = await this.db.prepare(query)
        .bind(dateThreshold.toISOString(), limit)
        .all<Sheet>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting recent sheets:', error);
      return [];
    }
  }

  // Create sheet with validation
  async createSheet(sheetData: Omit<Sheet, 'id' | 'created_at'> & { created_at?: Date }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Check if sheetID already exists
      if (await this.sheetIdExists(sheetData.sheetID)) {
        return { success: false, error: 'Sheet ID already exists' };
      }

      // Check if sheet name already exists
      if (await this.sheetNameExists(sheetData.sheetName)) {
        return { success: false, error: 'Sheet name already exists' };
      }

      return await this.create({
        ...sheetData,
        created_at: sheetData.created_at || new Date()
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Update sheet name
  async updateSheetName(id: string, newName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if new name already exists (excluding current sheet)
      const existingQuery = `SELECT 1 FROM ${this.tableName} WHERE sheetName = ? AND id != ? LIMIT 1`;
      const existing = await this.db.prepare(existingQuery).bind(newName, id).first();
      
      if (existing) {
        return { success: false, error: 'Sheet name already exists' };
      }

      return await this.update(id, { sheetName: newName });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get sheet statistics
  async getSheetStats(): Promise<{
    totalSheets: number;
    recentSheets: number;
    oldestSheet?: string;
    newestSheet?: string;
  }> {
    try {
      // Get total count
      const totalResult = await this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).bind().first<{ count: number }>();
      
      // Get recent count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentResult = await this.db.prepare(`
        SELECT COUNT(*) as count FROM ${this.tableName} 
        WHERE created_at >= ?
      `).bind(thirtyDaysAgo.toISOString()).first<{ count: number }>();
      
      // Get oldest sheet
      const oldestResult = await this.db.prepare(`
        SELECT created_at FROM ${this.tableName} 
        ORDER BY created_at ASC LIMIT 1
      `).bind().first<{ created_at: string }>();
      
      // Get newest sheet
      const newestResult = await this.db.prepare(`
        SELECT created_at FROM ${this.tableName} 
        ORDER BY created_at DESC LIMIT 1
      `).bind().first<{ created_at: string }>();
      
      return {
        totalSheets: totalResult?.count || 0,
        recentSheets: recentResult?.count || 0,
        oldestSheet: oldestResult?.created_at,
        newestSheet: newestResult?.created_at
      };
    } catch (error) {
      console.error('Error getting sheet stats:', error);
      return {
        totalSheets: 0,
        recentSheets: 0
      };
    }
  }
}
