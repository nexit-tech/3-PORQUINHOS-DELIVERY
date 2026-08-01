// scripts/gerar-icone.js
//
// Gera os ícones do app a partir de public/icon.svg.
//
// Por que existe: o electron-builder aponta para public/favicon.ico, mas esse
// arquivo não existia — o instalador e o executável saíam com o ícone padrão
// do Electron. Este script cria o .ico com todos os tamanhos que o Windows
// pede (16 até 256) e mantém o favicon do site igual ao do app.
//
// Uso:  node scripts/gerar-icone.js
//
// Se a loja mandar a logo oficial, substitua public/icon.svg e rode de novo.
// Se a logo vier em PNG, troque a constante ORIGEM para o caminho dele —
// o sharp lê os dois.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const ORIGEM = path.join(RAIZ, 'public', 'icon.svg');

// O Windows escolhe o tamanho conforme o contexto: 16 na barra de tarefas,
// 32 no Explorer, 256 na visualização grande. Faltando um, ele reamostra
// outro e o resultado fica borrado.
const TAMANHOS = [16, 24, 32, 48, 64, 128, 256];

async function png(tamanho) {
  return sharp(ORIGEM, { density: 384 })
    .resize(tamanho, tamanho, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Monta o .ico na mão.
 *
 * O formato aceita PNG embutido desde o Windows Vista, que é bem menor que
 * o BMP original. Duas armadilhas: a dimensão 256 é gravada como 0 (o campo
 * tem 1 byte só), e o offset de cada imagem é contado a partir do início do
 * arquivo, não do fim do cabeçalho.
 */
function montarIco(imagens) {
  const CABECALHO = 6;
  const ENTRADA = 16;
  const inicioDados = CABECALHO + ENTRADA * imagens.length;

  const cabecalho = Buffer.alloc(CABECALHO);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4);

  const entradas = [];
  let offset = inicioDados;

  for (const { tamanho, buffer } of imagens) {
    const e = Buffer.alloc(ENTRADA);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0); // largura
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1); // altura
    e.writeUInt8(0, 2);  // cores da paleta (0 = sem paleta)
    e.writeUInt8(0, 3);  // reservado
    e.writeUInt16LE(1, 4);   // planos
    e.writeUInt16LE(32, 6);  // bits por pixel
    e.writeUInt32LE(buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    entradas.push(e);
    offset += buffer.length;
  }

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.buffer)]);
}

(async () => {
  if (!fs.existsSync(ORIGEM)) {
    console.error(`Não encontrei ${ORIGEM}`);
    process.exit(1);
  }

  const imagens = [];
  for (const tamanho of TAMANHOS) {
    imagens.push({ tamanho, buffer: await png(tamanho) });
  }

  const ico = montarIco(imagens);

  // O electron-builder lê daqui (win.icon no package.json)
  const destinoPublic = path.join(RAIZ, 'public', 'favicon.ico');
  fs.writeFileSync(destinoPublic, ico);

  // E o Next serve este como favicon do site, para o app e a loja baterem
  const destinoApp = path.join(RAIZ, 'src', 'app', 'favicon.ico');
  fs.writeFileSync(destinoApp, ico);

  // PNG solto: a janela do Electron usa em Linux e ele serve de preview
  fs.writeFileSync(path.join(RAIZ, 'public', 'icon.png'), await png(512));

  console.log(`✅ Ícone gerado com ${TAMANHOS.length} tamanhos (${TAMANHOS.join(', ')})`);
  console.log(`   public/favicon.ico     ${(ico.length / 1024).toFixed(1)} KB`);
  console.log(`   src/app/favicon.ico    (favicon do site)`);
  console.log(`   public/icon.png        (512x512)`);
})();
