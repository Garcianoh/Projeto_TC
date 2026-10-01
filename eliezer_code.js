 /* As funções dentro deste meu arquivo, têm como abjectivo gerar código urm, segundo diferentes tipos de operações
 */

// A função da soma abaixo, apenas recebe uma qtd de registradores e gera o código URM corresponde a soma

const soma = (qtd_registers)=>{
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
// R2 - R3 - ... - R(n+1), subtração natural (nunca abaixo de 0)
const subtracao = (qtd_registers)=>{
    if(qtd_registers < 2) throw new Error("Número de registadores menor que 2");
    const c = qtd_registers+2; // contador
    const r = qtd_registers+3; // resultado parcial

    // bloco de 11 instruções: R2 = R2 - R(linha+2)
    const start_code = (linha)=>{
        const j = linha+2;
        const fim = linha*11;
        return [
            `Z(${c})`,
            `Z(${r})`,
            `J(${c}, ${j}, ${fim-4})`,
            `J(${c}, 2, ${fim})`,
            `S(${c})`,
            `J(${c}, ${c}, ${fim-8})`,
            `J(${c}, 2, ${fim})`,
            `S(${c})`,
            `S(${r})`,
            `J(${c}, ${c}, ${fim-4})`,
            `T(${r}, 2)`
        ].join('\n');
    }

    const end_code = ()=>{
        return `T(2, 1)`;
    }

    let final_code = '';
    for(let linha = 1; linha <= qtd_registers-1; linha++) {
        final_code += start_code(linha) + '\n';
    }
    final_code += end_code();

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}

// R2 * R3 * ... * R(n+1)
const multiplicacao = (qtd_registers)=>{
    if(qtd_registers < 2) throw new Error("Número de registadores menor que 2");
    const c = qtd_registers+2; // vezes já somadas
    const d = qtd_registers+3; // contador dentro da soma de R2
    const p = qtd_registers+4; // produto parcial

    // bloco de 11 instruções: R2 = R2 * R(linha+2)
    const start_code = (linha)=>{
        const j = linha+2;
        const fim = linha*11;
        return [
            `Z(${p})`,
            `Z(${c})`,
            `J(${c}, ${j}, ${fim})`,
            `Z(${d})`,
            `J(${d}, 2, ${fim-2})`,
            `S(${p})`,
            `S(${d})`,
            `J(${d}, ${d}, ${fim-6})`,
            `S(${c})`,
            `J(${c}, ${c}, ${fim-8})`,
            `T(${p}, 2)`
        ].join('\n');
    }

    const end_code = ()=>{
        return `T(2, 1)`;
    }

    let final_code = '';
    for(let linha = 1; linha <= qtd_registers-1; linha++) {
        final_code += start_code(linha) + '\n';
    }
    final_code += end_code();

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}

// ((R2 / R3) / R4) / ... / R(n+1), divisão inteira (floor)
const divisao = (qtd_registers)=>{
    if(qtd_registers < 2) throw new Error("Número de registadores menor que 2");
    const t = qtd_registers+2; // conta até ao divisor
    const x = qtd_registers+3; // percorre 0..R2
    const q = qtd_registers+4; // quociente

    // bloco de 13 instruções: R2 = R2 / R(linha+2)
    const start_code = (linha)=>{
        const j = linha+2;
        const fim = linha*13;
        return [
            `Z(${t})`,
            `J(${j}, ${t}, ${fim-11})`,   // divisor == 0: salta para si mesmo (nunca termina)
            `Z(${q})`,
            `Z(${x})`,
            `J(${x}, 2, ${fim})`,
            `S(${x})`,
            `S(${t})`,
            `J(${t}, ${j}, ${fim-3})`,
            `J(${x}, ${x}, ${fim-8})`,
            `S(${q})`,
            `Z(${t})`,
            `J(${x}, ${x}, ${fim-8})`,
            `T(${q}, 2)`
        ].join('\n');
    }

    const end_code = ()=>{
        return `T(2, 1)`;
    }

    let final_code = '';
    for(let linha = 1; linha <= qtd_registers-1; linha++) {
        final_code += start_code(linha) + '\n';
    }
    final_code += end_code();

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}

// R2 ^ R3 (apenas dois operandos; 0^0 = 1)
const potencia = ()=>{
    // R4 = vezes já multiplicadas, R5/R6 = contadores, R7 = produto temporário, R8 = potência
    const final_code = [
        `Z(8)`,
        `S(8)`,
        `Z(4)`,
        `J(4, 3, 18)`,
        `Z(7)`,
        `Z(5)`,
        `J(5, 2, 15)`,
        `Z(6)`,
        `J(6, 8, 13)`,
        `S(7)`,
        `S(6)`,
        `J(6, 6, 9)`,
        `S(5)`,
        `J(5, 5, 7)`,
        `T(7, 8)`,
        `S(4)`,
        `J(4, 4, 4)`,
        `T(8, 1)`
    ].join('\n');

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}


// max(R2, R3, ..., R(n+1))
const maximo = (qtd_registers)=>{
    if(qtd_registers < 2) throw new Error("Número de registadores menor que 2");
    const c = qtd_registers+2; // contador

    // bloco de 6 instruções: R2 = max(R2, R(linha+2))
    const start_code = (linha)=>{
        const j = linha+2;
        const fim = linha*6;
        return [
            `Z(${c})`,
            `J(${c}, 2, ${fim})`,          // c chegou a R2 primeiro (R2 <= Rj): usa Rj
            `J(${c}, ${j}, ${fim+1})`,     // c chegou a Rj primeiro (Rj < R2): mantém R2
            `S(${c})`,
            `J(${c}, ${c}, ${fim-4})`,
            `T(${j}, 2)`
        ].join('\n');
    }

    const end_code = ()=>{
        return `T(2, 1)`;
    }

    let final_code = '';
    for(let linha = 1; linha <= qtd_registers-1; linha++) {
        final_code += start_code(linha) + '\n';
    }
    final_code += end_code();

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}

// min(R2, R3, ..., R(n+1))
const minimo = (qtd_registers)=>{
    if(qtd_registers < 2) throw new Error("Número de registadores menor que 2");
    const c = qtd_registers+2; // contador

    // bloco de 6 instruções: R2 = min(R2, R(linha+2))
    const start_code = (linha)=>{
        const j = linha+2;
        const fim = linha*6;
        return [
            `Z(${c})`,
            `J(${c}, 2, ${fim+1})`,        // c chegou a R2 primeiro (R2 <= Rj): mantém R2
            `J(${c}, ${j}, ${fim})`,       // c chegou a Rj primeiro (Rj < R2): usa Rj
            `S(${c})`,
            `J(${c}, ${c}, ${fim-4})`,
            `T(${j}, 2)`
        ].join('\n');
    }

    const end_code = ()=>{
        return `T(2, 1)`;
    }

    let final_code = '';
    for(let linha = 1; linha <= qtd_registers-1; linha++) {
        final_code += start_code(linha) + '\n';
    }
    final_code += end_code();

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}

// raiz quadrada inteira (floor) de R2
const raiz = ()=>{
    // R3 = x (percorre 0..R2), R4 = raiz, R5 = passos desde r^2, R6 = tamanho do grupo (2r+1)
    const final_code = [
        `Z(3)`,
        `Z(4)`,
        `Z(5)`,
        `Z(6)`,
        `S(6)`,
        `J(3, 2, 16)`,
        `S(3)`,
        `S(5)`,
        `J(5, 6, 11)`,
        `J(3, 3, 6)`,
        `S(4)`,
        `S(6)`,
        `S(6)`,
        `Z(5)`,
        `J(3, 3, 6)`,
        `T(4, 1)`
    ].join('\n');

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}

// factorial de R2 (0! = 1)
const factorial = ()=>{
    // R3 = i, R4/R5 = contadores, R6 = produto temporário, R7 = factorial parcial
    const final_code = [
        `Z(7)`,
        `S(7)`,
        `Z(3)`,
        `J(3, 2, 18)`,
        `S(3)`,
        `Z(6)`,
        `Z(4)`,
        `J(4, 3, 16)`,
        `Z(5)`,
        `J(5, 7, 14)`,
        `S(6)`,
        `S(5)`,
        `J(5, 5, 10)`,
        `S(4)`,
        `J(4, 4, 8)`,
        `T(6, 7)`,
        `J(3, 3, 4)`,
        `T(7, 1)`
    ].join('\n');

    const instructions_array = [];
    instructions_array[0] = null;
    final_code.split('\n').forEach(code=>{
        instructions_array.push(code);
    });

    return instructions_array;
}
