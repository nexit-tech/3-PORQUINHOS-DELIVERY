'use client';

import { useState, useRef, useMemo } from 'react';
import { Product, ComplementGroup } from '@/types/product';
import { X, Plus, Trash2, GripVertical, Upload, Save, Download, Copy, ChevronRight } from 'lucide-react';
import styles from './styles.module.css';

interface ProductModalProps {
  product?: Product | null;
  existingProducts: Product[];
  onClose: () => void;
  onSave: (product: Partial<Product>) => void;
}

export default function ProductModal({ product, existingProducts = [], onClose, onSave }: ProductModalProps) {
  const [activeTab, setActiveTab] = useState<'DATA' | 'COMPLEMENTS'>('DATA');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(product?.name || '');
  const [desc, setDesc] = useState(product?.description || '');
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image || null);
  
  // Clone profundo para quebrar referências
  const [groups, setGroups] = useState<ComplementGroup[]>(() => {
    return product?.complements ? JSON.parse(JSON.stringify(product.complements)) : [];
  });
  
  const [price, setPrice] = useState(() => {
    const p = Number(product?.price || 0);
    return p.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  });

  const [showImportMenu, setShowImportMenu] = useState(false);
  const [selectedProductToImport, setSelectedProductToImport] = useState<Product | null>(null);

  const productsWithComplements = useMemo(() => {
    return existingProducts.filter(p => p.id !== product?.id && p.complements && p.complements.length > 0);
  }, [existingProducts, product]);

  const handlePriceChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setPrice((Number(numericValue) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  // --- LÓGICA DE GRUPOS ---

  // ADICIONAR GRUPO: ID vazio para o backend criar
  const addGroup = () => {
    setGroups([...groups, { 
      id: `new_${Date.now()}`, // ID temporário apenas para a UI do React (não vai pro banco se tratar no hook)
      name: '', min: 0, max: 1, options: [] 
    }]);
  };

  // IMPORTAR GRUPO: Remove os IDs originais para criar CÓPIAS NOVAS no banco
  const importGroup = (group: ComplementGroup) => {
    const newGroup = {
      ...group,
      id: `imported_${Date.now()}`, // ID temporário para UI
      options: group.options.map(opt => ({
        ...opt,
        id: `opt_${Math.random()}` // ID temporário para UI
      }))
    };
    
    // IMPORTANTE: Ao salvar, o hook/backend deve ignorar esses IDs temporários e criar UUIDs reais
    setGroups(prev => [...prev, newGroup]);
    setShowImportMenu(false);
    setSelectedProductToImport(null);
  };

  const updateGroup = (id: string, field: keyof ComplementGroup, value: any) => {
    setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const addOptionToGroup = (groupId: string) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      return { 
        ...g, 
        options: [...g.options, { id: `new_opt_${Date.now()}`, name: '', price: 0 }] 
      };
    }));
  };

  const updateOption = (groupId: string, optId: string, field: 'name' | 'price', value: any) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        options: g.options.map(opt => opt.id === optId ? { ...opt, [field]: value } : opt)
      };
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return alert('Nome obrigatório');
    const rawPrice = Number(price.replace(/\D/g, '')) / 100;

    // Limpa IDs temporários antes de mandar (opcional, dependendo do backend)
    // Aqui mandamos tudo e o backend decide se cria ou atualiza
    onSave({
      id: product?.id,
      name,
      description: desc,
      price: rawPrice,
      image: imagePreview || undefined,
      complements: groups
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
               <div className={styles.imageUploadBox} style={{ backgroundImage: imagePreview ? `url(${imagePreview})` : 'none' }}>
                 {!imagePreview && <div className={styles.uploadPlaceholder}><Upload size={32} /><span>Imagem</span></div>}
                 <input type="file" hidden onChange={e => { if(e.target.files?.[0]) setImagePreview(URL.createObjectURL(e.target.files[0])) }} />
               </div>
              <div className={styles.inputGroup}><label>Nome</label><input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className={styles.inputGroup}><label>Preço</label><input value={price} onChange={e => handlePriceChange(e.target.value)} /></div>
              <div className={styles.inputGroupFull}><label>Descrição</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} /></div>
            </div>
          ) : (
            <div className={styles.complementsList}>
              {groups.map((group) => (
                <div key={group.id} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <GripVertical size={16} className={styles.dragHandle}/>
                    <input className={styles.groupNameInput} placeholder="Nome do Grupo" value={group.name} onChange={e => updateGroup(group.id, 'name', e.target.value)} />
                    <button onClick={() => setGroups(groups.filter(g => g.id !== group.id))} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16}/></button>
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
                        <button onClick={() => { const n = group.options.filter(o => o.id !== opt.id); updateGroup(group.id, 'options', n); }} className={styles.removeOptionBtn}><X size={14}/></button>
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
                        productsWithComplements.map(p => <li key={p.id} onClick={() => setSelectedProductToImport(p)}>{p.name} <ChevronRight size={14}/></li>) :
                        <div>
                          <button onClick={() => setSelectedProductToImport(null)} className={styles.backBtn}>Voltar</button>
                          {selectedProductToImport.complements.map(g => <li key={g.id} onClick={() => importGroup(g)}>{g.name} <Copy size={14}/></li>)}
                        </div>
                      }
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