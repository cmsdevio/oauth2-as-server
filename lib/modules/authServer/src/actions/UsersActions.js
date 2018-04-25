/**
 * Crafted in Erebor by thorin on 2018-04-02
 */
import axios from 'axios';
import { push } from 'react-router-redux';
import bcrypt from 'react-native-bcrypt';

import {
    GET_USERS,
    GET_USERS_SUCCESS,
    GET_USERS_FAIL,
    USER_CREATE,
    USER_CREATE_SUCCESS,
    USER_CREATE_FAIL
} from './types';

const baseUrl = process.env.ADMIN_BASE_URL || 'https://localhost:8443/admin';

export const getUsers = () => async (dispatch, getState) => {
    const { token } = getState().auth;
    dispatch({ type: GET_USERS });
    try {
        const response = await axios.get(
            `${ baseUrl }/users`,
            {
                headers: {
                    Authorization: `Bearer ${ token }`
                }
            }
        );
        return dispatch({
            type: GET_USERS_SUCCESS,
            payload: { listUsers: response.data.listUsers }
        });
    } catch (error) {
        console.error(`Error fetching users: ${ error }.`);
        return dispatch({ type: GET_USERS_FAIL });
    }
};

export const addUser = userData => async (dispatch, getState) => {
    const { token } = getState().auth;
    dispatch({ type: USER_CREATE });

    // Hash password for added safety
    // Password MUST be hashed server-side
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(userData.password, salt);

    try {
        await axios.post(
            `${ baseUrl }/addUser`,
            { ...userData, password: hash },
            {
                headers: {
                    Authorization: `Bearer ${ token }`
                }
            }
        );
        dispatch({ type: USER_CREATE_SUCCESS });
        return dispatch(push('/users'));
    } catch (error) {
        console.error(`Error creating user: ${ error }.`);
        return dispatch({ type: USER_CREATE_FAIL });
    }
};
