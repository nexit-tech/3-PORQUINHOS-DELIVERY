'use client';

import { useState, useRef, useEffect } from 'react';
import { Product, ComplementGroup } from '@/types/product';
import { X, Plus, Trash2, GripVertical, Upload, Save, Download, Copy, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import styles from './styles.module.css';

interface ProductModalProps {
  product?: Product | null;
  existingProducts: Product[];
  categories: any[]; 
  onClose: () => void;
  onSave: (product: Partial<Product>) => void;
}

export default function ProductModal({ product, existingProducts = [], categories = [], onClose, onSave }: ProductModalProps) {
  const [activeTab, setActiveTab] = useState<'DATA' | 'COMPLEMENTS'>('DATA');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(product?.name || '');
  const [desc, setDesc] = useState(product?.description || '');
  
  const [selectedCategory, setSelectedCategory] = useState<string>(
    product?.categoryId || (product as any)?.category_id || ''
  );

  const [imagePreview, setImagePreview] = useState<string | null>(product?.image || null);
  const [isUploading, setIsUploading] = useState(false);

  // Inicializa grupos garantindo ID único para evitar conflitos de renderização
  const [groups, setGroups] = useState<ComplementGroup[]>(() => {
    return product?.complements ? JSON.parse(JSON.stringify(product.complements)) : [];
  });
  
  const [price, setPrice] = useState(() => {
    const p = Number(product?.price || 0);
    return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  });

  const [showImportMenu, setShowImportMenu] = useState(false);
  const [selectedProductToImport, setSelectedProductToImport] = useState<Product | null>(null);

  const handlePriceChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setPrice((Number(numericValue) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('produtos').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('produtos').getPublicUrl(filePath);
      setImagePreview(data.publicUrl); 
    } catch (error: any) {
      console.error('Erro upload:', error);
      alert('Erro ao enviar imagem.');
    } finally {
      setIsUploading(false);
    }
  };

  // --- Lógica de Grupos ---
  const addGroup = () => {
    // Cria um ID temporário único
    setGroups([...groups, { id: `new_${Date.now()}`, name: '', min: 0, max: 1, options: [] }]);
  };

  const removeGroup = (groupIdToDelete: string) => {
    setGroups(currentGroups => currentGroups.filter(g => g.id !== groupIdToDelete));
  };

  const importGroup = (group: ComplementGroup) => {
    // Ao importar, gera um novo ID para ser tratado como novo vínculo
    const newGroup = { 
      ...group, 
      id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      options: group.options.map(opt => ({ ...opt, id: `opt_${Math.random()}` })) 
    };
    setGroups(prev => [...prev, newGroup]);
    setShowImportMenu(false); 
    setSelectedProductToImport(null);
  };

  const updateGroup = (id: string, field: keyof ComplementGroup, value: any) => {
    setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const addOptionToGroup = (groupId: string) => {
    setGroups(groups.map(g => g.id !== groupId ? g : { 
      ...g, 
      options: [...g.options, { id: `new_opt_${Date.now()}`, name: '', price: 0 }] 
    }));
  };

  const updateOption = (groupId: string, optId: string, field: 'name' | 'price', value: any) => {
    setGroups(groups.map(g => g.id !== groupId ? g : { 
      ...g, 
      options: g.options.map(opt => opt.id === optId ? { ...opt, [field]: value } : opt) 
    }));
  };

  const removeOption = (groupId: string, optId: string) => {
    setGroups(groups.map(g => g.id !== groupId ? g : {
      ...g,
      options: g.options.filter(o => o.id !== optId)
    }));
  };
  // ------------------------

  const handleSave = () => {
    if (!name.trim()) return alert('Nome obrigatório');
    if (!selectedCategory) return alert('Selecione uma categoria!');

    const rawPrice = typeof price === 'string' ? Number(price.replace(/\D/g, '')) / 100 : price;

    onSave({
      id: product?.id,
      name,
      description: desc,
      price: rawPrice,
      image: imagePreview || undefined,
      categoryId: selectedCategory,
      complements: groups // Envia a lista exata que está na tela (sem os excluídos)
    });
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>{product ? 'Editar Produto' : 'Novo Produto'}</h2>
          <button onClick={onClose} className={styles.closeBtn}><X size={24}/></button>
        </header>

        <div className={styles.tabs}>
          <button className={activeTab === 'DATA' ? styles.activeTab : ''} onClick={() => setActiveTab('DATA')}>Dados Gerais</button>
          <button className={activeTab === 'COMPLEMENTS' ? styles.activeTab : ''} onClick={() => setActiveTab('COMPLEMENTS')}>Complementos</button>
        </div>

        <div className={styles.body}>
          {activeTab === 'DATA' ? (
            <div className={styles.formGrid}>
               <div 
                 className={styles.imageUploadBox} 
                 style={{ backgroundImage: imagePreview ? `url(${imagePreview})` : 'none' }}
                 onClick={() => fileInputRef.current?.click()}
               >
                 {isUploading ? (
                   <span className={styles.uploadPlaceholder}><Loader2 className={styles.spin} /> Enviando...</span>
                 ) : !imagePreview && (
                   <div className={styles.uploadPlaceholder}><Upload size={32} /><span>Clique para enviar foto</span></div>
                 )}
                 <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleImageUpload} />
               </div>

              <div className={styles.inputGroup}><label>Nome</label><input value={name} onChange={e => setName(e.target.value)} /></div>
              
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Preço</label>
                  <input value={price} onChange={e => handlePriceChange(e.target.value)} />
                </div>
                
                <div className={styles.inputGroup}>
                  <label>Categoria</label>
                  <select 
                    value={selectedCategory} 
                    onChange={e => setSelectedCategory(e.target.value)}
                    className={styles.selectInput}
                  >
                    <option value="">Selecione...</option>
                    {categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.inputGroupFull}><label>Descrição</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} /></div>
            </div>
          ) : (
            <div className={styles.complementsList}>
              {groups.map((group) => (
                <div key={group.id} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <GripVertical size={16} className={styles.dragHandle}/>
                    <input className={styles.groupNameInput} placeholder="Nome do Grupo (Ex: Escolha o Molho)" value={group.name} onChange={e => updateGroup(group.id, 'name', e.target.value)} />
                    
                    {/* BOTÃO DE EXCLUIR GRUPO (O X QUE VOCÊ FALOU) */}
                    <button 
                      onClick={() => removeGroup(group.id)} 
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      title="Excluir Grupo"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                  
                  <div className={styles.rulesRow}>
                    <div className={styles.ruleInput}><label>Min</label><input type="number" value={group.min} onChange={e => updateGroup(group.id, 'min', Number(e.target.value))} /></div>
                    <div className={styles.ruleInput}><label>Max</label><input type="number" value={group.max} onChange={e => updateGroup(group.id, 'max', Number(e.target.value))} /></div>
                  </div>
                  
                  <div className={styles.optionsList}>
                    {group.options.map(opt => (
                      <div key={opt.id} className={styles.optionRow}>
                        <input className={styles.optionNameInput} value={opt.name} onChange={e => updateOption(group.id, opt.id, 'name', e.target.value)} placeholder="Opção" />
                        <input className={styles.priceInput} value={opt.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} onChange={e => { const r = Number(e.target.value.replace(/\D/g, ''))/100; updateOption(group.id, opt.id, 'price', r); }} />
                        <button onClick={() => removeOption(group.id, opt.id)} className={styles.removeOptionBtn}><X size={14}/></button>
                      </div>
                    ))}
                    <button onClick={() => addOptionToGroup(group.id)} className={styles.addOptionBtn}>+ Opção</button>
                  </div>
                </div>
              ))}
              
              <div className={styles.footerActions}>
                <button onClick={addGroup} className={styles.addGroupBtn}><Plus size={20} /> Novo Grupo</button>
                
                <div className={styles.importWrapper}>
                  <button onClick={() => setShowImportMenu(!showImportMenu)} className={styles.importBtn}><Download size={20} /> Importar</button>
                  {showImportMenu && (
                    <div className={styles.importMenu}>
                      {!selectedProductToImport ? 
                        existingProducts.filter(p => p.id !== product?.id && p.complements?.length).map(p => <li key={p.id} onClick={() => setSelectedProductToImport(p)}>{p.name} <ChevronRight size={14}/></li>) :
                        <div>
                          <button onClick={() => setSelectedProductToImport(null)} className={styles.backBtn}>Voltar</button>
                          {selectedProductToImport.complements.map(g => <li key={g.id} onClick={() => importGroup(g)}>{g.name} <Copy size={14}/></li>)}
                        </div>
                      }
                      {existingProducts.filter(p => p.complements?.length).length === 0 && <li style={{color: '#999'}}>Sem grupos para importar</li>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <footer className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
          <button onClick={handleSave} className={styles.saveBtn}>Salvar</button>
        </footer>
      </div>
    </div>
  );
}