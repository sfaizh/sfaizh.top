import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Divider } from "@chakra-ui/layout";
import { useMediaQuery, Button, Image, Show, VisuallyHidden } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import posts from "../../assets/data/blogs.json";
import "../home/home.css";
import Blog_card from "./blog_card";
import Blog_sidebar from "./blog_sidebar";

import {
    Container,
    Tag
} from "@chakra-ui/react";
import axios from "axios";
import deployment from "../../deployment.json";

const Blog_panel = props => {
    const [isScreenSmallest] = useMediaQuery("(max-width: 400px");
    const [isScreenLarge] = useMediaQuery("(min-width: 750px");

    const [posts, setPosts] = useState(null);

    const getPosts = () => {
        // Set loading modifiers
        // props.setLoadingState(true);
        axios.get(deployment.production + "/blogposts")
            .then(r => {
                setPosts(r);
                // props.setLoadingState(false);
            })
            .catch(err => console.log(err));
    }

    useEffect(() => {
        getPosts();
    }, []);

    if (!posts) return null;

    return (
        <Flex pt={5} alignContent={"center"} justifyContent={"center"}>
            <VisuallyHidden>
                <Heading fontWeight='700' as='h1' mb={0}>Posts</Heading>
            </VisuallyHidden>
            <Box width={{ base: "100%", md: "100%", lg: "70%" }} pb={20}>
                {
                    posts.data.results.map(function (data, i) {
                        // Quick private function here - change when possible in backend
                        if (!data.isPrivate)
                            return <Blog_card key={i} card={data} mode={"all"} />
                    })
                }
            </Box>
        </Flex>
    );
}

export default Blog_panel;