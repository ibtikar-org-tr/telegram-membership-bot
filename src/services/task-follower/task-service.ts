import { TaskCrud } from '../../crud/task-follower/task';
import { SheetCrud } from '../../crud/task-follower/sheet';
import { ActivityCrud } from '../../crud/task-follower/activity';
import { Task, TaskModel } from '../../models/task-follower/task';
import { Sheet } from '../../models/task-follower/sheet';
import { GoogleSheetsService } from '../google-sheets';
import { TelegramService } from '../telegram';
import { sendMessageToMember } from '../membership-manager/member-services';
import { MemberSheetServices } from '../membership-manager/member-sheet-services';
import { Environment } from '../../types';
import { DatabaseConnection } from '../../crud/base';
import { escapeMarkdownV2 } from '../../utils/helpers';

interface Contact {
  number: string; // this is the membership_number
  name1: string;
  mail: string;
  phone: string;
  telegram_username?: string;
}

export class TaskService {
  private db: DatabaseConnection;
  private taskCrud: TaskCrud;
  private sheetCrud: SheetCrud;
  private activityCrud: ActivityCrud;
  private googleSheetsService: GoogleSheetsService;
  private telegramService: TelegramService;
  private env: Environment;
  private membersCache: Map<string, any> | null = null; // Cache for members by membership_number
  private membersCacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(db: DatabaseConnection, env: Environment) {
    this.db = db;
    this.env = env;
    this.taskCrud = new TaskCrud(db);
    this.sheetCrud = new SheetCrud(db);
    this.activityCrud = new ActivityCrud(db);
    this.googleSheetsService = new GoogleSheetsService(env);
    this.telegramService = new TelegramService(env);
  }

