'use client';

import { useState, useRef, useEffect } from 'react';
import { Product, ComplementGroup } from '@/types/product';
import { X, Plus, Trash2, GripVertical, Upload, Save, Download, Copy, Image as ImageIcon } from 'lucide-react';
import styles from './styles.module.css';

// Mock de templates (na vida real viria do banco)
const MOCK_TEMPLATES: ComplementGroup[] = [
  {
    id: 'temp_1', name: 'Escolha os Sabores (Tradicionais)', min: 1, max: 2,
    options: [
      { id: 'opt_1', name: 'Calabresa', price: 0 },
      { id: 'opt_2', name: 'Mussarela', price: 0 }
    ]
  }
];

interface ProductModalProps {
  product?: Product | null; // SE VIER PRODUTO, É EDIÇÃO
  onClose: () => void;
  onSave: (product: Partial<Product>) => void;
}

export default function ProductModal({ product, onClose, onSave }: ProductModalProps) {
  const [activeTab, setActiveTab] = useState<'DATA' | 'COMPLEMENTS'>('DATA');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States inicializados condicionalmente
  const [name, setName] = useState(product?.name || '');
  const [desc, setDesc] = useState(product?.description || '');
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image || null);
  const [groups, setGroups] = useState<ComplementGroup[]>(product?.complements || []);
  
  // Inicializa o preço formatado se for edição
  const [price, setPrice] = useState(() => {
    if (!product) return '';
    return product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  });

  // State da Biblioteca
  const [templates, setTemplates] = useState<ComplementGroup[]>(MOCK_TEMPLATES);
  const [showImportMenu, setShowImportMenu] = useState(false);

  // --- MÁSCARA DE MOEDA ---
  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const floatValue = Number(numericValue) / 100;
    return floatValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePriceChange = (value: string) => {
    setPrice(formatCurrency(value));
  };

  // --- LÓGICA DE GRUPOS E OPÇÕES (Idêntica à anterior) ---
  const addGroup = () => {
    setGroups([...groups, { id: Math.random().toString(), name: '', min: 0, max: 1, options: [] }]);
  };

  const addOptionToGroup = (groupId: string) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, options: [...g.options, { id: Math.random().toString(), name: '', price: 0 }] };
    }));
  };

  const updateGroup = (id: string, field: keyof ComplementGroup, value: any) => {
    setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
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

  // --- LÓGICA DE BIBLIOTECA (EXPORTAR/IMPORTAR) ---
  const saveAsTemplate = (group: ComplementGroup) => {
    const newTemplate: ComplementGroup = {
      ...group,
      id: `temp_${Math.random()}`,
      name: `${group.name} (Cópia)`,
      options: group.options.map(opt => ({ ...opt, id: `opt_${Math.random()}` }))
    };
    setTemplates([...templates, newTemplate]);
    alert('Grupo salvo na biblioteca!');
  };

  const importTemplate = (template: ComplementGroup) => {
    const newGroup: ComplementGroup = {
      ...template,
      id: Math.random().toString(),
      name: template.name,
      options: template.options.map(opt => ({ ...opt, id: Math.random().toString() }))
    };
    setGroups([...groups, newGroup]);
    setShowImportMenu(false);
  };

  // --- SALVAR ---
  const handleSave = () => {
    const rawPrice = Number(price.replace(/\D/g, '')) / 100;
    onSave({
      // Se for edição, mantém o ID, senão cria novo (mock)
      id: product?.id, 
      name, description: desc, price: rawPrice, image: imagePreview || undefined, complements: groups
    });
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImagePreview(URL.createObjectURL(file));
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
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundImage: imagePreview ? `url(${imagePreview})` : 'none' }}
              >
                {!imagePreview && (
                  <div className={styles.uploadPlaceholder}>
                    <Upload size={32} /><span>Clique para enviar imagem</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} hidden onChange={handleImageUpload} accept="image/*" />
              </div>

              <div className={styles.inputGroup}><label>Nome do Produto</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pizza Calabresa" /></div>
              <div className={styles.inputGroup}><label>Preço Base</label><input value={price} onChange={e => handlePriceChange(e.target.value)} placeholder="R$ 0,00" /></div>
              <div className={styles.inputGroupFull}><label>Descrição</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Ingredientes, detalhes..." /></div>
            </div>
          ) : (
            <div className={styles.complementsList}>
              {groups.map((group) => (
                <div key={group.id} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <div className={styles.dragHandle}><GripVertical size={16}/></div>
                    <input className={styles.groupNameInput} placeholder="Nome do Grupo" value={group.name} onChange={e => updateGroup(group.id, 'name', e.target.value)} />
                    <div className={styles.groupActions}>
                      <button onClick={() => saveAsTemplate(group)} className={styles.actionBtn} title="Salvar Modelo"><Save size={16}/></button>
                      <button onClick={() => setGroups(groups.filter(g => g.id !== group.id))} className={`${styles.actionBtn} ${styles.deleteBtn}`}><Trash2 size={16}/></button>
                    </div>
                  </div>
                  
                  <div className={styles.rulesRow}>
                    <div className={styles.ruleInput}><label>Mín</label><input type="number" value={group.min} onChange={e => updateGroup(group.id, 'min', Number(e.target.value))} /></div>
                    <div className={styles.ruleInput}><label>Máx</label><input type="number" value={group.max} onChange={e => updateGroup(group.id, 'max', Number(e.target.value))} /></div>
                    <span className={styles.ruleDesc}>{group.min === 0 ? 'Opcional' : 'Obrigatório'} • {group.max === 1 ? ' Escolha Única' : ` Até ${group.max} opções`}</span>
                  </div>

                  <div className={styles.optionsList}>
                    {group.options.map(opt => (
                      <div key={opt.id} className={styles.optionRow}>
                        <input placeholder="Nome" value={opt.name} onChange={e => updateOption(group.id, opt.id, 'name', e.target.value)} />
                        <input className={styles.priceInput} value={opt.price ? opt.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''} 
                               onChange={e => { const raw = Number(e.target.value.replace(/\D/g, '')) / 100; updateOption(group.id, opt.id, 'price', raw); }} placeholder="+ R$ 0,00" />
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
                      <h4>Modelos Salvos</h4>
                      {templates.length === 0 ? <p className={styles.emptyMsg}>Vazio</p> : (
                        <ul>{templates.map(t => <li key={t.id} onClick={() => importTemplate(t)}><span>{t.name}</span><Copy size={14}/></li>)}</ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
          <button onClick={handleSave} className={styles.saveBtn}>Salvar Produto</button>
        </footer>
      </div>
    </div>
  );
}