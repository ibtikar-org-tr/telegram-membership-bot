import { DatabaseConnection } from '../../crud/base';
import { TaskCrud } from '../../crud/task-follower/task';
import { Task } from '../../models/task-follower/task';
import { TelegramService } from '../telegram';
import { Environment } from '../../types';
import { escapeMarkdownV2 } from '../../utils/helpers';
import { InlineKeyboardButton } from '../../types';

export class ShameService {
  private db: DatabaseConnection;
  private taskCrud: TaskCrud;
  private telegramService: TelegramService;
  private env: Environment;

  constructor(db: DatabaseConnection, env: Environment) {
    this.db = db;
    this.env = env;
    this.taskCrud = new TaskCrud(db);
    this.telegramService = new TelegramService(env);
  }

  /**
   * Check if a task is delayed by more than 2 days
   */
  private isTaskDelayed(task: Task): boolean {
    if (!task.dueDate || task.status === 'completed' || task.completed_at) {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    
    return (now.getTime() - dueDate.getTime()) > twoDaysInMs;
  }

  /**
   * Get all delayed tasks (overdue by more than 2 days)
   */
  async getDelayedTasks(): Promise<Task[]> {
    const overdueTasks = await this.taskCrud.getOverdueTasks();
    return overdueTasks.filter(task => this.isTaskDelayed(task));
  }

  /**
   * Get all project members (with telegram IDs) for a given project
   * Returns all tasks owners and managers who have telegram IDs in this project
   */
  private async getProjectMembers(projectName: string): Promise<Array<{
    telegram_id: string;
    name: string;
    role: 'owner' | 'manager';
  }>> {
    try {
      const tasks = await this.taskCrud.getByProjectName(projectName);
      const membersMap = new Map<string, { telegram_id: string; name: string; role: 'owner' | 'manager' }>();

      for (const task of tasks) {
        // Add task owner if has telegram ID
        if (task.owner_telegram_id && !membersMap.has(task.owner_telegram_id)) {
          membersMap.set(task.owner_telegram_id, {
            telegram_id: task.owner_telegram_id,
            name: task.ownerName,
            role: 'owner'
          });
        }

        // Add manager if has telegram ID
        if (task.manager_telegram_id && !membersMap.has(task.manager_telegram_id)) {
          membersMap.set(task.manager_telegram_id, {
            telegram_id: task.manager_telegram_id,
            name: task.managerName,
            role: 'manager'
          });
        }
      }

      return Array.from(membersMap.values());
    } catch (error) {
      console.error('Error getting project members:', error);
      return [];
    }
  }

  /**
   * Send shame notifications to all project members about a delayed task
   */
  async sendShameNotifications(taskId: string): Promise<{
    success: boolean;
    notifiedCount: number;
    error?: string;
  }> {
    try {
      const task = await this.taskCrud.getById(taskId);
      
      if (!task) {
        return { success: false, notifiedCount: 0, error: 'Task not found' };
      }
      
      console.log('Task found for shame notification:', task.taskText, 'Project:', task.projectName);

      // Verify task is still delayed
      if (!this.isTaskDelayed(task)) {
        return { success: false, notifiedCount: 0, error: 'Task is not delayed' };
      }

      // Get all project members
      const projectMembers = await this.getProjectMembers(task.projectName);
      
      // Filter out the task owner (don't send to themselves)
      const membersToNotify = projectMembers.filter(
        member => member.telegram_id !== task.owner_telegram_id
      );

      if (membersToNotify.length === 0) {
        return { success: true, notifiedCount: 0, error: 'No project members to notify' };
      }

      // Calculate how many days overdue
      const dueDate = new Date(task.dueDate!);
      const now = new Date();
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

      // Prepare the message
      const messageText = `
🫣 *فضيحة! - لدى زميلك مهمة متأخرة*

أحد زملائك في المشروع لديه مهمة متأخرة\\!

📋 *المشروع:* ${escapeMarkdownV2(task.projectName)}
📝 *المهمة:* ${escapeMarkdownV2(task.taskText)}
⏰ *متأخرة بـ:* ${daysOverdue} يوم
⚡ *الأولوية:* ${escapeMarkdownV2(task.priority)}

يمكنك تذكيره بالضغط على الزر أدناه 👇
      `.trim();

      // Create inline keyboard with shame button
      const keyboard: InlineKeyboardButton[][] = [
        [
          {
            text: '😤 أرسل "عارٌ عليك!"',
            callback_data: `shame_${taskId}`
          }
        ]
      ];

      // Send to all project members
      let notifiedCount = 0;
      for (const member of membersToNotify) {
        try {
          await this.telegramService.sendMessage(
            member.telegram_id,
            messageText,
            'MarkdownV2',
            keyboard
          );
          notifiedCount++;
        } catch (error) {
          console.error(`Failed to send shame notification to ${member.telegram_id}:`, error);
        }
      }

      return { success: true, notifiedCount };
    } catch (error) {
      console.error('Error sending shame notifications:', error);
      return {
        success: false,
        notifiedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle a shame button click
   * Returns response message for the sender
   */
  async handleShameButtonClick(
    taskId: string,
    senderTelegramId: string
  ): Promise<{
    success: boolean;
    message: string;
    notifyOwner: boolean;
  }> {
    try {
      const task = await this.taskCrud.getById(taskId);

      if (!task) {
        return {
          success: false,
          message: '❌ لم يتم العثور على المهمة',
          notifyOwner: false
        };
      }
      
      console.log('Task found:', task.taskText, 'Status:', task.status);

      // Check if task is still pending
      if (task.status === 'completed' || task.completed_at) {
        return {
          success: false,
          message: '✅ لقد أنهى المهمة\\، لا يمكنك توبيخه الآن\\!',
          notifyOwner: false
        };
      }

      // Don't allow owner to shame themselves
      if (task.owner_telegram_id === senderTelegramId) {
        return {
          success: false,
          message: '😅 لا يمكنك توبيخ نفسك\\!',
          notifyOwner: false
        };
      }

      // Check if owner has telegram ID
      if (!task.owner_telegram_id) {
        return {
          success: false,
          message: '❌ صاحب المهمة ليس لديه حساب تيليجرام مسجل',
          notifyOwner: false
        };
      }

      // Send shame message to task owner
      const shameMessage = `
😤 *عارٌ عليك!*

لقد تلقيت رسالة "عارٌ عليك" من أحد زملائك في المشروع بسبب تأخرك في المهمة:

📋 *المشروع:* ${escapeMarkdownV2(task.projectName)}
📝 *المهمة:* ${escapeMarkdownV2(task.taskText)}

⏰ حان الوقت لإنجاز هذه المهمة\\!
      `.trim();

      try {
        await this.telegramService.sendMessage(
          task.owner_telegram_id,
          shameMessage,
          'MarkdownV2'
        );

        return {
          success: true,
          message: '✅ تم إرسال رسالة "عارٌ عليك!" بنجاح',
          notifyOwner: true
        };
      } catch (error) {
        console.error('Error sending shame to owner:', error);
        return {
          success: false,
          message: '❌ فشل إرسال الرسالة',
          notifyOwner: false
        };
      }
    } catch (error) {
      console.error('Error handling shame button click:', error);
      return {
        success: false,
        message: '❌ حدث خطأ أثناء معالجة الطلب',
        notifyOwner: false
      };
    }
  }

  /**
   * Process all delayed tasks and send shame notifications
   * This can be called periodically (e.g., daily)
   */
  async processDelayedTasks(): Promise<{
    success: boolean;
    processedCount: number;
    totalNotifications: number;
  }> {
    try {
      const delayedTasks = await this.getDelayedTasks();
      let processedCount = 0;
      let totalNotifications = 0;

      for (const task of delayedTasks) {
        if (!task.id) continue;

        // Check if we already sent shame notifications for this task today
        // We can use the last_reported field or add a new field for shame tracking
        const lastReported = task.last_reported ? new Date(task.last_reported) : null;
        const today = new Date();
        
        // Only send once per day
        if (lastReported) {
          const isSameDay = 
            lastReported.getDate() === today.getDate() &&
            lastReported.getMonth() === today.getMonth() &&
            lastReported.getFullYear() === today.getFullYear();
          
          if (isSameDay) {
            continue; // Skip, already sent today
          }
        }

        const result = await this.sendShameNotifications(task.id);
        
        if (result.success) {
          processedCount++;
          totalNotifications += result.notifiedCount;
          
          // Update last_reported to mark that we sent notifications today
          await this.taskCrud.updateLastReported(task.id);
        }
      }

      return {
        success: true,
        processedCount,
        totalNotifications
      };
    } catch (error) {
      console.error('Error processing delayed tasks:', error);
      return {
        success: false,
        processedCount: 0,
        totalNotifications: 0
      };
    }
  }
}
