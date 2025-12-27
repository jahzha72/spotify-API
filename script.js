const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const CLIENT_ID = process.env.CLIENT_ID || '204993c939884c25b4c980a936562378';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'c9210da5d5cd45649b3b9eccb7b4c80a';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://127.0.0.1:8000/callback';
const PORT = process.env.PORT || 8000;

const STATE_KEY = 'spotify_auth_state';


const generateRandomString = length => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const refreshAccessToken = async (refresh_token) => {
    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token
            }),
            {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        return response.data.access_token;
    } catch (err) {
        console.error('Error refreshing token:', err.response ? err.response.data : err.message);
        return null;
    }
};

app.get('/', (req, res) => {
    const access_token = req.cookies['access_token'];
    if (!access_token) {
        res.redirect('/login');
    } else {
        res.redirect('/search');
    }
});

app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    res.cookie(STATE_KEY, state);

    const scope = 'playlist-modify-public playlist-modify-private';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            state: state
        })
    );
});


app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[STATE_KEY] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
        return;
    }

    res.clearCookie(STATE_KEY);

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            }),
            {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const access_token = response.data.access_token;
        const refresh_token = response.data.refresh_token;

        res.cookie('access_token', access_token);
        res.cookie('refresh_token', refresh_token);

        res.redirect('/search');
    } catch (err) {
        console.error(err.response ? err.response.data : err.message);
        res.send('Error during authentication');
    }
});


app.get('/search', (req, res) => {
    const access_token = req.cookies['access_token'];
    if (!access_token) {
        res.redirect('/login');
    } else {
        res.render('index', { data: null });
    }
});

app.post('/search', async (req, res) => {
    const { query } = req.body;
    let access_token = req.cookies['access_token'];
    const refresh_token = req.cookies['refresh_token'];

    if (!access_token) return res.redirect('/login');

    try {
        const result = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': 'Bearer ' + access_token },
            params: { q: query, type: 'album,artist,track,playlist', limit: 10 }
        });
        res.render('search', { data: result.data });
    } catch (err) {
        if (err.response && err.response.status === 401 && refresh_token) {
            access_token = await refreshAccessToken(refresh_token);
            if (access_token) {
                res.cookie('access_token', access_token);
                try {
                    const retry = await axios.get('https://api.spotify.com/v1/search', {
                        headers: { 'Authorization': 'Bearer ' + access_token },
                        params: { q: query, type: 'album,artist,track,playlist', limit: 10 }
                    });
                    return res.render('search', { data: retry.data });
                } catch (err2) {
                    console.error(err2.response ? err2.response.data : err2.message);
                }
            }
        }
        console.error(err.response ? err.response.data : err.message);
        res.send('Error fetching Spotify data');
    }
});


app.post('/playlist', async (req, res) => {
    const { name } = req.body;
    let access_token = req.cookies['access_token'];
    const refresh_token = req.cookies['refresh_token'];

    if (!access_token) return res.redirect('/login');

    try {
        const userProfile = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': 'Bearer ' + access_token }
        });
        const user_id = userProfile.data.id;

        const result = await axios.post(`https://api.spotify.com/v1/users/${user_id}/playlists`,
            { name: name, public: true },
            { headers: { 'Authorization': 'Bearer ' + access_token } }
        );
        res.send(`Playlist created: <a href="${result.data.external_urls.spotify}" target="_blank">${result.data.name}</a>`);
    } catch (err) {
        if (err.response && err.response.status === 401 && refresh_token) {
            access_token = await refreshAccessToken(refresh_token);
            if (access_token) {
                res.cookie('access_token', access_token);
                try {
                    const userProfile = await axios.get('https://api.spotify.com/v1/me', {
                        headers: { 'Authorization': 'Bearer ' + access_token }
                    });
                    const user_id = userProfile.data.id;
                    const result = await axios.post(`https://api.spotify.com/v1/users/${user_id}/playlists`,
                        { name: name, public: true },
                        { headers: { 'Authorization': 'Bearer ' + access_token } }
                    );
                    return res.send(`Playlist created: <a href="${result.data.external_urls.spotify}" target="_blank">${result.data.name}</a>`);
                } catch (err2) {
                    console.error(err2.response ? err2.response.data : err2.message);
                }
            }
        }
        console.error(err.response ? err.response.data : err.message);
        res.send('Error creating playlist');
    }
});


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
