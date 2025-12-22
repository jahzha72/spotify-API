/**
 * Requirement #14: Code Organization
 * Function: getAccessToken
 * Requirement #4: OAuth 2.0 Authentication
 */
async function getAccessToken() {
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(CONFIG.CLIENT_ID + ':' + CONFIG.CLIENT_SECRET)
            },
            body: 'grant_type=client_credentials'
        });
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Auth Error:", error);
        throw new Error("Authentication failed.");
    }
}

/**
 * Requirement #12: Comments in Code
 * Function: fetchSpotifyData
 * API Call explanation: Fetches 12 items of tracks, albums, and playlists.
 */
async function fetchSpotifyData(query) {
    const token = await getAccessToken();
    // Requirement #3: Parameters (q, type, limit)
    // Inayos ang URL: nilagyan ng $ bago ang {
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,album,playlist&limit=12`;

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("API request failed.");
    return await response.json();
}

/**
 * Function: handleSearch
 * Requirement #9: Input Validation (Empty fields, Auto-trim, Disable button)
 */
async function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const loader = document.getElementById('loader');
    const errorDiv = document.getElementById('errorContainer');
    const searchBtn = document.getElementById('searchBtn');

    const query = searchInput.value.trim(); // Auto-trim whitespace
    if (!query) return alert("Please enter a search term."); // Check empty

    // Reset UI & Loading State
    resultsContainer.innerHTML = '';
    errorDiv.classList.add('hidden');
    loader.classList.remove('hidden'); 
    searchBtn.disabled = true; // Disable while loading

    try {
        const data = await fetchSpotifyData(query);
        renderResults(data);
    } catch (error) {
        // Requirement #8: Error Handling (Failed API call)
        console.error("Search Error:", error);
        errorDiv.textContent = "Error: Could not connect to Spotify. Check Client ID/Secret.";
        errorDiv.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
        searchBtn.disabled = false;
    }
}

/**
 * Function: renderResults
 * Requirement #12: DOM manipulation comments
 * Inayos para maging "Super Defensive" laban sa null images.
 */
function renderResults(data) {
    const container = document.getElementById('resultsContainer');
    
    // Safety check para sa data structure (Requirement #8)
    const tracks = data?.tracks?.items || [];
    const albums = data?.albums?.items || [];
    const playlists = data?.playlists?.items || [];
    const items = [...tracks, ...albums, ...playlists];

    // Requirement #8: No results found handling
    if (items.length === 0) {
        container.innerHTML = "<p class='error-msg'>No results found for your search.</p>";
        return;
    }

    items.forEach(item => {
        // LAKTAWAN KUNG NULL ANG ITEM PARA HINDI MAG-CRASH (Ito ang fix sa error mo!)
        if (!item) return;

        let imgUrl = 'https://via.placeholder.com/150'; 

        // Mas matibay na pag-check sa images
        if (item.images && Array.isArray(item.images) && item.images.length > 0) {
            imgUrl = item.images[0].url;
        } else if (item.album && item.album.images && Array.isArray(item.album.images) && item.album.images.length > 0) {
            imgUrl = item.album.images[0].url;
        }
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${imgUrl}" alt="${item.name || 'No Name'}" onerror="this.src='https://via.placeholder.com/150'">
            <div class="card-info">
                <h3>${item.name || 'Unknown'}</h3>
                <p>${item.type ? item.type.toUpperCase() : 'UNKNOWN'}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

// Event Listener para sa Search Button
document.getElementById('searchBtn').addEventListener('click', handleSearch);