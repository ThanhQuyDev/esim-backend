export interface EsimAccessOperator {
  operatorName: string;
  networkType: string;
}

export interface EsimAccessLocationNetwork {
  locationName: string;
  locationLogo: string;
  locationCode: string;
  operatorList: EsimAccessOperator[];
}

export interface EsimAccessPackage {
  packageCode: string;
  slug: string;
  name: string;
  price: number;
  currencyCode: string;
  volume: number;
  smsStatus: number;
  dataType: number;
  unusedValidTime: number;
  duration: number;
  durationUnit: string;
  location: string;
  locationCode: string;
  description: string;
  activeType: number;
  favorite: boolean;
  retailPrice: number;
  speed: string;
  ipExport: string;
  supportTopUpType: number;
  fupPolicy: string;
  locationNetworkList: EsimAccessLocationNetwork[];
}

export interface EsimAccessQueryEsimItem {
  esimTranNo: string;
  orderNo: string;
  transactionId: string;
  iccid: string;
  ac: string;
  qrCodeUrl: string;
  shortUrl?: string;
  smdpStatus?: string;
  esimStatus?: string;
  apn?: string;
  expiredTime?: string;
  activateTime?: string;
  totalVolume?: number;
  totalDuration?: number;
  durationUnit?: string;
}

export interface EsimAccessQueryEsimResponse {
  success: boolean;
  errorCode: string | null;
  errorMsg: string | null;
  obj: {
    esimList: EsimAccessQueryEsimItem[];
    pager: { pageSize: number; pageNum: number; total: number };
  };
}

export interface EsimAccessApiResponse {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: {
    packageList: EsimAccessPackage[];
  };
}

export interface EsimAccessOrderPackageInfo {
  packageCode: string;
  count: number;
  price: number;
}

export interface EsimAccessOrderRequest {
  transactionId: string;
  amount: number;
  packageInfoList: EsimAccessOrderPackageInfo[];
}

export interface EsimAccessOrderEsim {
  iccid: string;
  smdpAddress?: string;
  activationCode?: string;
  qrCodeUrl?: string;
}

export interface EsimAccessOrderResponse {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: {
    orderNo: string;
    transactionId: string;
    esimList?: EsimAccessOrderEsim[];
  };
}
