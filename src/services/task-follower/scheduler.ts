import { Environment } from '../../types';
import { D1DatabaseConnection } from '../../crud/database';
import { TaskService } from './task-service';
import { ShameService } from './shame-service';

// Scheduled task handler for checking all sheets periodically
export async function handleScheduledTaskCheck(env: Environment): Promise<Response> {
  console.log('Running scheduled task check at:', new Date().toISOString());
  
  try {
    const db = new D1DatabaseConnection(env.DB);
    const taskService = new TaskService(db, env);
    
    // Check tasks during work hours only
    await taskService.checkAllSheetsAtWorkHours();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduled task check completed',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in scheduled task check:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Scheduled task handler for daily activity reports
export async function handleDailyActivityReport(env: Environment): Promise<Response> {
  console.log('Running daily activity report at:', new Date().toISOString());
  
  try {
    const db = new D1DatabaseConnection(env.DB);
    const taskService = new TaskService(db, env);
    
    // Get tasks needing attention and send summary
    const tasksNeedingAttention = await taskService.getTasksNeedingAttention();
    
    // TODO: Send daily summary to managers/admins
    // This could be implemented as a summary message to admin Telegram channels
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Daily activity report completed',
      data: {
        overdue: tasksNeedingAttention.overdue.length,
        dueSoon: tasksNeedingAttention.dueSoon.length,
        blocked: tasksNeedingAttention.blocked.length
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in daily activity report:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Scheduled task handler for shame notifications (delayed tasks)
export async function handleShameNotifications(env: Environment): Promise<Response> {
  console.log('Running shame notifications check at:', new Date().toISOString());
  
  try {
    const db = new D1DatabaseConnection(env.DB);
    const shameService = new ShameService(db, env);
    
    // Process all delayed tasks and send shame notifications
    const result = await shameService.processDelayedTasks();
    
    return new Response(JSON.stringify({
      success: result.success,
      message: 'Shame notifications completed',
      data: {
        processedCount: result.processedCount,
        totalNotifications: result.totalNotifications
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in shame notifications:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cloudflare Workers Cron Event Handler
export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
  noRetry?: boolean;
}

export default {
  async scheduled(event: ScheduledEvent, env: Environment, ctx: ExecutionContext): Promise<void> {
    // Handle different cron schedules
    switch (event.cron) {
      case '*/5 8-21 * * *': // Every 5 minutes during work hours (8 AM - 9 PM)
        ctx.waitUntil(handleScheduledTaskCheck(env));
        break;
      
      case '0 9 * * *': // Daily at 9 AM
        ctx.waitUntil(handleDailyActivityReport(env));
        break;
      
      case '0 10 * * *': // Daily at 10 AM - Send shame notifications
        ctx.waitUntil(handleShameNotifications(env));
        break;
      
      default:
        console.log('Unknown cron schedule:', event.cron);
        break;
    }
  }
};