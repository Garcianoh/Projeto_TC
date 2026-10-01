// ---- Backend real: o front consome estes módulos ----
import { OPERACOES } from "./operacoes.js";
import { OPERACOES_META } from "./metadados.js";
import { prepararExecucao, executarPasso, montarRegistos } from "./nucleo.js";

const $ = (sel) => document.querySelector(sel);
const opSelect         = $("#op");
const valoresBox       = $("#valores");
const infoBox          = $("#infoRegistos");
const qtdInput         = $("#qtd");
const codigoBox        = $("#codigo");
const historico        = $("#historico");
const resultado        = $("#resultado");
const tabelaBody       = $("#tabelaRegistos tbody");
const exprInput        = $("#expr");
const exprHint         = $("#exprHint");
const predefBox        = $("#predefBox");
const exprBox          = $("#exprBox");
const registCountBlock = $("#registCountBlock");
const estudanteSection = $("#estudanteSection");
const avancadoSection  = $("#avancadoSection");
const programaManual   = $("#programaManual");
const valoresAvancado  = $("#valoresAvancado");
const avancadoHint     = $("#avancadoHint");
const qtdAv            = $("#qtdAv");

const MAX_PASSOS = 10000; // proteção contra programas que nunca terminam

let execTimer = null;
let linhaAtual = -1;
let linhasCodigo = [];
let modoOperacao = "predef";      // "predef" | "expr"
let modoNivel = "estudante";      // "estudante" | "avancado"
let resultadoFinal = null;
let passosPendentes = [];         // {reg, valor} por cada linha, no modo expressão
let registosReais = [];           // vetor numérico usado pelo motor URM (índice 0 = R1)
let registosAvancado = [];        // ex: ["R2","R3"] (entradas do modo avançado)
let estadoInicial = null;         // snapshot para o botão "Reiniciar"
let variaveisAtuais = [];
let terminado = false;
let contadorPassos = 0;

// ---------- Interpretador de expressões ----------
// Funções: max(a,b,...), min(a,b,...), raiz(x)/sqrt(x), fat(x)/fatorial(x), x!
const FUNCS = { max: "max", min: "min", raiz: "raiz", sqrt: "raiz", fat: "fat", fatorial: "fat" };
const ehFuncao = (tok, seg) =>
  tok && tok.t === "var" && FUNCS[tok.v.toLowerCase()] && seg && seg.t === "op" && seg.v === "(";

function tokenizar(str) {
  const tokens = [];
  const re = /\s*([0-9]+(?:\.[0-9]+)?|[a-zA-Z]+|[+\-*/^()!,])\s*/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const t = m[1];
    if (/^[0-9]/.test(t)) tokens.push({ t: "num", v: parseFloat(t) });
    else if (/^[a-zA-Z]/.test(t)) tokens.push({ t: "var", v: t });
    else tokens.push({ t: "op", v: t });
  }
  // multiplicação implícita: 2x, 3(x+1), x(y), )(, )x, x!y ...
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    const cur = tokens[i], next = tokens[i + 1];
    if (!next) continue;
    if (ehFuncao(cur, next)) continue; // fat( ... ) não é fat * (...)
    const curFecha = cur.t === "num" || cur.t === "var" || (cur.t === "op" && (cur.v === ")" || cur.v === "!"));
    const abreProx = next.t === "num" || next.t === "var" || (next.t === "op" && next.v === "(");
    if (curFecha && abreProx) out.push({ t: "op", v: "*" });
  }
  return out;
}

