// nucleo.js
// Ponte entre as operações (operacoes.js) e qualquer interface (front-end, testes, etc.)
import { OPERACOES } from "./operacoes.js";

export function registosNaInstrucao(instrucao) {
  const numeros = (instrucao.match(/\d+/g) || []).map(Number);
  const tipo = instrucao.trim()[0]?.toUpperCase();
  switch (tipo) {
    case "Z": case "S": return [numeros[0]];
    case "T": case "J": return [numeros[0], numeros[1]]; // no J, o 3º número é linha, não registo
    default: return numeros;
  }
}

export function maiorRegistoUsado(instrucoes) {
  let maior = 0;
  for (let i = 1; i < instrucoes.length; i++) {
    for (const r of registosNaInstrucao(instrucoes[i])) {
      if (r > maior) maior = r;
    }
  }
  return maior;
}

/** Monta o vetor de registos inicial a partir da quantidade de entradas e dos valores. */
export function montarRegistos(quantidadeEntradas, instrucoes, valores) {
  const registosIniciais = quantidadeEntradas + 1;
  const total = Math.max(registosIniciais, maiorRegistoUsado(instrucoes));
  const registos = new Array(total).fill(0);
  for (let i = 0; i < quantidadeEntradas; i++) registos[i + 1] = valores[i];
  return registos;
}

/** Usa uma operação registada em operacoes.js (Modo Estudante). */
export function prepararExecucao(quantidadeEntradas, nomeOperacao, valores) {
  const funcaoOperacao = OPERACOES[nomeOperacao];
  if (!funcaoOperacao) throw new Error(`Operação "${nomeOperacao}" não registada em operacoes.js`);
  if (valores.length !== quantidadeEntradas) {
    throw new Error(`Esperava ${quantidadeEntradas} valores, recebeu ${valores.length}.`);
  }
  const instrucoes = funcaoOperacao(quantidadeEntradas);
  const registos = montarRegistos(quantidadeEntradas, instrucoes, valores);
  return { registos, instrucoes };
}

/**
 * Executa UMA instrução a partir de `ponteiro`, mutando `registos` diretamente.
 * Não mexe em DOM nenhum — quem chama decide como mostrar a mudança.
 */
export function executarPasso(registos, instrucoes, ponteiro) {
  const instrucao = instrucoes[ponteiro];
  const nums = (instrucao.match(/\d+/g) || []).map(Number);
  const tipo = instrucao.trim()[0]?.toUpperCase();
  let proximo = ponteiro + 1;
  let registoAlterado = null;

  switch (tipo) {
    case "S":
      registos[nums[0] - 1]++;
      registoAlterado = nums[0];
      break;
    case "Z":
      registos[nums[0] - 1] = 0;
      registoAlterado = nums[0];
      break;
    case "T":
      registos[nums[1] - 1] = registos[nums[0] - 1];
      registoAlterado = nums[1];
      break;
    case "J": {
      const [m, n, q] = nums;
      if (registos[m - 1] === registos[n - 1]) proximo = q;
      break;
    }
    default:
      throw new Error(`Instrução desconhecida: "${instrucao}"`);
  }

  return {
    ponteiro: proximo,
    instrucaoExecutada: instrucao,
    registoAlterado,
    valorNovo: registoAlterado ? registos[registoAlterado - 1] : null,
    concluido: proximo >= instrucoes.length,
  };
}

/** Corre o programa até ao fim de uma vez (útil em testes). */
export function executar(registos, instrucoes) {
  let i = 1;
  while (i < instrucoes.length) i = executarPasso(registos, instrucoes, i).ponteiro;
  return registos[0];
}
