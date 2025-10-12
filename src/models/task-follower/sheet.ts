export interface Sheet {
  id?: string;
  sheetID: string;
  sheetName: string;
  created_at: Date;
}

export class SheetModel implements Sheet {
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