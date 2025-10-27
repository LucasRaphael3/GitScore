require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const path = require('path');

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

const app = express();
const ratingsPath = path.join(__dirname, 'player_ratings.json');
const playerRatings = JSON.parse(fs.readFileSync('player_ratings.json', 'utf-8'));

app.use(cors());

// A instância do Axios para a API REST v3
const githubApi = axios.create({
    baseURL: 'https://api.github.com/',
    headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`
    }
});

// Query do GraphQL para buscar o calendário de contribuições
const graphqlQuery = `
query($username: String!) {
  user(login: $username) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}
`;

function getMatchingPlayer(score) {
    if (!score) return null;
    
    // Arredonda a nota para 1 casa decimal, ex: "8.1"
    const scoreKey = parseFloat(score).toFixed(1); 

    // Busca no nosso JSON
    const matchingPlayers = playerRatings[scoreKey];
    
    if (matchingPlayers && matchingPlayers.length > 0) {
        // Se achou, retorna um jogador aleatório da lista
        return matchingPlayers[Math.floor(Math.random() * matchingPlayers.length)];
    }
    
    return null; // Não achou ninguém com essa nota
}

// --- NOVO: Objeto de Easter Eggs ---
// Imagens de perfil (URLs estáveis da Wikimedia)
const messiAvatar = "https://upload.wikimedia.org/wikipedia/commons/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg";
const ronaldoAvatar = "https://upload.wikimedia.org/wikipedia/commons/8/8c/Cristiano_Ronaldo_2018.jpg";

const easterEggs = {
    // Normalizamos tudo para minúsculas
    'messi': {
        username: 'messi',
        avatar_url: messiAvatar,
        name: 'Lionel Messi',
        bio: 'O G.O.A.T. 🐐 | 8x Bola de Ouro',
        followers: 99999999,
        public_repos: 999,
        totalStars: 99999999,
        totalCommits: 99999999,
        activeDays: 365,
        yearsOnGitHub: '20.0', // Anos de carreira
        finalScore: '10.0',
        sofascoreMatch: getMatchingPlayer('10.0')
    },
    'cristiano ronaldo': {
        username: 'cristiano',
        avatar_url: ronaldoAvatar,
        name: 'Cristiano Ronaldo',
        bio: 'O G.O.A.T. 🤖 | Siuuuu!',
        followers: 99999999,
        public_repos: 999,
        totalStars: 99999999,
        totalCommits: 99999999,
        activeDays: 365,
        yearsOnGitHub: '22.0', // Anos de carreira
        finalScore: '10.0',
        sofascoreMatch: getMatchingPlayer('10.0')
    },
    // Bônus: adicionar apelidos comuns
    'cr7': {
        username: 'cr7',
        avatar_url: ronaldoAvatar,
        name: 'Cristiano Ronaldo',
        bio: 'O G.O.A.T. 🤖 | Siuuuu!',
        followers: 99999999,
        public_repos: 999,
        totalStars: 99999999,
        totalCommits: 99999999,
        activeDays: 365,
        yearsOnGitHub: '22.0',
        finalScore: '10.0',
        sofascoreMatch: getMatchingPlayer('10.0')
    }
};

// Nosso endpoint principal
app.get('/api/stats/:username', async (req, res) => {
    // Normaliza o input para minúsculas e remove espaços extras
    const username = req.params.username.toLowerCase().trim();

    if (easterEggs[username]) {
        console.log(`EASTER EGG ACIONADO: ${username}`);
        // Retorna o perfil fake imediatamente e para a execução
        return res.json(easterEggs[username]);
    }
    // --- FIM DA VERIFICAÇÃO ---
    
    // Se não for um Easter Egg, o código continua normalmente
    try {
        // --- CHAMADA 1: Dados do Usuário (REST) ---
        const userResponse = await githubApi.get(`/users/${username}`);
        const { followers, public_repos, created_at } = userResponse.data;

        // ... (O RESTANTE DO SEU CÓDIGO PERMANECE IDÊNTICO) ...
        // --- CHAMADA 2: Repositórios (para Estrelas) (REST) ---
        let allRepos = [];
        let page = 1;
        let reposResponse;
        do {
            reposResponse = await githubApi.get(`/users/${username}/repos?per_page=100&page=${page}`);
            allRepos = allRepos.concat(reposResponse.data);
            page++;
        } while (reposResponse.data.length === 100);

        const totalStars = allRepos.reduce((acc, repo) => acc + repo.stargazers_count, 0);

        // --- CHAMADA 3: Total de Commits (REST Search) ---
        const commitResponse = await githubApi.get(`/search/commits?q=author:${username}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        const totalCommits = commitResponse.data.total_count;

        // --- CHAMADA 4: Dados de Contribuição (GraphQL) ---
        const graphqlResponse = await githubApi.post('graphql', {
            query: graphqlQuery,
            variables: { username }
        });

        const calendar = graphqlResponse.data.data.user.contributionsCollection.contributionCalendar;
        
        let activeDays = 0;
        calendar.weeks.forEach(week => {
            week.contributionDays.forEach(day => {
                if (day.contributionCount > 0) {
                    activeDays++;
                }
            });
        });
        
        // --- O NOVO ALGORITMO "GITSCORE" v2 ---
        const createdDate = new Date(created_at);
        const today = new Date();
        const yearsOnGitHub = (today - createdDate) / (1000 * 60 * 60 * 24 * 365.25);
        const scorePopularity = Math.min(10, (Math.log10(followers + 1) / 5) * 10);
        const scoreImpact = Math.min(10, (Math.log10(totalStars + 1) / 6) * 10);
        const scoreActivity = Math.min(10, (Math.log10(public_repos + 1) / 3) * 10);
        const scoreTenure = Math.min(10, yearsOnGitHub);
        const scoreVolume = Math.min(10, (Math.log10(totalCommits + 1) / 5) * 10);
        const scoreConsistency = Math.min(10, (activeDays / 365) * 10);

        const finalScore = (
            (scorePopularity * 0.20) +
            (scoreImpact * 0.20) +
            (scoreVolume * 0.20) +
            (scoreActivity * 0.10) +
            (scoreConsistency * 0.15) +
            (scoreTenure * 0.15)
        ).toFixed(1);

        const sofascoreMatch = getMatchingPlayer(finalScore);

        res.json({
            username: userResponse.data.login,
            avatar_url: userResponse.data.avatar_url,
            name: userResponse.data.name,
            bio: userResponse.data.bio,
            followers,
            public_repos,
            totalStars,
            totalCommits,
            activeDays,
            yearsOnGitHub: yearsOnGitHub.toFixed(1),
            finalScore: finalScore,
            sofascoreMatch: sofascoreMatch
        });

    } catch (error) {
        if (error.response && error.response.status === 404) {
            res.status(404).json({ message: 'Usuário não encontrado' });
        } else {
            console.error('Erro detalhado:', error.response ? error.response.data : error.message);
            res.status(500).json({ message: 'Erro ao buscar dados do GitHub' });
        } 
    }
});

