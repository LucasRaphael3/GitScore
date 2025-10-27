// --- Elementos Principais do DOM ---
const searchForm = document.getElementById('search-form');
const usernameInput = document.getElementById('username-input');
const resultsContainer = document.getElementById('results-container');
const loadingIndicator = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');

// --- NOVO: Elemento da caixa de sugestões ---
const suggestionsBox = document.getElementById('suggestions-box');

// Mapeamento de elementos do DOM (com os novos IDs)
const ui = {
    avatar: document.getElementById('user-avatar'),
    name: document.getElementById('user-name'),
    username: document.getElementById('user-username'),
    bio: document.getElementById('user-bio'),
    scoreCircle: document.getElementById('score-circle'),
    finalScore: document.getElementById('final-score'),
    followers: document.getElementById('stat-followers'),
    stars: document.getElementById('stat-stars'),
    commits: document.getElementById('stat-commits'),
    repos: document.getElementById('stat-repos'),
    activeDays: document.getElementById('stat-active-days'),
    tenure: document.getElementById('stat-tenure'),
    sofascoreCard: document.getElementById('sofascore-match-card'),
    playerAvatar: document.getElementById('player-avatar'),
    playerName: document.getElementById('player-name'),
    playerMatch: document.getElementById('player-match')
};


// --- LÓGICA DE BUSCA PRINCIPAL (SUBMIT) ---
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (!username) return;

    // Esconde sugestões ao enviar
    hideSuggestions();

    // Resetar UI
    resultsContainer.classList.add('hidden');
    errorMessage.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');

    try {
        const response = await fetch(`/api/stats/${username}`); 
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao buscar usuário');
        }
        const data = await response.json();
        displayData(data);
    } catch (error) {
        showError(error.message);
    } finally {
        loadingIndicator.classList.add('hidden');
    }
});

let debounceTimer;

// 1. Ouve o que o usuário digita
usernameInput.addEventListener('input', () => {
    const query = usernameInput.value.trim();

    // Limpa o timer anterior
    clearTimeout(debounceTimer);

    if (query.length === 0) {
        hideSuggestions();
        return;
    }

    // Cria um novo timer. Só busca depois de 300ms que o usuário PAROU de digitar
    debounceTimer = setTimeout(() => {
        fetchSuggestions(query);
    }, 300);
});

// 2. Busca as sugestões no nosso novo backend
async function fetchSuggestions(query) {
    try {
        const response = await fetch(`/api/search/${query}`);
        if (!response.ok) return; // Falha silenciosamente

        const suggestions = await response.json();
        displaySuggestions(suggestions);
    } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        hideSuggestions();
    }
}

// 3. Mostra as sugestões na tela
function displaySuggestions(suggestions) {
    // Limpa sugestões antigas
    suggestionsBox.innerHTML = '';

    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }

    suggestions.forEach(user => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        // Guarda o login no 'data-login' para ser pego no clique
        item.dataset.login = user.login;

        item.innerHTML = `
            <img src="${user.avatar_url}" class="suggestion-avatar" alt="avatar">
            <span>${user.login}</span>
        `;
        suggestionsBox.appendChild(item);
    });

    // Mostra a caixa e arredonda o input
    suggestionsBox.classList.remove('hidden');
    usernameInput.classList.add('suggestions-open');
}

// 4. Esconde a caixa de sugestões
function hideSuggestions() {
    suggestionsBox.classList.add('hidden');
    usernameInput.classList.remove('suggestions-open');
}

// 5. Ouve cliques NA CAIXA (usando delegação de evento)
suggestionsBox.addEventListener('click', (e) => {
    // Pega o item de sugestão que foi clicado
    const clickedItem = e.target.closest('.suggestion-item');

    if (clickedItem) {
        // Pega o username que guardamos no 'data-login'
        const username = clickedItem.dataset.login;

        // Coloca o nome no input
        usernameInput.value = username;

        // Esconde a caixa
        hideSuggestions();

        // Foca no input de novo (opcional, bom UX)
        usernameInput.focus();

        // **IMPORTANTE: Submete o formulário automaticamente!**
        searchForm.requestSubmit();
    }
});

// 6. Ouve quando o usuário clica FORA do input
usernameInput.addEventListener('blur', () => {
    // Damos um pequeno delay para permitir que o clique NA SUGESTÃO 
    // seja registrado antes de esconder a caixa.
    setTimeout(() => {
        hideSuggestions();
    }, 200);
});

// --- FIM DA NOVA LÓGICA DE SUGESTÕES ---

function displayData(data) {
    ui.avatar.src = data.avatar_url;
    ui.name.textContent = data.name || data.username;
    ui.username.textContent = `@${data.username}`;
    ui.bio.textContent = data.bio || 'Sem bio pública.';
    
    ui.finalScore.textContent = data.finalScore;
    ui.followers.textContent = data.followers.toLocaleString('pt-BR');
    ui.stars.textContent = data.totalStars.toLocaleString('pt-BR');
    ui.commits.textContent = data.totalCommits.toLocaleString('pt-BR');
    ui.repos.textContent = data.public_repos.toLocaleString('pt-BR');
    ui.activeDays.textContent = data.activeDays.toLocaleString('pt-BR');
    ui.tenure.textContent = data.yearsOnGitHub;   
    ui.scoreCircle.style.backgroundColor = getScoreColor(data.finalScore);
    resultsContainer.classList.remove('hidden');


}

function getScoreColor(score) {
    if (score >= 8.0) return 'var(--score-good)';
    if (score >= 6.0) return 'var(--score-medium)';
    return 'var(--score-bad)';
}