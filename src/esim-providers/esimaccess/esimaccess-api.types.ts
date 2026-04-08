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

export interface EsimAccessApiResponse {
  errorCode: string | null;
  errorMsg: string | null;
  success: boolean;
  obj: {
    packageList: EsimAccessPackage[];
  };
}
