import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    alert("ERRO CRÍTICO: Chaves do Supabase ausentes!");
    throw new Error("Variáveis de ambiente ausentes.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

let configAtual = null;
let listaChapas = [];

// ==========================================
// INICIALIZAÇÃO DA INTERFACE
// ==========================================
window.onload = async () => {
    await carregarConfiguracoes();
    await carregarChapas();
    atualizarTelaPrincipal();
};

async function carregarConfiguracoes() {
    const { data, error } = await supabase.from('config').select('*').eq('id', 1).single();
    if (!error && data) configAtual = data;
}

async function carregarChapas() {
    const { data, error } = await supabase.from('chapas').select('*').order('ordem', { ascending: true });
    if (!error && data) {
        listaChapas = data;
        renderizarChapas();
    }
}

function renderizarChapas() {
    const container = document.getElementById('chapas-container');
    if (!container) return;

    if (listaChapas.length === 0) {
        container.innerHTML = '<p class="text-slate-500 col-span-full text-center py-8 font-semibold">Nenhuma chapa cadastrada para esta eleição ainda.</p>';
        return;
    }

    container.innerHTML = '';
    listaChapas.forEach(chapa => {
        const cardHTML = `
            <label class="cursor-pointer group relative block h-full">
                <input type="radio" name="chapa_id" value="${chapa.id}" class="peer hidden" required>
                <div class="border-2 border-slate-200 bg-white rounded-2xl p-4 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:ring-4 peer-checked:ring-indigo-100 transition-all duration-200 text-center h-full flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg shadow-sm">
                    <div class="w-full h-32 bg-slate-100 rounded-xl flex flex-col items-center justify-center mb-4 text-slate-400 overflow-hidden relative">
                        ${chapa.foto_url
                ? `<img src="${chapa.foto_url}" class="w-full h-full object-cover absolute inset-0">`
                : `<span class="text-2xl mb-1">📷</span><span class="text-xs font-semibold uppercase">Sem foto</span>`
            }
                    </div>
                    <h3 class="text-base md:text-lg font-extrabold text-slate-800 leading-tight">${chapa.nome}</h3>
                </div>
            </label>
        `;
        container.innerHTML += cardHTML;
    });
}

function atualizarTelaPrincipal() {
    const badge = document.getElementById('status-badge');

    document.getElementById('voting-screen').classList.add('hidden');
    document.getElementById('closed-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('receipt-screen').classList.add('hidden');

    if (!configAtual) {
        badge.innerHTML = '⚠️ Erro de Conexão';
        badge.className = 'text-sm font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-full';
        document.getElementById('closed-screen').classList.remove('hidden');
        return;
    }

    if (configAtual.votacao_aberta) {
        badge.innerHTML = '🟢 Votação Aberta';
        badge.className = 'text-sm font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full';
        document.getElementById('voting-screen').classList.remove('hidden');
    } else {
        badge.innerHTML = '🔴 Votação Encerrada';
        badge.className = 'text-sm font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full';
        document.getElementById('closed-screen').classList.remove('hidden');
    }
}

// ==========================================
// FLUXO DE VOTAÇÃO E MODAL
// ==========================================

window.openConfirmationModal = function (event) {
    event.preventDefault();

    if (!configAtual || !configAtual.votacao_aberta) {
        alert('A votação está encerrada no momento!');
        return;
    }

    const chapaSelecionada = document.querySelector('input[name="chapa_id"]:checked');
    if (!chapaSelecionada) {
        alert('Por favor, escolha uma chapa antes de confirmar o voto!');
        return;
    }

    document.getElementById('confirmation-modal').classList.remove('hidden');
    document.getElementById('confirm-input').value = '';

    setTimeout(() => { document.getElementById('confirm-input').focus(); }, 100);
};

window.closeModal = function () {
    document.getElementById('confirmation-modal').classList.add('hidden');
};

window.handleEnter = function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        window.processFinalVote(event);
    }
};

