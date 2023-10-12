import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Divider } from "@chakra-ui/layout";
import { useMediaQuery, Button, Image, Show } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import "../home/home.css";
import Blog_card from "./blog_card";
import Blog_sidebar from "./blog_sidebar";

import {
    Container,
    Tag
} from "@chakra-ui/react";
import { useNavigate, Link, useParams } from 'react-router-dom';
import axios from "axios";
import deployment from "../../deployment.json";

const ViewBlog = props => {
    const [isScreenSmallest] = useMediaQuery("(max-width: 400px");
    const [isScreenLarge] = useMediaQuery("(min-width: 750px");

    const [post, setPost] = useState( null );
    const { id } = useParams();

    const getPost = () => {
        // Set loading modifiers
        // props.setLoadingState(true);
        // props.setLoadingState(false);
        axios.get(deployment.production + "/blogposts/" + id)
            .then(r => {
                setPost(r);
                // props.setLoadingState(false);
            })
            .catch(err => console.log(err));
    }

    useEffect(()  => {
        getPost();
    }, []);

    if (!post) return null;

    return (
        <Flex pt={5}>
            <Box width="100%" pb={20}>
                <Blog_card card={post.data} mode={"view"} />
            </Box>
            <Show breakpoint="(min-width: 750px)">
                <Box>
                    <Blog_sidebar />
                </Box>
            </Show>
        </Flex>
    );
}

export default ViewBlog;