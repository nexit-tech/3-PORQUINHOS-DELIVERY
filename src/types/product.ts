export interface Category {
  id: string;
  name: string;
}

export interface ComplementOption {
  id: string;
  name: string;
  price: number;
  max_quantity?: number; // Opcional, caso queira usar depois
}

export interface ComplementGroup {
  id: string;
  name: string;
  min: number; // No banco é min_selection
  max: number; // No banco é max_selection
  options: ComplementOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id?: string; // Ajustado para bater com o banco
  image?: string;
  active: boolean;
  complements: ComplementGroup[];
}