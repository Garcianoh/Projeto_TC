// ---- Backend real: o front consome estes módulos ----
import { OPERACOES } from "./operacoes.js";
import { OPERACOES_META } from "./metadados.js";
import { prepararExecucao, executarPasso, maiorRegistoUsado, montarRegistos } from "./nucleo.js";

const $ = (sel) => document.querySelector(sel);
const opSelect     = $("#op");
const valoresBox   = $("#valores");
const infoBox      = $("#infoRegistos");
const qtdInput     = $("#qtd");
const codigoBox    = $("#codigo");
const historico    = $("#historico");
const resultado    = $("#resultado");
const tabelaBody   = $("#tabelaRegistos tbody");
const exprInput    = $("#expr");
const exprHint     = $("#exprHint");
const predefBox    = $("#predefBox");
const exprBox      = $("#exprBox");
const registCountBlock = $("#registCountBlock");
const estudanteSection = $("#estudanteSection");
const avancadoSection  = $("#avancadoSection");
const programaManual   = $("#programaManual");
const valoresAvancado  = $("#valoresAvancado");
const avancadoHint     = $("#avancadoHint");

let execTimer = null;
let linhaAtual = -1;
let linhasCodigo = [];
let modoOperacao = "predef";      // "predef" | "expr"
let modoNivel = "estudante";      // "estudante" | "avancado"
let resultadoFinal = null;
let passosPendentes = [];         // {reg, valor} por cada linha, no modo expressão
let registosAtuais = [];          // [{nome, valor}] — estado mostrado na tabela
let registosReais = [];           // vetor numérico real, usado pelo motor URM (índice 0 = R1)
let registosAvancado = [];        // nomes dos registos detetados no modo avançado (ex: ["R2","R3"])
let estadoInicial = null;         // snapshot para o botão "Reiniciar"

// ---------- Interpretador de expressões (2x + 3, 2/2 + 2x, etc.) ----------
function tokenizar(str) {
  const tokens = [];
  const re = /\s*([0-9]+(?:\.[0-9]+)?|[a-zA-Z]+|[+\-*/^()])\s*/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const t = m[1];
    if (/^[0-9]/.test(t)) tokens.push({ t: "num", v: parseFloat(t) });
    else if (/^[a-zA-Z]/.test(t)) tokens.push({ t: "var", v: t });
    else tokens.push({ t: "op", v: t });
  }
  // insere multiplicação implícita: 2x, 3(x+1), x(y), )(  , )x
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    const cur = tokens[i], next = tokens[i + 1];
    if (!next) continue;
    const curFecha  = cur.t === "num" || cur.t === "var" || (cur.t === "op" && cur.v === ")");
    const abreProx  = next.t === "num" || next.t === "var" || (next.t === "op" && next.v === "(");
    if (curFecha && abreProx) out.push({ t: "op", v: "*" });
  }
  return out;
}

function parseExpressao(tokens) {
  let pos = 0;
  const ver = () => tokens[pos];
  const consumir = () => tokens[pos++];

  function primario() {
    const tok = ver();
    if (!tok) throw new Error("expressão incompleta");
    if (tok.t === "op" && tok.v === "(") {
      consumir();
      const n = expr();
      if (!ver() || ver().v !== ")") throw new Error("faltam parênteses");
      consumir();
      return n;
    }
    if (tok.t === "op" && tok.v === "-") { consumir(); return { tipo: "neg", filho: unario() }; }
    if (tok.t === "num") { consumir(); return { tipo: "num", valor: tok.v }; }
    if (tok.t === "var") { consumir(); return { tipo: "var", nome: tok.v }; }
    throw new Error("símbolo inesperado: " + tok.v);
  }
  function unario() { return primario(); }
  function potencia() {
    let esq = unario();
    if (ver() && ver().t === "op" && ver().v === "^") { consumir(); return { tipo: "^", esq, dir: potencia() }; }
    return esq;
  }
  function termo() {
    let esq = potencia();
    while (ver() && ver().t === "op" && (ver().v === "*" || ver().v === "/")) {
      const op = consumir().v;
      esq = { tipo: op, esq, dir: potencia() };
    }
    return esq;
  }
  function expr() {
    let esq = termo();
    while (ver() && ver().t === "op" && (ver().v === "+" || ver().v === "-")) {
      const op = consumir().v;
      esq = { tipo: op, esq, dir: termo() };
    }
    return esq;
  }
  const arvore = expr();
  if (pos < tokens.length) throw new Error("símbolos sobrantes na expressão");
  return arvore;
}

