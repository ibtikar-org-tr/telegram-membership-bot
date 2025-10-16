import { BaseCrud, DatabaseConnection } from '../base';
import { Activity } from '../../models/task-follower/activity';

export class ActivityCrud extends BaseCrud<Activity> {
  constructor(db: DatabaseConnection) {
    super(db, 'activities');
  }

  // Get activities by manager ID
  async getByManagerId(managerId: string): Promise<Activity[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE managerID = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(managerId).all<Activity>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting activities by manager ID:', error);
      return [];
    }
  }

  // Get activities by project name
  async getByProjectName(projectName: string): Promise<Activity[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE projectName = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(projectName).all<Activity>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting activities by project name:', error);
      return [];
    }
  }

  // Get activities by manager ID and project name
  async getByManagerAndProject(managerId: string, projectName: string): Promise<Activity[]> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE managerID = ? AND projectName = ? ORDER BY created_at DESC`;
      const result = await this.db.prepare(query).bind(managerId, projectName).all<Activity>();
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting activities by manager and project:', error);
      return [];
    }
  }

  // Update last reported timestamp
  async updateLastReported(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const query = `UPDATE ${this.tableName} SET last_reported = ?, updated_at = ? WHERE id = ?`;
      const now = new Date().toISOString();
      const result = await this.db.prepare(query).bind(now, now, id).run();
      
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get recent activities (last N days)
  async getRecentActivities(days: number = 7, limit: number = 50): Promise<Activity[]> {
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
        .all<Activity>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting recent activities:', error);
      return [];
    }
  }

  // Get activities that need reporting (haven't been reported in X hours)
  async getActivitiesNeedingReport(hoursThreshold: number = 24): Promise<Activity[]> {
    try {
      const dateThreshold = new Date();
      dateThreshold.setHours(dateThreshold.getHours() - hoursThreshold);
      
      const query = `
        SELECT * FROM ${this.tableName} 
        WHERE last_reported IS NULL OR last_reported < ?
        ORDER BY created_at ASC
      `;
      
      const result = await this.db.prepare(query)
        .bind(dateThreshold.toISOString())
        .all<Activity>();
      
      return result.success ? result.results : [];
    } catch (error) {
      console.error('Error getting activities needing report:', error);
      return [];
    }
  }

  // Get activity statistics by manager
  async getManagerStats(managerId: string): Promise<{
    totalActivities: number;
    recentActivities: number;
    lastReported?: string;
    projects: string[];
  }> {
    try {
      // Get total activities
      const totalQuery = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE managerID = ?`;
      const totalResult = await this.db.prepare(totalQuery).bind(managerId).first<{ count: number }>();
      
      // Get recent activities (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentQuery = `
        SELECT COUNT(*) as count FROM ${this.tableName} 
        WHERE managerID = ? AND created_at >= ?
      `;
      const recentResult = await this.db.prepare(recentQuery)
        .bind(managerId, weekAgo.toISOString())
        .first<{ count: number }>();
      
      // Get last reported date
      const lastReportedQuery = `
        SELECT last_reported FROM ${this.tableName} 
        WHERE managerID = ? AND last_reported IS NOT NULL 
        ORDER BY last_reported DESC LIMIT 1
      `;
      const lastReportedResult = await this.db.prepare(lastReportedQuery)
        .bind(managerId)
        .first<{ last_reported: string }>();
      
      // Get unique projects
      const projectsQuery = `
        SELECT DISTINCT projectName FROM ${this.tableName} 
        WHERE managerID = ? 
        ORDER BY projectName
      `;
      const projectsResult = await this.db.prepare(projectsQuery)
        .bind(managerId)
        .all<{ projectName: string }>();
      
      return {
        totalActivities: totalResult?.count || 0,
        recentActivities: recentResult?.count || 0,
        lastReported: lastReportedResult?.last_reported,
        projects: projectsResult.success ? projectsResult.results.map(p => p.projectName) : []
      };
    } catch (error) {
      console.error('Error getting manager stats:', error);
      return {
        totalActivities: 0,
        recentActivities: 0,
        projects: []
      };
    }
  }
}
