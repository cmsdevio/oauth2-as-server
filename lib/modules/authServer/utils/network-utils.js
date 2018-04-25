/**
 * Crafted in Erebor by thorin on 2018-04-25
 */
import axios from 'axios';

//TODO: figure out export/import of the store
import store from '../src/main';

const select = state => state.auth.token;

const handleStoreChanges = () => {
    const token = select(store.getState());
    axios.defaults.headers.common.Authorization = token;
};

store.subscribe(handleStoreChanges);

// axios.defaults.headers.common.Authorization = `Bearer ${ window.token }`;

module.exports.api = axios.create({
    baseURL: process.env.ADMIN_BASE_URL || 'https://localhost:8443/admin'
});
