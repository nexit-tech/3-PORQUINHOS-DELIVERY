/**
 * Testes da regra de horário de funcionamento.
 *
 * Existe porque este foi o bug mais caro do projeto: a grade da loja é
 * 17:30 -> 01:00, e a lógica antiga (`agora >= abre && agora <= fecha`)
 * dava SEMPRE falso, porque 01:00 é menor que 17:30. A loja aparecia
 * fechada o tempo todo.
 *
 * Rode com:  npm run test:horarios
 * (o script compila src/lib/storeHours.ts antes)
 */
const {
  isStoreOpen,
  getStoreParts,
  storeDateKey,
  getNextOpening,
} = require('../.tmp-test/storeHours.js');

// Grade real da loja: pizzaria noturna, 17:30 -> 01:00 todo dia
const grade = ['dom','seg','ter','qua','qui','sex','sab'].map(d => ({
  day_of_week: d, is_open: true, open_time: '17:30:00', close_time: '01:00:00'
}));

// Segunda 27/07/2026 fechada, para testar a borda
const gradeComFolga = grade.map(d =>
  d.day_of_week === 'seg' ? { ...d, is_open: false } : d
);

let falhas = 0;
function check(rotulo, isoUtc, grade, esperado) {
  const d = new Date(isoUtc);
  const got = isStoreOpen(grade, d);
  const p = getStoreParts(d);
  const hora = `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
  const ok = got === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'OK  ' : 'FALHA'} | ${rotulo.padEnd(42)} | ${p.dayKey} ${hora} BRT | esperado=${esperado} obteve=${got}`);
}

console.log('--- Grade 17:30 -> 01:00 todos os dias ---');
// BRT = UTC-3
check('16:00 seg (antes de abrir)',        '2026-07-27T19:00:00Z', grade, false);
check('17:29 seg (1 min antes)',           '2026-07-27T20:29:00Z', grade, false);
check('17:30 seg (abre em ponto)',         '2026-07-27T20:30:00Z', grade, true);
check('21:00 seg (pico)',                  '2026-07-28T00:00:00Z', grade, true);
check('23:59 seg',                         '2026-07-28T02:59:00Z', grade, true);
check('00:30 ter (janela de segunda)',     '2026-07-28T03:30:00Z', grade, true);
check('00:59 ter (1 min antes de fechar)', '2026-07-28T03:59:00Z', grade, true);
check('01:00 ter (fecha em ponto)',        '2026-07-28T04:00:00Z', grade, false);
check('03:00 ter (madrugada)',             '2026-07-28T06:00:00Z', grade, false);
check('12:00 ter (meio-dia)',              '2026-07-28T15:00:00Z', grade, false);

console.log('\n--- Segunda FECHADA (testa a virada do dia fechado) ---');
check('21:00 seg (dia fechado)',           '2026-07-28T00:00:00Z', gradeComFolga, false);
check('00:30 ter (segunda estava fechada)','2026-07-28T03:30:00Z', gradeComFolga, false);
check('00:30 seg (domingo estava aberto)', '2026-07-27T03:30:00Z', gradeComFolga, true);
check('21:00 ter (terca aberta)',          '2026-07-29T00:00:00Z', gradeComFolga, true);

console.log('\n--- Horario normal, sem virar a meia-noite (11:00 -> 23:00) ---');
const diurno = grade.map(d => ({ ...d, open_time: '11:00', close_time: '23:00' }));
check('10:59 (antes)',                     '2026-07-28T13:59:00Z', diurno, false);
check('15:00 (dentro)',                    '2026-07-28T18:00:00Z', diurno, true);
check('23:00 (fecha em ponto)',            '2026-07-29T02:00:00Z', diurno, false);
check('00:30 (nao deve vazar p/ o dia seg)','2026-07-29T03:30:00Z', diurno, false);

console.log('\n--- Fuso: o servidor roda em UTC ---');
const d = new Date('2026-07-28T02:00:00Z'); // 23:00 BRT do dia 27
console.log('UTC diz dia   :', d.toISOString().slice(0,10), '/ hora UTC', d.getUTCHours());
console.log('storeDateKey  :', storeDateKey(d), '(tem que ser 2026-07-27)');
if (storeDateKey(d) !== '2026-07-27') { falhas++; console.log('FALHA no storeDateKey'); }

console.log('\n--- getNextOpening ---');
console.log('ter 03:00, prox abertura:', JSON.stringify(getNextOpening(grade, new Date('2026-07-28T06:00:00Z'))));

console.log(falhas === 0 ? '\n=== TODOS OS TESTES PASSARAM ===' : `\n=== ${falhas} FALHA(S) ===`);
process.exit(falhas === 0 ? 0 : 1);
