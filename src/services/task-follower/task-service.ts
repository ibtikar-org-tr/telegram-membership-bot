import { TaskCrud } from '../../crud/task-follower/task';
import { SheetCrud } from '../../crud/task-follower/sheet';
import { ActivityCrud } from '../../crud/task-follower/activity';
import { Task, TaskModel } from '../../models/task-follower/task';
import { Sheet } from '../../models/task-follower/sheet';
import { GoogleSheetsService } from '../google-sheets';
import { TelegramService } from '../telegram';
import { sendMessageToMember } from '../membership-manager/member-services';
import { Environment } from '../../types';
import { DatabaseConnection } from '../../crud/base';
import { escapeMarkdownV2 } from '../../utils/helpers';

interface Contact {
  number: string; // this is the membership_number
  name1: string;
  mail: string;
  phone: string;
}

interface Manager extends Contact {}

export class TaskService {
  private db: DatabaseConnection;
  private taskCrud: TaskCrud;
  private sheetCrud: SheetCrud;
  private activityCrud: ActivityCrud;
  private googleSheetsService: GoogleSheetsService;
  private telegramService: TelegramService;
  private env: Environment;

  constructor(db: DatabaseConnection, env: Environment) {
    this.db = db;
    this.env = env;
    this.taskCrud = new TaskCrud(db);
    this.sheetCrud = new SheetCrud(db);
    this.activityCrud = new ActivityCrud(db);
    this.googleSheetsService = new GoogleSheetsService(env);
    this.telegramService = new TelegramService(env);
  }

  // Basic CRUD operations (delegating to TaskCrud)
  async getAllTasks(): Promise<Task[]> {
    return await this.taskCrud.getAll();
  }

