// metadados.js
// Informação de apresentação (rótulo + se já está validada), separada da lógica
// em operacoes.js para o contrato do colega ficar limpo: cada função só recebe
// a quantidade de entradas e devolve instruções — nada de UI misturado aí.
export const OPERACOES_META = {
  generate_urm_sum:          { label: "Soma",          verificado: true },
  subtracao:     { label: "Subtração",     verificado: true },
  maximo:        { label: "Máximo",        verificado: true },
  minimo:        { label: "Mínimo",        verificado: true },
  multiplicacao: { label: "Multiplicação", verificado: false },
  divisao:       { label: "Divisão",       verificado: false },
  potencia:      { label: "Potência",      verificado: false },
  raiz:          { label: "Raiz",          verificado: false },
  fatorial:      { label: "Fatorial",      verificado: false },
};
