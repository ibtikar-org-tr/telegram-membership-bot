import { Member, MemberUpdate } from '../../types/member';
import { Environment, MemberGoogleSheetIndex } from '../../types';
import { GoogleSheetsService } from '../google-sheets';

export class MemberSheetServices {
  private env: Environment;
  private sheetIndex: MemberGoogleSheetIndex;
  private googleSheetsService: GoogleSheetsService;

  constructor(env: Environment) {
    this.env = env;
    this.sheetIndex = JSON.parse(env.MEMBER_GOOGLE_SHEET_INDEX);
    this.googleSheetsService = new GoogleSheetsService(env);
  }



  async getMembers(): Promise<Member[]> {
    const range = 'A:Z'; // Get all data
    const data = await this.googleSheetsService.getSheetData(range);
    
    if (data.length === 0) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return rows.map((row: any[]) => ({
      membership_number: this.googleSheetsService.getCellValue(row, this.sheetIndex.membership_number),
      ar_name: this.googleSheetsService.getCellValue(row, this.sheetIndex.ar_name),
      latin_name: this.googleSheetsService.getCellValue(row, this.sheetIndex.latin_name),
      whatsapp: this.googleSheetsService.getCellValue(row, this.sheetIndex.whatsapp),
      email: this.googleSheetsService.getCellValue(row, this.sheetIndex.email),
      sex: this.googleSheetsService.getCellValue(row, this.sheetIndex.sex),
      password: this.googleSheetsService.getCellValue(row, this.sheetIndex.password),
      phone: this.googleSheetsService.getCellValue(row, this.sheetIndex.phone),
      telegram_id: this.googleSheetsService.getCellValue(row, this.sheetIndex.telegram_id),
      telegram_username: this.googleSheetsService.getCellValue(row, this.sheetIndex.telegram_username),
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
        range: `Sheet1!${this.googleSheetsService.getColumnLetter(this.sheetIndex.telegram_id)}${memberIndex + 2}`,
        values: [[memberUpdate.telegram_id]]
      });
    }
    
    if (memberUpdate.telegram_username) {
      updates.push({
        range: `Sheet1!${this.googleSheetsService.getColumnLetter(this.sheetIndex.telegram_username)}${memberIndex + 2}`,
        values: [[memberUpdate.telegram_username]]
      });
    }

    if (updates.length > 0) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.env.MEMBER_GOOGLE_SHEET_ID}/values:batchUpdate`;
      
      await this.googleSheetsService.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: updates
        })
      });
    }
  }
}