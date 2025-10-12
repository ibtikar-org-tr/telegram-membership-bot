// Main CRUD exports for task-follower models
export { BaseCrud, DatabaseConnection } from './base';
export { UserCrud } from './task-follower/user';
export { ActivityCrud } from './task-follower/activity';
export { SheetCrud } from './task-follower/sheet';
export { TaskCrud } from './task-follower/task';

// Combined CRUD manager class
import { UserCrud } from './task-follower/user';
import { ActivityCrud } from './task-follower/activity';
import { SheetCrud } from './task-follower/sheet';
import { TaskCrud } from './task-follower/task';
import { DatabaseConnection } from './base';

export class TaskFollowerCrud {
  public users: UserCrud;
  public activities: ActivityCrud;
  public sheets: SheetCrud;
  public tasks: TaskCrud;

  constructor(db: DatabaseConnection) {
    this.users = new UserCrud(db);
    this.activities = new ActivityCrud(db);
    this.sheets = new SheetCrud(db);
    this.tasks = new TaskCrud(db);
  }

  // Helper method to get all CRUD instances
  getAllCrudInstances() {
    return {
      users: this.users,
      activities: this.activities,
      sheets: this.sheets,
      tasks: this.tasks
    };
  }

  // Health check method to verify database connectivity
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, boolean>;
    errors: string[];
  }> {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    try {
      // Test each table
      checks.users = (await this.users.count()) >= 0;
    } catch (error) {
      checks.users = false;
      errors.push(`Users table error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      checks.activities = (await this.activities.count()) >= 0;
    } catch (error) {
      checks.activities = false;
      errors.push(`Activities table error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      checks.sheets = (await this.sheets.count()) >= 0;
    } catch (error) {
      checks.sheets = false;
      errors.push(`Sheets table error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      checks.tasks = (await this.tasks.count()) >= 0;
    } catch (error) {
      checks.tasks = false;
      errors.push(`Tasks table error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const allHealthy = Object.values(checks).every(check => check);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      errors
    };
  }

  // Get comprehensive statistics across all models
  async getOverallStats(): Promise<{
    users: { total: number };
    activities: { total: number };
    sheets: { total: number };
    tasks: {
      totalTasks: number;
      completedTasks: number;
      blockedTasks: number;
      overdueTasks: number;
      tasksByStatus: Record<string, number>;
      tasksByPriority: Record<string, number>;
    };
  }> {
    try {
      const [userCount, activityCount, sheetCount, taskStats] = await Promise.all([
        this.users.count(),
        this.activities.count(),
        this.sheets.count(),
        this.tasks.getTaskStats()
      ]);

      return {
        users: { total: userCount },
        activities: { total: activityCount },
        sheets: { total: sheetCount },
        tasks: taskStats
      };
    } catch (error) {
      console.error('Error getting overall stats:', error);
      return {
        users: { total: 0 },
        activities: { total: 0 },
        sheets: { total: 0 },
        tasks: {
          totalTasks: 0,
          completedTasks: 0,
          blockedTasks: 0,
          overdueTasks: 0,
          tasksByStatus: {},
          tasksByPriority: {}
        }
      };
    }
  }
}
