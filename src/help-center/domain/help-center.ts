import { ApiProperty } from '@nestjs/swagger';

export enum HelpCenterCategory {
  GETTING_STARTED = 'getting_started',
  PLANS_AND_PAYMENTS = 'plans_and_payments',
  TROUBLESHOOTING = 'troubleshooting',
  FAQ = 'faq',
}

export enum HelpCenterParent {
  // Getting Started
  SETTING_UP = 'setting_up',
  USING_ESIM = 'using_esim',
  DEVICE_COMPATIBILITY = 'device_compatibility',
  // Plans and Payments
  PAYMENTS = 'payments',
  PLANS = 'plans',
  // Troubleshooting
  FIND_AN_ANSWER = 'find_an_answer',
  // FAQ
  ESIM_FUNCTIONS = 'esim_functions',
  ESIM_BASICS = 'esim_basics',
  ABOUT_ESIMVN = 'about_esimvn',
}

export class HelpCenter {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String, nullable: true })
  slug?: string | null;

  @ApiProperty({ type: String, nullable: true })
  language?: string | null;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  content: string;

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ enum: HelpCenterCategory })
  category: HelpCenterCategory;

  @ApiProperty({ enum: HelpCenterParent })
  parent: HelpCenterParent;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
