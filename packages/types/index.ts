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
  
  export interface ExpenseAttachment {
    date: string;
    url: string;
    amount: number;
    description: string;
    type: string;
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    $databaseId: string;
    $collectionId: string;
  }
  
  export interface StudentId {
    student_id: string;
    expiry_date: string | null;
    isMember: boolean;
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    $databaseId: string;
    $collectionId: string;
  }
  
  export interface Campus {
    name: string;
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    $databaseId: string;
    $collectionId: string;
  }
  
  export interface Department {
    Id: string;
    Name: string;
    campus_id: string;
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    $databaseId: string;
    $collectionId: string;
  }
  
  export interface User {
    phone: string;
    address: string;
    city: string;
    zip: string;
    bank_account: string;
    name: string;
    email: string | null;
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    studentId: StudentId;
    campus: Campus;
    chats: any[];
    departments: Department[];
    $databaseId: string;
    $collectionId: string;
  }
  
  export interface Expense {
    bank_account: string;
    campus: string;
    department: string;
    description: string;
    prepayment_amount: number;
    total: number;
    status: string;
    userId: string;
    $id: string;
    $permissions: string[];
    $createdAt: string;
    $updatedAt: string;
    expenseAttachments: ExpenseAttachment[];
    user: User;
    invoice_id: string | null;
    $databaseId: string;
    $collectionId: string;
  }
  