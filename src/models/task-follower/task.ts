export interface Task { // represents a task extracted from a Google Sheet (Task Google Sheet)
  id?: string;
  created_at: Date;
  updated_at: Date;
  last_sent?: Date | null;
  last_reported?: Date | null;
  sheetID: string; // google sheet ID
  projectName: string;
  pageID: string; // google sheet page ID
  row_number: number;
  ownerID: string; // membership_number for the member (owner of the task)
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  owner_telegram_id?: string | null; // Telegram ID of the task owner
  owner_telegram_username?: string | null; // Telegram username of the task owner
  managerID?: string | null; // membership_number of the manager
  managerName: string;
  manager_telegram_id?: string | null; // Telegram ID of the manager
  manager_telegram_username?: string | null; // Telegram username of the manager
  points: string;
  status: string;
  taskText: string;
  priority: string;
  dueDate?: Date | null;
  completed_at?: Date | null;
  blocked_at?: Date | null;
  notes?: string | null;
  milestone: string;
}

export class TaskModel implements Task {
  id?: string;
  created_at: Date;
  updated_at: Date;
  last_sent?: Date | null;
  last_reported?: Date | null;
  sheetID: string;
  projectName: string;
  pageID: string;
  row_number: number;
  ownerID: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  owner_telegram_id?: string | null;
  owner_telegram_username?: string | null;
  managerID?: string | null;
  managerName: string;
  manager_telegram_id?: string | null;
  manager_telegram_username?: string | null;
  points: string;
  status: string;
  taskText: string;
  priority: string;
  dueDate?: Date | null;
  completed_at?: Date | null;
  blocked_at?: Date | null;
  notes?: string | null;
  milestone: string;

  constructor(data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'milestone'> & { 
    id?: string;
    created_at?: Date;
    updated_at?: Date;
    milestone?: string;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    // Convert undefined to null for D1 database compatibility
    this.last_sent = data.last_sent ?? null;
    this.last_reported = data.last_reported ?? null;
    this.sheetID = data.sheetID;
    this.projectName = data.projectName;
    this.pageID = data.pageID;
    this.row_number = data.row_number;
    this.ownerID = data.ownerID;
    this.ownerName = data.ownerName;
    this.ownerEmail = data.ownerEmail;
    this.ownerPhone = data.ownerPhone;
    this.owner_telegram_id = data.owner_telegram_id ?? null;
    this.owner_telegram_username = data.owner_telegram_username ?? null;
    this.managerID = data.managerID ?? null;
    this.managerName = data.managerName;
    this.manager_telegram_id = data.manager_telegram_id ?? null;
    this.manager_telegram_username = data.manager_telegram_username ?? null;
    this.points = data.points;
    this.status = data.status;
    this.taskText = data.taskText;
    this.priority = data.priority;
    this.dueDate = data.dueDate ?? null;
    this.completed_at = data.completed_at ?? null;
    this.blocked_at = data.blocked_at ?? null;
    this.notes = data.notes ?? null;
    this.milestone = data.milestone || '';
  }

  static tableName = 'tasks';
}