  /**
   * Get or refresh the members cache
   * @returns Map of membership_number to member data
   */
  private async getMembersCache(): Promise<Map<string, any>> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.membersCache && (now - this.membersCacheTimestamp) < this.CACHE_TTL) {
      return this.membersCache;
    }
    
    // Fetch fresh data
    const memberService = new MemberSheetServices(this.env);
    const members = await memberService.getMembers();
    
    // Build cache map
    this.membersCache = new Map();
    for (const member of members) {
      if (member.membership_number) {
        this.membersCache.set(member.membership_number, member);
      }
    }
    
    this.membersCacheTimestamp = now;
    return this.membersCache;
  }

  /**
   * Populate telegram IDs for a task based on membership numbers
   * @param task Task object to populate
   * @returns Task with populated telegram IDs
   */
  async populateTelegramIds(task: Partial<Task>): Promise<Partial<Task>> {
    // Get cached members
    const membersMap = await this.getMembersCache();
    
    // Populate owner telegram ID and username
    if (task.ownerID) {
      const owner = membersMap.get(task.ownerID);
      if (owner?.telegram_id) {
        task.owner_telegram_id = owner.telegram_id;
      }
      if (owner?.telegram_username) {
        task.owner_telegram_username = owner.telegram_username;
      }
    }
    
    // Populate manager telegram ID and username
    if (task.managerID) {
      const manager = membersMap.get(task.managerID);
      if (manager?.telegram_id) {
        task.manager_telegram_id = manager.telegram_id;
      }
      if (manager?.telegram_username) {
        task.manager_telegram_username = manager.telegram_username;
      }
    }
    
    return task;
  }

  // Basic CRUD operations (delegating to TaskCrud)
  async getAllTasks(): Promise<Task[]> {
    return await this.taskCrud.getAll();
  }

  async createNewTask(task: TaskModel): Promise<Task | null> {
    // Populate telegram IDs before creating
    await this.populateTelegramIds(task);
    const result = await this.taskCrud.create(task);
    return result.success ? task : null;
  }

  async getTaskById(taskId: string): Promise<Task | null> {
    return await this.taskCrud.getById(taskId);
  }

  async searchTask(sheetId: string, projectName: string, rowNumber: number): Promise<Task | null> {
    try {
      const query = `SELECT * FROM tasks WHERE sheetID = ? AND projectName = ? AND row_number = ? LIMIT 1`;
      const result = await this.db.prepare(query).bind(sheetId, projectName, rowNumber).first<Task>();
      return result || null;
    } catch (error) {
      console.error('Error searching task:', error);
      return null;
    }
  }

  async updateTaskById(taskId: string, task: Partial<Task>): Promise<Task | null> {
    // Populate telegram IDs before updating
    await this.populateTelegramIds(task);
    const result = await this.taskCrud.update(taskId, task);
    if (result.success) {
      return await this.getTaskById(taskId);
    }
    return null;
  }

  async updateTaskBySearch(oldTask: Task, newTask: Partial<Task>): Promise<Task | null> {
    const task = await this.searchTask(oldTask.sheetID, oldTask.projectName, oldTask.row_number);
    if (task?.id) {
      return await this.updateTaskById(task.id, newTask);
    }
    return null;
  }

  // Format date string to Date object
  private parseDate(dateString: string): Date | null {
    if (!dateString || !dateString.trim()) {
      return null;
    }
    try {
      // Handle various date formats that might come from Google Sheets
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  }

  // Compare two dates, handling both Date objects and date strings
  private hasDateChanged(existingDate: Date | string | null | undefined, newDate: Date | null | undefined): boolean {
    // If both are null/undefined, no change
    if (!existingDate && !newDate) {
      return false;
    }
    
    // If one is null and the other isn't, there's a change
    if (!existingDate || !newDate) {
      return true;
    }
    
    // Convert existing date to Date object if it's a string
    const existingDateObj = typeof existingDate === 'string' 
      ? this.parseDate(existingDate) 
      : existingDate;
    
    // If parsing failed, consider it a change
    if (!existingDateObj) {
      return true;
    }
    
    // Compare the timestamps
    return existingDateObj.getTime() !== newDate.getTime();
  }

  // Get specific contact from contacts data
  private getSpecificContact(contacts: any[], ownerName: string): Contact {
    try {
      const contact = contacts.find(c => 
        c.name1?.toLowerCase().includes(ownerName.toLowerCase()) ||
        c.name2?.toLowerCase().includes(ownerName.toLowerCase()) ||
        c.name3?.toLowerCase().includes(ownerName.toLowerCase())
      );
      
      if (contact) {
        return {
          number: contact.number || '0',
          name1: contact.name1 || ownerName,
          mail: contact.mail || 'Unknown',
          phone: contact.phone || 'Unknown',
          telegram_username: contact.telegram_username
        };
      }
    } catch (error) {
      console.error('Error finding contact:', error);
    }
    
    return {
      number: '0',
      name1: ownerName || 'Unknown',
      mail: 'Unknown',
      phone: 'Unknown',
      telegram_username: undefined
    };
  }

  // Method to get contacts from the "contacts" sheet
  private async getContactsFromSheet(sheetId: string): Promise<Contact[]> {
    try {
      // Get contacts from the "contacts" sheet
      const contactsData = await this.googleSheetsService.getSheetData(sheetId, 'contacts!A:Z');
      const contacts: Contact[] = [];
      
      if (contactsData && contactsData.length > 1) {
        // Assume first row contains headers
        const headers = contactsData[0];
        const rows = contactsData.slice(1);
        
        // Find column indices (case-insensitive search)
        const numberIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('number'));
        const name1Index = headers.findIndex((h: string) => h?.toLowerCase().includes('name'));
        const mailIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('mail') || h?.toLowerCase().includes('email'));
        const phoneIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('phone') || h?.toLowerCase().includes('whatsapp'));
        const telegramUsernameIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('telegram') && h?.toLowerCase().includes('username'));
        
        for (const row of rows) {
          if (row && row.length > 0 && row[0]) { // Skip empty rows
            contacts.push({
              number: (numberIndex >= 0 ? row[numberIndex] : row[0]) || '0',
              name1: (name1Index >= 0 ? row[name1Index] : row[1]) || 'Unknown',
              mail: (mailIndex >= 0 ? row[mailIndex] : row[2]) || 'Unknown',
              phone: (phoneIndex >= 0 ? row[phoneIndex] : row[3]) || 'Unknown',
              telegram_username: telegramUsernameIndex >= 0 ? row[telegramUsernameIndex] : undefined
            });
          }
        }
      }
      
      return contacts;
    } catch (error) {
      console.error('Error getting contacts from sheet:', error);
      return [];
    }
  }

  // Method to get spreadsheet metadata including all sheets
  private async getSpreadsheetInfo(sheetId: string): Promise<any> {
    try {
      return await this.googleSheetsService.getSpreadsheetMetadata(sheetId);
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
      return null;
    }
  }

  // Method to get task sheets (all sheets except "contacts" and "imported")
  private async getTaskSheetsData(sheetId: string): Promise<Array<{
    projectName: string;
    records: any[];
  }>> {
    try {
      // First, get the list of all sheets/tabs in the spreadsheet
      const spreadsheetData = await this.getSpreadsheetInfo(sheetId);
      
      if (!spreadsheetData) {
        throw new Error('Failed to get spreadsheet metadata');
      }
      
      const sheets = (spreadsheetData as any).sheets || [];
      const tasks: Array<{ projectName: string; records: any[] }> = [];
      
      // Process all sheets except "contacts"
      for (const sheet of sheets) {
        const sheetName = sheet.properties?.title;
        
        // Skip contacts sheet
        if (sheetName.toLowerCase() === 'contacts' || sheetName.toLowerCase() === 'imported') {
          continue;
        }
        
        try {
          // Get data from this sheet
          const sheetData = await this.googleSheetsService.getSheetData(sheetId, `${sheetName}!A:Z`);
          
          if (sheetData && sheetData.length > 1) {
            // Assume first row contains headers
            const headers = sheetData[0];
            const rows = sheetData.slice(1);
            
            // Find column indices for task data
            const ownerIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('owner') || h?.toLowerCase().includes('assigned'));
            const taskIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('task') || h?.toLowerCase().includes('description'));
            const statusIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('status'));
            const priorityIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('priority'));
            const pointsIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('point'));
            const startDateIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('start') && h?.toLowerCase().includes('date'));
            const dueDateIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('delivery') || h?.toLowerCase().includes('due'));
            const notesIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('note'));
            const milestoneIndex = headers.findIndex((h: string) => h?.toLowerCase().includes('milestone'));
            
            const records = rows.map(row => {
              if (!row || row.length === 0) return null;
              
              return {
                owner: (ownerIndex >= 0 ? row[ownerIndex] : row[0]) || '',
                Task: (taskIndex >= 0 ? row[taskIndex] : row[1]) || '',
                Status: (statusIndex >= 0 ? row[statusIndex] : row[2]) || '',
                Priority: (priorityIndex >= 0 ? row[priorityIndex] : row[3]) || '',
                points: (pointsIndex >= 0 ? row[pointsIndex] : row[4]) || '',
                'Start date': (startDateIndex >= 0 ? row[startDateIndex] : row[5]) || '',
                'Delivery date': (dueDateIndex >= 0 ? row[dueDateIndex] : row[6]) || '',
                Notes: (notesIndex >= 0 ? row[notesIndex] : row[7]) || '',
                Milestone: (milestoneIndex >= 0 ? row[milestoneIndex] : row[8]) || ''
              };
            }).filter(record => record !== null && record.owner); // Filter out empty records
            
            if (records.length > 0) {
              tasks.push({
                projectName: sheetName,
                records
              });
            }
          }
        } catch (error) {
          console.error(`Error processing sheet ${sheetName}:`, error);
          continue;
        }
      }
      
      return tasks;
    } catch (error) {
      console.error('Error getting task sheets data:', error);
      return [];
    }
  }

  // Method to process sheet data from Google Sheets API
  private async processSheetData(sheetId: string): Promise<{
    contacts: Contact[];
    tasks: Array<{
      projectName: string;
      records: any[];
    }>;
  }> {
    // Get contacts from the "contacts" sheet
    const contacts = await this.getContactsFromSheet(sheetId);
    
    // Get tasks from all other sheets
    const tasks = await this.getTaskSheetsData(sheetId);
    
    return { contacts, tasks };
  }

  // Main method to check tasks from a specific sheet
  async checkTasksFromSheet(sheetId: string): Promise<string> {
    console.log('Starting task check for sheet:', sheetId);
    
    try {
      // Process the sheet data - get contacts from "contacts" sheet and tasks from other sheets
      const { contacts, tasks } = await this.processSheetData(sheetId);
      
      if (contacts.length === 0) {
        console.warn('No contacts found in sheet');
      }

      // Process each task group
      for (const taskGroup of tasks) {
        const projectName = taskGroup.projectName;
        console.log('Processing project:', projectName);
        
        if (taskGroup.records.length === 0) {
          continue;
        }

        let rowNumber = 1;
        const pageUserIdsAndNames: Array<[string, string]> = [];
        
        // Get manager from first row or use default
        const manager = taskGroup.records.length > 0 
          ? this.getSpecificContact(contacts, taskGroup.records[0]?.owner || '')
          : { number: '0', name1: 'Default Manager', mail: 'manager@example.com', phone: '0000000000' };
        
        // Process each record
        for (const record of taskGroup.records) {
          console.log(`Processing row ${rowNumber} for project ${projectName}`);
          
          try {
            // Get contact info for the task owner
            const contact = record.owner && record.owner.trim() 
              ? this.getSpecificContact(contacts, record.owner)
              : { number: '0', name1: 'Unknown', mail: 'Unknown', phone: 'Unknown' };

            // Parse dates
            const createdAt = this.parseDate(record['Start date']) || new Date();
            const dueDate = this.parseDate(record['Delivery date']);
            
            let send = true;

            // Create task object
            const taskObj = new TaskModel({
              created_at: createdAt,
              updated_at: new Date(),
              sheetID: sheetId,
              projectName: projectName,
              pageID: '0', // Default page ID
              row_number: rowNumber,
              ownerID: contact.number,
              ownerName: record.owner || '',
              ownerEmail: contact.mail,
              ownerPhone: contact.phone,
              managerID: manager.number, // Set manager's membership number
              managerName: manager.name1,
              points: record.points?.toString() || '',
              status: record.Status || '',
              taskText: record.Task || '',
              priority: record.Priority || '',
              dueDate,
              notes: record.Notes || '',
              milestone: record.Milestone || ''
            });

            // Populate telegram IDs from member sheet
            await this.populateTelegramIds(taskObj);

            // Add to user list if task is active
            if (taskObj.ownerID && taskObj.ownerName && 
                taskObj.status.toLowerCase() !== 'completed' && 
                taskObj.status.toLowerCase() !== 'blocked') {
              const userEntry: [string, string] = [taskObj.ownerID, taskObj.ownerName];
              if (!pageUserIdsAndNames.some(([id, name]) => id === userEntry[0] && name === userEntry[1])) {
                pageUserIdsAndNames.push(userEntry);
              }
            }

            // Check if task started
            if (createdAt > new Date(Date.now() + 10 * 60 * 1000)) { // 10 minutes in future
              send = false;
            }

            // Handle completed/blocked tasks
            if (taskObj.status.toLowerCase() === 'completed') {
              taskObj.completed_at = new Date();
              send = false;
            } else if (taskObj.status.toLowerCase() === 'blocked') {
              taskObj.blocked_at = new Date();
              send = false;
            }

            // Check if task exists
            const existingTask = await this.searchTask(sheetId, projectName, rowNumber);

            // Check for missing data
            const hasMissingData = !taskObj.ownerName?.trim() || 
                                   !taskObj.points?.trim() || 
                                   !taskObj.taskText?.trim() || 
                                   !taskObj.priority?.trim() || 
                                   !taskObj.dueDate;

            if (hasMissingData) {
              const shouldReport = !existingTask || 
                                   !existingTask.last_reported || 
                                   (existingTask.last_reported && 
                                    new Date(existingTask.last_reported).getTime() < Date.now() - 24 * 60 * 60 * 1000);
              
              if (shouldReport && send) {
                await this.sendToManagerMissingData(taskObj);
                taskObj.last_reported = new Date();
              }
              send = false;
            }

            if (existingTask) {
              // Handle existing task logic
              const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
              
              if (existingTask.last_sent && taskObj.dueDate) {
                const lastSentTime = new Date(existingTask.last_sent).getTime();
                
                if (lastSentTime > oneDayAgo) {
                  send = false;
                } else {
                  // Check if task is late or needs reminder
                  if (taskObj.dueDate.getTime() < Date.now()) {
                    if (send) {
                      // Pass the existing task ID for shame notifications
                      await this.sendLateTask(taskObj, existingTask.id);
                      taskObj.last_sent = new Date();
                      send = false;
                    }
                  } else {
                    if (send) {
                      await this.sendReminderTask(taskObj);
                      taskObj.last_sent = new Date();
                      send = false;
                    }
                  }
                }
              } else if (!existingTask.last_sent) {
                if (send) {
                  await this.sendNewTask(taskObj);
                  taskObj.last_sent = new Date();
                  send = false;
                }
              }

              // Check for task updates
              if (existingTask.ownerID !== taskObj.ownerID) {
                if (send) {
                  await this.sendNewTask(taskObj);
                  taskObj.last_sent = new Date();
                  send = false;
                }
              } else if (this.hasDateChanged(existingTask.dueDate, taskObj.dueDate)) {
                if (send) {
                  await this.sendUpdatedDueDateTask(existingTask, taskObj);
                  taskObj.last_sent = new Date();
                  send = false;
                }
              }

              // Preserve existing last_sent and last_reported values unless they were just updated
              if (!taskObj.last_sent && existingTask.last_sent) {
                taskObj.last_sent = existingTask.last_sent;
              }
              if (!taskObj.last_reported && existingTask.last_reported) {
                taskObj.last_reported = existingTask.last_reported;
              }

              // Update existing task
              await this.updateTaskById(existingTask.id!, taskObj);
            } else {
              // Create new task
              if (send) {
                await this.sendNewTask(taskObj);
                taskObj.last_sent = new Date();
              }
              await this.createNewTask(taskObj);
            }

          } catch (error) {
            console.error(`Error processing row ${rowNumber}:`, error);
          }
          
          rowNumber++;
        }

        // TODO: Handle activity reporting
        // const activity = await this.activityCrud.getOrCreateActivity(manager.number, manager.name1, projectName);
        // if (activity && shouldSendActivityReport(activity)) {
        //   await this.checkAndReportProjectActivity(pageUserIdsAndNames, manager);
        // }
      }

      return 'Tasks imported and sent successfully';
    } catch (error) {
      console.error('Error checking tasks from sheet:', error);
      throw error;
    }
  }

  // Check all sheets with better error handling and rate limiting
  async checkAllSheets(): Promise<void> {
    console.log('Starting check of all sheets');
    
    try {
      // Pre-load members cache once for all sheets
      await this.getMembersCache();
      console.log('Members cache loaded successfully');
      
      const sheets = await this.sheetCrud.getAll();
      let processedCount = 0;
      let errorCount = 0;
      
      for (const sheet of sheets) {
        try {
          console.log('Processing sheet:', sheet.sheetID);
          await this.checkTasksFromSheet(sheet.sheetID);
          processedCount++;
        } catch (error) {
          errorCount++;
          console.error(`Error processing sheet ${sheet.sheetID}:`, error);
          
          // If we hit a "Too many subrequests" error, log it and continue
          if (error instanceof Error && error.message.includes('Too many subrequests')) {
            console.error(`Subrequest limit reached at sheet ${sheet.sheetID}. Processed ${processedCount} sheets before error.`);
            // Continue processing other sheets - they might still work
          }
        }
      }
      
      console.log(`Finished processing sheets. Success: ${processedCount}, Errors: ${errorCount}, Total: ${sheets.length}`);
    } catch (error) {
      console.error('Error in checkAllSheets:', error);
      throw error;
    }
  }

  // Notification methods using Telegram instead of email
  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'غير محدد';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'غير محدد';
    
    // Format as YYYY-MM-DD
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    // return `${year}-${month}-${day}`;
    return `${day}-${month}-${year}`; // rtl format
  }

  private async sendNewTask(task: TaskModel): Promise<void> {
    const managerContact = task.manager_telegram_username 
      ? `@${escapeMarkdownV2(task.manager_telegram_username)}`
      : escapeMarkdownV2(task.managerName || 'غير محدّد');

    const text = `
🆕 *مهمّة جديدة*

📋 *المهمّة:* ${escapeMarkdownV2(task.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(task.priority)}
📅 *آخر موعد للتّسليم:* ${escapeMarkdownV2(this.formatDate(task.dueDate))}

📝 *ملاحظات:* ${escapeMarkdownV2(task.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
👨‍💼 *مسؤول المشروع:* ${managerContact}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})
`;

    try {
      // Get cached member to avoid extra API calls
      const membersMap = await this.getMembersCache();
      const cachedMember = membersMap.get(task.ownerID);
      
      // Send to task owner using their membership_id (ownerID)
      const result = await sendMessageToMember(this.env, task.ownerID, text, [], undefined, cachedMember);
      if (result.success) {
        console.log('New task notification sent to:', task.ownerName);
      } else {
        console.error('Error sending new task notification:', result.error);
        // Notify manager about the delivery failure
        await this.notifyManagerOfDeliveryFailure(
          task, 
          result.errorCode || 'UNKNOWN_ERROR', 
          result.error || 'Unknown error',
          'new'
        );
      }
    } catch (error) {
      console.error('Error sending new task notification:', error);
      // Notify manager about the delivery failure
      await this.notifyManagerOfDeliveryFailure(
        task, 
        'UNKNOWN_ERROR', 
        error instanceof Error ? error.message : 'Unknown error',
        'new'
      );
    }
  }

  private async sendReminderTask(task: TaskModel): Promise<void> {
    const managerContact = task.manager_telegram_username 
      ? `@${escapeMarkdownV2(task.manager_telegram_username)}`
      : escapeMarkdownV2(task.managerName || 'غير محدّد');

    const text = `
⏰ *تذكير بالمهمّة*

📋 *المهمّة:* ${escapeMarkdownV2(task.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(task.priority)}
📅 *آخر موعد للتّسليم:* ${escapeMarkdownV2(this.formatDate(task.dueDate))}

📝 *ملاحظات:* ${escapeMarkdownV2(task.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
👨‍💼 *مسؤول المشروع:* ${managerContact}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})
`;

    try {
      // Get cached member to avoid extra API calls
      const membersMap = await this.getMembersCache();
      const cachedMember = membersMap.get(task.ownerID);
      
      const result = await sendMessageToMember(this.env, task.ownerID, text, [], undefined, cachedMember);
      if (result.success) {
        console.log('Reminder task notification sent to:', task.ownerName);
      } else {
        console.error('Error sending reminder task notification:', result.error);
        // Notify manager about the delivery failure
        await this.notifyManagerOfDeliveryFailure(
          task, 
          result.errorCode || 'UNKNOWN_ERROR', 
          result.error || 'Unknown error',
          'reminder'
        );
      }
    } catch (error) {
      console.error('Error sending reminder task notification:', error);
      // Notify manager about the delivery failure
      await this.notifyManagerOfDeliveryFailure(
        task, 
        'UNKNOWN_ERROR', 
        error instanceof Error ? error.message : 'Unknown error',
        'reminder'
      );
    }
  }

  private async sendLateTask(task: TaskModel, taskId?: string): Promise<void> {
    const managerContact = task.manager_telegram_username
      ? `@${escapeMarkdownV2(task.manager_telegram_username)}`
      : escapeMarkdownV2(task.managerName || 'غير محدّد');

    // Check if task is delayed by 2+ days for shame notifications
    const isDelayedBy2Days = task.dueDate && 
      (Date.now() - new Date(task.dueDate).getTime()) > (2 * 24 * 60 * 60 * 1000);

    const text = `
🚨 *مهمّة متأخرة*

📋 *المهمّة:* ${escapeMarkdownV2(task.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(task.priority)}
📅 *كان آخر موعد للتّسليم:* ${escapeMarkdownV2(this.formatDate(task.dueDate))}

📝 *ملاحظات:* ${escapeMarkdownV2(task.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
👨‍💼 *مسؤول المشروع:* ${managerContact}

⚠️ *الرجاء التواصل مع مسؤول المشروع في أقرب وقت ممكن*

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})
`;

    try {
      // Get cached member to avoid extra API calls
      const membersMap = await this.getMembersCache();
      const cachedMember = membersMap.get(task.ownerID);
      
      const result = await sendMessageToMember(this.env, task.ownerID, text, [], undefined, cachedMember);
      if (result.success) {
        console.log('Late task notification sent to:', task.ownerName);
        
        // If task is delayed by 2+ days, automatically send shame notifications to project members
        // Use taskId parameter if provided, otherwise fall back to task.id
        const idToUse = taskId || task.id;
        if (isDelayedBy2Days && idToUse) {
          console.log('Task is 2+ days overdue, sending shame notifications to project members...');
          const { ShameService } = await import('./shame-service');
          const shameService = new ShameService(this.db, this.env);
          
          try {
            const shameResult = await shameService.sendShameNotifications(idToUse);
            if (shameResult.success) {
              console.log(`Shame notifications sent to ${shameResult.notifiedCount} project members`);
            } else {
              console.log('No shame notifications sent:', shameResult.error);
            }
          } catch (shameError) {
            console.error('Error sending shame notifications:', shameError);
            // Don't fail the late task notification if shame fails
          }
        } else if (isDelayedBy2Days && !idToUse) {
          console.warn('Task is 2+ days overdue but no task ID available for shame notifications');
        }
      } else {
        console.error('Error sending late task notification:', result.error);
        // Notify manager about the delivery failure
        await this.notifyManagerOfDeliveryFailure(
          task, 
          result.errorCode || 'UNKNOWN_ERROR', 
          result.error || 'Unknown error',
          'late'
        );
      }
    } catch (error) {
      console.error('Error sending late task notification:', error);
      // Notify manager about the delivery failure
      await this.notifyManagerOfDeliveryFailure(
        task, 
        'UNKNOWN_ERROR', 
        error instanceof Error ? error.message : 'Unknown error',
        'late'
      );
    }
  }

  private async sendUpdatedDueDateTask(oldTask: Task, newTask: TaskModel): Promise<void> {
    const managerContact = newTask.manager_telegram_username
      ? `@${escapeMarkdownV2(newTask.manager_telegram_username)}`
      : escapeMarkdownV2(newTask.managerName || 'غير محدّد');

    const text = `
📅 *تحديث موعد التسليم*

📋 *المهمّة:* ${escapeMarkdownV2(newTask.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(newTask.priority)}
📅 *الموعد الجديد:* ${escapeMarkdownV2(this.formatDate(newTask.dueDate))}
📅 *الموعد السابق:* ${escapeMarkdownV2(this.formatDate(oldTask.dueDate))}

📝 *ملاحظات:* ${escapeMarkdownV2(newTask.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(newTask.projectName)}
👨‍💼 *مسؤول المشروع:* ${managerContact}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${newTask.sheetID}/?gid=${newTask.pageID})
`;

    try {
      // Get cached member to avoid extra API calls
      const membersMap = await this.getMembersCache();
      const cachedMember = membersMap.get(newTask.ownerID);
      
      const result = await sendMessageToMember(this.env, newTask.ownerID, text, [], undefined, cachedMember);
      if (result.success) {
        console.log('Updated due date notification sent to:', newTask.ownerName);
      } else {
        console.error('Error sending updated due date notification:', result.error);
        // Notify manager about the delivery failure
        await this.notifyManagerOfDeliveryFailure(
          newTask, 
          result.errorCode || 'UNKNOWN_ERROR', 
          result.error || 'Unknown error',
          'updated'
        );
      }
    } catch (error) {
      console.error('Error sending updated due date notification:', error);
      // Notify manager about the delivery failure
      await this.notifyManagerOfDeliveryFailure(
        newTask, 
        'UNKNOWN_ERROR', 
        error instanceof Error ? error.message : 'Unknown error',
        'updated'
      );
    }
  }

  private async sendToManagerMissingData(task: TaskModel): Promise<void> {
    const missingFields = [];
    if (!task.ownerName?.trim()) missingFields.push('اسم المسؤول');
    if (!task.points?.trim()) missingFields.push('النقاط');
    if (!task.taskText?.trim()) missingFields.push('وصف المهمة');
    if (!task.priority?.trim()) missingFields.push('الأولوية');
    if (!task.dueDate) missingFields.push('تاريخ التسليم');

    const text = `
⚠️ *بيانات ناقصة في المهمة*

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
📍 *السّطر:* ${escapeMarkdownV2((task.row_number + 1)?.toString() || '')}

❌ *البيانات الناقصة:*
${missingFields.map(field => `• ${escapeMarkdownV2(field)}`).join('\n')}

📝 *المهمة الحالية:* ${escapeMarkdownV2(task.taskText || 'غير محددة')}
👤 *المسؤول الحالي:* ${escapeMarkdownV2(task.ownerName || 'غير محدد')}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})

الرجاء استكمال البيانات الناقصة في الملف\\.
`;

    try {
      // Check if manager ID exists before sending
      if (!task.managerID) {
        console.error('Cannot send missing data notification: Manager ID not found in task');
        return;
      }

      // Get cached member to avoid extra API calls
      const membersMap = await this.getMembersCache();
      const cachedMember = membersMap.get(task.managerID);
      
      // Send to manager using their membership_id
      const result = await sendMessageToMember(this.env, task.managerID, text, [], undefined, cachedMember);
      if (result.success) {
        console.log('Missing data notification sent to manager:', task.managerName);
      } else {
        console.error('Error sending missing data notification to manager:', result.error);
      }
    } catch (error) {
      console.error('Error sending missing data notification to manager:', error);
    }
  }

  /**
   * Notify manager when a user fails to receive a task message
   */
  private async notifyManagerOfDeliveryFailure(
    task: TaskModel, 
    errorCode: string, 
    errorMessage: string,
    taskType: 'new' | 'reminder' | 'late' | 'updated'
  ): Promise<void> {
    if (!task.managerID) {
      console.error('Cannot notify manager of delivery failure: Manager ID not found in task');
      return;
    }

    // Map error codes to user-friendly Arabic messages
    const errorReasons: Record<string, string> = {
      'BOT_BLOCKED': 'المستخدم قام بحظر البوت',
      'NOT_STARTED': 'المستخدم لم يبدأ المحادثة مع البوت بعد',
      'CHAT_NOT_FOUND': 'حساب المستخدم غير موجود أو غير صالح',
      'NO_TELEGRAM_ID': 'المستخدم لم يسجل حساب تيليجرام في النظام',
      'MEMBER_NOT_FOUND': 'المستخدم غير موجود في قاعدة البيانات',
      'RATE_LIMIT': 'تم تجاوز حد الإرسال المسموح',
      'BAD_REQUEST': 'خطأ في البيانات المرسلة',
      'UNKNOWN_ERROR': 'خطأ غير معروف'
    };

    const taskTypeArabic: Record<string, string> = {
      'new': 'مهمة جديدة',
      'reminder': 'تذكير بمهمة',
      'late': 'مهمة متأخرة',
      'updated': 'تحديث موعد مهمة'
    };

    const reason = errorReasons[errorCode] || errorReasons['UNKNOWN_ERROR'];
    const taskTypeText = taskTypeArabic[taskType] || 'رسالة';

    const text = `
🚫 *فشل إرسال رسالة إلى عضو*

📋 *نوع الرسالة:* ${escapeMarkdownV2(taskTypeText)}
👤 *العضو:* ${escapeMarkdownV2(task.ownerName || 'غير محدد')}
🆔 *رقم العضوية:* ${escapeMarkdownV2(task.ownerID)}
${task.owner_telegram_username ? `📱 *معرف التيليجرام:* @${escapeMarkdownV2(task.owner_telegram_username)}\n` : ''}

❌ *سبب الفشل:* ${escapeMarkdownV2(reason)}

📝 *المهمة:* ${escapeMarkdownV2(task.taskText)}
🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
📅 *آخر موعد للتسليم:* ${escapeMarkdownV2(this.formatDate(task.dueDate))}

⚠️ *يرجى أخذ الإجراء المناسب، أو التّواصل مع مكتب التحوّل الرّقمي لطلب المساعدة*

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})
`;

    try {
      const membersMap = await this.getMembersCache();
      const cachedManager = membersMap.get(task.managerID);
      
      const result = await sendMessageToMember(this.env, task.managerID, text, [], undefined, cachedManager);
      if (result.success) {
        console.log(`Delivery failure notification sent to manager: ${task.managerName} about ${task.ownerName}`);
      } else {
        console.error('Error sending delivery failure notification to manager:', result.error);
      }
    } catch (error) {
      console.error('Error sending delivery failure notification to manager:', error);
    }
  }

  // Check tasks during work hours (8 AM to 10 PM Istanbul time)
  async checkAllSheetsAtWorkHours(): Promise<void> {
    const istanbulTime = new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' });
    const hour = new Date(istanbulTime).getHours();
    
    if (hour >= 8 && hour < 22) {
      console.log('Running check_all_sheets_at_work_hours at:', new Date());
      await this.checkAllSheets();
    } else {
      console.log('Outside of working hours. Current time:', istanbulTime);
    }
  }

  // Get tasks that need attention (overdue, due soon, etc.)
  async getTasksNeedingAttention(): Promise<{
    overdue: Task[];
    dueSoon: Task[];
    blocked: Task[];
  }> {
    const [overdue, dueSoon, blocked] = await Promise.all([
      this.taskCrud.getOverdueTasks(),
      this.taskCrud.getTasksDueSoon(3), // Due within 3 days
      this.taskCrud.getBlockedTasks()
    ]);

    return { overdue, dueSoon, blocked };
  }
}