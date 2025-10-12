export interface Activity {
  id?: string;
  created_at: Date;
  updated_at: Date;
  last_reported?: Date | null;
  managerName: string;
  managerID: string;
  projectName: string;
}

// Daily checkup for the manager
export class ActivityModel implements Activity {
  id?: string;
  created_at: Date;
  updated_at: Date;
  last_reported?: Date | null;
  managerName: string;
  managerID: string;
  projectName: string;

  constructor(data: Omit<Activity, 'id' | 'created_at' | 'updated_at'> & { 
    id?: string;
    created_at?: Date;
    updated_at?: Date;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.last_reported = data.last_reported;
    this.managerName = data.managerName;
    this.managerID = data.managerID;
    this.projectName = data.projectName;
  }

  static tableName = 'activities';
}