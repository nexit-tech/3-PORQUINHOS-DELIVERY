'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { MapPin, Plus, Trash2, Save, Loader2, DollarSign } from 'lucide-react';
import styles from './styles.module.css';

// Tipagem do Front-end
interface DeliveryZone {
  id: string;
  neighborhood: string;
  fee: number;
  active: boolean;
}

// Tipagem do Banco (Snake Case)
interface DatabaseZoneItem {
  id: string;
  neighborhood: string;
  fee: number;
  active: boolean;
}

export default function DeliveryFees() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados para o formulário de "Adicionar Novo"
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [newFee, setNewFee] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('neighborhood', { ascending: true }); // Ordena alfabeticamente

      if (error) throw error;

      if (data) {
        // Mapeia do banco para o front
        const formattedData: DeliveryZone[] = (data as DatabaseZoneItem[]).map(item => ({
          id: item.id,
          neighborhood: item.neighborhood,
          fee: item.fee,
          active: item.active
        }));
        setZones(formattedData);
      }
    } catch (error) {
      console.error('Erro ao buscar zonas:', error);
      alert('Erro ao carregar zonas de entrega.');
    } finally {
      setLoading(false);
    }
  };

  // Função para ADICIONAR imediatamente ao banco
  const handleAddZone = async () => {
    if (!newNeighborhood || !newFee) {
      alert("Preencha o bairro e o valor!");
      return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .insert([{
          neighborhood: newNeighborhood,
          fee: parseFloat(newFee.replace(',', '.')), // Garante formato numérico
          active: true
        }])
        .select();

      if (error) throw error;

      // Adiciona na lista visualmente se deu certo
      if (data) {
        const newZone = data[0] as DatabaseZoneItem;
        setZones(prev => [...prev, {
          id: newZone.id,
          neighborhood: newZone.neighborhood,
          fee: newZone.fee,
          active: newZone.active
        }].sort((a, b) => a.neighborhood.localeCompare(b.neighborhood)));
        
        // Limpa inputs
        setNewNeighborhood('');
        setNewFee('');
      }
    } catch (error) {
      console.error('Erro ao adicionar:', error);
      alert("Erro ao adicionar bairro.");
    } finally {
      setIsAdding(false);
    }
  };

  // Função para APAGAR imediatamente do banco
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este bairro?")) return;

    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove da lista visual
      setZones(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert("Erro ao remover bairro.");
    }
  };

  // Atualiza o estado local quando o usuário digita o preço
  const handleUpdateFee = (id: string, newValue: string) => {
    const updatedZones = zones.map(zone => {
      if (zone.id === id) {
        return { ...zone, fee: parseFloat(newValue) || 0 };
      }
      return zone;
    });
    setZones(updatedZones);
  };

  // Botão Salvar Geral (Para salvar alterações de preço em massa)
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const updates = zones.map(zone => ({
        id: zone.id,
        neighborhood: zone.neighborhood,
        fee: zone.fee,
        active: zone.active
      }));

      const { error } = await supabase
        .from('delivery_zones')
        .upsert(updates);

      if (error) throw error;

      alert("Taxas de entrega atualizadas com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert("Erro ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-zinc-500">
        <Loader2 className={styles.spin} size={32} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}>
          <MapPin size={24} color="var(--primary-color)" />
          <h2>Taxas de Entrega</h2>
        </div>
        <p>Gerencie os bairros atendidos e seus respectivos valores.</p>
      </header>

      {/* Área de Adicionar Novo */}
      <div className={styles.addSection}>
        <input 
          type="text" 
          placeholder="Nome do Bairro" 
          value={newNeighborhood}
          onChange={e => setNewNeighborhood(e.target.value)}
          className={styles.input}
        />
        <div className={styles.currencyInput}>
          <span>R$</span>
          <input 
            type="number" 
            placeholder="0,00" 
            value={newFee}
            onChange={e => setNewFee(e.target.value)}
          />
        </div>
        <button 
          onClick={handleAddZone} 
          disabled={isAdding}
          className={styles.addBtn}
        >
          {isAdding ? <Loader2 className={styles.spin} size={18}/> : <Plus size={18} />}
          Adicionar
        </button>
      </div>

      {/* Lista de Bairros */}
      <div className={styles.list}>
        {zones.length === 0 ? (
          <p className={styles.empty}>Nenhum bairro cadastrado.</p>
        ) : (
          zones.map((zone) => (
            <div key={zone.id} className={styles.row}>
              <span className={styles.neighborhoodName}>{zone.neighborhood}</span>
              
              <div className={styles.actions}>
                <div className={styles.priceGroup}>
                  <span className={styles.currencyLabel}>R$</span>
                  <input 
                    type="number" 
                    value={zone.fee} 
                    onChange={e => handleUpdateFee(zone.id, e.target.value)}
                    className={styles.priceInput}
                  />
                </div>
                
                <button 
                  onClick={() => handleDelete(zone.id)}
                  className={styles.deleteBtn}
                  title="Remover bairro"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className={styles.footer}>
        <button 
          onClick={handleSaveChanges} 
          disabled={saving}
          className={styles.saveBtn}
        >
          {saving ? <Loader2 size={18} className={styles.spin} /> : <Save size={18} />}
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </footer>
    </div>
  );
}