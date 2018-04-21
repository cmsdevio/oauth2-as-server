/**
 * Created by thorin on 2017-06-10.
 */
import React from 'react';
import { Navbar } from 'react-bootstrap';

const Header = () => (
    <Navbar>
        <Navbar.Header>
            <Navbar.Brand>
                <a href="#home">OAuth2 Authorization Server</a>
            </Navbar.Brand>
        </Navbar.Header>
    </Navbar>
);

export default Header;
