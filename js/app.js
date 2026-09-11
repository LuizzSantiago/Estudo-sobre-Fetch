const API_URL = "https://pokeapi.co/api/v2/pokemon";
const PAGE_SIZE = 24;
const FIRST_GENERATION_LIMIT = 151;
const FAVORITES_KEY = "pokefinder-favorites";
const state = {
	page: 1,
	query: "",
	showFavorites: false,
	total: 0,
	pokemons: [],
	favorites: loadFavorites(),
	loading: false,
	error: ""
};

const elements = {
	form: document.querySelector("#search-form"),
	input: document.querySelector("#search-input"),
	clear: document.querySelector("#clear-button"),
	favorites: document.querySelector("#favorites-button"),
	favoritesCount: document.querySelector("#favorites-count"),
	status: document.querySelector("#status"),
	resultCount: document.querySelector("#result-count"),
	error: document.querySelector("#error-area"),
	grid: document.querySelector("#pokemon-grid"),
	previous: document.querySelector("#previous-button"),
	next: document.querySelector("#next-button"),
	pageLabel: document.querySelector("#page-label"),
	modal: document.querySelector("#details-modal"),
	modalClose: document.querySelector("#modal-close"),
	details: document.querySelector("#pokemon-details")
};

function loadFavorites() {
	try {
		return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []);
	} catch (error) {
		return new Set();
	}
}

function saveFavorites() {
	localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
}

function getId(url) {
	return url.split("/").filter(Boolean).pop();
}

function render() {
	const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
	elements.status.textContent = state.loading
		? "Consultando a PokéAPI..."
		: state.showFavorites ? "Meus Pokémon favoritos" : state.query ? `Resultados para “${state.query}”` : "Todos os Pokémon";
	elements.resultCount.textContent = state.total ? `${state.total} encontrado(s)` : "";
	elements.favoritesCount.textContent = state.favorites.size;
	elements.favorites.classList.toggle("active", state.showFavorites);
	elements.pageLabel.textContent = `Página ${state.page} de ${totalPages}`;
	elements.previous.disabled = state.page === 1 || state.loading;
	elements.next.disabled = state.page >= totalPages || state.loading;
	elements.error.innerHTML = state.error ? `<div class="error">${state.error}</div>` : "";

	if (state.loading) {
		elements.grid.innerHTML = '<div class="loader">Carregando dados</div>';
		return;
	}

	if (!state.pokemons.length) {
		elements.grid.innerHTML = '<div class="empty">Nenhum Pokémon corresponde à sua busca.</div>';
		return;
	}

	elements.grid.innerHTML = state.pokemons.map((pokemon) => {
		const id = getId(pokemon.url);
		const favorite = state.favorites.has(String(id));
		return `<article class="pokemon-card" data-url="${pokemon.url}" tabindex="0" role="button" aria-label="Ver detalhes de ${pokemon.name}">
			<div class="number">#${String(id).padStart(3, "0")}</div>
			<button class="favorite-button ${favorite ? "selected" : ""}" data-favorite-id="${id}" type="button" aria-label="${favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${favorite ? "★" : "☆"}</button>
			<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png" alt="${pokemon.name}">
			<h2>${pokemon.name}</h2>
		</article>`;
	}).join("");
}

async function fetchPage() {
	state.loading = true;
	state.error = "";
	render();

	try {
		let results;
		let totalResults;
		if (state.query || state.showFavorites) {
			const response = await fetch(`${API_URL}?limit=${FIRST_GENERATION_LIMIT}`);
			if (!response.ok) throw new Error("A API não respondeu corretamente.");
			const data = await response.json();
			results = data.results.filter((pokemon) => {
				const matchesQuery = !state.query || pokemon.name.includes(state.query);
				const matchesFavorite = !state.showFavorites || state.favorites.has(getId(pokemon.url));
				return matchesQuery && matchesFavorite;
			});
			totalResults = results.length;
		} else {
			const offset = (state.page - 1) * PAGE_SIZE;
			const response = await fetch(`${API_URL}?offset=${offset}&limit=${PAGE_SIZE}`);
			if (!response.ok) throw new Error("A API não respondeu corretamente.");
			const data = await response.json();
			totalResults = FIRST_GENERATION_LIMIT;
			results = data.results;
		}

		state.total = totalResults;
		const start = (state.page - 1) * PAGE_SIZE;
		state.pokemons = state.query || state.showFavorites ? results.slice(start, start + PAGE_SIZE) : results;
	} catch (error) {
		state.pokemons = [];
		state.total = 0;
		state.error = "Não foi possível carregar os dados. Verifique sua conexão e tente novamente.";
		console.error(error);
	} finally {
		state.loading = false;
		render();
	}
}

