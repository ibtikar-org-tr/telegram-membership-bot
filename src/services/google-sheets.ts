import { Member, MemberUpdate } from '../types/member';
import { Environment, GoogleSheetIndex } from '../types';

export class GoogleSheetsService {
  private env: Environment;
  private sheetIndex: GoogleSheetIndex;
  private apiKey: any;

  constructor(env: Environment) {
    this.env = env;
    this.sheetIndex = JSON.parse(env.GOOGLE_SHEET_INDEX);
    this.apiKey = JSON.parse(env.GOOGLE_API_KEY);
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getMembers(): Promise<Member[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.env.GOOGLE_SHEET_ID}/values/Sheet1?key=${this.apiKey.api_key || this.env.GOOGLE_API_KEY}`;
    
    const data = await this.makeRequest(url);
    const rows = data.values || [];
    
    // Skip header row
    const memberRows = rows.slice(1);
    
    return memberRows.map((row: any[]) => ({
      membership_number: row[this.sheetIndex.membership_number] || '',
      ar_name: row[this.sheetIndex.ar_name] || '',
      latin_name: row[this.sheetIndex.latin_name] || '',
      whatsapp: row[this.sheetIndex.whatsapp] || '',
      email: row[this.sheetIndex.email] || '',
      sex: row[this.sheetIndex.sex] || '',
      password: row[this.sheetIndex.password] || '',
      phone: row[this.sheetIndex.phone] || '',
      telegram_id: row[this.sheetIndex.telegram_id] || '',
      telegram_username: row[this.sheetIndex.telegram_username] || '',
    }));
  }

  async getMemberByEmail(email: string): Promise<Member | null> {
    const members = await this.getMembers();
    return members.find(member => member.email === email) || null;
  }

  async getMemberByMembershipNumber(membershipNumber: string): Promise<Member | null> {
    const members = await this.getMembers();
    return members.find(member => member.membership_number === membershipNumber) || null;
  }

  async updateMember(memberUpdate: MemberUpdate): Promise<void> {
    const members = await this.getMembers();
    const memberIndex = members.findIndex(m => m.membership_number === memberUpdate.membership_number);
    
    if (memberIndex === -1) {
      throw new Error('Member not found');
    }

    // Create the update data
    const updates: any[] = [];
    
    if (memberUpdate.telegram_id) {
      updates.push({
        range: `Sheet1!${this.getColumnLetter(this.sheetIndex.telegram_id)}${memberIndex + 2}`,
        values: [[memberUpdate.telegram_id]]
      });
    }
    
    if (memberUpdate.telegram_username) {
      updates.push({
        range: `Sheet1!${this.getColumnLetter(this.sheetIndex.telegram_username)}${memberIndex + 2}`,
        values: [[memberUpdate.telegram_username]]
      });
    }

    if (updates.length > 0) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.env.GOOGLE_SHEET_ID}/values:batchUpdate?key=${this.apiKey.api_key || this.env.GOOGLE_API_KEY}`;
      
      await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates
        })
      });
    }
  }

  private getColumnLetter(columnIndex: number): string {
    let result = '';
    while (columnIndex >= 0) {
      result = String.fromCharCode(65 + (columnIndex % 26)) + result;
      columnIndex = Math.floor(columnIndex / 26) - 1;
    }
    return result;
  }
}