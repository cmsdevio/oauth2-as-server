/**
 * Crafted in Erebor by thorin on 2018-04-02
 */
import { push } from 'react-router-redux';

import api from '../common/api';
import hash from '../common/hash';
import {
    GET_USERS,
    GET_USERS_SUCCESS,
    GET_USERS_FAIL,
    USER_CREATE,
    USER_CREATE_SUCCESS,
    USER_CREATE_FAIL
} from './types';

export const getUsers = () => async (dispatch) => {
    dispatch({ type: GET_USERS });
    try {
        const response = await api.get('/users');
        return dispatch({
            type: GET_USERS_SUCCESS,
            payload: { listUsers: response.data.listUsers }
        });
    } catch (error) {
        console.error(`Error fetching users: ${ error }.`);
        return dispatch({ type: GET_USERS_FAIL });
    }
};

export const addUser = userData => async (dispatch) => {
    dispatch({ type: USER_CREATE });
    try {
        await api.post('/addUser', { ...userData, password: hash(userData.password) });
        dispatch({ type: USER_CREATE_SUCCESS });
        return dispatch(push('/users'));
    } catch (error) {
        console.error(`Error creating user: ${ error }.`);
        return dispatch({ type: USER_CREATE_FAIL });
    }
};