function variaveisDe(nodo, out = new Set()) {
  if (!nodo) return out;
  if (nodo.tipo === "var") out.add(nodo.nome);
  if (nodo.filho) variaveisDe(nodo.filho, out);
  if (nodo.esq) variaveisDe(nodo.esq, out);
  if (nodo.dir) variaveisDe(nodo.dir, out);
  return out;
}

function avaliar(nodo, vars) {
  switch (nodo.tipo) {
    case "num": return nodo.valor;
    case "var": return vars[nodo.nome] ?? 0;
    case "neg": return -avaliar(nodo.filho, vars);
    case "+": return avaliar(nodo.esq, vars) + avaliar(nodo.dir, vars);
    case "-": return avaliar(nodo.esq, vars) - avaliar(nodo.dir, vars);
    case "*": return avaliar(nodo.esq, vars) * avaliar(nodo.dir, vars);
    case "/": return avaliar(nodo.esq, vars) / avaliar(nodo.dir, vars);
    case "^": return Math.pow(avaliar(nodo.esq, vars), avaliar(nodo.dir, vars));
  }
}

// gera passos (pós-ordem) para mostrar "código" e animar registo a registo
function gerarPassos(nodo, vars, regInicial) {
  const passos = [];
  let prox = regInicial;
  function visitar(n) {
    if (n.tipo === "num") return { texto: `${n.valor}`, valor: n.valor };
    if (n.tipo === "var") return { texto: `R${variaveisAtuais.indexOf(n.nome) + 2}(${n.nome}=${vars[n.nome] ?? 0})`, valor: vars[n.nome] ?? 0 };
    if (n.tipo === "neg") {
      const a = visitar(n.filho);
      const valor = -a.valor;
      const reg = prox++;
      passos.push({ linha: `R${reg} = -${a.texto}`, reg, valor });
      return { texto: `R${reg}`, valor };
    }
    const a = visitar(n.esq), b = visitar(n.dir);
    const simbolo = { "+": "+", "-": "-", "*": "×", "/": "÷", "^": "^" }[n.tipo];
    const valor = avaliar(n, vars ?? {});
    const valorReal = { "+": a.valor + b.valor, "-": a.valor - b.valor, "*": a.valor * b.valor, "/": a.valor / b.valor, "^": Math.pow(a.valor, b.valor) }[n.tipo];
    const reg = prox++;
    passos.push({ linha: `R${reg} = ${a.texto} ${simbolo} ${b.texto}`, reg, valor: valorReal });
    return { texto: `R${reg}`, valor: valorReal };
  }
  visitar(nodo);
  return passos;
}

let variaveisAtuais = [];

// popular select de operações (a função vem de operacoes.js, o rótulo de metadados.js)
for (const key of Object.keys(OPERACOES)) {
  const o = document.createElement("option");
  o.value = key; o.textContent = OPERACOES_META[key]?.label ?? key;
  opSelect.appendChild(o);
}

function metaOperacaoAtual() { return OPERACOES_META[opSelect.value]; }

function renderValoresPredef() {
  const n = parseInt(qtdInput.value, 10);
  valoresBox.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const field = document.createElement("div");
    field.className = "value-field";
    field.innerHTML = `<label for="val${i}">Valor ${i} (R${i + 1})</label>
      <input type="number" id="val${i}" value="0">`;
    valoresBox.appendChild(field);
  }
  const meta = metaOperacaoAtual();
  infoBox.textContent = `R1 guarda o resultado; R2..R${n + 1} são os valores inseridos.`;
  infoBox.classList.toggle("warn", !meta.verificado);
  if (!meta.verificado) {
    infoBox.textContent += " ⚠ Programa ainda não verificado — o resultado pode não ser exato.";
  }
}

function renderValoresExpr() {
  valoresBox.innerHTML = "";
  let vars = [];
  try {
    const arvore = parseExpressao(tokenizar(exprInput.value || ""));
    vars = [...variaveisDe(arvore)].sort();
    exprHint.textContent = vars.length
      ? `Variáveis detetadas: ${vars.join(", ")}`
      : "Expressão sem variáveis — será calculada diretamente.";
  } catch (e) {
    exprHint.textContent = "A escrever… (" + e.message + ")";
  }
  variaveisAtuais = vars;
  vars.forEach((nome, i) => {
    const field = document.createElement("div");
    field.className = "value-field";
    field.innerHTML = `<label for="var_${nome}">Valor de ${nome} (R${i + 2})</label>
      <input type="number" id="var_${nome}" value="0">`;
    valoresBox.appendChild(field);
  });
  infoBox.textContent = vars.length
    ? `Registos necessários: R1 (resultado) + ${vars.length} variável(is) + registos temporários`
    : `Registos necessários: R1 (resultado)`;
}

function renderValores() {
  modoOperacao === "predef" ? renderValoresPredef() : renderValoresExpr();
}

