// metadados.js
// Informação de apresentação (rótulo + se já está validada), separada da lógica
// em operacoes.js para o contrato do colega ficar limpo: cada função só recebe
// a quantidade de entradas e devolve instruções — nada de UI misturado aí.
export const OPERACOES_META = {
  soma:          { label: "Soma",          verificado: true },
  subtracao:     { label: "Subtração",     verificado: true },
  maximo:        { label: "Máximo",        verificado: true },
  minimo:        { label: "Mínimo",        verificado: true },
  multiplicacao: { label: "Multiplicação", verificado: false },
  divisao:       { label: "Divisão",       verificado: false },
  potencia:      { label: "Potência",      verificado: false, entradas: 2, rotulos: ["Base", "Expoente"] },
  raiz:          { label: "Raiz",          verificado: false, entradas: 1 },
  fatorial:      { label: "Fatorial",      verificado: false, entradas: 1 },
};
