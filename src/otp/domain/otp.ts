import { User } from '../../users/domain/user';

export class Otp {
  id: number;
  user: User;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}