async function openDetails(url) {
	elements.modal.hidden = false;
	elements.details.innerHTML = '<div class="loader">Carregando detalhes</div>';

	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error("Não foi possível carregar os detalhes.");
		const pokemon = await response.json();
		const types = pokemon.types.map((item) => item.type.name).join(" / ");
		const abilities = pokemon.abilities.map((item) => item.ability.name).join(", ");
		elements.details.innerHTML = `<div class="details-art">
			<img src="${pokemon.sprites.other["official-artwork"].front_default || pokemon.sprites.front_default}" alt="${pokemon.name}">
		</div>
		<div class="details-copy">
			<div class="number">#${String(pokemon.id).padStart(3, "0")}</div>
			<button class="modal-favorite favorite-button ${state.favorites.has(String(pokemon.id)) ? "selected" : ""}" data-favorite-id="${pokemon.id}" type="button">${state.favorites.has(String(pokemon.id)) ? "★ Favorito" : "☆ Favoritar"}</button>
			<h2 id="details-title">${pokemon.name}</h2>
			<p class="type-line">${types}</p>
			<dl>
				<div><dt>Altura</dt><dd>${pokemon.height / 10} m</dd></div>
				<div><dt>Peso</dt><dd>${pokemon.weight / 10} kg</dd></div>
				<div><dt>Habilidades</dt><dd>${abilities}</dd></div>
			</dl>
		</div>`;
	} catch (error) {
		elements.details.innerHTML = '<div class="error">Não foi possível carregar os detalhes deste Pokémon.</div>';
		console.error(error);
	}
}

function closeDetails() {
	elements.modal.hidden = true;
}

elements.form.addEventListener("submit", (event) => {
	event.preventDefault();
	state.query = elements.input.value.trim().toLowerCase();
	state.page = 1;
	fetchPage();
});

elements.favorites.addEventListener("click", () => {
	state.showFavorites = !state.showFavorites;
	state.page = 1;
	fetchPage();
});

elements.clear.addEventListener("click", () => {
	elements.input.value = "";
	state.query = "";
	state.page = 1;
	fetchPage();
});

elements.previous.addEventListener("click", () => {
	if (state.page > 1) {
		state.page -= 1;
		fetchPage();
	}
});

elements.next.addEventListener("click", () => {
	const totalPages = Math.ceil(state.total / PAGE_SIZE);
	if (state.page < totalPages) {
		state.page += 1;
		fetchPage();
	}
});

elements.grid.addEventListener("click", (event) => {
	const favoriteButton = event.target.closest("[data-favorite-id]");
	if (favoriteButton) {
		event.stopPropagation();
		toggleFavorite(favoriteButton.dataset.favoriteId);
		return;
	}
	const card = event.target.closest(".pokemon-card");
	if (card) openDetails(card.dataset.url);
});

elements.details.addEventListener("click", (event) => {
	const favoriteButton = event.target.closest("[data-favorite-id]");
	if (!favoriteButton) return;
	toggleFavorite(favoriteButton.dataset.favoriteId);
	const favorite = state.favorites.has(favoriteButton.dataset.favoriteId);
	favoriteButton.classList.toggle("selected", favorite);
	favoriteButton.textContent = favorite ? "★ Favorito" : "☆ Favoritar";
});

function toggleFavorite(id) {
	if (state.favorites.has(String(id))) {
		state.favorites.delete(String(id));
	} else {
		state.favorites.add(String(id));
	}
	saveFavorites();
	render();
	if (state.showFavorites) fetchPage();
}

elements.grid.addEventListener("keydown", (event) => {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		const card = event.target.closest(".pokemon-card");
		if (card) openDetails(card.dataset.url);
	}
});

elements.modalClose.addEventListener("click", closeDetails);
elements.modal.addEventListener("click", (event) => {
	if (event.target === elements.modal) closeDetails();
});
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") closeDetails();
});

fetchPage();
