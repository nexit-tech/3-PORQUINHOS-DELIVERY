'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, User, Phone, Mail, MapPin, Store, AlertCircle,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/services/supabase';
import Link from 'next/link';
import BairroPicker, { type DeliveryZone } from '@/components/client/BairroPicker';
import { STORE_DEFAULT_CEP } from '@/config/store';
import styles from './page.module.css';

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function EnderecoPage() {
  const router = useRouter();
  const {
    setAddress, setDeliveryFee, cartSubtotal,
    setCustomerName, setCustomerPhone, setCustomerEmail,
    deliveryType, setDeliveryType
  } = useCart();

  // Estados dos dados pessoais
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Estados do endereço
  // Já nasce com o CEP da cidade da loja: quase todo pedido usa esse mesmo.
  const [cep, setCep] = useState(STORE_DEFAULT_CEP);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [neighborhoods, setNeighborhoods] = useState<DeliveryZone[]>([]);
  // Inicia como nulo para forçar o usuário a escolher
  const [selectedHood, setSelectedHood] = useState<DeliveryZone | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);

  // O que falta preencher, dito na tela. Era um alert(): ele tapava o
  // formulário, sumia com um toque e o cliente voltava sem saber qual campo
  // era o problema.
  const [erro, setErro] = useState<string | null>(null);

  const ehEntrega = deliveryType === 'delivery';

  /**
   * Folga embaixo do formulário igual à altura real do resumo.
   *
   * Era uma constante de 300px chutada por cima da altura do rodapé, e
   * sobrava um vão morto quando a página chegava no fim. Medir resolve os
   * dois lados: o resumo cresce quando a mensagem de erro aparece e encolhe
   * quando o cliente muda para retirada — em qualquer um dos casos a folga
   * acompanha, sem esconder campo nem deixar buraco.
   */
  const resumoRef = useRef<HTMLElement>(null);
  const [alturaResumo, setAlturaResumo] = useState(0);

  useEffect(() => {
    const el = resumoRef.current;
    if (!el) return;

    // getBoundingClientRect e não contentRect: o resumo tem padding e área
    // segura embaixo, e contentRect deixaria os dois de fora da conta.
    const observador = new ResizeObserver(([entrada]) => {
      setAlturaResumo(entrada.target.getBoundingClientRect().height);
    });

    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    async function fetchZones() {
      try {
        setLoadingZones(true);
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('*')
          .eq('active', true)
          .order('neighborhood', { ascending: true });

        if (error) throw error;

        if (data) {
          setNeighborhoods(data);
          // 🔥 Ajuste: Removida a seleção automática do primeiro item (data[0]).
          // Agora ele obriga a mostrar "Selecione um bairro"
        }
      } catch (error) {
        console.error('Erro ao buscar bairros:', error);
      } finally {
        setLoadingZones(false);
      }
    }

    fetchZones();
  }, []);

  // Ajusta a taxa de entrega baseado na escolha (Delivery ou Retirada)
  useEffect(() => {
    if (deliveryType === 'pickup') {
      setDeliveryFee(0);
    } else if (selectedHood) {
      setDeliveryFee(selectedHood.fee);
    } else {
      // 🔥 Ajuste: Garante que a taxa é 0 se o bairro ainda não foi selecionado
      setDeliveryFee(0);
    }
  }, [selectedHood, deliveryType, setDeliveryFee]);

  /**
   * CEP com máscara e busca automática da rua.
   *
   * O campo entrou porque o checkout da operadora exige CEP na etapa de
   * entrega. Para não virar mais um campo a digitar, ele traz a rua junto:
   * na prática o cliente digita menos do que antes.
   *
   * O bairro NÃO é preenchido daqui: quem manda nele é o seletor, porque é
   * ele que define a taxa. Sobrescrever com o texto do ViaCEP faria a taxa
   * cobrada e o bairro exibido discordarem.
   */
  const handleCepChange = async (txt: string) => {
    const digitos = txt.replace(/\D/g, '').slice(0, 8);
    const mascarado = digitos.length > 5
      ? `${digitos.slice(0, 5)}-${digitos.slice(5)}`
      : digitos;

    setErro(null);
    setCep(mascarado);

    if (digitos.length !== 8) return;

    try {
      setBuscandoCep(true);
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const d = await r.json();
      // CEP inexistente volta { erro: true } com status 200
      if (!d?.erro && d?.logradouro) setStreet(d.logradouro);
    } catch {
      // Sem internet ou ViaCEP fora do ar: o cliente digita a rua na mão,
      // como fazia antes. Não é motivo para travar o checkout.
    } finally {
      setBuscandoCep(false);
    }
  };

  const handlePhoneChange = (txt: string) => {
    let val = txt.replace(/\D/g, '');
    val = val.replace(/^(\d{2})(\d)/g, '($1) $2');
    val = val.replace(/(\d)(\d{4})$/, '$1-$2');
    setErro(null);
    setPhone(val);
  };

  /** Devolve o primeiro problema encontrado, na ordem em que aparecem na tela. */
  const validar = (): string | null => {
    if (!name.trim()) return 'Preencha seu nome completo.';
    if (phone.replace(/\D/g, '').length < 10) return 'Informe um celular válido com DDD.';
    // O checkout da operadora pede e-mail de qualquer jeito. Coletando aqui,
    // ele chega preenchido lá e o cliente não digita duas vezes.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      return 'Informe um e-mail válido para o recibo.';
    }

    if (ehEntrega) {
      if (!selectedHood) return 'Escolha o bairro de entrega.';
      if (cep.replace(/\D/g, '').length !== 8) return 'Informe um CEP válido com 8 dígitos.';
      if (!street.trim()) return 'Informe a rua da entrega.';
      if (!number.trim()) return 'Informe o número do endereço.';
    }

    return null;
  };

  const handleNext = () => {
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }

    setErro(null);
    setCustomerName(name);
    setCustomerPhone(phone);
    setCustomerEmail(email.trim());

    // LÓGICA DE PREENCHIMENTO AUTOMÁTICO PARA RETIRADA
    if (deliveryType === 'pickup') {
      setAddress({
        street: 'RETIRAR NO LOCAL',
        number: 'S/N',
        complement: 'Cliente retira na loja',
        neighborhood: 'RETIRADA'
      });
    } else {
      setAddress({
        street,
        number,
        complement,
        neighborhood: selectedHood!.neighborhood,
        cep: cep.replace(/\D/g, ''),
      });
    }

    router.push('/pedido/checkout/pagamento');
  };

  const currentFee = ehEntrega ? (selectedHood?.fee || 0) : 0;
  const total = cartSubtotal + currentFee;

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido/carrinho" className={styles.iconBtn} aria-label="Voltar ao carrinho">
          <ArrowLeft size={20} />
        </Link>
        <h1>Dados do pedido</h1>
        <div className={styles.headerSpacer} />
      </header>

      <div
        className={styles.conteudo}
        /* Antes da primeira medida vale a folga do CSS, que erra por cima:
           melhor um vão de um quadro do que campo escondido. */
        style={alturaResumo ? { paddingBottom: alturaResumo + 16 } : undefined}
      >

        {/* COMO O CLIENTE RECEBE — define o resto do formulário, por isso vem antes */}
        <div className={styles.segmento} role="group" aria-label="Como você quer receber">
          <button
            type="button"
            className={`${styles.segmentoBtn} ${ehEntrega ? styles.segmentoAtivo : ''}`}
            onClick={() => { setDeliveryType('delivery'); setErro(null); }}
            aria-pressed={ehEntrega}
          >
            <MapPin size={17} />
            Entrega
          </button>
          <button
            type="button"
            className={`${styles.segmentoBtn} ${!ehEntrega ? styles.segmentoAtivo : ''}`}
            onClick={() => { setDeliveryType('pickup'); setErro(null); }}
            aria-pressed={!ehEntrega}
          >
            <Store size={17} />
            Retirada
          </button>
        </div>

        {/* SEUS DADOS */}
        <section className={styles.cartao}>
          <div className={styles.cartaoTopo}>
            <span className={styles.cartaoIcone}><User size={16} /></span>
            <div>
              <h2>Seus dados</h2>
              <p>Confirmamos no WhatsApp e o recibo vai por e-mail</p>
            </div>
          </div>

          <div className={styles.campos}>
            <div className={styles.campo}>
              <label htmlFor="nome">Nome completo</label>
              <div className={styles.comIcone}>
                <User size={17} className={styles.icone} />
                <input
                  id="nome"
                  type="text"
                  placeholder="Ex: João Silva"
                  value={name}
                  onChange={e => { setErro(null); setName(e.target.value); }}
                  className={styles.entradaIcone}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className={styles.campo}>
              <label htmlFor="fone">Celular / WhatsApp</label>
              <div className={styles.comIcone}>
                <Phone size={17} className={styles.icone} />
                <input
                  id="fone"
                  type="text"
                  placeholder="(XX) XXXXX-XXXX"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  maxLength={15}
                  className={styles.entradaIcone}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className={styles.campo}>
              <label htmlFor="email">E-mail</label>
              <div className={styles.comIcone}>
                <Mail size={17} className={styles.icone} />
                <input
                  id="email"
                  type="email"
                  placeholder="voce@email.com"
                  value={email}
                  onChange={e => { setErro(null); setEmail(e.target.value); }}
                  className={styles.entradaIcone}
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ENDEREÇO — só existe na entrega */}
        {ehEntrega ? (
          <section className={styles.cartao}>
            <div className={styles.cartaoTopo}>
              <span className={styles.cartaoIcone}><MapPin size={16} /></span>
              <div>
                <h2>Endereço de entrega</h2>
                <p>O bairro define a taxa do pedido</p>
              </div>
            </div>

            <div className={styles.campos}>
              <div className={styles.campo}>
                <label>Bairro</label>
                <BairroPicker
                  zones={neighborhoods}
                  selected={selectedHood}
                  loading={loadingZones}
                  onSelect={(z) => { setErro(null); setSelectedHood(z); }}
                />
              </div>

              <div className={styles.campo}>
                <label htmlFor="cep">CEP</label>
                <input
                  id="cep"
                  type="text"
                  placeholder="00000-000"
                  value={cep}
                  onChange={e => handleCepChange(e.target.value)}
                  maxLength={9}
                  className={styles.entrada}
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>

              <div className={styles.campo}>
                <label htmlFor="rua">
                  Rua / Avenida{' '}
                  {buscandoCep && <span className={styles.opcional}>buscando…</span>}
                </label>
                <input
                  id="rua"
                  type="text"
                  placeholder="Ex: Av. Principal"
                  value={street}
                  onChange={e => { setErro(null); setStreet(e.target.value); }}
                  className={styles.entrada}
                  autoComplete="address-line1"
                />
              </div>

              <div className={styles.duplo}>
                <div className={styles.campo}>
                  <label htmlFor="numero">Número</label>
                  <input
                    id="numero"
                    type="text"
                    placeholder="123"
                    value={number}
                    onChange={e => { setErro(null); setNumber(e.target.value); }}
                    className={styles.entrada}
                    inputMode="numeric"
                  />
                </div>
                <div className={styles.campo}>
                  <label htmlFor="comp">
                    Complemento <span className={styles.opcional}>opcional</span>
                  </label>
                  <input
                    id="comp"
                    type="text"
                    placeholder="Ap 101"
                    value={complement}
                    onChange={e => setComplement(e.target.value)}
                    className={styles.entrada}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.retirada}>
            <span className={styles.retiradaIcone}><Store size={20} /></span>
            <div>
              <strong>Retirada na loja</strong>
              <p>Você busca no balcão quando o pedido ficar pronto — avisamos no WhatsApp.</p>
            </div>
          </section>
        )}
      </div>

      {/* RESUMO FIXO */}
      <footer className={styles.resumo} ref={resumoRef}>
        <div className={styles.resumoLinhas}>
          <div className={styles.linha}>
            <span>Subtotal</span>
            <span className={styles.valor}>{moeda(cartSubtotal)}</span>
          </div>

          <div className={styles.linha}>
            <span>
              {ehEntrega
                ? selectedHood ? `Entrega · ${selectedHood.neighborhood}` : 'Entrega'
                : 'Retirada na loja'}
            </span>

            {!ehEntrega ? (
              <span className={styles.gratis}>Grátis</span>
            ) : !selectedHood ? (
              // Não mostra "R$ 0,00": daria a entender que a entrega é de
              // graça quando na verdade a taxa ainda nem foi calculada.
              <span className={styles.pendente}>escolha o bairro</span>
            ) : currentFee > 0 ? (
              <span className={styles.valor}>{moeda(currentFee)}</span>
            ) : (
              <span className={styles.gratis}>Grátis</span>
            )}
          </div>
        </div>

        <div className={styles.totalLinha}>
          <span>Total</span>
          <strong>{moeda(total)}</strong>
        </div>

        {erro && (
          <p className={styles.erro} role="alert">
            <AlertCircle size={15} /> {erro}
          </p>
        )}

        <button type="button" className={styles.cta} onClick={handleNext}>
          Ir para pagamento
          <ArrowRight size={19} />
        </button>
      </footer>
    </main>
  );
}