function parseExpressao(tokens) {
  let pos = 0;
  const ver = () => tokens[pos];
  const consumir = () => tokens[pos++];

  function primarioBase() {
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
    if (ehFuncao(tok, tokens[pos + 1])) {
      const nome = FUNCS[tok.v.toLowerCase()];
      consumir(); consumir(); // nome e "("
      const args = [expr()];
      while (ver() && ver().v === ",") { consumir(); args.push(expr()); }
      if (!ver() || ver().v !== ")") throw new Error("faltam parênteses");
      consumir();
      if ((nome === "raiz" || nome === "fat") && args.length !== 1) throw new Error(`${nome} recebe 1 argumento`);
      if ((nome === "max" || nome === "min") && args.length < 2) throw new Error(`${nome} precisa de 2 ou mais argumentos`);
      return { tipo: "func", nome, args };
    }
    if (tok.t === "var") { consumir(); return { tipo: "var", nome: tok.v }; }
    throw new Error("símbolo inesperado: " + tok.v);
  }
  function primario() {
    let n = primarioBase();
    while (ver() && ver().t === "op" && ver().v === "!") {
      consumir();
      n = { tipo: "func", nome: "fat", args: [n] };
    }
    return n;
  }
  function unario() { return primario(); }
  function potencia() {
    const esq = unario();
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

function aplicarFuncao(nome, v) {
  switch (nome) {
    case "max":  return Math.max(...v);
    case "min":  return Math.min(...v);
    case "raiz": return Math.floor(Math.sqrt(v[0])); // raiz inteira, como na URM
    case "fat":  { let r = 1; for (let i = 2; i <= v[0]; i++) r *= i; return r; }
  }
}

function variaveisDe(nodo, out = new Set()) {
  if (!nodo) return out;
  if (nodo.tipo === "var") out.add(nodo.nome);
  if (nodo.filho) variaveisDe(nodo.filho, out);
  if (nodo.esq) variaveisDe(nodo.esq, out);
  if (nodo.dir) variaveisDe(nodo.dir, out);
  if (nodo.args) nodo.args.forEach((a) => variaveisDe(a, out));
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
    case "func": return aplicarFuncao(nodo.nome, nodo.args.map((a) => avaliar(a, vars)));
  }
}

// gera passos (pós-ordem) para mostrar "código" e animar registo a registo
function gerarPassos(nodo, vars, regInicial) {
  const passos = [];
  let prox = regInicial;
  function visitar(n) {
    if (n.tipo === "num") return { texto: `${n.valor}`, valor: n.valor };
    if (n.tipo === "var") {
      const v = vars[n.nome] ?? 0;
      return { texto: `R${variaveisAtuais.indexOf(n.nome) + 2}(${n.nome}=${v})`, valor: v };
    }
    if (n.tipo === "neg") {
      const a = visitar(n.filho);
      const valor = -a.valor;
      const reg = prox++;
      passos.push({ linha: `R${reg} = -${a.texto}`, reg, valor });
      return { texto: `R${reg}`, valor };
    }
    if (n.tipo === "func") {
      const as = n.args.map(visitar);
      const valor = aplicarFuncao(n.nome, as.map((a) => a.valor));
      const reg = prox++;
      passos.push({ linha: `R${reg} = ${n.nome}(${as.map((a) => a.texto).join(", ")})`, reg, valor });
      return { texto: `R${reg}`, valor };
    }
    const a = visitar(n.esq), b = visitar(n.dir);
    const simbolo = { "+": "+", "-": "-", "*": "×", "/": "÷", "^": "^" }[n.tipo];
    const valor = { "+": a.valor + b.valor, "-": a.valor - b.valor, "*": a.valor * b.valor, "/": a.valor / b.valor, "^": Math.pow(a.valor, b.valor) }[n.tipo];
    const reg = prox++;
    passos.push({ linha: `R${reg} = ${a.texto} ${simbolo} ${b.texto}`, reg, valor });
    return { texto: `R${reg}`, valor };
  }
  visitar(nodo);
  return passos;
}

// ---------- Select de operações (função em operacoes.js, rótulo em metadados.js) ----------
for (const key of Object.keys(OPERACOES)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = OPERACOES_META[key]?.label ?? key;
  opSelect.appendChild(o);
}

function metaOperacaoAtual() { return OPERACOES_META[opSelect.value] ?? {}; }

// ---------- Modo Estudante: valores ----------
function renderValoresPredef() {
  const n = parseInt(qtdInput.value, 10);
  const meta = metaOperacaoAtual();
  valoresBox.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const nome = meta.rotulos?.[i - 1] ?? `Valor ${i}`;
    const field = document.createElement("div");
    field.className = "value-field";
    field.innerHTML = `<label for="val${i}">${nome} (R${i + 1})</label>
      <input type="number" id="val${i}" value="0">`;
    valoresBox.appendChild(field);
  }
  infoBox.textContent = `R1 guarda o resultado; R2..R${n + 1} são os valores inseridos.`;
  infoBox.classList.toggle("warn", !meta.verificado);
  if (!meta.verificado) {
    infoBox.textContent += " ⚠ Programa ainda não verificado — o resultado pode não ser exato.";
  }
}

