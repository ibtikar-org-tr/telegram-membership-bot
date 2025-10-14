export interface Sheet {
  id?: string;
  sheetID: string;
  sheetName: string;
  created_at: Date;
}

export class TaskSheetModel implements Sheet { // this model is used for the task-google-sheet only
  id?: string;
  sheetID: string;
  sheetName: string;
  created_at: Date;

  constructor(data: Omit<Sheet, 'id' | 'created_at'> & { 
    id?: string;
    created_at?: Date;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.sheetID = data.sheetID;
    this.sheetName = data.sheetName;
    this.created_at = data.created_at || new Date();
  }

  static tableName = 'sheets';
}