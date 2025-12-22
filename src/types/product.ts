export interface Category {
  id: string;
  name: string;
}

export interface ComplementOption {
  id: string;
  name: string;
  price: number; // 0 se for grátis (ex: sabor da pizza já incluso)
}

export interface ComplementGroup {
  id: string;
  name: string; // Ex: "Escolha até 2 Sabores"
  min: number;  // Ex: 1 (Obrigatório escolher pelo menos 1)
  max: number;  // Ex: 2 (Máximo 2 sabores - Meio a Meio)
  options: ComplementOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  image?: string; // URL da imagem
  complements: ComplementGroup[]; // Aqui mora a mágica
}