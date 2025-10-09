export interface Member {
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