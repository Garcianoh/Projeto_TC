 /* As funções dentro deste meu arquivo, têm como abjectivo gerar código urm, segundo diferentes tipos de operações
 */

// A função da soma abaixo, apenas recebe uma qtd de registradores e gera o código URM corresponde a soma

const generate_urm_sum = (qtd_registers)=>{
    // Uma função de soma de uma máquina urm, divide-a em três partes
    if(qtd_registers < 2) throw new Error("Número de registadores menor que 2");
    const start_code = (linha)=>{
        return  `J(${qtd_registers+2}, ${linha+2}, ${linha*4+linha})\nS(2)\nS(${qtd_registers+2})\nJ(${qtd_registers+2}, ${qtd_registers+2}, ${linha*4+linha-4})`;
    }

    const middle_code = ()=>{
        return `\nZ(${qtd_registers+2})\n`;
    }

    const end_code = ()=>{
        return `\nT(2, 1)`;
    }

    let final_sum_code = '';
    for(let linha = 1; linha <= qtd_registers-1; linha++) {
        final_sum_code += start_code(linha);
        if(qtd_registers-linha > 1) {
            final_sum_code += middle_code();
        }else {
            final_sum_code += end_code();
        }
    }

    return final_sum_code;
}


export const OPERACOES = {
    generate_urm_sum,
};