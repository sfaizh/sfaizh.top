import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Divider, Center } from "@chakra-ui/layout";
import { useMediaQuery, Button, Image, Show } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import "../home/home.css";
import Blog_card from "./blog_card";
import Blog_sidebar from "./blog_sidebar";
import useAuth from '../../utils/hooks/useAuth'
import Comment from "./comments/comment";
import Giscus from "@giscus/react";

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

    const [post, setPost] = useState(null);
    const { id } = useParams();

    const { username, isAdmin } = useAuth();

    const getPost = () => {
        // Set loading modifiers
        // props.setLoadingState(true);
        // props.setLoadingState(false);
        // if (isAdmin) {
        axios.get(deployment.production + "/blogposts/" + id)
            .then(r => {
                setPost(r);
                // props.setLoadingState(false);
            })
            .catch(err => console.log(err));
        // } else {
        //     axios.get(deployment.production + "/blogposts/public/" + id)
        //     .then(r => {
        //         setPost(r);
        //         // props.setLoadingState(false);
        //     })
        //     .catch(err => console.log(err));
        // }
    }

    useEffect(() => {
        getPost();
    }, []);

    if (!post) return null;

    return (
        <Flex pt={5} alignContent={"center"} justifyContent={"center"}>
            <Box width={{ base: "100%", md: "100%", lg: "70%" }} pb={20}>
                <Blog_card card={post.data} mode={"view"} />
                <Spacer />
                {/* Comments */}
                <Box className="giscus">
                    <Giscus
                        id="comments"
                        repo="sfaizh/public-profile-frontend"
                        repoId="R_kgDOKe4B7A"
                        category="General"
                        categoryId="DIC_kwDOKe4B7M4CftuX"
                        mapping="title"
                        reactionsEnabled="1"
                        emitMetadata="0"
                        inputPosition="top"
                        theme="dark"
                        loading="lazy"
                    />
                </Box>
            </Box>
            {/* <Box pt={100}>
                <Show breakpoint="(min-width: 750px)">
                    <Blog_sidebar />
                </Show>
            </Box> */}
        </Flex>
    );
}

export default ViewBlog;