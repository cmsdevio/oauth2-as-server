/**
 * Crafted in Erebor by thorin on 2018-04-02
 */
import axios from 'axios';

import {
    GET_CLIENTS,
    GET_CLIENTS_FAIL
} from './types';

const baseUrl = process.env.ADMIN_BASE_URL || 'https://localhost:8443/admin';

export const getClients = () => async (dispatch, getState) => {
    const { token } = getState().auth;
    dispatch({ type: GET_CLIENTS });
    try {
        const response = await axios.get(
            `${ baseUrl }/clients`,
            {
                headers: {
                    Authorization: `Bearer ${ token }`
                }
            }
        );
        console.log(response);
    } catch (error) {
        console.error(`Error fetching clients: ${ error }.`);
        return dispatch({ type: GET_CLIENTS_FAIL });
    }
};