window.processFinalVote = async function (event) {
    const confirmText = document.getElementById('confirm-input').value.trim().toLowerCase();

    if (confirmText !== 'confirma') {
        alert('❌ Por favor, digite a palavra "CONFIRMA" corretamente para prosseguir.');
        document.getElementById('confirm-input').focus();
        return;
    }

    const email = document.getElementById('email').value.toLowerCase().trim();
    const serie = document.getElementById('serie').value;
    const chapa_id = document.querySelector('input[name="chapa_id"]:checked').value;
    const recibo = Math.random().toString(36).substring(2, 8).toUpperCase();

    const btnSubmit = document.getElementById('btn-final-confirm');
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = 'Enviando...';
    btnSubmit.disabled = true;

    const { error } = await supabase.from('votos').insert([{ email, serie, chapa_id, recibo }]);

    btnSubmit.innerHTML = textoOriginal;
    btnSubmit.disabled = false;

    if (error) {
        window.closeModal();
        if (error.code === '23505') {
            alert('⚠️ Atenção: Este e-mail já registrou um voto!');
        } else {
            alert('Erro ao registrar voto: ' + error.message);
        }
        return;
    }

    window.closeModal();
    document.getElementById('voting-screen').classList.add('hidden');
    document.getElementById('receipt-screen').classList.remove('hidden');
    document.getElementById('receipt-code').innerText = recibo;
};

// ==========================================
// FUNÇÕES DE ADMINISTRAÇÃO E TELÃO
// ==========================================

window.resetToHome = function () {
    document.getElementById('vote-form').reset();
    atualizarTelaPrincipal();
};

window.toggleAdmin = async function () {
    const adminScreen = document.getElementById('admin-screen');

    // Verifica se já existe um admin logado no Supabase
    const { data: { session } } = await supabase.auth.getSession();

    if (adminScreen.classList.contains('hidden')) {
        if (!session) {
            // Se não estiver logado, pede as credenciais de forma segura
            const email = prompt('E-mail do Administrador:');
            if (!email) return;
            const password = prompt('Senha do Administrador:');
            if (!password) return;

            // Tenta autenticar no Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                alert('❌ Acesso negado: E-mail ou senha incorretos.');
                return;
            }
        }

        // Se logou com sucesso, abre o painel
        document.getElementById('voting-screen').classList.add('hidden');
        document.getElementById('closed-screen').classList.add('hidden');
        document.getElementById('receipt-screen').classList.add('hidden');
        adminScreen.classList.remove('hidden');
        await window.loadAdminData();
    } else {
        atualizarTelaPrincipal();
    }
};

// Adicionamos também um botão de "Sair (Logout)" se quiser limpar a sessão
window.adminLogout = async function () {
    await supabase.auth.signOut();
    alert('Sessão encerrada com segurança.');
    location.reload();
};

window.toggleElectionStatus = async function () {
    if (!configAtual) return;
    const novoStatus = !configAtual.votacao_aberta;
    const { error } = await supabase.from('config').update({ votacao_aberta: novoStatus }).eq('id', 1);

    if (!error) {
        configAtual.votacao_aberta = novoStatus;
        await window.loadAdminData();
    } else {
        alert('Erro ao mudar status: ' + error.message);
    }
};

