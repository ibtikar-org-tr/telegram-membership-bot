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

  // Update task status
  async updateStatus(id: string, status: string): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { 
        status, 
        updated_at: new Date()
      };

      if (status === 'completed') {
        updateData.completed_at = new Date();
      }

      return await this.update(id, updateData);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Mark task as blocked
  async blockTask(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        blocked_at: new Date(),
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
}
