export interface ComplementOption {
  id: string;
  name: string;
  price: number;
  max_quantity?: number;
  active?: boolean;
}

export interface ComplementGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  options: ComplementOption[];
}

// --- ADICIONE ISSO AQUI ---
export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  image_url?: string; // Compatibilidade com banco
  active: boolean;
  
  // Adicione estes campos para parar o erro de "Property does not exist"
  categoryId?: string; 
  category_id?: string;

  complements: ComplementGroup[];
}