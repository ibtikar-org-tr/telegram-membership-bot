import { BaseCrud, DatabaseConnection } from '../base';
import { Task, TaskModel } from '../../models/task-follower/task';

export class TaskCrud extends BaseCrud<Task> {
  constructor(db: DatabaseConnection) {
    super(db, TaskModel.tableName);
  }

  // Get tasks by sheet ID
  async getBySheetId(sheetId: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE sheetID = ? ORDER BY row_number ASC`;
      const result = await this.db.prepare(query).bind(sheetId).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by sheet ID:', error);
      return [];
    }
  }

  // Get tasks by owner ID
  async getByOwnerId(ownerId: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE ownerID = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(ownerId).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by owner ID:', error);
      return [];
    }
  }

  // Get tasks by manager name
  async getByManagerName(managerName: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE managerName = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(managerName).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by manager name:', error);
      return [];
    }
  }

  // Get tasks by status
  async getByStatus(status: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE status = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(status).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by status:', error);
      return [];
    }
  }

  // Get tasks by priority
  async getByPriority(priority: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE priority = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(priority).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by priority:', error);
      return [];
    }
  }

  // Get tasks by project name
  async getByProjectName(projectName: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE projectName = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(projectName).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by project name:', error);
      return [];
    }
  }

  // Get overdue tasks
  async getOverdueTasks(): Promise<Task[]> {
    try {
      const now = new Date().toISOString();
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE dueDate IS NOT NULL 
        AND dueDate < ? 
        AND status != 'completed' 
        AND completed_at IS NULL
        ORDER BY dueDate ASC
      `;
      const result = await this.db.prepare(query).bind(now).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting overdue tasks:', error);
      return [];
    }
  }

  // Get tasks due soon (within next N days)
  async getTasksDueSoon(days: number = 3): Promise<Task[]> {
    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE dueDate IS NOT NULL 
        AND dueDate BETWEEN ? AND ?
        AND status != 'completed' 
        AND completed_at IS NULL
        ORDER BY dueDate ASC
      `;
      
      const result = await this.db.prepare(query)
        .bind(now.toISOString(), futureDate.toISOString())
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks due soon:', error);
      return [];
    }
  }

  // Get blocked tasks
  async getBlockedTasks(): Promise<Task[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE blocked_at IS NOT NULL 
        ORDER BY blocked_at DESC
      `;
      const result = await this.db.prepare(query).bind().all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting blocked tasks:', error);
      return [];
    }
  }

  // Get tasks completed in the last N hours
  async getTasksCompletedInLastHours(hours: number = 24): Promise<Task[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setHours(dateThreshold.getHours() - hours);
      
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE completed_at IS NOT NULL 
        AND completed_at >= ?
        ORDER BY completed_at DESC
      `;
      
      const result = await this.db.prepare(query)
        .bind(dateThreshold.toISOString())
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting recently completed tasks:', error);
      return [];
    }
  }

  // Get tasks completed by manager in the last N hours
  async getTasksCompletedByManagerInLastHours(managerId: string, hours: number = 24): Promise<Task[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setHours(dateThreshold.getHours() - hours);
      
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE managerID = ?
        AND completed_at IS NOT NULL 
        AND completed_at >= ?
        ORDER BY projectName ASC, completed_at DESC
      `;
      
      const result = await this.db.prepare(query)
        .bind(managerId, dateThreshold.toISOString())
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting manager recently completed tasks:', error);
      return [];
    }
  }

  // Get pending/waiting tasks by manager (not completed)
  async getPendingTasksByManager(managerId: string): Promise<Task[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE managerID = ?
        AND completed_at IS NULL
        AND status != 'completed'
        ORDER BY projectName ASC, dueDate ASC, priority DESC
      `;
      
      const result = await this.db.prepare(query)
        .bind(managerId)
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting pending tasks by manager:', error);
      return [];
    }
  }

  // Get overdue tasks by manager
  async getOverdueTasksByManager(managerId: string): Promise<Task[]> {
    try {
      const now = new Date().toISOString();
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE managerID = ?
        AND dueDate IS NOT NULL 
        AND dueDate < ? 
        AND status != 'completed' 
        AND completed_at IS NULL
        ORDER BY projectName ASC, dueDate ASC
      `;
      
      const result = await this.db.prepare(query)
        .bind(managerId, now)
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting overdue tasks by manager:', error);
      return [];
    }
  }

  // Get unique projects for a manager
  async getManagerProjects(managerId: string): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT projectName 
        FROM ${this.tableName} 
        WHERE managerID = ?
        ORDER BY projectName ASC
      `;
      
      const result = await this.db.prepare(query)
        .bind(managerId)
        .all<{ projectName: string }>();
      
      return result.success ? result.results.map(r => r.projectName) : [];
    } catch (error) {
      console.error('Error getting manager projects:', error);
      return [];
    }
  }

  // Update task status
  async updateStatus(id: string, status: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get existing task to preserve completed_at if already set
      const existingTask = await this.getById(id);
      
      const updateData: any = { 
        status, 
        updated_at: new Date()
      };

      if (status === 'completed') {
        // Only set completed_at if it wasn't already set
        updateData.completed_at = existingTask?.completed_at || new Date();
      }

      return await this.update(id, updateData);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Mark task as blocked
  async blockTask(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get existing task to preserve blocked_at if already set
      const existingTask = await this.getById(id);
      
      const updateData: any = {
        // Only set blocked_at if it wasn't already set
        blocked_at: existingTask?.blocked_at || new Date(),
        updated_at: new Date()
      };

      if (reason) {
        updateData.notes = reason;
      }

      return await this.update(id, updateData);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Unblock task
  async unblockTask(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.update(id, {
        blocked_at: null,
        updated_at: new Date()
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Update last sent timestamp
  async updateLastSent(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.update(id, {
        last_sent: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Update last reported timestamp
  async updateLastReported(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.update(id, {
        last_reported: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Search tasks
  async searchTasks(searchTerm: string, limit: number = 50): Promise<Task[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE taskText LIKE ? 
        OR ownerName LIKE ? 
        OR managerName LIKE ? 
        OR projectName LIKE ?
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      const searchPattern = `%${searchTerm}%`;
      const result = await this.db.prepare(query)
        .bind(searchPattern, searchPattern, searchPattern, searchPattern, limit)
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error searching tasks:', error);
      return [];
    }
  }

  // Get tasks with filters
  async getTasksWithFilters(filters: {
    status?: string;
    priority?: string;
    ownerId?: string;
    managerName?: string;
    projectName?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> {
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params: any[] = [];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.priority) {
        query += ` AND priority = ?`;
        params.push(filters.priority);
      }

      if (filters.ownerId) {
        query += ` AND ownerID = ?`;
        params.push(filters.ownerId);
      }

      if (filters.managerName) {
        query += ` AND managerName = ?`;
        params.push(filters.managerName);
      }

      if (filters.projectName) {
        query += ` AND projectName = ?`;
        params.push(filters.projectName);
      }

      if (filters.dueDateFrom) {
        query += ` AND dueDate >= ?`;
        params.push(filters.dueDateFrom);
      }

      if (filters.dueDateTo) {
        query += ` AND dueDate <= ?`;
        params.push(filters.dueDateTo);
      }

      query += ` ORDER BY created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);

        if (filters.offset) {
          query += ` OFFSET ?`;
          params.push(filters.offset);
        }
      }

      const result = await this.db.prepare(query).bind(...params).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks with filters:', error);
      return [];
    }
  }

  // Get task statistics
  async getTaskStats(): Promise<{
    totalTasks: number;
    completedTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    tasksByStatus: Record<string, number>;
    tasksByPriority: Record<string, number>;
  }> {
    try {
      // Get total tasks
      const totalResult = await this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).bind().first<{ count: number }>();
      
      // Get completed tasks
      const completedResult = await this.db.prepare(`
        SELECT COUNT(*) as count FROM ${this.tableName} 
        WHERE status = 'completed' OR completed_at IS NOT NULL
      `).bind().first<{ count: number }>();
      
      // Get blocked tasks
      const blockedResult = await this.db.prepare(`
        SELECT COUNT(*) as count FROM ${this.tableName} 
        WHERE blocked_at IS NOT NULL
      `).bind().first<{ count: number }>();
      
      // Get overdue tasks
      const now = new Date().toISOString();
      const overdueResult = await this.db.prepare(`
        SELECT COUNT(*) as count FROM ${this.tableName} 
        WHERE dueDate IS NOT NULL 
        AND dueDate < ? 
        AND status != 'completed' 
        AND completed_at IS NULL
      `).bind(now).first<{ count: number }>();
      
      // Get tasks by status
      const statusResult = await this.db.prepare(`
        SELECT status, COUNT(*) as count FROM ${this.tableName} 
        GROUP BY status
      `).bind().all<{ status: string; count: number }>();
      
      // Get tasks by priority
      const priorityResult = await this.db.prepare(`
        SELECT priority, COUNT(*) as count FROM ${this.tableName} 
        GROUP BY priority
      `).bind().all<{ priority: string; count: number }>();
      
      const tasksByStatus: Record<string, number> = {};
      if (statusResult.success) {
        statusResult.results.forEach(row => {
          tasksByStatus[row.status] = row.count;
        });
      }
      
      const tasksByPriority: Record<string, number> = {};
      if (priorityResult.success) {
        priorityResult.results.forEach(row => {
          tasksByPriority[row.priority] = row.count;
        });
      }
      
      return {
        totalTasks: totalResult?.count || 0,
        completedTasks: completedResult?.count || 0,
        blockedTasks: blockedResult?.count || 0,
        overdueTasks: overdueResult?.count || 0,
        tasksByStatus,
        tasksByPriority
      };
    } catch (error) {
      console.error('Error getting task stats:', error);
      return {
        totalTasks: 0,
        completedTasks: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        tasksByStatus: {},
        tasksByPriority: {}
      };
    }
  }

  // Get tasks that need notification (haven't been sent in X hours)
  async getTasksNeedingNotification(hoursThreshold: number = 24): Promise<Task[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setHours(dateThreshold.getHours() - hoursThreshold);
      
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE status != 'completed' 
        AND completed_at IS NULL
        AND (last_sent IS NULL OR last_sent < ?)
        ORDER BY created_at ASC
      `;
      
      const result = await this.db.prepare(query)
        .bind(dateThreshold.toISOString())
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks needing notification:', error);
      return [];
    }
  }

  /**
   * Get recent tasks for a user by Telegram ID (as owner or manager)
   * Returns tasks that have activity in the last 24 hours
   * @param telegramId The user's Telegram ID
   * @param limit Maximum number of tasks to return
   */
  async getRecentTasksByTelegramId(telegramId: string, limit: number = 50): Promise<Task[]> {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const dateThreshold = twentyFourHoursAgo.toISOString();
      
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE (owner_telegram_id = ? OR manager_telegram_id = ?)
        AND (
          created_at >= ?
          OR updated_at >= ?
          OR last_sent >= ?
          OR last_reported >= ?
        )
        ORDER BY updated_at DESC
        LIMIT ?
      `;
      
      const result = await this.db.prepare(query)
        .bind(telegramId, telegramId, dateThreshold, dateThreshold, dateThreshold, dateThreshold, limit)
        .all<Task>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting recent tasks by telegram ID:', error);
      return [];
    }
  }

  /**
   * Get tasks by owner Telegram ID
   * @param ownerTelegramId The owner's Telegram ID
   */
  async getByOwnerTelegramId(ownerTelegramId: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE owner_telegram_id = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(ownerTelegramId).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by owner telegram ID:', error);
      return [];
    }
  }

  /**
   * Get tasks by manager Telegram ID
   * @param managerTelegramId The manager's Telegram ID
   */
  async getByManagerTelegramId(managerTelegramId: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE manager_telegram_id = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(managerTelegramId).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by manager telegram ID:', error);
      return [];
    }
  }

  /**
   * Get tasks by manager ID (membership number)
   * @param managerId The manager's membership number
   */
  async getByManagerId(managerId: string): Promise<Task[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE managerID = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(managerId).all<Task>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting tasks by manager ID:', error);
      return [];
    }
  }
}