app.get('/api/search/:query', async (req, res) => {
    const query = req.params.query;

    if (!query) {
        return res.json([]);
    }

    try {
        // Usamos a API de Search do GitHub
        // q={query}+in:login -> busca o 'query' no nome de usuário
        // per_page=5 -> Traz no máximo 5 resultados
        const response = await githubApi.get(`/search/users?q=${query}+in:login&per_page=5`);
        
        // A API de Search retorna um objeto { items: [...] }
        const users = response.data.items;

        // Simplificamos os dados antes de enviar ao frontend
        const suggestions = users.map(user => ({
            login: user.login,
            avatar_url: user.avatar_url
        }));
        
        res.json(suggestions);

    } catch (error) {
        console.error('Erro na busca por sugestões:', error.message);
        res.status(500).json({ message: 'Erro ao buscar sugestões' });
    }
});

app.get('/api/image-proxy', async (req, res) => {
    // Decodifica a URL que o frontend nos enviou
    const imageUrl = decodeURIComponent(req.query.url);

    if (!imageUrl) {
        return res.status(400).send('URL da imagem não fornecida');
    }

    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream',
            
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            httpsAgent: httpsAgent
        });

        res.setHeader('Content-Type', response.headers['content-type']);
        response.data.pipe(res);

    } catch (error) {
        console.error('Erro no proxy de imagem:', error.message, 'URL:', imageUrl);
        res.status(500).send('Falha ao buscar imagem');
    }
});

module.exports = app;