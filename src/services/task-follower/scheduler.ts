import { Environment } from '../../types';
import { D1DatabaseConnection } from '../../crud/database';
import { TaskService } from './task-service';
import { MemberSheetServices } from '../membership-manager/member-sheet-services';
import { TelegramService } from '../telegram';
import { escapeMarkdownV2 } from '../../utils/helpers';

// Scheduled task handler for checking all sheets periodically
export async function handleScheduledTaskCheck(env: Environment): Promise<Response> {
  console.log('Running scheduled task check at:', new Date().toISOString());
  
  try {
    const db = new D1DatabaseConnection(env.DB);
    const taskService = new TaskService(db, env);
    
    // Check tasks during work hours only
    // Shame notifications are now automatically triggered when late task reminders are sent
    // for tasks that are 2+ days overdue
    // OPTIMIZED: Process one sheet per cron trigger to avoid CPU time limits
    await taskService.checkOneSheetAtWorkHours();
    
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

// Scheduled task handler for daily manager reports
// Note: This is triggered by the */5 8-21 cron, but only executes between 8:00-8:04 AM
export async function handleDailyManagerReport(env: Environment): Promise<Response> {
  console.log('Running daily manager report at:', new Date().toISOString());
  
  try {
    const db = new D1DatabaseConnection(env.DB);
    const taskService = new TaskService(db, env);
    const memberService = new MemberSheetServices(env);
    const telegramService = new TelegramService(env);
    
    // Get all members
    const members = await memberService.getMembers();
    
    // Filter managers (members who have telegram_id and are managing tasks)
    const managers = new Map<string, any>();
    
    for (const member of members) {
      if (member.membership_number) {
        managers.set(member.membership_number, member);
      }
    }
    
    let reportsSent = 0;
    let errors = 0;
    
    // For each manager, generate and send their daily report
    for (const [managerId, manager] of managers.entries()) {
      try {
        // Skip if manager doesn't have Telegram ID
        if (!manager.telegram_id) {
          continue;
        }
        
        // Get tasks data for this manager
        const { completed: completedTasks, pending: pendingTasks, overdue: overdueTasks } = 
          await taskService.getManagerTaskSummary(managerId);
        
        // Skip managers with no tasks at all
        if (completedTasks.length === 0 && pendingTasks.length === 0 && overdueTasks.length === 0) {
          continue;
        }
        
        // Get unique projects for this manager
        const projects = await taskService.getManagerProjects(managerId);
        
        // Group tasks by project
        const tasksByProject = new Map<string, {
          completed: any[];
          pending: any[];
          overdue: any[];
        }>();
        
        // Initialize project groups
        for (const project of projects) {
          tasksByProject.set(project, {
            completed: completedTasks.filter(t => t.projectName === project),
            pending: pendingTasks.filter(t => t.projectName === project),
            overdue: overdueTasks.filter(t => t.projectName === project)
          });
        }
        
        // Generate and send report for each project
        for (const [projectName, projectTasks] of tasksByProject.entries()) {
          // Skip projects with no tasks
          if (projectTasks.completed.length === 0 && 
              projectTasks.pending.length === 0 && 
              projectTasks.overdue.length === 0) {
            continue;
          }
          
          // Generate report message for this project
          const report = generateManagerDailyReport(
            manager, 
            projectName,
            projectTasks.completed, 
            projectTasks.pending, 
            projectTasks.overdue
          );
          
          // Send report to manager
          await telegramService.sendMessage(
            manager.telegram_id,
            report,
            'MarkdownV2'
          );
          
          reportsSent++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`Error sending report to manager ${managerId}:`, error);
        errors++;
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Daily manager reports completed',
      data: {
        reportsSent,
        errors
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in daily manager report:', error);
    
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

// Helper function to generate manager daily report
function generateManagerDailyReport(
  manager: any,
  projectName: string,
  completedTasks: any[],
  pendingTasks: any[],
  overdueTasks: any[]
): string {
  const managerName = escapeMarkdownV2(manager.name1 || 'المدير');
  const project = escapeMarkdownV2(projectName);
  
  let report = `*📊 تقرير يومي \\- ${managerName}*\n`;
  report += `*📁 المشروع: ${project}*\n\n`;
  report += `📅 التاريخ: ${escapeMarkdownV2(new Date().toLocaleDateString('en-CA'))}\n\n`;
  
  // Completed tasks in last 24 hours
  report += `*✅ المهام المكتملة \\(آخر 24 ساعة\\):* ${completedTasks.length}\n`;
  if (completedTasks.length > 0) {
    completedTasks.slice(0, 5).forEach((task, index) => {
      const taskText = escapeMarkdownV2(task.taskText.substring(0, 50) + (task.taskText.length > 50 ? '...' : ''));
      const ownerName = escapeMarkdownV2(task.ownerName);
      report += `  ${index + 1}\\. ${taskText}\n     👤 ${ownerName}\n`;
    });
    if (completedTasks.length > 5) {
      report += `  _\\.\\.\\. و ${completedTasks.length - 5} مهام أخرى_\n`;
    }
  }
  report += '\n';
  
  // Overdue tasks
  report += `*⚠️ المهام المتأخرة:* ${overdueTasks.length}\n`;
  if (overdueTasks.length > 0) {
    overdueTasks.slice(0, 5).forEach((task, index) => {
      const taskText = escapeMarkdownV2(task.taskText.substring(0, 50) + (task.taskText.length > 50 ? '...' : ''));
      const ownerName = escapeMarkdownV2(task.ownerName);
      const dueDate = task.dueDate ? escapeMarkdownV2(new Date(task.dueDate).toLocaleDateString('en-CA')) : 'غير محدد';
      report += `  ${index + 1}\\. ${taskText}\n     👤 ${ownerName} \\| 📅 ${dueDate}\n`;
    });
    if (overdueTasks.length > 5) {
      report += `  _\\.\\.\\. و ${overdueTasks.length - 5} مهام أخرى_\n`;
    }
  }
  report += '\n';
  
  // Pending tasks
  report += `*⏳ المهام قيد الانتظار:* ${pendingTasks.length}\n`;
  if (pendingTasks.length > 0) {
    const highPriorityPending = pendingTasks.filter(t => t.priority && (t.priority === 'عاجل' || t.priority === 'مهم'));
    if (highPriorityPending.length > 0) {
      report += `  🔴 مهام ذات أولوية عالية: ${highPriorityPending.length}\n`;
    }
  }
  report += '\n';
  
  // Summary
  const totalActiveTasks = pendingTasks.length + overdueTasks.length;
  report += `*📈 الإجمالي:*\n`;
  report += `  • المهام النشطة: ${totalActiveTasks}\n`;
  report += `  • المكتمل اليوم: ${completedTasks.length}\n`;
  
  if (overdueTasks.length > 0) {
    report += `\n⚡️ _يرجى متابعة المهام المتأخرة مع أعضاء الفريق_`;
  } else if (completedTasks.length > 0) {
    report += `\n🎉 _عمل رائع\\! استمروا بنفس الأداء_`;
  }
  
  return report;
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
        // Get current hour in UTC+3 (Turkey/Istanbul timezone)
        const now = new Date();
        const istanbulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
        const currentHour = istanbulTime.getHours();
        const currentMinute = istanbulTime.getMinutes();
        
        // At 8:00-8:04 AM, send daily manager reports
        if (currentHour === 8 && currentMinute < 5) {
          ctx.waitUntil(handleDailyManagerReport(env));
        } 
        // From 9 AM to 9 PM, run task checks
        else if (currentHour >= 9 && currentHour <= 21) {
          ctx.waitUntil(handleScheduledTaskCheck(env));
        }
        break;
      
      case '0 9 * * *': // Daily at 9 AM - Activity Report
        ctx.waitUntil(handleDailyActivityReport(env));
        break;
      
      default:
        console.log('Unknown cron schedule:', event.cron);
        break;
    }
  }
};