import { BaseCrud, DatabaseConnection } from '../base';
import { User, UserModel } from '../../models/task-follower/user';

export class UserCrud extends BaseCrud<User> {
  constructor(db: DatabaseConnection) {
    super(db, UserModel.tableName);
  }

  // Get user by email
  async getByEmail(email: string): Promise<User | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE email = ?`;
      const result = await this.db.prepare(query).bind(email).first<User>();
      return result;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  // Get user by username
  async getByUsername(username: string): Promise<User | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE username = ?`;
      const result = await this.db.prepare(query).bind(username).first<User>();
      return result;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  // Check if email exists
  async emailExists(email: string): Promise<boolean> {
    try {
      const query = `SELECT 1 FROM ${this.tableName} WHERE email = ? LIMIT 1`;
      const result = await this.db.prepare(query).bind(email).first();
      return result !== null;
    } catch (error) {
      console.error('Error checking if email exists:', error);
      return false;
    }
  }

  // Check if username exists
  async usernameExists(username: string): Promise<boolean> {
    try {
      const query = `SELECT 1 FROM ${this.tableName} WHERE username = ? LIMIT 1`;
      const result = await this.db.prepare(query).bind(username).first();
      return result !== null;
    } catch (error) {
      console.error('Error checking if username exists:', error);
      return false;
    }
  }

  // Update last login
  async updateLastLogin(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const query = `UPDATE ${this.tableName} SET last_login = ? WHERE id = ?`;
      const result = await this.db.prepare(query).bind(new Date().toISOString(), id).run();
      
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get users with pagination and search
  async getUsersWithSearch(
    search?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<User[]> {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (search) {
        query += ` WHERE username LIKE ? OR email LIKE ?`;
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const result = await this.db.prepare(query).bind(...params).all<User>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting users with search:', error);
      return [];
    }
  }

  // Create user with validation
  async createUser(userData: Omit<User, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Check if email or username already exists
      if (await this.emailExists(userData.email)) {
        return { success: false, error: 'Email already exists' };
      }

      if (await this.usernameExists(userData.username)) {
        return { success: false, error: 'Username already exists' };
      }

      return await this.create(userData);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