  async createNewTask(task: TaskModel): Promise<Task | null> {
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
          phone: contact.phone || 'Unknown'
        };
      }
    } catch (error) {
      console.error('Error finding contact:', error);
    }
    
    return {
      number: '0',
      name1: ownerName || 'Unknown',
      mail: 'Unknown',
      phone: 'Unknown'
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
        
        for (const row of rows) {
          if (row && row.length > 0 && row[0]) { // Skip empty rows
            contacts.push({
              number: (numberIndex >= 0 ? row[numberIndex] : row[0]) || '0',
              name1: (name1Index >= 0 ? row[name1Index] : row[1]) || 'Unknown',
              mail: (mailIndex >= 0 ? row[mailIndex] : row[2]) || 'Unknown',
              phone: (phoneIndex >= 0 ? row[phoneIndex] : row[3]) || 'Unknown'
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
              managerName: manager.name1,
              points: record.points?.toString() || '',
              status: record.Status || '',
              taskText: record.Task || '',
              priority: record.Priority || '',
              dueDate,
              notes: record.Notes || '',
              milestone: record.Milestone || ''
            });

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
                await this.sendToManagerMissingData(taskObj, manager);
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
                      await this.sendLateTask(taskObj, manager);
                      taskObj.last_sent = new Date();
                      send = false;
                    }
                  } else {
                    if (send) {
                      await this.sendReminderTask(taskObj, manager);
                      taskObj.last_sent = new Date();
                      send = false;
                    }
                  }
                }
              } else if (!existingTask.last_sent) {
                if (send) {
                  await this.sendNewTask(taskObj, manager);
                  taskObj.last_sent = new Date();
                  send = false;
                }
              }

              // Check for task updates
              if (existingTask.ownerID !== taskObj.ownerID) {
                if (send) {
                  await this.sendNewTask(taskObj, manager);
                  taskObj.last_sent = new Date();
                  send = false;
                }
              } else if (this.hasDateChanged(existingTask.dueDate, taskObj.dueDate)) {
                if (send) {
                  await this.sendUpdatedDueDateTask(existingTask, taskObj, manager);
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
                await this.sendNewTask(taskObj, manager);
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

  // Check all sheets
  async checkAllSheets(): Promise<void> {
    console.log('Starting check of all sheets');
    
    const sheets = await this.sheetCrud.getAll();
    for (const sheet of sheets) {
      try {
        console.log('Processing sheet:', sheet.sheetID);
        await this.checkTasksFromSheet(sheet.sheetID);
      } catch (error) {
        console.error(`Error processing sheet ${sheet.sheetID}:`, error);
      }
    }
  }

  // Notification methods using Telegram instead of email
  private async sendNewTask(task: TaskModel, manager: Manager): Promise<void> {
    const text = `
🆕 *مهمّة جديدة*

📋 *المهمّة:* ${escapeMarkdownV2(task.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(task.priority)}
📅 *آخر موعد للتّسليم:* ${task.dueDate ? escapeMarkdownV2(task.dueDate.toLocaleDateString('ar')) : 'غير محدد'}

📝 *ملاحظات:* ${escapeMarkdownV2(task.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
👨‍💼 *مسؤول المشروع:* ${escapeMarkdownV2(manager.name1)}
📞 *رقم المسؤول:* wa\\.me/${escapeMarkdownV2(manager.phone)}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})
`;

    try {
      // Send to task owner using their membership_id (ownerID)
      const result = await sendMessageToMember(this.env, task.ownerID, text, []);
      if (result.success) {
        console.log('New task notification sent to:', task.ownerName);
      } else {
        console.error('Error sending new task notification:', result.error);
      }
    } catch (error) {
      console.error('Error sending new task notification:', error);
    }
  }

  private async sendReminderTask(task: TaskModel, manager: Manager): Promise<void> {
    const text = `
⏰ *تذكير بالمهمّة*

📋 *المهمّة:* ${escapeMarkdownV2(task.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(task.priority)}
📅 *آخر موعد للتّسليم:* ${task.dueDate ? escapeMarkdownV2(task.dueDate.toLocaleDateString('ar')) : 'غير محدد'}

📝 *ملاحظات:* ${escapeMarkdownV2(task.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
👨‍💼 *مسؤول المشروع:* ${escapeMarkdownV2(manager.name1)}
📞 *رقم المسؤول:* wa\\.me/${escapeMarkdownV2(manager.phone)}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})
`;

    try {
      const result = await sendMessageToMember(this.env, task.ownerID, text, []);
      if (result.success) {
        console.log('Reminder task notification sent to:', task.ownerName);
      } else {
        console.error('Error sending reminder task notification:', result.error);
      }
    } catch (error) {
      console.error('Error sending reminder task notification:', error);
    }
  }

  private async sendLateTask(task: TaskModel, manager: Manager): Promise<void> {
    const text = `
🚨 *مهمّة متأخرة*

📋 *المهمّة:* ${escapeMarkdownV2(task.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(task.priority)}
📅 *كان آخر موعد للتّسليم:* ${task.dueDate ? escapeMarkdownV2(task.dueDate.toLocaleDateString('ar')) : 'غير محدد'}

📝 *ملاحظات:* ${escapeMarkdownV2(task.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
👨‍💼 *مسؤول المشروع:* ${escapeMarkdownV2(manager.name1)}
📞 *رقم المسؤول:* wa\\.me/${escapeMarkdownV2(manager.phone)}

⚠️ *الرجاء التواصل مع مسؤول المشروع في أقرب وقت ممكن*

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})
`;

    try {
      const result = await sendMessageToMember(this.env, task.ownerID, text, []);
      if (result.success) {
        console.log('Late task notification sent to:', task.ownerName);
      } else {
        console.error('Error sending late task notification:', result.error);
      }
    } catch (error) {
      console.error('Error sending late task notification:', error);
    }
  }

  private async sendUpdatedDueDateTask(oldTask: Task, newTask: TaskModel, manager: Manager): Promise<void> {
    const text = `
📅 *تحديث موعد التسليم*

📋 *المهمّة:* ${escapeMarkdownV2(newTask.taskText)}
⚡ *الاستعجاليّة:* ${escapeMarkdownV2(newTask.priority)}
📅 *الموعد الجديد:* ${newTask.dueDate ? escapeMarkdownV2(newTask.dueDate.toLocaleDateString('ar')) : 'غير محدد'}
📅 *الموعد السابق:* ${oldTask.dueDate ? escapeMarkdownV2(new Date(oldTask.dueDate).toLocaleDateString('ar')) : 'غير محدد'}

📝 *ملاحظات:* ${escapeMarkdownV2(newTask.notes || 'لا توجد ملاحظات')}

🏗️ *المشروع:* ${escapeMarkdownV2(newTask.projectName)}
👨‍💼 *مسؤول المشروع:* ${escapeMarkdownV2(manager.name1)}
📞 *رقم المسؤول:* wa\\.me/${escapeMarkdownV2(manager.phone)}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${newTask.sheetID}/?gid=${newTask.pageID})
`;

    try {
      const result = await sendMessageToMember(this.env, newTask.ownerID, text, []);
      if (result.success) {
        console.log('Updated due date notification sent to:', newTask.ownerName);
      } else {
        console.error('Error sending updated due date notification:', result.error);
      }
    } catch (error) {
      console.error('Error sending updated due date notification:', error);
    }
  }

  private async sendToManagerMissingData(task: TaskModel, manager: Manager): Promise<void> {
    const missingFields = [];
    if (!task.ownerName?.trim()) missingFields.push('اسم المسؤول');
    if (!task.points?.trim()) missingFields.push('النقاط');
    if (!task.taskText?.trim()) missingFields.push('وصف المهمة');
    if (!task.priority?.trim()) missingFields.push('الأولوية');
    if (!task.dueDate) missingFields.push('تاريخ التسليم');

    const text = `
⚠️ *بيانات ناقصة في المهمة*

🏗️ *المشروع:* ${escapeMarkdownV2(task.projectName)}
📍 *الصف:* ${escapeMarkdownV2(task.row_number?.toString() || '')}

❌ *البيانات الناقصة:*
${missingFields.map(field => `• ${escapeMarkdownV2(field)}`).join('\n')}

📝 *المهمة الحالية:* ${escapeMarkdownV2(task.taskText || 'غير محددة')}
👤 *المسؤول الحالي:* ${escapeMarkdownV2(task.ownerName || 'غير محدد')}

🔗 [رابط ملف المتابعة](https://docs.google.com/spreadsheets/d/${task.sheetID}/?gid=${task.pageID})

الرجاء استكمال البيانات الناقصة في الملف\\.
`;

    try {
      // Send to manager using their membership_id
      const result = await sendMessageToMember(this.env, manager.number, text, []);
      if (result.success) {
        console.log('Missing data notification sent to manager:', manager.name1);
      } else {
        console.error('Error sending missing data notification to manager:', result.error);
      }
    } catch (error) {
      console.error('Error sending missing data notification to manager:', error);
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