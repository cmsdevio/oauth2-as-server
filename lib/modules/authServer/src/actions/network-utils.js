import {AS_AUTH_RESET} from "./types";
import store from "../main";
import axios from "axios/index";

/**
 * Crafted in Erebor by thorin on 2018-04-25
 */
const select = state => state.auth.token;

const handleStoreChanges = () => {
    const token = select(store.getState());
    axios.defaults.headers.common.Authorization = `Bearer ${ token }`;
};
store.subscribe(handleStoreChanges);
axios.interceptors.response.use((response) => {
    // Do something with response data
    return response;
}, (error) => {
    // Do something with response error
    if (error.response.data.message === 'Bad token' &&
        error.response.data.statusCode === 401) {
        store.dispatch({ type: AS_AUTH_RESET });
    }
    return error;
});

module.exports.api = axios.create({
    baseURL: process.env.ADMIN_BASE_URL || 'https://localhost:8443/admin'
});