// ---------- Modo Avançado: deteção de registos a partir do programa escrito ----------
function linhasDoProgramaManual() {
  return programaManual.value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

$("#detetarRegistos").onclick = () => {
  const linhas = linhasDoProgramaManual();
  if (!linhas.length) {
    avancadoHint.textContent = "Escreva pelo menos uma instrução antes de detetar os registos.";
    return;
  }
  const maior = maiorRegistoUsado(linhas);
  if (maior < 2) {
    avancadoHint.textContent = "O programa só usa R1 (resultado) — não há registos de entrada para preencher.";
    registosAvancado = [];
    valoresAvancado.innerHTML = "";
    return;
  }
  registosAvancado = [];
  valoresAvancado.innerHTML = "";
  for (let r = 2; r <= maior; r++) {
    registosAvancado.push(`R${r}`);
    const field = document.createElement("div");
    field.className = "value-field";
    field.innerHTML = `<label for="val_av_${r}">Valor de R${r}</label>
      <input type="number" id="val_av_${r}" value="0">`;
    valoresAvancado.appendChild(field);
  }
  avancadoHint.textContent = `Registos de entrada detetados: ${registosAvancado.join(", ")}. R1 guarda o resultado.`;
};

function renderTabela(linhas) {
  // linhas: [{nome, valor}]
  tabelaBody.innerHTML = "";
  registosAtuais = linhas;
  linhas.forEach(({ nome, valor }) => {
    const tr = document.createElement("tr");
    tr.id = `tr_${nome}`;
    tr.innerHTML = `<td>Registo ${nome}</td><td>${valor}</td>`;
    tabelaBody.appendChild(tr);
  });
}

function atualizarRegisto(nome, valor) {
  let tr = document.getElementById(`tr_${nome}`);
  if (!tr) {
    tr = document.createElement("tr");
    tr.id = `tr_${nome}`;
    tr.innerHTML = `<td>Registo ${nome}</td><td></td>`;
    tabelaBody.appendChild(tr);
  }
  tr.children[1].textContent = valor;
  tr.classList.remove("updated");
  requestAnimationFrame(() => {
    tr.classList.add("updated");
    setTimeout(() => tr.classList.remove("updated"), 700);
  });
}

function renderCodigo() {
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

function mostrarResultado(texto) {
  resultado.textContent = texto;
  resultado.classList.remove("pop");
  requestAnimationFrame(() => resultado.classList.add("pop"));
}

function marcarResultadoFinal(valor) {
  mostrarResultado(`Resultado: R1 = ${valor}`);
  const tr = document.getElementById("tr_R1");
  if (tr) tr.classList.add("resultado-final");
  log("Fim do programa.");
}

// modo expressão: os "passos" já vêm calculados (ver gerarPassos), só animamos
function passoExpressao() {
  if (linhaAtual >= linhasCodigo.length - 1) {
    pararExecucao();
    atualizarRegisto("R1", resultadoFinal);
    marcarResultadoFinal(resultadoFinal);
    return;
  }
  linhaAtual++;
  marcarLinha(linhaAtual);
  const passoAtual = passosPendentes[linhaAtual];
  log(`PC ${linhaAtual + 1}: a executar ${linhasCodigo[linhaAtual]}`);
  if (passoAtual) atualizarRegisto(`R${passoAtual.reg}`, passoAtual.valor);
}

// modo predefinido real + modo avançado: executa instrução a instrução sobre registosReais
function passoURMReal() {
  if (linhaAtual < 0) linhaAtual = 0;
  if (linhaAtual >= linhasCodigo.length) {
    pararExecucao();
    marcarResultadoFinal(registosReais[0]);
    return;
  }
  marcarLinha(linhaAtual);
  const r = executarPasso(registosReais, linhasCodigo, linhaAtual);
  log(`PC ${linhaAtual + 1}: executado ${r.instrucaoExecutada}` + (r.registoAlterado ? ` → R${r.registoAlterado} = ${r.valorNovo}` : ""));
  if (r.registoAlterado) atualizarRegisto(`R${r.registoAlterado}`, r.valorNovo);
  linhaAtual = r.ponteiro;
  if (linhaAtual >= linhasCodigo.length) {
    pararExecucao();
    marcarResultadoFinal(registosReais[0]);
  }
}

function passo() {
  if (modoNivel === "estudante" && modoOperacao === "expr") passoExpressao();
  else passoURMReal();
}

function pararExecucao() {
  clearInterval(execTimer);
  execTimer = null;
}

// ---- eventos ----
$("#qtdMais").onclick = () => { qtdInput.value = Math.min(6, +qtdInput.value + 1); renderValores(); };
$("#qtdMenos").onclick = () => { qtdInput.value = Math.max(1, +qtdInput.value - 1); renderValores(); };
opSelect.onchange = renderValores;

function gerarPredef() {
  const valores = Array.from(valoresBox.querySelectorAll("input")).map((i) => +i.value);

  // aqui é onde o front consome o backend: prepararExecucao chama a função
  // real da operação (operacoes.js) e já devolve registos + instruções prontos
  const { registos, instrucoes } = prepararExecucao(valores.length, opSelect.value, valores);
  linhasCodigo = instrucoes;
  registosReais = registos;

  const tabela = registosReais.map((v, i) => ({ nome: `R${i + 1}`, valor: v }));
  renderCodigo();
  renderTabela(tabela);
  estadoInicial = { registos: [...registosReais], tabela };
  log(`Operação "${metaOperacaoAtual().label}" carregada com valores [${valores.join(", ")}].`);
}

function gerarAvancado() {
  const linhas = linhasDoProgramaManual();
  if (!linhas.length) {
    avancadoHint.textContent = "Escreva um programa antes de gerar.";
    linhasCodigo = [];
    return;
  }
  linhasCodigo = linhas;

  const valores = registosAvancado.map((nome) => {
    const idx = nome.replace("R", "");
    return +(document.getElementById(`val_av_${idx}`)?.value ?? 0);
  });

  // modo avançado não tem "função de operação" — as instruções já vêm do textarea,
  // por isso usamos montarRegistos() diretamente em vez de prepararExecucao()
  registosReais = montarRegistos(registosAvancado.length, linhasCodigo, valores);

  const tabela = registosReais.map((v, i) => ({ nome: `R${i + 1}`, valor: v }));
  renderCodigo();
  renderTabela(tabela);
  estadoInicial = { registos: [...registosReais], tabela };
  log(`Programa manual carregado com ${linhas.length} instruções.`);
}

function gerarExpressao() {
  let arvore;
  try {
    arvore = parseExpressao(tokenizar(exprInput.value || ""));
  } catch (e) {
    exprHint.textContent = "Erro na expressão: " + e.message;
    linhasCodigo = [];
    return;
  }
  const vars = {};
  variaveisAtuais.forEach((nome) => {
    vars[nome] = +(document.getElementById(`var_${nome}`)?.value ?? 0);
  });

  const regInicial = variaveisAtuais.length + 2; // depois de R1 + variáveis
  const passos = gerarPassos(arvore, vars, regInicial);
  resultadoFinal = avaliar(arvore, vars);

  linhasCodigo = passos.map((p) => p.linha);
  passosPendentes = passos.map((p) => ({ reg: p.reg, valor: Number(p.valor.toFixed(4)) }));

  renderCodigo();
  renderTabela([
    { nome: "R1", valor: 0 },
    ...variaveisAtuais.map((nome, i) => ({ nome: `R${i + 2}`, valor: vars[nome] })),
  ]);
  log(`Expressão "${exprInput.value}" carregada com ${JSON.stringify(vars)}.`);
}

$("#gerar").onclick = () => {
  pararExecucao();
  linhaAtual = -1;
  historico.innerHTML = "";
  resultadoFinal = null;
  passosPendentes = [];

  if (modoNivel === "avancado") {
    gerarAvancado();
  } else if (modoOperacao === "predef") {
    gerarPredef();
  } else {
    gerarExpressao();
  }
  mostrarResultado(linhasCodigo.length ? "Programa gerado — pronto para executar" : "Corrija o programa/expressão para continuar");
};

document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    modoNivel = t.dataset.mode;
    estudanteSection.classList.toggle("hidden", modoNivel !== "estudante");
    avancadoSection.classList.toggle("hidden", modoNivel !== "avancado");

    pararExecucao();
    linhaAtual = -1;
    linhasCodigo = [];
    registosReais = [];
    codigoBox.innerHTML = "";
    tabelaBody.innerHTML = "";
    historico.innerHTML = "";
    resultado.textContent = "A aguardar execução…";
  };
});

document.querySelectorAll(".modebtn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".modebtn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    modoOperacao = btn.dataset.opmode;
    predefBox.classList.toggle("hidden", modoOperacao !== "predef");
    exprBox.classList.toggle("hidden", modoOperacao !== "expr");
    registCountBlock.classList.toggle("hidden", modoOperacao !== "predef");
    renderValores();
  };
});

exprInput.addEventListener("input", renderValoresExpr);

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

  if (estadoInicial) {
    registosReais = [...estadoInicial.registos];
    renderTabela(estadoInicial.tabela.map((r) => ({ ...r })));
  }
};

// estado inicial
renderValores();
