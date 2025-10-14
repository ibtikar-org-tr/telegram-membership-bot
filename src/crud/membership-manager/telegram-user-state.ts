import { Environment, TelegramUserState } from '../../types';
import { D1DatabaseConnection } from '../database';

export class TelegramUserStateService {
  private db: D1DatabaseConnection;

  constructor(env: Environment) {
    this.db = new D1DatabaseConnection(env.DB);
  }

  /**
   * Get user state from database
   * Returns null if user doesn't exist or state is expired (older than 10 minutes)
   */
  async getUserState(telegramId: string): Promise<TelegramUserState | null> {
    try {
      const query = `
        SELECT telegram_id, state, notes, created_at, modified_at
        FROM telegram_user_states 
        WHERE telegram_id = ? 
          AND datetime(modified_at, '+10 minutes') > datetime('now')
      `;
      
      const result = await this.db.prepare(query).bind(telegramId).first<TelegramUserState>();
      return result;
    } catch (error) {
      console.error('Error getting user state:', error);
      return null;
    }
  }

  /**
   * Set user state in database
   * Creates new record if user doesn't exist, updates if exists
   */
  async setUserState(telegramId: string, state: string, notes?: string): Promise<boolean> {
    try {
      const query = `
        INSERT OR REPLACE INTO telegram_user_states (telegram_id, state, notes, created_at, modified_at)
        VALUES (?, ?, ?, COALESCE((SELECT created_at FROM telegram_user_states WHERE telegram_id = ?), datetime('now')), datetime('now'))
      `;
      
      const result = await this.db.prepare(query).bind(telegramId, state, notes || null, telegramId).run();
      return result.success;
    } catch (error) {
      console.error('Error setting user state:', error);
      return false;
    }
  }

  /**
   * Clear user state (set to 'normal')
   */
  async clearUserState(telegramId: string): Promise<boolean> {
    return await this.setUserState(telegramId, 'normal');
  }

  /**
   * Check if user has active state (not expired and not 'normal')
   */
  async hasActiveState(telegramId: string): Promise<boolean> {
    const userState = await this.getUserState(telegramId);
    return userState !== null && userState.state !== 'normal';
  }

  /**
   * Get user state value or 'normal' if no active state
   */
  async getUserStateValue(telegramId: string): Promise<string> {
    const userState = await this.getUserState(telegramId);
    return userState?.state || 'normal';
  }
}