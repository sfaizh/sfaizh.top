import "../home/home.css";
import Banner from "./banner_chakra.js";
import Categories from "./collection.js";
import Footer from "../common/footer.js";
import Header from "../common/chakra_header.js";

import { useMediaQuery, Button, Image } from "@chakra-ui/react";

import { VStack, HStack, Stack, Flex, Heading, Spacer, Box, Text } from "@chakra-ui/layout";
import ChakraCarousel from "./carousel.js"
import React, { useState, useEffect } from "react";
import { capsFirst } from "../../utils";
import "../home/home.css";
import axios from "axios";
import deployment from "../../deployment.json";
import { useNavigate, Link, useParams } from 'react-router-dom';

import {
    Container,
    Tag
} from "@chakra-ui/react";

const Home = () => {
    const [isLargerScreen] = useMediaQuery("(min-width: 600px");
    const [posts, setPosts] = useState( null );

    const getPosts = () => {
        // Set loading modifiers
        // props.setLoadingState(true);
        // props.setLoadingState(false);
        axios.get(deployment.production + "/blogposts")
            .then(r => {
                setPosts(r.data.results);
                // props.setLoadingState(false);
            })
            .catch(err => console.log(err));
    }

    useEffect(()  => {
        getPosts();
    }, []);

    if (!posts) return null;

    return (
        <VStack p={5}>
            <Header/>
            <Banner/>
            <Categories/>
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
                }}>
            <ChakraCarousel gap={32}>
                    {posts.slice(0, 8).map((post, index) => (
                        <Flex
                            key={index}
                            boxShadow="rgba(0, 0, 0, 0.16) 0px 3px 6px, rgba(0, 0, 0, 0.23) 0px 3px 6px"
                            justifyContent="space-between"
                            flexDirection="column"
                            overflow="hidden"
                            bg="base.d100"
                            rounded={5}
                            flex={1}
                            p={5}
                            >
                            <VStack mb={6}>
                                <Heading
                                fontSize={{ base: "xl", md: "2xl" }}
                                textAlign="left"
                                w="full"
                                mb={2}
                                >
                                {post.title}
                                </Heading>
                                <Text w="full">{post.body}</Text>
                            </VStack>

                            <Flex justifyContent="space-between">
                                <HStack spacing={2}>
                                <Tag size="sm" variant="outline" colorScheme="gray">
                                    Faizan
                                </Tag>
                                </HStack>
                                <Link to={"/view/" + post._id}>
                                    <Button
                                    colorScheme="gray"
                                    size="sm">More
                                    </Button>
                                </Link>
                            </Flex>
                        </Flex>
                    ))}
                </ChakraCarousel>
            </Container>

            <Footer/>
        </VStack>
    )
}

export default Home;