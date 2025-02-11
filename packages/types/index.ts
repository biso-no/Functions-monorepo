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
  