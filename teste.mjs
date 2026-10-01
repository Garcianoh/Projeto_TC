import { prepararExecucao, executar } from "./nucleo.js";

const { registos, instrucoes } = prepararExecucao(2, "soma", [3, 4]);
console.log(instrucoes);
console.log("antes:", [...registos]);
console.log("R1 =", executar(registos, instrucoes));
console.log("depois:", [...registos]);