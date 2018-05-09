/**
 * Crafted in Erebor by thorin on 2018-04-25
 */
import axios from 'axios';
import { push } from 'react-router-redux';

import { AS_AUTH_RESET } from '../actions/types';

let reduxStore;

const tokenSelector = state => state.auth.token;

export const injectStore = (store) => {
    reduxStore = store;
    reduxStore.subscribe(() => {
        const token = tokenSelector(reduxStore.getState());
        axios.defaults.headers.common.Authorization = `Bearer ${ token }`;
    });
};

const api = axios.create({
    baseURL: process.env.ADMIN_BASE_URL || 'https://oauth2-as-server.herokuapp.com/admin'
});

api.interceptors.response.use((response) => {
    // Do something with response data
    return response;
}, (error) => {
    // Do something with response error
    if (error.response.data.message === 'Bad token' &&
        error.response.data.statusCode === 401) {
        reduxStore.dispatch({ type: AS_AUTH_RESET });
        reduxStore.dispatch(push('/'));
    }
    return Promise.reject(error);
});

export default api;
