/**
 * As funções dentro deste meu arquivo, têm como abjectivo gerar código urm, segundo diferentes tipos de operações
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

    const instructions_array = [];
    instructions_array[0] = null;
    final_sum_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });


    return instructions_array;
}


// A instrução abaixo serve apenas para teste
//console.log(generate_urm_sum(6));

// A função abaixo cria o código URM para a subtração de n números, com n >= 2
const generate_urm_sub = (qtd_registers)=>{
    // A mesma ideia de separar responsabilidades da código urm, será feita aqui

    const start_code = (linha)=>{
        return `J(2, ${linha+2}, ${linha ==  1 ? linha*4+linha : linha*4+linha+1})\nS(3)\nS(${qtd_registers+2})\nJ(${qtd_registers+2}, ${qtd_registers+2}, ${linha === 1 ? linha*4+linha-4 : linha*4+linha-3})`;
    }

    const middle_code = ()=>{
        return `\nT(${qtd_registers+2}, 2)\nZ(${qtd_registers+2})\n`;
    }

    const end_code = ()=>{
        return `\nT(${qtd_registers+2}, 1)`;
    }

    let final_sub_code = '';
    for(let linha = 1; linha <= qtd_registers-1; linha++) {
        final_sub_code += start_code(linha);
        if(qtd_registers-linha > 1) {
            final_sub_code += middle_code();
        }else {
            final_sub_code += end_code();
        }
    }

    return final_sub_code;
}

console.log(generate_urm_sum(4));