window.loadAdminData = async function () {
    const btnToggle = document.getElementById('btn-toggle-election');
    if (configAtual && configAtual.votacao_aberta) {
        btnToggle.innerHTML = '⏸️ Encerrar Votação';
        btnToggle.className = 'px-5 py-2.5 rounded-lg font-bold text-white shadow-sm bg-red-500 hover:bg-red-600 transition-colors';
    } else {
        btnToggle.innerHTML = '▶️ Iniciar Votação';
        btnToggle.className = 'px-5 py-2.5 rounded-lg font-bold text-white shadow-sm bg-green-500 hover:bg-green-600 transition-colors';
    }

    const { data: votos, error } = await supabase.from('votos').select('*, chapas(nome)');
    if (error) return;

    if (votos) {
        const resultados = {};
        votos.forEach(v => {
            const nomeChapa = v.chapas ? v.chapas.nome : 'Desconhecida';
            resultados[nomeChapa] = (resultados[nomeChapa] || 0) + 1;
        });

        const sortedResults = Object.entries(resultados).sort((a, b) => b[1] - a[1]);
        window.dadosPodio = sortedResults;

        let podiumHTML = sortedResults.map((item, index) => {
            let badgeStyle = index === 0 ? "bg-yellow-100 text-yellow-800 border border-yellow-300" :
                index === 1 ? "bg-slate-200 text-slate-700" :
                    index === 2 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-600";
            return `
            <div class="flex justify-between items-center py-3 border-b border-slate-200">
                <span class="font-bold text-lg">${index + 1}º - ${item[0]}</span>
                <span class="${badgeStyle} px-3 py-1 rounded-full text-sm font-bold">${item[1]} votos</span>
            </div>`;
        }).join('');

        document.getElementById('podium-results').innerHTML = podiumHTML || '<p class="text-slate-500 italic">Nenhum voto registrado.</p>';
        document.getElementById('total-votes').innerText = votos.length;

        document.getElementById('voter-list').innerHTML = votos.map(v =>
            `<tr class="hover:bg-slate-50">
                <td class="py-3 px-5 font-medium whitespace-nowrap">${v.serie}</td>
                <td class="py-3 px-5 text-slate-500">${v.email}</td>
                <td class="py-3 px-5 font-mono text-indigo-600 text-sm">${v.recibo}</td>
            </tr>`
        ).join('') || '<tr><td colspan="3" class="text-center py-4 text-slate-500">Nenhum eleitor registrado.</td></tr>';
    }
};

window.clearData = async function () {
    if (confirm('🚨 ZERAR URNA 🚨\nTem certeza absoluta? Todos os votos serão apagados permanentemente!')) {
        const { error } = await supabase.from('votos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (!error) await window.loadAdminData();
    }
};

window.launchKahootPodium = function () {
    if (configAtual && configAtual.votacao_aberta) {
        alert('Encerre a votação primeiro para transmitir o resultado!');
        return;
    }

    const sortedResults = window.dadosPodio || [];
    if (sortedResults.length === 0) return alert('Sem votos suficientes para formar o pódio.');

    const getChapaName = (idx) => sortedResults[idx] ? sortedResults[idx][0] : '---';
    const getChapaVotes = (idx) => sortedResults[idx] ? `${sortedResults[idx][1]} votos` : '';

    document.getElementById('podium-1-name').innerText = getChapaName(0);
    document.getElementById('podium-1-votes').innerText = getChapaVotes(0);
    document.getElementById('winner-name-pop').innerText = getChapaName(0);
    document.getElementById('podium-2-name').innerText = getChapaName(1);
    document.getElementById('podium-2-votes').innerText = getChapaVotes(1);
    document.getElementById('podium-3-name').innerText = getChapaName(2);
    document.getElementById('podium-3-votes').innerText = getChapaVotes(2);

    document.getElementById('main-container').classList.add('hidden');

    const kahootScreen = document.getElementById('kahoot-screen');
    const animatedElements = kahootScreen.querySelectorAll('.reveal-1, .reveal-2, .reveal-3, .confetti-pop');
    animatedElements.forEach(el => el.style.animation = 'none');
    kahootScreen.classList.remove('hidden');

    setTimeout(() => { animatedElements.forEach(el => el.style.animation = ''); }, 50);
};

window.closeKahootPodium = function () {
    document.getElementById('kahoot-screen').classList.add('hidden');
    document.getElementById('main-container').classList.remove('hidden');
};