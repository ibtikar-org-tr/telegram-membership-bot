import { Member, MemberUpdate } from '../types/member';
import { Environment, MemberGoogleSheetIndex } from '../types';

export interface GoogleCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class GoogleSheetsService {
  private env: Environment;
  private sheetIndex: MemberGoogleSheetIndex;
  private credentials: GoogleCredentials;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(env: Environment) {
    this.env = env;
    this.sheetIndex = JSON.parse(env.MEMBER_GOOGLE_SHEET_INDEX);
    this.credentials = JSON.parse(env.GOOGLE_API_KEY);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour

    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: this.credentials.private_key_id,
    };

    const payload = {
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp,
      iat: now,
    };

    // Create JWT token
    const jwt = await this.createJWT(header, payload, this.credentials.private_key);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    return this.accessToken;
  }

  private async createJWT(header: any, payload: any, privateKey: string): Promise<string> {
    const encoder = new TextEncoder();
    
    const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const data = `${headerBase64}.${payloadBase64}`;
    
    // Import private key
    const key = await crypto.subtle.importKey(
      'pkcs8',
      this.pemToArrayBuffer(privateKey),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(data));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    
    return `${data}.${signatureBase64}`;
  }

  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, '');
    
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async makeRequest(url: string, options: RequestInit = {}) {
    const token = await this.getAccessToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers as Record<string, string>,
    };

    const response = await fetch(url, {
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
      // Normalize to lowercase first, then convert to uppercase for processing
      const normalizedIndex = columnIndex.toUpperCase();
      let numIndex = 0;
      
      // Handle multi-character column names (AA, AB, etc.)
      for (let i = 0; i < normalizedIndex.length; i++) {
        numIndex = numIndex * 26 + (normalizedIndex.charCodeAt(i) - 64);
      }
      
      // Convert to 0-based index (A=0, B=1, etc.)
      const zeroBasedIndex = numIndex - 1;
      return row[zeroBasedIndex] || '';
    }
    return row[columnIndex] || '';
  }

  // Google Sheets API methods
  async getSheetData(range: string): Promise<any[][]> {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.env.MEMBER_GOOGLE_SHEET_ID}/values/${range}`,
      {
        headers: {
          'Authorization': `Bearer ${await this.getAccessToken()}`,
        },
      }
    );

    const data = await response.json() as { values?: any[][] };
    return data.values || [];
  }

  async updateSheetData(range: string, values: any[][]): Promise<void> {
    const token = await this.getAccessToken();
    
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.env.MEMBER_GOOGLE_SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
        }),
      }
    );
  }

  async updateSingleCell(cellRange: string, value: any): Promise<void> {
    const token = await this.getAccessToken();
    
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.env.MEMBER_GOOGLE_SHEET_ID}/values/${cellRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[value]],
        }),
      }
    );
  }

  async getMembers(): Promise<Member[]> {
    const range = 'A:Z'; // Get all data
    const data = await this.getSheetData(range);
    
    if (data.length === 0) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return rows.map((row: any[]) => ({
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
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.env.MEMBER_GOOGLE_SHEET_ID}/values:batchUpdate`;
      
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
      // Normalize to uppercase for consistency
      return columnIndex.toLowerCase().toUpperCase();
    }
    
    let result = '';
    let index = columnIndex;
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  }
}