export interface Member { // this member model is used for membership-google-sheet only
  membership_number: string;
  ar_name: string;
  latin_name: string;
  whatsapp: string;
  email: string;
  sex: string;
  password: string;
  phone: string;
  telegram_id: string;
  telegram_username: string;
}

export interface MemberUpdate {
  membership_number: string;
  telegram_id?: string;
  telegram_username?: string;
}

export interface MemberGoogleSheetIndex { // The main Google Sheet (members sheet)
  membership_number: number | string;
  ar_name: number | string;
  latin_name: number | string;
  whatsapp: number | string;
  email: number | string;
  sex: number | string;
  password: number | string;
  phone: number | string;
  telegram_id: number | string;
  telegram_username: number | string;
}