function renderValoresExpr() {
  valoresBox.innerHTML = "";
  infoBox.classList.remove("warn");
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

// Mostra ou esconde o seletor de quantidade: operações com nº fixo de entradas não o mostram
function atualizarBlocoQtd() {
  const fixa = metaOperacaoAtual().entradas;
  if (fixa) qtdInput.value = fixa;
  registCountBlock.classList.toggle("hidden", !!fixa);
}

function renderValores() {
  if (modoOperacao === "predef") { atualizarBlocoQtd(); renderValoresPredef(); }
  else { registCountBlock.classList.add("hidden"); renderValoresExpr(); }
}

// ---------- Modo Avançado: o utilizador indica quantas entradas existem ----------
function linhasDoProgramaManual() {
  return programaManual.value.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

function renderValoresAvancado() {
  const n = +qtdAv.value;
  registosAvancado = [];
  valoresAvancado.innerHTML = "";
  for (let r = 2; r <= n + 1; r++) {
    registosAvancado.push(`R${r}`);
    const field = document.createElement("div");
    field.className = "value-field";
    field.innerHTML = `<label for="val_av_${r}">Valor de R${r}</label>
      <input type="number" id="val_av_${r}" value="0">`;
    valoresAvancado.appendChild(field);
  }
  avancadoHint.textContent = n
    ? `Entradas: ${registosAvancado.join(", ")}. R1 guarda o resultado; os outros registos usados pelo programa começam a 0.`
    : "Sem entradas: todos os registos começam a 0.";
}

$("#qtdAvMais").onclick  = () => { qtdAv.value = Math.min(6, +qtdAv.value + 1); renderValoresAvancado(); };
$("#qtdAvMenos").onclick = () => { qtdAv.value = Math.max(0, +qtdAv.value - 1); renderValoresAvancado(); };

// ---------- Tabela, código, histórico ----------
function renderTabela(linhas) {
  tabelaBody.innerHTML = "";
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
  const base1 = linhasCodigo[0] === null;
  codigoBox.innerHTML = linhasCodigo
    .map((l, i) => l === null ? "" : `<span class="line" data-i="${i}">${base1 ? i : i + 1}  ${l}</span>`)
    .filter(Boolean)
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
  terminado = true;
  mostrarResultado(`Resultado: R1 = ${valor}`);
  const tr = document.getElementById("tr_R1");
  if (tr) tr.classList.add("resultado-final");
  log("Fim do programa.");
}

// ---------- Execução ----------
function pararExecucao() {
  clearInterval(execTimer);
  execTimer = null;
}

// modo expressão: os passos já vêm calculados, só animamos
function passoExpressao() {
  if (terminado) { pararExecucao(); return; }
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

// modo predefinido real + modo avançado: executa instrução a instrução (1-based)
function passoURMReal() {
  if (terminado) { pararExecucao(); return; }
  if (linhaAtual < 1) linhaAtual = 1;
  if (linhaAtual >= linhasCodigo.length) {
    pararExecucao();
    marcarResultadoFinal(registosReais[0]);
    return;
  }
  if (++contadorPassos > MAX_PASSOS) {
    pararExecucao();
    terminado = true;
    mostrarResultado("Execução interrompida: demasiados passos (o programa pode não terminar).");
    log(`Interrompido após ${MAX_PASSOS} passos.`);
    return;
  }
  marcarLinha(linhaAtual);
  let r;
  try {
    r = executarPasso(registosReais, linhasCodigo, linhaAtual);
  } catch (e) {
    pararExecucao();
    terminado = true;
    mostrarResultado("Erro: " + e.message);
    log("Erro na linha " + linhaAtual + ": " + e.message);
    return;
  }
  log(`PC ${linhaAtual}: executado ${r.instrucaoExecutada}` + (r.registoAlterado ? ` → R${r.registoAlterado} = ${r.valorNovo}` : ""));
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

// ---------- Gerar ----------
function gerarPredef() {
  const valores = Array.from(valoresBox.querySelectorAll("input")).map((i) => +i.value);
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
  linhasCodigo = [null, ...linhas];

  const valores = registosAvancado.map((nome) =>
    +(document.getElementById(`val_av_${nome.replace("R", "")}`)?.value ?? 0)
  );
  // as instruções vêm do textarea; os registos de trabalho começam a 0
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

  const tabela = [
    { nome: "R1", valor: 0 },
    ...variaveisAtuais.map((nome, i) => ({ nome: `R${i + 2}`, valor: vars[nome] })),
  ];
  renderCodigo();
  renderTabela(tabela);
  estadoInicial = { registos: [], tabela };
  log(`Expressão "${exprInput.value}" carregada com ${JSON.stringify(vars)}.`);
}

// ---------- Eventos ----------
$("#qtdMais").onclick  = () => { qtdInput.value = Math.min(6, +qtdInput.value + 1); renderValores(); };
$("#qtdMenos").onclick = () => { qtdInput.value = Math.max(1, +qtdInput.value - 1); renderValores(); };
opSelect.onchange = renderValores;
exprInput.addEventListener("input", renderValoresExpr);

$("#gerar").onclick = () => {
  pararExecucao();
  linhaAtual = -1;
  terminado = false;
  contadorPassos = 0;
  historico.innerHTML = "";
  resultadoFinal = null;
  passosPendentes = [];

  try {
    if (modoNivel === "avancado") gerarAvancado();
    else if (modoOperacao === "predef") gerarPredef();
    else gerarExpressao();
  } catch (e) {
    linhasCodigo = [];
    mostrarResultado("Erro: " + e.message);
    return;
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
    terminado = false;
    contadorPassos = 0;
    linhasCodigo = [];
    registosReais = [];
    codigoBox.innerHTML = "";
    tabelaBody.innerHTML = "";
    historico.innerHTML = "";
    resultado.textContent = "A aguardar execução…";

    if (modoNivel === "estudante") renderValores();
    else {
      infoBox.classList.remove("warn");
      infoBox.textContent = "R1 guarda o resultado; as entradas são R2..R(n+1).";
    }
  };
});

document.querySelectorAll(".modebtn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".modebtn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    modoOperacao = btn.dataset.opmode;
    predefBox.classList.toggle("hidden", modoOperacao !== "predef");
    exprBox.classList.toggle("hidden", modoOperacao !== "expr");
    renderValores();
  };
});

$("#btnExecutar").onclick = () => {
  if (!linhasCodigo.length || execTimer || terminado) return;
  execTimer = setInterval(passo, 300);
};
$("#btnPasso").onclick = () => { if (linhasCodigo.length) passo(); };
$("#btnPausar").onclick = pararExecucao;
$("#btnReiniciar").onclick = () => {
  pararExecucao();
  linhaAtual = -1;
  terminado = false;
  contadorPassos = 0;
  marcarLinha(-1);
  historico.innerHTML = "";
  resultado.textContent = "A aguardar execução…";
  if (estadoInicial) {
    registosReais = [...estadoInicial.registos];
    renderTabela(estadoInicial.tabela.map((r) => ({ ...r })));
  }
};

// ---------- Estado inicial ----------
renderValores();
renderValoresAvancado();