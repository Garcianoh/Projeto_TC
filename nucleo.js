import { OPERACOES } from "./eliezer_code.js";

//função para estrair os registadores (numero inteiro), em cada umas das instruções urm
function registosNaInstrucao(instrucao) {
    const numeros = (instrucao.match(/\d+/g) || []).map(Number);
    const tipoInstrucao = instrucao.trim()[0].toUpperCase();

    switch (tipoInstrucao) {
        case "Z":
        case "S":
            return [numeros[0]];
        case "T":
            return [numeros[0], numeros[1]];
        case "J":
            return [numeros[0], numeros[1]];
        default:
            return numeros;
    }
}

//função para tornar o numero do maior registador devolvido pelo programa
function maiorRegistradorUsado(instrucoes) {
    let maior = 0;
    for (const linha of instrucoes) {
        for (const r of registosNaInstrucao(linha)) {
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
      if (registos[m - 1] === registos[n - 1]) proximo = q - 1;
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
  let i = 0;
  while (i < instrucoes.length) i = executarPasso(registos, instrucoes, i).ponteiro;
  return registos[0];
}

/*export function prepararExecucao(quantidadeEntradas, nomeOperacao, valoresInseridos) {
    const funcaoOperacao = OPERACOES[nomeOperacao];
    if (!funcaoOperacao) {
        throw new Error (`Operação "${nomeOperacao}" não registada em operações`);
    }
    if (valoresInseridos.length !== quantidadeEntradas) {
        throw new Error (`Esperava ${quantidadeEntradas} valores, recebeu ${valoresInseridos.length}.`);
    }

    //apenas instruções
    const instrucoes = funcaoOperacao(quantidadeEntradas);

    const registosIniciais = quantidadeEntradas + 1;

    const maiorRegisto = maiorRegistradorUsado(instrucoes);

    //maximo entre a quantidade de registos iniciais com o maior Registo usuado
    const totalRegistos = Math.max(registosIniciais, maiorRegisto);

    //inicializar o vetor de registradores com os valores inseridos
    const vetorRegistos = new Array(totalRegistos).fill(0);
    for (let i = 0; i < quantidadeEntradas; i++) {
        vetorRegistos [i+1] = valoresInseridos[i];
    }
    return { vetorRegistos, instrucoes };
}

//função que executa, recebe o vetor de registos e o vetor de instruções
export function executador(vetorRegistos, vetorInstrucao) {

    for (let i=0; i<vetorInstrucao.length; i++) {
        let instrucao = vetorInstrucao [i];

        //extrai numeros da string equivalente a cada uma das instruções
        const registoOperacao = (instrucao.match(/\d+/g) || []).map(Number);
        //elimina espaços vazios no incio e garante que o simbolo da instrução esteja sempre em maiúscula
        const inst = instrucao.trim()[0].toUpperCase();

        switch (inst) {
            case "S":
                vetorRegistos [registoOperacao[0] - 1] ++;
                i++;
                break;
            case "Z":
                vetorRegistos [registoOperacao[0] - 1] = 0;
                i++;
                break;
            case "T":
                vetorRegistos [registoOperacao[1] - 1] = vetorRegistos[registoOperacao[0] - 1];
                i++;
                break;
            case "J": {
                const [m, n, linhaDestino] = registoOperacao;
                if (vetorRegistos[m -1] === vetorRegistos[n-1]) {
                    i = linhaDestino - 1;
                } else {
                    i++;
                }
                break;
            }
            default:
                throw new Error(`Instrução desconhecida: "${instrucao}`);
        }
    }
    return vetorRegistos [0];
}
*/