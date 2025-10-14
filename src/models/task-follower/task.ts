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
  managerName: string;
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
  managerName: string;
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
    this.last_sent = data.last_sent;
    this.last_reported = data.last_reported;
    this.sheetID = data.sheetID;
    this.projectName = data.projectName;
    this.pageID = data.pageID;
    this.row_number = data.row_number;
    this.ownerID = data.ownerID;
    this.ownerName = data.ownerName;
    this.ownerEmail = data.ownerEmail;
    this.ownerPhone = data.ownerPhone;
    this.managerName = data.managerName;
    this.points = data.points;
    this.status = data.status;
    this.taskText = data.taskText;
    this.priority = data.priority;
    this.dueDate = data.dueDate;
    this.completed_at = data.completed_at;
    this.blocked_at = data.blocked_at;
    this.notes = data.notes;
    this.milestone = data.milestone || '';
  }

  static tableName = 'tasks';
}