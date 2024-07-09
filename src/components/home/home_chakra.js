import "../home/home.css";
import Banner from "./banner_chakra.js";
import Categories from "./collection.js";
import Footer from "../common/footer.js";
import Header from "../common/chakra_header.js";

import { useMediaQuery, Button, Image } from "@chakra-ui/react";

import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text, Center } from "@chakra-ui/layout";
import ChakraCarousel from "./carousel.js"
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import "../home/home.css";
import axios from "axios";
import deployment from "../../deployment.json";
import { useNavigate, Link, useParams } from 'react-router-dom';
import readingTime from "reading-time";

import {
    Container,
    Tag
} from "@chakra-ui/react";

const Home = () => {
    const [isLargerScreen] = useMediaQuery("(min-width: 600px");
    const [posts, setPosts] = useState(null);

    const getPosts = () => {
        // Set loading modifiers
        // props.setLoadingState(true);
        axios.get(deployment.production + "/blogposts?private=false")
            .then(r => {
                setPosts(r.data.results);
                // props.setLoadingState(false);
            })
            .catch(err => console.log(err));
    }

    useEffect(() => {
        getPosts();
    }, []);

    if (!posts) return null;

    return (
        <VStack p={5}>
            <Header />
            <Container
                py={8}
                px={0}
                maxW={{
                    base: "100%",
                    sm: "35rem",
                    md: "43.75rem",
                    lg: "57.5rem",
                    xl: "75rem",
                    xxl: "87.5rem"
                }}
            >
                <Box align="center">
                    <Text fontSize="4xl" fontWeight="semibold">Recent Posts</Text>
                </Box>
                <ChakraCarousel gap={32}>
                    {posts.slice(0, 8).map((post, index) => (
                        <Flex
                            key={index}
                            boxShadow="rgba(0, 0, 0, 0.16) 0px 3px 6px, rgba(0, 0, 0, 0.23) 0px 3px 6px"
                            flexDirection="column"
                            overflow="hidden"
                            // bg="#465a63"
                            rounded={5}
                            flex={1}
                            p={10}
                            color={'white'}
                            alignItems='end'
                            bgImage={`linear-gradient(rgba(0, 0, 0, 0.527),rgba(0, 0, 0, 0.5)), url('${post.images.main}')`}
                            bgSize='100%'
                        >
                            <Link to={"/" + post.slug}>
                                <VStack h='100'>
                                    <Heading
                                        fontSize={{ base: "xl", md: "2xl" }}
                                        textAlign="left"
                                        w="full"
                                        mb={2}
                                    >
                                        {post.title}
                                    </Heading>
                                    <HStack spacing={2} w='100%' h='100' justifyContent='end' alignItems='end'>
                                        <Tag size="md" variant="outline">
                                            {post.author}
                                        </Tag>
                                        <Tag fontSize="sm">{readingTime(post.description).text}</Tag>
                                    </HStack>
                                </VStack>
                            </Link>
                        </Flex>
                    ))}
                </ChakraCarousel>
                <Banner />
            </Container>
            <Footer />
        </VStack>
    )
}

export default Home;
