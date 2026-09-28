// ---- Dados das operações (placeholders — motor real de URM vem depois) ----
const OPERACOES = {
  soma:        { label: "Soma",          inputs: 2, registosInfo: "R1..R(n+1)", codigo: ["J(2,3,9)","J(5,1,6)","S(5)","S(4)","J(1,1,2)","S(2)","Z(5)","J(1,1,1)","T(4,1)"] },
  subtracao:   { label: "Subtração",     inputs: 2, registosInfo: "R1..R(n+1)", codigo: ["J(3,4,7)","S(4)","S(5)","J(1,1,1)","T(5,1)"] },
  multiplicacao:{ label: "Multiplicação", inputs: 2, registosInfo: "R1..R(n+3)", codigo: ["J(2,3,9)","J(5,1,6)","S(5)","S(4)","J(1,1,2)","S(2)","Z(5)","J(1,1,1)","T(4,1)"] },
  divisao:     { label: "Divisão",       inputs: 2, registosInfo: "R1..R(n+3)", codigo: ["J(2,3,8)","S(4)","S(5)","J(5,3,1)","Z(5)","J(1,1,1)","T(4,1)"] },
  potencia:    { label: "Potência",      inputs: 2, registosInfo: "R1..R(n+3)", codigo: ["J(3,4,7)","S(4)","S(5)","J(1,1,1)","T(5,1)"] },
  raiz:        { label: "Raiz",          inputs: 1, registosInfo: "R1..R(n+2)", codigo: ["Z(2)","J(2,2,6)","S(2)","J(1,1,2)","T(2,1)"] },
  maximo:      { label: "Máximo",        inputs: 2, registosInfo: "R1..R(n+1)", codigo: ["J(2,3,5)","T(3,1)","J(1,1,6)","T(2,1)"] },
  minimo:      { label: "Mínimo",        inputs: 2, registosInfo: "R1..R(n+1)", codigo: ["J(2,3,5)","T(2,1)","J(1,1,6)","T(3,1)"] },
  fatorial:    { label: "Fatorial",      inputs: 1, registosInfo: "R1..R(n+4)", codigo: ["J(2,3,9)","J(5,1,6)","S(5)","S(4)","J(1,1,2)","S(2)","Z(5)","J(1,1,1)","T(4,1)"] },
};

const $ = (sel) => document.querySelector(sel);
const opSelect   = $("#op");
const valoresBox = $("#valores");
const infoBox    = $("#infoRegistos");
const qtdInput   = $("#qtd");
const codigoBox  = $("#codigo");
const historico  = $("#historico");
const resultado  = $("#resultado");
const tabelaBody = $("#tabelaRegistos tbody");

let execTimer = null;
let linhaAtual = -1;
let linhasCodigo = [];

// popular select de operações
for (const [key, op] of Object.entries(OPERACOES)) {
  const o = document.createElement("option");
  o.value = key; o.textContent = op.label;
  opSelect.appendChild(o);
}

function operacaoAtual() { return OPERACOES[opSelect.value]; }

function renderValores() {
  const n = parseInt(qtdInput.value, 10);
  valoresBox.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const field = document.createElement("div");
    field.className = "value-field";
    field.innerHTML = `<label for="val${i}">Valor ${i} (R${i + 1})</label>
      <input type="number" id="val${i}" value="0">`;
    valoresBox.appendChild(field);
  }
  infoBox.textContent = `Registos necessários para esta operação: ${operacaoAtual().registosInfo}`;
}

function renderTabela(valores) {
  tabelaBody.innerHTML = "";
  const linhas = ["R1", ...valores.map((_, i) => `R${i + 2}`), `R${valores.length + 2}`];
  linhas.forEach((nome, i) => {
    const tr = document.createElement("tr");
    const val = i === 0 ? 0 : (valores[i - 1] ?? 0);
    tr.innerHTML = `<td>Registo ${nome}</td><td>${val}</td>`;
    tabelaBody.appendChild(tr);
  });
}

function renderCodigo() {
  linhasCodigo = operacaoAtual().codigo;
  codigoBox.innerHTML = linhasCodigo
    .map((l, i) => `<span class="line" data-i="${i}">${i + 1}  ${l}</span>`)
    .join("\n");
}

function marcarLinha(i) {
  codigoBox.querySelectorAll(".line").forEach((el) => el.classList.remove("active"));
  const el = codigoBox.querySelector(`.line[data-i="${i}"]`);
  if (el) el.classList.add("active");
}

function log(msg) {
  const li = document.createElement("li");
  li.textContent = msg;
  historico.appendChild(li);
  historico.scrollTop = historico.scrollHeight;
}

function passo() {
  if (linhaAtual >= linhasCodigo.length - 1) {
    pararExecucao();
    resultado.textContent = "Execução concluída (simulação)";
    log("Fim do programa.");
    return;
  }
  linhaAtual++;
  marcarLinha(linhaAtual);
  log(`PC ${linhaAtual + 1}: a executar ${linhasCodigo[linhaAtual]}`);
}

function pararExecucao() {
  clearInterval(execTimer);
  execTimer = null;
}

// ---- eventos ----
$("#qtdMais").onclick = () => { qtdInput.value = Math.min(6, +qtdInput.value + 1); renderValores(); };
$("#qtdMenos").onclick = () => { qtdInput.value = Math.max(1, +qtdInput.value - 1); renderValores(); };
opSelect.onchange = renderValores;

$("#gerar").onclick = () => {
  const valores = Array.from(valoresBox.querySelectorAll("input")).map((i) => +i.value);
  renderCodigo();
  renderTabela(valores);
  pararExecucao();
  linhaAtual = -1;
  historico.innerHTML = "";
  resultado.textContent = "Programa gerado — pronto para executar";
  log(`Operação "${operacaoAtual().label}" carregada com valores [${valores.join(", ")}].`);
};

$("#btnExecutar").onclick = () => {
  if (!linhasCodigo.length) return;
  if (execTimer) return;
  execTimer = setInterval(passo, 900);
};
$("#btnPasso").onclick = () => { if (linhasCodigo.length) passo(); };
$("#btnPausar").onclick = pararExecucao;
$("#btnReiniciar").onclick = () => {
  pararExecucao();
  linhaAtual = -1;
  marcarLinha(-1);
  historico.innerHTML = "";
  resultado.textContent = "A aguardar execução…";
};

document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
  };
});

// estado inicial
renderValores();
