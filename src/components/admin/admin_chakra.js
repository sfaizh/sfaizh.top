import React, { useEffect, useState, Component } from 'react';
import "../admin/admin.css";
import Header from "../common/chakra_header.js";
import Footer from "../common/footer.js";

import { VStack, HStack, Flex, Box, Heading, Spacer, Text } from "@chakra-ui/layout";
import {
    Image,
    Button,
    Divider,
    Table,
    Thead,
    Tbody,
    Tfoot,
    Tr,
    Th,
    Td,
    TableCaption,
    TableContainer,
    Checkbox,
    CheckboxGroup
} from '@chakra-ui/react'
// import { UserAuth } from '../../context/AuthContext';
import useAuth from '../../utils/hooks/useAuth'
import { useNavigate, Link } from 'react-router-dom';
import axios from "axios";
import deployment from "../../deployment.json";

import { useDispatch } from 'react-redux'
// import { logOut } from '../../features/auth/authSlice.js'
import { useSendLogoutMutation } from '../../features/auth/authApiSlice'

const Admin = props => {
    const { username, isAdmin } = useAuth();
    const [posts, setPosts] = useState(null);
    const nav = useNavigate();

    const dispatch = useDispatch()
    const [logout, { isLoading }] = useSendLogoutMutation()

    const getPosts = () => {
        // Set loading modifiers
        // props.setLoadingState(true);
        // props.setLoadingState(false);
        axios.get(deployment.production + "/blogposts")
            .then(r => {
                // console.log(r)
                setPosts(r);
                // props.setLoadingState(false);
            })
            .catch(err => console.log(err));
    }

    useEffect(() => {
        getPosts();
    }, []);

    if (!posts) return null;

    const handleLogout = async e => {
        e.preventDefault();

        try {
            // use reducer
            await logout().then(
                localStorage.setItem("persist", false),
                nav('/')
            )
            // await axios.post(deployment.production + "/logout").then(
            //     nav("/")
            // )
        } catch (e) {
            console.log(e.message);
        }
    }

    return (
        <VStack p={5}>
            {console.log(posts)}
            <Header />
            <Box align="center" pb={10}>
                <Text pb={3} fontSize="3xl">Editing Blogs as {username}</Text>
                <Button onClick={handleLogout}>Logout</Button>
            </Box>
            <Divider />
            <Box width="80%" pt={3}>
                {/* List out blogs here */}
                {/* Modify options - edit, delete, view */}
                <TableContainer>
                    <Table variant='simple'>
                        <Thead>
                            <Tr>
                                <Th></Th>
                                <Th>Title</Th>
                                <Th>Date</Th>
                                <Th>Visibility</Th>
                                <Th>Author</Th>
                                <Th>Tags</Th>
                            </Tr>
                        </Thead>

                        <Tbody>
                            {posts.data.results.map(function (data, i) {
                                return (
                                    <Tr key={i}>
                                        <Td><Checkbox isDisabled></Checkbox></Td>
                                        <Td><Link to={"/edit/" + data._id}>{data.title}</Link></Td>
                                        <Td>{data.date}</Td>
                                        <Td>{data.isPrivate ? "Private" : "Public"}</Td>
                                        <Td>{data.author}</Td>
                                        <Td>{data.tags}</Td>
                                    </Tr>
                                    // <Blog_card key={i} card={data} />
                                )
                            })}
                        </Tbody>
                        <Tfoot>
                            <Tr>
                                <Th><Button isDisabled>Remove Selected</Button></Th>
                            </Tr>
                        </Tfoot>
                    </Table>
                </TableContainer>
                <Box align="center" pt={20} pb={10}>
                    <HStack>
                        <Button onClick={e => { e.preventDefault(); nav("/blog") }}>View Blogs</Button>
                        <Button onClick={e => { e.preventDefault(); nav("/new") }}>Create New Blog</Button>
                    </HStack>
                </Box>
            </Box>
            <Footer />
        </VStack>
    );
}

export default Admin;