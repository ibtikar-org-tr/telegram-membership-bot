export interface User {
  id?: string;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  last_login: Date;
}

export class UserModel implements User {
  id?: string;
  username: string;
  email: string;
  password: string;
  created_at: Date;
  last_login: Date;

  constructor(data: Omit<User, 'id'> & { id?: string }) {
    this.id = data.id || crypto.randomUUID();
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.created_at = data.created_at;
    this.last_login = data.last_login;
  }

  static tableName = 'users';
}