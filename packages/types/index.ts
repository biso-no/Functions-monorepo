export type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};


export interface ExchangeRateResponse {
    amount: number;  
    base: string;  
    date: string;     
    rates: Record<string, number>; 
}


export interface Product {
    id: number;
    name: string;
    campus: { value: string; label: string };
    department: { value: string; label: string };
    images: string[];
    price: string;
    sale_price: string;
    description: string;
    url: string;
  }
  
  export interface ResponseData {
    products: Product[];
  }
  