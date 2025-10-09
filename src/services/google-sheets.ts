import { Member, MemberUpdate } from '../types/member';
import { Environment, GoogleSheetIndex } from '../types';

export class GoogleSheetsService {
  private env: Environment;
  private sheetIndex: GoogleSheetIndex;
  private serviceAccount: any;

  constructor(env: Environment) {
    this.env = env;
    this.sheetIndex = JSON.parse(env.GOOGLE_SHEET_INDEX);
    
    // GOOGLE_API_KEY can now be either a simple API key string or service account JSON
    try {
      this.serviceAccount = JSON.parse(env.GOOGLE_API_KEY);
      console.log('Using service account JSON (not yet fully implemented)');
    } catch (error) {
      // If it's not valid JSON, treat it as a simple API key string
      this.serviceAccount = env.GOOGLE_API_KEY;
      console.log('Using simple API key');
    }
  }

  private async getAccessToken(): Promise<string> {
    // For now, we'll use a simpler approach with API key
    // Service account JWT signing is complex in Workers environment
    // TODO: Implement proper service account authentication
    return 'use_api_key';
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    let requestUrl = url;
    
    // Always append the API key parameter for Google Sheets API
    // The GOOGLE_API_KEY should now be a simple API key string after the secret update
    const apiKey = this.env.GOOGLE_API_KEY;
    
    if (apiKey) {
      // Add API key as query parameter
      requestUrl += (url.includes('?') ? '&' : '?') + `key=${apiKey}`;
    } else {
      throw new Error('GOOGLE_API_KEY environment variable is not set');
    }

    console.log(`Making request to: ${requestUrl.replace(/key=[^&]+/, 'key=***')}`);

    const response = await fetch(requestUrl, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private getCellValue(row: any[], columnIndex: number | string): string {
    if (typeof columnIndex === 'string') {
      // Convert letter to number (A=0, B=1, C=2, etc.)
      const upperIndex = columnIndex.toUpperCase();
      let numIndex = 0;
      for (let i = 0; i < upperIndex.length; i++) {
        numIndex = numIndex * 26 + (upperIndex.charCodeAt(i) - 64);
      }
      return row[numIndex - 1] || '';
    }
    return row[columnIndex] || '';
  }

  async getMembers(): Promise<Member[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.env.GOOGLE_SHEET_ID}/values/Sheet1`;
    
    const data = await this.makeRequest(url) as { values?: any[][] };
    const rows = data.values || [];
    
    // Skip header row
    const memberRows = rows.slice(1);
    
    return memberRows.map((row: any[]) => ({
      membership_number: this.getCellValue(row, this.sheetIndex.membership_number),
      ar_name: this.getCellValue(row, this.sheetIndex.ar_name),
      latin_name: this.getCellValue(row, this.sheetIndex.latin_name),
      whatsapp: this.getCellValue(row, this.sheetIndex.whatsapp),
      email: this.getCellValue(row, this.sheetIndex.email),
      sex: this.getCellValue(row, this.sheetIndex.sex),
      password: this.getCellValue(row, this.sheetIndex.password),
      phone: this.getCellValue(row, this.sheetIndex.phone),
      telegram_id: this.getCellValue(row, this.sheetIndex.telegram_id),
      telegram_username: this.getCellValue(row, this.sheetIndex.telegram_username),
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

  async getMemberByTelegramId(telegramId: string): Promise<Member | null> {
    const members = await this.getMembers();
    return members.find(member => member.telegram_id === telegramId) || null;
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
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.env.GOOGLE_SHEET_ID}/values:batchUpdate`;
      
      await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates
        })
      });
    }
  }

  private getColumnLetter(columnIndex: number | string): string {
    if (typeof columnIndex === 'string') {
      return columnIndex.toUpperCase();
    }
    
    let result = '';
    while (columnIndex >= 0) {
      result = String.fromCharCode(65 + (columnIndex % 26)) + result;
      columnIndex = Math.floor(columnIndex / 26) - 1;
    }
    return result;
  }
}