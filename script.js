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

let execTimer = null;
let linhaAtual = -1;
let linhasCodigo = [];
let modoOperacao = "predef";      // "predef" | "expr"
let resultadoFinal = null;
let passosPendentes = [];         // {reg, valor} por cada linha, no modo expressão
let registosAtuais = [];          // [{nome, valor}]

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

// popular select de operações
for (const [key, op] of Object.entries(OPERACOES)) {
  const o = document.createElement("option");
  o.value = key; o.textContent = op.label;
  opSelect.appendChild(o);
}

function operacaoAtual() { return OPERACOES[opSelect.value]; }

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
  infoBox.textContent = `Registos necessários para esta operação: ${operacaoAtual().registosInfo}`;
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
  linhasCodigo = operacaoAtual();
  const n = parseInt(qtdInput.value, 10);
  let codigo = '';
  switch (linhasCodigo.label) {
    case 'Soma':
        codigo = generate_urm_sum(n);
      break;
    case 'Subtração':
        codigo = generate_urm_sub(n);
      break;
    case 'Multiplicação':

      break;
    case 'Divisão':

      break;
    case 'Potência':

      break;
    
    default:
      break;
  }
  codigo.shift();
  codigoBox.innerHTML = codigo
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

function passo() {
  if (linhaAtual >= linhasCodigo.length - 1) {
    pararExecucao();
    if (modoOperacao === "expr" && resultadoFinal !== null) {
      mostrarResultado(`Resultado: R1 = ${resultadoFinal}`);
      atualizarRegisto("R1", resultadoFinal);
    } else {
      mostrarResultado("Execução concluída (simulação)");
    }
    log("Fim do programa.");
    return;
  }
  linhaAtual++;
  marcarLinha(linhaAtual);
  log(`PC ${linhaAtual + 1}: a executar ${linhasCodigo[linhaAtual]}`);

  if (modoOperacao === "expr" && passosPendentes[linhaAtual]) {
    const { reg, valor } = passosPendentes[linhaAtual];
    atualizarRegisto(`R${reg}`, valor);
  }
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
  linhasCodigo = operacaoAtual().codigo;
  passosPendentes = [];
  resultadoFinal = null;
  renderCodigo();
  renderTabela([
    { nome: "R1", valor: 0 },
    ...valores.map((v, i) => ({ nome: `R${i + 2}`, valor: v })),
  ]);
  log(`Operação "${operacaoAtual().label}" carregada com valores [${valores.join(", ")}].`);
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
  modoOperacao === "predef" ? gerarPredef() : gerarExpressao();
  mostrarResultado(linhasCodigo.length ? "Programa gerado — pronto para executar" : "Corrija a expressão para continuar");
};

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
};

document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
  };
});

// estado inicial
renderValores();
