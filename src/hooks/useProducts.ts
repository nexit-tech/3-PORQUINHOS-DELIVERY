import { useState } from 'react';
import { Product, Category } from '@/types/product';

const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'Pizzas Salgadas' },
  { id: '2', name: 'Bebidas' },
  { id: '3', name: 'Sobremesas' }
];

const MOCK_PRODUCTS: Product[] = [
  {
    id: '101', name: 'Pizza Grande', description: 'Molho de tomate artesanal e queijo', price: 49.90, categoryId: '1',
    complements: [
      {
        id: 'g1', name: 'Escolha os Sabores (Até 2)', min: 1, max: 2,
        options: [
          { id: 'o1', name: 'Calabresa', price: 0 },
          { id: 'o2', name: 'Frango c/ Catupiry', price: 0 },
          { id: 'o3', name: 'Camarão (Premium)', price: 15.00 } // Sabor mais caro
        ]
      },
      {
        id: 'g2', name: 'Borda Recheada', min: 0, max: 1,
        options: [
          { id: 'b1', name: 'Catupiry', price: 8.00 },
          { id: 'b2', name: 'Cheddar', price: 8.00 }
        ]
      }
    ]
  },
  {
    id: '201', name: 'Coca Cola 2L', description: 'Bem gelada', price: 12.00, categoryId: '2',
    complements: []
  }
];

export function useProducts() {
  const [categories] = useState<Category[]>(MOCK_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [activeCategory, setActiveCategory] = useState<string>(MOCK_CATEGORIES[0].id);

  const filteredProducts = products.filter(p => p.categoryId === activeCategory);

  return { categories, products: filteredProducts, activeCategory, setActiveCategory };
}