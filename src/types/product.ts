// src/types/product.ts
export interface ComplementOption {
  id: string;
  name: string;
  price: number;
  max_quantity?: number;
  active?: boolean; // 🔥 ADICIONADO
}

export interface ComplementGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  options: ComplementOption[];
}

export interface Category {
  id: string;
  name: string;
  order?: number; // 🔥 ADICIONADO
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  image_url?: string;
  active: boolean;
  order?: number; // 🔥 ADICIONADO
  
  categoryId?: string; 
  category_id?: string;

  complements: ComplementGroup[];
}