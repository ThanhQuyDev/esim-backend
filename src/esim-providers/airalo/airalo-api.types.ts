export interface AiraloTokenResponse {
  data: {
    token_type: string;
    expires_in: number;
    access_token: string;
  };
}

export interface AiraloNetwork {
  name: string;
  types: string[];
}

export interface AiraloCoverage {
  name: string;
  code: string;
  networks: AiraloNetwork[];
}

export interface AiraloPackage {
  id: string;
  type: string;
  price: number;
  amount: number;
  day: number;
  is_unlimited: boolean;
  title: string;
  short_info: string | null;
  data: string;
  voice: number | null;
  text: number | null;
  net_price: number;
}

export interface AiraloOperator {
  id: number;
  title: string;
  type: string;
  plan_type: string;
  activation_policy: string;
  rechargeability: boolean;
  is_kyc_verify?: boolean;
  apn_value?: string;
  coverages: AiraloCoverage[];
  packages: AiraloPackage[];
  countries?: AiraloOperatorCountry[];
}

export interface AiraloOperatorCountry {
  country_code: string;
  title: string;
  image: {
    width: number;
    height: number;
    url: string;
  };
}

export interface AiraloCountry {
  slug: string;
  country_code: string;
  title: string;
  image: {
    width: number;
    height: number;
    url: string;
  };
  operators: AiraloOperator[];
}

export interface AiraloOrderAsyncRequest {
  quantity: number;
  package_id: string;
  type: 'sim' | 'esim';
  description?: string;
  webhook_url?: string;
}

export interface AiraloOrderAsyncResponse {
  data: {
    request_id: string;
    accepted_at: string;
  };
  meta: {
    message: string;
  };
}

export interface AiraloPackagesResponse {
  data: AiraloCountry[];
  meta: {
    message: string;
    current_page: number;
    from: number;
    last_page: number;
    path: string;
    per_page: string;
    to: number;
    total: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}
