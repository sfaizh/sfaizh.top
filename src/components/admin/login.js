import React, { useEffect, useState } from 'react';
import "../admin/admin.css";
import Header from "../common/chakra_header.js";
import Footer from "../common/footer.js";
import deployment from "../../deployment.json";
import axios from "axios";
import { Navigate } from "react-router";
// import {auth, validate, logout, register} from "./auth.js";

import { VStack, HStack, Flex, Box, Heading, Spacer, Text } from "@chakra-ui/layout";
import {
    Image,
    Button,
    Input,
    InputGroup,
    InputRightElement,
    FormControl
} from '@chakra-ui/react'
import { useForm } from "react-hook-form";
import { Link, useNavigate } from 'react-router-dom';
import { UserAuth } from '../../context/AuthContext.js';

const config = {
    withCredentials: true,
    credentials: "include",
    headers: {
        "Accept": "*/*",
        "Content-Type": "application/json"
    }
};

const Login = () => {
    const { signIn } = UserAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const nav = useNavigate();
    const handleLogin = async e => {
        e.preventDefault();
        const user = {
            email: email,
            password: password
        }
        try {
            await signIn(email, password)
            nav('/_cpanel')
        } catch (e) {
            console.log(e.message)
        }
    }
    const onSubmit = (data) => handleLogin();
    const { control, handleSubmit } = useForm();

    const [show, setShow] = React.useState(false)
    const handleClick = () => setShow(!show)

    // if (props.isLoggedIn) {
    //     return <Navigate to="/_cpanel" />;
    // }

    return (
        <VStack p={5}>
            <Header />
            <Box>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <VStack>
                        <Input required placeholder="Username" value={email} onChange={e => setEmail(e.target.value)} />
                        <InputGroup size='md'>
                            <Input
                                pr='4.5rem'
                                type={show ? 'text' : 'password'}
                                placeholder='Password'
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <InputRightElement width='4.5rem'>
                                <Button h='1.75rem' size='sm' onClick={handleClick}>
                                    {show ? 'Hide' : 'Show'}
                                </Button>
                            </InputRightElement>
                        </InputGroup>
                        {/* <Form.Group>
                        <Form.Control type="username" required value={username} onChange={e => setusername(e.target.value)} placeholder="Enter Username"/>
                        <Form.Control type="password" required value={password} onChange={e => setpassword(e.target.value)} placeholder="Enter Current Password"/>
                    </Form.Group> */}
                        <br />
                        {/* <Button as={Link} to="/" variant="primary">Back</Button> */}
                        <Button
                            type="submit"
                            onClick={handleLogin}
                        >Login
                        </Button>
                    </VStack>
                </form>

            </Box>
            <Footer />
        </VStack>
    )
}

export default Login;